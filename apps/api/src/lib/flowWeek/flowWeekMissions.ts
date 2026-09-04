import { LedgerSource, LedgerType, MissionStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../../middleware/errorHandler';
import { writeAuditLog } from '../auditService';
import { startOfDay, resolveGofamWeekStartDay, currentFlowWeekBounds } from './personalWeek';
import { FLOW_WEEK_COIN_REWARDS, FLOW_WEEK_SEED_REWARDS, WEEKDAY_LABELS } from './types';
import { awardDailyHillStepInTransaction, resolveDailyStepAwardSource } from './dailySteps';
import { virtueCoinMultiplierForHill } from '../virtue';
import {
  awardCampTreeStar,
  checkAndAwardCoinMilestones,
  type TreeStarGrantResult,
} from '../treeStarService';
import { detectCampReached } from '../hillProgress';
import { resolveMissionReward } from './homeHillRewards';
import { countTodayBonusMissionsForChakra } from './flowWeekExtras';
import { syncUserAgeGroupFromDob } from '../userAgeSync';
import { grantCampStreakTokensForStepAdvance, assertNoBlockingMissedDay, getBlockingMissedDay } from './campStreakService';
import { checkAndGrantHarvestRewards } from '../glowHarvestService';
import { getGrowChallengeProgress } from './growChallengeService';

function dailyBonusRef(dayAssignmentId: string) {
  return `flow_daily_bonus:${dayAssignmentId}`;
}

function dailySeedRef(dayAssignmentId: string) {
  return `flow_daily_seed:${dayAssignmentId}`;
}

function perfectWeekBonusRef(userId: string, weekStart: Date) {
  return `flow_perfect_week_bonus:${userId}:${startOfDay(weekStart).toISOString().slice(0, 10)}`;
}

function perfectWeekSeedsRef(userId: string, weekStart: Date) {
  return `flow_perfect_week_seeds:${userId}:${startOfDay(weekStart).toISOString().slice(0, 10)}`;
}

function completionCoinRef(completionId: string) {
  return `flow_complete:${completionId}`;
}

async function grantFlowWeekCoins(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  amount: number,
  referenceId: string,
): Promise<{ granted: boolean; levelUp: TreeStarGrantResult | null }> {
  if (amount <= 0) return { granted: false, levelUp: null };

  const existing = await tx.coinLedgerEntry.findFirst({
    where: { userId, referenceId, source: LedgerSource.flow_week },
  });
  if (existing) return { granted: false, levelUp: null };

  await tx.coinLedgerEntry.create({
    data: {
      userId,
      amount,
      ledgerType: LedgerType.personal_growth,
      source: LedgerSource.flow_week,
      referenceId,
    },
  });

  await tx.user.update({
    where: { id: userId },
    data: {
      walletCoins: { increment: amount },
      growthCoinsLifetime: { increment: amount },
    },
  });

  const milestones = await checkAndAwardCoinMilestones(tx, userId);
  const levelUp = milestones.find((m) => m.levelUp) ?? null;
  return { granted: true, levelUp };
}

async function grantFlowWeekSeeds(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  count: number,
  referenceId: string,
): Promise<boolean> {
  if (count <= 0) return false;

  const existing = await tx.coinLedgerEntry.findFirst({
    where: { userId, referenceId, source: LedgerSource.flow_week },
  });
  if (existing) return false;

  await tx.coinLedgerEntry.create({
    data: {
      userId,
      amount: 0,
      ledgerType: LedgerType.personal_growth,
      source: LedgerSource.flow_week,
      referenceId,
    },
  });

  await tx.user.update({
    where: { id: userId },
    data: { seedInventoryCount: { increment: count } },
  });

  return true;
}

/** Local testing: pull a future FLOW week onto this week's Monday so missions can be completed today. */
export async function unlockUpcomingFlowWeekForDev(userId: string) {
  if (process.env.NODE_ENV !== 'development') return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gofamWeekStartDay: true },
  });
  if (!user) return;

  const gofamWeekStartDay = resolveGofamWeekStartDay(user.gofamWeekStartDay);
  const todayStart = startOfDay(new Date());
  const schedules = await prisma.personalWeekSchedule.findMany({
    where: { userId },
    include: { days: { orderBy: { dayIndex: 'asc' } } },
    orderBy: { personalWeekStart: 'desc' },
  });

  const upcoming = schedules.find(
    (s) => startOfDay(s.personalWeekStart).getTime() > todayStart.getTime(),
  );
  if (!upcoming) return;

  const alreadyActive = schedules.some((s) => {
    if (s.id === upcoming.id) return false;
    const last = s.days[s.days.length - 1];
    if (!last) return false;
    const weekStart = startOfDay(s.personalWeekStart);
    const weekEnd = startOfDay(last.calendarDate);
    return todayStart.getTime() >= weekStart.getTime() && todayStart.getTime() <= weekEnd.getTime();
  });
  if (alreadyActive) return;

  const newStart = todayStart;
  const oldStart = startOfDay(upcoming.personalWeekStart);
  const shiftMs = newStart.getTime() - oldStart.getTime();
  if (shiftMs === 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.personalWeekSchedule.update({
      where: { id: upcoming.id },
      data: { personalWeekStart: newStart },
    });
    for (const day of upcoming.days) {
      await tx.personalDayAssignment.update({
        where: { id: day.id },
        data: { calendarDate: new Date(startOfDay(day.calendarDate).getTime() + shiftMs) },
      });
    }
  });
}

