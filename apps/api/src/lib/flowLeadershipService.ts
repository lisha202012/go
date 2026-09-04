import { OrganizationMembershipStatus, OrganizationStatus, type Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { getHillStepCounts } from './hillStepService';
import { rankUserInVerifiedOrganization } from './organizationService';
import { syncUserAgeGroupFromDob } from './userAgeSync';

const MAX_FLOW_INDEX = 100;
const MAX_GROWTH_STARS = 3;
const MAX_TOTAL_STEPS = 343;

const SPROUT_CODES = ['S1E', 'S1G', 'S1R'] as const;

export type LeadershipWho = 'category' | 'all' | 'specificCategory';
export type LeadershipWhere =
  | 'world'
  | 'country'
  | 'state'
  | 'city'
  | 'organization'
  | 'orgGroup';

export type LeadershipFilterInput = {
  who?: LeadershipWho;
  ageGroup?: string | null;
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  organizationId?: string | null;
  schoolStandard?: string | null;
  schoolSection?: string | null;
  where?: LeadershipWhere;
};

export type FlowLeadershipBreakdown = {
  internal: number;
  display: number;
};

export type RankResult = { rank: number; total: number };
export type LeaderboardEntry = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  flowLeadershipInternal: number;
  flowLeadershipScore: number;
  rank: number;
};

export function computeFlowLeadershipFromInputs(input: {
  flowIndex: number;
  treeStars: number;
  totalSteps: number;
}): FlowLeadershipBreakdown {
  const flowIndex = Math.max(0, Math.min(MAX_FLOW_INDEX, input.flowIndex));
  const treeStars = Math.max(0, Math.min(MAX_GROWTH_STARS, input.treeStars));
  const totalSteps = Math.max(0, Math.min(MAX_TOTAL_STEPS, input.totalSteps));

  const internal =
    flowIndex * 0.2 +
    (treeStars / MAX_GROWTH_STARS) * 100 * 0.2 +
    (totalSteps / MAX_TOTAL_STEPS) * 100 * 0.6;

  return {
    internal,
    display: Math.round(internal),
  };
}

export async function sumTotalHillSteps(userId: string): Promise<number> {
  const counts = await getHillStepCounts(userId);
  let total = 0;
  for (const steps of counts.values()) {
    total += steps;
  }
  return Math.min(MAX_TOTAL_STEPS, total);
}

export async function computeFlowLeadershipForUser(userId: string): Promise<FlowLeadershipBreakdown> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      flowIndex: true,
      treeStars: true,
    },
  });
  const totalSteps = await sumTotalHillSteps(userId);
  return computeFlowLeadershipFromInputs({
    flowIndex: user.flowIndex,
    treeStars: user.treeStars,
    totalSteps,
  });
}

export async function syncFlowLeadershipScore(userId: string): Promise<FlowLeadershipBreakdown> {
  const computed = await computeFlowLeadershipForUser(userId);
  await prisma.user.update({
    where: { id: userId },
    data: {
      flowLeadershipScore: computed.display,
      flowLeadershipInternal: computed.internal,
    },
  });
  return computed;
}

/** Sprout sub-stages compete as one Sprouts category (POC). */
export function resolveWhoUserFilter(
  who: LeadershipWho,
  ageGroup: string | null,
): Prisma.UserWhereInput {
  if (who === 'all' || !ageGroup) return {};
  if (SPROUT_CODES.includes(ageGroup as (typeof SPROUT_CODES)[number])) {
    return { ageGroup: { in: [...SPROUT_CODES] } };
  }
  return { ageGroup };
}

function explicitOrDefault<T>(value: T | null | undefined, fallback: T | null): T | null {
  return value === undefined ? fallback : value;
}

export function leadershipCategoryLabel(ageGroup: string | null): string {
  if (!ageGroup) return 'My Category';
  if (SPROUT_CODES.includes(ageGroup as (typeof SPROUT_CODES)[number])) return 'Sprouts';
  const labels: Record<string, string> = {
    A2: 'Adorables',
    B3: 'Bravehearts',
    C4: 'Challengers',
    D5: 'Discoverers',
    V6: 'Voyagers',
    N7: 'Navigators',
  };
  return labels[ageGroup] ?? ageGroup;
}

