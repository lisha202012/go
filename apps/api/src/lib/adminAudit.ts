import type { Request } from 'express';
import type { AdminModule } from './adminPermissions';
import { legacyFallbackAuditTag } from './adminLegacyFallback';
import { auditContextFromRequest, writeAuditLog, type AuditModule } from './auditService';

function toAuditModule(module: AdminModule | 'system'): AuditModule {
  if (module === 'system') return 'system';
  return module;
}

export async function auditAdminAction(
  req: Request,
  input: {
    module: AdminModule | 'system';
    action: string;
    subjectUserId?: string | null;
    entityType?: string;
    entityId?: string;
    beforeJson?: unknown;
    afterJson?: unknown;
    metadata?: unknown;
    actorUserId?: string | null;
  },
) {
  const ctx = auditContextFromRequest(req);
  return writeAuditLog({
    module: toAuditModule(input.module),
    action: input.action,
    actorUserId: input.actorUserId ?? ctx.actorUserId,
    subjectUserId: input.subjectUserId,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeJson: input.beforeJson,
    afterJson: input.afterJson,
    metadata: input.metadata,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

export async function auditAdminRequest(
  req: Request,
  input: {
    module: AdminModule | 'system';
    action: string;
    metadata?: unknown;
  },
) {
  return auditAdminAction(req, input);
}

/** Use for mutations — includes before/after snapshots (§85). */
export async function auditAdminMutation(
  req: Request,
  input: {
    module: AdminModule;
    action: string;
    entityType: string;
    entityId?: string;
    subjectUserId?: string | null;
    beforeJson?: unknown;
    afterJson?: unknown;
    metadata?: unknown;
  },
) {
  return auditAdminAction(req, {
    ...input,
    metadata: {
      ...(input.metadata as object | undefined),
      ...legacyFallbackAuditTag(Boolean(req.legacySuperAdminFallback)),
    },
  });
}
