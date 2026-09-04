import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveLeadershipCategory } from './journeyRole';

describe('journeyRole', () => {
  it('routes self-growth adult choices to Voyager GAP category', () => {
    assert.equal(resolveLeadershipCategory('D5', 'self_growth'), 'V6');
    assert.equal(resolveLeadershipCategory('V6', 'self_growth'), 'V6');
  });

  it('routes guidance and both adult choices to Navigator GAP category', () => {
    assert.equal(resolveLeadershipCategory('D5', 'next_generation_guidance'), 'N7');
    assert.equal(resolveLeadershipCategory('V6', 'both'), 'N7');
  });

  it('keeps non-adult categories unchanged', () => {
    assert.equal(resolveLeadershipCategory('A2', 'self_growth'), 'A2');
  });
});
