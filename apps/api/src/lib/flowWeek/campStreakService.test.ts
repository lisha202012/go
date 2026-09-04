import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../middleware/errorHandler';
import { CAMP_CHECKPOINTS } from '../hillProgress';
import {
  shouldAllowMissionOnDay,
  campCheckpointsCrossed,
  grantCampStreakTokenIfNewCamp,
  getCampStreakStatus,
  getBlockingMissedDay,
  assertNoBlockingMissedDay,
  resolveMissedDayWithStreak,
} from './campStreakService';
import { CHALLENGE_DISABLE_MISSED_DAY_BLOCK } from './types';

describe('campStreak — missed-day block', () => {
  it('allows any day when nothing is blocking', () => {
    assert.equal(shouldAllowMissionOnDay(null, 'day-2'), true);
  });

  it('allows completing the blocking missed day itself', () => {
    assert.equal(shouldAllowMissionOnDay({ dayAssignmentId: 'day-1' }, 'day-1'), true);
  });

  it('blocks a later day while a missed day is unresolved', () => {
    assert.equal(shouldAllowMissionOnDay({ dayAssignmentId: 'day-1' }, 'day-2'), false);
  });
});

describe('campStreak — camp checkpoints', () => {
  it('has 7 unique camp numbers at steps 1/3/7/14/21/35/49', () => {
    const numbers = CAMP_CHECKPOINTS.map((c) => c.number);
    const thresholds = CAMP_CHECKPOINTS.map((c) => c.stepThreshold);
    assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(thresholds, [1, 3, 7, 14, 21, 35, 49]);
    assert.equal(new Set(numbers).size, 7);
  });

  it('detects a new camp exactly when crossing each threshold', () => {
    for (const camp of CAMP_CHECKPOINTS) {
      const crossed = campCheckpointsCrossed(camp.stepThreshold - 1, camp.stepThreshold);
      assert.equal(crossed.length, 1);
      assert.equal(crossed[0].number, camp.number);
      assert.equal(campCheckpointsCrossed(camp.stepThreshold, camp.stepThreshold).length, 0);
    }
  });
});

describe('campStreak — database', () => {
  it('grants one token per camp and never duplicates, blocks later days, and resolves with a streak', async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip('DATABASE_URL not set');
      return;
    }

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    let userId = '';
    let otherUserId = '';
    let dayAssignmentId = '';
    let laterDayId = '';
    let assessmentId = '';

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      await prisma.$disconnect();
      t.skip('Database unavailable');
      return;
    }

    try {
      const hills = await prisma.hill.findMany({ take: 7 });
      if (hills.length < 7) {
        t.skip('Hills not seeded');
        return;
      }

      const user = await prisma.user.create({
        data: {
          username: `streak_${suffix}`,
          email: `streak_${suffix}@test.local`,
          passwordHash: 'x',
          journeyModelVersion: 2,
          onboardingCompleted: true,
        },
      });
      userId = user.id;

      const other = await prisma.user.create({
        data: {
          username: `streak_o_${suffix}`,
          email: `streak_o_${suffix}@test.local`,
          passwordHash: 'x',
        },
      });
      otherUserId = other.id;

      await prisma.$transaction(async (tx) => {
        for (const camp of CAMP_CHECKPOINTS) {
          await grantCampStreakTokenIfNewCamp(tx, userId, camp);
          await grantCampStreakTokenIfNewCamp(tx, userId, camp);
        }
      });

      const afterGrant = await getCampStreakStatus(userId);
      assert.equal(afterGrant.tokensEarned, 7);
      assert.equal(afterGrant.tokensAvailable, 7);
      assert.equal(afterGrant.tokensUsed, 0);

      const assessment = await prisma.gapAssessment.create({
        data: {
          userId,
          flowIndex: 50,
          totalRawScore: 80,
          strongestHillId: hills[6].id,
          focusHillId: hills[0].id,
          nextRecalibrationAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      });
      assessmentId = assessment.id;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const schedule = await prisma.personalWeekSchedule.create({
        data: {
          userId,
          assessmentId,
          personalWeekStart: yesterday,
          days: {
            create: [
              {
                dayIndex: 1,
                calendarDate: yesterday,
                hillId: hills[0].id,
                dailyFlowComplete: false,
                prescribedCompleted: 0,
              },
              {
                dayIndex: 2,
                calendarDate: today,
                hillId: hills[1].id,
                dailyFlowComplete: false,
                prescribedCompleted: 0,
              },
            ],
          },
        },
        include: { days: { orderBy: { dayIndex: 'asc' } } },
      });
      dayAssignmentId = schedule.days[0].id;
      laterDayId = schedule.days[1].id;

      if (!CHALLENGE_DISABLE_MISSED_DAY_BLOCK) {
        await assert.rejects(
          () => assertNoBlockingMissedDay(userId, laterDayId),
          (err: unknown) => {
            assert.ok(err instanceof AppError);
            assert.equal(err.statusCode, 409);
            assert.equal((err.details as { code?: string })?.code, 'MISSED_DAY_BLOCKING');
            return true;
          },
        );
      } else {
        await assertNoBlockingMissedDay(userId, laterDayId);
      }
      await assertNoBlockingMissedDay(userId, dayAssignmentId);

      const blocking = await getBlockingMissedDay(userId);
      if (!CHALLENGE_DISABLE_MISSED_DAY_BLOCK) {
        assert.equal(blocking?.dayAssignmentId, dayAssignmentId);
      } else {
        assert.equal(blocking, null);
      }

      const resolved = await resolveMissedDayWithStreak(userId, dayAssignmentId);
      assert.equal(resolved.resolved, true);
      assert.equal(resolved.campStreak.tokensAvailable, 6);
      assert.equal(resolved.campStreak.tokensUsed, 1);

      const day = await prisma.personalDayAssignment.findUniqueOrThrow({
        where: { id: dayAssignmentId },
      });
      assert.equal(day.dailyFlowComplete, true);
      assert.equal(day.prescribedCompleted, 3);

      await assert.rejects(
        () => resolveMissedDayWithStreak(userId, dayAssignmentId),
        (err: unknown) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 400);
          return true;
        },
      );

      await assert.rejects(
        () => resolveMissedDayWithStreak(otherUserId, dayAssignmentId),
        (err: unknown) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 404);
          return true;
        },
      );

      await prisma.campStreakToken.updateMany({
        where: { userId, status: 'available' },
        data: { status: 'used', usedAt: new Date() },
      });

      const extraDay = await prisma.personalDayAssignment.create({
        data: {
          scheduleId: schedule.id,
          dayIndex: 3,
          calendarDate: new Date(yesterday.getTime() - 24 * 60 * 60 * 1000),
          hillId: hills[2].id,
          dailyFlowComplete: false,
        },
      });

      await assert.rejects(
        () => resolveMissedDayWithStreak(userId, extraDay.id),
        (err: unknown) => {
          assert.ok(err instanceof AppError);
          assert.equal((err.details as { code?: string })?.code, 'NO_STREAK_AVAILABLE');
          return true;
        },
      );
    } finally {
      if (userId) {
        await prisma.growthSet.deleteMany({ where: { userId } });
        await prisma.personalWeekSchedule.deleteMany({ where: { userId } });
        if (assessmentId) await prisma.gapAssessment.deleteMany({ where: { id: assessmentId } });
        await prisma.campStreakToken.deleteMany({ where: { userId: { in: [userId, otherUserId].filter(Boolean) } } });
        await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId].filter(Boolean) } } });
      }
      await prisma.$disconnect();
    }
  });
});
