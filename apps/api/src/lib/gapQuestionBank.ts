/**
 * Loads active GAP questions (orders 1–5 per hill) from gap-945.json.
 *
 * CONTENT WARNING: question text should be generated via
 * scripts/generate-gap-from-missions.mjs (missions-945.json as source of truth).
 * Until meta.contentStatus is "approved", copy is dev-placeholder.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HillCode } from '@prisma/client';
import { AGE_CATEGORY_CODES, type AgeCategoryCode } from './ageCategories';
import {
  GAP_HILL_CODE_ORDER,
  GAP_QUESTIONS_PER_HILL,
  GAP_TOTAL_QUESTIONS,
} from '../services/gapScoring';

export type GapQuestionSeed = {
  categoryCode: AgeCategoryCode;
  hillCode: HillCode;
  order: number;
  missionGroup: number;
  text: string;
  isReverseScored: boolean;
};

type Gap945File = {
  questions: Array<{
    categoryCode: string;
    hillCode: HillCode;
    order: number;
    text: string;
    isReverseScored: boolean;
  }>;
};

/** Active GAP instrument: 5 questions per hill (orders 1–5 = mission groups 1–5) × 7 hills × 9 categories. */
export function loadActiveGapQuestionSeeds(): GapQuestionSeed[] {
  const filePath = join(__dirname, '../../data/gap-945.json');
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Gap945File;

  const seeds: GapQuestionSeed[] = [];

  for (const question of parsed.questions) {
    if (question.order > GAP_QUESTIONS_PER_HILL) continue;
    if (!(AGE_CATEGORY_CODES as readonly string[]).includes(question.categoryCode)) continue;

    seeds.push({
      categoryCode: question.categoryCode as AgeCategoryCode,
      hillCode: question.hillCode,
      order: question.order,
      missionGroup: question.order,
      text: question.text,
      isReverseScored: question.isReverseScored,
    });
  }

  seeds.sort((a, b) => {
    if (a.categoryCode !== b.categoryCode) {
      return AGE_CATEGORY_CODES.indexOf(a.categoryCode) - AGE_CATEGORY_CODES.indexOf(b.categoryCode);
    }
    const hillDiff =
      GAP_HILL_CODE_ORDER.indexOf(a.hillCode) - GAP_HILL_CODE_ORDER.indexOf(b.hillCode);
    if (hillDiff !== 0) return hillDiff;
    return a.order - b.order;
  });

  const expectedTotal = AGE_CATEGORY_CODES.length * GAP_HILL_CODE_ORDER.length * GAP_QUESTIONS_PER_HILL;
  if (seeds.length !== expectedTotal) {
    throw new Error(
      `Expected ${expectedTotal} active GAP question seeds but found ${seeds.length} in gap-945.json`,
    );
  }

  return seeds;
}

export function activeQuestionsForCategory(categoryCode: AgeCategoryCode): GapQuestionSeed[] {
  return loadActiveGapQuestionSeeds().filter((q) => q.categoryCode === categoryCode);
}

export function expectedGapQuestionCount(): number {
  return GAP_TOTAL_QUESTIONS;
}
