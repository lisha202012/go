/**
 * Seeds realistic v1 journey data for FLOW Week v2 cutover E2E validation.
 *
 * Accounts (password for all new accounts: CutoverTest123!):
 *   lisha12          — upgraded to cohort B (GAP + 1 mission)
 *   cutover_cohort_c — in-progress focus block (cohort C)
 *   cutover_cohort_d — uneven GrowthSet counts (cohort D, peak > lockstep)
 *   cutover_cohort_e — focus hill ≥35 steps (cohort E, peak > lockstep)
 *
 * Run: npx tsx scripts/seed-journey-v2-cutover-test.ts
 */
import bcrypt from 'bcrypt';
import { MissionStatus, PrismaClient } from '@prisma/client';
import { HILL_CODE_ORDER } from '../src/lib/hillDomains';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `${process.env.DATABASE_URL}${process.env.DATABASE_URL?.includes('?') ? '&' : '?'}pgbouncer=true`,
    },
  },
});

const PASSWORD = 'CutoverTest123!';
const CATEGORY = 'V6';

type HillMap = Record<string, { id: string; code: string }>;

async function ensureMissions(hillId: string, count: number) {
  const missions = await prisma.mission.findMany({
    where: { hillId, categoryCode: CATEGORY },
    orderBy: { order: 'asc' },
    take: count,
  });
  if (missions.length < count) {
    throw new Error(`Need ${count} missions for hill ${hillId} — run prisma db seed`);
  }
  return missions;
}

async function resetUserJourney(userId: string) {
  await prisma.personalWeekSchedule.deleteMany({ where: { userId } });
  await prisma.growthSet.deleteMany({ where: { userId } });
  await prisma.userMissionProgress.deleteMany({ where: { userId } });
  await prisma.gapAssessment.deleteMany({ where: { userId } });
  await prisma.coinLedgerEntry.deleteMany({
    where: { userId, source: 'migration_block_conversion' },
  });
  await prisma.user.update({
    where: { id: userId },
    data: {
      journeyModelVersion: 1,
      migratedAt: null,
      flowLockstepSteps: 0,
      legacyStepsByHill: null,
      legacyPeakSteps: 0,
      legacyJourneySnapshot: null,
      starterWeekActive: false,
      starterWeekCompletedAt: null,
      gofamWeekStartDay: null,
      onboardingCompleted: true,
      currentStep: 0,
    },
  });
}

function rawScoresForRankings(hills: HillMap): Record<string, number> {
  const scores: Record<string, number> = {};
  HILL_CODE_ORDER.forEach((code, i) => {
    const hill = Object.values(hills).find((h) => h.code === code);
    if (hill) scores[hill.id] = 10 + i * 2 + (code === 'HOST' || code === 'HOPE' ? 0 : 0);
  });
  // HOOK=10, HOPE=12, HOST=12 tie, HONE=14, ...
  scores[Object.values(hills).find((h) => h.code === 'HOOK')!.id] = 10;
  scores[Object.values(hills).find((h) => h.code === 'HOPE')!.id] = 12;
  scores[Object.values(hills).find((h) => h.code === 'HOST')!.id] = 12;
  scores[Object.values(hills).find((h) => h.code === 'HONE')!.id] = 15;
  return scores;
}

async function createGapForUser(
  userId: string,
  hills: HillMap,
  focusCode: string,
  focusMissionIds: string[],
  hillMissionSelections: Record<string, string[] | string[][]>,
) {
  const focusHill = Object.values(hills).find((h) => h.code === focusCode)!;
  const strongestHill = Object.values(hills).find((h) => h.code === 'HOPE')!;
  const rawByHill = rawScoresForRankings(hills);
  const totalRaw = Object.values(rawByHill).reduce((a, b) => a + b, 0);

  await prisma.gapAssessment.create({
    data: {
      userId,
      focusHillId: focusHill.id,
      strongestHillId: strongestHill.id,
      flowIndex: 65,
      totalRawScore: totalRaw,
      focusMissionIds,
      hillMissionSelections,
      completedAt: new Date(),
      nextRecalibrationAt: new Date(Date.now() + 90 * 86400000),
      hillScores: {
        create: Object.entries(rawByHill).map(([hillId, rawScore]) => ({
          hillId,
          rawScore,
          flowPercent: Math.round((rawScore / 25) * 100),
        })),
      },
    },
  });
}

async function insertGrowthSets(userId: string, hillId: string, count: number) {
  const base = Date.now();
  for (let i = 0; i < count; i++) {
    await prisma.growthSet.create({
      data: {
        userId,
        hillId,
        completedAt: new Date(base - i * 3600000),
      },
    });
  }
}

