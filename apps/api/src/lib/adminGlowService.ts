import { Prisma } from '@prisma/client';
import type { GlowSeedStatus } from '@prisma/client';
import { prisma } from './prisma';

export async function listGlowSeeds({
  page = 1,
  pageSize = 25,
  search,
  status,
  dateFrom,
  dateTo,
  flaggedOnly,
}: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: GlowSeedStatus;
  dateFrom?: string;
  dateTo?: string;
  flaggedOnly?: boolean;
}) {
const where: Prisma.GlowSeedWhereInput = {};

  if (status) where.status = status;

  if (dateFrom || dateTo) {
    where.sentAt = {};
    if (dateFrom) where.sentAt.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.sentAt.lte = end;
    }
  }

  if (search?.trim()) {
    const q = search.trim();
    where.OR = [
      { sender: { email: { contains: q, mode: 'insensitive' } } },
      { sender: { username: { contains: q, mode: 'insensitive' } } },
      { receiver: { email: { contains: q, mode: 'insensitive' } } },
      { receiver: { username: { contains: q, mode: 'insensitive' } } },
    ];
  }

  if (flaggedOnly) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { sender: { accountStatus: 'suspended' } },
          { receiver: { accountStatus: 'suspended' } },
          { status: 'expired' },
        ],
      },
    ];
  }

  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    prisma.glowSeed.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        sender: { select: { id: true, username: true, email: true, accountStatus: true } },
        receiver: { select: { id: true, username: true, email: true, accountStatus: true } },
      },
    }),
    prisma.glowSeed.count({ where }),
  ]);

  return {
    items: items.map((s) => ({
      id: s.id,
      status: s.status,
      sentAt: s.sentAt,
      expiresAt: s.expiresAt,
      acceptedAt: s.acceptedAt,
      virtue: s.virtue,
      sender: s.sender,
      receiver: s.receiver,
      flagged:
        s.status === 'expired' ||
        s.sender.accountStatus === 'suspended' ||
        s.receiver?.accountStatus === 'suspended',
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function listGlowSeedsForExport(filters: Parameters<typeof listGlowSeeds>[0]) {
  const result = await listGlowSeeds({ ...filters, page: 1, pageSize: 10_000 });
  return result.items;
}

export async function getGlowAdminOverview() {
  const [configs, seeds, virtues, recentSeeds] = await Promise.all([
    prisma.adminConfig.findMany({
      where: {
        key: {
          in: [
            'welcome_bonus',
            'max_seed_inventory',
            'seed_expiry_days',
            'monthly_send_limit',
            'virtue_probabilities',
          ],
        },
      },
    }),
    prisma.glowSeed.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.activeVirtue.groupBy({ by: ['virtue'], _count: { id: true } }),
    prisma.glowSeed.findMany({
      orderBy: { sentAt: 'desc' },
      take: 25,
      include: {
        sender: { select: { id: true, username: true, email: true } },
        receiver: { select: { id: true, username: true, email: true } },
      },
    }),
  ]);

  const statusCounts = Object.fromEntries(seeds.map((s) => [s.status, s._count.id]));
  const total = seeds.reduce((sum, s) => sum + s._count.id, 0);
  const accepted = statusCounts.accepted ?? 0;

  return {
    rules: Object.fromEntries(configs.map((c) => [c.key, c.value])),
    analytics: {
      totalSeeds: total,
      pending: statusCounts.pending ?? 0,
      accepted,
      expired: statusCounts.expired ?? 0,
      acceptanceRate: total ? Math.round((accepted / total) * 100) : 0,
      virtueDistribution: virtues.map((v) => ({ virtue: v.virtue, count: v._count.id })),
    },
    recentSeeds: recentSeeds.map((s) => ({
      id: s.id,
      status: s.status,
      sentAt: s.sentAt,
      expiresAt: s.expiresAt,
      acceptedAt: s.acceptedAt,
      virtue: s.virtue,
      sender: s.sender,
      receiver: s.receiver,
    })),
  };
}

export async function getGlowAnalytics() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [recentSeeds, senders, receivers] = await Promise.all([
    prisma.glowSeed.findMany({
      where: { sentAt: { gte: thirtyDaysAgo } },
      select: { status: true, sentAt: true, virtue: true },
    }),
    prisma.glowSeed.groupBy({
      by: ['senderId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    prisma.glowSeed.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
  ]);

  const dailyBuckets: Record<string, { sent: number; accepted: number }> = {};
  for (const seed of recentSeeds) {
    const day = seed.sentAt.toISOString().slice(0, 10);
    if (!dailyBuckets[day]) dailyBuckets[day] = { sent: 0, accepted: 0 };
    dailyBuckets[day].sent += 1;
    if (seed.status === 'accepted') dailyBuckets[day].accepted += 1;
  }

  const statusCounts = Object.fromEntries(receivers.map((r) => [r.status, r._count.id]));

  return {
    last30Days: {
      totalSent: recentSeeds.length,
      accepted: recentSeeds.filter((s) => s.status === 'accepted').length,
      acceptanceRate: recentSeeds.length
        ? Math.round((recentSeeds.filter((s) => s.status === 'accepted').length / recentSeeds.length) * 100)
        : 0,
      dailyTrend: Object.entries(dailyBuckets)
        .map(([date, counts]) => ({ date, ...counts }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    },
    allTimeStatus: statusCounts,
    topSenders: senders.length,
  };
}
