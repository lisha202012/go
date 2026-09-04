import { Router } from 'express';
import { z } from 'zod';
import { AGE_CATEGORIES } from '../../lib/ageCategories';
import {
  getMissionEngineAnalytics,
  listAdminMissions,
} from '../../lib/adminMissionService';
import { auditAdminMutation } from '../../lib/adminAudit';
import { prisma } from '../../lib/prisma';
import { rowsToCsv, sendCsv } from '../../lib/adminCsvExport';

/** Section 42 — Mission Engine Admin */
export const missionEngineAdminRouter = Router();

missionEngineAdminRouter.get('/overview', async (_req, res, next) => {
  try {
    const [analytics, configs] = await Promise.all([
      getMissionEngineAnalytics(),
      prisma.adminConfig.findMany({
        where: {
          key: { in: ['mission_coin_amounts', 'growth_set_bonus', 'mission_multiplier'] },
        },
      }),
    ]);
    res.json({
      ageCategories: AGE_CATEGORIES,
      rewardConfig: Object.fromEntries(configs.map((c) => [c.key, c.value])),
      analytics,
    });
  } catch (error) {
    next(error);
  }
});

const missionListSchema = z.object({
  categoryCode: z.string().optional(),
  hillCode: z.string().optional(),
  missionGroup: z.coerce.number().int().min(1).max(5).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

missionEngineAdminRouter.get('/missions/export.csv', async (req, res, next) => {
  try {
    const query = missionListSchema.parse(req.query);
    const result = await listAdminMissions({ ...query, page: 1, pageSize: 10_000 });
    const csv = rowsToCsv(
      ['externalId', 'title', 'categoryCode', 'hillCode', 'missionGroup', 'isDisabled', 'coinReward'],
      result.items.map((m) => ({
        externalId: m.externalId ?? '',
        title: m.title,
        categoryCode: m.categoryCode,
        hillCode: m.hillCode,
        missionGroup: m.missionGroup,
        isDisabled: m.isDisabled,
        coinReward: m.coinReward,
      })),
    );
    sendCsv(res, 'missions.csv', csv);
  } catch (error) {
    next(error);
  }
});

missionEngineAdminRouter.get('/missions', async (req, res, next) => {
  try {
    const query = missionListSchema.parse(req.query);
    const result = await listAdminMissions(query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

missionEngineAdminRouter.get('/missions/:id', async (req, res, next) => {
  try {
    const mission = await prisma.mission.findUnique({
      where: { id: req.params.id },
      include: { hill: true },
    });
    if (!mission) {
      res.status(404).json({ error: 'Mission not found' });
      return;
    }
    res.json({
      ...mission,
      hillCode: mission.hill.code,
      verificationType: mission.requiresEvidence
        ? 'evidence'
        : mission.requiresReflection
          ? 'reflection'
          : mission.isFamilyMission
            ? 'family'
            : 'none',
    });
  } catch (error) {
    next(error);
  }
});

missionEngineAdminRouter.get('/analytics', async (_req, res, next) => {
  try {
    res.json(await getMissionEngineAnalytics());
  } catch (error) {
    next(error);
  }
});

const missionPatchSchema = z.object({
  isDisabled: z.boolean().optional(),
  disabledReason: z.string().trim().min(3).max(500).optional().nullable(),
  whyText: z.string().trim().max(1000).optional().nullable(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
});

missionEngineAdminRouter.patch('/missions/:id', async (req, res, next) => {
  try {
    const body = missionPatchSchema.parse(req.body);
    const before = await prisma.mission.findUnique({
      where: { id: req.params.id },
      include: { hill: true },
    });
    if (!before) {
      res.status(404).json({ error: 'Mission not found' });
      return;
    }

    const data: {
      isDisabled?: boolean;
      disabledReason?: string | null;
      disabledAt?: Date | null;
      whyText?: string | null;
      title?: string;
      description?: string;
    } = {};

    if (body.isDisabled !== undefined) {
      data.isDisabled = body.isDisabled;
      data.disabledReason = body.isDisabled ? body.disabledReason ?? 'Disabled by staff' : null;
      data.disabledAt = body.isDisabled ? new Date() : null;
    }
    if (body.whyText !== undefined) {
      data.whyText = body.whyText?.trim() ? body.whyText.trim() : null;
    }
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;

    const after = await prisma.mission.update({
      where: { id: req.params.id },
      data,
      include: { hill: true },
    });

    await auditAdminMutation(req, {
      module: 'mission_engine',
      action:
        body.isDisabled === true
          ? 'mission.disabled'
          : body.isDisabled === false
            ? 'mission.enabled'
            : 'mission.updated',
      entityType: 'Mission',
      entityId: after.id,
      beforeJson: {
        isDisabled: before.isDisabled,
        disabledReason: before.disabledReason,
        whyText: before.whyText,
        title: before.title,
        description: before.description,
      },
      afterJson: {
        isDisabled: after.isDisabled,
        disabledReason: after.disabledReason,
        whyText: after.whyText,
        title: after.title,
        description: after.description,
      },
      metadata: { externalId: after.externalId, title: after.title },
    });

    res.json(after);
  } catch (error) {
    next(error);
  }
});
