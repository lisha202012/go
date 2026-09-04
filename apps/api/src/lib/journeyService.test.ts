import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MissionStatus } from '@prisma/client';
import { firstAvailableMissionIdInBlock } from './missionWeekGate';

describe('firstAvailableMissionIdInBlock', () => {
  const weeks = [
    { hillBlock: 2, taskNumber: 1, mission: { id: 'm1' } },
    { hillBlock: 2, taskNumber: 2, mission: { id: 'm2' } },
    { hillBlock: 2, taskNumber: 3, mission: { id: 'm3' } },
  ];

  it('returns the first mission when none are complete', () => {
    const progress = new Map([
      ['m1', { status: MissionStatus.current }],
      ['m2', { status: MissionStatus.locked }],
      ['m3', { status: MissionStatus.locked }],
    ]);
    assert.equal(firstAvailableMissionIdInBlock(weeks, 2, progress), 'm1');
  });

  it('returns null for mission 2 in the same week as mission 1 completion', () => {
    const progress = new Map([
      ['m1', { status: MissionStatus.completed, completedAt: new Date('2026-08-13T10:00:00.000Z') }],
      ['m2', { status: MissionStatus.locked }],
      ['m3', { status: MissionStatus.locked }],
    ]);
    const now = new Date('2026-08-13T18:00:00.000Z');
    assert.equal(firstAvailableMissionIdInBlock(weeks, 2, progress, now), null);
  });

  it('returns mission 2 after a new calendar week', () => {
    const progress = new Map([
      ['m1', { status: MissionStatus.completed, completedAt: new Date('2026-08-13T10:00:00.000Z') }],
      ['m2', { status: MissionStatus.locked }],
      ['m3', { status: MissionStatus.locked }],
    ]);
    const now = new Date('2026-08-18T10:00:00.000Z');
    assert.equal(firstAvailableMissionIdInBlock(weeks, 2, progress, now), 'm2');
  });

  it('returns null when the whole step is complete', () => {
    const progress = new Map([
      ['m1', { status: MissionStatus.completed, completedAt: new Date('2026-08-01T10:00:00.000Z') }],
      ['m2', { status: MissionStatus.completed, completedAt: new Date('2026-08-08T10:00:00.000Z') }],
      ['m3', { status: MissionStatus.completed, completedAt: new Date('2026-08-15T10:00:00.000Z') }],
    ]);
    assert.equal(firstAvailableMissionIdInBlock(weeks, 2, progress), null);
  });
});
