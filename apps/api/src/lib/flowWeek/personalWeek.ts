import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import {
  DEFAULT_GOFAM_WEEK_START_DAY,
  FLOW_INDEX_WEEKDAY,
  CHALLENGE_PERIOD_DAYS,
  JOURNEY_DAYS,
} from './types';

/** Normalize to midnight local server time. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Inclusive start, exclusive end — matches mission completion calendarDate rows. */
export function calendarDayBounds(date: Date): { dayStart: Date; dayEnd: Date } {
  const dayStart = startOfDay(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return { dayStart, dayEnd };
}

/** Start of the personal week containing `from` (inclusive of start weekday). */
export function currentPersonalWeekStart(from: Date, gofamWeekStartDay: number): Date {
  const day = startOfDay(from);
  const currentDow = day.getDay();
  const delta = (currentDow - gofamWeekStartDay + 7) % 7;
  day.setDate(day.getDate() - delta);
  return day;
}

/** Next occurrence of gofamWeekStartDay (0=Sun … 6=Sat) strictly after `from`. */
export function nextPersonalWeekStart(from: Date, gofamWeekStartDay: number): Date {
  const day = startOfDay(from);
  const currentDow = day.getDay();
  let delta = (gofamWeekStartDay - currentDow + 7) % 7;
  if (delta === 0) delta = 7;
  day.setDate(day.getDate() + delta);
  return day;
}

/** Days from join until next personal week start (1–6 for starter week eligibility). */
export function daysUntilNextPersonalWeekStart(from: Date, gofamWeekStartDay: number): number {
  const next = nextPersonalWeekStart(from, gofamWeekStartDay);
  const ms = startOfDay(next).getTime() - startOfDay(from).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export function isMidCycleJoin(from: Date, gofamWeekStartDay: number): boolean {
  const days = daysUntilNextPersonalWeekStart(from, gofamWeekStartDay);
  return days > 0 && days < 7;
}

/** Whole calendar days elapsed since journey start (0 on start day). */
export function daysSinceJourneyStart(journeyStart: Date, from: Date): number {
  const ms = startOfDay(from).getTime() - startOfDay(journeyStart).getTime();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}

/** 1-based day number within the journey (Day 1 = account creation date). */
export function journeyDayIndex(journeyStart: Date, from: Date): number {
  return daysSinceJourneyStart(journeyStart, from) + 1;
}

/** True on Sundays — FLOW Index calculation days within the 21-day journey. */
export function isFlowIndexDay(date: Date): boolean {
  return startOfDay(date).getDay() === FLOW_INDEX_WEEKDAY;
}

/** Inclusive Sun→Sat (or gofamWeekStartDay→+6) bounds for the FLOW week containing `from`. */
export function currentFlowWeekBounds(
  from: Date,
  gofamWeekStartDay: number,
): { weekStart: Date; weekEnd: Date } {
  const weekStart = currentPersonalWeekStart(from, gofamWeekStartDay);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return { weekStart, weekEnd };
}

export function isDateInFlowWeek(date: Date, weekStart: Date, weekEnd: Date): boolean {
  const t = startOfDay(date).getTime();
  return t >= startOfDay(weekStart).getTime() && t <= startOfDay(weekEnd).getTime();
}

/** Current 7-hill slice within the challenge block (days 1–7, 8–14, …). */
export function currentWeekSliceBounds(
  journeyStart: Date,
  today: Date,
): { startDayIndex: number; endDayIndex: number } {
  const elapsed = daysSinceJourneyStart(journeyStart, today);
  const maxSliceIndex = Math.ceil(JOURNEY_DAYS / 7) - 1;
  const sliceIndex = Math.min(maxSliceIndex, Math.floor(elapsed / 7));
  const startDayIndex = sliceIndex * 7 + 1;
  const endDayIndex = Math.min(JOURNEY_DAYS, startDayIndex + 6);
  return { startDayIndex, endDayIndex };
}

/** Hill for journey day N — cycles through GAP dayRankings every 7 days. */
export function hillForJourneyDay(dayRankings: string[], dayIndex: number): string | undefined {
  if (dayRankings.length === 0) return undefined;
  return dayRankings[(dayIndex - 1) % dayRankings.length];
}

/**
 * Journey starts on the account creation date (Day 1).
 * Example: created Thursday → Thursday is Hill 1; Sunday (day 4) is FLOW Index day.
 */
export function bootstrapPersonalWeekStart(accountCreatedAt: Date): Date {
  return startOfDay(accountCreatedAt);
}

export type CreateScheduleInput = {
  userId: string;
  assessmentId: string;
  dayRankings: string[];
  personalWeekStart: Date;
  isStarterWeek?: boolean;
  /** Override day count. Defaults to 21-day journey (or starter heuristic). */
  dayCount?: number;
};

export async function createPersonalWeekSchedule(
  tx: Prisma.TransactionClient,
  input: CreateScheduleInput,
): Promise<{ scheduleId: string; dayIds: string[] }> {
  const dayCount =
    input.dayCount ??
    (input.isStarterWeek
      ? Math.min(6, Math.max(1, input.dayRankings.length))
      : JOURNEY_DAYS);

  const scheduleId = randomUUID();
  const dayIds: string[] = [];

  await tx.personalWeekSchedule.create({
    data: {
      id: scheduleId,
      userId: input.userId,
      personalWeekStart: input.personalWeekStart,
      assessmentId: input.assessmentId,
      isStarterWeek: input.isStarterWeek ?? false,
    },
  });

  for (let dayIndex = 1; dayIndex <= dayCount; dayIndex += 1) {
    const hillId = hillForJourneyDay(input.dayRankings, dayIndex);
    if (!hillId) break;

    const calendarDate = new Date(input.personalWeekStart);
    calendarDate.setDate(calendarDate.getDate() + (dayIndex - 1));

    const dayId = randomUUID();
    dayIds.push(dayId);

    await tx.personalDayAssignment.create({
      data: {
        id: dayId,
        scheduleId,
        dayIndex,
        calendarDate: startOfDay(calendarDate),
        hillId,
      },
    });
  }

  return { scheduleId, dayIds };
}

/** Extend an existing main schedule from 21 → 30 days for legacy accounts. */
export async function ensureChallengeScheduleDays(
  tx: Prisma.TransactionClient,
  input: {
    scheduleId: string;
    personalWeekStart: Date;
    dayRankings: string[];
    currentMaxDayIndex: number;
  },
): Promise<number> {
  const { scheduleId, personalWeekStart, dayRankings, currentMaxDayIndex } = input;
  if (currentMaxDayIndex >= CHALLENGE_PERIOD_DAYS) return 0;

  let added = 0;
  for (let dayIndex = currentMaxDayIndex + 1; dayIndex <= CHALLENGE_PERIOD_DAYS; dayIndex += 1) {
    const hillId = hillForJourneyDay(dayRankings, dayIndex);
    if (!hillId) break;

    const calendarDate = new Date(personalWeekStart);
    calendarDate.setDate(calendarDate.getDate() + (dayIndex - 1));

    await tx.personalDayAssignment.create({
      data: {
        scheduleId,
        dayIndex,
        calendarDate: startOfDay(calendarDate),
        hillId,
      },
    });
    added += 1;
  }
  return added;
}

export function resolveGofamWeekStartDay(userValue: number | null | undefined): number {
  if (userValue != null && userValue >= 0 && userValue <= 6) return userValue;
  return DEFAULT_GOFAM_WEEK_START_DAY;
}
