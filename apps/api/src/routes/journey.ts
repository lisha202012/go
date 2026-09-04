import { MissionStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { ensureCategoryMissionPools } from '../lib/ensureMissionPool';
import {
  appendBlockMissionProgress,
  applyJourneyMissionProgress,
  buildBlockMissions,
  buildFocusBlockMissions,
  buildJourneyResponse,
  completeMissionAndUnlockNext,
  formatJourneyPlanPayload,
  loadJourneyContext,
  mergeHillSelection,
  parseHillSelections,
  repairCurrentMissionIfNeeded,
  startMission,
} from '../lib/journeyService';
import { MISSIONS_PER_HILL } from '../lib/journeyPlan';
import { saveAssessmentSelections } from '../lib/saveAssessmentSelections';
import { syncUserAgeGroupFromDob } from '../lib/userAgeSync';
import {
  getFocusHillMissionOptionPool,
  getHillMissionRecommendations,
  mapMissionOptions,
  applyRewardConfigToJourney,
  applyRewardsToCompletedCycleSummary,
} from '../lib/missionRecommendations';
import { getMissionRewardConfig } from '../lib/missionRewards';
import { getHillStepCounts } from '../lib/hillStepService';
import {
  getEligibleMissionAlternates,
  recordMissionSwap,
  type MissionCycleContext,
} from '../lib/missionAlternates';
import type { Response } from 'express';
import { assertLegacyJourneyAccess } from '../lib/flowWeek/legacyJourneyGuard';

function focusSelectionMatches(existing: string[], requested: string[]) {
  if (existing.length !== MISSIONS_PER_HILL || requested.length !== MISSIONS_PER_HILL) {
    return false;
  }
  const a = [...existing].sort();
  const b = [...requested].sort();
  return a.every((id, index) => id === b[index]);
}

async function respondFocusMissionSelection(
  res: Response,
  status: number,
  assessment: NonNullable<Awaited<ReturnType<typeof loadJourneyContext>>>['assessment'],
  hills: NonNullable<Awaited<ReturnType<typeof loadJourneyContext>>>['hills'],
  missions: NonNullable<Awaited<ReturnType<typeof loadJourneyContext>>>['missions'],
  progressRows: { missionId: string; status: MissionStatus }[],
  focusMissionIds: string[],
  categoryCode: string,
) {
  const focusHill = assessment.focusHill;
  const blockMissions = buildFocusBlockMissions(focusHill, missions, focusMissionIds, categoryCode);
  const hillSelections = parseHillSelections(assessment);
  const rewards = await getMissionRewardConfig();
  const journey = applyRewardConfigToJourney(
    buildJourneyResponse(assessment, hills, missions, progressRows),
    rewards,
  );
  const journeyPlan = formatJourneyPlanPayload(focusHill, hills, hillSelections, missions);

  res.status(status).json({
    activeMissions: blockMissions,
    unlockedMission: blockMissions[0],
    rewards,
    journeyPlan,
    journey,
  });
}

export const journeyRouter = Router();

journeyRouter.use(requireAuth);

journeyRouter.use(async (req, res, next) => {
  if (req.method === 'GET') return next();
  try {
    await assertLegacyJourneyAccess(req.user!.id);
    next();
  } catch (error) {
    next(error);
  }
});

const selectSchema = z.object({
  missionIds: z.array(z.string().min(1)).length(MISSIONS_PER_HILL),
});

const alternatesQuerySchema = z.object({
  hillId: z.string().min(1),
  slotMissionId: z.string().min(1),
  selectedMissionIds: z.string().min(1),
  context: z.union([z.literal('focus'), z.string().regex(/^block-\d+$/)]),
});

const swapSchema = z.object({
  hillId: z.string().min(1),
  originalMissionId: z.string().min(1),
  replacementMissionId: z.string().min(1),
  context: z.union([z.literal('focus'), z.string().regex(/^block-\d+$/)]),
});

journeyRouter.get('/me/focus-hill/options', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const assessment = await prisma.gapAssessment.findUnique({
      where: { userId },
      include: { focusHill: true },
    });

    if (!assessment) {
      throw new AppError('Complete GAP Assessment first', 404);
    }

    const { categoryCode, recommendedIds, pickCount, rewards, options } =
      await getFocusHillMissionOptionPool(userId, assessment.focusHill);

    res.json({
      focusHill: assessment.focusHill,
      categoryCode,
      pickCount,
      recommendedCount: recommendedIds.length,
      recommendedIds,
      rewards,
      options,
    });
  } catch (error) {
    next(error);
  }
});

