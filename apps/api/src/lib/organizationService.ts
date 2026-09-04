import {
  OrganizationMembershipStatus,
  OrganizationStatus,
  type Organization,
  type Prisma,
} from '@prisma/client';
import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';

export type OrganizationSearchResult = {
  id: string;
  name: string;
  type: string;
  status: OrganizationStatus;
  statusLabel: string;
  interestCount: number;
  cityName: string | null;
  isGofamVerified: boolean;
  userHasInterest: boolean;
  userMembershipStatus: OrganizationMembershipStatus | null;
  canExpressInterest: boolean;
  canRequestVerification: boolean;
};

function statusLabel(status: OrganizationStatus): string {
  switch (status) {
    case 'gofam_verified':
      return 'GOFAM Verified School';
    case 'community_interest':
      return 'Not yet a GOFAM Verified School';
    default:
      return 'Listed organization';
  }
}

export async function searchOrganizationsForUser(
  userId: string,
  query: string,
  cityId?: string,
): Promise<OrganizationSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [organizations, userInterests, userMemberships] = await Promise.all([
    prisma.organization.findMany({
      where: {
        name: { contains: q, mode: 'insensitive' },
        ...(cityId ? { cityId } : {}),
      },
      orderBy: [{ status: 'desc' }, { interestCount: 'desc' }, { name: 'asc' }],
      take: 20,
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        interestCount: true,
        city: { select: { name: true } },
      },
    }),
    prisma.organizationInterest.findMany({
      where: { userId },
      select: { organizationId: true },
    }),
    prisma.organizationMembership.findMany({
      where: { userId, endDate: null },
      select: { organizationId: true, status: true },
    }),
  ]);

  const interestSet = new Set(userInterests.map((i) => i.organizationId).filter(Boolean));
  const membershipByOrg = new Map(userMemberships.map((m) => [m.organizationId, m.status]));

  return organizations.map((org) => {
    const isGofamVerified = org.status === OrganizationStatus.gofam_verified;
    const userMembershipStatus = membershipByOrg.get(org.id) ?? null;
    return {
      id: org.id,
      name: org.name,
      type: org.type,
      status: org.status,
      statusLabel: statusLabel(org.status),
      interestCount: org.interestCount,
      cityName: org.city?.name ?? null,
      isGofamVerified,
      userHasInterest: interestSet.has(org.id),
      userMembershipStatus,
      canExpressInterest:
        !isGofamVerified && !interestSet.has(org.id) && userMembershipStatus !== 'verified',
      canRequestVerification:
        isGofamVerified && userMembershipStatus !== 'verified',
    };
  });
}

/**
 * Register aggregate interest only — never grants membership or leaderboard presence.
 * Aggregate count may be shared with schools; individual identities are never exposed.
 */
export async function expressOrganizationInterest(
  userId: string,
  input: { organizationId?: string; organizationName?: string },
) {
  if (!input.organizationId && !input.organizationName?.trim()) {
    throw new AppError('Provide a school name or select an organization', 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cityId: true },
  });
  if (!user) throw new AppError('User not found', 404);

  let organizationId = input.organizationId ?? null;
  let organization: Organization | null = null;

  if (organizationId) {
    organization = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new AppError('Organization not found', 404);
    if (organization.status === OrganizationStatus.gofam_verified) {
      throw new AppError(
        'This school is GOFAM verified — use an official invite code to request membership, not Add My Interest.',
        409,
      );
    }
  } else {
    const name = input.organizationName!.trim();
    organization = await prisma.organization.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(user.cityId ? { cityId: user.cityId } : {}),
      },
    });
    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name,
          type: 'school',
          status: OrganizationStatus.community_interest,
          cityId: user.cityId,
        },
      });
    }
    organizationId = organization.id;
  }

  const existingInterest = await prisma.organizationInterest.findFirst({
    where: { userId, organizationId },
  });

  if (!existingInterest) {
    await prisma.$transaction([
      prisma.organizationInterest.create({
        data: {
          userId,
          organizationId,
          organizationName: input.organizationName?.trim() || null,
        },
      }),
      prisma.organization.update({
        where: { id: organizationId },
        data: {
          interestCount: { increment: 1 },
          ...(organization!.status === OrganizationStatus.listed
            ? { status: OrganizationStatus.community_interest }
            : {}),
        },
      }),
    ]);
  }

  const updated = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { id: true, name: true, status: true, interestCount: true },
  });

  return {
    organizationId: updated.id,
    organizationName: updated.name,
    status: updated.status,
    interestCount: updated.interestCount,
    alreadyRegistered: Boolean(existingInterest),
    message:
      'Thanks — your interest helps GOFAM reach your school. This does not make you a verified member and your name is never shared with schools.',
  };
}

