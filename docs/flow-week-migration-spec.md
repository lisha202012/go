# FLOW Week Redesign — Migration Spec (v2)

> **Update (2026-08):** The journey goal is now the **[30-Day GOFAM GROW Challenge](./30-day-challenge-spec.md)** — earn **21 Glow Seeds in 30 days** (not 21 consecutive days). This spec remains the source for FLOW Week mechanics; see the challenge doc for progress UX and philosophy.

**Status:** Approved structure (v1) + revisions below — **Phase 1 may start after v2 sign-off.**  
**Replaces:** Focus Hill block rotation, calendar-Monday mission week-gate, per-Hill independent Steps/Camps, flat +5/+15 coin display.  
**Reference:** `New task flow.txt` + approved decisions (2026-08-14).

---

## Approved decisions (locked)

| # | Decision |
|---|----------|
| 1 | **Option B** — preserve `legacyStepsByHill`; UI shows **“legacy peak”** during transition (never hidden). |
| 2 | **Lockstep baseline** = `min(steps)` across Hills at cutover; `flowLockstepSteps` mirrors this. |
| 3 | **Strict 7/7** — Perfect FLOW Week only; no partial Hill Step credit. Coins remain per-mission. |
| 4 | **Mid-week GAP retake** — finish current personal week on **old** rank; new rank from **next** personal week start (edge case below). |
| 5 | **Starter Week** — one-time only (see below); completing all starter days awards **+1 Step on all 7 Hills**. |
| 6 | **Chakra/Tree** — separate UI pass; Phase 1 emits backend events only. |
| 7 | **GrowthSet rows** — always write **7 new `GrowthSet` rows** (one per Hill) on each Perfect or Starter Week Step award; **`flowLockstepSteps` is a denormalized counter**, not a substitute for row writes. |

---

## Step awards — GrowthSet (final, not optional)

On **Starter Week complete** or **Perfect FLOW Week**:

1. Insert **7 `GrowthSet` rows** in one transaction — one per Hill, shared `completedAt`, shared `awardBatchId` (UUID).
2. Increment `user.flowLockstepSteps += 1` and recompute `currentStep` / `currentCampId`.
3. Write audit log: `journey.flow_week.step_awarded` with `awardBatchId` and all 7 row IDs.

**Do not** use counter-only Step awards. Existing pre-cutover `GrowthSet` rows are never deleted.

### `GrowthSet` schema addition (Phase 1)

```prisma
model GrowthSet {
  // ... existing fields
  awardBatchId  String?   // UUID linking the 7 lockstep rows from one award
  awardSource   String?   // "legacy_block" | "flow_perfect_week" | "flow_starter_week" | "migration_baseline"
}
```

---

## User cohorts at cutover

| Cohort | Condition | Migration action |
|--------|-----------|------------------|
| **A** | No GAP / onboarding incomplete | New model only; collect `gofamWeekStartDay` in onboarding. |
| **B** | GAP done, ≤2 mission completions total | Standard cutover; legacy peak usually invisible. |
| **C** | Mid block (weekly-gated missions 1–3 in progress) | Snapshot → `legacyJourneySnapshot`; coin conversion (below); close block. |
| **D** | Uneven `GrowthSet` counts across Hills | Option B peaks; lockstep = `min(count)`. |
| **E** | Focus Hill ≥35 steps | Same as D; legacy peak must show in UI. |

### Cohort C — `legacyJourneySnapshot` shape (fixed)

Captured at cutover for users with an **active legacy block** (≥1 mission `current` or `completed` in the current focus/block hill, block not fully done):

