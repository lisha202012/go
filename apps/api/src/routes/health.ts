import { Router } from 'express';
import { pingDatabase } from '../lib/prisma';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const dbOk = await pingDatabase();
  if (!dbOk) {
    res.status(503).json({
      status: 'degraded',
      service: 'gofam-grow-api',
      database: 'offline',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.json({
    status: 'ok',
    service: 'gofam-grow-api',
    database: 'ok',
    timestamp: new Date().toISOString(),
  });
});
