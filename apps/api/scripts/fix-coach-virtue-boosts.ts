import { prisma } from '../src/lib/prisma';

async function main() {
  const now = new Date();
  const rows = await prisma.activeVirtue.findMany({
    where: {
      expiresAt: { gt: now },
      sourceSeed: {
        isSystemSeed: true,
        seedKind: { in: ['welcome_coach', 'monthly_coach'] },
      },
    },
    select: { id: true, virtue: true, userId: true },
  });

  console.log(`Fixing ${rows.length} coach-gift ×2 boosts…`);
  if (rows.length > 0) {
    await prisma.activeVirtue.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { expiresAt: now },
    });
    for (const row of rows) {
      console.log(`  - ${row.virtue} (${row.id})`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
