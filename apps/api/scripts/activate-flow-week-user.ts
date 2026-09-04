/**
 * Dev helper: set gofamWeekStartDay and bootstrap FLOW Week v2 for an existing GAP user.
 * Usage: npx tsx scripts/activate-flow-week-user.ts USERNAME [weekday 0-6]
 */
import { prisma } from '../src/lib/prisma';
import { tryBootstrapFlowWeekForUser } from '../src/lib/flowWeek/flowWeekService';

async function main() {
  const username = process.argv[2];
  const weekDayArg = process.argv[3];

  if (!username) {
    console.error('Usage: npx tsx scripts/activate-flow-week-user.ts USERNAME [weekday 0-6]');
    process.exit(1);
  }

  const gofamWeekStartDay =
    weekDayArg != null ? Number(weekDayArg) : new Date().getDay();

  if (!Number.isInteger(gofamWeekStartDay) || gofamWeekStartDay < 0 || gofamWeekStartDay > 6) {
    console.error('weekday must be 0-6 (Sun-Sat)');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.error(`User not found: ${username}`);
    process.exit(1);
  }

  if (user.gofamWeekStartDay == null) {
    await prisma.user.update({
      where: { id: user.id },
      data: { gofamWeekStartDay },
    });
    console.log(`Set gofamWeekStartDay=${gofamWeekStartDay} for ${username}`);
  } else {
    console.log(`gofamWeekStartDay already ${user.gofamWeekStartDay}`);
  }

  const bootstrapped = await tryBootstrapFlowWeekForUser(user.id);
  const after = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      username: true,
      journeyModelVersion: true,
      gofamWeekStartDay: true,
      flowLockstepSteps: true,
      starterWeekActive: true,
    },
  });

  console.log('Bootstrap:', bootstrapped ? 'OK' : 'skipped (already v2 or missing GAP)');
  console.table([after]);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
