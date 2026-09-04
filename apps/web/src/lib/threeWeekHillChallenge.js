/**
 * 3-week hill challenge (≈21 calendar days of weekly cycles):
 * Each FLOW week that hill gets 1 day × 3 missions = 1 task (= 1 Step).
 * Challenge = 3 tasks = 9 missions on that hill.
 */

export const HILL_CHALLENGE_WEEKS = 3;
export const HILL_CHALLENGE_TASKS = 3;
export const HILL_CHALLENGE_MISSIONS_PER_TASK = 3;
export const HILL_CHALLENGE_MISSIONS = HILL_CHALLENGE_TASKS * HILL_CHALLENGE_MISSIONS_PER_TASK; // 9

export function buildThreeWeekHillChallenge({
  completedSteps = 0,
  missionsThisWeek = 0,
  dailyFlowComplete = false,
} = {}) {
  const steps = Math.max(0, Math.floor(Number(completedSteps) || 0));
  const thisWeek = Math.max(0, Math.min(HILL_CHALLENGE_MISSIONS_PER_TASK, Number(missionsThisWeek) || 0));
  const dayComplete = Boolean(dailyFlowComplete);

  const tasksCompleted = Math.min(HILL_CHALLENGE_TASKS, steps);
  const missionsThisTask =
    tasksCompleted >= HILL_CHALLENGE_TASKS
      ? HILL_CHALLENGE_MISSIONS_PER_TASK
      : dayComplete
        ? 0
        : thisWeek;

  const missionsCompleted = Math.min(
    HILL_CHALLENGE_MISSIONS,
    tasksCompleted * HILL_CHALLENGE_MISSIONS_PER_TASK + missionsThisTask,
  );

  const complete = tasksCompleted >= HILL_CHALLENGE_TASKS;
  const currentTask = complete
    ? HILL_CHALLENGE_TASKS
    : Math.min(HILL_CHALLENGE_TASKS, tasksCompleted + 1);
  const currentWeek = currentTask;

  return {
    weeksTotal: HILL_CHALLENGE_WEEKS,
    tasksTotal: HILL_CHALLENGE_TASKS,
    missionsTotal: HILL_CHALLENGE_MISSIONS,
    tasksCompleted,
    missionsCompleted,
    missionsThisTask,
    currentTask,
    currentWeek,
    complete,
    percentComplete: Math.round((missionsCompleted / HILL_CHALLENGE_MISSIONS) * 100),
  };
}
