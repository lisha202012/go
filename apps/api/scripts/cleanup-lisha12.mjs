/**
 * One-off cleanup for test account 'lisha12' — stale flowIndex / orphaned mission progress
 * after GAP schema rebuild. Run from apps/api:
 *   node scripts/cleanup-lisha12.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const username = process.argv[2] ?? 'lisha123';
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    console.log(`User "${username}" not found — nothing to clean.`);
    return;
  }

  console.log(`User: ${user.username} (${user.id})`);
  console.log(`  flowIndex: ${user.flowIndex}, onboardingCompleted: ${user.onboardingCompleted}`);

  const assessment = await prisma.gapAssessment.findUnique({ where: { userId: user.id } });
  console.log(`  GapAssessment exists: ${assessment != null}`);

  const validHillIds = new Set(
    (await prisma.hill.findMany({ select: { id: true } })).map((h) => h.id),
  );

  const progressRows = await prisma.userMissionProgress.findMany({
    where: { userId: user.id },
    include: { mission: { select: { id: true, hillId: true, title: true } } },
  });

  const orphaned = progressRows.filter(
    (row) => !row.mission || !validHillIds.has(row.mission.hillId),
  );

  console.log(`  UserMissionProgress total: ${progressRows.length}, orphaned: ${orphaned.length}`);

  if (orphaned.length > 0) {
    const deleted = await prisma.userMissionProgress.deleteMany({
      where: { id: { in: orphaned.map((r) => r.id) } },
    });
    console.log(`  Deleted ${deleted.count} orphaned UserMissionProgress row(s).`);
  }

  if (!assessment) {
    await prisma.user.update({
      where: { id: user.id },
      data: { flowIndex: 0, onboardingCompleted: false },
    });
    console.log('  No GapAssessment — reset flowIndex=0, onboardingCompleted=false.');
  } else {
    console.log('  GapAssessment present — left user flow fields unchanged.');
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
