import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';
import { getHillMissionRecommendations, mapMissionOptions } from './missionRecommendations';
import { resolveUserCategoryCode } from './missionEngine';
import { syncUserAgeGroupFromDob } from './userAgeSync';
import { HILL_CODE_ORDER } from './hillDomains';
import { loadActiveGapQuestionSeeds } from './gapQuestionBank';
import { assertGapContentReadyForClient } from './gapContentGuard';
import { assertGapMappingValid } from './gapMappingGuard';
import {
  computeGapResult,
  GAP_TOTAL_QUESTIONS,
  scoreRawAnswer,
  type GapQuestionLookup,
} from '../services/gapScoring';
import { DEFAULT_GOFAM_WEEK_START_DAY } from './flowWeek/types';
import { awardGapTreeStars } from './treeStarService';

const RECALIBRATION_DAYS = 90;

function sortGapQuestions<T extends { order: number; hill: { code: string } }>(questions: T[]): T[] {
  return [...questions].sort((a, b) => {
    const hillDiff =
      HILL_CODE_ORDER.indexOf(a.hill.code as (typeof HILL_CODE_ORDER)[number]) -
      HILL_CODE_ORDER.indexOf(b.hill.code as (typeof HILL_CODE_ORDER)[number]);
    if (hillDiff !== 0) return hillDiff;
    return a.order - b.order;
  });
}

async function resolveCategoryCodeForUser(userId: string) {
  return syncUserAgeGroupFromDob(userId, { requireDob: true });
}

export async function getGapQuestionsForCategory(categoryCode: ReturnType<typeof resolveUserCategoryCode>) {
  const questions = sortGapQuestions(
    await prisma.gapQuestion.findMany({
      where: { categoryCode },
      select: {
        id: true,
        order: true,
        hillId: true,
        missionGroup: true,
        text: true,
        hill: { select: { code: true } },
      },
    }),
  );

  if (questions.length !== GAP_TOTAL_QUESTIONS) {
    throw new AppError(
      `GAP question bank for ${categoryCode} has ${questions.length} questions but needs ${GAP_TOTAL_QUESTIONS} — run: cd apps/api && npx tsx scripts/seed-gap-questions.ts`,
      503,
    );
  }

  return questions;
}

export async function getGapQuestions(userId: string) {
  const categoryCode = await resolveCategoryCodeForUser(userId);
  return getGapQuestionsForCategory(categoryCode);
}

type SubmitResponse = { questionId: string; rawAnswer: number };

type GapQuestionForValidation = {
  id: string;
  isReverseScored: boolean;
  hillId: string;
  hill: { code: string };
};

/** Validates a full GAP submission against a scoped question set (e.g. one category). */
export function validateGapResponses(
  responses: SubmitResponse[],
  questions: GapQuestionForValidation[],
): void {
  if (responses.length !== GAP_TOTAL_QUESTIONS) {
    throw new AppError(`Expected ${GAP_TOTAL_QUESTIONS} responses`, 400);
  }

  if (questions.length !== GAP_TOTAL_QUESTIONS) {
    throw new AppError(
      `GAP question bank has ${questions.length} questions but needs ${GAP_TOTAL_QUESTIONS}`,
      503,
    );
  }

  const questionById = new Map(questions.map((q) => [q.id, q]));
  const seenQuestionIds = new Set<string>();

  for (const response of responses) {
    if (response.rawAnswer < 1 || response.rawAnswer > 5) {
      throw new AppError('Each rawAnswer must be between 1 and 5', 400);
    }
    if (!questionById.has(response.questionId)) {
      throw new AppError(`Unknown question ${response.questionId}`, 400);
    }
    if (seenQuestionIds.has(response.questionId)) {
      throw new AppError('Duplicate response for the same question', 400);
    }
    seenQuestionIds.add(response.questionId);
  }

  if (seenQuestionIds.size !== GAP_TOTAL_QUESTIONS) {
    throw new AppError('Must answer every question exactly once', 400);
  }
}

