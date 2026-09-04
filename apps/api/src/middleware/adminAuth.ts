import type { NextFunction, Request, Response } from 'express';
import type { AdminStaffRoleType } from '@prisma/client';
import { Role } from '@prisma/client';
import { AppError } from './errorHandler';
import {
  isWriteMethod,
  moduleFromPath,
  readPermissionForModule,
  roleHasPermission,
  writePermissionForModule,
  type AdminModule,
  type AdminPermission,
} from '../lib/adminPermissions';
import { loadAdminProfileForUser } from '../lib/adminStaffService';
import { auditAdminRequest } from '../lib/adminAudit';
import { legacyFallbackAuditTag } from '../lib/adminLegacyFallback';
import { prisma } from '../lib/prisma';

declare global {
  namespace Express {
    interface Request {
      adminRoles?: AdminStaffRoleType[];
      adminPermissions?: AdminPermission[];
      adminModules?: AdminModule[];
      legacySuperAdminFallback?: boolean;
    }
  }
}

function currentSessionHeader(req: Request) {
  const raw = req.headers['x-session-id'];
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

/** Admin API requires a session created via staff sign-in at /admin/login. */
export async function requireAdminConsoleSession(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      next(new AppError('Authentication required', 401));
      return;
    }
    const sessionId = currentSessionHeader(req);
    if (!sessionId) {
      next(new AppError('Admin console session required. Sign in at /admin/login.', 403));
      return;
    }
    const session = await prisma.refreshToken.findFirst({
      where: {
        id: sessionId,
        userId: req.user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        adminConsoleSession: true,
      },
    });
    if (!session) {
      next(new AppError('Admin console session required. Sign in at /admin/login.', 403));
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireStaffAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      next(new AppError('Authentication required', 401));
      return;
    }
    if (req.user.role !== Role.admin) {
      next(new AppError('Staff access required', 403));
      return;
    }
    const profile = await loadAdminProfileForUser({ id: req.user.id, role: req.user.role });
    req.adminRoles = profile.roles;
    req.adminPermissions = profile.permissions;
    req.adminModules = profile.modules;
    req.legacySuperAdminFallback = profile.legacySuperAdminFallback;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdminPermission(permission: AdminPermission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const roles = req.adminRoles ?? [];
    if (!roleHasPermission(roles, permission)) {
      next(new AppError('Insufficient staff permissions', 403));
      return;
    }
    next();
  };
}

export function requireAdminModule(module: AdminModule) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const roles = req.adminRoles ?? [];
    const readPerm = readPermissionForModule(module);
    if (!roleHasPermission(roles, readPerm)) {
      next(new AppError('You do not have access to this admin module', 403));
      return;
    }
    if (isWriteMethod(req.method)) {
      const writePerm = writePermissionForModule(module);
      if (writePerm && !roleHasPermission(roles, writePerm)) {
        next(new AppError('You do not have write access to this admin module', 403));
        return;
      }
    }
    next();
  };
}

/** Logs every admin API request to the audit trail (§85) from day one. */
export async function adminRequestAuditMiddleware(req: Request, res: Response, next: NextFunction) {
  const started = Date.now();
  const module = moduleFromPath(req.originalUrl) ?? 'system';

  res.on('finish', () => {
    void auditAdminRequest(req, {
      module,
      action: `admin.api.${req.method.toLowerCase()}`,
      metadata: {
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - started,
        ...legacyFallbackAuditTag(Boolean(req.legacySuperAdminFallback)),
      },
    }).catch(() => {
      console.error('[audit] failed to write admin request log', req.originalUrl);
    });
  });

  next();
}

/** Attach staff roles to request after requireAuth (for /auth/admin/me). */
export async function attachAdminProfile(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== Role.admin) {
    next();
    return;
  }
  try {
    const profile = await loadAdminProfileForUser({ id: req.user.id, role: req.user.role });
    req.adminRoles = profile.roles;
    req.legacySuperAdminFallback = profile.legacySuperAdminFallback;
  } catch (error) {
    next(error);
    return;
  }
  next();
}