async function maybeAwardPerfectWeekInTransaction(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  completedDayCalendarDate: Date,
  gofamWeekStartDay: number,
  isStarterWeek: boolean,
): Promise<{ perfectWeekBonusAwarded: number; perfectWeekSeedsAwarded: number }> {
  if (isStarterWeek) {
    return { perfectWeekBonusAwarded: 0, perfectWeekSeedsAwarded: 0 };
  }

  const { weekStart, weekEnd } = currentFlowWeekBounds(
    completedDayCalendarDate,
    gofamWeekStartDay,
  );
  const completedDay = startOfDay(completedDayCalendarDate);
  if (completedDay.getTime() !== startOfDay(weekEnd).getTime()) {
    return { perfectWeekBonusAwarded: 0, perfectWeekSeedsAwarded: 0 };
  }

  const daysInWeek = await tx.personalDayAssignment.findMany({
    where: {
      schedule: { userId },
      calendarDate: { gte: weekStart, lte: weekEnd },
    },
  });

  // Partial calendar weeks (e.g. mid-week join): every assigned day Mon–Sun must be complete.
  if (daysInWeek.length === 0) {
    return { perfectWeekBonusAwarded: 0, perfectWeekSeedsAwarded: 0 };
  }
  if (!daysInWeek.every((day) => day.dailyFlowComplete)) {
    return { perfectWeekBonusAwarded: 0, perfectWeekSeedsAwarded: 0 };
  }

  const bonusRef = perfectWeekBonusRef(userId, weekStart);
  const seedsRef = perfectWeekSeedsRef(userId, weekStart);

  const bonusGranted = await grantFlowWeekCoins(
    tx,
    userId,
    FLOW_WEEK_COIN_REWARDS.perfectWeekBonus,
    bonusRef,
  );
  const seedsGranted = await grantFlowWeekSeeds(
    tx,
    userId,
    FLOW_WEEK_SEED_REWARDS.perfectWeek,
    seedsRef,
  );

  return {
    perfectWeekBonusAwarded: bonusGranted.granted ? FLOW_WEEK_COIN_REWARDS.perfectWeekBonus : 0,
    perfectWeekSeedsAwarded: seedsGranted ? FLOW_WEEK_SEED_REWARDS.perfectWeek : 0,
  };
}

async function maybeCompleteStarterWeekInTransaction(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  scheduleId: string,
  isStarterWeek: boolean,
): Promise<boolean> {
  if (!isStarterWeek) return false;

  const schedule = await tx.personalWeekSchedule.findUnique({
    where: { id: scheduleId },
    include: { days: true },
  });
  if (!schedule || schedule.days.length === 0) return false;
  if (!schedule.days.every((day) => day.dailyFlowComplete)) return false;

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { starterWeekCompletedAt: true },
  });
  if (user?.starterWeekCompletedAt) return false;

  await tx.user.update({
    where: { id: userId },
    data: {
      starterWeekCompletedAt: new Date(),
      starterWeekActive: false,
    },
  });
  return true;
}

