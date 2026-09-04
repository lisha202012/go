import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  assertGapContentReadyForClient,
  GAP_PLACEHOLDER_CONTENT_STATUS,
  GapPlaceholderContentError,
  isGapContentGuardEnforced,
  readGapContentMeta,
} from './gapContentGuard';

const ENV_KEYS = ['NODE_ENV', 'GOFAM_DEPLOY_ENV'] as const;

function saveEnv() {
  return Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

describe('gapContentGuard', () => {
  const envSnapshot = saveEnv();

  afterEach(() => {
    restoreEnv(envSnapshot);
  });

  it('does not enforce in local development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.GOFAM_DEPLOY_ENV;
    assert.equal(isGapContentGuardEnforced(), false);
    assert.doesNotThrow(() => assertGapContentReadyForClient());
  });

  it('does not enforce in test runs', () => {
    process.env.NODE_ENV = 'test';
    process.env.GOFAM_DEPLOY_ENV = 'production';
    assert.equal(isGapContentGuardEnforced(), false);
    assert.doesNotThrow(() => assertGapContentReadyForClient());
  });

  it('enforces when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GOFAM_DEPLOY_ENV;
    assert.equal(isGapContentGuardEnforced(), true);
  });

  it('enforces when GOFAM_DEPLOY_ENV is staging or demo', () => {
    process.env.NODE_ENV = 'development';
    process.env.GOFAM_DEPLOY_ENV = 'staging';
    assert.equal(isGapContentGuardEnforced(), true);

    process.env.GOFAM_DEPLOY_ENV = 'demo';
    assert.equal(isGapContentGuardEnforced(), true);
  });

  it('throws in enforced environments while gap-945.json is dev-placeholder', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GOFAM_DEPLOY_ENV;

    const meta = readGapContentMeta();
    if (meta.contentStatus !== GAP_PLACEHOLDER_CONTENT_STATUS) {
      return;
    }

    assert.throws(() => assertGapContentReadyForClient(), GapPlaceholderContentError);
  });
});
