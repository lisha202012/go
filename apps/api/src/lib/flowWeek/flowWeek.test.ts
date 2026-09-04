import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { HillCode } from '@prisma/client';
import { rankHillsByGapScore } from './dayRankings';
import { deriveLockstepStepsFromCounts } from './lockstep';
import {
  computeLegacyStepsByHill,
  lockstepFromLegacySteps,
  peakFromLegacySteps,
} from './cohort';
import {
  bootstrapPersonalWeekStart,
  calendarDayBounds,
  currentFlowWeekBounds,
  currentWeekSliceBounds,
  hillForJourneyDay,
  isDateInFlowWeek,
  isFlowIndexDay,
  journeyDayIndex,
  nextPersonalWeekStart,
  startOfDay,
} from './personalWeek';
import { evaluateRollbackGuard } from './rollbackGuard';
import { needsDailyMissionPick, canPickMissionsForDay } from './flowWeekDailyPick';
import { summarizeWeeklyChakras } from './flowWeekChakras';
import { formatCompletionCountLabel, resolveMissionReward } from './homeHillRewards';
import { FLOW_WEEK_COIN_REWARDS } from './types';

describe('flowWeek/dayRankings — tie-break', () => {
  it('assigns earlier day to hill later in HILL_CODE_ORDER when scores tie', () => {
    const hillRaws = [
      { hillId: 'hill-HOOK', hillCode: 'HOOK' as HillCode, rawScore: 10 },
      { hillId: 'hill-HOPE', hillCode: 'HOPE' as HillCode, rawScore: 12 },
      { hillId: 'hill-HOST', hillCode: 'HOST' as HillCode, rawScore: 12 },
      { hillId: 'hill-HONE', hillCode: 'HONE' as HillCode, rawScore: 15 },
      { hillId: 'hill-HOLD', hillCode: 'HOLD' as HillCode, rawScore: 16 },
      { hillId: 'hill-HOOD', hillCode: 'HOOD' as HillCode, rawScore: 17 },
      { hillId: 'hill-HORN', hillCode: 'HORN' as HillCode, rawScore: 18 },
    ];

    const rankings = rankHillsByGapScore(hillRaws);
    assert.deepEqual(rankings.slice(0, 4), [
      'hill-HOOK',
      'hill-HOST',
      'hill-HOPE',
      'hill-HONE',
    ]);
  });
});

describe('flowWeek/lockstep — derive from GrowthSet counts', () => {
  it('returns min count across all hills', () => {
    const counts = new Map([
      ['h1', 5],
      ['h2', 3],
      ['h3', 7],
    ]);
    assert.equal(deriveLockstepStepsFromCounts(counts, ['h1', 'h2', 'h3']), 3);
  });

  it('treats missing hills as zero', () => {
    const counts = new Map([['h1', 2]]);
    assert.equal(deriveLockstepStepsFromCounts(counts, ['h1', 'h2', 'h3']), 0);
  });
});

describe('flowWeek/cohort — legacy step aggregates', () => {
  it('computes lockstep as min and peak as max', () => {
    const legacy = computeLegacyStepsByHill(
      new Map([
        ['h1', 4],
        ['h2', 2],
        ['h3', 6],
      ]),
      [
        { id: 'h1', code: 'HOPE' },
        { id: 'h2', code: 'HONE' },
        { id: 'h3', code: 'HOLD' },
      ] as never,
    );
    assert.equal(lockstepFromLegacySteps(legacy), 2);
    assert.equal(peakFromLegacySteps(legacy), 6);
  });
});

describe('flowWeek/rollbackGuard', () => {
  it('blocks rollback when v2 step awards exist beyond migration baseline', () => {
    const blocked = evaluateRollbackGuard({
      flowLockstepSteps: 4,
      lockstepStepsAtMigration: 3,
      postCutoverAwardRows: 7,
    });
    assert.equal(blocked.allowed, false);
  });

  it('allows rollback when counter unchanged despite post-cutover rows absent', () => {
    const allowed = evaluateRollbackGuard({
      flowLockstepSteps: 3,
      lockstepStepsAtMigration: 3,
      postCutoverAwardRows: 0,
    });
    assert.equal(allowed.allowed, true);
  });
});

