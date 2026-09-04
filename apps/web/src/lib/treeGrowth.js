/** Plain-language helpers for tree level UI (see apps/api/src/lib/treeStarService.ts). */

export function formatStarReward(stars) {
  if (stars <= 0) return '';
  if (stars === 1) return '1 point';
  return `${stars} points`;
}

export function coinsUntilNextMilestone(lifetime, nextMilestone) {
  if (nextMilestone == null) return null;
  return Math.max(0, nextMilestone - (lifetime ?? 0));
}

/** User-friendly summary — avoids confusing "1/10 Tree Stars" wording. */
export function describeTreeProgress(journey) {
  const level = journey?.treeLevel ?? 1;
  const stage = journey?.currentStage?.stage ?? 'Seedling Tree';
  const total = journey?.treeStarsTotal ?? 0;
  const next = journey?.nextStage;
  const bandSize = journey?.starsNeededForNextLevel;
  const intoBand = journey?.starsIntoLevel ?? 0;

  if (!next || bandSize == null) {
    return {
      level,
      stage,
      total,
      isMax: true,
      headline: 'Your tree is fully grown',
      detail: `You collected ${total} growth point${total === 1 ? '' : 's'} in total.`,
      progressPct: 100,
    };
  }

  const pointsToLevelUp = Math.max(0, next.required - total);
  const progressPct = bandSize > 0 ? Math.min(100, Math.round((intoBand / bandSize) * 100)) : 0;

  return {
    level,
    stage,
    total,
    isMax: false,
    nextStage: next.stage,
    nextLevel: next.level,
    pointsToLevelUp,
    progressPct,
    headline:
      pointsToLevelUp === 1
        ? '1 more point to level up'
        : `${pointsToLevelUp} more points to level up`,
    detail: `You have ${total} point${total === 1 ? '' : 's'} · Level ${next.level} is ${next.stage}`,
  };
}

export function describeCampGrowth(focusHill) {
  const nextCamp = focusHill?.nextCamp;
  const stepsLeft =
    nextCamp && focusHill?.completedSteps != null
      ? Math.max(0, nextCamp.stepThreshold - focusHill.completedSteps)
      : null;

  if (nextCamp && stepsLeft != null && stepsLeft > 0) {
    return `Keep doing missions — ${stepsLeft} more step${stepsLeft === 1 ? '' : 's'} until ${nextCamp.name}.`;
  }
  if (nextCamp && stepsLeft === 0) {
    return `Your next Camp (${nextCamp.name}) is almost here — finish your current step.`;
  }
  if (focusHill?.currentCamp?.name) {
    return `You are at ${focusHill.currentCamp.name}. Each new Camp gives 1 point.`;
  }
  return 'Finish missions on your hills to reach the next Camp.';
}

export function describeCoinGrowth(lifetime, nextCoins, nextCoinStars) {
  const coinsLeft = coinsUntilNextMilestone(lifetime, nextCoins);
  if (nextCoins == null || coinsLeft == null) {
    return 'You hit every coin milestone — keep earning for bonus points.';
  }
  const starLabel = formatStarReward(nextCoinStars);
  return `You have ${(lifetime ?? 0).toLocaleString()} coins. At ${nextCoins.toLocaleString()} you get ${starLabel}.`;
}

export function describeVirtueGrowth(used, cap) {
  const left = Math.max(0, cap - used);
  if (left <= 0) {
    return `You used all ${cap} virtue points this month. They reset next month.`;
  }
  return `${left} virtue point${left === 1 ? '' : 's'} still available this month (${used} of ${cap} used).`;
}
