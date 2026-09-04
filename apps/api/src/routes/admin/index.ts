import { Router } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { requireAuth } from '../../middleware/auth';
import {
  adminRequestAuditMiddleware,
  requireAdminConsoleSession,
  requireAdminModule,
  requireStaffAuth,
} from '../../middleware/adminAuth';
import { getAdminDashboardOverview } from '../../lib/adminMissionService';
import { missionEngineAdminRouter } from './missionEngine';
import { journeyAdminRouter } from './journey';
import { glowAdminRouter } from './glow';
import { trustSafetyAdminRouter } from './trustSafety';
import { auditAdminRouter } from './audit';
import { organizationsAdminRouter } from './organizations';
import { adminAvatarAssetsRouter } from '../avatarAssets';

/** Admin API — domain modules with RBAC + audit (§84, §85, §87). */
export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdminConsoleSession, requireStaffAuth, adminRequestAuditMiddleware);

adminRouter.get('/overview', (req, res, next) => {
  if (!req.adminModules?.length) {
    next(new AppError('No admin modules assigned to your staff role', 403));
    return;
  }
  next();
}, async (_req, res, next) => {
  try {
    res.json(await getAdminDashboardOverview());
  } catch (error) {
    next(error);
  }
});

adminRouter.use('/mission-engine', requireAdminModule('mission_engine'), missionEngineAdminRouter);
adminRouter.use('/journey', requireAdminModule('journey'), journeyAdminRouter);
adminRouter.use('/glow', requireAdminModule('glow'), glowAdminRouter);
adminRouter.use('/trust-safety', requireAdminModule('trust_safety'), trustSafetyAdminRouter);
adminRouter.use('/organizations', requireAdminModule('organizations'), organizationsAdminRouter);
adminRouter.use('/avatar-assets', adminAvatarAssetsRouter);
adminRouter.use('/audit', requireAdminModule('audit'), auditAdminRouter);
