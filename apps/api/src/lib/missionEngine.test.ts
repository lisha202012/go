import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Mission } from '@prisma/client';
import {
  MISSION_POOL_SIZE,
  missionGroupForOrder,
  recommendThreeMissions,
  validateUserMissionSelection,
} from './missionEngine';

function mockMission(
  order: number,
  overrides: Partial<Mission> = {},
): Mission {
  const missionGroup = missionGroupForOrder(order);
  return {
    id: `m-${order}`,
    hillId: 'hill-1',
    categoryCode: 'V6',
    missionGroup,
    externalId: `MIS-V6-HOPE-${String(order).padStart(2, '0')}`,
    title: `Mission ${order}`,
    description: `Description ${order}`,
    imageUrl: null,
    coinReward: 50,
    pulseReward: 5,
    requiresReflection: false,
    requiresEvidence: false,
    isFamilyMission: false,
    order,
    whyText: null,
    ...overrides,
    isDisabled: overrides.isDisabled ?? false,
    disabledReason: overrides.disabledReason ?? null,
    disabledAt: overrides.disabledAt ?? null,
  };
}

function buildPool(): Mission[] {
  return Array.from({ length: MISSION_POOL_SIZE }, (_, i) => mockMission(i + 1));
}

describe('missionGroupForOrder', () => {
  it('maps orders 1–15 to groups 1–5', () => {
    assert.equal(missionGroupForOrder(1), 1);
    assert.equal(missionGroupForOrder(3), 1);
    assert.equal(missionGroupForOrder(4), 2);
    assert.equal(missionGroupForOrder(9), 3);
    assert.equal(missionGroupForOrder(13), 5);
    assert.equal(missionGroupForOrder(15), 5);
  });
});

describe('recommendThreeMissions', () => {
  it('returns exactly 3 missions from 3 different groups', () => {
    const pool = buildPool();
    const recommended = recommendThreeMissions(pool, 'user:hill:focus');

    assert.equal(recommended.length, 3);
    const groups = new Set(recommended.map((m) => m.missionGroup));
    assert.equal(groups.size, 3);
  });

  it('is deterministic for the same seed', () => {
    const pool = buildPool();
    const first = recommendThreeMissions(pool, 'seed-a');
    const second = recommendThreeMissions(pool, 'seed-a');
    assert.deepEqual(
      first.map((m) => m.id),
      second.map((m) => m.id),
    );
  });

  it('varies recommendations for different seeds', () => {
    const pool = buildPool();
    const first = recommendThreeMissions(pool, 'seed-a');
    const second = recommendThreeMissions(pool, 'seed-b');
    const sameIds =
      first.every((m, i) => m.id === second[i]?.id) &&
      first.length === second.length;
    assert.equal(sameIds, false);
  });
});

describe('validateUserMissionSelection', () => {
  it('allows three missions even when they share internal groups (Section 5 swaps)', () => {
    const pool = buildPool();
    const picks = [pool[0], pool[1], pool[2]];
    assert.doesNotThrow(() => validateUserMissionSelection(picks, 'hill-1', 'V6'));
    assert.equal(new Set(picks.map((m) => m.missionGroup)).size, 1);
  });
});
