import { GlowSeedStatus, GlowSeedChannel } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import {
  acceptGlowSeed,
  claimGlowShareToken,
  createExternalShareLink,
  getActiveExternalShareToken,
  getGlowHub,
  previewGlowShareToken,
  searchGlowPeople,
  sendGlowSeed,
} from '../lib/glowSeedService';
import { getPlantedMemberProgress, getHarvestDashboard } from '../lib/glowHarvestService';
import { listFriends } from '../lib/friendshipService';
import { AppError } from '../middleware/errorHandler';
import { getAdminConfigNumber } from '../lib/adminConfig';
import { isCoachBalaGiftSeed } from '../lib/coachBalaService';
import { grantWelcomeBonus } from '../lib/coins';
import { env } from '../config/env';

export const glowSeedsRouter = Router();

function seedExpiryDate(days = 30) {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return expires;
}

function formatSeedPreview(seed: {
  id: string;
  status: GlowSeedStatus;
  expiresAt: Date;
  sender: { id: string; username: string; avatarUrl: string | null };
}) {
  return {
    id: seed.id,
    status: seed.status,
    expiresAt: seed.expiresAt,
    sender: seed.sender,
  };
}

glowSeedsRouter.get('/harvest', requireAuth, async (req, res, next) => {
  try {
    const [harvest, activeShareToken] = await Promise.all([
      getHarvestDashboard(req.user!.id),
      getActiveExternalShareToken(req.user!.id),
    ]);
    res.json({ ...harvest, activeShareToken });
  } catch (error) {
    next(error);
  }
});

glowSeedsRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const hub = await getGlowHub(req.user!.id);
    res.json(hub);
  } catch (error) {
    next(error);
  }
});

glowSeedsRouter.get('/people', requireAuth, async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const result = await searchGlowPeople(req.user!.id, q);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

glowSeedsRouter.post('/send', requireAuth, async (req, res, next) => {
  try {
    const { username } = z.object({ username: z.string().min(2).max(40) }).parse(req.body);
    const result = await sendGlowSeed(req.user!.id, username);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

glowSeedsRouter.post('/share-link', requireAuth, async (req, res, next) => {
  try {
    const body = z
      .object({
        origin: z.string().url().optional(),
      })
      .parse(req.body ?? {});
    const origin =
      body.origin ||
      (typeof req.headers.origin === 'string' ? req.headers.origin : null) ||
      'http://localhost:5173';
    const result = await createExternalShareLink(req.user!.id, origin);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

glowSeedsRouter.get('/invite/:token', async (req, res, next) => {
  try {
    const preview = await previewGlowShareToken(req.params.token);
    res.json(preview);
  } catch (error) {
    next(error);
  }
});

glowSeedsRouter.post('/invite/:token/claim', requireAuth, async (req, res, next) => {
  try {
    const result = await claimGlowShareToken(req.user!.id, req.params.token);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

glowSeedsRouter.get('/friends', requireAuth, async (req, res, next) => {
  try {
    const friends = await listFriends(req.user!.id);
    res.json({ friends });
  } catch (error) {
    next(error);
  }
});

glowSeedsRouter.get('/planted/:userId', requireAuth, async (req, res, next) => {
  try {
    const progress = await getPlantedMemberProgress(req.user!.id, req.params.userId);
    if (!progress) throw new AppError('Not allowed — they must accept your GLOW seed first', 403);
    res.json(progress);
  } catch (error) {
    next(error);
  }
});

glowSeedsRouter.get('/pending/me', requireAuth, async (req, res, next) => {
  try {
    const seed = await prisma.glowSeed.findFirst({
      where: {
        receiverId: req.user!.id,
        status: GlowSeedStatus.pending,
        expiresAt: { gt: new Date() },
      },
      orderBy: { sentAt: 'desc' },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    res.json({ seed: seed ? formatSeedPreview(seed) : null });
  } catch (error) {
    next(error);
  }
});

glowSeedsRouter.get('/:seedId', requireAuth, async (req, res, next) => {
  try {
    const seed = await prisma.glowSeed.findUnique({
      where: { id: req.params.seedId },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    if (!seed) {
      throw new AppError('Glow seed not found', 404);
    }
    if (!seed.receiverId || seed.receiverId !== req.user!.id) {
      throw new AppError('This seed is not addressed to you', 403);
    }

    res.json({ seed: formatSeedPreview(seed) });
  } catch (error) {
    next(error);
  }
});

glowSeedsRouter.post('/:seedId/accept', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const seedRow = await prisma.glowSeed.findUnique({
      where: { id: req.params.seedId },
      select: {
        channel: true,
        senderId: true,
        isSystemSeed: true,
        seedKind: true,
        sender: { select: { officialAccount: true } },
      },
    });
    const welcomeBonusAmount = await getAdminConfigNumber('welcome_bonus', 100);

    const result = await acceptGlowSeed(userId, req.params.seedId);

    let welcomeBonusGranted = false;
    const countsForWelcomeBonus =
      seedRow?.channel === GlowSeedChannel.in_app &&
      !isCoachBalaGiftSeed(seedRow ?? {});
    if (countsForWelcomeBonus) {
      const priorInAppAccepted = await prisma.glowSeed.count({
        where: {
          receiverId: userId,
          status: GlowSeedStatus.accepted,
          channel: GlowSeedChannel.in_app,
        },
      });
      const isFirstInAppBloom = priorInAppAccepted <= 1;
      if (isFirstInAppBloom) {
        welcomeBonusGranted = await grantWelcomeBonus(userId, welcomeBonusAmount, result.seed.id);
        await grantWelcomeBonus(result.sender.id, welcomeBonusAmount, result.seed.id);
      }
    }

    const updatedUser = await prisma.user.findUnique({ where: { id: userId } });

    res.json({
      ...result,
      welcomeBonusGranted,
      welcomeBonusAmount: welcomeBonusGranted ? welcomeBonusAmount : 0,
      accountActivated: true,
      user: updatedUser
        ? {
            walletCoins: updatedUser.walletCoins,
            growthCoinsLifetime: updatedUser.growthCoinsLifetime,
            seedInventoryCount: updatedUser.seedInventoryCount,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

/** Dev only — plant a pending seed from Coach Bala to the current user for onboarding tests. */
glowSeedsRouter.post('/dev/plant-for-me', requireAuth, async (req, res, next) => {
  try {
    if (env.NODE_ENV === 'production') {
      throw new AppError('Not available', 404);
    }

    const sender = await prisma.user.findUnique({ where: { username: 'coach_bala' } });
    if (!sender) {
      throw new AppError('Run db seed to create coach_bala user first', 503);
    }

    const expiryDays = await getAdminConfigNumber('seed_expiry_days', 30);
    const existing = await prisma.glowSeed.findFirst({
      where: {
        senderId: sender.id,
        receiverId: req.user!.id,
        status: GlowSeedStatus.pending,
        expiresAt: { gt: new Date() },
      },
    });

    if (existing) {
      res.json({
        seed: {
          id: existing.id,
          status: existing.status,
          expiresAt: existing.expiresAt,
        },
        message: 'Pending seed already exists',
      });
      return;
    }

    const seed = await prisma.glowSeed.create({
      data: {
        senderId: sender.id,
        receiverId: req.user!.id,
        status: GlowSeedStatus.pending,
        expiresAt: seedExpiryDate(expiryDays),
      },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    res.status(201).json({ seed: formatSeedPreview(seed) });
  } catch (error) {
    next(error);
  }
});
