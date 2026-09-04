import type { GapAssessment, Hill, Mission, PersonalDayAssignment, User } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../../middleware/errorHandler';
import { rankHillsByGapScore, rankingsLockedUntil } from './dayRankings';
import {
  bootstrapPersonalWeekStart,
  createPersonalWeekSchedule,
  currentFlowWeekBounds,
  currentWeekSliceBounds,
  ensureChallengeScheduleDays,
  isDateInFlowWeek,
  isFlowIndexDay,
  journeyDayIndex,
  resolveGofamWeekStartDay,
  startOfDay,
} from './personalWeek';
import { FLOW_WEEK_COIN_REWARDS, FLOW_WEEK_SEED_REWARDS, CHALLENGE_PERIOD_DAYS, JOURNEY_DAYS, WEEKDAY_LABELS } from './types';
import { loadCompletedMissionTimesForDay, loadCompletedMissionTimesForDays, unlockUpcomingFlowWeekForDev } from './flowWeekMissions';
import { hasPrescribedMissionActivity, needsDailyMissionPick } from './flowWeekDailyPick';
import { countTodayBonusMissionsForChakra } from './flowWeekExtras';
import { EMPTY_WEEKLY_CHAKRAS, summarizeWeeklyChakras, type WeeklyChakraStats } from './flowWeekChakras';
import {
  countHomeBonusSlotsUsed,
  loadHillMissionsWithCounts,
  type HillMissionListItem,
} from './hillMissionList';
import { syncUserAgeGroupFromDob } from '../userAgeSync';

export type FlowWeekDayPayload = {
  dayIndex: number;
  /** 1–30 position from account creation (Day 1 = signup date). */
  journeyDayIndex: number;
  /** True on Sundays — FLOW Index calculation day. */
  isFlowIndexDay: boolean;
  calendarDate: string;
  hill: Pick<Hill, 'id' | 'code' | 'name' | 'virtueName' | 'colorTheme'>;
  prescribedMissions: Array<{
    id: string;
    title: string;
    description: string;
    coinReward: number;
    requiresReflection: boolean;
    requiresEvidence: boolean;
    completed: boolean;
    started: boolean;
    completedAt: string | null;
  }>;
  /** All missions on this day's hill (always 15), with lifetime completion counters. */
  hillMissions: HillMissionListItem[];
  prescribedCompleted: number;
  homeBonusSlotsUsed: number;
  dailyFlowComplete: boolean;
  needsDailyMissionPick: boolean;
  isToday: boolean;
  isPast: boolean;
  lateCatchUp: boolean;
};

export type FlowWeekMePayload = {
  journeyModelVersion: number;
  gofamWeekStartDay: number;
  gofamWeekStartLabel: string;
  /** Account creation date — Day 1 of the 30-day challenge. */
  journeyStartDate: string;
  journeyDaysTotal: number;
  flowIndexWeekdayLabel: string;
  currentWeekSlice: { startDayIndex: number; endDayIndex: number };
  personalWeekStart: string;
  /** True when the active schedule has not begun yet (today is before personalWeekStart). */
  weekNotStartedYet: boolean;
  isStarterWeek: boolean;
  starterWeekCompletedAt: string | null;
  focusHill: Pick<Hill, 'id' | 'code' | 'name' | 'virtueName' | 'colorTheme'>;
  dayRankings: Array<{ dayIndex: number; hill: Pick<Hill, 'id' | 'code' | 'name' | 'virtueName'> }>;
  today: FlowWeekDayPayload | null;
  weekDays: FlowWeekDayPayload[];
  coinRewards: typeof FLOW_WEEK_COIN_REWARDS;
  seedRewards: typeof FLOW_WEEK_SEED_REWARDS;
  extraCoinsEarnedToday: number;
  flowLockstepSteps: number;
  legacyPeakSteps: number;
};

