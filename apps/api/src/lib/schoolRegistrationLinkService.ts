import { randomBytes } from 'crypto';
import { OrganizationMembershipStatus, OrganizationStatus, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';

function generateToken() {
  return randomBytes(9).toString('base64url');
}

export async function createSchoolRegistrationLink(input: {
  schoolName: string;
  cityId?: string | null;
  cityName?: string | null;
  stateName?: string | null;
  countryName?: string | null;
  standard?: string | null;
  section?: string | null;
  batchId?: string | null;
  createdByAdminId?: string | null;
}) {
  const name = input.schoolName.trim();
  if (!name) throw new AppError('School name is required', 400);

  const cityName = input.cityName?.trim() || input.cityId?.trim() || null;
  const stateName = input.stateName?.trim() || null;
  const countryName = input.countryName?.trim() || null;

  let organization = await prisma.organization.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(cityName ? { cityName } : {}),
    },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name,
        type: 'school',
        status: OrganizationStatus.gofam_verified,
        cityId: null,
        cityName,
        stateName,
        countryName,
      },
    });
  } else if (organization.status !== OrganizationStatus.gofam_verified) {
    organization = await prisma.organization.update({
      where: { id: organization.id },
      data: { status: OrganizationStatus.gofam_verified },
    });
  }

  let token = generateToken();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const clash = await prisma.schoolRegistrationLink.findUnique({ where: { token } });
    if (!clash) break;
    token = generateToken();
  }

  const link = await prisma.schoolRegistrationLink.create({
    data: {
      token,
      batchId: input.batchId ?? null,
      organizationId: organization.id,
      standard: input.standard?.trim() || null,
      section: input.section?.trim() || null,
      createdByAdminId: input.createdByAdminId ?? null,
    },
  });

  return { link, organization };
}

export async function createSchoolRegistrationLinks(
  input: Parameters<typeof createSchoolRegistrationLink>[0],
  quantity: number,
) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5000) {
    throw new AppError('Quantity must be between 1 and 5000', 400);
  }

  const links = [];
  const batchId = randomBytes(12).toString('hex');
  for (let index = 0; index < quantity; index += 1) {
    const result = await createSchoolRegistrationLink({ ...input, batchId });
    links.push({ ...result.link, organization: { id: result.organization.id, name: result.organization.name } });
  }
  return { links };
}

