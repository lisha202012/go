import { prisma } from '../prisma';
import { calendarDayBounds } from './personalWeek';

/**
 * Bonus (+10) missions completed today — home_extra on today's hill or any other_hill.
 * Shown as "+N" glowing dots on today's Home Hill chakra only.
 */
export async function countTodayBonusMissionsForChakra(
  userId: string,
  calendarDate: Date,
): Promise<number> {
  const { dayStart, dayEnd } = calendarDayBounds(calendarDate);
  return prisma.missionCompletion.count({
    where: {
      userId,
      kind: { in: ['home_extra', 'other_hill'] },
      calendarDate: { gte: dayStart, lt: dayEnd },
    },
  });
}

/** @deprecated use countTodayBonusMissionsForChakra */
export async function countTodayHomeHillExtras(
  userId: string,
  todayDay: { hillId: string; calendarDate: Date },
): Promise<number> {
  return countTodayBonusMissionsForChakra(userId, todayDay.calendarDate);
}
