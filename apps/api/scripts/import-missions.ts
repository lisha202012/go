/**
 * Import missions from apps/api/data/missions-945.json into Postgres.
 *
 * Usage (from apps/api):
 *   npx tsx scripts/import-missions.ts --dry-run --category N7 --hill HOPE
 *   npx tsx scripts/import-missions.ts --category N7 --hill HOPE
 *   npx tsx scripts/import-missions.ts
 */
import type { HillCode } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import type { AgeCategoryCode } from '../src/lib/ageCategories.js';
import { AGE_CATEGORY_CODES } from '../src/lib/ageCategories.js';
import {
  getMissionCatalogMeta,
  listMissionCatalogRecords,
  type MissionCatalogRecord,
} from '../src/lib/missionCatalog.js';
import { getMissionCompletionCoins } from '../src/lib/missionRewards.js';

const HILL_CODES = ['HOPE', 'HONE', 'HOLD', 'HOOD', 'HOST', 'HORN', 'HOOK'] as const;

type ImportOptions = {
  dryRun: boolean;
  categoryCodes: AgeCategoryCode[];
  hillCodes: HillCode[];
};

function parseArgs(argv: string[]): ImportOptions {
  const categoryCodes = new Set<AgeCategoryCode>();
  const hillCodes = new Set<HillCode>();
  let dryRun = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--category' && argv[i + 1]) {
      categoryCodes.add(argv[++i] as AgeCategoryCode);
      continue;
    }
    if (arg === '--hill' && argv[i + 1]) {
      hillCodes.add(argv[++i].toUpperCase() as HillCode);
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  for (const code of categoryCodes) {
    if (!AGE_CATEGORY_CODES.includes(code)) {
      throw new Error(`Invalid category code: ${code}`);
    }
  }
  for (const code of hillCodes) {
    if (!(HILL_CODES as readonly string[]).includes(code)) {
      throw new Error(`Invalid hill code: ${code}`);
    }
  }

  return {
    dryRun,
    categoryCodes: categoryCodes.size ? [...categoryCodes] : [...AGE_CATEGORY_CODES],
    hillCodes: hillCodes.size ? [...hillCodes] : [...HILL_CODES],
  };
}

function printHelp() {
  console.log(`Import GOFAM mission catalog into Postgres

Options:
  --dry-run            Print missions that would be imported; no DB writes
  --category <code>    Limit to category (repeatable): S1E, S1G, S1R, A2, B3, C4, D5, V6, N7
  --hill <code>        Limit to hill (repeatable): HOPE, HONE, HOLD, HOOD, HOST, HORN, HOOK

Examples:
  npx tsx scripts/import-missions.ts --dry-run --category N7 --hill HOPE
  npx tsx scripts/import-missions.ts --category N7 --hill HOPE
  npx tsx scripts/import-missions.ts
`);
}

function printPreview(records: MissionCatalogRecord[]) {
  console.log('Mission ID\tGroup\tTitle');
  for (const record of records) {
    console.log(`${record.externalId}\t${record.missionGroup}\t${record.title}`);
  }
}

async function upsertMission(
  prisma: PrismaClient,
  hillId: string,
  record: MissionCatalogRecord,
  flatCoinReward: number,
) {
  const existing = await prisma.mission.findUnique({
    where: {
      hillId_categoryCode_order: {
        hillId,
        categoryCode: record.categoryCode,
        order: record.order,
      },
    },
  });

  const missionData = {
    categoryCode: record.categoryCode,
    missionGroup: record.missionGroup,
    externalId: record.externalId,
    title: record.title,
    description: record.instruction,
    coinReward: flatCoinReward,
    pulseReward: 5,
    requiresReflection: record.order >= 10,
    requiresEvidence: record.order === 15,
    isFamilyMission: record.hillCode === 'HOPE',
  };

  if (!existing) {
    await prisma.mission.create({
      data: {
        hillId,
        order: record.order,
        ...missionData,
      },
    });
    return 'created';
  }

  const changed =
    existing.externalId !== missionData.externalId ||
    existing.missionGroup !== missionData.missionGroup ||
    existing.title !== missionData.title ||
    existing.description !== missionData.description;

  await prisma.mission.update({
    where: { id: existing.id },
    data: missionData,
  });
  return changed ? 'updated' : 'unchanged';
}

async function main() {
  const options = parseArgs(process.argv);
  const meta = getMissionCatalogMeta();
  const records = listMissionCatalogRecords({
    categoryCodes: options.categoryCodes,
    hillCodes: options.hillCodes,
  });

  console.log(
    `Catalog: ${meta.missionCount} missions from ${meta.source} (${meta.extractedAt})`,
  );
  console.log(
    `Scope: ${options.categoryCodes.join(', ')} × ${options.hillCodes.join(', ')} → ${records.length} rows`,
  );

  if (records.length === 0) {
    console.error('No missions matched the requested filters.');
    process.exit(1);
  }

  printPreview(records);

  if (options.dryRun) {
    console.log(`\nDry run only — ${records.length} missions would be imported.`);
    return;
  }

  const prisma = new PrismaClient();
  const flatCoinReward = await getMissionCompletionCoins();
  const hills = await prisma.hill.findMany();
  const hillByCode = new Map(hills.map((hill) => [hill.code, hill.id]));

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  try {
    for (const record of records) {
      const hillId = hillByCode.get(record.hillCode);
      if (!hillId) {
        throw new Error(`Hill not found in database: ${record.hillCode}`);
      }

      const result = await upsertMission(prisma, hillId, record, flatCoinReward);
      if (result === 'created') created += 1;
      else if (result === 'updated') updated += 1;
      else unchanged += 1;
    }

    console.log(`\nImport complete: ${created} created, ${updated} updated, ${unchanged} unchanged.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
