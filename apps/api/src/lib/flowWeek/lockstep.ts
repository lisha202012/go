import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { HILL_CODE_ORDER } from '../hillDomains';
import { clampSteps, resolveCampProgress } from '../hillProgress';
import { writeAuditLog } from '../auditService';
import { FLOW_WEEK_AWARD_SOURCES, type FlowWeekAwardSource } from './types';

export type LockstepDrift = {
  userId: string;
  flowLockstepSteps: number;
  derivedFromGrowthSets: number;
  countsByHillId: Record<string, number>;
};

/** Derive lockstep step count as min GrowthSet count across all 7 hills. */
export function deriveLockstepStepsFromCounts(countsByHillId: Map<string, number>, hillIds: string[]): number {
  if (hillIds.length === 0) return 0;
  let min = Number.POSITIVE_INFINITY;
  for (const hillId of hillIds) {
    const count = countsByHillId.get(hillId) ?? 0;
    if (count < min) min = count;
  }
  return min === Number.POSITIVE_INFINITY ? 0 : clampSteps(min);
}

export async function loadGrowthSetCountsByHill(userId: string, hillIds: string[]): Promise<Map<string, number>> {
  const groups = await prisma.growthSet.groupBy({
    by: ['hillId'],
    where: { userId, hillId: { in: hillIds } },
    _count: { id: true },
  });
  const map = new Map<string, number>();
  for (const hillId of hillIds) {
    map.set(hillId, 0);
  }
  for (const g of groups) {
    map.set(g.hillId, g._count.id);
  }
  return map;
}

export async function deriveLockstepStepsForUser(userId: string): Promise<number> {
  const hills = await prisma.hill.findMany({ select: { id: true, code: true } });
  const hillIds = hills
    .sort((a, b) => HILL_CODE_ORDER.indexOf(a.code) - HILL_CODE_ORDER.indexOf(b.code))
    .map((h) => h.id);
  const counts = await loadGrowthSetCountsByHill(userId, hillIds);
  return deriveLockstepStepsFromCounts(counts, hillIds);
}

export async function checkLockstepConsistency(userId: string): Promise<LockstepDrift | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { journeyModelVersion: true, flowLockstepSteps: true },
  });
  if (!user || user.journeyModelVersion < 2) return null;

  const hills = await prisma.hill.findMany({ select: { id: true, code: true } });
  const hillIds = hills.map((h) => h.id);
  const counts = await loadGrowthSetCountsByHill(userId, hillIds);
  const derived = deriveLockstepStepsFromCounts(counts, hillIds);

  if (derived === user.flowLockstepSteps) return null;

  const countsByHillId: Record<string, number> = {};
  for (const [hillId, count] of counts) {
    countsByHillId[hillId] = count;
  }

  return {
    userId,
    flowLockstepSteps: user.flowLockstepSteps,
    derivedFromGrowthSets: derived,
    countsByHillId,
  };
}

export async function findAllLockstepDrifts(): Promise<LockstepDrift[]> {
  const users = await prisma.user.findMany({
    where: { journeyModelVersion: { gte: 2 } },
    select: { id: true },
  });
  const drifts: LockstepDrift[] = [];
  for (const { id } of users) {
    const drift = await checkLockstepConsistency(id);
    if (drift) drifts.push(drift);
  }
  return drifts;
}

export async function awardLockstepStepInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  awardSource: FlowWeekAwardSource,
): Promise<{ awardBatchId: string; growthSetIds: string[]; flowLockstepSteps: number }> {
  const hills = await tx.hill.findMany({ select: { id: true, code: true } });
  const ordered = hills.sort(
    (a, b) => HILL_CODE_ORDER.indexOf(a.code) - HILL_CODE_ORDER.indexOf(b.code),
  );

  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { flowLockstepSteps: true },
  });

  const awardBatchId = randomUUID();
  const completedAt = new Date();
  const growthSetIds: string[] = [];

  for (const hill of ordered) {
    const row = await tx.growthSet.create({
      data: {
        userId,
        hillId: hill.id,
        awardBatchId,
        awardSource,
        completedAt,
      },
    });
    growthSetIds.push(row.id);
  }

  const nextSteps = clampSteps(user.flowLockstepSteps + 1);
  const campProgress = resolveCampProgress(nextSteps);
  const campRow = await tx.camp.findUnique({
    where: { number: campProgress.currentCamp.number },
  });

  await tx.user.update({
    where: { id: userId },
    data: {
      flowLockstepSteps: nextSteps,
      currentStep: nextSteps,
      ...(campRow ? { currentCampId: campRow.id } : {}),
    },
  });

  return { awardBatchId, growthSetIds, flowLockstepSteps: nextSteps };
}

/** Awards one lockstep Step (7 GrowthSet rows). Audit log is written after commit. */
export async function awardLockstepStep(
  userId: string,
  awardSource: FlowWeekAwardSource,
  auditMetadata?: Record<string, unknown>,
): Promise<{ awardBatchId: string; growthSetIds: string[]; flowLockstepSteps: number }> {
  const result = await prisma.$transaction((tx) =>
    awardLockstepStepInTransaction(tx, userId, awardSource),
  );

  await writeAuditLog({
    module: 'journey',
    action: 'flow_week.step_awarded',
    subjectUserId: userId,
    entityType: 'User',
    entityId: userId,
    metadata: {
      awardBatchId: result.awardBatchId,
      awardSource,
      growthSetIds: result.growthSetIds,
      flowLockstepSteps: result.flowLockstepSteps,
      ...auditMetadata,
    },
  });

  return result;
}