```typescript
type LegacyJourneySnapshot = {
  schemaVersion: 1;
  capturedAt: string; // ISO
  cohort: 'C';
  journeyModelVersion: 1;
  focusHillId: string;
  focusHillCode: string;
  /** 3 mission IDs selected for the active block (from focusMissionIds or hillMissionSelections) */
  blockMissionIds: [string, string, string] | string[];
  blockHillId: string;
  /** Per-mission progress at cutover */
  missions: Array<{
    missionId: string;
    orderInBlock: 1 | 2 | 3;
    status: 'locked' | 'current' | 'completed';
    completedAt: string | null;
    startedAt: string | null;
  }>;
  /** Week-gate state from missionWeekGate at cutover */
  weekGate: {
    waitingNextWeek: boolean;
    nextOpensAt: string | null; // ISO
    currentMissionId: string | null;
  };
  /** Full assessment selection map for audit */
  hillMissionSelections: Record<string, string[]>;
  focusMissionIds: string[];
  /** Coins granted during cutover (see conversion rule) */
  coinConversion: {
    completedMissionIds: string[];
    coinsPerMission: 10;
    totalCoinsGranted: number;
    ledgerEntryIds: string[];
  } | null;
  blockClosed: true;
};
```

### Cohort C — coin conversion rule (cutover)

For each mission in the active block with `status === 'completed'` at cutover:

1. Grant **one-time +10 coins** via `CoinLedgerEntry` (`source: migration_block_conversion`, `ledgerType: credit`).
2. Update `walletCoins` (+10 per completed mission).
3. Record mission IDs and ledger IDs in `legacyJourneySnapshot.coinConversion`.
4. Mark block **closed** — no further week-gate progression on legacy routes (`journeyModelVersion = 2`).

Incomplete missions in the block (`current` / `locked`) earn **no** cutover coins. They do not carry forward as prescribed missions; the user starts fresh on the new daily schedule.

---

## Cutover script

**Script:** `apps/api/scripts/migrate-journey-v2.ts`  
**Idempotency:** process only `WHERE journeyModelVersion = 1`; skip users already at `2`.

```
FOR each user WITH gapAssessment AND journeyModelVersion = 1:
  BEFORE := snapshot User fields + GrowthSet counts + cohort C block state

  legacyStepsByHill  := { hillId: COUNT(growthSets) GROUP BY hillId }
  lockstepSteps        := MIN(values(legacyStepsByHill))
  legacyPeakSteps      := MAX(values(legacyStepsByHill))

  IF cohort C:
    legacyJourneySnapshot := buildLegacyJourneySnapshot(user) 
    grant +10 per completed block mission → coinConversion in snapshot

  UPDATE user:
    flowLockstepSteps, legacyStepsByHill, legacyPeakSteps,
    journeyModelVersion = 2, migratedAt = NOW(),
    currentStep = lockstepSteps, currentCampId = campForSteps(lockstepSteps),
    legacyJourneySnapshot (if cohort C)

  BUILD dayRankings from GapHillScore (see tie-break)
  CREATE first PersonalWeekSchedule (starter or full)

  writeAuditLog({
    module: 'journey',
    action: 'migration.v2_cutover',
    actorUserId: null,           // system
    subjectUserId: user.id,
    entityType: 'User',
    entityId: user.id,
    beforeJson: BEFORE,
    afterJson: AFTER,
    metadata: { cohort, scriptVersion: 'migrate-journey-v2@1.0.0', runId: BATCH_RUN_ID }
  })

AFTER all users:
  writeAuditLog({
    module: 'system',
    action: 'migration.v2_cutover.batch_complete',
    metadata: { runId, usersProcessed, usersSkipped, startedAt, finishedAt, errors[] }
  })
```
Uses existing `writeAuditLog` / `AuditLog` model (`auditService.ts`) — append-only, never update/delete audit rows.

---

## Rollback plan

**Script:** `apps/api/scripts/rollback-journey-v2.ts`  
**When:** cutover misbehaviour discovered before users accumulate new-model progress (or per-admin decision).

Rollback is feasible because: (1) pre-cutover `GrowthSet` rows were not deleted; (2) per-user `beforeJson` is in `AuditLog`; (3) post-cutover lockstep `GrowthSet` batches are tagged with `awardBatchId` / `awardSource`.

### Rollback steps (per user, or batch)