async function upsertTestUser(username: string, email: string) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  let user = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (user) {
    await resetUserJourney(user.id);
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, username, email, onboardingCompleted: true, ageGroup: 'adult' },
    });
  } else {
    user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        onboardingCompleted: true,
        ageGroup: 'adult',
      },
    });
  }
  return user;
}

async function main() {
  const hillRows = await prisma.hill.findMany();
  const hills: HillMap = Object.fromEntries(hillRows.map((h) => [h.code, { id: h.id, code: h.code }]));
  const hope = hills.HOPE!;
  const hook = hills.HOOK!;

  const hopeMissions = await ensureMissions(hope.id, 9);
  const hookMissions = await ensureMissions(hook.id, 6);

  // --- lisha12 → cohort B (GAP + 1 mission off active focus block) ---
  const lisha = await prisma.user.findFirst({ where: { username: 'lisha12' } });
  if (lisha) {
    await resetUserJourney(lisha.id);
    await prisma.user.update({
      where: { id: lisha.id },
      data: { onboardingCompleted: true, ageGroup: 'adult' },
    });
    const hopeBlock = hopeMissions.slice(0, 3);
    await createGapForUser(lisha.id, hills, 'HOOK', hookMissions.slice(0, 3).map((m) => m.id), {
      [hook.id]: [hookMissions.slice(0, 3).map((m) => m.id)],
    });
    await prisma.userMissionProgress.create({
      data: {
        userId: lisha.id,
        missionId: hopeBlock[0]!.id,
        status: MissionStatus.completed,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
    console.log('Seeded lisha12 → cohort B (1 mission off focus block)');
  } else {
    console.warn('lisha12 not found — skipping');
  }

  // --- cohort C: in-progress focus block (m1 done, m2 current) ---
  const userC = await upsertTestUser('cutover_cohort_c', 'cutover.c@gofam.test');
  const focusBlockC = hopeMissions.slice(0, 3);
  await createGapForUser(userC.id, hills, 'HOPE', focusBlockC.map((m) => m.id), {
    [hope.id]: [focusBlockC.map((m) => m.id)],
  });
  const weekAgo = new Date(Date.now() - 8 * 86400000);
  await prisma.userMissionProgress.create({
    data: {
      userId: userC.id,
      missionId: focusBlockC[0]!.id,
      status: MissionStatus.completed,
      startedAt: weekAgo,
      completedAt: weekAgo,
    },
  });
  await prisma.userMissionProgress.create({
    data: {
      userId: userC.id,
      missionId: focusBlockC[1]!.id,
      status: MissionStatus.current,
      startedAt: new Date(),
    },
  });
  console.log('Seeded cutover_cohort_c → cohort C (block m1 done, m2 current)');

  // --- cohort D: uneven GrowthSets (HOPE=5, HONE=2, others=1) ---
  const userD = await upsertTestUser('cutover_cohort_d', 'cutover.d@gofam.test');
  await createGapForUser(userD.id, hills, 'HOOK', hookMissions.slice(0, 3).map((m) => m.id), {
    [hook.id]: [hookMissions.slice(0, 3).map((m) => m.id)],
  });
  await insertGrowthSets(userD.id, hope.id, 5);
  await insertGrowthSets(userD.id, hills.HONE!.id, 2);
  for (const code of HILL_CODE_ORDER) {
    if (code === 'HOPE' || code === 'HONE') continue;
    await insertGrowthSets(userD.id, hills[code]!.id, 1);
  }
  console.log('Seeded cutover_cohort_d → cohort D (HOPE=5, HONE=2, others=1)');

  // --- cohort E: focus HOPE ≥35 steps, uneven (HOPE=36, others=3) ---
  const userE = await upsertTestUser('cutover_cohort_e', 'cutover.e@gofam.test');
  await createGapForUser(userE.id, hills, 'HOPE', hopeMissions.slice(0, 3).map((m) => m.id), {
    [hope.id]: [hopeMissions.slice(0, 3).map((m) => m.id)],
  });
  await insertGrowthSets(userE.id, hope.id, 36);
  for (const code of HILL_CODE_ORDER) {
    if (code === 'HOPE') continue;
    await insertGrowthSets(userE.id, hills[code]!.id, 3);
  }
  console.log('Seeded cutover_cohort_e → cohort E (HOPE=36, others=3)');

  console.log('\nDone. Test password (new accounts):', PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
