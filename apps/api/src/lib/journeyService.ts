import { MissionStatus, type Prisma } from '@prisma/client';
import type { Hill, Mission } from '@prisma/client';
import { prisma } from './prisma';
import {
  buildHillSequence,
  MISSIONS_PER_HILL,
  WEEKS_TOTAL,
} from './journeyPlan';
import { mergeHillSelection, parseHillSelections, getHillBlockSelections } from './journeySelections';
import { validateUserMissionSelection } from './missionEngine';
import { syncUserAgeGroupFromDob } from './userAgeSync';
import { clampSteps, resolveCampProgress, STEPS_PER_HILL, buildClimbChallenge } from './hillProgress';
import { getHillStepCounts, recordHillStepComplete } from './hillStepService';
import { assertNoBlockingMissedDay } from './flowWeek/campStreakService';
import {
  firstAvailableMissionIdInBlock,
  isThisWeekMissionComplete,
  resolveWeekAvailability,
} from './missionWeekGate';

export type JourneyWeekStatus = MissionStatus | 'pending_selection' | 'waiting_next_week';

type ProgressRow = {
  missionId: string;
  status: MissionStatus;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

function blockWeeksFor(
  weeks: Array<{ hillBlock: number; taskNumber: number; mission: { id: string } | null }>,
  hillBlock: number,
) {
  return weeks
    .filter((w) => w.hillBlock === hillBlock && w.mission)
    .sort((a, b) => a.taskNumber - b.taskNumber);
}

/** @deprecated Use firstAvailableMissionIdInBlock from missionWeekGate (calendar-week aware). */
export function firstIncompleteMissionIdInBlock(
  weeks: Array<{ hillBlock: number; taskNumber: number; mission: { id: string } | null }>,
  hillBlock: number,
  progressByMission: Map<string, Pick<ProgressRow, 'status'>>,
): string | null {
  return firstAvailableMissionIdInBlock(weeks, hillBlock, progressByMission);
}

function applyWeekGateToWeeks(
  weeks: Array<{
    hillBlock: number;
    taskNumber: number;
    mission: { id: string } | null;
    status: JourneyWeekStatus;
    opensAt?: string | null;
  }>,
  progressByMission: Map<string, ProgressRow>,
) {
  const now = new Date();
  for (const week of weeks) {
    if (!week.mission) continue;
    const dbStatus = progressByMission.get(week.mission.id)?.status ?? MissionStatus.locked;
    if (dbStatus === MissionStatus.completed) {
      week.status = MissionStatus.completed;
      week.opensAt = null;
      continue;
    }

    const blockWeeks = blockWeeksFor(weeks, week.hillBlock);
    const availability = resolveWeekAvailability(week, blockWeeks, progressByMission, now);
    week.opensAt = availability.opensAt;

    if (availability.priorIncomplete) {
      week.status = MissionStatus.locked;
    } else if (availability.lockedByWeek) {
      week.status = 'waiting_next_week';
    } else if (dbStatus === MissionStatus.current) {
      week.status = MissionStatus.current;
    } else {
      week.status = MissionStatus.locked;
    }
  }
}

function sequentialStatusesForBlock(blockMissions: Mission[]): MissionStatus[] {
  return blockMissions.map((_, index) =>
    index === 0 ? MissionStatus.current : MissionStatus.locked,
  );
}

async function upsertBlockMissionProgress(
  tx: Prisma.TransactionClient,
  userId: string,
  blockMissions: Mission[],
) {
  const statuses = sequentialStatusesForBlock(blockMissions);
  for (let index = 0; index < blockMissions.length; index++) {
    const mission = blockMissions[index]!;
    const status = statuses[index]!;
    await tx.userMissionProgress.upsert({
      where: {
        userId_missionId: { userId, missionId: mission.id },
      },
      create: {
        userId,
        missionId: mission.id,
        status,
      },
      update: {
        status,
        startedAt: null,
        completedAt: null,
      },
    });
  }
}

export function formatJourneyPlanPayload(
  focusHill: Hill,
  hills: Hill[],
  hillSelections: Record<string, string[]>,
  missions: Mission[],
) {
  const sequence = buildHillSequence(focusHill.code);
  const missionById = new Map(missions.map((m) => [m.id, m]));
  const weeks: Array<{
    weekNumber: number;
    missionId?: string;
    missionTitle?: string;
    hillId: string;
    hillCode?: string;
    hillName?: string;
    taskNumber: number;
    isFocusHillBlock: boolean;
    pendingSelection: boolean;
  }> = [];

  let weekNumber = 1;
  for (let blockIndex = 0; blockIndex < sequence.length; blockIndex++) {
    const hill = hills.find((h) => h.code === sequence[blockIndex]);
    if (!hill) continue;

    const blockSelections = getHillBlockSelections(hillSelections, hill.id);
    const selectedIds = blockSelections[0];
    const hasSelection = selectedIds?.length === MISSIONS_PER_HILL;

    for (let task = 0; task < MISSIONS_PER_HILL; task++) {
      const missionId = hasSelection ? selectedIds[task] : undefined;
      const mission = missionId ? missionById.get(missionId) : undefined;
      weeks.push({
        weekNumber,
        missionId: mission?.id,
        missionTitle: mission?.title,
        hillId: hill.id,
        hillCode: hill.code,
        hillName: hill.name,
        taskNumber: task + 1,
        isFocusHillBlock: blockIndex === 0,
        pendingSelection: !hasSelection && task === 0,
      });
      weekNumber++;
    }
  }

  return {
    totalWeeks: WEEKS_TOTAL,
    missionsPerHill: MISSIONS_PER_HILL,
    focusHill,
    startsWithWeek: 1,
    weeks,
  };
}

export async function applyJourneyMissionProgress(
  userId: string,
  journeyMissions: Mission[],
  { replace = false }: { replace?: boolean } = {},
) {
  await prisma.$transaction(async (tx) => {
    if (replace) {
      await tx.userMissionProgress.deleteMany({ where: { userId } });
    }

    await upsertBlockMissionProgress(tx, userId, journeyMissions);
  });
}

export async function appendBlockMissionProgress(
  userId: string,
  blockMissions: Mission[],
) {
  await prisma.$transaction(async (tx) => {
    await upsertBlockMissionProgress(tx, userId, blockMissions);
  });
}

export async function loadJourneyContext(userId: string) {
  const categoryCode = await syncUserAgeGroupFromDob(userId);

  const assessment = await prisma.gapAssessment.findUnique({
    where: { userId },
    include: { focusHill: true, strongestHill: true },
  });
  if (!assessment) return null;

  const [hills, missions, progressRows] = await Promise.all([
    prisma.hill.findMany({ orderBy: { code: 'asc' } }),
    prisma.mission.findMany({
      where: { categoryCode },
      orderBy: [{ hillId: 'asc' }, { order: 'asc' }],
    }),
    prisma.userMissionProgress.findMany({ where: { userId } }),
  ]);

  return { assessment, hills, missions, progressRows, categoryCode };
}

function isBlockComplete(
  blockWeeks: { mission: { id: string } | null; status: string }[],
  progressByMission: Map<string, { status: MissionStatus }>,
) {
  const withMissions = blockWeeks.filter((w) => w.mission);
  if (withMissions.length !== MISSIONS_PER_HILL) return false;
  return withMissions.every(
    (w) => progressByMission.get(w.mission!.id)?.status === MissionStatus.completed,
  );
}

export const TOTAL_JOURNEY_CYCLES = 7;

type JourneyWeekRow = {
  weekNumber: number;
  hillBlock: number;
  hillStepNumber?: number;
  taskNumber: number;
  hill: {
    id: string;
    code: string;
    name: string;
    virtueName: string;
    colorTheme: string;
  };
  mission: {
    id: string;
    title: string;
    coinReward: number;
  } | null;
  status: MissionStatus | 'pending_selection';
  completedAt: string | null;
};

export function countCompletedCycles(weeks: JourneyWeekRow[]) {
  const blockNumbers = [...new Set(weeks.map((w) => w.hillBlock))].sort((a, b) => a - b);
  let count = 0;
  for (const hillBlock of blockNumbers) {
    const blockWeeks = weeks.filter((w) => w.hillBlock === hillBlock && w.mission);
    if (blockWeeks.length !== MISSIONS_PER_HILL) continue;
    if (blockWeeks.every((w) => w.status === MissionStatus.completed)) count++;
  }
  return count;
}

export function buildActiveCycleSnapshot(weeks: JourneyWeekRow[]) {
  const blockNumbers = [...new Set(weeks.map((w) => w.hillBlock))].sort((a, b) => a - b);
  for (const hillBlock of blockNumbers) {
    const blockWeeks = weeks.filter((w) => w.hillBlock === hillBlock && w.mission);
    if (blockWeeks.length !== MISSIONS_PER_HILL) continue;
    const completed = blockWeeks.filter((w) => w.status === MissionStatus.completed).length;
    if (completed < MISSIONS_PER_HILL) {
      return {
        cycleNumber: hillBlock,
        hill: blockWeeks[0].hill,
        hillStepNumber: blockWeeks[0].hillStepNumber ?? null,
        journeyWeekStart: blockWeeks[0].weekNumber,
        journeyWeekEnd: blockWeeks[blockWeeks.length - 1].weekNumber,
        missionsCompleted: completed,
        missionsTotal: MISSIONS_PER_HILL,
      };
    }
  }
  return null;
}

export function buildCompletedCycleSnapshot(weeks: JourneyWeekRow[], completedHillBlock: number) {
  const blockWeeks = weeks
    .filter((w) => w.hillBlock === completedHillBlock && w.mission)
    .sort((a, b) => a.taskNumber - b.taskNumber);

  if (blockWeeks.length !== MISSIONS_PER_HILL) return null;
  if (!blockWeeks.every((w) => w.status === MissionStatus.completed)) return null;

  const missions = blockWeeks.map((w) => ({
    id: w.mission!.id,
    title: w.mission!.title,
    completedAt: w.completedAt,
    coinReward: w.mission!.coinReward,
  }));

  const completedAt =
    missions
      .map((m) => m.completedAt)
      .filter((d): d is string => Boolean(d))
      .sort()
      .pop() ?? null;

  return {
    cycleNumber: completedHillBlock,
    stepNumber: completedHillBlock,
    hill: blockWeeks[0].hill,
    journeyWeekStart: blockWeeks[0].weekNumber,
    journeyWeekEnd: blockWeeks[blockWeeks.length - 1].weekNumber,
    missions,
    completedAt,
  };
}

function buildActiveStepSnapshot(
  weeks: JourneyWeekRow[],
  hillStepCounts?: Map<string, number>,
  climbMax = STEPS_PER_HILL,
) {
  const activeCycle = buildActiveCycleSnapshot(weeks);
  if (!activeCycle) return null;

  const completedSteps = hillStepCounts?.get(activeCycle.hill.id) ?? 0;
  const camp = resolveCampProgress(completedSteps);
  const nextCamp =
    camp.nextCamp && camp.nextCamp.stepThreshold <= climbMax ? camp.nextCamp : null;
  const workingStep = Math.min(
    climbMax,
    clampSteps(
      completedSteps + (activeCycle.missionsCompleted < MISSIONS_PER_HILL ? 1 : 0),
    ),
  );

  return {
    ...activeCycle,
    completedSteps,
    workingStep,
    stepsPerHill: climbMax,
    currentCamp: camp.currentCamp,
    nextCamp,
    stepsRemaining: nextCamp ? nextCamp.stepThreshold - completedSteps : 0,
  };
}

function buildHillProgressList(
  hills: Hill[],
  sequence: ReturnType<typeof buildHillSequence>,
  hillStepCounts: Map<string, number> | undefined,
  activeStep: ReturnType<typeof buildActiveStepSnapshot>,
  climbMax = STEPS_PER_HILL,
) {
  return sequence
    .map((code) => hills.find((h) => h.code === code))
    .filter((hill): hill is Hill => Boolean(hill))
    .map((hill) => {
      const completedSteps = clampSteps(hillStepCounts?.get(hill.id) ?? 0);
      const camp = resolveCampProgress(completedSteps);
      const nextCamp =
        camp.nextCamp && camp.nextCamp.stepThreshold <= climbMax ? camp.nextCamp : null;
      const isActive = activeStep?.hill.id === hill.id;
      return {
        hill: {
          id: hill.id,
          code: hill.code,
          name: hill.name,
          virtueName: hill.virtueName,
          colorTheme: hill.colorTheme,
        },
        completedSteps,
        stepsPerHill: climbMax,
        currentCamp: camp.currentCamp,
        nextCamp,
        reachedCamps: camp.reachedCamps.filter((c) => c.stepThreshold <= climbMax),
        stepsRemaining: nextCamp ? nextCamp.stepThreshold - completedSteps : 0,
        isActive,
        workingStep: isActive
          ? activeStep!.workingStep
          : completedSteps < climbMax
            ? completedSteps + 1
            : climbMax,
        missionsCompleted: isActive ? activeStep!.missionsCompleted : 0,
        missionsTotal: isActive ? activeStep!.missionsTotal : MISSIONS_PER_HILL,
      };
    });
}

function attachStepToCompletedCycle(
  cycle: ReturnType<typeof buildCompletedCycleSnapshot>,
  hillStepCounts?: Map<string, number>,
  climbMax = STEPS_PER_HILL,
) {
  if (!cycle) return null;
  const completedSteps = clampSteps(hillStepCounts?.get(cycle.hill.id) ?? 0);
  const camp = resolveCampProgress(completedSteps);
  return {
    ...cycle,
    stepNumber: completedSteps,
    completedSteps,
    currentCamp: camp.currentCamp,
    stepsPerHill: climbMax,
  };
}

export function buildJourneyResponse(
  assessment: NonNullable<Awaited<ReturnType<typeof loadJourneyContext>>>['assessment'],
  hills: Hill[],
  missions: Mission[],
  progressRows: {
    missionId: string;
    status: MissionStatus;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }[],
  hillStepCounts?: Map<string, number>,
) {
  const hillSelections = parseHillSelections(assessment);
  const sequence = buildHillSequence(assessment.focusHill.code);
  const missionById = new Map(missions.map((m) => [m.id, m]));
  const progressByMission = new Map(progressRows.map((p) => [p.missionId, p]));

  const weeks: Array<{
    weekNumber: number;
    hillBlock: number;
    taskNumber: number;
    hill: {
      id: string;
      code: string;
      name: string;
      virtueName: string;
      colorTheme: string;
    };
    mission: {
      id: string;
      title: string;
      description: string;
      order: number;
      coinReward: number;
      requiresReflection: boolean;
      requiresEvidence: boolean;
    } | null;
    status: MissionStatus | 'pending_selection';
    startedAt: string | null;
    completedAt: string | null;
    opensAt?: string | null;
    isFocusHill: boolean;
    pendingSelection: boolean;
  }> = [];

  let weekNumber = 1;
  let hillBlock = 0;
  let pendingBlockSelection: {
    blockIndex: number;
    blockStartWeek: number;
    blockEndWeek: number;
    hill: Hill;
    pickCount: number;
    roundIndex: number;
  } | null = null;

  const stepsByHillId = hillStepCounts ?? new Map<string, number>();
  const maxRound =
    Math.max(
      1,
      ...sequence.map((code) => {
        const hill = hills.find((h) => h.code === code);
        return hill ? (stepsByHillId.get(hill.id) ?? 0) + 1 : 1;
      }),
    ) + 1;

  let stopBuilding = false;

  for (let round = 0; round < maxRound && !stopBuilding; round++) {
    for (let seqIndex = 0; seqIndex < sequence.length; seqIndex++) {
      const code = sequence[seqIndex];
      const hill = hills.find((h) => h.code === code);
      if (!hill) continue;

      const completedOnHill = stepsByHillId.get(hill.id) ?? 0;
      if (completedOnHill >= STEPS_PER_HILL) continue;

      hillBlock++;
      const hillStepNumber = round + 1;
      const blockSelections = getHillBlockSelections(hillSelections, hill.id);
      const selectedIds = blockSelections[round];
      const hasSelection = selectedIds?.length === MISSIONS_PER_HILL;
      const blockStartWeek = weekNumber;

      if (!hasSelection) {
        for (let task = 0; task < MISSIONS_PER_HILL; task++) {
          weeks.push({
            weekNumber,
            hillBlock,
            hillStepNumber,
            taskNumber: task + 1,
            hill: {
              id: hill.id,
              code: hill.code,
              name: hill.name,
              virtueName: hill.virtueName,
              colorTheme: hill.colorTheme,
            },
            mission: null,
            status: 'pending_selection',
            startedAt: null,
            completedAt: null,
            isFocusHill: hill.id === assessment.focusHillId,
            pendingSelection: task === 0,
          });
          weekNumber++;
        }

        if (!pendingBlockSelection) {
          const priorComplete =
            hillBlock === 1 ||
            isBlockComplete(
              weeks.filter((w) => w.hillBlock === hillBlock - 1),
              progressByMission,
            );

          if (priorComplete) {
            pendingBlockSelection = {
              blockIndex: hillBlock - 1,
              blockStartWeek,
              blockEndWeek: blockStartWeek + MISSIONS_PER_HILL - 1,
              hill,
              pickCount: MISSIONS_PER_HILL,
              roundIndex: round,
            };
            stopBuilding = true;
          }
        }
        continue;
      }

      for (let task = 0; task < MISSIONS_PER_HILL; task++) {
        const mission = missionById.get(selectedIds[task]);
        if (!mission) continue;
        const progress = progressByMission.get(mission.id);
        weeks.push({
          weekNumber,
          hillBlock,
          hillStepNumber,
          taskNumber: task + 1,
          hill: {
            id: hill.id,
            code: hill.code,
            name: hill.name,
            virtueName: hill.virtueName,
            colorTheme: hill.colorTheme,
          },
          mission: {
            id: mission.id,
            title: mission.title,
            description: mission.description,
            order: mission.order,
            coinReward: mission.coinReward,
            requiresReflection: mission.requiresReflection,
            requiresEvidence: mission.requiresEvidence,
          },
          status: progress?.status ?? MissionStatus.locked,
          startedAt: progress?.startedAt?.toISOString() ?? null,
          completedAt: progress?.completedAt?.toISOString() ?? null,
          isFocusHill: hill.id === assessment.focusHillId,
          pendingSelection: false,
        });
        weekNumber++;
      }
    }
  }

  applyWeekGateToWeeks(weeks, progressByMission);

  let needsBlockSelection = false;
  if (pendingBlockSelection) {
    if (pendingBlockSelection.blockIndex === 0) {
      needsBlockSelection = true;
    } else {
      const prevBlockWeeks = weeks.filter((w) => w.hillBlock === pendingBlockSelection!.blockIndex);
      needsBlockSelection = isBlockComplete(prevBlockWeeks, progressByMission);
    }
  }

  const currentWeek =
    weeks.find((w) => w.mission && progressByMission.get(w.mission.id)?.status === MissionStatus.current)
      ?.weekNumber ??
    weeks.find((w) => w.mission && progressByMission.get(w.mission.id)?.status === MissionStatus.completed)
      ?.weekNumber ??
    (progressRows.length > 0 ? 1 : null);

  const completedCyclesCount = countCompletedCycles(weeks);
  const climbChallenge = buildClimbChallenge([...(hillStepCounts?.values() ?? [])]);
  const climbMax = climbChallenge.displayMax;
  const activeCycle = buildActiveCycleSnapshot(weeks);
  const activeStep = buildActiveStepSnapshot(weeks, hillStepCounts, climbMax);
  const lastCompletedCycle = attachStepToCompletedCycle(
    needsBlockSelection && pendingBlockSelection && pendingBlockSelection.blockIndex >= 1
      ? buildCompletedCycleSnapshot(weeks, pendingBlockSelection.blockIndex)
      : null,
    hillStepCounts,
    climbMax,
  );
  const hillProgress = buildHillProgressList(hills, sequence, hillStepCounts, activeStep, climbMax);
  const focusCompletedSteps = clampSteps(
    hillStepCounts?.get(assessment.focusHillId) ?? 0,
  );
  const focusCamp = resolveCampProgress(focusCompletedSteps);

  const activeBlockWeek = activeCycle?.cycleNumber ?? null;
  const weeklyProgress =
    activeBlockWeek != null
      ? {
          thisWeekComplete: isThisWeekMissionComplete(weeks, activeBlockWeek, progressByMission),
          opensAt:
            weeks.find((w) => w.hillBlock === activeBlockWeek && w.status === 'waiting_next_week')
              ?.opensAt ?? null,
        }
      : null;

  return {
    summary: {
      totalWeeks: WEEKS_TOTAL,
      missionsPerHill: MISSIONS_PER_HILL,
      totalMissions: WEEKS_TOTAL,
      stepsPerHill: climbMax,
      climbChallenge,
      totalCycles: TOTAL_JOURNEY_CYCLES,
      completedCyclesCount,
      activeCycle,
      activeStep,
      weeklyProgress,
      hillProgress,
      focusProgress: {
        hill: assessment.focusHill,
        completedSteps: focusCompletedSteps,
        stepsPerHill: climbMax,
        currentCamp: focusCamp.currentCamp,
        nextCamp:
          focusCamp.nextCamp && focusCamp.nextCamp.stepThreshold <= climbMax
            ? focusCamp.nextCamp
            : null,
        stepsRemaining:
          focusCamp.nextCamp && focusCamp.nextCamp.stepThreshold <= climbMax
            ? focusCamp.nextCamp.stepThreshold - focusCompletedSteps
            : 0,
      },
      lastCompletedCycle,
      focusHill: assessment.focusHill,
      strongestHill: assessment.strongestHill,
      currentWeek,
      needsMissionSelection: progressRows.length === 0,
      needsBlockSelection: needsBlockSelection && pendingBlockSelection !== null,
      pendingBlockSelection:
        needsBlockSelection && pendingBlockSelection
          ? {
              blockIndex: pendingBlockSelection.blockIndex,
              blockStartWeek: pendingBlockSelection.blockStartWeek,
              blockEndWeek: pendingBlockSelection.blockEndWeek,
              cycleNumber: pendingBlockSelection.blockIndex + 1,
              stepNumber: clampSteps(
                (hillStepCounts?.get(pendingBlockSelection.hill.id) ?? 0) + 1,
              ),
              hill: {
                id: pendingBlockSelection.hill.id,
                code: pendingBlockSelection.hill.code,
                name: pendingBlockSelection.hill.name,
                virtueName: pendingBlockSelection.hill.virtueName,
                colorTheme: pendingBlockSelection.hill.colorTheme,
              },
              pickCount: pendingBlockSelection.pickCount,
            }
          : null,
    },
    weeks,
  };
}

export function buildFocusBlockMissions(
  focusHill: Hill,
  missions: Mission[],
  focusMissionIds: string[],
  categoryCode: string,
) {
  const missionById = new Map(missions.map((m) => [m.id, m]));
  const blockMissions: Mission[] = [];

  for (const id of focusMissionIds) {
    const mission = missionById.get(id);
    if (!mission || mission.hillId !== focusHill.id) {
      throw new Error('Invalid focus hill mission selection');
    }
    blockMissions.push(mission);
  }

  if (blockMissions.length !== MISSIONS_PER_HILL) {
    throw new Error('Expected 3 focus hill missions');
  }

  validateUserMissionSelection(blockMissions, focusHill.id, categoryCode);

  return blockMissions;
}

export function buildBlockMissions(
  hillId: string,
  missions: Mission[],
  missionIds: string[],
  categoryCode: string,
) {
  const missionById = new Map(missions.map((m) => [m.id, m]));
  const blockMissions: Mission[] = [];

  for (const id of missionIds) {
    const mission = missionById.get(id);
    if (!mission || mission.hillId !== hillId) {
      throw new Error('Invalid hill mission selection');
    }
    blockMissions.push(mission);
  }

  if (blockMissions.length !== MISSIONS_PER_HILL) {
    throw new Error('Expected 3 missions for hill block');
  }

  validateUserMissionSelection(blockMissions, hillId, categoryCode);

  return blockMissions;
}

/** Ensure exactly one mission is current per active step — the first incomplete in order. */
export async function repairCurrentMissionIfNeeded(userId: string) {
  const ctx = await loadJourneyContext(userId);
  if (!ctx) return ctx;

  const { assessment, hills, missions, progressRows } = ctx;
  const journey = buildJourneyResponse(assessment, hills, missions, progressRows);
  const progressByMission = new Map(progressRows.map((p) => [p.missionId, p]));

  const blockNumbers = [...new Set(journey.weeks.map((w) => w.hillBlock))].sort((a, b) => a - b);
  let activeBlock: number | null = null;

  for (const block of blockNumbers) {
    const blockWeeks = journey.weeks.filter((w) => w.hillBlock === block && w.mission);
    if (blockWeeks.length === 0) continue;
    if (blockWeeks.some((w) => w.status === 'pending_selection')) break;

    const allComplete = blockWeeks.every(
      (w) => progressByMission.get(w.mission!.id)?.status === MissionStatus.completed,
    );
    if (!allComplete) {
      activeBlock = block;
      break;
    }
  }

  if (activeBlock === null) return ctx;

  const firstIncompleteId = firstAvailableMissionIdInBlock(
    journey.weeks,
    activeBlock,
    progressByMission,
  );
  if (!firstIncompleteId) return ctx;

  const updates: Array<ReturnType<typeof prisma.userMissionProgress.update>> = [];

  for (const week of blockWeeksFor(journey.weeks, activeBlock)) {
    const missionId = week.mission!.id;
    const status = progressByMission.get(missionId)?.status;
    const shouldBeCurrent = missionId === firstIncompleteId;

    if (shouldBeCurrent && status !== MissionStatus.current) {
      updates.push(
        prisma.userMissionProgress.update({
          where: { userId_missionId: { userId, missionId } },
          data: { status: MissionStatus.current },
        }),
      );
    } else if (!shouldBeCurrent && status === MissionStatus.current) {
      updates.push(
        prisma.userMissionProgress.update({
          where: { userId_missionId: { userId, missionId } },
          data: { status: MissionStatus.locked, startedAt: null },
        }),
      );
    }
  }

  if (updates.length === 0) return ctx;

  await prisma.$transaction(updates);

  const refreshedProgress = await prisma.userMissionProgress.findMany({ where: { userId } });
  return { ...ctx, progressRows: refreshedProgress };
}

/** @deprecated Use buildFocusBlockMissions — only first block is selected at onboarding */
export function buildFullJourneyMissions(
  focusHill: Hill,
  hills: Hill[],
  missions: Mission[],
  focusMissionIds: string[],
  categoryCode = 'V6',
) {
  return buildFocusBlockMissions(focusHill, missions, focusMissionIds, categoryCode);
}

export async function startMission(userId: string, missionId: string) {
  await assertNoBlockingMissedDay(userId, '__legacy__');
  const ctx = await loadJourneyContext(userId);
  if (!ctx) throw new Error('No journey context');

  const { assessment, hills, missions, progressRows } = ctx;
  const hillStepCounts = await getHillStepCounts(userId);
  const journey = buildJourneyResponse(assessment, hills, missions, progressRows, hillStepCounts);
  const week = journey.weeks.find((w) => w.mission?.id === missionId);
  if (!week || week.status !== MissionStatus.current) {
    if (week?.status === 'waiting_next_week') {
      throw new Error('This mission opens next week');
    }
    throw new Error('Mission is not current');
  }

  const progress = progressRows.find((p) => p.missionId === missionId);
  if (!progress || progress.status !== MissionStatus.current) {
    throw new Error('Mission is not current');
  }

  if (progress.startedAt) {
    return { journey: buildJourneyResponse(assessment, hills, missions, progressRows, hillStepCounts) };
  }

  const startedAt = new Date();
  await prisma.userMissionProgress.update({
    where: { userId_missionId: { userId, missionId } },
    data: { startedAt },
  });

  const updatedProgress = progressRows.map((p) =>
    p.missionId === missionId ? { ...p, startedAt } : p,
  );

  return { journey: buildJourneyResponse(assessment, hills, missions, updatedProgress, hillStepCounts) };
}

export async function completeMissionAndUnlockNext(userId: string, missionId: string) {
  await assertNoBlockingMissedDay(userId, '__legacy__');
  const ctx = await loadJourneyContext(userId);
  if (!ctx) throw new Error('No journey context');

  const { assessment, hills, missions, progressRows } = ctx;
  let hillStepCounts = await getHillStepCounts(userId);
  const journeyBefore = buildJourneyResponse(
    assessment,
    hills,
    missions,
    progressRows,
    hillStepCounts,
  );
  const weekBefore = journeyBefore.weeks.find((w) => w.mission?.id === missionId);
  if (!weekBefore || weekBefore.status !== MissionStatus.current) {
    if (weekBefore?.status === 'waiting_next_week') {
      throw new Error('This mission opens next week');
    }
    throw new Error('Mission is not current');
  }

  const progress = progressRows.find((p) => p.missionId === missionId);
  if (!progress || progress.status !== MissionStatus.current) {
    throw new Error('Mission is not current');
  }
  if (!progress.startedAt) {
    throw new Error('Mission has not been started');
  }

  const completedAt = new Date();
  await prisma.userMissionProgress.update({
    where: { userId_missionId: { userId, missionId } },
    data: { status: MissionStatus.completed, completedAt },
  });

  const updatedProgress = progressRows.map((p) =>
    p.missionId === missionId
      ? { ...p, status: MissionStatus.completed, completedAt }
      : p,
  );

  const completedMission = missions.find((m) => m.id === missionId);
  let campReached: ReturnType<typeof recordHillStepComplete>['campReached'] = null;

  const journeyProbe = buildJourneyResponse(assessment, hills, missions, updatedProgress, hillStepCounts);
  const completedWeek = journeyProbe.weeks.find((w) => w.mission?.id === missionId);

  if (completedWeek) {
    for (const week of blockWeeksFor(journeyProbe.weeks, completedWeek.hillBlock)) {
      const missionRowId = week.mission!.id;
      if (missionRowId === missionId) continue;
      const row = updatedProgress.find((p) => p.missionId === missionRowId);
      if (row && row.status !== MissionStatus.completed) {
        await prisma.userMissionProgress.update({
          where: { userId_missionId: { userId, missionId: missionRowId } },
          data: { status: MissionStatus.locked, startedAt: null },
        });
        row.status = MissionStatus.locked;
        row.startedAt = null;
      }
    }

    const blockWeeks = journeyProbe.weeks.filter(
      (w) => w.hillBlock === completedWeek.hillBlock && w.mission,
    );
    const blockComplete = blockWeeks.every((w) => {
      const status =
        w.mission!.id === missionId
          ? MissionStatus.completed
          : updatedProgress.find((p) => p.missionId === w.mission!.id)?.status;
      return status === MissionStatus.completed;
    });

    if (completedMission && blockComplete) {
      const stepResult = await recordHillStepComplete(userId, completedMission.hillId);
      campReached = stepResult.campReached;
      hillStepCounts = await getHillStepCounts(userId);
    }
  }

  const journeyAfterComplete = buildJourneyResponse(
    assessment,
    hills,
    missions,
    updatedProgress,
    hillStepCounts,
  );

  if (journeyAfterComplete.summary.needsBlockSelection) {
    const completedCycleSummary = journeyAfterComplete.summary.lastCompletedCycle;
    return {
      journey: journeyAfterComplete,
      needsBlockSelection: true,
      completedAt: completedAt.toISOString(),
      completedCycleSummary,
      campReached,
    };
  }

  return {
    journey: journeyAfterComplete,
    needsBlockSelection: false,
    completedAt: completedAt.toISOString(),
    campReached,
  };
}

export { mergeHillSelection, parseHillSelections };
