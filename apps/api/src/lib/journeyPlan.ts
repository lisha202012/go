import type { Hill, HillCode, Mission } from '@prisma/client';

/** Canonical hill rotation order — journey starts at focus hill then continues. */
export const HILL_CODE_ORDER: HillCode[] = [
  'HOPE',
  'HONE',
  'HOLD',
  'HOOD',
  'HOST',
  'HORN',
  'HOOK',
];

export const WEEKS_TOTAL = 21;
export const MISSIONS_PER_HILL = 3;
export { MISSION_POOL_SIZE } from './missionPool';

export function buildHillSequence(focusHillCode: HillCode): HillCode[] {
  const start = HILL_CODE_ORDER.indexOf(focusHillCode);
  if (start === -1) return [...HILL_CODE_ORDER];
  return [...HILL_CODE_ORDER.slice(start), ...HILL_CODE_ORDER.slice(0, start)];
}

export function getDefaultHillMissions(hillId: string, missions: Mission[]): Mission[] {
  const hillMissions = missions
    .filter((m) => m.hillId === hillId)
    .sort((a, b) => a.order - b.order);

  const byGroup = new Map<number, Mission>();
  for (const mission of hillMissions) {
    if (!byGroup.has(mission.missionGroup)) {
      byGroup.set(mission.missionGroup, mission);
    }
  }

  return [1, 2, 3]
    .map((group) => byGroup.get(group))
    .filter((mission): mission is Mission => Boolean(mission));
}

export function buildJourneyMissionOrder(
  focusHillCode: HillCode,
  hills: Hill[],
  missions: Mission[],
  hillSelections?: Record<string, string[]>,
): Mission[] {
  const sequence = buildHillSequence(focusHillCode);
  const ordered: Mission[] = [];
  const missionById = new Map(missions.map((m) => [m.id, m]));

  for (const code of sequence) {
    const hill = hills.find((h) => h.code === code);
    if (!hill) continue;

    const selectedIds = hillSelections?.[hill.id];
    if (selectedIds?.length === MISSIONS_PER_HILL) {
      for (const id of selectedIds) {
        const mission = missionById.get(id);
        if (mission && mission.hillId === hill.id) ordered.push(mission);
      }
      continue;
    }

    ordered.push(...getDefaultHillMissions(hill.id, missions));
  }

  return ordered.slice(0, WEEKS_TOTAL);
}

export type JourneyWeekPlan = {
  weekNumber: number;
  mission: Mission;
  hill: Hill;
  taskNumber: number;
  hillBlock: number;
};

export function toJourneyWeekPlans(
  focusHillCode: HillCode,
  hills: Hill[],
  missions: Mission[],
  hillSelections?: Record<string, string[]>,
): JourneyWeekPlan[] {
  const ordered = buildJourneyMissionOrder(focusHillCode, hills, missions, hillSelections);
  const hillById = new Map(hills.map((h) => [h.id, h]));

  return ordered.map((mission, index) => {
    const hill = hillById.get(mission.hillId)!;
    return {
      weekNumber: index + 1,
      mission,
      hill,
      taskNumber: (index % MISSIONS_PER_HILL) + 1,
      hillBlock: Math.floor(index / MISSIONS_PER_HILL) + 1,
    };
  });
}
