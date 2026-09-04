/**
 * 3-week hill challenge (≈21 calendar days of weekly cycles):
 * Each FLOW week that hill gets 1 day × 3 missions = 1 task (= 1 Step).
 * Challenge = 3 tasks = 9 missions on that hill.
 */

export const HILL_CHALLENGE_WEEKS = 3;
export const HILL_CHALLENGE_TASKS = 3;
export const HILL_CHALLENGE_MISSIONS_PER_TASK = 3;
export const HILL_CHALLENGE_MISSIONS = HILL_CHALLENGE_TASKS * HILL_CHALLENGE_MISSIONS_PER_TASK; // 9

export type ThreeWeekHillChallenge = {
  weeksTotal: number;
  tasksTotal: number;
  missionsTotal: number;
  /** Completed weekly hill-days (Steps) capped at 3. */
  tasksCompleted: number;
  /** Missions counted toward the 9 (completed tasks × 3 + in-progress). */
  missionsCompleted: number;
  /** 0–3 missions on the current open task (this week's day if not finished). */
  missionsThisTask: number;
  /** 1–3 working task number (or 3 when complete). */
  currentTask: number;
  /** 1–3 working week number within the challenge. */
  currentWeek: number;
  complete: boolean;
  percentComplete: number;
};

export function buildThreeWeekHillChallenge(input: {
  /** Steps earned on this hill (each = one completed 3/3 week-day). */
  completedSteps?: number | null;
  /** Prescribed missions done on this hill's day this FLOW week (0–3). */
  missionsThisWeek?: number | null;
  /** True when this hill's day already hit Daily FLOW this week. */
  dailyFlowComplete?: boolean | null;
}): ThreeWeekHillChallenge {
  const steps = Math.max(0, Math.floor(Number(input.completedSteps) || 0));
  const thisWeek = Math.max(0, Math.min(HILL_CHALLENGE_MISSIONS_PER_TASK, Number(input.missionsThisWeek) || 0));
  const dayComplete = Boolean(input.dailyFlowComplete);

  const tasksCompleted = Math.min(HILL_CHALLENGE_TASKS, steps);
  // In-progress missions only count toward the next task before the Step is awarded.
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
