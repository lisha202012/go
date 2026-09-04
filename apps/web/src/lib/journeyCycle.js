/** Cycle-level status for the concurrent 3-mission model (spec Section 6). */
export function getCycleDisplayStatus(blockWeeks) {
  if (!blockWeeks?.length) return 'locked';
  if (blockWeeks.some((w) => w.status === 'pending_selection')) return 'pending_selection';

  const withMissions = blockWeeks.filter((w) => w.mission);
  if (withMissions.length === 0) return 'locked';
  if (withMissions.every((w) => w.status === 'completed')) return 'completed';
  if (withMissions.some((w) => w.status === 'current')) return 'active';
  if (withMissions.every((w) => w.status === 'locked')) return 'locked';

  return 'active';
}

export function getMissionDisplayStatus(week, cycleStatus) {
  if (week.status === 'completed') return 'completed';
  if (cycleStatus === 'locked') return 'locked';
  if (cycleStatus === 'pending_selection') return 'pending';
  if (week.status === 'current') return 'active';
  return 'locked';
}

export function cycleStatusLabel(status) {
  if (status === 'completed') return 'Completed';
  if (status === 'active') return 'Active now — all 3 together';
  if (status === 'pending_selection') return 'Pick missions';
  return 'Locked';
}

export function missionStatusLabel(status) {
  if (status === 'completed') return 'Done';
  if (status === 'active') return 'Active';
  if (status === 'pending') return '—';
  return 'Locked';
}

export function groupWeeksByCycle(weeks) {
  const byBlock = new Map();
  for (const week of weeks ?? []) {
    const key = week.hillBlock;
    if (!byBlock.has(key)) byBlock.set(key, []);
    byBlock.get(key).push(week);
  }
  return [...byBlock.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, blockWeeks]) =>
      [...blockWeeks].sort((a, b) => a.taskNumber - b.taskNumber),
    );
}
