import type { Mission } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import type { AgeCategoryCode } from './ageCategories';

/** Missions stored per hill per age category (client spec). */
export const MISSION_POOL_SIZE = 15;

/** Active missions shown/recommended at once — one from each of 3 different groups. */
export const MISSIONS_SHOWN = 3;

/** Internal groups per hill pool (5 groups × 3 missions). */
export const MISSION_GROUP_COUNT = 5;

export const MISSIONS_PER_GROUP = 3;

export function missionGroupForOrder(order: number): number {
  return Math.min(MISSION_GROUP_COUNT, Math.ceil(order / MISSIONS_PER_GROUP));
}

export function resolveUserCategoryCode(ageGroup: string | null | undefined): AgeCategoryCode {
  const valid = ['S1E', 'S1G', 'S1R', 'A2', 'B3', 'C4', 'D5', 'V6', 'N7'] as const;
  if (ageGroup && (valid as readonly string[]).includes(ageGroup)) {
    return ageGroup as AgeCategoryCode;
  }
  return 'V6';
}

/** Deterministic PRNG so recommendations stay stable until the user confirms. */
function createSeededRandom(seed: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return () => {
    hash += hash << 13;
    hash ^= hash >>> 7;
    hash += hash << 3;
    hash ^= hash >>> 17;
    hash += hash << 5;
    return (hash >>> 0) / 4294967296;
  };
}

function shuffleWithRandom<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Section 3 — pick 3 different mission groups, one mission from each, shuffle display order.
 */
export function recommendThreeMissions(pool: Mission[], seed: string): Mission[] {
  if (pool.length < MISSION_POOL_SIZE) {
    throw new AppError(
      `Expected ${MISSION_POOL_SIZE} missions in pool but found ${pool.length}`,
      500,
    );
  }

  const byGroup = new Map<number, Mission[]>();
  for (const mission of pool) {
    const group = mission.missionGroup;
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group)!.push(mission);
  }

  const availableGroups = [...byGroup.keys()].filter((g) => (byGroup.get(g)?.length ?? 0) > 0);
  if (availableGroups.length < MISSIONS_SHOWN) {
    throw new AppError('Mission pool is missing required groups', 500);
  }

  const random = createSeededRandom(seed);
  const shuffledGroups = shuffleWithRandom(availableGroups, random).slice(0, MISSIONS_SHOWN);

  const picked = shuffledGroups.map((group) => {
    const candidates = byGroup.get(group)!;
    const index = Math.floor(random() * candidates.length);
    return candidates[index];
  });

  return shuffleWithRandom(picked, random);
}

export function validateMissionSelection(
  missions: Mission[],
  hillId: string,
  categoryCode: string,
): void {
  if (missions.length !== MISSIONS_SHOWN) {
    throw new AppError(`Pick exactly ${MISSIONS_SHOWN} missions`, 400);
  }

  for (const mission of missions) {
    if (mission.hillId !== hillId || mission.categoryCode !== categoryCode) {
      throw new AppError('Invalid mission selection for this hill', 400);
    }
  }

  const groups = new Set(missions.map((m) => m.missionGroup));
  if (groups.size !== MISSIONS_SHOWN) {
    throw new AppError('Pick missions from 3 different groups', 400);
  }
}

/** Section 5 — user-confirmed picks may share internal groups after manual swaps. */
export function validateUserMissionSelection(
  missions: Mission[],
  hillId: string,
  categoryCode: string,
): void {
  if (missions.length !== MISSIONS_SHOWN) {
    throw new AppError(`Pick exactly ${MISSIONS_SHOWN} missions`, 400);
  }

  const ids = new Set<string>();
  for (const mission of missions) {
    if (mission.hillId !== hillId || mission.categoryCode !== categoryCode) {
      throw new AppError('Invalid mission selection for this hill', 400);
    }
    if (ids.has(mission.id)) {
      throw new AppError('Pick 3 different missions', 400);
    }
    ids.add(mission.id);
  }
}

export function buildRecommendationSeed(
  userId: string,
  hillId: string,
  context: 'focus' | `block-${number}`,
): string {
  return `${userId}:${hillId}:${context}`;
}
