import type { GapAssessment } from '@prisma/client';
import { MISSIONS_PER_HILL } from './journeyPlan';

/** Latest block picks per hill — may be a single block or history of blocks. */
export type HillMissionSelections = Record<string, string[] | string[][]>;

export function getHillBlockSelections(
  selections: HillMissionSelections,
  hillId: string,
): string[][] {
  const raw = selections[hillId];
  if (!raw?.length) return [];
  if (typeof raw[0] === 'string') return [raw as string[]];
  return raw as string[][];
}

export function parseHillSelections(assessment: GapAssessment): HillMissionSelections {
  const stored =
    assessment.hillMissionSelections && typeof assessment.hillMissionSelections === 'object'
      ? (assessment.hillMissionSelections as HillMissionSelections)
      : {};

  const result: HillMissionSelections = { ...stored };

  if (
    assessment.focusMissionIds.length === MISSIONS_PER_HILL &&
    assessment.focusHillId &&
    getHillBlockSelections(result, assessment.focusHillId).length === 0
  ) {
    result[assessment.focusHillId] = [...assessment.focusMissionIds];
  }

  return result;
}

/** Append a new block's mission picks — never overwrite completed blocks. */
export function mergeHillSelection(
  existing: HillMissionSelections,
  hillId: string,
  missionIds: string[],
): HillMissionSelections {
  const blocks = getHillBlockSelections(existing, hillId);
  return { ...existing, [hillId]: [...blocks, missionIds] };
}
