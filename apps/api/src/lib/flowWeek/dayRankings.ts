import type { HillCode } from '@prisma/client';
import { HILL_CODE_ORDER } from '../hillDomains';

export type HillRawScore = {
  hillId: string;
  hillCode: HillCode;
  rawScore: number;
};

/**
 * Rank hills Day1 (lowest score) → Day7 (highest).
 * Tie-break: hill later in HILL_CODE_ORDER gets the earlier day number.
 */
export function rankHillsByGapScore(hillRaws: HillRawScore[]): string[] {
  const sorted = [...hillRaws].sort((a, b) => {
    if (a.rawScore !== b.rawScore) return a.rawScore - b.rawScore;
    return HILL_CODE_ORDER.indexOf(b.hillCode) - HILL_CODE_ORDER.indexOf(a.hillCode);
  });
  return sorted.map((h) => h.hillId);
}

export function rankingsLockedUntil(completedAt: Date): Date {
  const locked = new Date(completedAt);
  locked.setDate(locked.getDate() + 90);
  return locked;
}