/** Bootstrap v2 journey after first GAP when gofamWeekStartDay is set. */
export async function bootstrapFlowWeekAfterGap(
  userId: string,
  assessmentId: string,
  hillScores: Array<{ hillId: string; rawScore: number; hill: { code: Hill['code'] } }>,
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.journeyModelVersion >= 2) return;

  const gofamWeekStartDay = resolveGofamWeekStartDay(user.gofamWeekStartDay);
  if (user.gofamWeekStartDay == null) return;

  const hillRaws = hillScores.map((s) => ({
    hillId: s.hillId,
    hillCode: s.hill.code,
    rawScore: s.rawScore,
  }));
  const dayRankings = rankHillsByGapScore(hillRaws);
  const now = new Date();
  const rankingsLocked = rankingsLockedUntil(now);

  const journeyStart = bootstrapPersonalWeekStart(user.createdAt);
  const personalWeekStart = journeyStart;

  await prisma.$transaction(async (tx) => {
    await tx.gapAssessment.update({
      where: { id: assessmentId },
      data: {
        dayRankings,
        rankingsEffectiveFrom: personalWeekStart,
        rankingsLockedUntil: rankingsLocked,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        journeyModelVersion: 2,
        migratedAt: now,
        flowLockstepSteps: 0,
        legacyPeakSteps: 0,
        starterWeekActive: false,
      },
    });

    await createPersonalWeekSchedule(tx, {
      userId,
      assessmentId,
      dayRankings,
      personalWeekStart,
      isStarterWeek: false,
      dayCount: JOURNEY_DAYS,
    });
  });
}

/** When GAP exists and week start is set, promote user to FLOW Week v2. */
export async function tryBootstrapFlowWeekForUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.journeyModelVersion >= 2 || user.gofamWeekStartDay == null) return false;

  const assessment = await prisma.gapAssessment.findUnique({ where: { userId } });
  if (!assessment) return false;

  const scores = await prisma.gapHillScore.findMany({
    where: { gapAssessmentId: assessment.id },
    include: { hill: true },
  });
  if (scores.length === 0) return false;

  await bootstrapFlowWeekAfterGap(userId, assessment.id, scores);
  return true;
}

function buildDayPayload(
  day: PersonalDayAssignment & { hill: Hill },
  missions: Mission[],
  todayStart: Date,
  journeyStart: Date,
  completedMissionIds: Set<string>,
  completedMissionTimes: Map<string, { completedAt: string }>,
  startedMissionIds: Set<string>,
  needsPick: boolean,
  hillMissions: HillMissionListItem[] = [],
  homeBonusSlotsUsed = 0,
): FlowWeekDayPayload {
  const calendarStart = startOfDay(day.calendarDate);
  const isToday = calendarStart.getTime() === todayStart.getTime();
  const isPast = calendarStart.getTime() < todayStart.getTime();
  const lateCatchUp = isPast && !day.dailyFlowComplete;
  const coinReward = lateCatchUp
    ? FLOW_WEEK_COIN_REWARDS.latePrescribedMission
    : FLOW_WEEK_COIN_REWARDS.prescribedMission;

  const missionById = new Map(missions.map((m) => [m.id, m]));
  const prescribedMissions = day.prescribedMissionIds
    .map((id) => missionById.get(id))
    .filter((m): m is Mission => Boolean(m))
    .map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      coinReward,
      requiresReflection: m.requiresReflection,
      requiresEvidence: m.requiresEvidence,
      completed: completedMissionIds.has(m.id),
      started: startedMissionIds.has(m.id),
      completedAt: completedMissionTimes.get(m.id)?.completedAt ?? null,
    }));

  return {
    dayIndex: day.dayIndex,
    journeyDayIndex: journeyDayIndex(journeyStart, calendarStart),
    isFlowIndexDay: isFlowIndexDay(calendarStart),
    calendarDate: calendarStart.toISOString(),
    hill: {
      id: day.hill.id,
      code: day.hill.code,
      name: day.hill.name,
      virtueName: day.hill.virtueName,
      colorTheme: day.hill.colorTheme,
    },
    prescribedMissions,
    hillMissions,
    prescribedCompleted: Math.max(day.prescribedCompleted, homeBonusSlotsUsed),
    homeBonusSlotsUsed,
    dailyFlowComplete: day.dailyFlowComplete,
    // Pick-3 is no longer required — all hill missions stay visible.
    needsDailyMissionPick: false,
    isToday,
    isPast,
    lateCatchUp,
  };
}

