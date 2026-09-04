import { Router } from 'express';
import { z } from 'zod';
import { GlowSeedStatus } from '@prisma/client';
import { getGlowAdminOverview, getGlowAnalytics, listGlowSeeds, listGlowSeedsForExport } from '../../lib/adminGlowService';
import { rowsToCsv, sendCsv } from '../../lib/adminCsvExport';

/** Section 47 — GLOW / Referral Admin */
export const glowAdminRouter = Router();

const seedListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.nativeEnum(GlowSeedStatus).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  flaggedOnly: z
    .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
});

glowAdminRouter.get('/seeds', async (req, res, next) => {
  try {
    const query = seedListSchema.parse(req.query);
    res.json(await listGlowSeeds(query));
  } catch (error) {
    next(error);
  }
});

glowAdminRouter.get('/seeds/export.csv', async (req, res, next) => {
  try {
    const query = seedListSchema.parse(req.query);
    const rows = await listGlowSeedsForExport(query);
    const csv = rowsToCsv(
      ['status', 'sentAt', 'sender', 'receiver', 'virtue', 'flagged'],
      rows.map((r) => ({
        status: r.status,
        sentAt: r.sentAt.toISOString(),
        sender: r.sender?.email ?? '',
        receiver: r.receiver?.email ?? '',
        virtue: r.virtue ?? '',
        flagged: r.flagged,
      })),
    );
    sendCsv(res, 'glow-seeds.csv', csv);
  } catch (error) {
    next(error);
  }
});

glowAdminRouter.get('/overview', async (_req, res, next) => {
  try {
    res.json(await getGlowAdminOverview());
  } catch (error) {
    next(error);
  }
});

glowAdminRouter.get('/analytics', async (_req, res, next) => {
  try {
    res.json(await getGlowAnalytics());
  } catch (error) {
    next(error);
  }
});
