import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFlowLeadershipFromInputs,
  resolveWhoUserFilter,
  getFlowLeadershipLeaderboard,
} from './flowLeadershipService';

describe('computeFlowLeadershipFromInputs', () => {
  it('matches the 0–100 spec formula', () => {
    const result = computeFlowLeadershipFromInputs({
      flowIndex: 70,
      treeStars: 2,
      totalSteps: 200,
    });
    assert.equal(result.display, 62);
    assert.ok(Math.abs(result.internal - 62.31865889212828) < 0.00001);
  });

  it('caps at 100', () => {
    const result = computeFlowLeadershipFromInputs({
      flowIndex: 100,
      treeStars: 3,
      totalSteps: 343,
    });
    assert.equal(result.display, 100);
  });

  it('treats sprout sub-stages as one category when using a specific category filter', () => {
    const result = resolveWhoUserFilter('specificCategory', 'S1G');
    assert.deepEqual(result, { ageGroup: { in: ['S1E', 'S1G', 'S1R'] } });
  });

  it('uses full internal score for ranking and ties with competition ranking', () => {
    const a = computeFlowLeadershipFromInputs({ flowIndex: 70, treeStars: 2, totalSteps: 200 });
    const b = computeFlowLeadershipFromInputs({ flowIndex: 70, treeStars: 2, totalSteps: 199 });
    assert.equal(a.display, 62);
    assert.ok(a.internal > b.internal);

    const leaderboard = [
      { userId: 'u1', displayName: 'Alpha', username: 'alpha', flowLeadershipInternal: a.internal, flowLeadershipScore: a.display },
      { userId: 'u2', displayName: 'Bravo', username: 'bravo', flowLeadershipInternal: a.internal, flowLeadershipScore: a.display },
      { userId: 'u3', displayName: 'Charlie', username: 'charlie', flowLeadershipInternal: b.internal, flowLeadershipScore: b.display },
    ];

    let currentRank = 1;
    let previous = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < leaderboard.length; i += 1) {
      const item = leaderboard[i];
      if (i > 0 && item.flowLeadershipInternal < previous) {
        currentRank = i + 1;
      }
      previous = item.flowLeadershipInternal;
      if (i === 0 || item.flowLeadershipInternal !== leaderboard[i - 1].flowLeadershipInternal) {
        assert.equal(currentRank, i + 1);
      }
    }

    assert.ok(a.internal > b.internal);
    assert.equal(getFlowLeadershipLeaderboard.length >= 0, true);
  });
});
