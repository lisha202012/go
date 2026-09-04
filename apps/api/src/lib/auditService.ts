import type { Request } from 'express';
import { prisma } from './prisma';

export type AuditModule = 'mission_engine' | 'journey' | 'glow' | 'trust_safety' | 'organizations' | 'system';

export interface WriteAuditLogInput {
  module: AuditModule;
  action: string;
  actorUserId?: string | null;
  subjectUserId?: string | null;
  entityType?: string;
  entityId?: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export function auditContextFromRequest(req: Request) {
  return {
    actorUserId: req.user?.id ?? null,
    ipAddress: req.ip ?? req.headers['x-forwarded-for']?.toString() ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

/** Append-only audit entry. Never update or delete rows. */
export async function writeAuditLog(input: WriteAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      module: input.module,
      action: input.action,
      actorUserId: input.actorUserId ?? undefined,
      subjectUserId: input.subjectUserId ?? undefined,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: input.beforeJson as object | undefined,
      afterJson: input.afterJson as object | undefined,
      metadata: input.metadata as object | undefined,
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
    },
  });
}