type PersonalWeekScheduleRow = Awaited<
  ReturnType<
    typeof prisma.personalWeekSchedule.findMany<{
      include: {
        days: { include: { hill: true }; orderBy: { dayIndex: 'asc' } };
        assessment: true;
      };
    }>
  >
>[number];

function weekProgressScore(schedule: PersonalWeekScheduleRow): number {
  return schedule.days.reduce(
    (sum, d) => sum + (d.prescribedCompleted ?? 0) + (d.dailyFlowComplete ? 3 : 0),
    0,
  );
}

function findActivePersonalWeekSchedule(
  rows: PersonalWeekScheduleRow[],
  todayStart: Date,
): PersonalWeekScheduleRow | null {
  const matches = rows.filter((s) => {
    const last = s.days[s.days.length - 1];
    if (!last) return false;
    const weekStart = startOfDay(s.personalWeekStart);
    const weekEnd = startOfDay(last.calendarDate);
    return todayStart.getTime() >= weekStart.getTime() && todayStart.getTime() <= weekEnd.getTime();
  });
  if (matches.length === 0) return null;
  return matches.sort((a, b) => weekProgressScore(b) - weekProgressScore(a))[0];
}

function findUpcomingPersonalWeekSchedule(
  rows: PersonalWeekScheduleRow[],
  todayStart: Date,
): PersonalWeekScheduleRow | null {
  return (
    rows
      .filter((s) => {
        if (s.days.length === 0) return false;
        return startOfDay(s.personalWeekStart).getTime() > todayStart.getTime();
      })
      .sort(
        (a, b) =>
          startOfDay(a.personalWeekStart).getTime() - startOfDay(b.personalWeekStart).getTime(),
      )[0] ?? null
  );
}

async function loadPersonalWeekSchedules(userId: string): Promise<PersonalWeekScheduleRow[]> {
  return prisma.personalWeekSchedule.findMany({
    where: { userId },
    orderBy: { personalWeekStart: 'desc' },
    include: {
      days: { include: { hill: true }, orderBy: { dayIndex: 'asc' } },
      assessment: true,
    },
  });
}

