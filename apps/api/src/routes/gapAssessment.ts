import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { getAdminConfigNumber } from '../lib/adminConfig';
import { grantWelcomeBonus, hasWelcomeBonus } from '../lib/coins';
import { mapMissionOptions } from '../lib/missionRecommendations';
import { getMissionRewardConfig } from '../lib/missionRewards';
import { withEffectiveOnboardingStatus } from '../lib/onboardingStatus';
import { getGapQuestions, submitGapAssessment } from '../lib/gapService';
import { tryBootstrapFlowWeekForUser } from '../lib/flowWeek/flowWeekService';
import { GAP_TOTAL_QUESTIONS } from '../services/gapScoring';

export const gapAssessmentRouter = Router();

const submitSchema = z.object({
  responses: z
    .array(
      z.object({
        questionId: z.string().min(1),
        rawAnswer: z.number().int().min(1).max(5),
      }),
    )
    .length(GAP_TOTAL_QUESTIONS),
});

gapAssessmentRouter.get('/questions', requireAuth, async (req, res, next) => {
  try {
    const questions = await getGapQuestions(req.user!.id);
    res.json({ questions });
  } catch (error) {
    next(error);
  }
});

gapAssessmentRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const body = submitSchema.parse(req.body);

    const priorProgressCount = await prisma.userMissionProgress.count({
      where: { userId },
    });
    const isFirstMissionEver = priorProgressCount === 0;

    const { assessment, focusHillMissions } = await submitGapAssessment(userId, body.responses);

    const userBeforeBootstrap = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (userBeforeBootstrap.journeyModelVersion < 2) {
      await tryBootstrapFlowWeekForUser(userId);
    }

    let welcomeBonusGranted = false;
    if (isFirstMissionEver && !(await hasWelcomeBonus(userId))) {
      const bonus = await getAdminConfigNumber('welcome_bonus', 100);
      welcomeBonusGranted = await grantWelcomeBonus(userId, bonus, assessment.id);
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const publicUser = await withEffectiveOnboardingStatus(user);
    const rewards = await getMissionRewardConfig();
    const isFlowWeek = user.journeyModelVersion >= 2;

    res.status(201).json({
      flowIndex: assessment.flowIndex,
      totalRawScore: assessment.totalRawScore,
      strongestHill: assessment.strongestHill,
      focusHill: assessment.focusHill,
      hillScores: assessment.hillScores.map((score) => ({
        hillId: score.hillId,
        hill: score.hill,
        rawScore: score.rawScore,
        flowPercent: score.flowPercent,
      })),
      assessment,
      unlockedMission: null,
      needsMissionSelection: isFlowWeek ? false : true,
      rewards,
      missionOptions: isFlowWeek ? [] : mapMissionOptions(focusHillMissions, rewards.perMission),
      journeyPlan: null,
      welcomeBonusGranted,
      user: publicUser,
    });
  } catch (error) {
    next(error);
  }
});

gapAssessmentRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const assessment = await prisma.gapAssessment.findUnique({
      where: { userId: req.user!.id },
      include: {
        hillScores: { include: { hill: true }, orderBy: { flowPercent: 'desc' } },
        strongestHill: true,
        focusHill: true,
      },
    });

    if (!assessment) {
      throw new AppError('No gap assessment found', 404);
    }

    res.json({ assessment });
  } catch (error) {
    next(error);
  }
});
