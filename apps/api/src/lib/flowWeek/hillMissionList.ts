import type { Hill, HillCode } from '@prisma/client';
import { prisma } from '../prisma';
import { ensureHillMissionPool } from '../ensureMissionPool';
import { getMissionCatalogRecord } from '../missionCatalog';
import {
  buildRecommendationSeed,
  MISSION_POOL_SIZE,
  recommendThreeMissions,
  resolveUserCategoryCode,
} from '../missionEngine';
import { FLOW_WEEK_COIN_REWARDS } from './types';
import { formatCompletionCountLabel, resolveMissionReward } from './homeHillRewards';
import { startOfDay } from './personalWeek';

export type HillMissionListItem = {
  id: string;
  title: string;
  description: string;
  whyText: string;
  order: number;
  missionGroup: number;
  coinReward: number;
  requiresReflection: boolean;
  requiresEvidence: boolean;
  completionCount: number;
  completionLabel: string;
  started: boolean;
  lastCompletedAt: string | null;
  /** Already completed once on today's calendar date. */
  completedToday: boolean;
  /** True for the 3 deterministic daily recommendations. */
  isRecommended: boolean;
};

export function resolveMissionWhyText(
  whyText: string | null | undefined,
  hill?: Pick<Hill, 'name' | 'virtueName'> | null,
): string {
  const custom = whyText?.trim();
  if (custom) return custom;
  // Prefer catalog WHY? over a generic filler — empty string hides the disclosure.
  if (hill?.virtueName && hill?.name) {
    return `Practicing this builds ${hill.virtueName} — small daily actions on ${hill.name} compound into lasting growth.`;
  }
  if (hill?.name) {
    return `This habit strengthens your growth on ${hill.name} — small daily actions compound.`;
  }
  return '';
}

type HillListRewardContext = {
  isTodayHomeHill: boolean;
  dailyBonusClaimed: boolean;
  homeBonusSlotsUsed: number;
  /** Today's day assignment — used so completed bonus-slot missions keep showing +100. */
  dayAssignmentId?: string;
  /** Mission IDs already recorded as home_bonus_slot for today. */
  prescribedSlotIds?: Set<string>;
};

function resolveDisplayCoinReward(
  missionId: string,
  opts: {
    earnedBonus?: number;
    nextCoins: number;
    isRecommended: boolean;
    prescribedSlotIds: Set<string>;
    rewardContext?: HillListRewardContext;
  },
): number {
  if (opts.earnedBonus != null) return opts.earnedBonus;

  const ctx = opts.rewardContext;
  const inPrescribedSlot = opts.prescribedSlotIds.has(missionId);
  const slotsOpen =
    Boolean(ctx?.isTodayHomeHill) &&
    !ctx?.dailyBonusClaimed &&
    (ctx?.homeBonusSlotsUsed ?? 0) < 3;

  if (inPrescribedSlot || (opts.isRecommended && slotsOpen)) {
    return FLOW_WEEK_COIN_REWARDS.prescribedMission;
  }

  return opts.nextCoins;
}

function mapHillMissionItems(opts: {
  pool: Array<{
    id: string;
    hillId: string;
    title: string;
    description: string;
    whyText: string | null;
    order: number;
    missionGroup: number;
    requiresReflection: boolean;
    requiresEvidence: boolean;
  }>;
  hill: Pick<Hill, 'id' | 'code' | 'name' | 'virtueName'>;
  categoryCode: ReturnType<typeof resolveUserCategoryCode>;
  progressByMission: Map<
    string,
    { startedAt: Date | null; completedAt: Date | null; completionCount: number }
  >;
  completedTodayIds: Set<string>;
  bonusCoinsByMission: Map<string, number>;
  nextCoins: number;
  recommendedIds: Set<string>;
  prescribedSlotIds: Set<string>;
  rewardContext?: HillListRewardContext;
}): HillMissionListItem[] {
  const items: HillMissionListItem[] = opts.pool.map((mission) => {
    const progress = opts.progressByMission.get(mission.id);
    const completionCount = progress?.completionCount ?? 0;
    const earnedBonus = opts.bonusCoinsByMission.get(mission.id);
    const isRecommended = opts.recommendedIds.has(mission.id);
    const catalogWhy = getMissionCatalogRecord(
      opts.categoryCode,
      opts.hill.code as HillCode,
      mission.order,
    )?.why;
    return {
      id: mission.id,
      title: mission.title,
      description: mission.description,
      whyText: resolveMissionWhyText(mission.whyText || catalogWhy, opts.hill),
      order: mission.order,
      missionGroup: mission.missionGroup,
      coinReward: resolveDisplayCoinReward(mission.id, {
        earnedBonus,
        nextCoins: opts.nextCoins,
        isRecommended,
        prescribedSlotIds: opts.prescribedSlotIds,
        rewardContext: opts.rewardContext,
      }),
      requiresReflection: mission.requiresReflection,
      requiresEvidence: mission.requiresEvidence,
      completionCount,
      completionLabel: formatCompletionCountLabel(completionCount),
      started: Boolean(progress?.startedAt),
      lastCompletedAt: progress?.completedAt?.toISOString() ?? null,
      completedToday: opts.completedTodayIds.has(mission.id),
      isRecommended: opts.recommendedIds.has(mission.id),
    };
  });

  if (opts.recommendedIds.size === 0) return items;
  return [
    ...items.filter((m) => m.isRecommended),
    ...items.filter((m) => !m.isRecommended),
  ];
}

