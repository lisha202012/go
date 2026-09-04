import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MissionStatus } from '@prisma/client';
import {
  firstAvailableMissionIdInBlock,
  hasNewCalendarWeekStartedSince,
  resolveWeekAvailability,
  startOfNextWeek,
} from './missionWeekGate';

describe('missionWeekGate', () => {
  const blockWeeks = [
    { hillBlock: 2, taskNumber: 1, mission: { id: 'm1' } },
    { hillBlock: 2, taskNumber: 2, mission: { id: 'm2' } },
    { hillBlock: 2, taskNumber: 3, mission: { id: 'm3' } },
  ];

  it('allows mission 1 without prior completion', () => {
    const progress = new Map([
      ['m1', { status: MissionStatus.current }],
      ['m2', { status: MissionStatus.locked }],
    ]);
    const availability = resolveWeekAvailability(blockWeeks[0]!, blockWeeks, progress);
    assert.equal(availability.lockedByWeek, false);
    assert.equal(firstAvailableMissionIdInBlock(blockWeeks, 2, progress), 'm1');
  });

  it('blocks mission 2 in the same calendar week as mission 1 completion', () => {
    const completedAt = new Date('2026-08-13T16:00:00.000Z');
    const now = new Date('2026-08-13T18:00:00.000Z');
    const progress = new Map([
      ['m1', { status: MissionStatus.completed, completedAt }],
      ['m2', { status: MissionStatus.locked }],
    ]);
    const availability = resolveWeekAvailability(blockWeeks[1]!, blockWeeks, progress, now);
    assert.equal(availability.lockedByWeek, true);
    assert.ok(availability.opensAt);
    assert.equal(firstAvailableMissionIdInBlock(blockWeeks, 2, progress, now), null);
  });

  it('unlocks mission 2 after a new calendar week starts', () => {
    const completedAt = new Date('2026-08-13T16:00:00.000Z');
    const now = new Date('2026-08-17T10:00:00.000Z');
    const progress = new Map([
      ['m1', { status: MissionStatus.completed, completedAt }],
      ['m2', { status: MissionStatus.locked }],
    ]);
    assert.equal(hasNewCalendarWeekStartedSince(completedAt, now), true);
    assert.equal(firstAvailableMissionIdInBlock(blockWeeks, 2, progress, now), 'm2');
    assert.equal(
      startOfNextWeek(completedAt).getTime() <= now.getTime(),
      true,
    );
  });
});
