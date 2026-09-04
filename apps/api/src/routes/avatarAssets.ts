import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireAdminConsoleSession, requireStaffAuth } from '../middleware/adminAuth';
import { AppError } from '../middleware/errorHandler';
import { rowsToCsv, sendCsv } from '../lib/adminCsvExport';

export const avatarAssetsRouter = Router();
export const adminAvatarAssetsRouter = Router();

const isImageUrlValue = (value: string) => {
  if (value.startsWith('data:image/')) return true;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const avatarAssetSchema = z.object({
  name: z.string().trim().min(1).max(80).optional().default('avatar'),
  imageUrl: z.string().trim().refine(isImageUrlValue, {
    message: 'Image URL or data URL is required',
  }),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
});

const avatarAssetUpdateSchema = avatarAssetSchema.partial();
const avatarAssetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional().default(''),
  status: z.enum(['active', 'inactive']).optional(),
});

function avatarAssetWhere(query: { search?: string; status?: 'active' | 'inactive' }) {
  return {
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    ...(query.status ? { isActive: query.status === 'active' } : {}),
  };
}

avatarAssetsRouter.get('/options', async (_req, res, next) => {
  try {
    const items = await prisma.avatarAsset.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, imageUrl: true },
    });

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

adminAvatarAssetsRouter.use(requireAuth, requireAdminConsoleSession, requireStaffAuth);

adminAvatarAssetsRouter.get('/', async (req, res, next) => {
  try {
    const query = avatarAssetListQuerySchema.parse(req.query);
    const { page, pageSize } = query;
    const where = avatarAssetWhere(query);
    const [items, total] = await prisma.$transaction([
      prisma.avatarAsset.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.avatarAsset.count({ where }),
    ]);

    res.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    next(error);
  }
});

adminAvatarAssetsRouter.get('/export.csv', async (req, res, next) => {
  try {
    const query = avatarAssetListQuerySchema.parse(req.query);
    const rows = await prisma.avatarAsset.findMany({
      where: avatarAssetWhere(query),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const csv = rowsToCsv(
      ['id', 'name', 'status', 'sortOrder', 'createdAt'],
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.isActive ? 'active' : 'inactive',
        sortOrder: row.sortOrder,
        createdAt: row.createdAt.toISOString(),
      })),
    );
    sendCsv(res, 'avatar-assets.csv', csv);
  } catch (error) {
    next(error);
  }
});

adminAvatarAssetsRouter.post('/', async (req, res, next) => {
  try {
    const body = avatarAssetSchema.parse(req.body);
    const item = await prisma.avatarAsset.create({
      data: {
        name: body.name,
        imageUrl: body.imageUrl,
        isActive: body.isActive,
        sortOrder: body.sortOrder ?? 0,
      },
    });

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

adminAvatarAssetsRouter.patch('/:id', async (req, res, next) => {
  try {
    const body = avatarAssetUpdateSchema.parse(req.body);
    const item = await prisma.avatarAsset.update({
      where: { id: req.params.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    });

    res.json({ item });
  } catch (error) {
    next(error);
  }
});

adminAvatarAssetsRouter.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.avatarAsset.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw new AppError('Avatar asset not found', 404);
    }

    await prisma.avatarAsset.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
