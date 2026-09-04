import type { PrismaClient } from '@prisma/client';
import { clampSteps, resolveCampProgress } from './hillProgress';

export type CompletedMissionRow = {
  hillId: string;
  completedAt: Date;
};

/** 1 step = every 3 completed missions on the same hill (chronological). */
export function computeStepCountsByHill(rows: CompletedMissionRow[]): Map<string, number> {
  const byHill = new Map<string, CompletedMissionRow[]>();
  for (const row of rows) {
    const list = byHill.get(row.hillId) ?? [];
    list.push(row);
    byHill.set(row.hillId, list);
  }

  const counts = new Map<string, number>();
  for (const [hillId, missions] of byHill) {
    missions.sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
    counts.set(hillId, Math.floor(missions.length / 3));
  }
  return counts;
}

/** completedAt for each earned step = timestamp of the 3rd mission in that triplet. */
export function computeStepCompletionTimes(rows: CompletedMissionRow[]): Map<string, Date[]> {
  const byHill = new Map<string, CompletedMissionRow[]>();
  for (const row of rows) {
    const list = byHill.get(row.hillId) ?? [];
    list.push(row);
    byHill.set(row.hillId, list);
  }

  const times = new Map<string, Date[]>();
  for (const [hillId, missions] of byHill) {
    missions.sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
    const stepTimes: Date[] = [];
    for (let i = 2; i < missions.length; i += 3) {
      stepTimes.push(missions[i]!.completedAt);
    }
    times.set(hillId, stepTimes);
  }
  return times;
}

export function planGrowthSetInserts(
  existingCount: number,
  expectedSteps: number,
  completionTimes: Date[],
): Array<{ stepIndex: number; completedAt: Date }> {
  const inserts: Array<{ stepIndex: number; completedAt: Date }> = [];
  for (let i = existingCount; i < expectedSteps; i++) {
    inserts.push({
      stepIndex: i + 1,
      completedAt: completionTimes[i] ?? new Date(),
    });
  }
  return inserts;
}

function generateGrowthSetId(userId: string, hillId: string, stepIndex: number): string {
  const base = `${userId}:${hillId}:${stepIndex}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  return `gs${hash.toString(36)}${stepIndex}`.slice(0, 25);
}

export async function backfillGrowthSetsForUser(
  prisma: PrismaClient,
  userId: string,
): Promise<{ inserted: number; focusSteps: number }> {
  const completed = await prisma.userMissionProgress.findMany({
    where: { userId, status: 'completed', completedAt: { not: null } },
    include: { mission: { select: { hillId: true } } },
  });

  const rows: CompletedMissionRow[] = completed.map((p) => ({
    hillId: p.mission.hillId,
    completedAt: p.completedAt!,
  }));

  const stepCounts = computeStepCountsByHill(rows);
  const stepTimes = computeStepCompletionTimes(rows);

  let inserted = 0;

  for (const [hillId, expectedSteps] of stepCounts) {
    if (expectedSteps <= 0) continue;

    const existingCount = await prisma.growthSet.count({
      where: { userId, hillId },
    });

    const toInsert = planGrowthSetInserts(
      existingCount,
      expectedSteps,
      stepTimes.get(hillId) ?? [],
    );

    for (const { stepIndex, completedAt } of toInsert) {
      await prisma.growthSet.create({
        data: {
          id: generateGrowthSetId(userId, hillId, stepIndex),
          userId,
          hillId,
          completedAt,
        },
      });
      inserted++;
    }
  }

  const assessment = await prisma.gapAssessment.findUnique({
    where: { userId },
    select: { focusHillId: true },
  });

  let focusSteps = 0;
  if (assessment?.focusHillId) {
    focusSteps = await prisma.growthSet.count({
      where: { userId, hillId: assessment.focusHillId },
    });
    focusSteps = clampSteps(focusSteps);

    const campProgress = resolveCampProgress(focusSteps);
    const campRow = await prisma.camp.findUnique({
      where: { number: campProgress.currentCamp.number },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        currentStep: focusSteps,
        ...(campRow ? { currentCampId: campRow.id } : {}),
      },
    });
  }

  return { inserted, focusSteps };
}

export async function backfillAllGrowthSets(prisma: PrismaClient): Promise<{
  usersProcessed: number;
  growthSetsInserted: number;
}> {
  const users = await prisma.userMissionProgress.findMany({
    where: { status: 'completed' },
    select: { userId: true },
    distinct: ['userId'],
  });

  let growthSetsInserted = 0;
  for (const { userId } of users) {
    const result = await backfillGrowthSetsForUser(prisma, userId);
    growthSetsInserted += result.inserted;
  }

  return { usersProcessed: users.length, growthSetsInserted };
}
