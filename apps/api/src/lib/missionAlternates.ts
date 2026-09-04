import type { Mission } from '@prisma/client';
import { MissionStatus } from '@prisma/client';
import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';
import { ensureHillMissionPool } from './ensureMissionPool';
import {
  getLatestSurfacingMap,
  nextSwapCount,
  rankMissionsByFreshness,
  recordMissionSurfacing,
} from './missionFreshness';
import { MISSION_POOL_SIZE } from './missionEngine';
import { getMissionRewardConfig } from './missionRewards';
import { mapMissionOptions } from './missionRecommendations';
import { syncUserAgeGroupFromDob } from './userAgeSync';

export type MissionCycleContext = 'focus' | `block-${number}`;

function parseCycleKey(context: MissionCycleContext): string {
  return context;
}

export async function getEligibleMissionAlternates(
  userId: string,
  hillId: string,
  slotMissionId: string,
  selectedMissionIds: string[],
  context: MissionCycleContext,
) {
  if (selectedMissionIds.length !== 3) {
    throw new AppError('Provide exactly 3 selected mission IDs', 400);
  }
  if (!selectedMissionIds.includes(slotMissionId)) {
    throw new AppError('Slot mission must be in the current selection', 400);
  }

  const categoryCode = await syncUserAgeGroupFromDob(userId);

  const hill = await prisma.hill.findUniqueOrThrow({ where: { id: hillId } });
  await ensureHillMissionPool(hill, categoryCode);

  const pool = await prisma.mission.findMany({
    where: { hillId, categoryCode },
    orderBy: { order: 'asc' },
  });

  if (pool.length < MISSION_POOL_SIZE) {
    throw new AppError(`Expected ${MISSION_POOL_SIZE} missions — run db seed`, 500);
  }

  const excluded = new Set(selectedMissionIds);
  const eligible = pool.filter((m) => !excluded.has(m.id));

  const progress = await prisma.userMissionProgress.findMany({
    where: { userId, missionId: { in: selectedMissionIds } },
    select: { missionId: true, status: true },
  });
  const slotProgress = progress.find((p) => p.missionId === slotMissionId);
  if (slotProgress?.status === MissionStatus.completed) {
    throw new AppError('Completed missions cannot be swapped in the current cycle', 400);
  }

  let surfacingMap: Map<string, Date | null>;
  try {
    surfacingMap = await getLatestSurfacingMap(
      userId,
      eligible.map((m) => m.id),
    );
  } catch (surfacingErr) {
    console.warn('[mission-alternates] MissionSurfacing read failed:', surfacingErr);
    surfacingMap = new Map(eligible.map((m) => [m.id, null]));
  }
  const ranked = rankMissionsByFreshness(eligible, surfacingMap);

  try {
    await recordMissionSurfacing(
      userId,
      ranked.map((m) => m.id),
      'swap_picker',
    );
  } catch (surfacingErr) {
    console.warn('[mission-alternates] MissionSurfacing write failed:', surfacingErr);
  }

  const rewards = await getMissionRewardConfig();

  return {
    hill,
    categoryCode,
    slotMissionId,
    cycleKey: parseCycleKey(context),
    rewards,
    alternates: mapMissionOptions(ranked, rewards.perMission),
  };
}

export async function recordMissionSwap(
  userId: string,
  hillId: string,
  originalMissionId: string,
  replacementMissionId: string,
  context: MissionCycleContext,
) {
  const categoryCode = await syncUserAgeGroupFromDob(userId);
  const cycleKey = parseCycleKey(context);

  const [original, replacement] = await Promise.all([
    prisma.mission.findUnique({ where: { id: originalMissionId } }),
    prisma.mission.findUnique({ where: { id: replacementMissionId } }),
  ]);

  if (!original || !replacement) {
    throw new AppError('Invalid mission swap', 400);
  }
  if (original.hillId !== hillId || replacement.hillId !== hillId) {
    throw new AppError('Missions must belong to the same hill', 400);
  }
  if (original.categoryCode !== categoryCode || replacement.categoryCode !== categoryCode) {
    throw new AppError('Missions must match your age category', 400);
  }
  if (originalMissionId === replacementMissionId) {
    throw new AppError('Replacement must differ from the original mission', 400);
  }

  const progress = await prisma.userMissionProgress.findUnique({
    where: { userId_missionId: { userId, missionId: originalMissionId } },
  });
  if (progress?.status === MissionStatus.completed) {
    throw new AppError('Completed missions cannot be swapped', 400);
  }

  const swapCount = await nextSwapCount(userId, cycleKey);

  const swap = await prisma.missionSwap.create({
    data: {
      userId,
      hillId,
      categoryCode,
      cycleKey,
      originalMissionId,
      replacementMissionId,
      swapCount,
    },
  });

  await recordMissionSurfacing(userId, [replacementMissionId], 'swap_picker');

  return swap;
}
