import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  assertGapMappingValid,
  GapMissionMappingError,
  runGapMappingAudit,
} from './gapMappingGuard';
import { isGapContentGuardEnforced } from './gapContentGuard';

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

describe('gapMappingGuard', () => {
  const envSnapshot = saveEnv();

  afterEach(() => {
    restoreEnv(envSnapshot);
  });

  it('does not enforce mapping at API startup in local development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.GOFAM_DEPLOY_ENV;
    assert.equal(isGapContentGuardEnforced(), false);
    assert.doesNotThrow(() => assertGapMappingValid());
  });

  it('does not enforce mapping at API startup in test runs', () => {
    process.env.NODE_ENV = 'test';
    process.env.GOFAM_DEPLOY_ENV = 'production';
    assert.doesNotThrow(() => assertGapMappingValid());
  });

  it('runs mapping audit script and returns structured result', () => {
    const result = runGapMappingAudit();
    assert.equal(typeof result.ok, 'boolean');
    assert.equal(typeof result.output, 'string');
  });

  it('throws in enforced environments when mapping audit fails', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GOFAM_DEPLOY_ENV;

    const { ok } = runGapMappingAudit();
    if (ok) {
      return;
    }

    assert.throws(() => assertGapMappingValid(), GapMissionMappingError);
  });
});