/** Close open memberships when switching org (audit trail via endDate). */
async function endActiveMemberships(userId: string, exceptOrgId?: string) {
  await prisma.organizationMembership.updateMany({
    where: {
      userId,
      endDate: null,
      ...(exceptOrgId ? { organizationId: { not: exceptOrgId } } : {}),
    },
    data: { endDate: new Date() },
  });
}

/**
 * Request membership at a GOFAM-verified org. Requests always land as pending for admin review.
 */
export async function requestOrganizationMembership(userId: string, organizationId: string) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new AppError('Organization not found', 404);

  if (org.status !== OrganizationStatus.gofam_verified) {
    throw new AppError(
      `${org.name} is not a GOFAM Verified School yet. Tap Add My Interest instead — that only counts demand, it does not verify you.`,
      409,
    );
  }

  const status = OrganizationMembershipStatus.pending;

  await endActiveMemberships(userId, organizationId);

  const existing = await prisma.organizationMembership.findFirst({
    where: { userId, organizationId, endDate: null },
  });

  let membership;
  if (existing) {
    membership = await prisma.organizationMembership.update({
      where: { id: existing.id },
      data: { status, startDate: new Date() },
    });
  } else {
    membership = await prisma.organizationMembership.create({
      data: { userId, organizationId, status },
    });
  }

  return {
    membership: {
      id: membership.id,
      organizationId,
      organizationName: org.name,
      status: membership.status,
      startDate: membership.startDate.toISOString(),
    },
    message: `Verification pending for ${org.name}. An admin will review your request.`,
  };
}

export async function deferBelongingSetup(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { belongingSetupDeferred: true },
    select: { id: true, belongingSetupDeferred: true },
  });
}

export async function getBelongingOverview(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      cityId: true,
      city: { select: { id: true, name: true } },
      state: { select: { name: true } },
      country: { select: { name: true } },
      belongingSetupDeferred: true,
    },
  });

  const [interests, memberships] = await Promise.all([
    prisma.organizationInterest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        organization: {
          select: { id: true, name: true, status: true, interestCount: true },
        },
      },
    }),
    prisma.organizationMembership.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
      include: {
        organization: { select: { id: true, name: true, status: true } },
      },
    }),
  ]);

  const prompts: Array<{
    type: 'org_verified';
    organizationId: string;
    organizationName: string;
  }> = [];

  for (const interest of interests) {
    const org = interest.organization;
    if (!org || org.status !== OrganizationStatus.gofam_verified) continue;
    if (interest.verifiedNotifiedAt) continue;

    const activeMembership = memberships.find(
      (m) => m.organizationId === org.id && !m.endDate && m.status === 'verified',
    );
    if (activeMembership) {
      await prisma.organizationInterest.update({
        where: { id: interest.id },
        data: { verifiedNotifiedAt: new Date() },
      });
      continue;
    }

    prompts.push({
      type: 'org_verified',
      organizationId: org.id,
      organizationName: org.name,
    });
  }

  return {
    location: user
      ? {
          city: user.city?.name ?? null,
          state: user.state?.name ?? null,
          country: user.country?.name ?? null,
          cityId: user.cityId,
        }
      : null,
    belongingSetupDeferred: user?.belongingSetupDeferred ?? false,
    interests: interests.map((i) => ({
      id: i.id,
      organizationId: i.organizationId,
      organizationName: i.organization?.name ?? i.organizationName,
      status: i.organization?.status ?? 'community_interest',
      interestCount: i.organization?.interestCount ?? null,
      createdAt: i.createdAt.toISOString(),
    })),
    memberships: memberships.map((m) => ({
      id: m.id,
      organizationId: m.organizationId,
      organizationName: m.organization.name,
      organizationStatus: m.organization.status,
      status: m.status,
      startDate: m.startDate.toISOString(),
      endDate: m.endDate?.toISOString() ?? null,
      isActive: !m.endDate,
    })),
    prompts,
  };
}

