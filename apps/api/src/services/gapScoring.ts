import type { HillCode } from '@prisma/client';
import { HILL_CODE_ORDER } from '../lib/hillDomains';

export const GAP_QUESTIONS_PER_HILL = 5;
export const GAP_TOTAL_QUESTIONS = 35;
export const GAP_MAX_HILL_RAW = GAP_QUESTIONS_PER_HILL * 5;
export const GAP_MAX_TOTAL_RAW = GAP_TOTAL_QUESTIONS * 5;

/** Fixed hill order for GAP journey and scoring tie-breaks. */
export const GAP_HILL_CODE_ORDER: HillCode[] = [
  'HOPE',
  'HONE',
  'HOLD',
  'HOOD',
  'HOST',
  'HORN',
  'HOOK',
];

export type GapQuestionLookup = {
  id: string;
  hillId: string;
  hillCode: HillCode;
  isReverseScored: boolean;
};

export type GapResponseInput = {
  questionId: string;
  rawAnswer: number;
};

export type ScoredGapResponse = GapResponseInput & {
  hillId: string;
  scoredValue: number;
};

export type GapHillScoreResult = {
  hillId: string;
  rawScore: number;
  flowPercent: number;
};

export type GapResult = {
  totalRawScore: number;
  flowIndex: number;
  hillScores: GapHillScoreResult[];
  strongestHillId: string;
  focusHillId: string;
};

export function scoreRawAnswer(rawAnswer: number, isReverseScored: boolean): number {
  if (rawAnswer < 1 || rawAnswer > 5) {
    throw new Error(`rawAnswer must be 1-5, got ${rawAnswer}`);
  }
  return isReverseScored ? 6 - rawAnswer : rawAnswer;
}

export function rawToFlowPercent(rawScore: number): number {
  return Math.round((rawScore / GAP_MAX_HILL_RAW) * 100);
}

export function computeFlowIndex(hillRaws: { rawScore: number }[]): number {
  if (hillRaws.length === 0) return 0;
  const lowestHillRaw = Math.min(...hillRaws.map((hill) => hill.rawScore));
  return rawToFlowPercent(lowestHillRaw);
}

function pickStrongestHillId(
  hillRaws: { hillId: string; hillCode: HillCode; rawScore: number }[],
): string {
  const sorted = [...hillRaws].sort((a, b) => {
    if (b.rawScore !== a.rawScore) return b.rawScore - a.rawScore;
    return HILL_CODE_ORDER.indexOf(a.hillCode) - HILL_CODE_ORDER.indexOf(b.hillCode);
  });
  return sorted[0]!.hillId;
}

function pickFocusHillId(
  hillRaws: { hillId: string; hillCode: HillCode; rawScore: number }[],
): string {
  const sorted = [...hillRaws].sort((a, b) => {
    if (a.rawScore !== b.rawScore) return a.rawScore - b.rawScore;
    return HILL_CODE_ORDER.indexOf(b.hillCode) - HILL_CODE_ORDER.indexOf(a.hillCode);
  });
  return sorted[0]!.hillId;
}

export function buildGapResultFromHillRaws(
  hillRaws: { hillId: string; hillCode: HillCode; rawScore: number }[],
): GapResult {
  const totalRawScore = hillRaws.reduce((sum, h) => sum + h.rawScore, 0);
  const hillScores = hillRaws.map(({ hillId, rawScore }) => ({
    hillId,
    rawScore,
    flowPercent: rawToFlowPercent(rawScore),
  }));

  return {
    totalRawScore,
    flowIndex: computeFlowIndex(hillRaws),
    hillScores,
    strongestHillId: pickStrongestHillId(hillRaws),
    focusHillId: pickFocusHillId(hillRaws),
  };
}

export function computeGapResult(
  responses: GapResponseInput[],
  questionsById: Map<string, GapQuestionLookup>,
): GapResult {
  const scoredByHill = new Map<string, { hillCode: HillCode; total: number }>();

  for (const response of responses) {
    const question = questionsById.get(response.questionId);
    if (!question) {
      throw new Error(`Unknown question ${response.questionId}`);
    }

    const scoredValue = scoreRawAnswer(response.rawAnswer, question.isReverseScored);
    const existing = scoredByHill.get(question.hillId);
    if (existing) {
      existing.total += scoredValue;
    } else {
      scoredByHill.set(question.hillId, { hillCode: question.hillCode, total: scoredValue });
    }
  }

  const hillRaws = [...scoredByHill.entries()].map(([hillId, { hillCode, total }]) => ({
    hillId,
    hillCode,
    rawScore: total,
  }));

  return buildGapResultFromHillRaws(hillRaws);
}

export function getFlowStatus(flowIndex: number): string {
  if (flowIndex <= 40) return 'Needs Attention';
  if (flowIndex <= 55) return 'Emerging FLOW';
  if (flowIndex <= 70) return 'Growing FLOW';
  if (flowIndex <= 85) return 'Strong FLOW';
  return 'Superb FLOW';
}

export function getHillStrengthLabel(flowPercent: number): string {
  if (flowPercent < 40) return 'Emerging';
  if (flowPercent < 60) return 'Developing';
  if (flowPercent < 80) return 'Strong';
  return 'Strongest';
}