type RankFilter = {
  who?: LeadershipWho;
  ageGroup?: string | null;
  cityId?: string | null;
  stateId?: string | null;
  countryId?: string | null;
  organizationId?: string | null;
  schoolStandard?: string | null;
  schoolSection?: string | null;
};

/** Competition ranking (1, 2, 2, 4) using full internal score — not display score. */
export async function getFlowLeadershipLeaderboard(
  filter: RankFilter,
  limit = 20,
  nearbyUserId?: string,
): Promise<{ entries: LeaderboardEntry[]; total: number; nearbyEntries: LeaderboardEntry[] }> {
  const who: LeadershipWho =
    filter.who ?? (filter.ageGroup && filter.ageGroup !== 'all' ? 'category' : 'all');

  const where: Prisma.UserWhereInput = {
    onboardingCompleted: true,
    accountStatus: 'active',
    role: 'user',
    officialAccount: false,
    ...resolveWhoUserFilter(who, filter.ageGroup ?? null),
    ...(filter.cityId ? { cityId: filter.cityId } : {}),
    ...(filter.stateId ? { stateId: filter.stateId } : {}),
    ...(filter.countryId ? { countryId: filter.countryId } : {}),
    ...(filter.organizationId ? { organizationMemberships: { some: { organizationId: filter.organizationId, status: OrganizationMembershipStatus.verified, endDate: null } } } : {}),
    ...(filter.schoolStandard ? { standard: filter.schoolStandard } : {}),
    ...(filter.schoolSection ? { section: filter.schoolSection } : {}),
  };

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      flowLeadershipInternal: true,
      flowLeadershipScore: true,
    },
    orderBy: [{ flowLeadershipInternal: 'desc' }, { username: 'asc' }],
    take: limit,
  });

  const total = await prisma.user.count({ where });
  const entries: LeaderboardEntry[] = [];
  let previousInternal: number | null = null;
  let previousRank = 0;

  users.forEach((user, index) => {
    const rank = previousInternal !== null && user.flowLeadershipInternal === previousInternal
      ? previousRank
      : index + 1;

    entries.push({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      flowLeadershipInternal: user.flowLeadershipInternal,
      flowLeadershipScore: user.flowLeadershipScore,
      rank,
    });

    previousInternal = user.flowLeadershipInternal;
    previousRank = rank;
  });

  let nearbyEntries: LeaderboardEntry[] = [];
  if (nearbyUserId) {
    const currentUser = await prisma.user.findUnique({
      where: { id: nearbyUserId },
      select: { flowLeadershipScore: true },
    });
    if (currentUser) {
      const nearbyUsers = await prisma.user.findMany({
        where: {
          ...where,
          flowLeadershipScore: {
            gte: Math.max(0, currentUser.flowLeadershipScore - 5),
            lte: currentUser.flowLeadershipScore + 5,
          },
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          flowLeadershipInternal: true,
          flowLeadershipScore: true,
        },
        orderBy: [{ flowLeadershipInternal: 'desc' }, { username: 'asc' }],
        take: 10,
      });
      let nearbyPreviousInternal: number | null = null;
      let nearbyPreviousRank = 0;
      nearbyEntries = nearbyUsers.map((user, index) => {
        const rank = nearbyPreviousInternal !== null && user.flowLeadershipInternal === nearbyPreviousInternal
          ? nearbyPreviousRank
          : index + 1;
        nearbyPreviousInternal = user.flowLeadershipInternal;
        nearbyPreviousRank = rank;
        return {
          userId: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          flowLeadershipInternal: user.flowLeadershipInternal,
          flowLeadershipScore: user.flowLeadershipScore,
          rank,
        };
      });
    }
  }

  return { entries, total, nearbyEntries };
}

