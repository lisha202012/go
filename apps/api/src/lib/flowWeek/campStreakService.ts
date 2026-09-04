import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../../middleware/errorHandler';
import { writeAuditLog } from '../auditService';
import { detectCampReached, CAMP_CHECKPOINTS } from '../hillProgress';
import { MISSIONS_SHOWN } from '../missionEngine';
import { awardDailyHillStepInTransaction } from './dailySteps';
import { awardLockstepStepInTransaction } from './lockstep';
import { startOfDay } from './personalWeek';
import { CHALLENGE_DISABLE_MISSED_DAY_BLOCK, FLOW_WEEK_AWARD_SOURCES } from './types';
import { awardCampTreeStar } from '../treeStarService';

export type CampReachedLike = { number: number } | null | undefined;

export type CampStreakStatus = {
  tokensEarned: number;
  tokensUsed: number;
  tokensAvailable: number;
};

export type CampStreakTokenDetail = {
  id: string;
  campNumber: number;
  campName: string;
  stepThreshold: number;
  status: 'available' | 'used';
  earnedAt: string;
  usedAt: string | null;
  usedFor: {
    calendarDate: string;
    hill: { code: string; name: string };
  } | null;
};

export type MissedDayPayload = {
  dayAssignmentId: string;
  dayIndex: number;
  calendarDate: string;
  hill: { code: string; name: string };
};

export const EMPTY_CAMP_STREAK: CampStreakStatus = {
  tokensEarned: 0,
  tokensUsed: 0,
  tokensAvailable: 0,
};

export function shouldAllowMissionOnDay(
  blocking: { dayAssignmentId: string } | null,
  dayAssignmentIdBeingCompleted: string,
): boolean {
  if (!blocking) return true;
  return blocking.dayAssignmentId === dayAssignmentIdBeingCompleted;
}

export function campCheckpointsCrossed(beforeSteps: number, afterSteps: number) {
  return CAMP_CHECKPOINTS.filter(
    (camp) => beforeSteps < camp.stepThreshold && afterSteps >= camp.stepThreshold,
  );
}

export async function grantCampStreakTokenIfNewCamp(
  tx: Prisma.TransactionClient,
  userId: string,
  campReached: CampReachedLike,
) {
  if (!campReached) return;
  await tx.campStreakToken.upsert({
    where: {
      userId_campNumber: { userId, campNumber: campReached.number },
    },
    create: { userId, campNumber: campReached.number },
    update: {},
  });
}

export async function grantCampStreakTokensForStepAdvance(
  tx: Prisma.TransactionClient,
  userId: string,
  beforeSteps: number,
  afterSteps: number,
) {
  for (const camp of campCheckpointsCrossed(beforeSteps, afterSteps)) {
    await grantCampStreakTokenIfNewCamp(tx, userId, camp);
  }
}

export async function getCampStreakStatus(userId: string): Promise<CampStreakStatus> {
  const [tokensEarned, tokensUsed] = await Promise.all([
    prisma.campStreakToken.count({ where: { userId } }),
    prisma.campStreakToken.count({ where: { userId, status: 'used' } }),
  ]);
  return {
    tokensEarned,
    tokensUsed,
    tokensAvailable: Math.max(0, tokensEarned - tokensUsed),
  };
}

function campMetaForNumber(campNumber: number) {
  const camp = CAMP_CHECKPOINTS.find((c) => c.number === campNumber);
  return {
    campName: camp?.name ?? `Camp ${campNumber}`,
    stepThreshold: camp?.stepThreshold ?? 0,
  };
}

/** Full streak ledger — where each free streak was earned and how it was spent. */
export async function listCampStreakTokenDetails(userId: string): Promise<CampStreakTokenDetail[]> {
  const rows = await prisma.campStreakToken.findMany({
    where: { userId },
    orderBy: { earnedAt: 'asc' },
  });
  if (rows.length === 0) return [];

  const dayIds = rows
    .map((row) => row.usedForDayAssignmentId)
    .filter((id): id is string => Boolean(id));
  const days =
    dayIds.length > 0
      ? await prisma.personalDayAssignment.findMany({
          where: { id: { in: dayIds } },
          include: { hill: true },
        })
      : [];
  const dayById = new Map(days.map((day) => [day.id, day]));

  return rows.map((row) => {
    const { campName, stepThreshold } = campMetaForNumber(row.campNumber);
    const usedDay = row.usedForDayAssignmentId
      ? dayById.get(row.usedForDayAssignmentId)
      : undefined;
    return {
      id: row.id,
      campNumber: row.campNumber,
      campName,
      stepThreshold,
      status: row.status === 'used' ? 'used' : 'available',
      earnedAt: row.earnedAt.toISOString(),
      usedAt: row.usedAt?.toISOString() ?? null,
      usedFor: usedDay
        ? {
            calendarDate: startOfDay(usedDay.calendarDate).toISOString(),
            hill: { code: usedDay.hill.code, name: usedDay.hill.name },
          }
        : null,
    };
  });
}

