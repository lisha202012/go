import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function last7DaySeries(countForRange: (start: Date, end: Date) => Promise<number>) {
  const series = [];
  for (let i = 6; i >= 0; i -= 1) {
    const start = startOfDay(new Date(Date.now() - i * 86_400_000));
    const end = new Date(start.getTime() + 86_400_000);
    series.push({
      date: start.toISOString().slice(0, 10),
      count: await countForRange(start, end),
    });
  }
  return series;
}

export async function getAdminDashboardOverview() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [
    userCount,
    missionCount,
    completedMissions,
    glowSeedCount,
    acceptedSeeds,
    familyCount,
    auditLogCount,
    camps,
    hills,
    newUsersWeek,
    completionsWeek,
    glowWeek,
    auditWeek,
    usersSeries,
    missionsSeries,
    glowSeries,
    auditSeries,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'user' } }),
    prisma.mission.count(),
    prisma.userMissionProgress.count({ where: { status: 'completed' } }),
    prisma.glowSeed.count(),
    prisma.glowSeed.count({ where: { status: 'accepted' } }),
    prisma.family.count(),
    prisma.auditLog.count(),
    prisma.camp.findMany({ orderBy: { number: 'asc' } }),
    prisma.hill.findMany({ orderBy: { code: 'asc' } }),
    prisma.user.count({ where: { role: 'user', createdAt: { gte: weekAgo } } }),
    prisma.userMissionProgress.count({
      where: { status: 'completed', completedAt: { gte: weekAgo } },
    }),
    prisma.glowSeed.count({ where: { sentAt: { gte: weekAgo } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: weekAgo } } }),
    last7DaySeries((start, end) =>
      prisma.user.count({ where: { role: 'user', createdAt: { gte: start, lt: end } } }),
    ),
    last7DaySeries((start, end) =>
      prisma.userMissionProgress.count({
        where: { status: 'completed', completedAt: { gte: start, lt: end } },
      }),
    ),
    last7DaySeries((start, end) =>
      prisma.glowSeed.count({ where: { sentAt: { gte: start, lt: end } } }),
    ),
    last7DaySeries((start, end) =>
      prisma.auditLog.count({ where: { createdAt: { gte: start, lt: end } } }),
    ),
  ]);

  const missionsByHill = await prisma.mission.groupBy({
    by: ['hillId'],
    _count: { id: true },
  });

  const hillMap = Object.fromEntries(hills.map((h) => [h.id, h.code]));

  return {
    totals: {
      users: userCount,
      missions: missionCount,
      completedMissions,
      glowSeeds: glowSeedCount,
      acceptedGlowSeeds: acceptedSeeds,
      families: familyCount,
      auditLogs: auditLogCount,
    },
    missionsByHill: missionsByHill.map((row) => ({
      hillCode: hillMap[row.hillId] ?? row.hillId,
      count: row._count.id,
    })),
    camps,
    hills,
    trends: {
      thisWeek: {
        newUsers: newUsersWeek,
        missionCompletions: completionsWeek,
        glowSeeds: glowWeek,
        auditEvents: auditWeek,
      },
      series: {
        newUsers: usersSeries,
        missionCompletions: missionsSeries,
        glowSeeds: glowSeries,
        auditEvents: auditSeries,
      },
    },
  };
}

