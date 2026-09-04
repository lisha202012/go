/**
 * FLOW Week v2 cutover — backfill existing GAP users to journeyModelVersion 2.
 *
 * Run: npx tsx scripts/migrate-journey-v2.ts [--dry-run] [--user-id=<id>]
 */
import { randomUUID } from 'node:crypto';
import { LedgerSource, LedgerType, MissionStatus } from '@prisma/client';
import { writeAuditLog } from '../src/lib/auditService';
import { rankHillsByGapScore, rankingsLockedUntil } from '../src/lib/flowWeek/dayRankings';
import {
  buildLegacyJourneySnapshot,
  classifyMigrationCohort,
  completedBlockMissionIds,
  computeLegacyStepsByHill,
  lockstepFromLegacySteps,
  peakFromLegacySteps,
} from '../src/lib/flowWeek/cohort';
import { loadGrowthSetCountsByHill } from '../src/lib/flowWeek/lockstep';
import { buildUserMigrationBeforeSnapshot } from '../src/lib/flowWeek/migrationSnapshot';
import {
  createPersonalWeekSchedule,
  nextPersonalWeekStart,
  resolveGofamWeekStartDay,
} from '../src/lib/flowWeek/personalWeek';
import { resolveCampProgress } from '../src/lib/hillProgress';
import { HILL_CODE_ORDER } from '../src/lib/hillDomains';
import type { LegacyJourneySnapshot } from '../src/lib/flowWeek/types';
import { prisma } from '../src/lib/prisma';

const SCRIPT_VERSION = 'migrate-journey-v2@1.0.0';
const COINS_PER_COMPLETED_BLOCK_MISSION = 10;

type CliOptions = {
  dryRun: boolean;
  userId?: string;
};

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const userArg = args.find((a) => a.startsWith('--user-id='));
  return {
    dryRun,
    userId: userArg?.split('=')[1],
  };
}

