/** Seed intentional lockstep drift and verify checker. Run: npx tsx scripts/seed-lockstep-drift.ts */
import { prisma } from '../src/lib/prisma';
import { checkLockstepConsistency } from '../src/lib/flowWeek/lockstep';

const username = 'cutover_cohort_d';

async function main() {
  const user = await prisma.user.findFirst({ where: { username } });
  if (!user) throw new Error(`${username} not found`);

  console.log('Before drift seed:');
  console.log(JSON.stringify(await checkLockstepConsistency(user.id), null, 2));

  await prisma.user.update({
    where: { id: user.id },
    data: { flowLockstepSteps: user.flowLockstepSteps + 5 },
  });

  console.log('\nAfter seeding drift (+5 on counter):');
  const drift = await checkLockstepConsistency(user.id);
  console.log(JSON.stringify(drift, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