async function loadActiveWeekAssignment(userId: string) {
  await unlockUpcomingFlowWeekForDev(userId);
  const now = new Date();
  const todayStart = startOfDay(now);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { gofamWeekStartDay: true },
  });
  const gofamWeekStartDay = resolveGofamWeekStartDay(user.gofamWeekStartDay);

  const schedules = await prisma.personalWeekSchedule.findMany({
    where: { userId },
    orderBy: { personalWeekStart: 'desc' },
    include: {
      days: { include: { hill: true }, orderBy: { dayIndex: 'asc' } },
    },
  });

  const schedule = schedules.find((s) => {
    const last = s.days[s.days.length - 1];
    if (!last) return false;
    const weekStart = startOfDay(s.personalWeekStart);
    const weekEnd = startOfDay(last.calendarDate);
    return todayStart.getTime() >= weekStart.getTime() && todayStart.getTime() <= weekEnd.getTime();
  });

  if (!schedule) {
    const label = WEEKDAY_LABELS[gofamWeekStartDay] ?? 'your chosen weekday';
    throw new AppError(
      `Your FLOW week has not started yet. Missions unlock every ${label}.`,
      403,
    );
  }

  const todayDay =
    schedule.days.find((d) => startOfDay(d.calendarDate).getTime() === todayStart.getTime()) ?? null;

  return { schedule, todayDay, todayStart };
}

function assertFlowWeekMissionDayAllowed(
  schedule: { personalWeekStart: Date },
  _todayDay: { calendarDate: Date } | null,
  todayStart: Date,
  gofamWeekStartDay: number | null,
) {
  const weekStart = startOfDay(schedule.personalWeekStart);
  const chosenDay = gofamWeekStartDay ?? weekStart.getDay();
  const label = WEEKDAY_LABELS[chosenDay] ?? 'your chosen weekday';

  // Journey Day 1 = account creation date (any weekday). Do not require
  // personalWeekStart to fall on gofamWeekStartDay (legacy Sunday gate).
  if (todayStart.getTime() < weekStart.getTime()) {
    throw new AppError(
      `Your FLOW week has not started yet. Missions unlock every ${label}.`,
      403,
    );
  }
}

async function resolveTargetDayForMission(
  userId: string,
  missionHillId: string,
  gofamWeekStartDay: number | null,
  dayAssignmentId?: string | null,
) {
  const todayStart = startOfDay(new Date());

  if (dayAssignmentId) {
    const day = await prisma.personalDayAssignment.findUnique({
      where: { id: dayAssignmentId },
      include: { hill: true, schedule: { include: { days: { include: { hill: true } } } } },
    });
    if (!day || day.schedule.userId !== userId) {
      throw new AppError('Mission day not found', 404);
    }
    const dayStart = startOfDay(day.calendarDate);
    if (dayStart.getTime() >= todayStart.getTime()) {
      throw new AppError('Late catch-up is only for past mission days', 400);
    }
    if (day.dailyFlowComplete) {
      throw new AppError('That day is already complete', 409);
    }
    if (day.hillId !== missionHillId) {
      throw new AppError('Mission must belong to that day\'s Home Hill', 400);
    }
    return {
      schedule: day.schedule,
      day,
      todayStart,
      isCatchUp: true,
    };
  }

  const blocking = await getBlockingMissedDay(userId);
  if (blocking) {
    const day = await prisma.personalDayAssignment.findUnique({
      where: { id: blocking.dayAssignmentId },
      include: { hill: true, schedule: { include: { days: { include: { hill: true } } } } },
    });
    if (!day || day.schedule.userId !== userId) {
      throw new AppError('Resolve your missed day before continuing', 409, {
        code: 'MISSED_DAY_BLOCKING',
        missedDay: blocking,
      });
    }
    if (day.hillId !== missionHillId) {
      await assertNoBlockingMissedDay(userId, '__other_day__');
    }
    return {
      schedule: day.schedule,
      day,
      todayStart: startOfDay(new Date()),
      isCatchUp: true,
    };
  }

  const { schedule, todayDay, todayStart: activeTodayStart } = await loadActiveWeekAssignment(userId);
  assertFlowWeekMissionDayAllowed(schedule, todayDay, activeTodayStart, gofamWeekStartDay);
  if (!todayDay) {
    throw new AppError('No mission day scheduled for today', 400);
  }
  return { schedule, day: todayDay, todayStart: activeTodayStart, isCatchUp: false };
}

