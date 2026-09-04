import { AppError } from '../middleware/errorHandler';

/** Institution-scoped data access (Section 84). Write access gated until fully tested. */
export function assertInstitutionScope(params: {
  actorInstitutionId: string | null | undefined;
  resourceInstitutionId: string | null | undefined;
  action: 'read' | 'write';
}) {
  const { actorInstitutionId, resourceInstitutionId } = params;
  if (!actorInstitutionId) {
    throw new AppError('Institution scope not configured for this staff account', 403);
  }
  if (resourceInstitutionId !== actorInstitutionId) {
    throw new AppError('Cross-institution access denied', 403);
  }
}

export function filterByInstitution<T extends { institutionId?: string | null }>(
  rows: T[],
  institutionId: string,
): T[] {
  return rows.filter((row) => row.institutionId === institutionId);
}

export function institutionScopeWhere(institutionId: string | null | undefined) {
  if (!institutionId) return {};
  return { institutionId };
}
