/**
 * Post-cutover verification for E2E validation.
 * Run: npx tsx scripts/verify-journey-v2-cutover.ts [--award-step]
 */
import { prisma } from '../src/lib/prisma';
import { deriveLockstepStepsForUser } from '../src/lib/flowWeek/lockstep';
import { awardLockstepStep } from '../src/lib/flowWeek/lockstep';
import { FLOW_WEEK_AWARD_SOURCES } from '../src/lib/flowWeek/types';

const TEST_USERNAMES = ['lisha12', 'cutover_cohort_c', 'cutover_cohort_d', 'cutover_cohort_e'];
const awardStep = process.argv.includes('--award-step');

async function main() {
  console.log('=== POST-CUTOVER VERIFICATION ===\n');

  const batchAudit = await prisma.auditLog.findFirst({
    where: { action: 'migration.v2_cutover.batch_complete' },
    orderBy: { createdAt: 'desc' },
  });
  console.log('Batch audit:', batchAudit ? 'FOUND' : 'MISSING');
  if (batchAudit?.metadata) {
    console.log('  metadata:', JSON.stringify(batchAudit.metadata, null, 2));
  }

  const cutoverAudits = await prisma.auditLog.findMany({
    where: { action: 'migration.v2_cutover' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { subjectUser: { select: { username: true } } },
  });
  console.log(`\nPer-user cutover audits: ${cutoverAudits.length}`);
  for (const a of cutoverAudits) {
    const meta = a.metadata as { cohort?: string; lockstepSteps?: number; legacyPeakSteps?: number };
    console.log(
      `  ${a.subjectUser?.username}: cohort=${meta?.cohort} lockstep=${meta?.lockstepSteps} peak=${meta?.legacyPeakSteps} beforeJson=${a.beforeJson ? 'yes' : 'no'} afterJson=${a.afterJson ? 'yes' : 'no'}`,
    );
  }

  console.log('\n--- User state ---');
  for (const username of TEST_USERNAMES) {
    const user = await prisma.user.findFirst({
      where: { username },
      include: {
        gapAssessment: { select: { dayRankings: true } },
        personalWeekSchedules: { include: { days: true } },
      },
    });
    if (!user) {
      console.log(`  ${username}: NOT FOUND`);
      continue;
    }

    const derived = await deriveLockstepStepsForUser(user.id);
    const match = derived === user.flowLockstepSteps;
    const gsCounts = await prisma.growthSet.groupBy({
      by: ['hillId'],
      where: { userId: user.id },
      _count: { id: true },
    });
    const counts = gsCounts.map((g) => g._count.id);
    const minGs = counts.length ? Math.min(...counts) : 0;
    const maxGs = counts.length ? Math.max(...counts) : 0;

    const migrationCoins = await prisma.coinLedgerEntry.count({
      where: { userId: user.id, source: 'migration_block_conversion' },
    });

    console.log(`  ${username}:`);
    console.log(`    jmv=${user.journeyModelVersion} flowLockstep=${user.flowLockstepSteps} derived=${derived} match=${match}`);
    console.log(`    legacyPeak=${user.legacyPeakSteps} gsMin=${minGs} gsMax=${maxGs}`);
    console.log(`    dayRankings=${user.gapAssessment?.dayRankings.length ?? 0} schedules=${user.personalWeekSchedules.length} days=${user.personalWeekSchedules[0]?.days.length ?? 0}`);
    console.log(`    migration_block_conversion entries=${migrationCoins} snapshot=${user.legacyJourneySnapshot ? 'yes' : 'no'}`);

    if (!match) {
      console.log(`    *** DRIFT: flowLockstepSteps ${user.flowLockstepSteps} !== derived ${derived}`);
    }
  }

  if (awardStep) {
    const target = await prisma.user.findFirst({ where: { username: 'lisha12' } });
    if (!target) throw new Error('lisha12 not found');
    console.log('\n--- awardLockstepStep test (lisha12) ---');
    const before = target.flowLockstepSteps;
    const result = await awardLockstepStep(
      target.id,
      FLOW_WEEK_AWARD_SOURCES.perfectWeek,
      { test: 'e2e-verify' },
    );
    console.log('  awardBatchId:', result.awardBatchId);
    console.log('  growthSetIds:', result.growthSetIds.length, 'rows');
    console.log('  flowLockstepSteps:', before, '→', result.flowLockstepSteps);

    const batchRows = await prisma.growthSet.findMany({
      where: { userId: target.id, awardBatchId: result.awardBatchId },
    });
    console.log('  rows with shared awardBatchId:', batchRows.length);
    console.log('  awardSource:', batchRows[0]?.awardSource);
    assertEqual(batchRows.length, 7, 'expected 7 GrowthSet rows');

    const derivedAfter = await deriveLockstepStepsForUser(target.id);
    const userAfter = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    console.log(
      '  post-award derived=',
      derivedAfter,
      'counter=',
      userAfter.flowLockstepSteps,
      'match=',
      derivedAfter === userAfter.flowLockstepSteps,
    );
  }

  console.log('\n=== DONE ===');
}

function assertEqual(actual: number, expected: number, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
