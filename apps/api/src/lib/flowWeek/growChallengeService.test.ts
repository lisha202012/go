import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  seedsFromLedgerReference,
  FLOW_WEEK_SEED_REF_PREFIXES,
} from './growChallengeService';
import { FLOW_WEEK_SEED_REWARDS } from './types';

describe('growChallenge — seed ledger counting', () => {
  it('counts one seed per daily flow grant', () => {
    assert.equal(
      seedsFromLedgerReference(`${FLOW_WEEK_SEED_REF_PREFIXES.daily}day-abc`),
      FLOW_WEEK_SEED_REWARDS.dailyFlow,
    );
  });

  it('counts three seeds per perfect FLOW week grant', () => {
    assert.equal(
      seedsFromLedgerReference(`${FLOW_WEEK_SEED_REF_PREFIXES.perfectWeek}user:2026-08-24`),
      FLOW_WEEK_SEED_REWARDS.perfectWeek,
    );
  });

  it('returns zero for unrelated references', () => {
    assert.equal(seedsFromLedgerReference('flow_daily_bonus:xyz'), 0);
  });
});