export async function listAdminMissions({
  categoryCode,
  hillCode,
  missionGroup,
  search,
  page = 1,
  pageSize = 25,
}: {
  categoryCode?: string;
  hillCode?: string;
  missionGroup?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
const where: Prisma.MissionWhereInput = {};

  if (categoryCode) where.categoryCode = categoryCode;
  if (missionGroup) where.missionGroup = missionGroup;
  if (hillCode) {
    const hill = await prisma.hill.findUnique({ where: { code: hillCode as never } });
    if (hill) where.hillId = hill.id;
  }
  if (search?.trim()) {
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { description: { contains: search.trim(), mode: 'insensitive' } },
      { externalId: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    prisma.mission.findMany({
      where,
      include: { hill: true },
      orderBy: [{ categoryCode: 'asc' }, { order: 'asc' }],
      skip,
      take: pageSize,
    }),
    prisma.mission.count({ where }),
  ]);

  return {
    items: items.map((m) => ({
      id: m.id,
      externalId: m.externalId,
      title: m.title,
      description: m.description,
      categoryCode: m.categoryCode,
      hillCode: m.hill.code,
      hillName: m.hill.name,
      missionGroup: m.missionGroup,
      order: m.order,
      coinReward: m.coinReward,
      pulseReward: m.pulseReward,
      requiresReflection: m.requiresReflection,
      requiresEvidence: m.requiresEvidence,
      isFamilyMission: m.isFamilyMission,
      isDisabled: m.isDisabled,
      disabledAt: m.disabledAt,
      disabledReason: m.disabledReason,
      verificationType: m.requiresEvidence
        ? 'evidence'
        : m.requiresReflection
          ? 'reflection'
          : m.isFamilyMission
            ? 'family'
            : 'none',
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getMissionEngineAnalytics() {
  const [byHill, byCategory, byGroup, completionByHill, disabledCount, totalMissions] =
    await Promise.all([
    prisma.mission.groupBy({ by: ['hillId'], _count: { id: true } }),
    prisma.mission.groupBy({ by: ['categoryCode'], _count: { id: true } }),
    prisma.mission.groupBy({ by: ['missionGroup'], _count: { id: true } }),
    prisma.userMissionProgress.groupBy({
      by: ['missionId'],
      where: { status: 'completed' },
      _count: { id: true },
    }),
    prisma.mission.count({ where: { isDisabled: true } }),
    prisma.mission.count(),
  ]);

  const missions = await prisma.mission.findMany({
    select: { id: true, hillId: true, categoryCode: true },
  });
  const missionHill = Object.fromEntries(missions.map((m) => [m.id, m.hillId]));
  const hills = await prisma.hill.findMany();
  const hillCodeById = Object.fromEntries(hills.map((h) => [h.id, h.code]));

  const completionsPerHill: Record<string, number> = {};
  for (const row of completionByHill) {
    const hillId = missionHill[row.missionId];
    const code = hillCodeById[hillId] ?? 'unknown';
    completionsPerHill[code] = (completionsPerHill[code] ?? 0) + row._count.id;
  }

  return {
    catalog: {
      byHill: byHill.map((r) => ({ hillCode: hillCodeById[r.hillId], count: r._count.id })),
      byCategory: byCategory.map((r) => ({ categoryCode: r.categoryCode, count: r._count.id })),
      byGroup: byGroup.map((r) => ({ missionGroup: r.missionGroup, count: r._count.id })),
      disabledMissions: disabledCount,
      activeMissions: totalMissions - disabledCount,
    },
    completions: {
      byHill: Object.entries(completionsPerHill).map(([hillCode, count]) => ({ hillCode, count })),
      total: completionByHill.reduce((sum, r) => sum + r._count.id, 0),
      byCategory: await completionCountsByCategory(completionByHill),
    },
  };
}

async function completionCountsByCategory(
  completionByHill: { missionId: string; _count: { id: number } }[],
) {
  const missions = await prisma.mission.findMany({
    select: { id: true, categoryCode: true },
  });
  const categoryByMission = Object.fromEntries(missions.map((m) => [m.id, m.categoryCode]));
  const counts: Record<string, number> = {};
  for (const row of completionByHill) {
    const cat = categoryByMission[row.missionId] ?? 'unknown';
    counts[cat] = (counts[cat] ?? 0) + row._count.id;
  }
  return Object.entries(counts)
    .map(([categoryCode, count]) => ({ categoryCode, count }))
    .sort((a, b) => b.count - a.count);
}