export async function submitGapAssessment(userId: string, responses: SubmitResponse[]) {
  const existing = await prisma.gapAssessment.findUnique({ where: { userId } });
  if (existing) {
    throw new AppError('Gap assessment already completed', 409);
  }

  const categoryCode = await resolveCategoryCodeForUser(userId);

  const questions = sortGapQuestions(
    await prisma.gapQuestion.findMany({
      where: { categoryCode },
      include: { hill: true },
    }),
  );

  validateGapResponses(responses, questions);

  const lookup = new Map<string, GapQuestionLookup>(
    questions.map((q) => [
      q.id,
      {
        id: q.id,
        hillId: q.hillId,
        hillCode: q.hill.code,
        isReverseScored: q.isReverseScored,
      },
    ]),
  );

  const result = computeGapResult(responses, lookup);
  const completedAt = new Date();
  const nextRecalibrationAt = new Date(completedAt);
  nextRecalibrationAt.setDate(nextRecalibrationAt.getDate() + RECALIBRATION_DAYS);

  const hills = await prisma.hill.findMany();
  const hillById = new Map(hills.map((h) => [h.id, h]));
  const focusHill = hillById.get(result.focusHillId);
  const strongestHill = hillById.get(result.strongestHillId);

  if (!focusHill || !strongestHill) {
    throw new AppError('Hills are not seeded correctly', 500);
  }

  const { recommended: focusHillMissions } = await getHillMissionRecommendations(
    userId,
    focusHill,
    'focus',
  );

  if (focusHillMissions.length < 3) {
    throw new AppError(
      `Expected 3 recommended missions on focus hill — run db seed`,
      500,
    );
  }

  const questionById = new Map(questions.map((q) => [q.id, q]));
  const responseRows = responses.map((response) => {
    const question = questionById.get(response.questionId)!;
    return {
      questionId: response.questionId,
      rawAnswer: response.rawAnswer,
      scoredValue: scoreRawAnswer(response.rawAnswer, question.isReverseScored),
    };
  });

  const assessment = await prisma.$transaction(async (tx) => {
    const created = await tx.gapAssessment.create({
      data: {
        userId,
        flowIndex: result.flowIndex,
        totalRawScore: result.totalRawScore,
        strongestHillId: result.strongestHillId,
        focusHillId: result.focusHillId,
        isOfficial: true,
        completedAt,
        nextRecalibrationAt,
        hillScores: {
          create: result.hillScores.map(({ hillId, rawScore, flowPercent }) => ({
            hillId,
            rawScore,
            flowPercent,
          })),
        },
        responses: {
          create: responseRows,
        },
      },
      include: {
        hillScores: { include: { hill: true } },
        strongestHill: true,
        focusHill: true,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        flowIndex: result.flowIndex,
        onboardingCompleted: true,
        gofamWeekStartDay: DEFAULT_GOFAM_WEEK_START_DAY,
      },
    });

    await awardGapTreeStars(tx, userId, {
      id: created.id,
      flowIndex: created.flowIndex,
      isOfficial: created.isOfficial,
    });

    return created;
  });

  return { assessment, focusHillMissions };
}

/** Seed helper — upserts all 315 active GAP questions from gap-945.json. */
export async function seedGapQuestions() {
  assertGapContentReadyForClient();
  assertGapMappingValid();

  const hills = await prisma.hill.findMany();
  const hillIdByCode = new Map(hills.map((h) => [h.code, h.id]));

  if (hillIdByCode.size === 0) {
    throw new Error('No hills found — run full db seed first');
  }

  const seeds = loadActiveGapQuestionSeeds();

  for (const question of seeds) {
    const hillId = hillIdByCode.get(question.hillCode);
    if (!hillId) {
      throw new Error(`Missing hill ${question.hillCode} for GAP question ${question.categoryCode}#${question.order}`);
    }

    await prisma.gapQuestion.upsert({
      where: {
        categoryCode_hillId_order: {
          categoryCode: question.categoryCode,
          hillId,
          order: question.order,
        },
      },
      update: {
        missionGroup: question.missionGroup,
        text: question.text,
        isReverseScored: question.isReverseScored,
      },
      create: {
        categoryCode: question.categoryCode,
        hillId,
        order: question.order,
        missionGroup: question.missionGroup,
        text: question.text,
        isReverseScored: question.isReverseScored,
      },
    });
  }

  return seeds.length;
}
