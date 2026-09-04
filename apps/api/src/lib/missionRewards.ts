import { prisma } from './prisma';
import { getAdminConfigNumber } from './adminConfig';
import { MISSIONS_PER_HILL } from './journeyPlan';

export type MissionRewardConfig = {
  perMission: number;
  growthSetBonus: number;
  missionsPerCycle: number;
  hillStepOnCycleComplete: number;
};

const DEFAULT_PER_MISSION = 5;
const DEFAULT_GROWTH_SET_BONUS = 15;

export async function getMissionRewardConfig(): Promise<MissionRewardConfig> {
  const [amountsRow, growthSetBonus] = await Promise.all([
    prisma.adminConfig.findUnique({ where: { key: 'mission_coin_amounts' } }),
    getAdminConfigNumber('growth_set_bonus', DEFAULT_GROWTH_SET_BONUS),
  ]);

  let perMission = DEFAULT_PER_MISSION;
  const value = amountsRow?.value;
  if (typeof value === 'number') {
    perMission = value;
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.default === 'number') {
      perMission = record.default;
    }
  }

  return {
    perMission,
    growthSetBonus,
    missionsPerCycle: MISSIONS_PER_HILL,
    hillStepOnCycleComplete: 1,
  };
}

/** Display / ledger amount for completing one mission (flat per spec Section 7). */
export async function getMissionCompletionCoins(): Promise<number> {
  const { perMission } = await getMissionRewardConfig();
  return perMission;
}
