import { OrganizationMembershipStatus, OrganizationStatus, Prisma } from '@prisma/client';
import { prisma } from './prisma';

export type OrganizationDemandTier = 'early' | 'growing' | 'high';

export function interestDemandTier(count: number): OrganizationDemandTier {
  if (count >= 50) return 'high';
  if (count >= 25) return 'growing';
  return 'early';
}

export function interestDemandLabel(tier: OrganizationDemandTier): string {
  switch (tier) {
    case 'high':
      return 'High';
    case 'growing':
      return 'Growing';
    default:
      return 'Early';
  }
}

const orgListSelect = {
  id: true,
  name: true,
  type: true,
  status: true,
  interestCount: true,
  cityId: true,
  city: { select: { name: true, state: { select: { name: true } } } },
  _count: {
    select: {
      memberships: { where: { endDate: null, status: OrganizationMembershipStatus.verified } },
      interests: true,
    },
  },
} satisfies Prisma.OrganizationSelect;

export type AdminOrganizationListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: OrganizationStatus;
  minInterest?: number;
  demandTier?: OrganizationDemandTier;
};

function orgListWhere(query: AdminOrganizationListQuery): Prisma.OrganizationWhereInput {
  const where: Prisma.OrganizationWhereInput = {};
  if (query.search?.trim()) {
    where.name = { contains: query.search.trim(), mode: 'insensitive' };
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.minInterest != null && query.minInterest > 0) {
    where.interestCount = { gte: query.minInterest };
  }
  if (query.demandTier === 'high') {
    where.interestCount = { gte: 50 };
  } else if (query.demandTier === 'growing') {
    where.interestCount = { gte: 25, lt: 50 };
  } else if (query.demandTier === 'early') {
    where.interestCount = { lt: 25 };
  }
  return where;
}

function mapOrgRow(org: Prisma.OrganizationGetPayload<{ select: typeof orgListSelect }>) {
  const tier = interestDemandTier(org.interestCount);
  return {
    id: org.id,
    name: org.name,
    type: org.type,
    status: org.status,
    interestCount: org.interestCount,
    demandTier: tier,
    demandLabel: interestDemandLabel(tier),
    cityName: org.city?.name ?? null,
    stateName: org.city?.state?.name ?? null,
    verifiedMemberCount: org._count.memberships,
    interestRecordCount: org._count.interests,
  };
}

export async function getOrganizationsAdminOverview(query: AdminOrganizationListQuery) {
  const where = orgListWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [total, organizations, statusCounts, highDemandCount] = await Promise.all([
    prisma.organization.count({ where }),
    prisma.organization.findMany({
      where,
      orderBy: [{ interestCount: 'desc' }, { name: 'asc' }],
      skip,
      take: query.pageSize,
      select: orgListSelect,
    }),
    prisma.organization.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.organization.count({ where: { interestCount: { gte: 50 } } }),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r._count._all]));

  return {
    stats: {
      totalOrganizations: await prisma.organization.count(),
      communityInterest: byStatus.community_interest ?? 0,
      gofamVerified: byStatus.gofam_verified ?? 0,
      listed: byStatus.listed ?? 0,
      highDemandCount,
    },
    items: organizations.map(mapOrgRow),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function listOrganizationsForExport(query: AdminOrganizationListQuery) {
  const organizations = await prisma.organization.findMany({
    where: orgListWhere(query),
    orderBy: [{ interestCount: 'desc' }, { name: 'asc' }],
    take: 5000,
    select: orgListSelect,
  });
  return organizations.map(mapOrgRow);
}

export async function getOrganizationAdminDetail(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      ...orgListSelect,
      orgGroupId: true,
      memberships: {
        where: { endDate: null },
        orderBy: { startDate: 'desc' },
        take: 50,
        select: {
          id: true,
          status: true,
          startDate: true,
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              ageGroup: true,
            },
          },
        },
      },
    },
  });
  if (!org) return null;

  const pendingCount = org.memberships.filter((m) => m.status === 'pending').length;
  const verifiedCount = org.memberships.filter((m) => m.status === 'verified').length;

  return {
    ...mapOrgRow(org),
    orgGroupId: org.orgGroupId,
    memberships: org.memberships.map((m) => ({
      id: m.id,
      status: m.status,
      startDate: m.startDate.toISOString(),
      user: {
        id: m.user.id,
        username: m.user.username,
        displayName: m.user.displayName,
        ageGroup: m.user.ageGroup,
      },
    })),
    pendingMembershipCount: pendingCount,
    activeVerifiedCount: verifiedCount,
    marketingNote:
      org.interestCount >= 50
        ? `More than 50 users have expressed interest in GOFAM for this organisation (aggregate only — not verified members).`
        : org.interestCount >= 25
          ? `${org.interestCount} users have expressed interest (aggregate demand signal).`
          : null,
  };
}

export async function listPendingMemberships(organizationId: string) {
  return prisma.organizationMembership.findMany({
    where: {
      organizationId,
      status: OrganizationMembershipStatus.pending,
      endDate: null,
    },
    orderBy: { startDate: 'asc' },
    select: {
      id: true,
      status: true,
      startDate: true,
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          ageGroup: true,
        },
      },
    },
  });
}
