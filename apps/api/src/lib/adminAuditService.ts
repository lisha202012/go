import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export async function listAuditLogs({
  page = 1,
  pageSize = 50,
  search,
  module,
  action,
  dateFrom,
  dateTo,
}: {
  page?: number;
  pageSize?: number;
  search?: string;
  module?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
const where: Prisma.AuditLogWhereInput = {};

  if (module) where.module = module;
  if (action?.trim()) where.action = { contains: action.trim(), mode: 'insensitive' };

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  if (search?.trim()) {
    const q = search.trim();
    where.OR = [
      { action: { contains: q, mode: 'insensitive' } },
      { entityType: { contains: q, mode: 'insensitive' } },
      { entityId: { contains: q, mode: 'insensitive' } },
      { actorUser: { email: { contains: q, mode: 'insensitive' } } },
      { subjectUser: { email: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        actorUser: { select: { id: true, username: true, email: true } },
        subjectUser: { select: { id: true, username: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items: items.map((log) => ({
      id: log.id,
      module: log.module,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      createdAt: log.createdAt,
      actor: log.actorUser,
      subject: log.subjectUser,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function listAuditLogsForExport(filters: Parameters<typeof listAuditLogs>[0]) {
  const result = await listAuditLogs({ ...filters, page: 1, pageSize: 10_000 });
  return result.items;
}

export async function clearAuditLogs() {
  const result = await prisma.auditLog.deleteMany({});
  return { deleted: result.count };
}
