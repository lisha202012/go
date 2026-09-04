import { LedgerType, TreeLevel, type Prisma } from '@prisma/client';
import { getFlowStatus } from '../services/gapScoring';
import { prisma } from './prisma';

type Tx = Prisma.TransactionClient;

export const TREE_LEVELS = [
  { level: 1, stage: 'Seedling Tree', required: 0, enum: TreeLevel.Seedling },
  { level: 2, stage: 'Sprouting Tree', required: 10, enum: TreeLevel.Sprouting },
  { level: 3, stage: 'Young Tree', required: 25, enum: TreeLevel.YoungTree },
  { level: 4, stage: 'Flourishing Tree', required: 50, enum: TreeLevel.Flourishing },
  { level: 5, stage: 'Blossoming Tree', required: 75, enum: TreeLevel.Blossoming },
  { level: 6, stage: 'Fruiting Tree', required: 100, enum: TreeLevel.Fruiting },
  { level: 7, stage: 'Ancient Tree', required: 150, enum: TreeLevel.Ancient },
  { level: 8, stage: 'Radiant Tree', required: 200, enum: TreeLevel.Radiant },
  { level: 9, stage: 'Sacred Tree', required: 300, enum: TreeLevel.Sacred },
  { level: 10, stage: 'Tree of FLOW', required: 490, enum: TreeLevel.TreeOfFlow },
] as const;

export const GAP_STATUS_STARS: Record<string, number> = {
  'Needs Attention': 1,
  'Emerging FLOW': 2,
  'Growing FLOW': 3,
  'Strong FLOW': 5,
  'Superb FLOW': 7,
};

export const COIN_MILESTONES = [10_000, 50_000, 100_000, 250_000, 500_000] as const;
export const COIN_MILESTONE_STARS: Record<number, number> = {
  10_000: 5,
  50_000: 5,
  100_000: 10,
  250_000: 10,
  500_000: 25,
};
export const COIN_MILLION_STEP = 1_000_000;
export const COIN_MILLION_FIRST = 1_500_000;
export const COIN_MILLION_STARS = 100;
export const GLOW_VIRTUE_MONTHLY_CAP = 7;

export type TreeStarGrantResult = {
  granted: boolean;
  stars: number;
  newTotal: number;
  levelUp: boolean;
  newLevel: number;
  newStage: string;
};

export type CampReachedLike = { number: number; name?: string } | null | undefined;

function resolveLevelFromStars(totalStars: number) {
  let current = TREE_LEVELS[0];
  for (const lvl of TREE_LEVELS) {
    if (totalStars >= lvl.required) current = lvl;
    else break;
  }
  return current;
}

/** Lifetime personal-growth earnings (positive amounts only — not spends / promotional). */
export async function sumLifetimePersonalGrowthCoins(tx: Tx, userId: string): Promise<number> {
  const agg = await tx.coinLedgerEntry.aggregate({
    where: {
      userId,
      ledgerType: LedgerType.personal_growth,
      amount: { gt: 0 },
    },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

export function nextCoinMilestone(lifetimeCoins: number): number | null {
  for (const t of COIN_MILESTONES) {
    if (lifetimeCoins < t) return t;
  }
  if (lifetimeCoins < COIN_MILLION_FIRST) return COIN_MILLION_FIRST;
  const stepsPast = Math.floor((lifetimeCoins - COIN_MILLION_FIRST) / COIN_MILLION_STEP) + 1;
  return COIN_MILLION_FIRST + stepsPast * COIN_MILLION_STEP;
}

export async function grantTreeStars(
  tx: Tx,
  userId: string,
  source: string,
  sourceKey: string,
  stars: number,
): Promise<TreeStarGrantResult> {
  if (stars <= 0) {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { treeStars: true, treeLevel: true },
    });
    const level = resolveLevelFromStars(user.treeStars);
    return {
      granted: false,
      stars: 0,
      newTotal: user.treeStars,
      levelUp: false,
      newLevel: level.level,
      newStage: level.stage,
    };
  }

  const existing = await tx.treeStarGrant.findUnique({
    where: {
      userId_source_sourceKey: { userId, source, sourceKey },
    },
    select: { id: true },
  });
  if (existing) {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { treeStars: true },
    });
    const level = resolveLevelFromStars(user.treeStars);
    return {
      granted: false,
      stars: 0,
      newTotal: user.treeStars,
      levelUp: false,
      newLevel: level.level,
      newStage: level.stage,
    };
  }

  await tx.treeStarGrant.create({
    data: { userId, source, sourceKey, stars },
  });

  const before = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { treeStars: true, treeLevel: true },
  });
  const newTotal = before.treeStars + stars;
  const newLevelRow = resolveLevelFromStars(newTotal);
  const levelUp = newLevelRow.enum !== before.treeLevel;

  await tx.user.update({
    where: { id: userId },
    data: {
      treeStars: newTotal,
      ...(levelUp ? { treeLevel: newLevelRow.enum } : {}),
    },
  });

  return {
    granted: true,
    stars,
    newTotal,
    levelUp,
    newLevel: newLevelRow.level,
    newStage: newLevelRow.stage,
  };
}

