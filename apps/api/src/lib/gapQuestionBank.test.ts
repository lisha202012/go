import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AGE_CATEGORY_CODES } from './ageCategories';
import {
  activeQuestionsForCategory,
  loadActiveGapQuestionSeeds,
} from './gapQuestionBank';
import { GAP_HILL_CODE_ORDER, GAP_QUESTIONS_PER_HILL, GAP_TOTAL_QUESTIONS } from '../services/gapScoring';

describe('gapQuestionBank', () => {
  it('loads 315 active questions (35 × 9 categories)', () => {
    const seeds = loadActiveGapQuestionSeeds();
    assert.equal(seeds.length, 315);
    assert.equal(AGE_CATEGORY_CODES.length * GAP_TOTAL_QUESTIONS, 315);
  });

  it('returns 35 questions scoped to N7 with mission groups 1–5 per hill', () => {
    const n7 = activeQuestionsForCategory('N7');
    assert.equal(n7.length, GAP_TOTAL_QUESTIONS);

    for (const hillCode of GAP_HILL_CODE_ORDER) {
      const hillQuestions = n7.filter((q) => q.hillCode === hillCode);
      assert.equal(hillQuestions.length, GAP_QUESTIONS_PER_HILL);
      assert.deepEqual(
        hillQuestions.map((q) => q.order).sort((a, b) => a - b),
        [1, 2, 3, 4, 5],
      );
      assert.ok(hillQuestions.every((q) => q.categoryCode === 'N7'));
      assert.ok(hillQuestions.every((q) => q.missionGroup === q.order));
    }
  });

  it('keeps separate question sets per category (N7 vs V6 vs S1E)', () => {
    const n7 = activeQuestionsForCategory('N7');
    const v6 = activeQuestionsForCategory('V6');
    const s1e = activeQuestionsForCategory('S1E');

    assert.equal(n7.length, 35);
    assert.equal(v6.length, 35);
    assert.equal(s1e.length, 35);

    const key = (q: { categoryCode: string; hillCode: string; order: number }) =>
      `${q.categoryCode}|${q.hillCode}|${q.order}`;

    const n7Keys = new Set(n7.map(key));
    const v6Keys = new Set(v6.map(key));
    const s1eKeys = new Set(s1e.map(key));

    assert.equal(n7Keys.size, 35);
    for (const k of n7Keys) {
      assert.ok(k.startsWith('N7|'));
      assert.ok(!v6Keys.has(k));
      assert.ok(!s1eKeys.has(k));
    }
    for (const k of v6Keys) {
      assert.ok(k.startsWith('V6|'));
    }
  });
});
