import { LedgerSource, LedgerType, GlowSeedStatus } from '@prisma/client';
import { prisma } from './prisma';
import { checkAndAwardCoinMilestones } from './treeStarService';

/** Frozen GLOW Harvest Rewards v1.0 — planter thank-you on sprout lifetime coins. */
export const HARVEST_MILESTONES = [
  { threshold: 10_000, reward: 1_000 },
  { threshold: 50_000, reward: 2_000 },
  { threshold: 100_000, reward: 3_000 },
  { threshold: 250_000, reward: 5_000 },
  { threshold: 500_000, reward: 7_500 },
  { threshold: 1_000_000, reward: 10_000 },
] as const;

export const TOTAL_POSSIBLE_HARVEST = HARVEST_MILESTONES.reduce((sum, m) => sum + m.reward, 0);

/** Original planter = first accepted GLOW seed that started this member's journey. */
export async function findOriginPlanter(sproutId: string) {
  return prisma.glowSeed.findFirst({
    where: {
      receiverId: sproutId,
      status: GlowSeedStatus.accepted,
    },
    orderBy: { acceptedAt: 'asc' },
    select: {
      id: true,
      senderId: true,
      sender: { select: { id: true, username: true, avatarUrl: true } },
    },
  });
}

/**
 * After a sprout earns personal growth coins, grant any newly crossed harvest milestones
 * to their origin planter (once each). Harvest coins count as personal growth.
 */
export async function checkAndGrantHarvestRewards(sproutId: string) {
  const origin = await findOriginPlanter(sproutId);
  if (!origin) return [];

  const sprout = await prisma.user.findUnique({
    where: { id: sproutId },
    select: {
      id: true,
      username: true,
      growthCoinsLifetime: true,
    },
  });
  if (!sprout) return [];

  const granted: Array<{
    threshold: number;
    reward: number;
    sproutUsername: string;
  }> = [];

  for (const milestone of HARVEST_MILESTONES) {
    if (sprout.growthCoinsLifetime < milestone.threshold) continue;

    const existing = await prisma.harvestMilestoneClaim.findUnique({
      where: {
        planterId_sproutId_threshold: {
          planterId: origin.senderId,
          sproutId,
          threshold: milestone.threshold,
        },
      },
    });
    if (existing) continue;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.harvestMilestoneClaim.create({
          data: {
            planterId: origin.senderId,
            sproutId,
            threshold: milestone.threshold,
            rewardAmount: milestone.reward,
          },
        });
        await tx.coinLedgerEntry.create({
          data: {
            userId: origin.senderId,
            amount: milestone.reward,
            ledgerType: LedgerType.personal_growth,
            source: LedgerSource.harvest_reward,
            referenceId: `${sproutId}:${milestone.threshold}`,
          },
        });
        await tx.user.update({
          where: { id: origin.senderId },
          data: {
            walletCoins: { increment: milestone.reward },
            growthCoinsLifetime: { increment: milestone.reward },
          },
        });
        await checkAndAwardCoinMilestones(tx, origin.senderId);
      });
      granted.push({
        threshold: milestone.threshold,
        reward: milestone.reward,
        sproutUsername: sprout.username,
      });
    } catch {
      // Unique race — already claimed
    }
  }

  return granted;
}

export async function getHarvestDashboard(planterId: string) {
  const planted = await prisma.glowSeed.findMany({
    where: {
      senderId: planterId,
      status: GlowSeedStatus.accepted,
      receiverId: { not: null },
    },
    orderBy: { acceptedAt: 'desc' },
    include: {
      receiver: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          flowIndex: true,
          growthCoinsLifetime: true,
          currentStreak: true,
          treeLevel: true,
          createdAt: true,
        },
      },
    },
  });

  // Only count origin plantings (this planter was first accepted seed for sprout)
  const referrals: Array<{
    user: NonNullable<(typeof planted)[number]['receiver']>;
    acceptedAt: string | null;
    harvestCoinsEarned: number;
    milestonesAchieved: number[];
    nextThreshold: number | null;
  }> = [];

  let totalHarvestCoins = 0;
  let milestonesAchievedCount = 0;

  for (const seed of planted) {
    if (!seed.receiver) continue;
    const origin = await findOriginPlanter(seed.receiver.id);
    if (!origin || origin.senderId !== planterId) continue;

    const claims = await prisma.harvestMilestoneClaim.findMany({
      where: { planterId, sproutId: seed.receiver.id },
      select: { threshold: true, rewardAmount: true },
    });
    const achieved = claims.map((c) => c.threshold).sort((a, b) => a - b);
    const earned = claims.reduce((s, c) => s + c.rewardAmount, 0);
    totalHarvestCoins += earned;
    milestonesAchievedCount += claims.length;

    const nextMilestone = HARVEST_MILESTONES.find(
      (m) => seed.receiver!.growthCoinsLifetime < m.threshold,
    );

    referrals.push({
      user: seed.receiver,
      acceptedAt: seed.acceptedAt?.toISOString() ?? null,
      harvestCoinsEarned: earned,
      milestonesAchieved: achieved,
      milestonesAchievedCount: achieved.length,
      nextThreshold: nextMilestone?.threshold ?? null,
      nextMilestoneReward: nextMilestone?.reward ?? null,
    });
  }

  return {
    totalHarvestCoins,
    activeReferrals: referrals.length,
    milestonesAchieved: milestonesAchievedCount,
    totalPossiblePerReferral: TOTAL_POSSIBLE_HARVEST,
    milestones: HARVEST_MILESTONES.map((m) => ({ ...m })),
    referrals,
    philosophy:
      'You didn\u2019t build their life. You helped them begin.',
  };
}

export async function getPlantedMemberProgress(planterId: string, sproutId: string) {
  const origin = await findOriginPlanter(sproutId);
  if (!origin || origin.senderId !== planterId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: sproutId },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      flowIndex: true,
      growthCoinsLifetime: true,
      currentStreak: true,
      treeLevel: true,
      currentStep: true,
      flowLockstepSteps: true,
      createdAt: true,
      walletCoins: true,
    },
  });
  if (!user) return null;

  const claims = await prisma.harvestMilestoneClaim.findMany({
    where: { planterId, sproutId },
    orderBy: { threshold: 'asc' },
  });

  const virtues = await prisma.activeVirtue.findMany({
    where: { userId: sproutId, expiresAt: { gt: new Date() } },
    include: { hill: { select: { code: true, name: true } } },
  });

  return {
    user,
    isFriend: true,
    harvestCoinsEarned: claims.reduce((s, c) => s + c.rewardAmount, 0),
    milestonesAchieved: claims.map((c) => ({
      threshold: c.threshold,
      rewardAmount: c.rewardAmount,
      claimedAt: c.claimedAt.toISOString(),
    })),
    milestones: HARVEST_MILESTONES.map((m) => ({
      ...m,
      achieved: claims.some((c) => c.threshold === m.threshold),
    })),
    activeVirtues: virtues.map((v) => ({
      virtue: v.virtue,
      hillCode: v.hill.code,
      hillName: v.hill.name,
      expiresAt: v.expiresAt.toISOString(),
    })),
  };
}
