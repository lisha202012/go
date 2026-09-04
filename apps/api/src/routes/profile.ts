import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { buildProfile } from '../lib/profileService';

export const profileRouter = Router();

profileRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const profile = await buildProfile(req.user!.id);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});
