import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { buildDashboardHome } from '../lib/dashboardService';

export const dashboardRouter = Router();

dashboardRouter.get('/home', requireAuth, async (req, res, next) => {
  try {
    const payload = await buildDashboardHome(req.user!.id);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});
