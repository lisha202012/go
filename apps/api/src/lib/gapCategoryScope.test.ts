import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { HillCode } from '@prisma/client';
import { activeQuestionsForCategory } from './gapQuestionBank';
import { validateGapResponses } from './gapService';
import { AppError } from '../middleware/errorHandler';
import { resolveUserCategoryCode } from './missionEngine';
import {
  computeGapResult,
  GAP_HILL_CODE_ORDER,
  GAP_TOTAL_QUESTIONS,
  type GapQuestionLookup,
} from '../services/gapScoring';

function seedsToValidationQuestions(
  seeds: ReturnType<typeof activeQuestionsForCategory>,
  idPrefix: string,
) {
  return seeds.map((seed, index) => ({
    id: `${idPrefix}-q-${index + 1}`,
    isReverseScored: seed.isReverseScored,
    hillId: `hill-${seed.hillCode}`,
    hill: { code: seed.hillCode as HillCode },
  }));
}

function seedsToLookup(
  seeds: ReturnType<typeof activeQuestionsForCategory>,
  idPrefix: string,
): Map<string, GapQuestionLookup> {
  return new Map(
    seeds.map((seed, index) => [
      `${idPrefix}-q-${index + 1}`,
      {
        id: `${idPrefix}-q-${index + 1}`,
        hillId: `hill-${seed.hillCode}`,
        hillCode: seed.hillCode,
        isReverseScored: seed.isReverseScored,
      },
    ]),
  );
}

function allResponses(questionIds: string[], rawAnswer: number) {
  return questionIds.map((questionId) => ({ questionId, rawAnswer }));
}

describe('GAP category scope', () => {
  it('resolves N7 from age group and defaults unknown ages to V6', () => {
    assert.equal(resolveUserCategoryCode('N7'), 'N7');
    assert.equal(resolveUserCategoryCode('V6'), 'V6');
    assert.equal(resolveUserCategoryCode(null), 'V6');
    assert.equal(resolveUserCategoryCode('invalid'), 'V6');
  });

  it('validates submissions only against the scoped category question set', () => {
    const n7Seeds = activeQuestionsForCategory('N7');
    const v6Seeds = activeQuestionsForCategory('V6');
    const n7Questions = seedsToValidationQuestions(n7Seeds, 'N7');
    const v6Questions = seedsToValidationQuestions(v6Seeds, 'V6');

    const n7Ids = n7Questions.map((q) => q.id);
    validateGapResponses(allResponses(n7Ids, 4), n7Questions);

    assert.throws(
      () => validateGapResponses(allResponses(v6Questions.map((q) => q.id), 4), n7Questions),
      (err: unknown) => err instanceof AppError && err.message.startsWith('Unknown question'),
    );
  });

  it('scores N7 and S1E assessments independently from the same response pattern', () => {
    const n7Seeds = activeQuestionsForCategory('N7');
    const s1eSeeds = activeQuestionsForCategory('S1E');

    const n7Lookup = seedsToLookup(n7Seeds, 'N7');
    const s1eLookup = seedsToLookup(s1eSeeds, 'S1E');

    const n7Responses = [...n7Lookup.keys()].map((questionId, index) => ({
      questionId,
      rawAnswer: index % 5 === 4 ? 2 : 5,
    }));
    const s1eResponses = [...s1eLookup.keys()].map((questionId) => ({
      questionId,
      rawAnswer: 3,
    }));

    const n7Result = computeGapResult(n7Responses, n7Lookup);
    const s1eResult = computeGapResult(s1eResponses, s1eLookup);

    assert.equal(n7Result.flowIndex, 96);
    assert.equal(s1eResult.flowIndex, 60);
    assert.notEqual(n7Result.flowIndex, s1eResult.flowIndex);
    assert.equal(n7Result.focusHillId, 'hill-HOOK');
    assert.equal(s1eResult.focusHillId, 'hill-HOOK');
  });

  it('covers all seven hills in each category bank', () => {
    for (const categoryCode of ['N7', 'V6', 'S1E'] as const) {
      const seeds = activeQuestionsForCategory(categoryCode);
      assert.equal(seeds.length, GAP_TOTAL_QUESTIONS);
      const hillsPresent = new Set(seeds.map((s) => s.hillCode));
      assert.deepEqual([...hillsPresent], GAP_HILL_CODE_ORDER);
    }
  });
});

describe('GAP category scope — database', () => {
  it('loads N7 and V6 question banks independently from Postgres when seeded', async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip('DATABASE_URL not set');
      return;
    }

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      await prisma.$queryRaw`SELECT 1`;

      const { getGapQuestionsForCategory } = await import('./gapService');

      const [n7, v6] = await Promise.all([
        getGapQuestionsForCategory('N7'),
        getGapQuestionsForCategory('V6'),
      ]);

      assert.equal(n7.length, GAP_TOTAL_QUESTIONS);
      assert.equal(v6.length, GAP_TOTAL_QUESTIONS);

      const n7Ids = new Set(n7.map((q) => q.id));
      const v6Ids = new Set(v6.map((q) => q.id));

      assert.equal(n7Ids.size, GAP_TOTAL_QUESTIONS);
      assert.equal(v6Ids.size, GAP_TOTAL_QUESTIONS);

      for (const id of n7Ids) {
        assert.ok(!v6Ids.has(id), 'N7 and V6 must have distinct question row ids');
      }
    } catch (error) {
      t.skip(`Database unavailable: ${error instanceof Error ? error.message : error}`);
    } finally {
      await prisma.$disconnect();
    }
  });
});