export async function getFlowWeekForUser(userId: string): Promise<FlowWeekMePayload> {
  await syncUserAgeGroupFromDob(userId);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      gapAssessment: {
        include: {
          hillScores: { include: { hill: true } },
        },
      },
    },
  });

  if (user.journeyModelVersion < 2) {
    throw new AppError('FLOW Week is not active for this account yet', 404);
  }

  if (!user.gapAssessment) {
    throw new AppError('Complete GAP assessment first', 400);
  }

  const gofamWeekStartDay = resolveGofamWeekStartDay(user.gofamWeekStartDay);
  const now = new Date();
  const todayStart = startOfDay(now);

  await unlockUpcomingFlowWeekForDev(userId);

  let allSchedules = await loadPersonalWeekSchedules(userId);
  let schedule = findActivePersonalWeekSchedule(allSchedules, todayStart);
  let weekNotStartedYet = false;

  if (!schedule) {
    await ensureNextPersonalWeek(user, user.gapAssessment);
    allSchedules = await loadPersonalWeekSchedules(userId);
    schedule = findActivePersonalWeekSchedule(allSchedules, todayStart);
  }

  if (!schedule) {
    schedule = findUpcomingPersonalWeekSchedule(allSchedules, todayStart);
    weekNotStartedYet = Boolean(schedule);
  }

  if (!schedule) {
    throw new AppError('Could not resolve an active personal week schedule', 500);
  }

  if (!schedule.isStarterWeek) {
    const maxDayIndex = schedule.days.reduce((max, day) => Math.max(max, day.dayIndex), 0);
    if (maxDayIndex > 0 && maxDayIndex < CHALLENGE_PERIOD_DAYS) {
      const dayRankings =
        user.gapAssessment.dayRankings.length > 0
          ? user.gapAssessment.dayRankings
          : rankHillsByGapScore(
              user.gapAssessment.hillScores.map((s) => ({
                hillId: s.hillId,
                hillCode: s.hill.code,
                rawScore: s.rawScore,
              })),
            );
      await prisma.$transaction(async (tx) => {
        await ensureChallengeScheduleDays(tx, {
          scheduleId: schedule!.id,
          personalWeekStart: schedule!.personalWeekStart,
          dayRankings,
          currentMaxDayIndex: maxDayIndex,
        });
      });
      allSchedules = await loadPersonalWeekSchedules(userId);
      const refreshed = findActivePersonalWeekSchedule(allSchedules, todayStart);
      if (refreshed) schedule = refreshed;
    }
  }

  const journeyStart = startOfDay(schedule.personalWeekStart);
  const weekSlice = currentWeekSliceBounds(journeyStart, todayStart);
  const visibleScheduleDays = schedule.days.filter(
    (d) => d.dayIndex >= weekSlice.startDayIndex && d.dayIndex <= weekSlice.endDayIndex,
  );
  const allMissionIds = visibleScheduleDays.flatMap((d) => d.prescribedMissionIds);
  const missions = allMissionIds.length
    ? await prisma.mission.findMany({ where: { id: { in: allMissionIds } } })
    : [];

  const progressRows = allMissionIds.length
    ? await prisma.userMissionProgress.findMany({
        where: { userId, missionId: { in: allMissionIds } },
        select: { missionId: true, startedAt: true },
      })
    : [];
  const startedMissionIds = new Set(
    progressRows.filter((p) => p.startedAt).map((p) => p.missionId),
  );

  const completedTimesMap = await loadCompletedMissionTimesForDays(
    userId,
    schedule.days
      .filter((d) => d.prescribedMissionIds.length > 0)
      .map((d) => ({ id: d.id, calendarDate: d.calendarDate })),
  );
  for (const d of schedule.days) {
    if (!completedTimesMap.has(d.id)) {
      completedTimesMap.set(d.id, new Map());
    }
  }

  const weekDays = await Promise.all(
    visibleScheduleDays.map(async (d) => {
      const dayCompletedTimes = completedTimesMap.get(d.id) ?? new Map();
      const dayCompleted = new Set(dayCompletedTimes.keys());
      const hasStarted = await hasPrescribedMissionActivity(userId, d.prescribedMissionIds);
      const needsPick = needsDailyMissionPick(d, hasStarted);
      const isToday = startOfDay(d.calendarDate).getTime() === todayStart.getTime();
      const homeBonusSlotsUsed = isToday
        ? await countHomeBonusSlotsUsed(userId, d.id)
        : d.prescribedCompleted;

      let hillMissions: HillMissionListItem[] = [];
      if (isToday) {
        hillMissions = await loadHillMissionsWithCounts({
          userId,
          hill: d.hill,
          ageGroup: user.ageGroup,
          rewardContext: {
            isTodayHomeHill: true,
            dailyBonusClaimed: d.dailyFlowComplete,
            homeBonusSlotsUsed,
            dayAssignmentId: d.id,
            prescribedSlotIds: new Set(d.prescribedMissionIds),
          },
          recommendContext: `block-${d.dayIndex}` as `block-${number}`,
        });
      }

      return buildDayPayload(
        d,
        missions,
        todayStart,
        journeyStart,
        dayCompleted,
        dayCompletedTimes,
        startedMissionIds,
        needsPick,
        hillMissions,
        homeBonusSlotsUsed,
      );
    }),
  );
  const today = weekDays.find((d) => d.isToday) ?? null;

  const assessment = user.gapAssessment;
  const focusHillId = assessment.focusHillId;
  const dayRankings = assessment.dayRankings.length
    ? assessment.dayRankings
    : rankHillsByGapScore(
        assessment.hillScores.map((s) => ({
          hillId: s.hillId,
          hillCode: s.hill.code,
          rawScore: s.rawScore,
        })),
      );

  const hills = await prisma.hill.findMany();
  const hillById = new Map(hills.map((h) => [h.id, h]));
  const focusHill = hillById.get(focusHillId);
  if (!focusHill) {
    throw new AppError('Focus hill missing for FLOW Week', 500);
  }

  const extraCoinsToday = today
    ? await prisma.missionCompletion.aggregate({
        where: {
          userId,
          calendarDate: todayStart,
          kind: 'other_hill',
        },
        _sum: { coinsAwarded: true },
      })
    : null;

  return {
    journeyModelVersion: user.journeyModelVersion,
    gofamWeekStartDay,
    gofamWeekStartLabel: WEEKDAY_LABELS[gofamWeekStartDay] ?? 'Sunday',
    journeyStartDate: journeyStart.toISOString(),
    journeyDaysTotal: JOURNEY_DAYS,
    flowIndexWeekdayLabel: WEEKDAY_LABELS[0],
    currentWeekSlice: weekSlice,
    personalWeekStart: schedule.personalWeekStart.toISOString(),
    weekNotStartedYet,
    isStarterWeek: schedule.isStarterWeek,
    starterWeekCompletedAt: user.starterWeekCompletedAt?.toISOString() ?? null,
    focusHill: {
      id: focusHill.id,
      code: focusHill.code,
      name: focusHill.name,
      virtueName: focusHill.virtueName,
      colorTheme: focusHill.colorTheme,
    },
    dayRankings: dayRankings.map((hillId, index) => ({
      dayIndex: index + 1,
      hill: hillById.get(hillId)!,
    })).filter((r) => r.hill),
    today,
    weekDays,
    coinRewards: FLOW_WEEK_COIN_REWARDS,
    seedRewards: FLOW_WEEK_SEED_REWARDS,
    extraCoinsEarnedToday: extraCoinsToday?._sum.coinsAwarded ?? 0,
    flowLockstepSteps: user.flowLockstepSteps,
    legacyPeakSteps: user.legacyPeakSteps,
  };
}

