import { AppError } from '../middleware/errorHandler';
import { env } from '../config/env';

/** Milestone: client RBAC sign-off + institution scoping verified. See adminPermissions.ts role catalog. */
export const LEGACY_SUPER_ADMIN_FALLBACK_REMOVAL_DATE = env.ADMIN_LEGACY_FALLBACK_UNTIL;

export function isLegacyFallbackExpired(): boolean {
  const deadline = new Date(`${LEGACY_SUPER_ADMIN_FALLBACK_REMOVAL_DATE}T23:59:59.999Z`);
  return Date.now() > deadline.getTime();
}

export function assertLegacyFallbackAllowed() {
  if (isLegacyFallbackExpired()) {
    throw new AppError(
      `Staff role assignment required (legacy admin fallback removed ${LEGACY_SUPER_ADMIN_FALLBACK_REMOVAL_DATE}).`,
      403,
    );
  }
}

export function legacyFallbackAuditTag(usingLegacyFallback: boolean) {
  if (!usingLegacyFallback) return {};
  return {
    legacySuperAdminFallback: true,
    legacyFallbackRemovalDate: LEGACY_SUPER_ADMIN_FALLBACK_REMOVAL_DATE,
    legacyFallbackReviewRequired: true,
  };
}
