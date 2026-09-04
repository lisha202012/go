import { LedgerSource } from '@prisma/client';
import { prisma } from '../prisma';
import {
  CHALLENGE_GLOW_SEED_TARGET,
  CHALLENGE_PERIOD_DAYS,
  FLOW_WEEK_SEED_REWARDS,
} from './types';
import { bootstrapPersonalWeekStart, startOfDay } from './personalWeek';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const FLOW_WEEK_SEED_REF_PREFIXES = {
  daily: 'flow_daily_seed:',
  perfectWeek: 'flow_perfect_week_seeds:',
  devTest: 'flow_dev_test_seed:',
} as const;

export function seedsFromLedgerReference(referenceId: string): number {
  if (referenceId.startsWith(FLOW_WEEK_SEED_REF_PREFIXES.perfectWeek)) {
    return FLOW_WEEK_SEED_REWARDS.perfectWeek;
  }
  if (
    referenceId.startsWith(FLOW_WEEK_SEED_REF_PREFIXES.daily) ||
    referenceId.startsWith(FLOW_WEEK_SEED_REF_PREFIXES.devTest)
  ) {
    return FLOW_WEEK_SEED_REWARDS.dailyFlow;
  }
  return 0;
}

export type GrowChallengeProgress = {
  glowSeedsEarned: number;
  glowSeedsTarget: number;
  challengeDaysTotal: number;
  challengeDayIndex: number;
  daysRemaining: number;
  isComplete: boolean;
  challengeStartDate: string;
  challengeEndDate: string;
  periodExpired: boolean;
};

export async function resolveChallengeStartDate(userId: string): Promise<Date> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { createdAt: true },
  });

  const mainSchedule = await prisma.personalWeekSchedule.findFirst({
    where: { userId, isStarterWeek: false },
    orderBy: { personalWeekStart: 'asc' },
    select: { personalWeekStart: true },
  });

  if (mainSchedule) return startOfDay(mainSchedule.personalWeekStart);

  const assessment = await prisma.gapAssessment.findUnique({
    where: { userId },
    select: { rankingsEffectiveFrom: true },
  });
  if (assessment?.rankingsEffectiveFrom) {
    return startOfDay(assessment.rankingsEffectiveFrom);
  }

  return bootstrapPersonalWeekStart(user.createdAt);
}

export async function countGlowSeedsEarnedInChallenge(
  userId: string,
  challengeStart: Date,
  challengeEnd: Date,
): Promise<number> {
  const grants = await prisma.coinLedgerEntry.findMany({
    where: {
      userId,
      source: LedgerSource.flow_week,
      createdAt: { gte: challengeStart, lt: challengeEnd },
      OR: [
        { referenceId: { startsWith: FLOW_WEEK_SEED_REF_PREFIXES.daily } },
        { referenceId: { startsWith: FLOW_WEEK_SEED_REF_PREFIXES.perfectWeek } },
        { referenceId: { startsWith: FLOW_WEEK_SEED_REF_PREFIXES.devTest } },
      ],
    },
    select: { referenceId: true },
  });

  return grants.reduce((sum, grant) => sum + (grant.referenceId ? seedsFromLedgerReference(grant.referenceId) : 0), 0);
}

export async function getGrowChallengeProgress(userId: string): Promise<GrowChallengeProgress> {
  const challengeStart = await resolveChallengeStartDate(userId);
  const challengeEnd = new Date(challengeStart);
  challengeEnd.setDate(challengeEnd.getDate() + CHALLENGE_PERIOD_DAYS);

  const now = startOfDay(new Date());
  const challengeDayIndex = Math.min(
    CHALLENGE_PERIOD_DAYS,
    Math.max(1, Math.floor((now.getTime() - challengeStart.getTime()) / MS_PER_DAY) + 1),
  );
  const daysRemaining = Math.max(
    0,
    Math.ceil((challengeEnd.getTime() - now.getTime()) / MS_PER_DAY),
  );
  const periodExpired = now.getTime() >= challengeEnd.getTime();

  const glowSeedsEarned = await countGlowSeedsEarnedInChallenge(
    userId,
    challengeStart,
    challengeEnd,
  );

  return {
    glowSeedsEarned,
    glowSeedsTarget: CHALLENGE_GLOW_SEED_TARGET,
    challengeDaysTotal: CHALLENGE_PERIOD_DAYS,
    challengeDayIndex,
    daysRemaining,
    isComplete: glowSeedsEarned >= CHALLENGE_GLOW_SEED_TARGET,
    challengeStartDate: challengeStart.toISOString(),
    challengeEndDate: challengeEnd.toISOString(),
    periodExpired,
  };
}