async function ensureNextPersonalWeek(user: User, assessment: GapAssessment) {
  const now = new Date();
  const todayStart = startOfDay(now);

  const maxDay = await prisma.personalDayAssignment.aggregate({
    where: { schedule: { userId: user.id } },
    _max: { dayIndex: true },
  });
  if ((maxDay._max.dayIndex ?? 0) >= CHALLENGE_PERIOD_DAYS) return;

  const upcoming = await prisma.personalWeekSchedule.findFirst({
    where: {
      userId: user.id,
      personalWeekStart: { gt: todayStart },
    },
    orderBy: { personalWeekStart: 'asc' },
  });
  if (upcoming) return;

  const latest = await prisma.personalWeekSchedule.findFirst({
    where: { userId: user.id },
    orderBy: { personalWeekStart: 'desc' },
    include: {
      days: { orderBy: { dayIndex: 'desc' }, take: 1 },
    },
  });

  let weekStart: Date;
  if (!latest) {
    weekStart = bootstrapPersonalWeekStart(user.createdAt);
  } else {
    const lastDay = latest.days[0];
    if (!lastDay) return;
    const lastDate = startOfDay(lastDay.calendarDate);
    if (lastDate.getTime() >= todayStart.getTime()) return;
    weekStart = new Date(lastDate);
    weekStart.setDate(weekStart.getDate() + 1);
  }

  const existing = await prisma.personalWeekSchedule.findUnique({
    where: {
      userId_personalWeekStart: { userId: user.id, personalWeekStart: weekStart },
    },
  });
  if (existing) return;

  const dayRankings =
    assessment.dayRankings.length > 0
      ? assessment.dayRankings
      : rankHillsByGapScore(
          (
            await prisma.gapHillScore.findMany({
              where: { gapAssessmentId: assessment.id },
              include: { hill: true },
            })
          ).map((s) => ({
            hillId: s.hillId,
            hillCode: s.hill.code,
            rawScore: s.rawScore,
          })),
        );

  await prisma.$transaction(async (tx) => {
    const remainingDays = CHALLENGE_PERIOD_DAYS - (maxDay._max.dayIndex ?? 0);
    await createPersonalWeekSchedule(tx, {
      userId: user.id,
      assessmentId: assessment.id,
      dayRankings,
      personalWeekStart: weekStart,
      isStarterWeek: false,
      dayCount: Math.min(JOURNEY_DAYS, remainingDays),
    });
  });
}