async function main() {
  const opts = parseArgs();
  const runId = randomUUID();
  const startedAt = new Date();
  const errors: Array<{ userId: string; error: string }> = [];
  let usersProcessed = 0;
  let usersSkipped = 0;

  const dryRunSummary = {
    cohortCounts: { A: 0, B: 0, C: 0, D: 0, E: 0 } as Record<'A' | 'B' | 'C' | 'D' | 'E', number>,
    cohortCUsers: 0,
    cohortCCoinConversions: 0,
    cohortCTotalCoins: 0,
    peakAboveLockstep: [] as Array<{
      userId: string;
      username: string;
      lockstep: number;
      peak: number;
      cohort: string;
    }>,
  };

  const hills = await prisma.hill.findMany();
  const hillById = new Map(hills.map((h) => [h.id, h]));
  const orderedHillIds = hills
    .sort((a, b) => HILL_CODE_ORDER.indexOf(a.code) - HILL_CODE_ORDER.indexOf(b.code))
    .map((h) => h.id);

  const users = await prisma.user.findMany({
    where: {
      journeyModelVersion: 1,
      gapAssessment: { isNot: null },
      ...(opts.userId ? { id: opts.userId } : {}),
    },
    include: {
      gapAssessment: {
        include: { hillScores: { include: { hill: true } } },
      },
    },
  });

  console.log(`Found ${users.length} v1 user(s) with GAP to migrate (dryRun=${opts.dryRun})`);

  for (const user of users) {
    const assessment = user.gapAssessment;
    if (!assessment) {
      usersSkipped += 1;
      continue;
    }

    try {
      const countsMap = await loadGrowthSetCountsByHill(user.id, orderedHillIds);
      const legacyStepsByHill = computeLegacyStepsByHill(countsMap, hills);
      const lockstepSteps = lockstepFromLegacySteps(legacyStepsByHill);
      const legacyPeakSteps = peakFromLegacySteps(legacyStepsByHill);

      const growthSetCountsByHill: Record<string, number> = {};
      for (const [hillId, count] of countsMap) {
        growthSetCountsByHill[hillId] = count;
      }

      const progressRows = await prisma.userMissionProgress.findMany({
        where: {
          userId: user.id,
          status: { in: [MissionStatus.current, MissionStatus.completed] },
        },
      });

      const totalMissionCompletions = await prisma.userMissionProgress.count({
        where: { userId: user.id, status: MissionStatus.completed },
      });

      const cohort = classifyMigrationCohort({
        onboardingCompleted: user.onboardingCompleted,
        totalMissionCompletions,
        legacyStepsByHill,
        focusHillId: assessment.focusHillId,
        assessment,
        progressRows,
        hills,
      });

      const hillRaws = assessment.hillScores.map((s) => ({
        hillId: s.hillId,
        hillCode: s.hill.code,
        rawScore: s.rawScore,
      }));
      const dayRankings = rankHillsByGapScore(hillRaws);
      const rankingsLocked = rankingsLockedUntil(assessment.completedAt);

      const gofamWeekStartDay = resolveGofamWeekStartDay(user.gofamWeekStartDay);
      const personalWeekStart = nextPersonalWeekStart(new Date(), gofamWeekStartDay);

      let legacySnapshot: LegacyJourneySnapshot | null = null;
      let coinConversionLedgerIds: string[] = [];
      let totalCoinsGranted = 0;

      if (cohort === 'C') {
        const focusHill = hillById.get(assessment.focusHillId);
        if (!focusHill) throw new Error(`Focus hill not found: ${assessment.focusHillId}`);
        legacySnapshot = buildLegacyJourneySnapshot(assessment, progressRows, focusHill);
      }

      const beforeJson = buildUserMigrationBeforeSnapshot(
        user,
        growthSetCountsByHill,
        lockstepSteps,
      );

      const campProgress = resolveCampProgress(lockstepSteps);
      const campRow = await prisma.camp.findUnique({
        where: { number: campProgress.currentCamp.number },
      });

      const afterUserFields = {
        journeyModelVersion: 2,
        migratedAt: new Date(),
        flowLockstepSteps: lockstepSteps,
        legacyStepsByHill,
        legacyPeakSteps,
        legacyJourneySnapshot: legacySnapshot,
        currentStep: lockstepSteps,
        currentCampId: campRow?.id ?? user.currentCampId,
        gofamWeekStartDay,
        starterWeekActive: false,
      };

      if (opts.dryRun) {
        dryRunSummary.cohortCounts[cohort] += 1;

        if (legacyPeakSteps > lockstepSteps) {
          dryRunSummary.peakAboveLockstep.push({
            userId: user.id,
            username: user.username,
            lockstep: lockstepSteps,
            peak: legacyPeakSteps,
            cohort,
          });
        }

        if (cohort === 'C' && legacySnapshot) {
          const completedIds = completedBlockMissionIds(legacySnapshot);
          dryRunSummary.cohortCUsers += 1;
          dryRunSummary.cohortCCoinConversions += completedIds.length;
          dryRunSummary.cohortCTotalCoins +=
            completedIds.length * COINS_PER_COMPLETED_BLOCK_MISSION;
        }

        console.log(
          `[dry-run] user=${user.username} (${user.id}) cohort=${cohort} lockstep=${lockstepSteps} peak=${legacyPeakSteps} peak>lockstep=${legacyPeakSteps > lockstepSteps} weekStart=${personalWeekStart.toISOString().slice(0, 10)}`,
        );
        usersProcessed += 1;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        if (cohort === 'C' && legacySnapshot) {
          const completedIds = completedBlockMissionIds(legacySnapshot);
          for (const missionId of completedIds) {
            const entry = await tx.coinLedgerEntry.create({
              data: {
                userId: user.id,
                amount: COINS_PER_COMPLETED_BLOCK_MISSION,
                ledgerType: LedgerType.promotional,
                source: LedgerSource.migration_block_conversion,
                referenceId: missionId,
              },
            });
            coinConversionLedgerIds.push(entry.id);
            totalCoinsGranted += COINS_PER_COMPLETED_BLOCK_MISSION;
          }

          if (totalCoinsGranted > 0) {
            await tx.user.update({
              where: { id: user.id },
              data: {
                walletCoins: { increment: totalCoinsGranted },
                growthCoinsLifetime: { increment: totalCoinsGranted },
              },
            });
          }

          legacySnapshot = {
            ...legacySnapshot,
            coinConversion: {
              completedMissionIds: completedIds,
              coinsPerMission: COINS_PER_COMPLETED_BLOCK_MISSION,
              totalCoinsGranted,
              ledgerEntryIds: coinConversionLedgerIds,
            },
            blockClosed: true,
          };
        }

        await tx.gapAssessment.update({
          where: { id: assessment.id },
          data: {
            dayRankings,
            rankingsEffectiveFrom: personalWeekStart,
            rankingsLockedUntil: rankingsLocked,
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: {
            ...afterUserFields,
            legacyJourneySnapshot: legacySnapshot,
          },
        });

        await createPersonalWeekSchedule(tx, {
          userId: user.id,
          assessmentId: assessment.id,
          dayRankings,
          personalWeekStart,
          isStarterWeek: false,
        });
      });

      const afterJson = {
        ...beforeJson,
        user: {
          ...beforeJson.user,
          ...afterUserFields,
          legacyJourneySnapshot: legacySnapshot,
          walletCoins: user.walletCoins + totalCoinsGranted,
        },
        dayRankings,
        personalWeekStart: personalWeekStart.toISOString(),
        scheduleCreated: true,
      };

      await writeAuditLog({
        module: 'journey',
        action: 'migration.v2_cutover',
        actorUserId: null,
        subjectUserId: user.id,
        entityType: 'User',
        entityId: user.id,
        beforeJson,
        afterJson,
        metadata: {
          cohort,
          scriptVersion: SCRIPT_VERSION,
          runId,
          lockstepSteps,
          legacyPeakSteps,
        },
      });

      usersProcessed += 1;
      console.log(`Migrated user ${user.id} (cohort ${cohort}, lockstep ${lockstepSteps})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ userId: user.id, error: message });
      console.error(`Failed user ${user.id}: ${message}`);
    }
  }

  const finishedAt = new Date();

  if (!opts.dryRun) {
    await writeAuditLog({
      module: 'system',
      action: 'migration.v2_cutover.batch_complete',
      metadata: {
        runId,
        scriptVersion: SCRIPT_VERSION,
        usersProcessed,
        usersSkipped,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        errors,
      },
    });
  }

  console.log(
    `Cutover complete: processed=${usersProcessed} skipped=${usersSkipped} errors=${errors.length}`,
  );

  if (opts.dryRun) {
    console.log('\n=== DRY-RUN SUMMARY ===');
    console.log(`Total v1 GAP users: ${users.length}`);
    console.log('Cohort counts:');
    for (const [cohort, count] of Object.entries(dryRunSummary.cohortCounts)) {
      console.log(`  ${cohort}: ${count}`);
    }
    console.log(
      `Cohort C coin conversions: ${dryRunSummary.cohortCUsers} user(s), ${dryRunSummary.cohortCCoinConversions} mission(s), ${dryRunSummary.cohortCTotalCoins} coins total`,
    );
    console.log(
      `Users with legacyPeakSteps > lockstep: ${dryRunSummary.peakAboveLockstep.length}`,
    );
    if (dryRunSummary.peakAboveLockstep.length > 0) {
      for (const row of dryRunSummary.peakAboveLockstep) {
        console.log(
          `  ${row.username} (${row.userId}) cohort=${row.cohort} lockstep=${row.lockstep} peak=${row.peak}`,
        );
      }
    }
    console.log('=======================\n');
  }

  if (errors.length > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
