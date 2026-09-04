import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { HillCode } from '@prisma/client';
import {
  buildGapResultFromHillRaws,
  computeFlowIndex,
  computeGapResult,
  GAP_MAX_TOTAL_RAW,
  GAP_TOTAL_QUESTIONS,
  scoreRawAnswer,
  type GapQuestionLookup,
} from './gapScoring';

describe('gapScoring', () => {
  it('reverse-scores raw answers with 6 - rawAnswer', () => {
    assert.equal(scoreRawAnswer(5, false), 5);
    assert.equal(scoreRawAnswer(4, false), 4);
    assert.equal(scoreRawAnswer(5, true), 1);
    assert.equal(scoreRawAnswer(4, true), 2);
    assert.equal(scoreRawAnswer(3, true), 3);
  });

  it('uses proportional scaling denominators (35 questions, 175 max raw)', () => {
    assert.equal(GAP_TOTAL_QUESTIONS, 35);
    assert.equal(GAP_MAX_TOTAL_RAW, 175);
  });

  it('uses the lowest hill score and preserves tie-breaks (5 questions per hill)', () => {
    const hillCodes: HillCode[] = ['HOPE', 'HONE', 'HOLD', 'HOOD', 'HOST', 'HORN', 'HOOK'];
    const rawByCode: Record<HillCode, number> = {
      HOPE: 21,
      HONE: 14,
      HOLD: 19,
      HOOD: 17,
      HOST: 21,
      HORN: 20,
      HOOK: 13,
    };

    const hillRaws = hillCodes.map((hillCode) => ({
      hillId: `hill-${hillCode}`,
      hillCode,
      rawScore: rawByCode[hillCode],
    }));

    const result = buildGapResultFromHillRaws(hillRaws);

    assert.equal(result.totalRawScore, 125);
    assert.equal(result.flowIndex, 52);
    assert.equal(result.strongestHillId, 'hill-HOPE');
    assert.equal(result.focusHillId, 'hill-HOOK');
    assert.equal(computeFlowIndex(hillRaws), 52);
  });

  it('all Often answers do not produce a perfect 100% score when reverse items exist', () => {
    const questions = new Map<string, GapQuestionLookup>();
    const hillCodes: HillCode[] = ['HOPE', 'HONE', 'HOLD', 'HOOD', 'HOST', 'HORN', 'HOOK'];

    for (let i = 0; i < GAP_TOTAL_QUESTIONS; i += 1) {
      const hillIndex = Math.floor(i / 5);
      const hillCode = hillCodes[hillIndex]!;
      const orderInHill = (i % 5) + 1;
      const isReverseScored = orderInHill === 5;
      questions.set(`q-${i + 1}`, {
        id: `q-${i + 1}`,
        hillId: `hill-${hillCode}`,
        hillCode,
        isReverseScored,
      });
    }

    const responses = [...questions.keys()].map((questionId) => ({
      questionId,
      rawAnswer: 4,
    }));

    const result = computeGapResult(responses, questions);
    assert.equal(result.flowIndex, 72);
    assert.notEqual(result.flowIndex, 100);
  });
});
