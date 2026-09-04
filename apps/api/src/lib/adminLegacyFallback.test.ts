import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_SUPER_ADMIN_FALLBACK_REMOVAL_DATE,
  isLegacyFallbackExpired,
  legacyFallbackAuditTag,
} from './adminLegacyFallback';

describe('adminLegacyFallback', () => {
  it('has a firm removal date of 2026-09-15', () => {
    assert.equal(LEGACY_SUPER_ADMIN_FALLBACK_REMOVAL_DATE, '2026-09-15');
    assert.equal(isLegacyFallbackExpired(), false);
  });

  it('tags audit entries when legacy fallback is active', () => {
    const tag = legacyFallbackAuditTag(true);
    assert.equal(tag.legacySuperAdminFallback, true);
    assert.equal(tag.legacyFallbackRemovalDate, '2026-09-15');
    assert.equal(tag.legacyFallbackReviewRequired, true);
  });

  it('returns empty tag when explicit staff assignment is used', () => {
    assert.deepEqual(legacyFallbackAuditTag(false), {});
  });
});
