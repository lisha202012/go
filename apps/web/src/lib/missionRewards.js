/** Default mission rewards (Section 7 — overridden when API returns `rewards`). */
export const DEFAULT_MISSION_REWARDS = {
  perMission: 5,
  growthSetBonus: 15,
  missionsPerCycle: 3,
  hillStepOnCycleComplete: 1,
};

export function normalizeMissionRewards(rewards) {
  return {
    perMission: rewards?.perMission ?? DEFAULT_MISSION_REWARDS.perMission,
    growthSetBonus: rewards?.growthSetBonus ?? DEFAULT_MISSION_REWARDS.growthSetBonus,
    missionsPerCycle: rewards?.missionsPerCycle ?? DEFAULT_MISSION_REWARDS.missionsPerCycle,
    hillStepOnCycleComplete:
      rewards?.hillStepOnCycleComplete ?? DEFAULT_MISSION_REWARDS.hillStepOnCycleComplete,
  };
}

export function cycleCoinPotential(rewards, completedCount = 0) {
  const config = normalizeMissionRewards(rewards);
  const earned = completedCount * config.perMission;
  const max = config.missionsPerCycle * config.perMission + config.growthSetBonus;
  return { earned, max, config };
}

export function formatMissionCoinLabel(rewards) {
  const { perMission } = normalizeMissionRewards(rewards);
  return `+${perMission} coins`;
}

export function formatCycleBonusNote(rewards) {
  const { growthSetBonus, missionsPerCycle, hillStepOnCycleComplete } =
    normalizeMissionRewards(rewards);
  return `Complete all ${missionsPerCycle} for +${growthSetBonus} bonus coins and +${hillStepOnCycleComplete} Hill Step`;
}