export async function startFlowWeekMission(
  userId: string,
  missionId: string,
  dayAssignmentId?: string | null,
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { journeyModelVersion: true, gofamWeekStartDay: true },
  });
  if (user.journeyModelVersion < 2) {
    throw new AppError('FLOW Week is not active for this account', 404);
  }

  const mission = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!mission) throw new AppError('Mission not found', 404);

  const target = await resolveTargetDayForMission(
    userId,
    mission.hillId,
    user.gofamWeekStartDay,
    dayAssignmentId,
  );
  await assertNoBlockingMissedDay(userId, target.day.id);

  const startedAt = new Date();
  await prisma.userMissionProgress.upsert({
    where: { userId_missionId: { userId, missionId } },
    create: { userId, missionId, startedAt },
    update: { startedAt },
  });

  return { startedAt: startedAt.toISOString() };
}

export async function completeFlowWeekMission(
  userId: string,
  missionId: string,
  dayAssignmentId?: string | null,
) {
  const categoryCode = await syncUserAgeGroupFromDob(userId);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { journeyModelVersion: true, gofamWeekStartDay: true },
  });
  if (user.journeyModelVersion < 2) {
    throw new AppError('FLOW Week is not active for this account', 404);
  }

  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    include: { hill: true },
  });
  if (!mission || mission.isDisabled) throw new AppError('Mission not found', 404);

  if (mission.categoryCode !== categoryCode) {
    throw new AppError('Mission is not available for your age category', 400);
  }

  const target = await resolveTargetDayForMission(
    userId,
    mission.hillId,
    user.gofamWeekStartDay,
    dayAssignmentId,
  );
  const { schedule, day: todayDay, isCatchUp } = target;
  await assertNoBlockingMissedDay(userId, todayDay.id);

  const isTodayHomeHill = mission.hillId === todayDay.hillId;
  const completionDate = startOfDay(todayDay.calendarDate);

  const alreadyOnDay = await prisma.missionCompletion.findFirst({
    where: {
      userId,
      missionId,
      calendarDate: completionDate,
    },
    select: { id: true },
  });
  if (alreadyOnDay) {
    throw new AppError(
      isCatchUp
        ? 'You already completed this mission for that day.'
        : 'You already completed this mission today. Choose a different one.',
      409,
    );
  }

  let coinReward: number = FLOW_WEEK_COIN_REWARDS.optionalOffHillMission;
  let dailyBonusAwarded = 0;
  let dailySeedsAwarded = 0;
  let perfectWeekBonusAwarded = 0;
  let perfectWeekSeedsAwarded = 0;
  let dailyFlowJustCompleted = false;
  let starterWeekJustCompleted = false;
  let stepAwarded = false;
  let virtueMultiplier: 1 | 2 = 1;
  let rewardKind: string = 'other_hill';
  let completionCount = 0;
  let stepAwardMeta = null as {
    awardBatchId: string;
    awardSource: string;
    beforeSteps: number;
    afterSteps: number;
    hillId: string;
  } | null;
  let campReached: ReturnType<typeof detectCampReached> = null;
  let treeLevelUp: TreeStarGrantResult | null = null;

  await prisma.$transaction(
    async (tx) => {
      const day = await tx.personalDayAssignment.findUniqueOrThrow({
        where: { id: todayDay.id },
      });

      const slotKind = isCatchUp ? 'late_catch_up' : 'home_bonus_slot';
      const homeBonusSlotsUsed = await tx.missionCompletion.count({
        where: {
          userId,
          dayAssignmentId: day.id,
          kind: slotKind,
        },
      });

      const reward = resolveMissionReward({
        isLateCatchUp: isCatchUp,
        isTodayHomeHill,
        dailyBonusClaimed: day.dailyFlowComplete,
        homeBonusSlotsUsed,
      });
      rewardKind = reward.kind;

      // ×2 mission coins when this hill has an active monthly GLOW virtue boost
      // (e.g. Hard Work → HOST). One boost per hill per month — never stacks above 2.
      virtueMultiplier = await virtueCoinMultiplierForHill(tx, userId, mission.hillId);
      coinReward = reward.baseCoins * virtueMultiplier;

      const existingProgress = await tx.userMissionProgress.findUnique({
        where: { userId_missionId: { userId, missionId } },
      });
      const nextSequence = (existingProgress?.completionCount ?? 0) + 1;
      completionCount = nextSequence;
      const completedAt = new Date();

      const completion = await tx.missionCompletion.create({
        data: {
          userId,
          missionId,
          hillId: mission.hillId,
          dayAssignmentId:
            reward.kind === 'home_bonus_slot' || reward.kind === 'late_catch_up' ? day.id : null,
          calendarDate: completionDate,
          coinsAwarded: coinReward,
          kind: reward.kind,
          sequence: nextSequence,
          createdAt: completedAt,
        },
      });

      const coinGrant = await grantFlowWeekCoins(
        tx,
        userId,
        coinReward,
        completionCoinRef(completion.id),
      );
      if (coinGrant.levelUp) treeLevelUp = coinGrant.levelUp;

      await tx.userMissionProgress.upsert({
        where: { userId_missionId: { userId, missionId } },
        create: {
          userId,
          missionId,
          startedAt: completedAt,
          completedAt,
          status: MissionStatus.completed,
          completionCount: 1,
        },
        update: {
          completedAt,
          status: MissionStatus.completed,
          completionCount: nextSequence,
          startedAt: existingProgress?.startedAt ?? completedAt,
        },
      });

      if (reward.kind === 'late_catch_up') {
        if (homeBonusSlotsUsed >= 3) {
          throw new AppError('All 3 late catch-up missions for that day are already done', 409);
        }
        if (
          day.prescribedMissionIds.length > 0 &&
          !day.prescribedMissionIds.includes(missionId)
        ) {
          throw new AppError('Late catch-up must use that day\'s assigned missions', 400);
        }

        const nextCompleted = Math.min(3, homeBonusSlotsUsed + 1);
        await tx.personalDayAssignment.update({
          where: { id: day.id },
          data: {
            prescribedCompleted: Math.max(day.prescribedCompleted, nextCompleted),
          },
        });
      }

      if (reward.kind === 'home_bonus_slot') {
        const nextCompleted = Math.min(3, day.prescribedCompleted + 1);
        const nextIds = [...day.prescribedMissionIds];
        if (!nextIds.includes(missionId) && nextIds.length < 3) {
          nextIds.push(missionId);
        }

        const dailyComplete = reward.triggersDailyBonus;
        await tx.personalDayAssignment.update({
          where: { id: day.id },
          data: {
            prescribedMissionIds: nextIds,
            prescribedCompleted: nextCompleted,
            dailyFlowComplete: dailyComplete || day.dailyFlowComplete,
          },
        });

        if (dailyComplete && !day.dailyFlowComplete) {
          dailyFlowJustCompleted = true;

          const dailyStepSource = resolveDailyStepAwardSource({
            isStarterWeek: schedule.isStarterWeek,
          });
          const stepResult = await awardDailyHillStepInTransaction(
            tx,
            userId,
            day.hillId,
            dailyStepSource,
          );
          stepAwarded = stepResult.stepAwarded;
          if (stepResult.stepAwarded && stepResult.awardBatchId) {
            stepAwardMeta = {
              hillId: day.hillId,
              awardBatchId: stepResult.awardBatchId,
              awardSource: stepResult.awardSource ?? dailyStepSource,
              beforeSteps: stepResult.beforeSteps ?? 0,
              afterSteps: stepResult.afterSteps ?? 0,
            };
            campReached = detectCampReached(stepResult.beforeSteps ?? 0, stepResult.afterSteps ?? 0);
            await grantCampStreakTokensForStepAdvance(
              tx,
              userId,
              stepResult.beforeSteps ?? 0,
              stepResult.afterSteps ?? 0,
            );
            const campStar = await awardCampTreeStar(tx, userId, campReached);
            if (campStar?.levelUp) treeLevelUp = campStar;
          }

          const bonusAmount = FLOW_WEEK_COIN_REWARDS.dailyFlowBonus * virtueMultiplier;
          const bonusGranted = await grantFlowWeekCoins(
            tx,
            userId,
            bonusAmount,
            dailyBonusRef(day.id),
          );
          if (bonusGranted.granted) dailyBonusAwarded = bonusAmount;
          if (bonusGranted.levelUp) treeLevelUp = bonusGranted.levelUp;

          const seedGranted = await grantFlowWeekSeeds(
            tx,
            userId,
            FLOW_WEEK_SEED_REWARDS.dailyFlow,
            dailySeedRef(day.id),
          );
          if (seedGranted) dailySeedsAwarded = FLOW_WEEK_SEED_REWARDS.dailyFlow;

          const gofamWeekStartDay = resolveGofamWeekStartDay(user.gofamWeekStartDay);
          const perfectWeek = await maybeAwardPerfectWeekInTransaction(
            tx,
            userId,
            day.calendarDate,
            gofamWeekStartDay,
            schedule.isStarterWeek,
          );
          perfectWeekBonusAwarded = perfectWeek.perfectWeekBonusAwarded;
          perfectWeekSeedsAwarded = perfectWeek.perfectWeekSeedsAwarded;

          starterWeekJustCompleted = await maybeCompleteStarterWeekInTransaction(
            tx,
            userId,
            schedule.id,
            schedule.isStarterWeek,
          );
        }
      }
    },
    { timeout: 20_000 },
  );

  if (stepAwardMeta) {
    await writeAuditLog({
      module: 'journey',
      action: 'flow_week.hill_step_awarded',
      subjectUserId: userId,
      entityType: 'GrowthSet',
      entityId: stepAwardMeta.awardBatchId,
      metadata: stepAwardMeta,
    });
  }

  if (dailyFlowJustCompleted && todayDay) {
    await writeAuditLog({
      module: 'journey',
      action: 'flow_week.daily_flow_completed',
      subjectUserId: userId,
      entityType: 'PersonalDayAssignment',
      entityId: todayDay.id,
      metadata: {
        personalWeekStart: schedule.personalWeekStart.toISOString(),
        dayIndex: todayDay.dayIndex,
        hillCode: todayDay.hill.code,
        dailyFlowComplete: true,
        dailySeedsAwarded,
        virtueMultiplier,
      },
    });
  }

  if (starterWeekJustCompleted) {
    await writeAuditLog({
      module: 'journey',
      action: 'flow_week.starter_week_completed',
      subjectUserId: userId,
      entityType: 'PersonalWeekSchedule',
      entityId: schedule.id,
      metadata: { personalWeekStart: schedule.personalWeekStart.toISOString() },
    });
  }

  if (perfectWeekBonusAwarded > 0 || perfectWeekSeedsAwarded > 0) {
    await writeAuditLog({
      module: 'journey',
      action: 'flow_week.perfect_week_awarded',
      subjectUserId: userId,
      entityType: 'PersonalWeekSchedule',
      entityId: schedule.id,
      metadata: {
        personalWeekStart: schedule.personalWeekStart.toISOString(),
        perfectWeekBonusAwarded,
        perfectWeekSeedsAwarded,
      },
    });
  }

  await writeAuditLog({
    module: 'journey',
    action: 'flow_week.mission_completed',
    subjectUserId: userId,
    entityType: 'Mission',
    entityId: missionId,
    metadata: {
      hillCode: mission.hill.code,
      isTodayHomeHill,
      rewardKind,
      coinsAwarded: coinReward,
      completionCount,
      virtueMultiplier,
    },
  });

  const campReachedFinal = campReached;

  const totalCoins = coinReward + dailyBonusAwarded + perfectWeekBonusAwarded;
  const wallet = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletCoins: true, seedInventoryCount: true },
  });

  const extraCompleted = await countTodayBonusMissionsForChakra(userId, todayDay.calendarDate);

  const isHomeBonus = rewardKind === 'home_bonus_slot';

  let harvestRewards: Awaited<ReturnType<typeof checkAndGrantHarvestRewards>> = [];
  try {
    harvestRewards = await checkAndGrantHarvestRewards(userId);
  } catch {
    /* harvest must never block mission complete */
  }

  let growChallenge = null as Awaited<ReturnType<typeof getGrowChallengeProgress>> | null;
  try {
    growChallenge = await getGrowChallengeProgress(userId);
  } catch {
    growChallenge = null;
  }

  return {
    coinReward: totalCoins,
    missionTitle: mission.title,
    isPrescribed: isHomeBonus || rewardKind === 'late_catch_up',
    isTodayHomeHill: isTodayHomeHill && !isCatchUp,
    rewardKind,
    completionCount,
    extraCompleted,
    lateCatchUp: isCatchUp,
    virtueMultiplier,
    dailyBonusAwarded,
    dailySeedsAwarded,
    perfectWeekBonusAwarded,
    perfectWeekSeedsAwarded,
    starterWeekJustCompleted,
    stepAwarded,
    campReached: campReachedFinal,
    treeLevelUp: treeLevelUp
      ? {
          newLevel: treeLevelUp.newLevel,
          newStage: treeLevelUp.newStage,
          newTotal: treeLevelUp.newTotal,
        }
      : null,
    coinsAwarded: coinReward,
    walletCoins: wallet?.walletCoins ?? 0,
    seedInventoryCount: wallet?.seedInventoryCount ?? 0,
    harvestRewards,
    growChallenge,
  };
}