journeyRouter.get('/me/block-selection/options', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const ctx = await loadJourneyContext(userId);
    if (!ctx) {
      throw new AppError('Complete GAP Assessment first', 404);
    }

    const { assessment, hills, missions, progressRows } = ctx;
    const hillStepCounts = await getHillStepCounts(userId);
    const journey = buildJourneyResponse(
      assessment,
      hills,
      missions,
      progressRows,
      hillStepCounts,
    );
    const pending = journey.summary.pendingBlockSelection;

    if (!pending || !journey.summary.needsBlockSelection) {
      throw new AppError('No hill block is ready for mission selection yet', 404);
    }

    const { categoryCode, recommended, pickCount, rewards } = await getHillMissionRecommendations(
      userId,
      pending.hill,
      `block-${pending.blockStartWeek}`,
    );

    res.json({
      blockStartWeek: pending.blockStartWeek,
      blockEndWeek: pending.blockEndWeek,
      hill: pending.hill,
      categoryCode,
      pickCount,
      recommendedCount: recommended.length,
      rewards,
      options: mapMissionOptions(recommended, rewards.perMission),
    });
  } catch (error) {
    next(error);
  }
});

journeyRouter.get('/me/mission-alternates', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const query = alternatesQuerySchema.parse(req.query);
    const selectedMissionIds = query.selectedMissionIds.split(',').filter(Boolean);

    const result = await getEligibleMissionAlternates(
      userId,
      query.hillId,
      query.slotMissionId,
      selectedMissionIds,
      query.context as MissionCycleContext,
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

journeyRouter.post('/me/mission-swaps', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const body = swapSchema.parse(req.body);

    const swap = await recordMissionSwap(
      userId,
      body.hillId,
      body.originalMissionId,
      body.replacementMissionId,
      body.context as MissionCycleContext,
    );

    res.status(201).json({ swap });
  } catch (error) {
    next(error);
  }
});

journeyRouter.post('/me/select-focus-missions', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { missionIds } = selectSchema.parse(req.body);

    const ctx = await loadJourneyContext(userId);
    if (!ctx) {
      throw new AppError('Complete GAP Assessment first', 404);
    }

    const uniqueIds = new Set(missionIds);
    if (uniqueIds.size !== MISSIONS_PER_HILL) {
      throw new AppError('Pick 3 different missions', 400);
    }

    if (ctx.progressRows.length > 0) {
      const hasCompleted = ctx.progressRows.some((row) => row.status === MissionStatus.completed);
      if (hasCompleted) {
        throw new AppError(
          'Your focus hill missions are already in progress and cannot be changed here.',
          409,
        );
      }

      const existingIds = ctx.assessment.focusMissionIds ?? [];
      if (focusSelectionMatches(existingIds, missionIds)) {
        await respondFocusMissionSelection(
          res,
          200,
          ctx.assessment,
          ctx.hills,
          ctx.missions,
          ctx.progressRows,
          missionIds,
          ctx.categoryCode,
        );
        return;
      }
    }

    const categoryCode = await syncUserAgeGroupFromDob(userId);
    await ensureCategoryMissionPools(categoryCode);

    const refreshed = await loadJourneyContext(userId);
    if (!refreshed) throw new AppError('Complete GAP Assessment first', 404);

    const { assessment, hills, missions } = refreshed;
    const focusHill = assessment.focusHill;

    let blockMissions;
    try {
      blockMissions = buildFocusBlockMissions(focusHill, missions, missionIds, categoryCode);
    } catch {
      throw new AppError('Invalid mission selection for your focus hill', 400);
    }

    const hillSelections = mergeHillSelection(parseHillSelections(assessment), focusHill.id, missionIds);

    await saveAssessmentSelections(userId, missionIds, hillSelections);

    await applyJourneyMissionProgress(userId, blockMissions, { replace: true });

    const progressRows = blockMissions.map((mission) => ({
      missionId: mission.id,
      status: MissionStatus.current,
    }));

    const updatedAssessment = await prisma.gapAssessment.findUniqueOrThrow({
      where: { userId },
      include: { focusHill: true, strongestHill: true },
    });

    await respondFocusMissionSelection(
      res,
      ctx.progressRows.length > 0 ? 200 : 201,
      updatedAssessment,
      hills,
      missions,
      progressRows,
      missionIds,
      categoryCode,
    );
  } catch (error) {
    next(error);
  }
});

