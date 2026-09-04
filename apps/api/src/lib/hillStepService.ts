import { prisma } from './prisma';
import { clampSteps, detectCampReached, resolveCampProgress } from './hillProgress';
import { grantCampStreakTokensForStepAdvance } from './flowWeek/campStreakService';
import { awardCampTreeStar } from './treeStarService';

export async function getHillStepCounts(userId: string): Promise<Map<string, number>> {
  const groups = await prisma.growthSet.groupBy({
    by: ['hillId'],
    where: { userId },
    _count: { id: true },
  });
  return new Map(groups.map((g) => [g.hillId, g._count.id]));
}

export async function recordHillStepComplete(userId: string, hillId: string) {
  return prisma.$transaction(async (tx) => {
    const beforeSteps = await tx.growthSet.count({ where: { userId, hillId } });

    await tx.growthSet.create({
      data: { userId, hillId },
    });

    const steps = beforeSteps + 1;
    const campReached = detectCampReached(beforeSteps, steps);
    await grantCampStreakTokensForStepAdvance(tx, userId, beforeSteps, steps);
    await awardCampTreeStar(tx, userId, campReached);

    const assessment = await tx.gapAssessment.findUnique({
      where: { userId },
      select: { focusHillId: true },
    });

    if (assessment?.focusHillId === hillId) {
      const campProgress = resolveCampProgress(steps);
      const campRow = await tx.camp.findUnique({
        where: { number: campProgress.currentCamp.number },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          currentStep: clampSteps(steps),
          ...(campRow ? { currentCampId: campRow.id } : {}),
        },
      });
    }

    return { steps: clampSteps(steps), campReached };
  });
}
