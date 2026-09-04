/** True when challenge crossed 21/21 on this action. */
export function didJustCompleteGrowChallenge(before, after) {
  if (!after?.isComplete) return false;
  const target = after.glowSeedsTarget ?? 21;
  const beforeEarned = before?.glowSeedsEarned ?? 0;
  return beforeEarned < target;
}