export async function listSchoolRegistrationLinks() {
  return prisma.schoolRegistrationLink.findMany({
    include: {
      organization: { select: { id: true, name: true } },
      claims: {
        include: { user: { select: { id: true, username: true, email: true } } },
        orderBy: { claimedAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSchoolRegistrationLinksOverview({
  page = 1,
  pageSize = 25,
  search = '',
}: { page?: number; pageSize?: number; search?: string } = {}) {
  const normalizedSearch = search.trim();
  const searchClause = normalizedSearch
    ? Prisma.sql`WHERE o."name" ILIKE ${`%${normalizedSearch}%`}`
    : Prisma.empty;
  const groups = await prisma.$queryRaw<Array<{
    organizationId: string;
    organizationName: string;
    generatedCount: bigint;
    usedCount: bigint;
    joinedCount: bigint;
    linkId: string;
    standard: string | null;
    section: string | null;
  }>>(Prisma.sql`
    SELECT
      o."id" AS "organizationId",
      o."name" AS "organizationName",
      COUNT(DISTINCT l."id") AS "generatedCount",
      COUNT(c."id") AS "usedCount",
      COUNT(c."id") AS "joinedCount",
      (ARRAY_AGG(l."id" ORDER BY l."createdAt" DESC))[1] AS "linkId",
      CASE WHEN COUNT(DISTINCT l."standard") <= 1 THEN MAX(l."standard") ELSE 'Multiple' END AS "standard",
      CASE WHEN COUNT(DISTINCT l."section") <= 1 THEN MAX(l."section") ELSE 'Multiple' END AS "section"
    FROM "SchoolRegistrationLink" l
    JOIN "Organization" o ON o."id" = l."organizationId"
    LEFT JOIN "SchoolRegistrationLinkClaim" c ON c."linkId" = l."id"
    ${searchClause}
    GROUP BY o."id", o."name"
    ORDER BY MAX(l."createdAt") DESC
  `);
  const total = groups.length;
  const links = groups.slice((page - 1) * pageSize, page * pageSize);
  return {
    links: links.map((group) => ({
      id: group.linkId,
      organization: { id: group.organizationId, name: group.organizationName },
      standard: group.standard,
      section: group.section,
      generatedCount: Number(group.generatedCount),
      usesCount: Number(group.usedCount),
      claimsCount: Number(group.joinedCount),
      organizationId: group.organizationId,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getSchoolRegistrationLinkStudents(
  linkId: string,
  { page = 1, pageSize = 25, search = '' }: { page?: number; pageSize?: number; search?: string } = {},
) {
  const link = await prisma.schoolRegistrationLink.findUnique({
    where: { id: linkId },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!link) return null;

  const normalizedSearch = search.trim();
  const where = {
    linkId,
    ...(normalizedSearch
      ? {
          user: {
            OR: [
              { username: { contains: normalizedSearch, mode: 'insensitive' as const } },
              { email: { contains: normalizedSearch, mode: 'insensitive' as const } },
            ],
          },
        }
      : {}),
  };
  const [total, claims] = await prisma.$transaction([
    prisma.schoolRegistrationLinkClaim.count({ where }),
    prisma.schoolRegistrationLinkClaim.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            standard: true,
            section: true,
            countryName: true,
            stateName: true,
            cityName: true,
            ageGroup: true,
            currentStep: true,
            flowIndex: true,
            walletCoins: true,
            treeLevel: true,
            currentStreak: true,
            gapAssessment: {
              select: {
                flowIndex: true,
                totalRawScore: true,
                focusHill: { select: { code: true, name: true } },
                strongestHill: { select: { code: true, name: true } },
                hillScores: {
                  select: {
                    rawScore: true,
                    flowPercent: true,
                    hill: { select: { code: true, name: true } },
                  },
                  orderBy: { hill: { code: 'asc' } },
                },
              },
            },
            missionProgress: {
              select: {
                status: true,
                mission: { select: { categoryCode: true, hill: { select: { code: true } } } },
              },
            },
            _count: { select: { seedsSent: true, seedsReceived: true, missionCompletions: true, growthSets: true } },
          },
        },
      },
      orderBy: { claimedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    link,
    students: claims.map((claim) => {
      const missionStages = [...new Set(claim.user.missionProgress.map((item) => item.mission.categoryCode))];
      const completedByHill = claim.user.missionProgress
        .filter((item) => item.status === 'completed')
        .reduce<Record<string, number>>((counts, item) => {
          counts[item.mission.hill.code] = (counts[item.mission.hill.code] ?? 0) + 1;
          return counts;
        }, {});
      return {
        ...claim.user,
        missionStages,
        completedByHill,
        claimedAt: claim.claimedAt,
      };
    }),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getSchoolRegistrationLinksForExport(organizationId: string) {
  return prisma.schoolRegistrationLink.findMany({
    where: { organizationId },
    include: { organization: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function claimSchoolRegistrationLink(userId: string, token: string) {
  const link = await prisma.schoolRegistrationLink.findUnique({ where: { token } });
  if (!link || !link.isActive) return null;

  const alreadyClaimed = await prisma.schoolRegistrationLinkClaim.findUnique({ where: { userId } });
  if (alreadyClaimed) return null;

  const claimed = await prisma.$transaction(async (tx) => {
    const reserved = await tx.schoolRegistrationLink.updateMany({
      where: { id: link.id, isActive: true },
      data: { usesCount: { increment: 1 }, isActive: false },
    });
    if (reserved.count !== 1) return false;

    await tx.organizationMembership.updateMany({
      where: { userId, endDate: null },
      data: { endDate: new Date() },
    });
    await tx.organizationMembership.create({
      data: {
        userId,
        organizationId: link.organizationId,
        status: OrganizationMembershipStatus.verified,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        ...(link.standard ? { standard: link.standard } : {}),
        ...(link.section ? { section: link.section } : {}),
      },
    });
    await tx.schoolRegistrationLinkClaim.create({
      data: { linkId: link.id, userId },
    });
    return true;
  });

  if (!claimed) return null;

  return { organizationId: link.organizationId };
}