describe('flowWeek/dailyPick — needsDailyMissionPick', () => {
  it('requires pick when fewer than 3 missions are assigned', () => {
    assert.equal(
      needsDailyMissionPick({ prescribedMissionIds: [], prescribedCompleted: 0, dailyFlowComplete: false }),
      true,
    );
    assert.equal(
      needsDailyMissionPick({
        prescribedMissionIds: ['a', 'b'],
        prescribedCompleted: 0,
        dailyFlowComplete: false,
      }),
      true,
    );
  });

  it('does not require pick once 3 missions are confirmed, even before start', () => {
    assert.equal(
      needsDailyMissionPick({
        prescribedMissionIds: ['a', 'b', 'c'],
        prescribedCompleted: 0,
        dailyFlowComplete: false,
      }),
      false,
    );
  });

  it('does not require pick after mission activity started', () => {
    assert.equal(
      needsDailyMissionPick(
        {
          prescribedMissionIds: ['a', 'b'],
          prescribedCompleted: 0,
          dailyFlowComplete: false,
        },
        true,
      ),
      false,
    );
  });
});

describe('flowWeek/dailyPick — canPickMissionsForDay', () => {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  it('allows picking for today and future days before activity', () => {
    assert.equal(
      canPickMissionsForDay(
        {
          prescribedMissionIds: [],
          prescribedCompleted: 0,
          dailyFlowComplete: false,
          calendarDate: tomorrow,
        },
        false,
        today,
      ),
      true,
    );
  });

  it('allows first pick on a missed day so late catch-up (+10) is possible', () => {
    assert.equal(
      canPickMissionsForDay(
        {
          prescribedMissionIds: [],
          prescribedCompleted: 0,
          dailyFlowComplete: false,
          calendarDate: yesterday,
        },
        false,
        today,
      ),
      true,
    );
  });

  it('locks past days that already have 3 missions picked', () => {
    assert.equal(
      canPickMissionsForDay(
        {
          prescribedMissionIds: ['a', 'b', 'c'],
          prescribedCompleted: 0,
          dailyFlowComplete: false,
          calendarDate: yesterday,
        },
        false,
        today,
      ),
      false,
    );
  });
});