/** Mark interest notifications seen after user dismisses the "school joined" prompt. */
export async function acknowledgeOrgVerifiedPrompt(userId: string, organizationId: string) {
  await prisma.organizationInterest.updateMany({
    where: { userId, organizationId, verifiedNotifiedAt: null },
    data: { verifiedNotifiedAt: new Date() },
  });
  return { ok: true };
}

/** Admin approves a pending membership — only verified members rank on org leaderboards. */
export async function approveOrganizationMembership(membershipId: string) {
  const membership = await prisma.organizationMembership.findUnique({
    where: { id: membershipId },
    include: { organization: { select: { id: true, name: true, status: true } } },
  });
  if (!membership) throw new AppError('Membership not found', 404);
  if (membership.endDate) throw new AppError('This membership is no longer active', 409);
  if (membership.organization.status !== OrganizationStatus.gofam_verified) {
    throw new AppError('Organization must be GOFAM verified before approving memberships', 409);
  }

  await endActiveMemberships(membership.userId, membership.organizationId);

  const updated = await prisma.organizationMembership.update({
    where: { id: membershipId },
    data: { status: OrganizationMembershipStatus.verified, startDate: new Date() },
  });

  return {
    membership: {
      id: updated.id,
      userId: updated.userId,
      organizationId: updated.organizationId,
      organizationName: membership.organization.name,
      status: updated.status,
      startDate: updated.startDate.toISOString(),
    },
    message: `Membership verified at ${membership.organization.name}.`,
  };
}

/** Admin rejects a pending membership request. */
export async function rejectOrganizationMembership(membershipId: string) {
  const membership = await prisma.organizationMembership.findUnique({
    where: { id: membershipId },
    include: { organization: { select: { name: true } } },
  });
  if (!membership) throw new AppError('Membership not found', 404);
  if (membership.endDate) throw new AppError('This membership is no longer active', 409);
  if (membership.status !== OrganizationMembershipStatus.pending) {
    throw new AppError('Only pending memberships can be rejected', 409);
  }

  const updated = await prisma.organizationMembership.update({
    where: { id: membershipId },
    data: {
      status: OrganizationMembershipStatus.unverified,
      endDate: new Date(),
    },
  });

  return {
    membership: {
      id: updated.id,
      userId: updated.userId,
      organizationId: updated.organizationId,
      organizationName: membership.organization.name,
      status: updated.status,
      endDate: updated.endDate?.toISOString() ?? null,
    },
    message: 'Membership request rejected.',
  };
}

/** Admin / partnership flow: org becomes verified; interested users get prompted (not auto-enrolled). */
export async function markOrganizationGofamVerified(organizationId: string) {
  const org = await prisma.organization.update({
    where: { id: organizationId },
    data: { status: OrganizationStatus.gofam_verified },
  });
  return {
    organization: org,
    message:
      'Organization is now GOFAM verified. Previously interested users will be prompted to complete verification — interest does not auto-convert.',
  };
}

function membershipAgeGroupFilter(ageGroup?: string | null): Prisma.UserWhereInput {
  if (!ageGroup) return {};
  if (['S1E', 'S1G', 'S1R'].includes(ageGroup)) {
    return { ageGroup: { in: ['S1E', 'S1G', 'S1R'] } };
  }
  return { ageGroup };
}

export async function rankUserInVerifiedOrganization(
  userId: string,
  organizationId: string,
  ageGroup?: string | null,
  schoolStandard?: string | null,
  schoolSection?: string | null,
): Promise<{ rank: number; total: number } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { flowLeadershipInternal: true, onboardingCompleted: true },
  });
  if (!user?.onboardingCompleted) return null;

  const members = await prisma.organizationMembership.findMany({
    where: {
      organizationId,
      status: OrganizationMembershipStatus.verified,
      endDate: null,
      user: {
        onboardingCompleted: true,
        accountStatus: 'active',
        role: 'user',
        officialAccount: false,
        ...membershipAgeGroupFilter(ageGroup),
        ...(schoolStandard ? { standard: schoolStandard } : {}),
        ...(schoolSection ? { section: schoolSection } : {}),
      },
    },
    select: { userId: true, user: { select: { flowLeadershipInternal: true } } },
  });

  if (members.length === 0) return null;
  const better = members.filter(
    (m) => m.user.flowLeadershipInternal > user.flowLeadershipInternal,
  ).length;
  return { rank: better + 1, total: members.length };
}
