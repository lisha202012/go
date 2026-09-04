/**
 * Verify flowLockstepSteps matches MIN(GrowthSet count per hill) for all v2 users.
 *
 * Run: npx tsx scripts/check-flow-lockstep-consistency.ts [--fix]
 */
import { findAllLockstepDrifts } from '../src/lib/flowWeek/lockstep';
import { prisma } from '../src/lib/prisma';

async function main() {
  const fix = process.argv.includes('--fix');
  const drifts = await findAllLockstepDrifts();

  if (drifts.length === 0) {
    console.log('OK: all v2 users have flowLockstepSteps consistent with GrowthSet rows');
    return;
  }

  console.error(`Found ${drifts.length} user(s) with lockstep drift:`);
  for (const drift of drifts) {
    console.error(
      `  user=${drift.userId} counter=${drift.flowLockstepSteps} derived=${drift.derivedFromGrowthSets}`,
    );
    console.error(`    countsByHillId=${JSON.stringify(drift.countsByHillId)}`);

    if (fix) {
      await prisma.user.update({
        where: { id: drift.userId },
        data: { flowLockstepSteps: drift.derivedFromGrowthSets },
      });
      console.log(`  fixed user ${drift.userId} → ${drift.derivedFromGrowthSets}`);
    }
  }

  process.exit(fix ? 0 : 1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