describe('flowWeek/personalWeek — journey from account creation', () => {
  it('starts journey on account creation day (Thursday example)', () => {
    const thu = new Date('2026-08-20T12:00:00');
    assert.equal(thu.getDay(), 4);
    const start = bootstrapPersonalWeekStart(thu);
    assert.equal(start.getDay(), 4);
    assert.equal(start.getDate(), 20);
  });

  it('assigns Sunday as day 4 and FLOW Index day when created Thursday', () => {
    const thu = new Date('2026-08-20T12:00:00');
    const sun = new Date('2026-08-23T12:00:00');
    assert.equal(journeyDayIndex(thu, sun), 4);
    assert.equal(isFlowIndexDay(sun), true);
  });

  it('maps Monday to day 5 after Thursday signup', () => {
    const thu = new Date('2026-08-20T12:00:00');
    const mon = new Date('2026-08-24T12:00:00');
    assert.equal(journeyDayIndex(thu, mon), 5);
  });

  it('current week slice is days 1–7 in the first calendar week of the journey', () => {
    const thu = new Date('2026-08-20T12:00:00');
    const fri = new Date('2026-08-21T12:00:00');
    const slice = currentWeekSliceBounds(thu, fri);
    assert.deepEqual(slice, { startDayIndex: 1, endDayIndex: 7 });
  });

  it('cycles hills every 7 days within a 21-day schedule', () => {
    const rankings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7'];
    assert.equal(hillForJourneyDay(rankings, 1), 'h1');
    assert.equal(hillForJourneyDay(rankings, 7), 'h7');
    assert.equal(hillForJourneyDay(rankings, 8), 'h1');
  });

  it('finds next Wednesday from Monday', () => {
    const monday = new Date('2026-08-10T12:00:00');
    const nextWed = nextPersonalWeekStart(monday, 3);
    assert.equal(nextWed.getDay(), 3);
    assert.equal(nextWed.getDate(), 12);
  });

  it('current FLOW week is Sun–Sat when gofamWeekStartDay is Sunday', () => {
    const wed = new Date('2026-08-26T12:00:00');
    const { weekStart, weekEnd } = currentFlowWeekBounds(wed, 0);
    assert.equal(weekStart.getDay(), 0);
    assert.equal(weekStart.getDate(), 23);
    assert.equal(weekEnd.getDay(), 6);
    assert.equal(weekEnd.getDate(), 29);
    assert.equal(isDateInFlowWeek(new Date('2026-08-22T12:00:00'), weekStart, weekEnd), false);
    assert.equal(isDateInFlowWeek(new Date('2026-08-26T12:00:00'), weekStart, weekEnd), true);
  });

  it('calendarDayBounds covers the full local calendar day', () => {
    const noon = new Date('2026-08-28T15:30:00');
    const { dayStart, dayEnd } = calendarDayBounds(noon);
    assert.equal(dayStart.getHours(), 0);
    assert.equal(dayEnd.getTime() - dayStart.getTime(), 24 * 60 * 60 * 1000);
  });
});

describe('flowWeek/chakras — weekly FLOW activations (not GLOW virtues)', () => {
  it('counts one chakra per hill with 3/3 complete', () => {
    const stats = summarizeWeeklyChakras([
      { hillCode: 'HOOK', hillName: 'Hook', dailyFlowComplete: true, prescribedCompleted: 3 },
      { hillCode: 'HOPE', hillName: 'Hope', dailyFlowComplete: false, prescribedCompleted: 2 },
      { hillCode: 'HONE', hillName: 'Hone', dailyFlowComplete: false, prescribedCompleted: 0 },
    ]);
    assert.equal(stats.activated, 1);
    assert.equal(stats.total, 3);
    assert.equal(stats.perfectWeek, false);
    assert.equal(stats.hills[0].pulses, 3);
    assert.equal(stats.hills[0].dayIndex, 1);
    assert.equal(stats.hills[1].pulses, 2);
    assert.equal(stats.hills[1].dayIndex, 2);
    assert.equal(stats.hills[2].pulses, 0);
    assert.equal(stats.hills[1].extraCompleted, 0);
    assert.equal(stats.hills[0].isToday, false);
    assert.equal(stats.todayHillCode, null);
  });

  it('marks only the current Home Hill as today', () => {
    const stats = summarizeWeeklyChakras([
      { hillCode: 'HOPE', hillName: 'Hope', dailyFlowComplete: false, prescribedCompleted: 0 },
      {
        hillCode: 'HORN',
        hillName: 'Horn',
        dailyFlowComplete: false,
        prescribedCompleted: 1,
        isToday: true,
      },
    ]);
    assert.equal(stats.todayHillCode, 'HORN');
    assert.equal(stats.hills[0].isToday, false);
    assert.equal(stats.hills[1].isToday, true);
  });

  it('keeps extra (+10) completions separate from the 3 daily dots (today only)', () => {
    const stats = summarizeWeeklyChakras([
      {
        hillCode: 'HONE',
        hillName: 'Hone',
        dailyFlowComplete: true,
        prescribedCompleted: 3,
        extraCompleted: 2,
        isToday: true,
      },
    ]);
    assert.equal(stats.hills[0].pulses, 3);
    assert.equal(stats.hills[0].prescribedCompleted, 3);
    assert.equal(stats.hills[0].extraCompleted, 2);
  });

  it('drops extra dots from past hills — only today Home Hill keeps +N', () => {
    const stats = summarizeWeeklyChakras([
      {
        hillCode: 'HOPE',
        hillName: 'Hope',
        dailyFlowComplete: true,
        prescribedCompleted: 3,
        extraCompleted: 2,
        isPast: true,
      },
      {
        hillCode: 'HORN',
        hillName: 'Horn',
        dailyFlowComplete: false,
        prescribedCompleted: 1,
        extraCompleted: 1,
        isToday: true,
      },
    ]);
    assert.equal(stats.hills[0].extraCompleted, 0);
    assert.equal(stats.hills[1].extraCompleted, 1);
    assert.equal(stats.hills[0].isPast, true);
  });

  it('keeps extra mission counts on the hill they were actually completed on', () => {
    const stats = summarizeWeeklyChakras(
      [
        { hillCode: 'HOPE', hillName: 'Hope', dailyFlowComplete: false, prescribedCompleted: 0 },
        { hillCode: 'HORN', hillName: 'Horn', dailyFlowComplete: false, prescribedCompleted: 0, isToday: true },
      ],
      { HOPE: 1, HORN: 0 },
    );

    assert.equal(stats.hills[0].extraCompleted, 1);
    assert.equal(stats.hills[1].extraCompleted, 0);
  });

  it('treats all 7 hills complete as Perfect FLOW Week', () => {
    const days = ['HOOK', 'HOPE', 'HONE', 'HOLD', 'HOOD', 'HOST', 'HORN'].map((code) => ({
      hillCode: code,
      hillName: code,
      dailyFlowComplete: true,
      prescribedCompleted: 3,
    }));
    const stats = summarizeWeeklyChakras(days);
    assert.equal(stats.activated, 7);
    assert.equal(stats.perfectWeek, true);
  });
});