export async function loadHillMissionsWithCounts(opts: {
  userId: string;
  hill: Pick<Hill, 'id' | 'code'> & Partial<Pick<Hill, 'name' | 'virtueName'>>;
  ageGroup: string | null | undefined;
  rewardContext?: HillListRewardContext;
  recommendContext?: 'focus' | `block-${number}`;
}): Promise<HillMissionListItem[]> {
  const byHill = await loadHillsMissionsWithCounts({
    userId: opts.userId,
    hills: [opts.hill],
    ageGroup: opts.ageGroup,
    rewardContext: opts.rewardContext,
    recommendContextByHillId: opts.recommendContext
      ? { [opts.hill.id]: opts.recommendContext }
      : undefined,
  });
  return byHill.get(opts.hill.id) ?? [];
}

/** One round-trip set for many hills — Other Hills used to do this 6× sequentially. */
export async function loadHillsMissionsWithCounts(opts: {
  userId: string;
  hills: Array<Pick<Hill, 'id' | 'code'> & Partial<Pick<Hill, 'name' | 'virtueName'>>>;
  ageGroup: string | null | undefined;
  rewardContext?: HillListRewardContext;
  recommendContextByHillId?: Record<string, 'focus' | `block-${number}`>;
}): Promise<Map<string, HillMissionListItem[]>> {
  const result = new Map<string, HillMissionListItem[]>();
  if (opts.hills.length === 0) return result;

  const categoryCode = resolveUserCategoryCode(opts.ageGroup);
  const hillIds = opts.hills.map((h) => h.id);

  const [fullHills, initialPool] = await Promise.all([
    prisma.hill.findMany({ where: { id: { in: hillIds } } }),
    prisma.mission.findMany({
      where: { hillId: { in: hillIds }, categoryCode, isDisabled: false },
      orderBy: { order: 'asc' },
    }),
  ]);
  const hillById = new Map(fullHills.map((h) => [h.id, h]));

  let pool = initialPool;
  const missing = fullHills.filter(
    (hill) => pool.filter((m) => m.hillId === hill.id).length < MISSION_POOL_SIZE,
  );
  if (missing.length > 0) {
    await Promise.all(missing.map((hill) => ensureHillMissionPool(hill, categoryCode)));
    const filled = await prisma.mission.findMany({
      where: { hillId: { in: missing.map((h) => h.id) }, categoryCode, isDisabled: false },
      orderBy: { order: 'asc' },
    });
    pool = [
      ...pool.filter((m) => !missing.some((h) => h.id === m.hillId)),
      ...filled,
    ];
  }

  const missionIds = pool.map((m) => m.id);
  const todayStart = startOfDay(new Date());

  const [progressRows, todayDoneRows, bonusRows] = await Promise.all([
    missionIds.length
      ? prisma.userMissionProgress.findMany({
          where: { userId: opts.userId, missionId: { in: missionIds } },
          select: {
            missionId: true,
            startedAt: true,
            completedAt: true,
            completionCount: true,
          },
        })
      : Promise.resolve([]),
    missionIds.length
      ? prisma.missionCompletion.findMany({
          where: {
            userId: opts.userId,
            calendarDate: todayStart,
            missionId: { in: missionIds },
          },
          select: { missionId: true },
        })
      : Promise.resolve([]),
    opts.rewardContext?.dayAssignmentId
      ? prisma.missionCompletion.findMany({
          where: {
            userId: opts.userId,
            dayAssignmentId: opts.rewardContext.dayAssignmentId,
            kind: 'home_bonus_slot',
          },
          select: { missionId: true, coinsAwarded: true },
          orderBy: { createdAt: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  const progressByMission = new Map(progressRows.map((p) => [p.missionId, p]));
  const completedTodayIds = new Set(todayDoneRows.map((r) => r.missionId));
  const bonusCoinsByMission = new Map<string, number>();
  for (const row of bonusRows) {
    if (!bonusCoinsByMission.has(row.missionId)) {
      bonusCoinsByMission.set(
        row.missionId,
        row.coinsAwarded || FLOW_WEEK_COIN_REWARDS.prescribedMission,
      );
    }
  }

  const reward = opts.rewardContext
    ? resolveMissionReward({
        isTodayHomeHill: opts.rewardContext.isTodayHomeHill,
        dailyBonusClaimed: opts.rewardContext.dailyBonusClaimed,
        homeBonusSlotsUsed: opts.rewardContext.homeBonusSlotsUsed,
      })
    : null;
  const nextCoins = reward?.baseCoins ?? FLOW_WEEK_COIN_REWARDS.optionalOffHillMission;
  const prescribedSlotIds =
    opts.rewardContext?.prescribedSlotIds ?? new Set<string>();

  for (const hill of opts.hills) {
    const fullHill = hillById.get(hill.id);
    if (!fullHill) {
      result.set(hill.id, []);
      continue;
    }
    const hillPool = pool.filter((m) => m.hillId === hill.id);
    let recommendedIds = new Set<string>();
    const recommendContext = opts.recommendContextByHillId?.[hill.id];
    if (recommendContext && hillPool.length > 0) {
      try {
        const seed = buildRecommendationSeed(opts.userId, hill.id, recommendContext);
        const recommended = recommendThreeMissions(hillPool, seed);
        recommendedIds = new Set(recommended.map((m) => m.id));
      } catch {
        /* pool may be incomplete — show list without badges */
      }
    }
    result.set(
      hill.id,
      mapHillMissionItems({
        pool: hillPool,
        hill: fullHill,
        categoryCode,
        progressByMission,
        completedTodayIds,
        bonusCoinsByMission,
        nextCoins,
        recommendedIds,
        prescribedSlotIds,
        rewardContext: opts.rewardContext,
      }),
    );
  }

  return result;
}

export async function countHomeBonusSlotsUsed(
  userId: string,
  dayAssignmentId: string,
): Promise<number> {
  return prisma.missionCompletion.count({
    where: {
      userId,
      dayAssignmentId,
      kind: 'home_bonus_slot',
    },
  });
}