function toMissedDayPayload(
  day: {
    id: string;
    dayIndex: number;
    calendarDate: Date;
    hill: { code: string; name: string };
  },
): MissedDayPayload {
  return {
    dayAssignmentId: day.id,
    dayIndex: day.dayIndex,
    calendarDate: startOfDay(day.calendarDate).toISOString(),
    hill: { code: day.hill.code, name: day.hill.name },
  };
}

export async function listUnresolvedMissedDays(
  userId: string,
  { limit = 10 }: { limit?: number } = {},
): Promise<MissedDayPayload[]> {
  const todayStart = startOfDay(new Date());
  const schedules = await prisma.personalWeekSchedule.findMany({
    where: { userId },
    include: {
      days: { include: { hill: true }, orderBy: { calendarDate: 'asc' } },
    },
    orderBy: { personalWeekStart: 'asc' },
  });

  const missed: MissedDayPayload[] = [];
  for (const schedule of schedules) {
    for (const day of schedule.days) {
      if (startOfDay(day.calendarDate).getTime() >= todayStart.getTime()) continue;
      if (day.dailyFlowComplete) continue;
      missed.push(toMissedDayPayload(day));
      if (missed.length >= limit) return missed;
    }
  }
  return missed;
}

export async function getBlockingMissedDay(userId: string): Promise<MissedDayPayload | null> {
  if (CHALLENGE_DISABLE_MISSED_DAY_BLOCK) return null;
  const [oldest] = await listUnresolvedMissedDays(userId, { limit: 1 });
  return oldest ?? null;
}

export async function assertNoBlockingMissedDay(
  userId: string,
  dayAssignmentIdBeingCompleted: string,
) {
  const blocking = await getBlockingMissedDay(userId);
  if (shouldAllowMissionOnDay(blocking, dayAssignmentIdBeingCompleted)) return;
  throw new AppError('Resolve your missed day before continuing', 409, {
    code: 'MISSED_DAY_BLOCKING',
    missedDay: blocking,
    campStreak: await getCampStreakStatus(userId),
  });
}

export async function resolveMissedDayWithStreak(userId: string, dayAssignmentId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const day = await tx.personalDayAssignment.findUnique({
      where: { id: dayAssignmentId },
      include: {
        hill: true,
        schedule: { select: { userId: true } },
      },
    });
    if (!day || day.schedule.userId !== userId) {
      throw new AppError('Missed day not found', 404);
    }
    if (day.dailyFlowComplete) {
      throw new AppError('This day is already complete', 400);
    }
    const todayStart = startOfDay(new Date());
    if (startOfDay(day.calendarDate).getTime() >= todayStart.getTime()) {
      throw new AppError('Only past incomplete days can be forgiven with a streak', 400);
    }

    const token = await tx.campStreakToken.findFirst({
      where: { userId, status: 'available' },
      orderBy: { earnedAt: 'asc' },
    });
    if (!token) {
      throw new AppError('No free streak available', 400, { code: 'NO_STREAK_AVAILABLE' });
    }

    await tx.campStreakToken.update({
      where: { id: token.id },
      data: {
        status: 'used',
        usedForDayAssignmentId: dayAssignmentId,
        usedAt: new Date(),
      },
    });

    await tx.personalDayAssignment.update({
      where: { id: day.id },
      data: {
        dailyFlowComplete: true,
        prescribedCompleted: MISSIONS_SHOWN,
      },
    });

    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { journeyModelVersion: true, flowLockstepSteps: true },
    });

    let awardBatchId: string | undefined;
    let campReached: ReturnType<typeof detectCampReached> = null;

    if (user.journeyModelVersion >= 2) {
      const beforeSteps = user.flowLockstepSteps;
      const awarded = await awardLockstepStepInTransaction(
        tx,
        userId,
        FLOW_WEEK_AWARD_SOURCES.streakForgive,
      );
      awardBatchId = awarded.awardBatchId;
      campReached = detectCampReached(beforeSteps, awarded.flowLockstepSteps);
      await grantCampStreakTokensForStepAdvance(tx, userId, beforeSteps, awarded.flowLockstepSteps);
      await awardCampTreeStar(tx, userId, campReached);
    } else {
      const stepResult = await awardDailyHillStepInTransaction(
        tx,
        userId,
        day.hillId,
        FLOW_WEEK_AWARD_SOURCES.streakForgive,
      );
      if (stepResult.stepAwarded) {
        awardBatchId = stepResult.awardBatchId;
        campReached = detectCampReached(stepResult.beforeSteps, stepResult.afterSteps);
        await grantCampStreakTokensForStepAdvance(
          tx,
          userId,
          stepResult.beforeSteps,
          stepResult.afterSteps,
        );
        await awardCampTreeStar(tx, userId, campReached);
      }
    }

    return {
      campNumberSpent: token.campNumber,
      awardBatchId,
      campReached,
    };
  });

  await writeAuditLog({
    module: 'journey',
    action: 'flow_week.missed_day_resolved_with_streak',
    subjectUserId: userId,
    entityType: 'PersonalDayAssignment',
    entityId: dayAssignmentId,
    metadata: {
      campNumberSpent: result.campNumberSpent,
      awardBatchId: result.awardBatchId,
      newCampReached: result.campReached,
    },
  });

  return {
    resolved: true as const,
    campReached: result.campReached,
    campStreak: await getCampStreakStatus(userId),
  };
}
