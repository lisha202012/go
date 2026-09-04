import { MissionStatus } from '@prisma/client';
import { prisma } from './prisma';
import { buildDashboardHome } from './dashboardService';
import { getWeeklyChakraStats, EMPTY_WEEKLY_CHAKRAS } from './flowWeek/flowWeekService';
import { clampSteps } from './hillProgress';
import { toPublicUser } from './publicUser';
import { getFlowStatus } from './gapScoring';
import { avatarsByInviteUsername } from './familyInvites';
import { resolveWhoUserFilter } from './flowLeadershipService';

const COIN_SOURCE_LABELS: Record<string, string> = {
  mission: 'Mission completed',
  reflection: 'Reflection bonus',
  evidence: 'Evidence bonus',
  growth_set: 'Growth set bonus',
  flow_week: 'Flow week bonus',
  camp: 'Camp milestone',
  family_mission: 'Family mission',
  welcome_bonus: 'Welcome bonus',
  admin_grant: 'Admin grant',
  spend: 'Coins spent',
};

function formatCoinEntry(entry: { id: string; amount: number; source: string; createdAt: Date }) {
  const sign = entry.amount >= 0 ? '+' : '';
  return {
    id: entry.id,
    amount: entry.amount,
    label: `${sign}${entry.amount} coins`,
    description: COIN_SOURCE_LABELS[entry.source] ?? entry.source.replace(/_/g, ' '),
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function buildProfile(userId: string) {
  // Keep concurrency low — Prisma Postgres on Windows drops under large Promise.all bursts.
  const dashboard = await buildDashboardHome(userId);
  const [user, gap, coinEntries, activeVirtues, camps] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { currentCamp: true, family: true },
    }),
    prisma.gapAssessment.findUnique({
      where: { userId },
      include: {
        focusHill: true,
        strongestHill: true,
        hillScores: { include: { hill: true }, orderBy: { flowPercent: 'desc' } },
      },
    }),
    prisma.coinLedgerEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.activeVirtue.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      include: { hill: true },
      orderBy: { activatedAt: 'desc' },
    }),
    prisma.camp.findMany({ orderBy: { number: 'asc' } }),
  ]);

  const categoryRank = user.ageGroup
    ? await prisma.$transaction([
        prisma.user.count({
          where: {
            ...resolveWhoUserFilter('category', user.ageGroup),
            accountStatus: 'active',
            role: 'user',
            officialAccount: false,
            onboardingCompleted: true,
            flowLeadershipInternal: { gt: user.flowLeadershipInternal },
          },
        }),
        prisma.user.count({
          where: {
            ...resolveWhoUserFilter('category', user.ageGroup),
            accountStatus: 'active',
            role: 'user',
            officialAccount: false,
            onboardingCompleted: true,
          },
        }),
      ]).then(([ahead, total]) => ({ rank: ahead + 1, total }))
    : null;

  const [familyMembers, weeklyChakras, missionsCompleted] = await Promise.all([
    user.familyId
      ? prisma.familyMember.findMany({
          where: { familyId: user.familyId, status: { in: ['active', 'pending'] } },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                ageGroup: true,
                officialAccount: true,
              },
            },
          },
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        })
      : Promise.resolve([]),
    getWeeklyChakraStats(userId).catch(() => EMPTY_WEEKLY_CHAKRAS),
    prisma.userMissionProgress.count({
      where: { userId, status: MissionStatus.completed },
    }),
  ]);

  const visibleFamilyMembers = familyMembers.filter((m) => !m.user?.officialAccount);

  const avatarByUsername = await avatarsByInviteUsername(
    visibleFamilyMembers
      .filter((m) => !m.user?.avatarUrl && m.inviteUsername)
      .map((m) => m.inviteUsername as string),
  );

  const step = dashboard.campProgress.currentStep;
  const campsReached = camps.filter((c) => step >= c.stepThreshold);
  const hillsSummited =
    dashboard.hills?.filter(
      (h) => (h.completedSteps ?? 0) >= (h.stepsPerHill ?? 49),
    ).length ?? 0;

  const gapHistory = gap
    ? [
        {
          id: gap.id,
          flowIndex: gap.flowIndex,
          flowStatus: getFlowStatus(gap.flowIndex),
          completedAt: gap.completedAt.toISOString(),
          nextRecalibrationAt: gap.nextRecalibrationAt.toISOString(),
          isOfficial: gap.isOfficial,
          focusHill: {
            code: gap.focusHill.code,
            name: gap.focusHill.name,
            virtueName: gap.focusHill.virtueName,
          },
          strongestHill: {
            code: gap.strongestHill.code,
            name: gap.strongestHill.name,
          },
          hillScores: gap.hillScores.map((s) => ({
            hillCode: s.hill.code,
            hillName: s.hill.name,
            flowPercent: s.flowPercent,
          })),
        },
      ]
    : [];

  return {
    user: {
      ...toPublicUser(user),
      workingStep:
        dashboard.focusHill?.workingStep ?? clampSteps(dashboard.campProgress.currentStep + 1),
      currentCamp: user.currentCamp
        ? { number: user.currentCamp.number, name: user.currentCamp.name }
        : dashboard.user.currentCamp,
      categoryRank: categoryRank?.rank ?? null,
      categoryTotal: categoryRank?.total ?? null,
    },
    flowRing: dashboard.flowRing,
    hills: dashboard.hills,
    campProgress: dashboard.campProgress,
    stats: {
      campsReached: campsReached.length,
      campsTotal: camps.length,
      summitsReached: campsReached.filter((c) => c.number >= 5).length,
      chakrasActive: weeklyChakras.activated,
      chakrasTotal: weeklyChakras.total,
      chakrasPerfectWeek: weeklyChakras.perfectWeek,
      monthlyVirtuesActive: activeVirtues.length,
      treeLevel: user.treeLevel,
      hillsMastered: hillsSummited,
      missionsCompleted,
      growthCoinsLifetime: user.growthCoinsLifetime,
    },
    camps: camps.map((camp) => ({
      number: camp.number,
      name: camp.name,
      stepThreshold: camp.stepThreshold,
      coinReward: camp.coinReward,
      reached: step >= camp.stepThreshold,
    })),
    gapHistory,
    coinHistory: coinEntries.map(formatCoinEntry),
    activeVirtues: activeVirtues.map((v) => ({
      id: v.id,
      virtue: v.virtue,
      hillCode: v.hill.code,
      hillName: v.hill.name,
      activatedAt: v.activatedAt.toISOString(),
      expiresAt: v.expiresAt.toISOString(),
    })),
    weeklyChakras: weeklyChakras.hills,
    family: user.family
      ? {
          id: user.family.id,
          name: user.family.name,
          members: visibleFamilyMembers.map((m) => {
            const username = m.user?.username ?? m.inviteUsername;
            return {
              id: m.id,
              role: m.role,
              status: m.status,
              displayName: m.displayName,
              username,
              avatarUrl:
                m.user?.avatarUrl ??
                (username ? avatarByUsername.get(username.toLowerCase()) ?? null : null),
              ageGroup: m.user?.ageGroup ?? m.ageCategory,
            };
          }),
        }
      : null,
  };
}
