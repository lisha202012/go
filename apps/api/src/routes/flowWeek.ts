import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getFlowWeekForUser, getWeeklyChakraStats } from '../lib/flowWeek/flowWeekService';
import {
  completeFlowWeekMission,
  startFlowWeekMission,
} from '../lib/flowWeek/flowWeekMissions';
import {
  getBlockingMissedDay,
  getCampStreakStatus,
  listCampStreakTokenDetails,
  listUnresolvedMissedDays,
  resolveMissedDayWithStreak,
} from '../lib/flowWeek/campStreakService';
import {
  confirmDayMissionPick,
  confirmTodayMissionPick,
  getDayMissionPickOptions,
  getTodayMissionPickOptions,
} from '../lib/flowWeek/flowWeekDailyPick';
import { getTodayOptionalMissions } from '../lib/flowWeek/flowWeekOptionalMissions';
import { rankHillsByGapScore } from '../lib/flowWeek/dayRankings';
import { getDayMissionPreview } from '../lib/missionRecommendations';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';

export const flowWeekRouter = Router();

flowWeekRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const payload = await getFlowWeekForUser(req.user!.id);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

flowWeekRouter.get('/streak', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const [campStreak, tokens, missedDays, blockingMissedDay] = await Promise.all([
      getCampStreakStatus(userId),
      listCampStreakTokenDetails(userId),
      listUnresolvedMissedDays(userId),
      getBlockingMissedDay(userId),
    ]);
    res.json({ campStreak, tokens, missedDays, blockingMissedDay });
  } catch (error) {
    next(error);
  }
});

flowWeekRouter.post(
  '/missed-days/:dayAssignmentId/resolve-with-streak',
  requireAuth,
  async (req, res, next) => {
    try {
      const result = await resolveMissedDayWithStreak(req.user!.id, req.params.dayAssignmentId);
      const flowWeek = await getFlowWeekForUser(req.user!.id);
      res.json({ ...result, flowWeek });
    } catch (error) {
      next(error);
    }
  },
);

flowWeekRouter.get('/chakras', requireAuth, async (req, res, next) => {
  try {
    const payload = await getWeeklyChakraStats(req.user!.id);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

flowWeekRouter.get('/days/:dayIndex/mission-options', requireAuth, async (req, res, next) => {
  try {
    const dayIndex = z.coerce.number().int().min(1).max(21).parse(req.params.dayIndex);
    const payload = await getDayMissionPickOptions(req.user!.id, dayIndex);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

flowWeekRouter.post('/days/:dayIndex/confirm-missions', requireAuth, async (req, res, next) => {
  try {
    const dayIndex = z.coerce.number().int().min(1).max(21).parse(req.params.dayIndex);
    const { missionIds } = z.object({ missionIds: z.array(z.string()).length(3) }).parse(req.body);
    const result = await confirmDayMissionPick(req.user!.id, dayIndex, missionIds);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

flowWeekRouter.get('/days/:dayIndex/mission-preview', requireAuth, async (req, res, next) => {
  try {
    const dayIndex = z.coerce.number().int().min(1).max(21).parse(req.params.dayIndex);
    const userId = req.user!.id;

    const assessment = await prisma.gapAssessment.findUnique({
      where: { userId },
      include: { hillScores: { include: { hill: true } } },
    });
    if (!assessment) {
      throw new AppError('Complete GAP Assessment first', 400);
    }

    const dayRankings =
      assessment.dayRankings.length > 0
        ? assessment.dayRankings
        : rankHillsByGapScore(
            assessment.hillScores.map((s) => ({
              hillId: s.hillId,
              hillCode: s.hill.code,
              rawScore: s.rawScore,
            })),
          );

    const hillId = dayRankings[dayIndex - 1];
    if (!hillId) {
      throw new AppError('Invalid day index', 400);
    }

    const hill = await prisma.hill.findUniqueOrThrow({ where: { id: hillId } });
    const payload = await getDayMissionPreview(userId, dayIndex, hill);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

flowWeekRouter.get('/today/mission-options', requireAuth, async (req, res, next) => {
  try {
    const payload = await getTodayMissionPickOptions(req.user!.id);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

flowWeekRouter.get('/today/optional-missions', requireAuth, async (req, res, next) => {
  try {
    const payload = await getTodayOptionalMissions(req.user!.id);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

flowWeekRouter.post('/today/confirm-missions', requireAuth, async (req, res, next) => {
  try {
    const { missionIds } = z.object({ missionIds: z.array(z.string()).length(3) }).parse(req.body);
    const result = await confirmTodayMissionPick(req.user!.id, missionIds);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

flowWeekRouter.post('/missions/:missionId/start', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({ dayAssignmentId: z.string().optional() }).parse(req.body ?? {});
    const result = await startFlowWeekMission(
      req.user!.id,
      req.params.missionId,
      body.dayAssignmentId,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

flowWeekRouter.post('/missions/:missionId/complete', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({ dayAssignmentId: z.string().optional() }).parse(req.body ?? {});
    const result = await completeFlowWeekMission(
      req.user!.id,
      req.params.missionId,
      body.dayAssignmentId,
    );
    // Home Hill needs an updated today payload (slots / chakra). Other Hills only
    // needs wallet + celebration fields already on `result`.
    let flowWeek = null;
    if (result.isTodayHomeHill) {
      flowWeek = await getFlowWeekForUser(req.user!.id);
    }
    res.json({ ...result, flowWeek });
  } catch (error) {
    next(error);
  }
});