export async function ensureTodayPrescribedMissions(userId: string) {
  const payload = await getFlowWeekForUser(userId);
  return payload;
}

export type { WeeklyChakraHill, WeeklyChakraStats } from './flowWeekChakras';
export { summarizeWeeklyChakras, EMPTY_WEEKLY_CHAKRAS } from './flowWeekChakras';

export async function resolvePersonalWeekScheduleForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { journeyModelVersion: true, gofamWeekStartDay: true, createdAt: true },
  });
  if (!user || user.journeyModelVersion < 2) return null;

  const todayStart = startOfDay(new Date());

  let allSchedules = await loadPersonalWeekSchedules(userId);
  let schedule = findActivePersonalWeekSchedule(allSchedules, todayStart);

  if (!schedule) {
    const assessment = await prisma.gapAssessment.findUnique({ where: { userId } });
    if (assessment) {
      await ensureNextPersonalWeek(
        { id: userId, createdAt: user.createdAt, gofamWeekStartDay: user.gofamWeekStartDay } as User,
        assessment,
      );
      allSchedules = await loadPersonalWeekSchedules(userId);
      schedule = findActivePersonalWeekSchedule(allSchedules, todayStart);
    }
  }

  if (!schedule) {
    schedule = findUpcomingPersonalWeekSchedule(allSchedules, todayStart);
  }

  return schedule;
}

export async function loadResolvedWeekScheduleForUser(userId: string) {
  const todayStart = startOfDay(new Date());
  const schedule = await resolvePersonalWeekScheduleForUser(userId);
  if (!schedule) {
    throw new AppError('No active personal week schedule', 404);
  }
  const weekNotStartedYet =
    todayStart.getTime() < startOfDay(schedule.personalWeekStart).getTime();
  return { schedule, todayStart, weekNotStartedYet };
}

/** Home dashboard only needs today's 3 missions + week counts — not the full 15-mission hill list. */
export async function getFlowWeekDashboardSlice(userId: string) {
  const schedule = await resolvePersonalWeekScheduleForUser(userId);
  if (!schedule) return null;

  const todayStart = startOfDay(new Date());
  const weekNotStartedYet =
    todayStart.getTime() < startOfDay(schedule.personalWeekStart).getTime();

  const weekDays = schedule.days.map((d) => ({
    hill: { id: d.hill.id, code: d.hill.code, name: d.hill.name },
    prescribedCompleted: d.prescribedCompleted,
    dailyFlowComplete: d.dailyFlowComplete,
    isToday: startOfDay(d.calendarDate).getTime() === todayStart.getTime(),
  }));

  const todayRow = schedule.days.find(
    (d) => startOfDay(d.calendarDate).getTime() === todayStart.getTime(),
  );

  let prescribedMissions: Array<{
    id: string;
    title: string;
    description: string;
    completed: boolean;
  }> = [];

  if (todayRow && todayRow.prescribedMissionIds.length > 0) {
    const [missions, dayCompletedTimes] = await Promise.all([
      prisma.mission.findMany({
        where: { id: { in: todayRow.prescribedMissionIds } },
        select: { id: true, title: true, description: true },
      }),
      loadCompletedMissionTimesForDay(userId, todayRow.id, todayRow.calendarDate),
    ]);
    const byId = new Map(missions.map((m) => [m.id, m]));
    prescribedMissions = todayRow.prescribedMissionIds.flatMap((id) => {
      const mission = byId.get(id);
      if (!mission) return [];
      return [
        {
          id: mission.id,
          title: mission.title,
          description: mission.description,
          completed: dayCompletedTimes.has(id),
        },
      ];
    });
  }

  return {
    weekNotStartedYet,
    personalWeekStart: schedule.personalWeekStart.toISOString(),
    today: todayRow
      ? {
          hill: {
            id: todayRow.hill.id,
            code: todayRow.hill.code,
            name: todayRow.hill.name,
          },
          prescribedCompleted: todayRow.prescribedCompleted,
          dailyFlowComplete: todayRow.dailyFlowComplete,
          prescribedMissions,
        }
      : null,
    weekDays,
  };
}

