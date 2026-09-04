import { MissionStatus } from '@prisma/client';

/** Calendar weeks start Monday (local server time). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function startOfNextWeek(after: Date): Date {
  const next = startOfWeek(after);
  next.setDate(next.getDate() + 7);
  return next;
}

export function hasNewCalendarWeekStartedSince(completedAt: Date, now = new Date()): boolean {
  return startOfWeek(now).getTime() > startOfWeek(completedAt).getTime();
}

export type BlockWeekRef = {
  taskNumber: number;
  mission: { id: string } | null;
};

export type ProgressRef = {
  status: MissionStatus;
  completedAt?: Date | null;
};

export type WeekAvailability = {
  lockedByWeek: boolean;
  opensAt: string | null;
  priorIncomplete: boolean;
};

export function resolveWeekAvailability(
  week: BlockWeekRef,
  blockWeeks: BlockWeekRef[],
  progressByMission: Map<string, ProgressRef>,
  now = new Date(),
): WeekAvailability {
  if (!week.mission) {
    return { lockedByWeek: true, opensAt: null, priorIncomplete: true };
  }

  const progress = progressByMission.get(week.mission.id);
  if (progress?.status === MissionStatus.completed) {
    return { lockedByWeek: false, opensAt: null, priorIncomplete: false };
  }

  if (week.taskNumber <= 1) {
    return { lockedByWeek: false, opensAt: null, priorIncomplete: false };
  }

  const priorWeek = blockWeeks.find((w) => w.taskNumber === week.taskNumber - 1);
  if (!priorWeek?.mission) {
    return { lockedByWeek: true, opensAt: null, priorIncomplete: true };
  }

  const priorProgress = progressByMission.get(priorWeek.mission.id);
  if (priorProgress?.status !== MissionStatus.completed || !priorProgress.completedAt) {
    return { lockedByWeek: true, opensAt: null, priorIncomplete: true };
  }

  const priorCompletedAt = new Date(priorProgress.completedAt);
  if (hasNewCalendarWeekStartedSince(priorCompletedAt, now)) {
    return { lockedByWeek: false, opensAt: null, priorIncomplete: false };
  }

  return {
    lockedByWeek: true,
    opensAt: startOfNextWeek(priorCompletedAt).toISOString(),
    priorIncomplete: false,
  };
}

export function firstAvailableMissionIdInBlock(
  weeks: Array<BlockWeekRef & { hillBlock: number }>,
  hillBlock: number,
  progressByMission: Map<string, ProgressRef>,
  now = new Date(),
): string | null {
  const blockWeeks = weeks
    .filter((w) => w.hillBlock === hillBlock && w.mission)
    .sort((a, b) => a.taskNumber - b.taskNumber);

  for (const week of blockWeeks) {
    const progress = progressByMission.get(week.mission!.id);
    if (progress?.status === MissionStatus.completed) continue;

    const availability = resolveWeekAvailability(week, blockWeeks, progressByMission, now);
    if (!availability.priorIncomplete && !availability.lockedByWeek) {
      return week.mission!.id;
    }
    return null;
  }
  return null;
}

export function isThisWeekMissionComplete(
  weeks: Array<BlockWeekRef & { hillBlock: number }>,
  hillBlock: number,
  progressByMission: Map<string, ProgressRef>,
  now = new Date(),
): boolean {
  const blockWeeks = weeks
    .filter((w) => w.hillBlock === hillBlock && w.mission)
    .sort((a, b) => a.taskNumber - b.taskNumber);

  for (const week of blockWeeks) {
    const progress = progressByMission.get(week.mission!.id);
    if (progress?.status === MissionStatus.completed) {
      if (progress.completedAt && startOfWeek(new Date(progress.completedAt)).getTime() === startOfWeek(now).getTime()) {
        return true;
      }
      continue;
    }

    const availability = resolveWeekAvailability(week, blockWeeks, progressByMission, now);
    if (!availability.lockedByWeek && !availability.priorIncomplete) {
      return false;
    }
    if (availability.lockedByWeek && !availability.priorIncomplete) {
      return true;
    }
    return false;
  }

  return false;
}
