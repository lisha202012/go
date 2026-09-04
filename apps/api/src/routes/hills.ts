import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

export const hillsRouter = Router();

hillsRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    const hills = await prisma.hill.findMany({
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        virtueName: true,
        colorTheme: true,
      },
    });
    res.json({ hills });
  } catch (error) {
    next(error);
  }
});