export async function getWeeklyChakraStats(userId: string): Promise<WeeklyChakraStats> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gofamWeekStartDay: true },
  });
  const schedule = await resolvePersonalWeekScheduleForUser(userId);
  if (!schedule) return EMPTY_WEEKLY_CHAKRAS;

  const todayStart = startOfDay(new Date());
  const gofamWeekStartDay = resolveGofamWeekStartDay(user?.gofamWeekStartDay);
  const { weekStart, weekEnd } = currentFlowWeekBounds(todayStart, gofamWeekStartDay);
  const hillIds = [...new Set(schedule.days.map((d) => d.hill.id))];
  const hills = await prisma.hill.findMany({
    where: { id: { in: hillIds } },
  });
  const hillById = new Map(hills.map((hill) => [hill.id, hill]));

  // Chakra dots belong to the current FLOW calendar week only (resets each Sunday).
  const daysForChakras = schedule.days.filter((d) =>
    isDateInFlowWeek(d.calendarDate, weekStart, weekEnd),
  );

  // One row per hill — prefer today's assignment, else the day with more progress.
  const bestByHillCode = new Map<string, (typeof daysForChakras)[number]>();
  for (const d of daysForChakras) {
    const code = d.hill.code;
    const existing = bestByHillCode.get(code);
    const isToday = startOfDay(d.calendarDate).getTime() === todayStart.getTime();
    if (!existing) {
      bestByHillCode.set(code, d);
      continue;
    }
    const existingIsToday =
      startOfDay(existing.calendarDate).getTime() === todayStart.getTime();
    if (isToday && !existingIsToday) {
      bestByHillCode.set(code, d);
      continue;
    }
    if (existingIsToday && !isToday) continue;
    const existingScore =
      (existing.dailyFlowComplete ? 3 : 0) + (existing.prescribedCompleted ?? 0);
    const nextScore = (d.dailyFlowComplete ? 3 : 0) + (d.prescribedCompleted ?? 0);
    if (nextScore > existingScore) bestByHillCode.set(code, d);
  }

  const uniqueDays = [...bestByHillCode.values()].sort((a, b) => a.dayIndex - b.dayIndex);
  const dayIds = uniqueDays.map((d) => d.id);

  const todayRow = uniqueDays.find(
    (d) => startOfDay(d.calendarDate).getTime() === todayStart.getTime(),
  );

  const [todayExtraCounts, slotRows] = await Promise.all([
    prisma.missionCompletion.groupBy({
      by: ['hillId'],
      where: {
        userId,
        calendarDate: todayStart,
        kind: { in: ['home_extra', 'other_hill'] },
      },
      _count: { _all: true },
    }),
    dayIds.length
      ? prisma.missionCompletion.groupBy({
          by: ['dayAssignmentId'],
          where: {
            userId,
            dayAssignmentId: { in: dayIds },
            kind: 'home_bonus_slot',
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);
  const slotsByDayId = new Map(
    slotRows
      .filter((r) => r.dayAssignmentId)
      .map((r) => [r.dayAssignmentId as string, r._count._all]),
  );
  const extraCompletedByHillCode = Object.fromEntries(
    todayExtraCounts
      .filter((row) => row.hillId)
      .map((row) => {
        const hill = hillById.get(row.hillId);
        return [hill?.code ?? row.hillId, row._count._all];
      }),
  );

  return summarizeWeeklyChakras(
    uniqueDays.map((d) => {
      const dayStart = startOfDay(d.calendarDate);
      const isToday = dayStart.getTime() === todayStart.getTime();
      return {
        dayIndex: d.dayIndex,
        hillCode: d.hill.code,
        hillName: d.hill.name,
        isToday,
        isPast: dayStart.getTime() < todayStart.getTime(),
        dailyFlowComplete: d.dailyFlowComplete,
        prescribedCompleted: Math.max(d.prescribedCompleted, slotsByDayId.get(d.id) ?? 0),
        extraCompleted: extraCompletedByHillCode[d.hill.code] ?? 0,
      };
    }),
    extraCompletedByHillCode,
  );
}
