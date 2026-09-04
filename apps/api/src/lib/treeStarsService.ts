/**
 * @deprecated Prefer importing from `./treeStarService` (Tree Stars v1.0 ledger).
 * Kept as a thin re-export so older imports keep compiling.
 */
export {
  TREE_LEVELS,
  COIN_MILESTONES,
  getTreeProgress,
  grantTreeStars,
  awardCampTreeStar,
  awardGapTreeStars,
  checkAndAwardCoinMilestones,
  awardVirtueTreeStar,
  buildTreeProgressFromTotal,
  resolveTreeLevelCompat as resolveTreeLevel,
  computeUnclaimedCoinMilestoneStars,
} from './treeStarServiceCompat';
