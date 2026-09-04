import { Prisma } from '@prisma/client';

import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';

export async function getTrustSafetyOverview({
  page = 1,
  pageSize = 25,
  search,
}: {
  page?: number;
  pageSize?: number;
  search?: string;
}) {
const where: Prisma.UserWhereInput = {};
  if (search?.trim()) {
    const q = search.trim();
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { username: { contains: q, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * pageSize;
  const [users, filteredTotal, totalUsers, childProfiles, adminUsers] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        ageGroup: true,
        isChildProfile: true,
        walletCoins: true,
        currentStep: true,
        treeLevel: true,
        onboardingCompleted: true,
        accountStatus: true,
        suspendedAt: true,
        suspendedReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { role: 'user' } }),
    prisma.user.count({ where: { isChildProfile: true } }),
    prisma.user.count({ where: { role: 'admin' } }),
  ]);

  return {
    summary: {
      totalUsers,
      childProfiles,
      adminUsers,
    },
    users,
    pagination: { page, pageSize, total: filteredTotal, totalPages: Math.ceil(filteredTotal / pageSize) },
  };
}

export async function listTrustSafetyUsersForExport(
  filters: Parameters<typeof getTrustSafetyOverview>[0],
) {
  const result = await getTrustSafetyOverview({ ...filters, page: 1, pageSize: 10_000 });
  return result.users;
}

export async function getAdminUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      currentCamp: true,
      family: {
        include: {
          roster: {
            include: {
              user: { select: { id: true, username: true, email: true, isChildProfile: true } },
            },
          },
        },
      },
      gapAssessment: {
        include: {
          focusHill: { select: { code: true, name: true } },
          strongestHill: { select: { code: true, name: true } },
          hillScores: {
            include: { hill: { select: { code: true, name: true } } },
            orderBy: { hill: { code: 'asc' } },
          },
        },
      },
      adminStaffRoles: { select: { role: true, institutionId: true, grantedAt: true } },
    },
  });

  if (!user) return null;

  const [missionsCompleted, missionsInProgress, glowSent, glowReceived, growthSets, recentLedger, recentAudit] =
    await Promise.all([
      prisma.userMissionProgress.count({ where: { userId, status: 'completed' } }),
      prisma.userMissionProgress.count({ where: { userId, status: 'current' } }),
      prisma.glowSeed.count({ where: { senderId: userId } }),
      prisma.glowSeed.count({ where: { receiverId: userId } }),
      prisma.growthSet.count({ where: { userId } }),
      prisma.coinLedgerEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { id: true, amount: true, ledgerType: true, source: true, createdAt: true },
      }),
      prisma.auditLog.findMany({
        where: { OR: [{ subjectUserId: userId }, { actorUserId: userId }] },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: {
          actorUser: { select: { email: true } },
        },
      }),
    ]);

  return {
    profile: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      ageGroup: user.ageGroup,
      countryName: user.countryName,
      stateName: user.stateName,
      cityName: user.cityName,
      standard: user.standard,
      section: user.section,
      isChildProfile: user.isChildProfile,
      accountStatus: user.accountStatus,
      suspendedAt: user.suspendedAt,
      suspendedReason: user.suspendedReason,
      walletCoins: user.walletCoins,
      growthCoinsLifetime: user.growthCoinsLifetime,
      flowIndex: user.flowIndex,
      currentStep: user.currentStep,
      currentCamp: user.currentCamp,
      treeLevel: user.treeLevel,
      seedInventoryCount: user.seedInventoryCount,
      currentStreak: user.currentStreak,
      onboardingCompleted: user.onboardingCompleted,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      gapAssessment: user.gapAssessment,
      staffRoles: user.adminStaffRoles,
    },
    family: user.family
      ? {
          id: user.family.id,
          name: user.family.name,
          members: user.family.roster.map((m) => m.user).filter(Boolean),
        }
      : null,
    activity: {
      missionsCompleted,
      missionsInProgress,
      glowSent,
      glowReceived,
      growthSetsCompleted: growthSets,
    },
    recentLedger,
    recentAudit: recentAudit.map((log) => ({
      id: log.id,
      module: log.module,
      action: log.action,
      createdAt: log.createdAt,
      actor: log.actorUser?.email ?? 'system',
    })),
  };
}

export async function prepareAdminUserDeletion(userId: string, actorUserId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      familyId: true,
      accountStatus: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  if (user.role === 'admin') {
    throw new AppError('Staff accounts cannot be deleted from the admin console', 403);
  }

  if (user.id === actorUserId) {
    throw new AppError('You cannot delete your own account while signed in', 403);
  }

  const [
    missionsCompleted,
    missionsInProgress,
    glowSent,
    glowReceived,
    growthSets,
    ledgerCount,
    sessionCount,
  ] = await Promise.all([
    prisma.userMissionProgress.count({ where: { userId, status: 'completed' } }),
    prisma.userMissionProgress.count({ where: { userId, status: 'current' } }),
    prisma.glowSeed.count({ where: { senderId: userId } }),
    prisma.glowSeed.count({ where: { receiverId: userId } }),
    prisma.growthSet.count({ where: { userId } }),
    prisma.coinLedgerEntry.count({ where: { userId } }),
    prisma.refreshToken.count({ where: { userId } }),
  ]);

  const beforeJson = {
    ...user,
    relatedCounts: {
      missionsCompleted,
      missionsInProgress,
      glowSent,
      glowReceived,
      growthSets,
      ledgerEntries: ledgerCount,
      sessions: sessionCount,
    },
  };

  return { user, beforeJson };
}

export async function commitAdminUserDeletion(userId: string, familyId: string | null) {
  await prisma.$transaction(async (tx) => {
    await tx.familyMember.deleteMany({ where: { userId } });
    await tx.familyMember.updateMany({
      where: { invitedByUserId: userId },
      data: { invitedByUserId: null },
    });
    await tx.user.delete({ where: { id: userId } });
  });

  if (familyId) {
    const [usersLeft, rosterLeft] = await Promise.all([
      prisma.user.count({ where: { familyId } }),
      prisma.familyMember.count({ where: { familyId } }),
    ]);
    if (usersLeft === 0 && rosterLeft === 0) {
      await prisma.family.delete({ where: { id: familyId } }).catch(() => undefined);
    }
  }
}
