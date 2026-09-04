import { TREE_LEVELS, COIN_MILESTONES as COIN_THRESHOLDS, COIN_MILESTONE_STARS } from './treeStarService';

export {
  TREE_LEVELS,
  getTreeProgress,
  grantTreeStars,
  awardCampTreeStar,
  awardGapTreeStars,
  checkAndAwardCoinMilestones,
  awardVirtueTreeStar,
  buildTreeProgressFromTotal,
} from './treeStarService';

export const COIN_MILESTONES = COIN_THRESHOLDS.map((coins) => ({
  coins,
  stars: COIN_MILESTONE_STARS[coins] ?? 0,
}));

export function resolveTreeLevelCompat(totalStars: number) {
  let current: (typeof TREE_LEVELS)[number] = TREE_LEVELS[0];
  for (const lvl of TREE_LEVELS) {
    if (totalStars >= lvl.required) current = lvl;
    else break;
  }
    const next = current.level < TREE_LEVELS.length ? TREE_LEVELS[current.level] : null;
  return {
    current: {
      level: current.level,
      name: current.stage,
      enum: current.enum,
      starsRequired: current.required,
    },
    next: next
      ? {
          level: next.level,
          name: next.stage,
          enum: next.enum,
          starsRequired: next.required,
        }
      : null,
    totalStars,
  };
}

/** @deprecated Prefer checkAndAwardCoinMilestones (ledger-backed). */
export function computeUnclaimedCoinMilestoneStars(
  lifetimeCoins: number,
  alreadyClaimedUpTo: number,
): { stars: number; newClaimedUpTo: number } {
  let stars = 0;
  let newClaimedUpTo = alreadyClaimedUpTo;
  for (const coins of COIN_THRESHOLDS) {
    if (lifetimeCoins >= coins && coins > alreadyClaimedUpTo) {
      stars += COIN_MILESTONE_STARS[coins] ?? 0;
      newClaimedUpTo = coins;
    }
  }
  return { stars, newClaimedUpTo };
}
