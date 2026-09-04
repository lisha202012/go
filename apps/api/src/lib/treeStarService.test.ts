import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TREE_LEVELS,
  GAP_STATUS_STARS,
  COIN_MILESTONES,
  COIN_MILESTONE_STARS,
  COIN_MILLION_FIRST,
  COIN_MILLION_STARS,
  buildTreeProgressFromTotal,
  nextCoinMilestone,
} from './treeStarService';
import { getFlowStatus } from '../services/gapScoring';

describe('treeStarService — level boundaries', () => {
  it('maps exact thresholds to the level they unlock', () => {
    assert.equal(buildTreeProgressFromTotal(0).treeLevel, 1);
    assert.equal(buildTreeProgressFromTotal(9).treeLevel, 1);
    assert.equal(buildTreeProgressFromTotal(10).treeLevel, 2);
    assert.equal(buildTreeProgressFromTotal(24).treeLevel, 2);
    assert.equal(buildTreeProgressFromTotal(25).treeLevel, 3);
    assert.equal(buildTreeProgressFromTotal(50).treeLevel, 4);
    assert.equal(buildTreeProgressFromTotal(75).treeLevel, 5);
    assert.equal(buildTreeProgressFromTotal(100).treeLevel, 6);
    assert.equal(buildTreeProgressFromTotal(150).treeLevel, 7);
    assert.equal(buildTreeProgressFromTotal(200).treeLevel, 8);
    assert.equal(buildTreeProgressFromTotal(300).treeLevel, 9);
    assert.equal(buildTreeProgressFromTotal(490).treeLevel, 10);
    assert.equal(buildTreeProgressFromTotal(999).treeLevel, 10);
  });

  it('computes starsIntoLevel relative to current floor', () => {
    const p = buildTreeProgressFromTotal(36);
    assert.equal(p.treeLevel, 3);
    assert.equal(p.currentStage.stage, 'Young Tree');
    assert.equal(p.starsIntoLevel, 36 - 25);
    assert.equal(p.starsNeededForNextLevel, 50 - 25);
    assert.equal(p.nextStage?.stage, 'Flourishing Tree');
  });

  it('has no next stage at max level', () => {
    const p = buildTreeProgressFromTotal(490);
    assert.equal(p.nextStage, null);
    assert.equal(p.starsNeededForNextLevel, null);
  });

  it('exposes 10 cumulative stages ending at 490', () => {
    assert.equal(TREE_LEVELS.length, 10);
    assert.equal(TREE_LEVELS[9].required, 490);
  });
});

describe('treeStarService — GAP status stars', () => {
  it('scales with the 5 FLOW labels', () => {
    assert.equal(GAP_STATUS_STARS[getFlowStatus(40)], 1);
    assert.equal(GAP_STATUS_STARS[getFlowStatus(55)], 2);
    assert.equal(GAP_STATUS_STARS[getFlowStatus(70)], 3);
    assert.equal(GAP_STATUS_STARS[getFlowStatus(85)], 5);
    assert.equal(GAP_STATUS_STARS[getFlowStatus(86)], 7);
  });
});

describe('treeStarService — coin milestones', () => {
  it('matches the worked example through 100k (20 stars)', () => {
    let total = 0;
    for (const t of COIN_MILESTONES) {
      if (100_000 >= t) total += COIN_MILESTONE_STARS[t];
    }
    assert.equal(total, 20);
  });

  it('treats 1.5M as the first million-step reward', () => {
    assert.equal(COIN_MILLION_FIRST, 1_500_000);
    assert.equal(COIN_MILLION_STARS, 100);
    assert.equal(nextCoinMilestone(500_000), 1_500_000);
    assert.equal(nextCoinMilestone(1_500_000), 2_500_000);
  });
});
