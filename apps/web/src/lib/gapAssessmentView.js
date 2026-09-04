import { getFlowStatusLabel } from './gapAnswers';
import { GAP_QUESTIONS_PER_HILL, GAP_TOTAL_QUESTIONS } from './gapHillJourney';

export const GAP_MAX_TOTAL_RAW = GAP_TOTAL_QUESTIONS * 5;

/** Map API / Prisma GAP assessment into Growth Report view shape. */
export function normalizeGapAssessment(raw) {
  if (!raw) return null;

  const flowIndex = raw.flowIndexResult ?? raw.flowIndex ?? 0;
  const focusHill = raw.growthHill ?? raw.focusHill ?? null;
  const strongestHill = raw.strongestHill ?? null;
  const sourceScores = raw.scores ?? raw.hillScores ?? [];

  const scores = sourceScores.map((entry) => ({
    id: entry.id ?? entry.hillId,
    hillId: entry.hillId,
    hill: entry.hill,
    score: entry.score ?? entry.flowPercent ?? 0,
    flowPercent: entry.flowPercent ?? entry.score ?? 0,
    rawScore: entry.rawScore,
  }));

  return {
    ...raw,
    flowIndex,
    flowIndexResult: flowIndex,
    flowStatus: raw.flowStatus ?? getFlowStatusLabel(flowIndex),
    growthHill: focusHill,
    focusHill,
    strongestHill,
    scores,
    hillScores: scores,
    focusHillId: raw.focusHillId ?? focusHill?.id,
    strongestHillId: raw.strongestHillId ?? strongestHill?.id,
  };
}

export function isGapAssessmentReady(raw) {
  const assessment = normalizeGapAssessment(raw);
  return Boolean(assessment?.growthHill?.id && assessment?.growthHill?.code);
}
