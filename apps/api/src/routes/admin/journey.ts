import { Router } from 'express';
import { z } from 'zod';
import { getJourneyAdminOverview, getJourneyAnalytics, listJourneyUsers, listJourneyUsersForExport } from '../../lib/adminJourneyService';
import { prisma } from '../../lib/prisma';
import { auditAdminMutation } from '../../lib/adminAudit';
import { rowsToCsv, sendCsv } from '../../lib/adminCsvExport';

/** Section 50 — Journey / Step & Camp Admin */
export const journeyAdminRouter = Router();

const userListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  hillCode: z.string().optional(),
  campId: z.string().optional(),
  stepMin: z.coerce.number().int().min(0).max(49).optional(),
  stepMax: z.coerce.number().int().min(0).max(49).optional(),
});

journeyAdminRouter.get('/users', async (req, res, next) => {
  try {
    const query = userListSchema.parse(req.query);
    res.json(await listJourneyUsers(query));
  } catch (error) {
    next(error);
  }
});

journeyAdminRouter.get('/users/export.csv', async (req, res, next) => {
  try {
    const query = userListSchema.parse(req.query);
    const rows = await listJourneyUsersForExport(query);
    const csv = rowsToCsv(
      ['username', 'email', 'currentStep', 'currentCamp', 'focusHill', 'treeLevel', 'walletCoins', 'onboardingCompleted'],
      rows.map((r) => ({
        username: r.username,
        email: r.email,
        currentStep: r.currentStep,
        currentCamp: r.currentCamp ?? '',
        focusHill: r.focusHill ?? '',
        treeLevel: r.treeLevel,
        walletCoins: r.walletCoins,
        onboardingCompleted: r.onboardingCompleted,
      })),
    );
    sendCsv(res, 'journey-users.csv', csv);
  } catch (error) {
    next(error);
  }
});

journeyAdminRouter.get('/overview', async (_req, res, next) => {
  try {
    res.json(await getJourneyAdminOverview());
  } catch (error) {
    next(error);
  }
});

journeyAdminRouter.get('/analytics', async (_req, res, next) => {
  try {
    res.json(await getJourneyAnalytics());
  } catch (error) {
    next(error);
  }
});

const campPatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  stepThreshold: z.number().int().min(1).max(49).optional(),
  coinReward: z.number().int().min(0).optional(),
});

journeyAdminRouter.patch('/camps/:id', async (req, res, next) => {
  try {
    const body = campPatchSchema.parse(req.body);
    const before = await prisma.camp.findUnique({ where: { id: req.params.id } });
    if (!before) {
      res.status(404).json({ error: 'Camp not found' });
      return;
    }

    const after = await prisma.camp.update({
      where: { id: req.params.id },
      data: body,
    });

    await auditAdminMutation(req, {
      module: 'journey',
      action: 'camp.updated',
      entityType: 'Camp',
      entityId: after.id,
      beforeJson: before,
      afterJson: after,
    });

    res.json(after);
  } catch (error) {
    next(error);
  }
});
