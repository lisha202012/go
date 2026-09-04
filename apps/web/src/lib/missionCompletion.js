/** Shared completion flags — hillMissions use completedToday; prescribed use completed. */
export function isMissionCompleted(mission) {
  if (!mission) return false;
  return Boolean(
    mission.completed || mission.completedToday || (mission.completionCount ?? 0) > 0,
  );
}

export function isMissionCompletedToday(mission) {
  if (!mission) return false;
  return Boolean(mission.completedToday ?? mission.completed);
}
