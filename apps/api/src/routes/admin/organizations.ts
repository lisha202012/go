import { Router } from 'express';
import { z } from 'zod';
import { OrganizationStatus } from '@prisma/client';
import {
  getOrganizationAdminDetail,
  getOrganizationsAdminOverview,
  listOrganizationsForExport,
  listPendingMemberships,
} from '../../lib/adminOrganizationService';
import {
  approveOrganizationMembership,
  markOrganizationGofamVerified,
  rejectOrganizationMembership,
} from '../../lib/organizationService';
import { rowsToCsv, sendCsv } from '../../lib/adminCsvExport';
import { auditAdminMutation } from '../../lib/adminAudit';
import { prisma } from '../../lib/prisma';
import {
  createSchoolRegistrationLink,
  createSchoolRegistrationLinks,
  getSchoolRegistrationLinkStudents,
  getSchoolRegistrationLinksForExport,
  getSchoolRegistrationLinksOverview,
} from '../../lib/schoolRegistrationLinkService';

/** Organisation demand dashboard + verification tooling (§3.5, §3.8). */
export const organizationsAdminRouter = Router();

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.nativeEnum(OrganizationStatus).optional(),
  minInterest: z.coerce.number().int().min(0).optional(),
  demandTier: z.enum(['early', 'growing', 'high']).optional(),
});

organizationsAdminRouter.get('/overview', async (req, res, next) => {
  try {
    const query = listSchema.parse(req.query);
    res.json(await getOrganizationsAdminOverview(query));
  } catch (error) {
    next(error);
  }
});

organizationsAdminRouter.get('/export.csv', async (req, res, next) => {
  try {
    const query = listSchema.parse(req.query);
    const rows = await listOrganizationsForExport(query);
    const csv = rowsToCsv(
      [
        'name',
        'type',
        'status',
        'interestCount',
        'demandLabel',
        'verifiedMemberCount',
        'cityName',
        'stateName',
        'createdAt',
      ],
      rows.map((r) => ({
        name: r.name,
        type: r.type,
        status: r.status,
        interestCount: r.interestCount,
        demandLabel: r.demandLabel,
        verifiedMemberCount: r.verifiedMemberCount,
        cityName: r.cityName ?? '',
        stateName: r.stateName ?? '',

      })),
    );
    sendCsv(res, 'organizations-demand.csv', csv);
  } catch (error) {
    next(error);
  }
});

const createLinkSchema = z.object({
  schoolName: z.string().trim().min(1),
  cityId: z.string().nullable().optional(),
  cityName: z.string().trim().max(120).nullable().optional(),
  stateName: z.string().trim().max(120).nullable().optional(),
  countryName: z.string().trim().max(120).nullable().optional(),
  standard: z.string().trim().max(20).optional(),
  section: z.string().trim().max(10).optional(),
});

const createLinksBatchSchema = createLinkSchema.extend({
  quantity: z.coerce.number().int().min(1).max(5000),
});

const linkListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional().default(''),
});

organizationsAdminRouter.post('/registration-links', async (req, res, next) => {
  try {
    const body = createLinkSchema.parse(req.body);
    const { link } = await createSchoolRegistrationLink({
      ...body,
      cityId: body.cityId ?? null,
      cityName: body.cityName ?? body.cityId ?? null,
      stateName: body.stateName ?? null,
      countryName: body.countryName ?? null,
      createdByAdminId: req.user?.id ?? null,
    });
    res.status(201).json({ link });
  } catch (error) {
    next(error);
  }
});