journeyRouter.post('/me/select-block-missions', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { missionIds } = selectSchema.parse(req.body);

    const ctx = await loadJourneyContext(userId);
    if (!ctx) {
      throw new AppError('Complete GAP Assessment first', 404);
    }

    const categoryCode = await syncUserAgeGroupFromDob(userId);

    const { assessment, hills, missions, progressRows } = ctx;
    const hillStepCounts = await getHillStepCounts(userId);
    const journeyBefore = buildJourneyResponse(
      assessment,
      hills,
      missions,
      progressRows,
      hillStepCounts,
    );
    const pending = journeyBefore.summary.pendingBlockSelection;

    if (!pending || !journeyBefore.summary.needsBlockSelection) {
      throw new AppError('This hill block is not ready for mission selection yet', 409);
    }

    const uniqueIds = new Set(missionIds);
    if (uniqueIds.size !== MISSIONS_PER_HILL) {
      throw new AppError('Pick 3 different missions', 400);
    }

    let blockMissions;
    try {
      blockMissions = buildBlockMissions(pending.hill.id, missions, missionIds, categoryCode);
    } catch {
      throw new AppError('Invalid mission selection for this hill block', 400);
    }

    const existingSelections = parseHillSelections(assessment);
    const hillSelections = mergeHillSelection(existingSelections, pending.hill.id, missionIds);

    await saveAssessmentSelections(userId, assessment.focusMissionIds, hillSelections);

    await appendBlockMissionProgress(userId, blockMissions);

    const repaired = await repairCurrentMissionIfNeeded(userId);
    const finalProgress =
      repaired?.progressRows ??
      (await prisma.userMissionProgress.findMany({ where: { userId } }));
    const updatedAssessment = await prisma.gapAssessment.findUniqueOrThrow({
      where: { userId },
      include: { focusHill: true, strongestHill: true },
    });

    const rewards = await getMissionRewardConfig();
    const updatedHillStepCounts = await getHillStepCounts(userId);
    const journey = applyRewardConfigToJourney(
      buildJourneyResponse(
        updatedAssessment,
        hills,
        missions,
        finalProgress,
        updatedHillStepCounts,
      ),
      rewards,
    );

    res.status(201).json({
      activeMissions: blockMissions,
      unlockedMission: blockMissions[0],
      rewards,
      journey,
    });
  } catch (error) {
    next(error);
  }
});

journeyRouter.post('/me/missions/:missionId/start', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { missionId } = req.params;

    const result = await startMission(userId, missionId);
    const rewards = await getMissionRewardConfig();
    res.json({
      ...result,
      journey: applyRewardConfigToJourney(result.journey, rewards),
      rewards,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Mission is not current') {
      next(new AppError('Mission is not current', 400));
      return;
    }
    if (error instanceof Error && error.message === 'This mission opens next week') {
      next(new AppError('This mission opens next week', 409));
      return;
    }
    next(error);
  }
});

journeyRouter.post('/me/missions/:missionId/complete', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { missionId } = req.params;

    const result = await completeMissionAndUnlockNext(userId, missionId);
    const rewards = await getMissionRewardConfig();
    const journey = applyRewardConfigToJourney(result.journey, rewards);
    res.json({
      ...result,
      journey,
      completedCycleSummary: applyRewardsToCompletedCycleSummary(
        result.completedCycleSummary ?? journey.summary.lastCompletedCycle ?? null,
        rewards,
      ),
      campReached: result.campReached ?? null,
      rewards,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Mission is not current') {
      next(new AppError('Mission is not current', 400));
      return;
    }
    if (error instanceof Error && error.message === 'This mission opens next week') {
      next(new AppError('This mission opens next week', 409));
      return;
    }
    if (error instanceof Error && error.message === 'Mission has not been started') {
      next(new AppError('Start the mission before marking it complete', 400));
      return;
    }
    next(error);
  }
});

journeyRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    let ctx = await loadJourneyContext(userId);

    if (!ctx) {
      throw new AppError('Complete GAP Assessment first', 404);
    }

    ctx = (await repairCurrentMissionIfNeeded(userId)) ?? ctx;

    const { assessment, hills, missions, progressRows } = ctx;

    if (progressRows.length === 0) {
      const { recommended, pickCount, rewards } = await getHillMissionRecommendations(
        userId,
        assessment.focusHill,
        'focus',
      );

      res.json({
        summary: {
          totalWeeks: 21,
          missionsPerHill: MISSIONS_PER_HILL,
          totalMissions: 21,
          focusHill: assessment.focusHill,
          strongestHill: assessment.strongestHill,
          currentWeek: null,
          needsMissionSelection: true,
          needsBlockSelection: false,
          pendingBlockSelection: null,
        },
        weeks: [],
        pickCount,
        rewards,
        missionOptions: mapMissionOptions(recommended, rewards.perMission),
      });
      return;
    }

    const rewards = await getMissionRewardConfig();
    const hillStepCounts = await getHillStepCounts(userId);
    res.json(
      applyRewardConfigToJourney(
        buildJourneyResponse(assessment, hills, missions, progressRows, hillStepCounts),
        rewards,
      ),
    );
  } catch (error) {
    next(error);
  }
});
