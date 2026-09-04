import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStepCompletionTimes,
  computeStepCountsByHill,
  planGrowthSetInserts,
} from './backfillGrowthSets';
import { resolveCampProgress } from './hillProgress';

describe('backfillGrowthSets — pre-GrowthSet history', () => {
  const hillHope = 'hill-hope';
  const hillHone = 'hill-hone';

  it('counts 1 step per 3 completed missions on the same hill', () => {
    const rows = [
      { hillId: hillHope, completedAt: new Date('2026-01-01') },
      { hillId: hillHope, completedAt: new Date('2026-01-02') },
      { hillId: hillHope, completedAt: new Date('2026-01-03') },
      { hillId: hillHope, completedAt: new Date('2026-01-04') },
      { hillId: hillHope, completedAt: new Date('2026-01-05') },
    ];
    const counts = computeStepCountsByHill(rows);
    assert.equal(counts.get(hillHope), 1);
  });

  it('tracks multiple hills independently (HOPE 2 steps, HONE 1 step)', () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => ({
        hillId: hillHope,
        completedAt: new Date(`2026-02-${String(i + 1).padStart(2, '0')}`),
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        hillId: hillHone,
        completedAt: new Date(`2026-03-${String(i + 1).padStart(2, '0')}`),
      })),
    ];
    const counts = computeStepCountsByHill(rows);
    assert.equal(counts.get(hillHope), 2);
    assert.equal(counts.get(hillHone), 1);
  });

  it('uses the 3rd mission timestamp as step completion time', () => {
    const t3 = new Date('2026-04-03T12:00:00Z');
    const rows = [
      { hillId: hillHope, completedAt: new Date('2026-04-01') },
      { hillId: hillHope, completedAt: new Date('2026-04-02') },
      { hillId: hillHope, completedAt: new Date('2026-04-03T12:00:00Z') },
    ];
    const times = computeStepCompletionTimes(rows);
    assert.equal(times.get(hillHope)?.[0]?.toISOString(), t3.toISOString());
  });

  it('plans idempotent inserts — skips steps already in GrowthSet', () => {
    const completionTimes = [
      new Date('2026-05-01'),
      new Date('2026-05-02'),
      new Date('2026-05-03'),
    ];
    const plan = planGrowthSetInserts(1, 3, completionTimes);
    assert.equal(plan.length, 2);
    assert.equal(plan[0]!.stepIndex, 2);
    assert.equal(plan[1]!.stepIndex, 3);
  });

  it('preserves permanent camp progress after backfill (3 steps → Camp 2)', () => {
    const camp = resolveCampProgress(3);
    assert.equal(camp.currentCamp.name, 'Camp 2');
    assert.ok(camp.reachedCamps.some((c) => c.name === 'Camp 2'));
  });

  it('existing user with 9 HOPE missions and 0 GrowthSets gets 3 steps planned', () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({
      hillId: hillHope,
      completedAt: new Date(`2026-06-${String(i + 1).padStart(2, '0')}`),
    }));
    const expected = computeStepCountsByHill(rows).get(hillHope)!;
    assert.equal(expected, 3);
    const plan = planGrowthSetInserts(0, expected, computeStepCompletionTimes(rows).get(hillHope)!);
    assert.equal(plan.length, 3);
  });
});
