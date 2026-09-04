import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildThreeWeekHillChallenge } from './threeWeekHillChallenge';

describe('threeWeekHillChallenge', () => {
  it('starts empty', () => {
    const c = buildThreeWeekHillChallenge({});
    assert.equal(c.tasksCompleted, 0);
    assert.equal(c.missionsCompleted, 0);
    assert.equal(c.currentWeek, 1);
    assert.equal(c.complete, false);
  });

  it('counts one completed step as task 1 / 3 missions', () => {
    const c = buildThreeWeekHillChallenge({
      completedSteps: 1,
      missionsThisWeek: 3,
      dailyFlowComplete: true,
    });
    assert.equal(c.tasksCompleted, 1);
    assert.equal(c.missionsCompleted, 3);
    assert.equal(c.currentWeek, 2);
    assert.equal(c.complete, false);
  });

  it('adds in-progress missions toward the next task', () => {
    const c = buildThreeWeekHillChallenge({
      completedSteps: 1,
      missionsThisWeek: 2,
      dailyFlowComplete: false,
    });
    assert.equal(c.tasksCompleted, 1);
    assert.equal(c.missionsCompleted, 5);
    assert.equal(c.missionsThisTask, 2);
    assert.equal(c.currentTask, 2);
  });

  it('completes at 3 tasks / 9 missions', () => {
    const c = buildThreeWeekHillChallenge({ completedSteps: 3 });
    assert.equal(c.tasksCompleted, 3);
    assert.equal(c.missionsCompleted, 9);
    assert.equal(c.complete, true);
    assert.equal(c.percentComplete, 100);
  });
});
