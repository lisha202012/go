import type { Hill, PersonalDayAssignment } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../../middleware/errorHandler';
import { validateUserMissionSelection, MISSIONS_SHOWN } from '../missionEngine';
import { syncUserAgeGroupFromDob } from '../userAgeSync';
import { mapMissionOptions } from '../missionRecommendations';
import { getFlowWeekForUser, loadResolvedWeekScheduleForUser } from './flowWeekService';
import { startOfDay } from './personalWeek';
import { FLOW_WEEK_COIN_REWARDS } from './types';
import { loadCompletedMissionTimesForDay } from './flowWeekMissions';
import {
  countHomeBonusSlotsUsed,
  loadHillMissionsWithCounts,
} from './hillMissionList';
import { formatCompletionCountLabel } from './homeHillRewards';

export type DayAssignmentContext = {
  day: PersonalDayAssignment & { hill: Hill };
  scheduleId: string;
};

export async function loadDayAssignment(userId: string, dayIndex: number): Promise<DayAssignmentContext> {
  const { schedule } = await loadResolvedWeekScheduleForUser(userId);
  const day = schedule.days.find((d) => d.dayIndex === dayIndex) ?? null;
  if (!day) {
    throw new AppError('Invalid day index for this week', 400);
  }
  return { day, scheduleId: schedule.id };
}

export async function loadTodayDayAssignment(userId: string): Promise<DayAssignmentContext> {
  const { schedule, todayStart, weekNotStartedYet } = await loadResolvedWeekScheduleForUser(userId);
  if (weekNotStartedYet) {
    throw new AppError('Your FLOW week has not started yet', 400);
  }
  const todayDay =
    schedule.days.find((d) => startOfDay(d.calendarDate).getTime() === todayStart.getTime()) ?? null;

  if (!todayDay) {
    throw new AppError('No mission day scheduled for today', 400);
  }

  return { day: todayDay, scheduleId: schedule.id };
}

export async function hasPrescribedMissionActivity(
  userId: string,
  missionIds: string[],
): Promise<boolean> {
  if (missionIds.length === 0) return false;
  const progress = await prisma.userMissionProgress.findMany({
    where: { userId, missionId: { in: missionIds } },
    select: { startedAt: true, status: true },
  });
  return progress.some((p) => p.startedAt != null || p.status === 'completed');
}

export function needsDailyMissionPick(
  day: Pick<PersonalDayAssignment, 'prescribedMissionIds' | 'prescribedCompleted' | 'dailyFlowComplete'>,
  hasStarted = false,
): boolean {
  if (day.dailyFlowComplete || day.prescribedCompleted > 0) return false;
  if (hasStarted) return false;
  return day.prescribedMissionIds.length < MISSIONS_SHOWN;
}

export function canPickMissionsForDay(
  day: Pick<
    PersonalDayAssignment,
    'prescribedMissionIds' | 'prescribedCompleted' | 'dailyFlowComplete' | 'calendarDate'
  >,
  hasStarted: boolean,
  todayStart: Date,
): boolean {
  if (day.dailyFlowComplete || day.prescribedCompleted > 0) return false;
  if (hasStarted) return false;
  const dayStart = startOfDay(day.calendarDate);
  // Past days: allow a first pick so missed assigned missions can still be completed late (+10 only).
  if (dayStart.getTime() < todayStart.getTime() && day.prescribedMissionIds.length >= 3) {
    return false;
  }
  return true;
}