export async function awardCampTreeStar(
  tx: Tx,
  userId: string,
  campReached: CampReachedLike,
): Promise<TreeStarGrantResult | null> {
  if (!campReached) return null;
  return grantTreeStars(tx, userId, 'camp', String(campReached.number), 1);
}

export async function awardGapTreeStars(
  tx: Tx,
  userId: string,
  gapAssessment: { id: string; flowIndex: number; isOfficial: boolean },
): Promise<TreeStarGrantResult | null> {
  if (!gapAssessment.isOfficial) return null;
  const status = getFlowStatus(gapAssessment.flowIndex);
  const stars = GAP_STATUS_STARS[status] ?? 0;
  if (stars <= 0) return null;
  return grantTreeStars(tx, userId, 'gap', gapAssessment.id, stars);
}

export async function checkAndAwardCoinMilestones(
  tx: Tx,
  userId: string,
): Promise<TreeStarGrantResult[]> {
  const lifetimeCoins = await sumLifetimePersonalGrowthCoins(tx, userId);
  const results: TreeStarGrantResult[] = [];

  for (const threshold of COIN_MILESTONES) {
    if (lifetimeCoins < threshold) continue;
    const stars = COIN_MILESTONE_STARS[threshold] ?? 0;
    if (stars <= 0) continue;
    results.push(await grantTreeStars(tx, userId, 'coin_milestone', String(threshold), stars));
  }

  for (
    let threshold = COIN_MILLION_FIRST;
    threshold <= lifetimeCoins;
    threshold += COIN_MILLION_STEP
  ) {
    results.push(
      await grantTreeStars(tx, userId, 'coin_milestone', String(threshold), COIN_MILLION_STARS),
    );
  }

  return results;
}

export async function awardVirtueTreeStar(
  tx: Tx,
  userId: string,
  virtue: string,
  at = new Date(),
): Promise<TreeStarGrantResult | null> {
  const monthKey = at.toISOString().slice(0, 7); // "2026-08" UTC
  const monthCount = await tx.treeStarGrant.count({
    where: {
      userId,
      source: 'virtue',
      sourceKey: { endsWith: monthKey },
    },
  });
  if (monthCount >= GLOW_VIRTUE_MONTHLY_CAP) {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { treeStars: true },
    });
    const level = resolveLevelFromStars(user.treeStars);
    return {
      granted: false,
      stars: 0,
      newTotal: user.treeStars,
      levelUp: false,
      newLevel: level.level,
      newStage: level.stage,
    };
  }
  return grantTreeStars(tx, userId, 'virtue', `${virtue}:${monthKey}`, 1);
}

export function buildTreeProgressFromTotal(treeStarsTotal: number) {
  const currentStage = resolveLevelFromStars(treeStarsTotal);
  const nextStage =
    currentStage.level < TREE_LEVELS.length ? TREE_LEVELS[currentStage.level] : null;
  const starsIntoLevel = treeStarsTotal - currentStage.required;
  const starsNeededForNextLevel = nextStage
    ? nextStage.required - currentStage.required
    : null;

  return {
    treeStarsTotal,
    treeLevel: currentStage.level,
    currentStage: {
      level: currentStage.level,
      stage: currentStage.stage,
      required: currentStage.required,
    },
    nextStage: nextStage
      ? { level: nextStage.level, stage: nextStage.stage, required: nextStage.required }
      : null,
    starsIntoLevel,
    starsNeededForNextLevel,
  };
}

export async function getTreeProgress(userId: string, db: Tx | typeof prisma = prisma) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { treeStars: true },
  });
  return buildTreeProgressFromTotal(user.treeStars);
}

export async function getMyJourneyPayload(
  userId: string,
  opts: {
    hillsCompleted: number;
    hillsTotal?: number;
  },
) {
  const [tree, lifetimeCoins, planted, bloomed] = await Promise.all([
    getTreeProgress(userId, prisma),
    sumLifetimePersonalGrowthCoins(prisma, userId),
    prisma.glowSeed.count({ where: { senderId: userId } }),
    prisma.glowSeed.count({ where: { senderId: userId, bloomedAt: { not: null } } }),
  ]);

  const plantedTarget = Math.max(25, planted);
  const bloomedTarget = Math.max(20, bloomed);
  const next = nextCoinMilestone(lifetimeCoins);
  const monthKey = new Date().toISOString().slice(0, 7);
  const virtueStarsThisMonth = await prisma.treeStarGrant.count({
    where: {
      userId,
      source: 'virtue',
      sourceKey: { endsWith: monthKey },
    },
  });

  return {
    ...tree,
    hillsCompleted: opts.hillsCompleted,
    hillsTotal: opts.hillsTotal ?? 7,
    lifetimeCoins,
    nextCoinMilestone: next,
    nextCoinMilestoneStars:
      next == null
        ? null
        : next in COIN_MILESTONE_STARS
          ? COIN_MILESTONE_STARS[next]
          : COIN_MILLION_STARS,
    virtueStarsThisMonth,
    virtueStarsMonthlyCap: GLOW_VIRTUE_MONTHLY_CAP,
    glowSeedsPlanted: planted,
    glowSeedsPlantedTarget: plantedTarget,
    glowSeedsBloomed: bloomed,
    glowSeedsBloomedTarget: bloomedTarget,
  };
}
