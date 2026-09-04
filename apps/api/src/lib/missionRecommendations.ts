import type { Hill, Mission } from '@prisma/client';
import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';
import { ensureHillMissionPool } from './ensureMissionPool';
import {
  buildRecommendationSeed,
  MISSION_GROUP_COUNT,
  MISSION_POOL_SIZE,
  recommendThreeMissions,
} from './missionEngine';
import { recordMissionSurfacing } from './missionFreshness';
import { getMissionRewardConfig, type MissionRewardConfig } from './missionRewards';
import { syncUserAgeGroupFromDob } from './userAgeSync';

export type MissionOption = {
  id: string;
  title: string;
  description: string;
  order: number;
  coinReward: number;
  requiresReflection: boolean;
  requiresEvidence: boolean;
};

type HillRef = Pick<Hill, 'id' | 'code'>;

export function mapMissionOptions(
  missions: Array<Mission | MissionOption>,
  perMission?: number,
): MissionOption[] {
  return missions.map((mission) => ({
    id: mission.id,
    title: mission.title,
    description: mission.description,
    order: mission.order,
    coinReward: perMission ?? mission.coinReward,
    requiresReflection: mission.requiresReflection,
    requiresEvidence: mission.requiresEvidence,
  }));
}

export async function getHillMissionRecommendations(
  userId: string,
  hill: HillRef,
  seedContext: 'focus' | `block-${number}`,
) {
  const categoryCode = await syncUserAgeGroupFromDob(userId);

  const fullHill = await prisma.hill.findUniqueOrThrow({ where: { id: hill.id } });
  await ensureHillMissionPool(fullHill, categoryCode);

  const pool = await prisma.mission.findMany({
    where: { hillId: hill.id, categoryCode },
    orderBy: { order: 'asc' },
  });

  if (pool.length < MISSION_POOL_SIZE) {
    throw new AppError(
      `Expected ${MISSION_POOL_SIZE} missions for ${categoryCode} on ${hill.code} — run db seed`,
      500,
    );
  }

  const seed = buildRecommendationSeed(userId, hill.id, seedContext);
  const recommended = recommendThreeMissions(pool, seed);
  await recordMissionSurfacing(
    userId,
    recommended.map((m) => m.id),
    'recommendation',
  );
  const rewards = await getMissionRewardConfig();

  return {
    categoryCode,
    recommended,
    pickCount: 3,
    rewards,
  };
}

export type MissionPreviewOption = MissionOption & {
  isRecommended: boolean;
  missionGroup: number;
};

export async function getFocusHillMissionOptionPool(
  userId: string,
  hill: HillRef,
) {
  const { categoryCode, recommended, pickCount, rewards } = await getHillMissionRecommendations(
    userId,
    hill,
    'focus',
  );

  const fullHill = await prisma.hill.findUniqueOrThrow({ where: { id: hill.id } });
  await ensureHillMissionPool(fullHill, categoryCode);

  const pool = await prisma.mission.findMany({
    where: { hillId: hill.id, categoryCode },
    orderBy: { order: 'asc' },
  });

  if (pool.length < MISSION_POOL_SIZE) {
    throw new AppError(
      `Expected ${MISSION_POOL_SIZE} missions for ${categoryCode} on ${hill.code} — run db seed`,
      500,
    );
  }

  const recommendedIds = recommended.map((m) => m.id);
  const recommendedSet = new Set(recommendedIds);
  const options: MissionPreviewOption[] = pool.map((mission) => ({
    ...mapMissionOptions([mission], rewards.perMission)[0]!,
    isRecommended: recommendedSet.has(mission.id),
    missionGroup: mission.missionGroup,
  }));

  return {
    categoryCode,
    pickCount,
    rewards,
    recommendedIds,
    options,
  };
}

export async function getDayMissionPreview(
  userId: string,
  dayIndex: number,
  hill: HillRef,
) {
  const { recommended, rewards, pickCount } = await getHillMissionRecommendations(
    userId,
    hill,
    `block-${dayIndex}` as `block-${number}`,
  );

  const categoryCode = await syncUserAgeGroupFromDob(userId);
  const fullHill = await prisma.hill.findUniqueOrThrow({ where: { id: hill.id } });
  await ensureHillMissionPool(fullHill, categoryCode);

  const pool = await prisma.mission.findMany({
    where: { hillId: hill.id, categoryCode },
    orderBy: { order: 'asc' },
  });

  if (pool.length < MISSION_POOL_SIZE) {
    throw new AppError(
      `Expected ${MISSION_POOL_SIZE} missions for ${categoryCode} on ${hill.code} — run db seed`,
      500,
    );
  }

  const recommendedIds = new Set(recommended.map((m) => m.id));
  const byGroup = new Map<number, Mission[]>();
  for (const mission of pool) {
    if (!byGroup.has(mission.missionGroup)) byGroup.set(mission.missionGroup, []);
    byGroup.get(mission.missionGroup)!.push(mission);
  }

  const missions: MissionPreviewOption[] = [];
  for (let group = 1; group <= MISSION_GROUP_COUNT; group += 1) {
    const groupMissions = byGroup.get(group);
    if (!groupMissions?.length) continue;
    const recommendedInGroup = recommended.find((m) => m.missionGroup === group);
    const displayMission = recommendedInGroup ?? groupMissions[0]!;
    missions.push({
      ...mapMissionOptions([displayMission], rewards.perMission)[0]!,
      isRecommended: recommendedIds.has(displayMission.id),
      missionGroup: group,
    });
  }

  return {
    dayIndex,
    hill: fullHill,
    pickCount,
    missions,
    rewards,
  };
}

export function applyRewardConfigToJourney<
  T extends {
    weeks: Array<{ mission: { coinReward: number } | null }>;
    summary?: {
      lastCompletedCycle?: {
        missions: Array<{ coinReward: number }>;
      } | null;
    };
  },
>(journey: T, rewards: MissionRewardConfig): T & { rewards: MissionRewardConfig } {
  for (const week of journey.weeks) {
    if (week.mission) {
      week.mission.coinReward = rewards.perMission;
    }
  }
  if (journey.summary?.lastCompletedCycle) {
    const cycle = journey.summary.lastCompletedCycle;
    for (const mission of cycle.missions) {
      mission.coinReward = rewards.perMission;
    }
    Object.assign(cycle, {
      missionCoinsEarned: cycle.missions.length * rewards.perMission,
      cycleBonusCoins: rewards.growthSetBonus,
      hillStepsEarned: rewards.hillStepOnCycleComplete,
      totalCoinsEarned:
        cycle.missions.length * rewards.perMission + rewards.growthSetBonus,
    });
  }
  return { ...journey, rewards };
}

export function applyRewardsToCompletedCycleSummary<
  T extends {
    missions: Array<{ coinReward: number }>;
  } | null,
>(summary: T, rewards: MissionRewardConfig) {
  if (!summary) return null;
  const missionCoinsEarned = summary.missions.length * rewards.perMission;
  return {
    ...summary,
    missions: summary.missions.map((m) => ({ ...m, coinReward: rewards.perMission })),
    missionCoinsEarned,
    cycleBonusCoins: rewards.growthSetBonus,
    hillStepsEarned: rewards.hillStepOnCycleComplete,
    totalCoinsEarned: missionCoinsEarned + rewards.growthSetBonus,
  };
}