async function buildDayMissionPickPayload(userId: string, dayIndex: number) {
  const categoryCode = await syncUserAgeGroupFromDob(userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.journeyModelVersion < 2) {
    throw new AppError('FLOW Week is not active for this account', 404);
  }

  const { schedule, todayStart, weekNotStartedYet } = await loadResolvedWeekScheduleForUser(userId);
  const day = schedule.days.find((d) => d.dayIndex === dayIndex) ?? null;
  if (!day) {
    throw new AppError('Invalid day index for this week', 400);
  }

  const dayStart = startOfDay(day.calendarDate);
  const isToday = dayStart.getTime() === todayStart.getTime();
  const isPast = dayStart.getTime() < todayStart.getTime();
  const isFuture = dayStart.getTime() > todayStart.getTime();
  const isPreviewOnly = weekNotStartedYet || isFuture;
  const lateCatchUp = isPast && !day.dailyFlowComplete;
  const homeBonusSlotsUsed = lateCatchUp
    ? await prisma.missionCompletion.count({
        where: { userId, dayAssignmentId: day.id, kind: 'late_catch_up' },
      })
    : await countHomeBonusSlotsUsed(userId, day.id);
  const isHomeHillToday = isToday;
  const prescribedCoin =
    isHomeHillToday && !day.dailyFlowComplete && homeBonusSlotsUsed < 3
      ? FLOW_WEEK_COIN_REWARDS.prescribedMission
      : FLOW_WEEK_COIN_REWARDS.optionalOffHillMission;

  const completedTimes =
    day.prescribedMissionIds.length > 0
      ? await loadCompletedMissionTimesForDay(userId, day.id, day.calendarDate)
      : new Map<string, { completedAt: string }>();

  const bonusSlotCompletions = await prisma.missionCompletion.findMany({
    where: {
      userId,
      dayAssignmentId: day.id,
      kind: 'home_bonus_slot',
    },
    select: { missionId: true, coinsAwarded: true },
    orderBy: { createdAt: 'asc' },
  });
  const bonusCoinsByMission = new Map<string, number>();
  for (const row of bonusSlotCompletions) {
    if (!bonusCoinsByMission.has(row.missionId)) {
      bonusCoinsByMission.set(
        row.missionId,
        row.coinsAwarded || FLOW_WEEK_COIN_REWARDS.prescribedMission,
      );
    }
  }

  const prescribedMissionRows =
    day.prescribedMissionIds.length > 0
      ? await prisma.mission.findMany({ where: { id: { in: day.prescribedMissionIds } } })
      : [];
  const prescribedById = new Map(prescribedMissionRows.map((m) => [m.id, m]));
  const progressRows =
    day.prescribedMissionIds.length > 0
      ? await prisma.userMissionProgress.findMany({
          where: { userId, missionId: { in: day.prescribedMissionIds } },
          select: { missionId: true, completionCount: true },
        })
      : [];
  const countByMission = new Map(progressRows.map((p) => [p.missionId, p.completionCount]));

  const prescribedMissions = day.prescribedMissionIds
    .map((id) => prescribedById.get(id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .map((m) => {
      const completionCount = countByMission.get(m.id) ?? (completedTimes.has(m.id) ? 1 : 0);
      const earnedBonus = bonusCoinsByMission.get(m.id);
      return {
        id: m.id,
        title: m.title,
        description: m.description,
        coinReward: earnedBonus ?? prescribedCoin,
        requiresReflection: m.requiresReflection,
        requiresEvidence: m.requiresEvidence,
        completed: completionCount > 0,
        completedAt: completedTimes.get(m.id)?.completedAt ?? null,
        completionCount,
        completionLabel: formatCompletionCountLabel(completionCount),
      };
    });

  const hillMissions = await loadHillMissionsWithCounts({
    userId,
    hill: day.hill,
    ageGroup: categoryCode,
    rewardContext: {
      isTodayHomeHill: isHomeHillToday,
      dailyBonusClaimed: day.dailyFlowComplete,
      homeBonusSlotsUsed,
      dayAssignmentId: day.id,
      prescribedSlotIds: new Set(day.prescribedMissionIds),
    },
    recommendContext: `block-${day.dayIndex}` as `block-${number}`,
  });

  const allMissions = hillMissions.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    order: m.order,
    coinReward: m.coinReward,
    requiresReflection: m.requiresReflection,
    requiresEvidence: m.requiresEvidence,
    isRecommended: m.isRecommended,
    missionGroup: m.missionGroup,
    completionCount: m.completionCount,
    completionLabel: m.completionLabel,
    started: m.started,
    lastCompletedAt: m.lastCompletedAt,
    completedToday: m.completedToday,
    whyText: m.whyText,
  }));
  const recommended = hillMissions.filter((m) => m.isRecommended);

  return {
    dayAssignmentId: day.id,
    hill: {
      id: day.hill.id,
      code: day.hill.code,
      name: day.hill.name,
      virtueName: day.hill.virtueName,
      colorTheme: day.hill.colorTheme,
    },
    dayIndex: day.dayIndex,
    calendarDate: startOfDay(day.calendarDate).toISOString(),
    isToday,
    isPast,
    isFuture,
    weekNotStartedYet,
    isPreviewOnly,
    lateCatchUp,
    pickCount: MISSIONS_SHOWN,
    needsDailyMissionPick: false,
    canPick: false,
    selectedMissionIds: day.prescribedMissionIds,
    prescribedMissions,
    hillMissions,
    prescribedCompleted: Math.max(day.prescribedCompleted, homeBonusSlotsUsed),
    homeBonusSlotsUsed,
    dailyFlowComplete: day.dailyFlowComplete,
    optionalCompletedToday: [],
    extraCoinsEarnedToday: 0,
    recommended: mapMissionOptions(recommended, FLOW_WEEK_COIN_REWARDS.prescribedMission),
    allMissions,
    cycleContext: `block-${day.dayIndex}`,
    rewards: {
      perMission: prescribedCoin,
      growthSetBonus: 0,
      missionsPerCycle: MISSIONS_SHOWN,
      hillStepOnCycleComplete: 1,
      dailyFlowBonus:
        isHomeHillToday && !day.dailyFlowComplete ? FLOW_WEEK_COIN_REWARDS.dailyFlowBonus : 0,
      optionalOffHillMission: FLOW_WEEK_COIN_REWARDS.optionalOffHillMission,
    },
  };
}

