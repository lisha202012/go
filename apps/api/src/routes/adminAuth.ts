import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/password';
import { toPublicUser } from '../lib/publicUser';
import { AppError } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import {
  attachAdminProfile,
  requireAdminConsoleSession,
} from '../middleware/adminAuth';
import { createSession, sessionContextFromRequest } from '../lib/sessionService';
import { loadAdminProfileForUser } from '../lib/adminStaffService';
import { createAdminMfaToken, verifyAdminMfaToken } from '../lib/adminMfaService';
import { auditAdminAction } from '../lib/adminAudit';
import { legacyFallbackAuditTag } from '../lib/adminLegacyFallback';
import { ADMIN_ROLE_CATALOG } from '../lib/adminPermissions';

export const adminAuthRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceName: z.string().trim().min(1).max(120).optional(),
});

const passwordResetSchema = z
  .object({
    resetToken: z.string().min(1),
    newPassword: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128),
    deviceName: z.string().trim().min(1).max(120).optional(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

async function auditWithLegacy(
  req: Parameters<typeof auditAdminAction>[0],
  input: Parameters<typeof auditAdminAction>[1],
  legacyFallback?: boolean,
) {
  try {
    return await auditAdminAction(req, {
      ...input,
      metadata: {
        ...(input.metadata as object | undefined),
        ...legacyFallbackAuditTag(Boolean(legacyFallback)),
      },
    });
  } catch (error) {
    console.warn('[audit] authentication audit unavailable:', error);
    return null;
  }
}

async function safeAuthAudit(
  req: Parameters<typeof auditAdminAction>[0],
  input: Parameters<typeof auditAdminAction>[1],
) {
  try {
    return await auditAdminAction(req, input);
  } catch (error) {
    console.warn('[audit] authentication audit unavailable:', error);
    return null;
  }
}

async function completeAdminLogin(
  req: Parameters<typeof auditAdminAction>[0],
  user: { id: string; role: Role; email: string },
  deviceName?: string,
) {
  const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!fullUser) throw new AppError('User not found', 404);

  const tokens = await createSession(fullUser, sessionContextFromRequest(req, deviceName), {
    adminConsoleSession: true,
  });
  const admin = await loadAdminProfileForUser(fullUser);

  await auditWithLegacy(
    req,
    {
      module: 'system',
      action: 'admin.login.success',
      actorUserId: user.id,
      metadata: { roles: admin.roles },
    },
    admin.legacySuperAdminFallback,
  );

  return {
    step: 'complete' as const,
    user: toPublicUser(fullUser),
    admin,
    ...tokens,
  };
}

adminAuthRouter.get('/roles', (_req, res) => {
  res.json({ roles: ADMIN_ROLE_CATALOG });
});

adminAuthRouter.get(
  '/me',
  requireAuth,
  requireAdminConsoleSession,
  attachAdminProfile,
  async (req, res, next) => {
    try {
      if (!req.user || req.user.role !== Role.admin) {
        throw new AppError('Staff access required', 403);
      }
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) throw new AppError('User not found', 404);
      const admin = await loadAdminProfileForUser(user);
      res.json({
        user: toPublicUser(user),
        admin,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminAuthRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });

    if (!user || user.role !== Role.admin) {
      await safeAuthAudit(req, {
        module: 'system',
        action: 'admin.login.failed',
        metadata: { email: body.email.toLowerCase(), reason: 'not_staff' },
      });
      throw new AppError('Invalid staff credentials', 401);
    }

    if (!(await verifyPassword(body.password, user.passwordHash))) {
      await safeAuthAudit(req, {
        module: 'system',
        action: 'admin.login.failed',
        actorUserId: user.id,
        metadata: { reason: 'bad_password' },
      });
      throw new AppError('Invalid staff credentials', 401);
    }

    await safeAuthAudit(req, {
      module: 'system',
      action: 'admin.login.password_verified',
      actorUserId: user.id,
    });

    if (user.adminPasswordMustReset) {
      const resetToken = createAdminMfaToken(user.id, 'admin_password_reset');
      await safeAuthAudit(req, {
        module: 'system',
        action: 'admin.password.reset_required',
        actorUserId: user.id,
      });
      res.json({
        step: 'password_reset',
        resetToken,
        message: 'You must set a new password before continuing.',
      });
      return;
    }

    res.json(await completeAdminLogin(req, user, body.deviceName));
  } catch (error) {
    if (!(error instanceof AppError)) {
      console.error('[admin-auth] login failed unexpectedly:', error);
      next(new AppError('Staff login is temporarily unavailable. Restart the API and try again.', 503));
      return;
    }
    next(error);
  }
});

adminAuthRouter.post('/password/reset', async (req, res, next) => {
  try {
    const body = passwordResetSchema.parse(req.body);
    const userId = verifyAdminMfaToken(body.resetToken, 'admin_password_reset');
    const passwordHash = await hashPassword(body.newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        adminPasswordMustReset: false,
      },
    });

    await safeAuthAudit(req, {
      module: 'system',
      action: 'admin.password.reset_completed',
      actorUserId: userId,
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    res.json(await completeAdminLogin(req, user, body.deviceName));
  } catch (error) {
    next(error);
  }
});
