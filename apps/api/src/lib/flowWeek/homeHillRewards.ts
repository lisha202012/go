import { FLOW_WEEK_COIN_REWARDS } from './types';

export type MissionRewardKind = 'home_bonus_slot' | 'home_extra' | 'other_hill' | 'late_catch_up';

export type ResolveMissionRewardInput = {
  /** Past-day catch-up: +10 only, no seed / step / daily bonus. */
  isLateCatchUp?: boolean;
  /** Mission belongs to today's assigned Home Hill. */
  isTodayHomeHill: boolean;
  /** Daily 300+200 bonus already claimed for today's Home Hill. */
  dailyBonusClaimed: boolean;
  /** How many home_bonus_slot completions already recorded for today's day assignment (0–3). */
  homeBonusSlotsUsed: number;
};

export type ResolveMissionRewardResult = {
  kind: MissionRewardKind;
  /** Base coins before virtue multiplier (100 for bonus slots, 10 otherwise). */
  baseCoins: number;
  /** True when this completion fills the 3rd bonus slot and should trigger +200 / step / seed. */
  triggersDailyBonus: boolean;
};

/**
 * Home Hill (today's assigned hill): first 3 completions that day → 100 each.
 * The 3rd also triggers the +200 daily bonus (500 total).
 * Extra Home Hill completions after that → 10 each.
 * Any Other Hill → 10 each.
 */
export function resolveMissionReward(
  input: ResolveMissionRewardInput,
): ResolveMissionRewardResult {
  const { isLateCatchUp, isTodayHomeHill, dailyBonusClaimed, homeBonusSlotsUsed } = input;

  if (isLateCatchUp) {
    return {
      kind: 'late_catch_up',
      baseCoins: FLOW_WEEK_COIN_REWARDS.latePrescribedMission,
      triggersDailyBonus: false,
    };
  }

  if (
    isTodayHomeHill &&
    !dailyBonusClaimed &&
    homeBonusSlotsUsed < 3
  ) {
    const nextSlot = homeBonusSlotsUsed + 1;
    return {
      kind: 'home_bonus_slot',
      baseCoins: FLOW_WEEK_COIN_REWARDS.prescribedMission,
      triggersDailyBonus: nextSlot >= 3,
    };
  }

  if (isTodayHomeHill) {
    return {
      kind: 'home_extra',
      baseCoins: FLOW_WEEK_COIN_REWARDS.optionalOffHillMission,
      triggersDailyBonus: false,
    };
  }

  return {
    kind: 'other_hill',
    baseCoins: FLOW_WEEK_COIN_REWARDS.optionalOffHillMission,
    triggersDailyBonus: false,
  };
}

export function formatCompletionCountLabel(count: number): string {
  if (!count || count <= 0) return 'Not completed';
  if (count === 1) return 'Completed 1 time';
  return `Completed ${count} times`;
}