export async function getDayMissionPickOptions(userId: string, dayIndex: number) {
  return buildDayMissionPickPayload(userId, dayIndex);
}

export async function getTodayMissionPickOptions(userId: string) {
  const { day } = await loadTodayDayAssignment(userId);
  return buildDayMissionPickPayload(userId, day.dayIndex);
}

export async function confirmDayMissionPick(userId: string, dayIndex: number, missionIds: string[]) {
  const categoryCode = await syncUserAgeGroupFromDob(userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.journeyModelVersion < 2) {
    throw new AppError('FLOW Week is not active for this account', 404);
  }

  const { day } = await loadDayAssignment(userId, dayIndex);
  const { todayStart, weekNotStartedYet } = await loadResolvedWeekScheduleForUser(userId);
  const hasStarted = await hasPrescribedMissionActivity(userId, day.prescribedMissionIds);

  if (weekNotStartedYet) {
    throw new AppError('Your FLOW week has not started yet', 400);
  }

  const dayStart = startOfDay(day.calendarDate);
  if (dayStart.getTime() > todayStart.getTime()) {
    throw new AppError('Missions for future days cannot be picked yet', 400);
  }

  if (!canPickMissionsForDay(day, hasStarted, todayStart)) {
    throw new AppError('Missions for this day are already locked in', 409);
  }

  if (missionIds.length !== MISSIONS_SHOWN) {
    throw new AppError(`Pick exactly ${MISSIONS_SHOWN} missions for this day`, 400);
  }

  const missions = await prisma.mission.findMany({
    where: { id: { in: missionIds } },
  });

  if (missions.length !== MISSIONS_SHOWN) {
    throw new AppError('One or more missions were not found', 400);
  }

  validateUserMissionSelection(missions, day.hillId, categoryCode);

  await prisma.personalDayAssignment.update({
    where: { id: day.id },
    data: {
      prescribedMissionIds: missionIds,
      prescribedCompleted: 0,
      dailyFlowComplete: false,
    },
  });

  const flowWeek = await getFlowWeekForUser(userId);
  return { flowWeek };
}

export async function confirmTodayMissionPick(userId: string, missionIds: string[]) {
  const { day } = await loadTodayDayAssignment(userId);
  return confirmDayMissionPick(userId, day.dayIndex, missionIds);
}
