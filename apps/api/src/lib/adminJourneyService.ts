import { prisma } from './prisma';
import type { HillCode } from '@prisma/client';

const STEP_BUCKETS = [
  { label: '0', min: 0, max: 0 },
  { label: '1-6', min: 1, max: 6 },
  { label: '7-13', min: 7, max: 13 },
  { label: '14-20', min: 14, max: 20 },
  { label: '21-34', min: 21, max: 34 },
  { label: '35-48', min: 35, max: 48 },
  { label: '49', min: 49, max: 49 },
];

export async function listJourneyUsers({
  page = 1,
  pageSize = 25,
  search,
  hillCode,
  campId,
  stepMin,
  stepMax,
}: {
  page?: number;
  pageSize?: number;
  search?: string;
  hillCode?: string;
  campId?: string;
  stepMin?: number;
  stepMax?: number;
}) {
  const where: Parameters<typeof prisma.user.findMany>[0]['where'] = {
    role: 'user',
  };

  if (search?.trim()) {
    const q = search.trim();
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { username: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (stepMin != null || stepMax != null) {
    where.currentStep = {};
    if (stepMin != null) where.currentStep.gte = stepMin;
    if (stepMax != null) where.currentStep.lte = stepMax;
  }

  if (campId) {
    const camp = await prisma.camp.findUnique({ where: { id: campId } });
    if (camp) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [{ currentCampId: campId }, { currentStep: { gte: camp.stepThreshold } }],
        },
      ];
    }
  }

  if (hillCode) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { gapAssessment: { focusHill: { code: hillCode as HillCode } } },
          { growthSets: { some: { hill: { code: hillCode as HillCode } } } },
        ],
      },
    ];
  }

  const skip = (page - 1) * pageSize;
  const [users, total, camps] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        currentStep: true,
        currentCampId: true,
        treeLevel: true,
        onboardingCompleted: true,
        walletCoins: true,
        createdAt: true,
        gapAssessment: { select: { focusHill: { select: { code: true, name: true } } } },
      },
      orderBy: [{ currentStep: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where }),
    prisma.camp.findMany({ orderBy: { number: 'asc' } }),
  ]);

  const campById = Object.fromEntries(camps.map((c) => [c.id, c]));

  return {
    items: users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      currentStep: u.currentStep,
      currentCamp: u.currentCampId ? campById[u.currentCampId]?.name ?? null : null,
      currentCampId: u.currentCampId,
      focusHill: u.gapAssessment?.focusHill?.code ?? null,
      focusHillName: u.gapAssessment?.focusHill?.name ?? null,
      treeLevel: u.treeLevel,
      onboardingCompleted: u.onboardingCompleted,
      walletCoins: u.walletCoins,
      createdAt: u.createdAt,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    filterOptions: { camps, stepBuckets: STEP_BUCKETS },
  };
}

export async function listJourneyUsersForExport(filters: Parameters<typeof listJourneyUsers>[0]) {
  const result = await listJourneyUsers({ ...filters, page: 1, pageSize: 10_000 });
  return result.items;
}

export async function getJourneyAdminOverview() {
  const [camps, hills, users, growthSets, avgStep] = await Promise.all([
    prisma.camp.findMany({ orderBy: { number: 'asc' } }),
    prisma.hill.findMany({ orderBy: { code: 'asc' } }),
    prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        currentStep: true,
        currentCampId: true,
        treeLevel: true,
        onboardingCompleted: true,
      },
      orderBy: { currentStep: 'desc' },
      take: 20,
    }),
    prisma.growthSet.count(),
    prisma.user.aggregate({ _avg: { currentStep: true }, _max: { currentStep: true } }),
  ]);

  const campById = Object.fromEntries(camps.map((c) => [c.id, c]));

  return {
    camps,
    hills: hills.map((h) => ({
      id: h.id,
      code: h.code,
      name: h.name,
      virtueName: h.virtueName,
      colorTheme: h.colorTheme,
      description: h.description,
    })),
    stepConfig: {
      stepsPerHill: 49,
      campThresholds: camps.map((c) => c.stepThreshold),
    },
    analytics: {
      totalGrowthSets: growthSets,
      averageStep: Math.round(avgStep._avg.currentStep ?? 0),
      maxStep: avgStep._max.currentStep ?? 0,
      usersAtSummit: users.filter((u) => u.currentStep >= 49).length,
    },
    topProgress: users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      currentStep: u.currentStep,
      currentCamp: u.currentCampId ? campById[u.currentCampId]?.name ?? null : null,
      treeLevel: u.treeLevel,
      onboardingCompleted: u.onboardingCompleted,
    })),
  };
}

export async function getJourneyAnalytics() {
  const [users, camps, growthSetCount] = await Promise.all([
    prisma.user.findMany({
      select: { currentStep: true, currentCampId: true, createdAt: true, onboardingCompleted: true },
    }),
    prisma.camp.findMany({ orderBy: { number: 'asc' } }),
    prisma.growthSet.count(),
  ]);

  const campDistribution = camps.map((camp) => ({
    campNumber: camp.number,
    campName: camp.name,
    stepThreshold: camp.stepThreshold,
    usersReached: users.filter((u) => u.currentStep >= camp.stepThreshold).length,
  }));

  const stepBuckets = [
    { label: '0 steps', min: 0, max: 0 },
    { label: '1–6', min: 1, max: 6 },
    { label: '7–13', min: 7, max: 13 },
    { label: '14–20', min: 14, max: 20 },
    { label: '21–34', min: 21, max: 34 },
    { label: '35–48', min: 35, max: 48 },
    { label: 'Summit (49)', min: 49, max: 49 },
  ].map((b) => ({
    ...b,
    count: users.filter((u) => u.currentStep >= b.min && u.currentStep <= b.max).length,
  }));

  return {
    campDistribution,
    stepBuckets,
    totalUsers: users.length,
    onboardingCompleted: users.filter((u) => u.onboardingCompleted).length,
    growthSetCompletions: growthSetCount,
  };
}
