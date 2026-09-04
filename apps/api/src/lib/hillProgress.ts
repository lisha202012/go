/** Hill climb progress — 1 Step = all 3 missions completed on that hill (spec). */
export const STEPS_PER_HILL = 49;

/** Calendar length of the first challenge (7 hills × 3 weeks of FLOW). */
export const HILL_CHALLENGE_DAYS = 21;

/** Each week on a hill = 1 task (3 missions). 3 weeks = 3 tasks on that mountain. */
export const HILL_CHALLENGE_TASKS = 3;

type StepSource = number | { completedSteps?: number | null };

function asCompletedSteps(entry: StepSource): number {
  if (typeof entry === 'number') return Math.max(0, Number(entry) || 0);
  return Math.max(0, Number(entry?.completedSteps) || 0);
}

export function totalCompletedSteps(hills: StepSource[] = []): number {
  return (hills ?? []).reduce<number>((sum, entry) => sum + asCompletedSteps(entry), 0);
}

/** True after 21 FLOW days in total, or 21 steps on any one hill. */
export function isAppUpgradedTo49(hills: StepSource[] = []): boolean {
  const list = hills ?? [];
  if (list.some((entry) => asCompletedSteps(entry) >= HILL_CHALLENGE_DAYS)) return true;
  return totalCompletedSteps(list) >= HILL_CHALLENGE_DAYS;
}

export function appClimbDisplayMax(hills: StepSource[] = []): number {
  return isAppUpgradedTo49(hills) ? STEPS_PER_HILL : HILL_CHALLENGE_TASKS;
}

export function buildClimbChallenge(hills: StepSource[] = []) {
  const daysCompleted = totalCompletedSteps(hills);
  const upgradedTo49 = isAppUpgradedTo49(hills);
  return {
    daysTotal: HILL_CHALLENGE_DAYS,
    daysCompleted: Math.min(HILL_CHALLENGE_DAYS, daysCompleted),
    upgradedTo49,
    displayMax: upgradedTo49 ? STEPS_PER_HILL : HILL_CHALLENGE_TASKS,
  };
}

export const CAMP_CHECKPOINTS = [
  { number: 1, name: 'Base Camp', stepThreshold: 1 },
  { number: 2, name: 'Camp 2', stepThreshold: 3 },
  { number: 3, name: 'Camp 3', stepThreshold: 7 },
  { number: 4, name: 'Camp 4', stepThreshold: 14 },
  { number: 5, name: 'Camp 5', stepThreshold: 21 },
  { number: 6, name: 'Camp 6', stepThreshold: 35 },
  { number: 7, name: 'Summit', stepThreshold: 49 },
];

export function clampSteps(steps: number | null | undefined) {
  return Math.max(0, Math.min(STEPS_PER_HILL, steps ?? 0));
}

/** Highest camp permanently reached at this step count (camps are never lost). */
export function resolveCampProgress(steps: number) {
  const safeSteps = clampSteps(steps);
  let currentCamp = CAMP_CHECKPOINTS[0];
  for (const camp of CAMP_CHECKPOINTS) {
    if (safeSteps >= camp.stepThreshold) currentCamp = camp;
    else break;
  }
  const nextCamp = CAMP_CHECKPOINTS.find((c) => c.stepThreshold > safeSteps) ?? null;
  const reachedCamps = CAMP_CHECKPOINTS.filter((c) => safeSteps >= c.stepThreshold);
  return {
    steps: safeSteps,
    currentCamp,
    nextCamp,
    reachedCamps,
    stepsRemaining: nextCamp ? nextCamp.stepThreshold - safeSteps : 0,
    atSummit: safeSteps >= STEPS_PER_HILL,
  };
}

export function formatStepLabel(
  steps: number,
  { showMax = true, climbMax = STEPS_PER_HILL }: { showMax?: boolean; climbMax?: number } = {},
) {
  const cap = Math.max(1, Number(climbMax) || STEPS_PER_HILL);
  const safe = Math.max(0, Math.min(cap, Number(steps) || 0));
  if (!showMax) return `Step ${safe}`;
  return `Step ${safe} of ${cap}`;
}

export function campTrailMarkers(climbMax = STEPS_PER_HILL) {
  const cap = Math.max(1, Number(climbMax) || STEPS_PER_HILL);
  return CAMP_CHECKPOINTS.filter((c) => c.stepThreshold <= cap).map((c) => c.stepThreshold);
}

/** Spec Section 13 line, e.g. "Step 5 · Camp 2 · 2 Steps to Camp 3" */
export function formatHillStepCampLine({
  workingStep,
  completedSteps = 0,
  hillLabel,
}: {
  workingStep?: number;
  completedSteps?: number;
  hillLabel?: string;
} = {}) {
  const working = clampSteps(workingStep ?? completedSteps + 1);
  const completed = clampSteps(completedSteps);
  const camp = resolveCampProgress(completed);
  const parts = [];
  if (hillLabel) parts.push(hillLabel);
  parts.push(`Step ${working}`, camp.currentCamp.name);
  if (camp.nextCamp) {
    const stepsToNext = Math.max(0, camp.nextCamp.stepThreshold - completed);
    parts.push(
      stepsToNext === 0
        ? `Ready for ${camp.nextCamp.name}`
        : `${stepsToNext} more step${stepsToNext === 1 ? '' : 's'} until ${camp.nextCamp.name}`,
    );
  }
  return parts.join(' · ');
}

export function detectCampReached(beforeSteps: number, afterSteps: number) {
  const before = resolveCampProgress(beforeSteps);
  const after = resolveCampProgress(afterSteps);
  if (after.currentCamp.number > before.currentCamp.number) {
    return after.currentCamp;
  }
  return null;
}
