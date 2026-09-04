import { MissionStatus, type GapAssessment, type Hill, type UserMissionProgress } from '@prisma/client';
import { MISSIONS_PER_HILL } from '../journeyPlan';
import { getHillBlockSelections, parseHillSelections } from '../journeySelections';
import { resolveWeekAvailability } from '../missionWeekGate';
import type { LegacyJourneySnapshot, MigrationCohort } from './types';

export type CohortInput = {
  onboardingCompleted: boolean;
  totalMissionCompletions: number;
  legacyStepsByHill: Record<string, number>;
  focusHillId: string;
  assessment: GapAssessment;
  progressRows: UserMissionProgress[];
  hills: Hill[];
};

export function computeLegacyStepsByHill(
  countsByHillId: Map<string, number>,
  hills: Hill[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const hill of hills) {
    result[hill.id] = countsByHillId.get(hill.id) ?? 0;
  }
  return result;
}

export function lockstepFromLegacySteps(legacyStepsByHill: Record<string, number>): number {
  const values = Object.values(legacyStepsByHill);
  if (values.length === 0) return 0;
  return Math.min(...values);
}

export function peakFromLegacySteps(legacyStepsByHill: Record<string, number>): number {
  const values = Object.values(legacyStepsByHill);
  if (values.length === 0) return 0;
  return Math.max(...values);
}

function blockMissionIdsForAssessment(assessment: GapAssessment): string[] {
  const selections = parseHillSelections(assessment);
  const blocks = getHillBlockSelections(selections, assessment.focusHillId);
  const latest = blocks[blocks.length - 1];
  if (latest?.length === MISSIONS_PER_HILL) return latest;
  if (assessment.focusMissionIds.length === MISSIONS_PER_HILL) {
    return [...assessment.focusMissionIds];
  }
  return latest ?? [];
}

export function isActiveLegacyBlock(
  assessment: GapAssessment,
  progressRows: UserMissionProgress[],
): boolean {
  const blockMissionIds = blockMissionIdsForAssessment(assessment);
  if (blockMissionIds.length !== MISSIONS_PER_HILL) return false;

  const progressByMission = new Map(progressRows.map((p) => [p.missionId, p]));
  const statuses = blockMissionIds.map((id) => progressByMission.get(id)?.status ?? MissionStatus.locked);
  const allCompleted = statuses.every((s) => s === MissionStatus.completed);
  if (allCompleted) return false;

  return statuses.some(
    (s) => s === MissionStatus.current || s === MissionStatus.completed,
  );
}

export function classifyMigrationCohort(input: CohortInput): MigrationCohort {
  if (!input.onboardingCompleted) return 'A';

  if (isActiveLegacyBlock(input.assessment, input.progressRows)) return 'C';

  const focusSteps = input.legacyStepsByHill[input.focusHillId] ?? 0;
  if (focusSteps >= 35) return 'E';

  const counts = Object.values(input.legacyStepsByHill);
  if (counts.length > 0) {
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    if (max > min) return 'D';
  }

  if (input.totalMissionCompletions <= 2) return 'B';
  return 'B';
}

type WeekGateBlockWeek = {
  taskNumber: number;
  mission: { id: string } | null;
};

export function buildLegacyJourneySnapshot(
  assessment: GapAssessment,
  progressRows: UserMissionProgress[],
  focusHill: Hill,
  now = new Date(),
): LegacyJourneySnapshot {
  const blockMissionIds = blockMissionIdsForAssessment(assessment);
  const progressByMission = new Map(progressRows.map((p) => [p.missionId, p]));

  const blockWeeks: WeekGateBlockWeek[] = blockMissionIds.map((missionId, index) => ({
    taskNumber: index + 1,
    mission: { id: missionId },
  }));

  let waitingNextWeek = false;
  let nextOpensAt: string | null = null;
  let currentMissionId: string | null = null;

  for (const week of blockWeeks) {
    if (!week.mission) continue;
    const progress = progressByMission.get(week.mission.id);
    if (progress?.status === MissionStatus.completed) continue;

    const availability = resolveWeekAvailability(week, blockWeeks, progressByMission, now);
    if (!availability.priorIncomplete && !availability.lockedByWeek) {
      currentMissionId = week.mission.id;
    } else if (availability.lockedByWeek) {
      waitingNextWeek = true;
      nextOpensAt = availability.opensAt;
      currentMissionId = week.mission.id;
    }
    break;
  }

  const missions = blockMissionIds.map((missionId, index) => {
    const progress = progressByMission.get(missionId);
    return {
      missionId,
      orderInBlock: (index + 1) as 1 | 2 | 3,
      status: (progress?.status ?? MissionStatus.locked) as 'locked' | 'current' | 'completed',
      completedAt: progress?.completedAt?.toISOString() ?? null,
      startedAt: progress?.startedAt?.toISOString() ?? null,
    };
  });

  const hillMissionSelections = parseHillSelections(assessment) as Record<string, string[]>;

  return {
    schemaVersion: 1,
    capturedAt: now.toISOString(),
    cohort: 'C',
    journeyModelVersion: 1,
    focusHillId: assessment.focusHillId,
    focusHillCode: focusHill.code,
    blockMissionIds,
    blockHillId: assessment.focusHillId,
    missions,
    weekGate: {
      waitingNextWeek,
      nextOpensAt,
      currentMissionId,
    },
    hillMissionSelections,
    focusMissionIds: [...assessment.focusMissionIds],
    coinConversion: null,
    blockClosed: true,
  };
}

export function completedBlockMissionIds(snapshot: LegacyJourneySnapshot): string[] {
  return snapshot.missions
    .filter((m) => m.status === MissionStatus.completed)
    .map((m) => m.missionId);
}