/** Times for missions that filled today's Home Hill bonus slots (legacy week UI). */
export async function loadCompletedMissionTimesForDay(
  userId: string,
  dayAssignmentId: string,
  calendarDate: Date,
): Promise<Map<string, { completedAt: string }>> {
  const batch = await loadCompletedMissionTimesForDays(userId, [
    { id: dayAssignmentId, calendarDate },
  ]);
  return batch.get(dayAssignmentId) ?? new Map();
}

/** Batch version — one query for all days instead of N round-trips. */
export async function loadCompletedMissionTimesForDays(
  userId: string,
  days: Array<{ id: string; calendarDate: Date }>,
): Promise<Map<string, Map<string, { completedAt: string }>>> {
  const byDayId = new Map<string, Map<string, { completedAt: string }>>();
  for (const day of days) {
    byDayId.set(day.id, new Map());
  }
  if (days.length === 0) return byDayId;

  const dayIds = days.map((d) => d.id);
  const fromCompletions = await prisma.missionCompletion.findMany({
    where: {
      userId,
      dayAssignmentId: { in: dayIds },
      kind: 'home_bonus_slot',
    },
    select: { missionId: true, createdAt: true, dayAssignmentId: true },
    orderBy: { createdAt: 'asc' },
  });

  for (const row of fromCompletions) {
    if (!row.dayAssignmentId) continue;
    const dayMap = byDayId.get(row.dayAssignmentId);
    if (!dayMap || dayMap.has(row.missionId)) continue;
    dayMap.set(row.missionId, { completedAt: row.createdAt.toISOString() });
  }

  const legacyDays = days.filter((d) => (byDayId.get(d.id)?.size ?? 0) === 0);
  if (legacyDays.length > 0) {
    await Promise.all(
      legacyDays.map(async (day) => {
        const legacy = await loadLegacyCompletedMissionTimesForDay(userId, day.id, day.calendarDate);
        if (legacy.size > 0) byDayId.set(day.id, legacy);
      }),
    );
  }

  return byDayId;
}

async function loadLegacyCompletedMissionTimesForDay(
  userId: string,
  dayAssignmentId: string,
  calendarDate: Date,
): Promise<Map<string, { completedAt: string }>> {
  const completed = new Map<string, { completedAt: string }>();
  const refs = await prisma.coinLedgerEntry.findMany({
    where: {
      userId,
      source: LedgerSource.flow_week,
      OR: [
        { referenceId: { startsWith: `flow_prescribed:${dayAssignmentId}:` } },
        { referenceId: { startsWith: `flow_optional:${startOfDay(calendarDate).toISOString()}:` } },
      ],
    },
    select: { referenceId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  for (const row of refs) {
    if (!row.referenceId) continue;
    const parts = row.referenceId.split(':');
    const mid = parts[parts.length - 1];
    if (mid) {
      completed.set(mid, { completedAt: row.createdAt.toISOString() });
    }
  }
  return completed;
}

export async function loadCompletedMissionIdsForDay(
  userId: string,
  dayAssignmentId: string,
  calendarDate: Date,
): Promise<Set<string>> {
  const times = await loadCompletedMissionTimesForDay(userId, dayAssignmentId, calendarDate);
  return new Set(times.keys());
}