describe('flowWeek/homeHillRewards', () => {
  it('awards 100 for first three Home Hill completions and triggers bonus on the 3rd', () => {
    const first = resolveMissionReward({
      isTodayHomeHill: true,
      dailyBonusClaimed: false,
      homeBonusSlotsUsed: 0,
    });
    assert.equal(first.kind, 'home_bonus_slot');
    assert.equal(first.baseCoins, FLOW_WEEK_COIN_REWARDS.prescribedMission);
    assert.equal(first.triggersDailyBonus, false);

    const third = resolveMissionReward({
      isTodayHomeHill: true,
      dailyBonusClaimed: false,
      homeBonusSlotsUsed: 2,
    });
    assert.equal(third.kind, 'home_bonus_slot');
    assert.equal(third.triggersDailyBonus, true);

    const extra = resolveMissionReward({
      isTodayHomeHill: true,
      dailyBonusClaimed: true,
      homeBonusSlotsUsed: 3,
    });
    assert.equal(extra.kind, 'home_extra');
    assert.equal(extra.baseCoins, FLOW_WEEK_COIN_REWARDS.optionalOffHillMission);

    const other = resolveMissionReward({
      isTodayHomeHill: false,
      dailyBonusClaimed: false,
      homeBonusSlotsUsed: 0,
    });
    assert.equal(other.kind, 'other_hill');
    assert.equal(other.baseCoins, FLOW_WEEK_COIN_REWARDS.optionalOffHillMission);

    const late = resolveMissionReward({
      isLateCatchUp: true,
      isTodayHomeHill: true,
      dailyBonusClaimed: false,
      homeBonusSlotsUsed: 0,
    });
    assert.equal(late.kind, 'late_catch_up');
    assert.equal(late.baseCoins, FLOW_WEEK_COIN_REWARDS.latePrescribedMission);
    assert.equal(late.triggersDailyBonus, false);
  });

  it('formats completion counters', () => {
    assert.equal(formatCompletionCountLabel(0), 'Not completed');
    assert.equal(formatCompletionCountLabel(1), 'Completed 1 time');
    assert.equal(formatCompletionCountLabel(3), 'Completed 3 times');
  });
});
