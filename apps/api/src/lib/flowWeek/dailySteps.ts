import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma';
import { clampSteps, resolveCampProgress } from '../hillProgress';
import { FLOW_WEEK_AWARD_SOURCES, type FlowWeekAwardSource } from './types';

/**
 * Option 1 (client spec): award +1 Step immediately for the specific hill
 * whose assigned day just reached 3/3.
 *
 * This awards exactly one GrowthSet row for the given hill.
 */
export async function awardDailyHillStepInTransaction(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  hillId: string,
  awardSource: FlowWeekAwardSource,
) {
  // Prevent creating extra GrowthSets beyond the maximum summit step.
  const beforeStepsRaw = await tx.growthSet.count({ where: { userId, hillId } });
  const beforeSteps = clampSteps(beforeStepsRaw);
  if (beforeSteps >= 49) return { stepAwarded: false as const };

  const awardBatchId = randomUUID();
  const completedAt = new Date();

  await tx.growthSet.create({
    data: {
      userId,
      hillId,
      awardBatchId,
      awardSource,
      completedAt,
    },
  });

  const afterSteps = clampSteps(beforeSteps + 1);

  // Update "currentStep/currentCamp" only when this hill matches the user's focus hill.
  const assessment = await tx.gapAssessment.findUnique({
    where: { userId },
    select: { focusHillId: true },
  });

  if (assessment?.focusHillId === hillId) {
    const campProgress = resolveCampProgress(afterSteps);
    const campRow = await tx.camp.findUnique({
      where: { number: campProgress.currentCamp.number },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        currentStep: afterSteps,
        ...(campRow ? { currentCampId: campRow.id } : {}),
      },
    });
  }

  return { stepAwarded: true, awardBatchId, awardSource, beforeSteps: beforeStepsRaw, afterSteps };
}

export function resolveDailyStepAwardSource({ isStarterWeek }: { isStarterWeek: boolean }): FlowWeekAwardSource {
  return isStarterWeek ? FLOW_WEEK_AWARD_SOURCES.starterWeek : FLOW_WEEK_AWARD_SOURCES.dailyFlowStep;
}