1. **Guard:** refuse if user has `flowLockstepSteps > lockstepStepsAtMigration` *and* post-cutover `GrowthSet` rows exist with `awardSource IN ('flow_perfect_week','flow_starter_week')` unless `--force` (prevents silent loss of earned v2 progress).
2. Load latest `migration.v2_cutover` audit for `subjectUserId`; fail if missing.
3. **Delete** `PersonalWeekSchedule` + `PersonalDayAssignment` rows where `createdAt >= migratedAt`.
4. **Delete** `GrowthSet` rows where `awardSource IN ('flow_perfect_week','flow_starter_week')` OR `awardBatchId` set after cutover (never delete rows with `awardSource IS NULL` or `legacy_block`).
5. **Reverse** migration coin grants: delete `CoinLedgerEntry` where `source = migration_block_conversion` and restore `walletCoins` (sum reversed).
6. **Restore** `User` fields from audit `beforeJson` (`journeyModelVersion = 1`, `flowLockstepSteps`, `legacyStepsByHill`, etc.).
7. `writeAuditLog({ action: 'migration.v2_rollback', beforeJson, afterJson, metadata: { reason, originalRunId } })`.

Batch rollback writes one `migration.v2_rollback.batch_complete` system audit.

### Rollback audit logging (v2 addition)

Same append-only pattern as cutover:

1. **Per user:** `migration.v2_rollback` with `beforeJson` / `afterJson`, `metadata.originalCutoverAuditId`, `metadata.forced`, `metadata.forceReason`, `metadata.actor`.
2. **Batch:** `migration.v2_rollback.batch_complete` with counts, errors, and any `--force` context.
3. **Every `--force` use:** explicit `migration.v2_rollback.force_used` **before** destructive work, recording `actor`, `reason`, and the guard message that was overridden.

CLI: `--force --actor=<userId> --reason="..."` (reason required in runbook; script warns if omitted).

### Lockstep consistency check (v2 addition)

`flowLockstepSteps` must always equal `MIN(GrowthSet count per hill)` for v2 users.

- **Pure helper:** `deriveLockstepStepsFromCounts()` / `checkLockstepConsistency()` in `src/lib/flowWeek/lockstep.ts`.
- **Periodic / CI script:** `npx tsx scripts/check-flow-lockstep-consistency.ts` (exit 1 on drift; optional `--fix` to reset counter from GrowthSet rows).
- **Unit tests:** `src/lib/flowWeek/flowWeek.test.ts`.

Catches drift if the denormalized counter and 7-row Step awards ever diverge.

**Not rolled back automatically:** new GAP `dayRankings` fields on assessments (harmless while `journeyModelVersion = 1` routes are active). Document in runbook.

---

## GAP rank → personal day assignment

1. Sort Hills by `rawScore` **ascending** (lowest = earliest day among the ranked set).
2. **Tie-break** (secondary sort): `GAP_HILL_CODE_ORDER` index **descending** — the Hill **later** in the fixed list gets the **earlier day number** among tied scores.

**Fixed order:** `HOPE → HONE → HOLD → HOOD → HOST → HORN → HOOK` (index 0–6).

### Tie-break concrete example

| Hill | rawScore |
|------|----------|
| HOOK | 10 |
| HOPE | 12 |
| HOST | 12 |
| HONE | 15 |
| … | … |

Ranking:

- **Day 1:** HOOK (10 — unique lowest)
- **Day 2:** **HOST** (12 — tied with HOPE; HOST index 4 > HOPE index 0 → HOST gets earlier day)
- **Day 3:** **HOPE** (12 — second in tie pair)
- **Day 4+:** remaining Hills by score, same tie rule

Same rule as existing `pickFocusHillId()` in `gapScoring.ts` for lowest-score ties.

3. Persist as `dayRankings[0..6]` on `GapAssessment` (index 0 = Day 1).
4. Map Day 1 → user's `gofamWeekStartDay` (0=Sun … 6=Sat); days wrap Wed→Tue permanently.
5. `rankingsLockedUntil = completedAt + 90 days`.

### Mid-week GAP retake (edge case)

When retake falls inside an active personal week:

- **Current week:** keep **`previousAssessment.dayRankings`** for all remaining days, **including** retake on the start weekday.
- **Next personal week:** starts on the **following** start weekday; use **`newAssessment.dayRankings`**.

---

## Starter Week (mid-cycle join) — **one-time only**