export async function rankUserAmong(
  userId: string,
  filter: RankFilter,
): Promise<RankResult | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { flowLeadershipInternal: true, onboardingCompleted: true },
  });
  if (!user?.onboardingCompleted) return null;

  const who: LeadershipWho =
    filter.who ?? (filter.ageGroup && filter.ageGroup !== 'all' ? 'category' : 'all');

  const where: Prisma.UserWhereInput = {
    onboardingCompleted: true,
    accountStatus: 'active',
    role: 'user',
    officialAccount: false,
    ...resolveWhoUserFilter(who, filter.ageGroup ?? null),
    ...(filter.cityId ? { cityId: filter.cityId } : {}),
    ...(filter.stateId ? { stateId: filter.stateId } : {}),
    ...(filter.countryId ? { countryId: filter.countryId } : {}),
    ...(filter.organizationId ? { organizationMemberships: { some: { organizationId: filter.organizationId, status: OrganizationMembershipStatus.verified, endDate: null } } } : {}),
    ...(filter.schoolStandard ? { standard: filter.schoolStandard } : {}),
    ...(filter.schoolSection ? { section: filter.schoolSection } : {}),
  };

  const [total, better] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({
      where: {
        ...where,
        flowLeadershipInternal: { gt: user.flowLeadershipInternal },
      },
    }),
  ]);

  if (total === 0) return null;
  return { rank: better + 1, total };
}

