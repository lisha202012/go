import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { TREE_LEVELS, getTreeProgress, getMyJourneyPayload } from '../lib/treeStarService';
import { buildProfile } from '../lib/profileService';

export const treeRouter = Router();

treeRouter.use(requireAuth);

treeRouter.get('/me', async (req, res, next) => {
  try {
    const progress = await getTreeProgress(req.user!.id);
    res.json({ ...progress, levels: TREE_LEVELS });
  } catch (err) {
    next(err);
  }
});

/** My Journey — Tree + Hills / Coins / GLOW planted & bloomed. */
treeRouter.get('/journey', async (req, res, next) => {
  try {
    const profile = await buildProfile(req.user!.id);
    const hillsCompleted = profile.stats.chakrasActive ?? 0;
    const journey = await getMyJourneyPayload(req.user!.id, { hillsCompleted });
    res.json(journey);
  } catch (err) {
    next(err);
  }
});