**Eligibility:** exactly once per user, when **both**:

- `starterWeekCompletedAt IS NULL`, and
- user completes onboarding + first GAP **mid-cycle** (join date is after their chosen `gofamWeekStartDay` in the current calendar week, so fewer than 7 days remain until the next start weekday).

**Not re-entered** after long absence, account pause, or re-onboarding. Returning users go straight to full 7-day personal weeks. If product later needs a “re-onboarding starter,” that requires a **new spec amendment** — out of scope for v2.

Flow:

1. Starter length `N` = days from join until next `gofamWeekStartDay` (1–6).
2. Day *i* Hill = `dayRankings[i-1]` (lowest → upward).
3. All *N* days 3/3 → **Starter Week complete** → **7 `GrowthSet` rows** + `flowLockstepSteps += 1` + set `starterWeekCompletedAt`, clear `starterWeekActive`.
4. Next start weekday begins first **full** 7-day personal week.

---

## AFter Glow Seed


 - Personal week = 7 days from `gofamWeekstartDay`.
 - **Perfect** = 3/3 prescribed on each assigned Hill/day.
 - Award: **7 `Growthset` rows** (one per Hill, shared )
## Perfect FLOW Week (ongoing)

- Personal week = 7 days from `gofamWeekStartDay`.
- **Perfect** = 3/3 prescribed on each assigned Hill/day.
- Award: **7 `GrowthSet` rows** (one per Hill, shared `awardBatchId`, `awardSource = flow_perfect_week`) + `flowLockstepSteps += 1`.
- Miss any day → no Step; coins already earned are not revoked.

---

## Backend events (Chakra/Tree — no UI in Phase 1)

| Event | Payload |
|-------|---------|
| `mission.completed` | `userId`, `hillCode`, `missionId`, `isPrescribed`, `prescribedDayIndex`, `coinsAwarded` |
| `dailyFlow.completed` | `userId`, `personalWeekStart`, `dayIndex`, `hillCode`, `dailyFlowComplete: true` |

---
## Prisma schema outline (Phase 1)

### `User` (new fields)

```prisma
gofamWeekStartDay      Int?
journeyModelVersion    Int       @default(1)
migratedAt             DateTime?
flowLockstepSteps      Int       @default(0)
legacyStepsByHill      Json?
legacyPeakSteps        Int       @default(0)
legacyJourneySnapshot  Json?     // LegacyJourneySnapshot, cohort C
starterWeekActive      Boolean   @default(false)
starterWeekCompletedAt DateTime? // null until one-time starter done
```

### `GapAssessment` (extend)

```prisma
dayRankings            String[]  // 7 hillIds; [0]=Day1
rankingsEffectiveFrom  DateTime
rankingsLockedUntil    DateTime
supersededById         String?
```

### New tables

`PersonalWeekSchedule`, `PersonalDayAssignment` — unchanged from v1 (see git history).

---

## Phase 1 deliverable checklist

- [x] Prisma migration (User, GapAssessment, GrowthSet award fields, schedule tables)
- [x] `migrate-journey-v2.ts` with per-user + batch audit logging
- [x] `rollback-journey-v2.ts` with guards, per-user + batch audit, and `--force` audit
- [x] Cohort C snapshot builder + +10 coin conversion (`migration_block_conversion`)
- [x] `dayRankings` with documented tie-break
- [x] Personal week schedule generator (cutover: full 7-day; starter one-time guard wired for Phase 2)
- [x] Step award helper: always 7 `GrowthSet` rows + counter increment (`lockstep.ts`)
- [x] Lockstep consistency script + unit tests
- [x] Unit tests: tie-break, rollback guard, lockstep derive
- [ ] **No** UI, **no** live coin economy (+100/+200), **no** legacy route removal

---

## Out of scope (Phase 2+)

- Coin ledger (+100 / +200 / +10 live economy)
- Daily mission prescription API
- Retiring `missionWeekGate.ts` / block routes
- Chakra/Tree visuals
- Legacy peak UI copy

---

*v2 — incorporates review fixes 2026-08-14. Phase 1 gated on v2 sign-off.*