async function rankUserInOrgGroup(
  userId: string,
  orgGroupId: string,
  who: LeadershipWho,
  ageGroup: string | null,
  schoolSection?: string | null,
): Promise<RankResult | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { flowLeadershipInternal: true, onboardingCompleted: true },
  });
  if (!user?.onboardingCompleted) return null;

  const orgIds = (
    await prisma.organization.findMany({
      where: {
        OR: [{ id: orgGroupId }, { orgGroupId }],
        status: OrganizationStatus.gofam_verified,
      },
      select: { id: true },
    })
  ).map((o) => o.id);

  if (orgIds.length === 0) return null;

  const membership = await prisma.organizationMembership.findFirst({
    where: {
      userId,
      organizationId: { in: orgIds },
      status: OrganizationMembershipStatus.verified,
      endDate: null,
    },
  });
  if (!membership) return null;

  const members = await prisma.organizationMembership.findMany({
    where: {
      organizationId: { in: orgIds },
      status: OrganizationMembershipStatus.verified,
      endDate: null,
      user: {
        onboardingCompleted: true,
        accountStatus: 'active',
        role: 'user',
        officialAccount: false,
        ...resolveWhoUserFilter(who, ageGroup),
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

type UserLeadershipContext = {
  id: string;
  ageGroup: string | null;
  cityId: string | null;
  stateId: string | null;
  countryId: string | null;
  flowLeadershipScore: number;
  city: { name: string } | null;
  state: { name: string } | null;
  country: { name: string } | null;
  verifiedOrg: {
    id: string;
    name: string;
    status: OrganizationStatus;
    orgGroupId: string | null;
    orgGroup: { id: string; name: string } | null;
  } | null;
};

async function loadUserLeadershipContext(userId: string): Promise<UserLeadershipContext> {
  await syncUserAgeGroupFromDob(userId);
  await syncFlowLeadershipScore(userId);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      ageGroup: true,
      cityId: true,
      stateId: true,
      countryId: true,
      flowLeadershipScore: true,
      city: { select: { name: true } },
      state: { select: { name: true } },
      country: { select: { name: true } },
      organizationMemberships: {
        where: { status: 'verified', endDate: null },
        select: {
          organization: {
            select: {
              id: true,
              name: true,
              status: true,
              orgGroupId: true,
              orgGroup: { select: { id: true, name: true } },
            },
          },
        },
        take: 1,
        orderBy: { startDate: 'desc' },
      },
    },
  });

  const org = user.organizationMemberships[0]?.organization ?? null;
  const verifiedOrg =
    org && org.status === OrganizationStatus.gofam_verified
      ? {
          id: org.id,
          name: org.name,
          status: org.status,
          orgGroupId: org.orgGroupId,
          orgGroup: org.orgGroup,
        }
      : null;

  return {
    id: user.id,
    ageGroup: user.ageGroup,
    cityId: user.cityId,
    stateId: user.stateId,
    countryId: user.countryId,
    flowLeadershipScore: user.flowLeadershipScore,
    city: user.city,
    state: user.state,
    country: user.country,
    verifiedOrg,
  };
}

function defaultWhereScope(ctx: UserLeadershipContext): LeadershipWhere {
  if (ctx.cityId) return 'city';
  if (ctx.stateId) return 'state';
  if (ctx.countryId) return 'country';
  return 'world';
}

function whereLabel(where: LeadershipWhere, ctx: UserLeadershipContext): string {
  switch (where) {
    case 'city':
      return ctx.city?.name ?? 'City';
    case 'state':
      return ctx.state?.name ?? 'State';
    case 'country':
      return ctx.country?.name ?? 'Country';
    case 'organization':
      return ctx.verifiedOrg?.name ?? 'School';
    case 'orgGroup':
      return ctx.verifiedOrg?.orgGroup?.name ?? 'School Group';
    default:
      return 'World';
  }
}

function whoLabel(who: LeadershipWho, ctx: UserLeadershipContext, ageGroup = ctx.ageGroup): string {
  return who === 'all' ? 'All GOFAM' : leadershipCategoryLabel(ageGroup);
}

function buildWhereOptions(ctx: UserLeadershipContext) {
  const options: Array<{ value: LeadershipWhere; label: string }> = [
    { value: 'world', label: 'World' },
  ];
  if (ctx.countryId && ctx.country?.name) {
    options.push({ value: 'country', label: ctx.country.name });
  }
  if (ctx.stateId && ctx.state?.name) {
    options.push({ value: 'state', label: ctx.state.name });
  }
  if (ctx.cityId && ctx.city?.name) {
    options.push({ value: 'city', label: ctx.city.name });
  }
  if (ctx.verifiedOrg) {
    options.push({ value: 'organization', label: ctx.verifiedOrg.name });
  }
  if (ctx.verifiedOrg?.orgGroup) {
    options.push({ value: 'orgGroup', label: ctx.verifiedOrg.orgGroup.name });
  }
  return options;
}

export async function resolveLeadershipRank(
  userId: string,
  input: LeadershipFilterInput,
  ctx?: UserLeadershipContext,
): Promise<RankResult | null> {
  const userCtx = ctx ?? (await loadUserLeadershipContext(userId));
  const effectiveWho = input.who ?? 'category';
  const effectiveAgeGroup = explicitOrDefault(input.ageGroup, userCtx.ageGroup) ?? null;
  const effectiveCountryId = explicitOrDefault(input.countryId, userCtx.countryId) ?? null;
  const effectiveStateId = explicitOrDefault(input.stateId, userCtx.stateId) ?? null;
  const effectiveCityId = explicitOrDefault(input.cityId, userCtx.cityId) ?? null;
  const effectiveOrganizationId = explicitOrDefault(input.organizationId, userCtx.verifiedOrg?.id ?? null) ?? null;
  const effectiveWhere = input.where ?? defaultWhereScope(userCtx);
  const schoolStandard = input.schoolStandard ?? null;

  switch (effectiveWhere) {
    case 'organization':
      if (!effectiveOrganizationId) return null;
      return rankUserInVerifiedOrganization(
        userId,
        effectiveOrganizationId,
        effectiveWho === 'all' ? null : effectiveAgeGroup,
        schoolStandard,
        input.schoolSection ?? null,
      );
    case 'orgGroup':
      if (!userCtx.verifiedOrg?.orgGroup) return null;
      return rankUserInOrgGroup(
        userId,
        userCtx.verifiedOrg.orgGroup.id,
        effectiveWho,
        effectiveAgeGroup,
        input.schoolSection,
      );
    case 'city':
      if (!effectiveCityId) return null;
      return rankUserAmong(userId, {
        who: effectiveWho,
        ageGroup: effectiveAgeGroup,
        cityId: effectiveCityId,
        schoolStandard,
        schoolSection: input.schoolSection ?? null,
      });
    case 'state':
      if (!effectiveStateId) return null;
      return rankUserAmong(userId, {
        who: effectiveWho,
        ageGroup: effectiveAgeGroup,
        stateId: effectiveStateId,
        schoolStandard,
        schoolSection: input.schoolSection ?? null,
      });
    case 'country':
      if (!effectiveCountryId) return null;
      return rankUserAmong(userId, {
        who: effectiveWho,
        ageGroup: effectiveAgeGroup,
        countryId: effectiveCountryId,
        schoolStandard,
        schoolSection: input.schoolSection ?? null,
      });
    default:
      return rankUserAmong(userId, {
        who: effectiveWho,
        ageGroup: effectiveAgeGroup,
        ...(effectiveCountryId ? { countryId: effectiveCountryId } : {}),
        ...(effectiveStateId ? { stateId: effectiveStateId } : {}),
        ...(effectiveCityId ? { cityId: effectiveCityId } : {}),
        ...(effectiveOrganizationId ? { organizationId: effectiveOrganizationId } : {}),
        ...(schoolStandard ? { schoolStandard } : {}),
        ...(input.schoolSection ? { schoolSection: input.schoolSection } : {}),
      });
  }
}

function primaryHeadline(who: LeadershipWho, where: LeadershipWhere, ctx: UserLeadershipContext) {
  const whoText = whoLabel(who, ctx);
  const whereText = whereLabel(where, ctx);
  if (who === 'all' && where === 'world') return 'All GOFAM Rank — World';
  if (who === 'all') return `${whoText} Rank in ${whereText}`;
  return `${whoText} Rank in ${whereText}`;
}

export async function buildFlowLeadershipRank(
  userId: string,
  who: LeadershipWho = 'category',
  where?: LeadershipWhere,
) {
  const ctx = await loadUserLeadershipContext(userId);
  const whereScope = where ?? defaultWhereScope(ctx);
  const rank = await resolveLeadershipRank(userId, { who, where: whereScope }, ctx);

  return {
    score: ctx.flowLeadershipScore,
    who: {
      value: who,
      label: whoLabel(who, ctx, ctx.ageGroup),
    },
    where: {
      value: whereScope,
      label: whereLabel(whereScope, ctx),
    },
    rank,
    headline: primaryHeadline(who, whereScope, ctx),
  };
}

export async function buildFlowLeadershipOverview(
  userId: string,
  options?: LeadershipFilterInput,
) {
  const ctx = await loadUserLeadershipContext(userId);
  const who: LeadershipWho = options?.who ?? 'category';
  const effectiveAgeGroup = explicitOrDefault(options?.ageGroup, ctx.ageGroup) ?? null;
  const effectiveCountryId = explicitOrDefault(options?.countryId, ctx.countryId) ?? null;
  const effectiveStateId = explicitOrDefault(options?.stateId, ctx.stateId) ?? null;
  const effectiveCityId = explicitOrDefault(options?.cityId, ctx.cityId) ?? null;
  const effectiveOrganizationId = explicitOrDefault(options?.organizationId, ctx.verifiedOrg?.id ?? null) ?? null;
  const effectiveStandard = options?.schoolStandard ?? null;
  const where: LeadershipWhere = options?.where ?? defaultWhereScope(ctx);

  const [
    primaryRank,
    categoryRank,
    orgRank,
    orgGroupRank,
    cityRank,
    stateRank,
    countryRank,
    worldRank,
  ] = await Promise.all([
    resolveLeadershipRank(userId, {
      who,
      ageGroup: effectiveAgeGroup,
      where,
      countryId: effectiveCountryId,
      stateId: effectiveStateId,
      cityId: effectiveCityId,
      organizationId: effectiveOrganizationId,
      schoolStandard: effectiveStandard,
      schoolSection: options?.schoolSection ?? null,
    }, ctx),
    ctx.ageGroup || effectiveAgeGroup
      ? rankUserAmong(userId, {
          who: 'category',
          ageGroup: effectiveAgeGroup,
          countryId: effectiveCountryId,
          stateId: effectiveStateId,
          cityId: effectiveCityId,
          organizationId: effectiveOrganizationId,
          schoolStandard: effectiveStandard,
          schoolSection: options?.schoolSection ?? null,
        })
      : Promise.resolve(null),
    effectiveOrganizationId
      ? rankUserInVerifiedOrganization(
          userId,
          effectiveOrganizationId,
          effectiveAgeGroup,
          effectiveStandard,
          options?.schoolSection ?? null,
        )
      : Promise.resolve(null),
    ctx.verifiedOrg?.orgGroup
      ? rankUserInOrgGroup(
          userId,
          ctx.verifiedOrg.orgGroup.id,
          'category',
          effectiveAgeGroup,
          options?.schoolSection,
        )
      : Promise.resolve(null),
    effectiveCityId
      ? rankUserAmong(userId, {
          who: 'category',
          ageGroup: effectiveAgeGroup,
          cityId: effectiveCityId,
          schoolStandard: effectiveStandard,
          schoolSection: options?.schoolSection ?? null,
        })
      : Promise.resolve(null),
    effectiveStateId
      ? rankUserAmong(userId, {
          who: 'category',
          ageGroup: effectiveAgeGroup,
          stateId: effectiveStateId,
          schoolStandard: effectiveStandard,
          schoolSection: options?.schoolSection ?? null,
        })
      : Promise.resolve(null),
    effectiveCountryId
      ? rankUserAmong(userId, {
          who: 'category',
          ageGroup: effectiveAgeGroup,
          countryId: effectiveCountryId,
          schoolStandard: effectiveStandard,
          schoolSection: options?.schoolSection ?? null,
        })
      : Promise.resolve(null),
    rankUserAmong(userId, {
      who: 'category',
      ageGroup: effectiveAgeGroup,
      schoolStandard: effectiveStandard,
      schoolSection: options?.schoolSection ?? null,
    }),
  ]);

  const overviewRanks = [
    categoryRank
      ? {
          key: 'category',
          icon: '🏷️',
          label: leadershipCategoryLabel(ctx.ageGroup),
          rank: categoryRank,
        }
      : null,
    orgRank && ctx.verifiedOrg
      ? { key: 'organization', icon: '🎓', label: ctx.verifiedOrg.name, rank: orgRank }
      : null,
    orgGroupRank && ctx.verifiedOrg?.orgGroup
      ? {
          key: 'orgGroup',
          icon: '🏫',
          label: ctx.verifiedOrg.orgGroup.name,
          rank: orgGroupRank,
        }
      : null,
    cityRank && ctx.city?.name
      ? { key: 'city', icon: '🏙️', label: ctx.city.name, rank: cityRank }
      : null,
    stateRank && ctx.state?.name
      ? { key: 'state', icon: '📍', label: ctx.state.name, rank: stateRank }
      : null,
    countryRank && ctx.country?.name
      ? { key: 'country', icon: '🌐', label: ctx.country.name, rank: countryRank }
      : null,
    worldRank ? { key: 'world', icon: '🌍', label: 'World', rank: worldRank } : null,
  ].filter(Boolean);

  return {
    score: ctx.flowLeadershipScore,
    who: {
      value: who,
      label: whoLabel(who, ctx),
      options: [
        { value: 'category', label: `My Category (${leadershipCategoryLabel(ctx.ageGroup)})` },
        { value: 'all', label: 'All GOFAM' },
        { value: 'specificCategory', label: 'Specific Category' },
      ],
    },
    where: {
      value: where,
      label: whereLabel(where, ctx),
      options: buildWhereOptions(ctx),
    },
    primary: {
      rank: primaryRank,
      headline: primaryHeadline(who, where, { ...ctx, ageGroup: effectiveAgeGroup }),
    },
    overviewRanks,
    publicMessage:
      'Your FLOW Leadership reflects your FLOW, lifetime growth, and consistent progress across all 7 Hills.',
    verifiedOrganization: ctx.verifiedOrg
      ? { id: ctx.verifiedOrg.id, name: ctx.verifiedOrg.name }
      : null,
    // Legacy shape for Home card compatibility
    ranks: {
      category: categoryRank,
      city: cityRank,
      state: stateRank,
      country: countryRank,
      world: worldRank,
      organization: orgRank,
      orgGroup: orgGroupRank,
    },
    whereLegacy: {
      city: ctx.city?.name ?? null,
      state: ctx.state?.name ?? null,
      country: ctx.country?.name ?? null,
    },
  };
}
