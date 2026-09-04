/**
 * Backfill Mission.whyText from apps/api/data/missions-945.json (Mission Engine WHY?).
 * Usage (from apps/api): npx tsx scripts/sync-mission-why.ts
 */
import { prisma } from '../src/lib/prisma';
import { getAllMissionCatalogRecords } from '../src/lib/missionCatalog';

async function main() {
  const records = getAllMissionCatalogRecords();
  let byExternalId = 0;
  let byKey = 0;
  let missing = 0;

  for (const record of records) {
    const why = record.why?.trim();
    if (!why) {
      missing += 1;
      continue;
    }

    const viaExternal = await prisma.mission.updateMany({
      where: { externalId: record.externalId },
      data: { whyText: why },
    });
    byExternalId += viaExternal.count;

    if (viaExternal.count === 0) {
      const hill = await prisma.hill.findUnique({ where: { code: record.hillCode } });
      if (!hill) continue;
      const viaOrder = await prisma.mission.updateMany({
        where: {
          hillId: hill.id,
          categoryCode: record.categoryCode,
          order: record.order,
        },
        data: { whyText: why, externalId: record.externalId },
      });
      byKey += viaOrder.count;
    }
  }

  const withWhy = await prisma.mission.count({
    where: { whyText: { not: null } },
  });
  console.log(
    `WHY? sync complete. byExternalId=${byExternalId} byHillOrder=${byKey} catalogMissingWhy=${missing} missionsWithWhy=${withWhy}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
