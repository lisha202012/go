import { Router } from 'express';
import { z } from 'zod';
import { listAuditLogs, listAuditLogsForExport } from '../../lib/adminAuditService';
import { rowsToCsv, sendCsv } from '../../lib/adminCsvExport';

/** Section 85 — Cross-cutting audit log (auditor / super_admin). */
export const auditAdminRouter = Router();

const auditListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  module: z.string().optional(),
  action: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

auditAdminRouter.get('/logs', async (req, res, next) => {
  try {
    const query = auditListSchema.parse(req.query);
    res.json(await listAuditLogs(query));
  } catch (error) {
    next(error);
  }
});
import { clearAuditLogs, listAuditLogs, listAuditLogsForExport } from '../../lib/adminAuditService';
import { requireAdminPermission } from '../../middleware/adminAuth';
import { auditAdminAction } from '../../lib/adminAudit';

auditAdminRouter.get('/logs/export.csv', async (req, res, next) => {
  try {
    const query = auditListSchema.parse(req.query);
    const rows = await listAuditLogsForExport(query);
    const csv = rowsToCsv(
      ['createdAt', 'module', 'action', 'entityType', 'entityId', 'actor', 'subject'],
      rows.map((log) => ({
        createdAt: log.createdAt.toISOString(),
        module: log.module,
        action: log.action,
        entityType: log.entityType ?? '',
        entityId: log.entityId ?? '',
        actor: log.actor?.email ?? '',
        subject: log.subject?.email ?? '',
      })),
    );
    sendCsv(res, 'audit-log.csv', csv);
  } catch (error) {
    next(error);
  }
});

auditAdminRouter.delete('/logs', requireAdminPermission('admin.roles.manage'), async (req, res, next) => {
  try {
    const result = await clearAuditLogs();
    await auditAdminAction(req, {
      module: 'system',
      action: 'admin.audit.clear_all',
      metadata: { deleted: result.deleted },
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});
