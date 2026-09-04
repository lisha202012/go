import { Router } from 'express';
import { z } from 'zod';
import {
  getTrustSafetyOverview,
  getAdminUserDetail,
  prepareAdminUserDeletion,
  commitAdminUserDeletion,
  listTrustSafetyUsersForExport,
} from '../../lib/adminTrustSafetyService';
import { rowsToCsv, sendCsv } from '../../lib/adminCsvExport';
import { prisma } from '../../lib/prisma';
import { auditAdminMutation } from '../../lib/adminAudit';

/** Section 84 — Account / Trust & Safety Admin */
export const trustSafetyAdminRouter = Router();

const userListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
});

trustSafetyAdminRouter.get('/overview', async (req, res, next) => {
  try {
    const query = userListSchema.parse(req.query);
    res.json(await getTrustSafetyOverview(query));
  } catch (error) {
    next(error);
  }
});

trustSafetyAdminRouter.get('/users/export.csv', async (req, res, next) => {
  try {
    const query = userListSchema.parse(req.query);
    const rows = await listTrustSafetyUsersForExport(query);
    const csv = rowsToCsv(
      ['username', 'email', 'role', 'accountStatus', 'isChildProfile', 'currentStep', 'walletCoins', 'onboardingCompleted'],
      rows.map((u) => ({
        username: u.username,
        email: u.email,
        role: u.role,
        accountStatus: u.accountStatus,
        isChildProfile: u.isChildProfile,
        currentStep: u.currentStep,
        walletCoins: u.walletCoins,
        onboardingCompleted: u.onboardingCompleted,
      })),
    );
    sendCsv(res, 'accounts.csv', csv);
  } catch (error) {
    next(error);
  }
});

const accountStatusSchema = z.object({
  accountStatus: z.enum(['active', 'suspended']),
  suspendedReason: z.string().trim().min(3).max(500).optional(),
});

trustSafetyAdminRouter.get('/users/:id', async (req, res, next) => {
  try {
    const detail = await getAdminUserDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(detail);
  } catch (error) {
    next(error);
  }
});

trustSafetyAdminRouter.delete('/users/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const plan = await prepareAdminUserDeletion(req.params.id, req.user.id);
    if (!plan) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await auditAdminMutation(req, {
      module: 'trust_safety',
      action: 'account.deleted',
      entityType: 'User',
      entityId: plan.user.id,
      subjectUserId: plan.user.id,
      beforeJson: plan.beforeJson,
      afterJson: null,
      metadata: { cascade: true },
    });

    await commitAdminUserDeletion(plan.user.id, plan.user.familyId);

    res.json({
      ok: true,
      id: plan.user.id,
      email: plan.user.email,
    });
  } catch (error) {
    next(error);
  }
});

trustSafetyAdminRouter.patch('/users/:id/status', async (req, res, next) => {
  try {
    const body = accountStatusSchema.parse(req.body);
    const before = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!before) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const after = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        accountStatus: body.accountStatus,
        suspendedReason: body.accountStatus === 'suspended' ? body.suspendedReason ?? 'Suspended by staff' : null,
        suspendedAt: body.accountStatus === 'suspended' ? new Date() : null,
      },
    });

    await auditAdminMutation(req, {
      module: 'trust_safety',
      action: body.accountStatus === 'suspended' ? 'account.suspended' : 'account.restored',
      entityType: 'User',
      entityId: after.id,
      subjectUserId: after.id,
      beforeJson: {
        accountStatus: before.accountStatus,
        suspendedReason: before.suspendedReason,
      },
      afterJson: {
        accountStatus: after.accountStatus,
        suspendedReason: after.suspendedReason,
      },
    });

    res.json({
      id: after.id,
      email: after.email,
      accountStatus: after.accountStatus,
      suspendedAt: after.suspendedAt,
      suspendedReason: after.suspendedReason,
    });
  } catch (error) {
    next(error);
  }
});
