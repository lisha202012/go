import type { Hill, HillCode, PrismaClient } from '@prisma/client';
import { AGE_CATEGORY_CODES, type AgeCategoryCode } from './ageCategories';
import { prisma } from './prisma';
import { MISSION_POOL_SIZE } from './missionEngine';
import { getMissionCatalogRecord } from './missionCatalog';
import { getMissionCompletionCoins } from './missionRewards';

type EnsurePoolOptions = {
  /** Rewrite titles/rewards from catalog. Seed and admin only — never on page reads. */
  syncExisting?: boolean;
};

export async function ensureHillMissionPool(
  hill: Hill,
  categoryCode: AgeCategoryCode,
  client: PrismaClient = prisma,
  options: EnsurePoolOptions = {},
) {
  const existing = await client.mission.findMany({
    where: { hillId: hill.id, categoryCode },
    select: { id: true, order: true, whyText: true },
  });
  const missingWhy = existing.some((row) => !row.whyText?.trim());
  // Skip when pool is complete and WHY? is already filled (unless full sync).
  if (!options.syncExisting && existing.length >= MISSION_POOL_SIZE && !missingWhy) {
    return;
  }

  const hillCode = hill.code as HillCode;
  const flatCoinReward = await getMissionCompletionCoins();
  const byOrder = new Map(existing.map((row) => [row.order, row]));

  for (let order = 1; order <= MISSION_POOL_SIZE; order++) {
    const record = getMissionCatalogRecord(categoryCode, hillCode, order);
    if (!record) {
      throw new Error(
        `Missing catalog mission for ${categoryCode}/${hillCode} order ${order}. Run: npm run missions:extract`,
      );
    }

    const found = byOrder.get(order);
    const whyText = record.why?.trim() || null;
    const missionData = {
      categoryCode,
      missionGroup: record.missionGroup,
      externalId: record.externalId,
      title: record.title,
      description: record.instruction,
      whyText,
      coinReward: flatCoinReward,
      pulseReward: 5,
      requiresReflection: order >= 10,
      requiresEvidence: order === MISSION_POOL_SIZE,
      isFamilyMission: hillCode === 'HOPE',
    };

    if (!found) {
      await client.mission.create({
        data: { hillId: hill.id, order, ...missionData },
      });
    } else if (options.syncExisting) {
      await client.mission.update({
        where: { id: found.id },
        data: missionData,
      });
    } else if (!found.whyText?.trim() && whyText) {
      await client.mission.update({
        where: { id: found.id },
        data: { whyText },
      });
    }
  }
}

export async function ensureCategoryMissionPools(
  categoryCode: AgeCategoryCode,
  client: PrismaClient = prisma,
) {
  const hills = await client.hill.findMany();
  for (const hill of hills) {
    await ensureHillMissionPool(hill, categoryCode, client, { syncExisting: true });
  }
}

/** @deprecated Use ensureCategoryMissionPools for a user's age category. */
export async function ensureAllMissionPools(client: PrismaClient = prisma) {
  for (const categoryCode of AGE_CATEGORY_CODES) {
    await ensureCategoryMissionPools(categoryCode, client);
  }
}