organizationsAdminRouter.post('/registration-links/bulk', async (req, res, next) => {
  try {
    const body = createLinksBatchSchema.parse(req.body);
    const { quantity, ...linkInput } = body;
    const result = await createSchoolRegistrationLinks({
      ...linkInput,
      cityId: linkInput.cityId ?? null,
      cityName: linkInput.cityName ?? linkInput.cityId ?? null,
      stateName: linkInput.stateName ?? null,
      countryName: linkInput.countryName ?? null,
      createdByAdminId: req.user?.id ?? null,
    }, quantity);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

organizationsAdminRouter.get('/registration-links', async (req, res, next) => {
  try {
    const query = linkListSchema.parse(req.query);
    res.json(await getSchoolRegistrationLinksOverview(query));
  } catch (error) {
    next(error);
  }
});

organizationsAdminRouter.get('/registration-links/school/:organizationId/export', async (req, res, next) => {
  try {
    const links = await getSchoolRegistrationLinksForExport(req.params.organizationId);
    res.json({ links });
  } catch (error) {
    next(error);
  }
});

const linkStudentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional().default(''),
});

organizationsAdminRouter.get('/registration-links/:id/students', async (req, res, next) => {
  try {
    const query = linkStudentsSchema.parse(req.query);
    const result = await getSchoolRegistrationLinkStudents(req.params.id, query);
    if (!result) {
      res.status(404).json({ error: 'Registration link not found' });
      return;
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

organizationsAdminRouter.get('/registration-links/:id/students/export.csv', async (req, res, next) => {
  try {
    const query = linkStudentsSchema.parse(req.query);
    const firstPage = await getSchoolRegistrationLinkStudents(req.params.id, {
      ...query,
      page: 1,
      pageSize: 100,
    });
    if (!firstPage) {
      res.status(404).json({ error: 'Registration link not found' });
      return;
    }
    const students = [...firstPage.students];
    for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
      const nextPage = await getSchoolRegistrationLinkStudents(req.params.id, {
        ...query,
        page,
        pageSize: 100,
      });
      if (nextPage) students.push(...nextPage.students);
    }
    const csv = rowsToCsv(
      [
        'username',
        'email',
        'standard',
        'section',
        'country',
        'state',
        'city',
        'ageGroup',
        'currentStep',
        'flowIndex',
        'totalGapScore',
        'hillScores',
        'missionStages',
        'completedByHill',
        'glowSent',
        'glowReceived',
        'walletCoins',
        'currentStreak',
        'joinedAt',
      ],
      students.map((student) => ({
        username: student.username,
        email: student.email,
        standard: student.standard ?? '',
        section: student.section ?? '',
        country: student.countryName ?? '',
        state: student.stateName ?? '',
        city: student.cityName ?? '',
        ageGroup: student.ageGroup ?? '',
        currentStep: student.currentStep,
        flowIndex: student.flowIndex,
        totalGapScore: student.gapAssessment?.totalRawScore ?? '',
        hillScores: (student.gapAssessment?.hillScores ?? [])
          .map((score) => `${score.hill.code}:${score.rawScore}/${score.flowPercent}%`)
          .join(' | '),
        missionStages: (student.missionStages ?? []).join(' | '),
        completedByHill: Object.entries(student.completedByHill ?? {})
          .map(([hill, count]) => `${hill}:${count}`)
          .join(' | '),
        glowSent: student._count.seedsSent,
        glowReceived: student._count.seedsReceived,
        walletCoins: student.walletCoins,
        currentStreak: student.currentStreak,
        joinedAt: student.claimedAt,
      })),
    );
    sendCsv(res, 'school-link-students.csv', csv);
  } catch (error) {
    next(error);
  }
});

organizationsAdminRouter.get('/:id', async (req, res, next) => {
  try {
    const detail = await getOrganizationAdminDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }
    res.json(detail);
  } catch (error) {
    next(error);
  }
});

organizationsAdminRouter.get('/:id/memberships/pending', async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }
    const items = await listPendingMemberships(req.params.id);
    res.json({
      items: items.map((m) => ({
        id: m.id,
        status: m.status,
        startDate: m.startDate.toISOString(),
        user: m.user,
      })),
    });
  } catch (error) {
    next(error);
  }
});

organizationsAdminRouter.post('/:id/verify', async (req, res, next) => {
  try {
    const before = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!before) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const result = await markOrganizationGofamVerified(req.params.id);

    await auditAdminMutation(req, {
      module: 'organizations',
      action: 'organization.verify',
      entityType: 'Organization',
      entityId: req.params.id,
      beforeJson: { status: before.status },
      afterJson: { status: result.organization.status },
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

const membershipActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
});

organizationsAdminRouter.patch('/:id/memberships/:membershipId', async (req, res, next) => {
  try {
    const body = membershipActionSchema.parse(req.body);
    const membership = await prisma.organizationMembership.findUnique({
      where: { id: req.params.membershipId },
      select: { id: true, organizationId: true, userId: true, status: true, endDate: true },
    });
    if (!membership || membership.organizationId !== req.params.id) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    const result =
      body.action === 'approve'
        ? await approveOrganizationMembership(req.params.membershipId)
        : await rejectOrganizationMembership(req.params.membershipId);

    await auditAdminMutation(req, {
      module: 'organizations',
      action: body.action === 'approve' ? 'membership.approve' : 'membership.reject',
      entityType: 'OrganizationMembership',
      entityId: membership.id,
      subjectUserId: membership.userId,
      beforeJson: { status: membership.status, endDate: membership.endDate },
      afterJson: result.membership,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});
