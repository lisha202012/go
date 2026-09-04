import { LedgerSource } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../../middleware/errorHandler';
import { loadTodayDayAssignment } from './flowWeekDailyPick';
import { FLOW_WEEK_COIN_REWARDS } from './types';
import { startOfDay } from './personalWeek';
import {
  loadHillsMissionsWithCounts,
  resolveMissionWhyText,
  type HillMissionListItem,
} from './hillMissionList';
import { formatCompletionCountLabel } from './homeHillRewards';

export type OptionalMissionGroup = {
  hill: {
    id: string;
    code: string;
    name: string;
    virtueName: string;
    colorTheme: string | null;
  };
  /** @deprecated Prefer missions[] — kept for older clients that expect one mission. */
  mission: HillMissionListItem;
  /** All missions on this hill (always shown, with completion counters). */
  missions: HillMissionListItem[];
};

export async function loadTodayOptionalCompletedMissions(
  userId: string,
): Promise<OptionalMissionGroup[]> {
  const { day: todayDay } = await loadTodayDayAssignment(userId);
  const dayStart = startOfDay(todayDay.calendarDate);

  const completions = await prisma.missionCompletion.findMany({
    where: {
      userId,
      calendarDate: dayStart,
      kind: 'other_hill',
    },
    include: {
      mission: { include: { hill: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (completions.length === 0) {
    // Legacy ledger fallback
    const dayIso = dayStart.toISOString();
    const prefix = `flow_optional:${dayIso}:`;
    const entries = await prisma.coinLedgerEntry.findMany({
      where: {
        userId,
        source: LedgerSource.flow_week,
        referenceId: { startsWith: prefix },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (entries.length === 0) return [];

    const missionIds = [
      ...new Set(
        entries
          .map((entry) => entry.referenceId?.split(':').pop())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const missions = await prisma.mission.findMany({
      where: { id: { in: missionIds } },
      include: { hill: true },
    });
    const missionById = new Map(missions.map((m) => [m.id, m]));

    return entries.flatMap((entry) => {
      const missionId = entry.referenceId?.split(':').pop();
      if (!missionId) return [];
      const mission = missionById.get(missionId);
      if (!mission) return [];
      const item: HillMissionListItem = {
        id: mission.id,
        title: mission.title,
        description: mission.description,
        whyText: resolveMissionWhyText(mission.whyText, mission.hill),
        order: mission.order,
        missionGroup: mission.missionGroup,
        coinReward: entry.amount,
        requiresReflection: mission.requiresReflection,
        requiresEvidence: mission.requiresEvidence,
        completionCount: 1,
        completionLabel: 'Completed 1 time',
        started: true,
        lastCompletedAt: entry.createdAt.toISOString(),
        completedToday: true,
        isRecommended: false,
      };
      return [
        {
          hill: {
            id: mission.hill.id,
            code: mission.hill.code,
            name: mission.hill.name,
            virtueName: mission.hill.virtueName,
            colorTheme: mission.hill.colorTheme,
          },
          mission: item,
          missions: [item],
        },
      ];
    });
  }

  return completions.map((row) => {
    const item: HillMissionListItem = {
      id: row.mission.id,
      title: row.mission.title,
      description: row.mission.description,
      whyText: resolveMissionWhyText(row.mission.whyText, row.mission.hill),
      order: row.mission.order,
      missionGroup: row.mission.missionGroup,
      coinReward: row.coinsAwarded,
      requiresReflection: row.mission.requiresReflection,
      requiresEvidence: row.mission.requiresEvidence,
      completionCount: row.sequence,
      completionLabel: formatCompletionCountLabel(row.sequence),
      started: true,
      lastCompletedAt: row.createdAt.toISOString(),
      completedToday: true,
      isRecommended: false,
    };
    return {
      hill: {
        id: row.mission.hill.id,
        code: row.mission.hill.code,
        name: row.mission.hill.name,
        virtueName: row.mission.hill.virtueName,
        colorTheme: row.mission.hill.colorTheme,
      },
      mission: item,
      missions: [item],
    };
  });
}

export async function getTodayOptionalMissions(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.journeyModelVersion < 2) {
    throw new AppError('FLOW Week is not active for this account', 404);
  }

  const { day: todayDay } = await loadTodayDayAssignment(userId);
  const completedToday = await loadTodayOptionalCompletedMissions(userId);

  const otherHills = await prisma.hill.findMany({
    where: { id: { not: todayDay.hillId } },
    orderBy: { code: 'asc' },
  });

  const coinReward = FLOW_WEEK_COIN_REWARDS.optionalOffHillMission;
  const missionsByHill = await loadHillsMissionsWithCounts({
    userId,
    hills: otherHills,
    ageGroup: user.ageGroup,
    rewardContext: {
      isTodayHomeHill: false,
      dailyBonusClaimed: true,
      homeBonusSlotsUsed: 3,
    },
  });

  const groups: OptionalMissionGroup[] = otherHills.flatMap((hill) => {
    const missions = missionsByHill.get(hill.id) ?? [];
    if (missions.length === 0) return [];
    return [
      {
        hill: {
          id: hill.id,
          code: hill.code,
          name: hill.name,
          virtueName: hill.virtueName,
          colorTheme: hill.colorTheme,
        },
        mission: missions[0]!,
        missions,
      },
    ];
  });

  const extraCoinsEarnedToday = completedToday.reduce(
    (sum, group) => sum + (group.mission.coinReward ?? coinReward),
    0,
  );

  return {
    coinReward,
    todayHillId: todayDay.hillId,
    groups,
    completedToday,
    extraCoinsEarnedToday,
  };
}

/** Home dashboard: extras completed today (home_extra + other_hill), grouped by hill. */
export async function getTodayExtraMissionsByHill(userId: string) {
  const dayStart = startOfDay(new Date());

  const completions = await prisma.missionCompletion.findMany({
    where: {
      userId,
      calendarDate: dayStart,
      kind: { in: ['home_extra', 'other_hill'] },
    },
    include: {
      mission: { include: { hill: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (completions.length === 0) {
    return { count: 0, coins: 0, byHill: [] as Array<{
      hill: {
        id: string;
        code: string;
        name: string;
        virtueName: string;
        colorTheme: string | null;
      };
      missions: Array<{
        id: string;
        title: string;
        coinsAwarded: number;
        kind: string;
        completedAt: string;
      }>;
    }> };
  }

  const byHillId = new Map<
    string,
    {
      hill: {
        id: string;
        code: string;
        name: string;
        virtueName: string;
        colorTheme: string | null;
      };
      missions: Array<{
        id: string;
        title: string;
        coinsAwarded: number;
        kind: string;
        completedAt: string;
      }>;
    }
  >();

  for (const row of completions) {
    const hill = row.mission.hill;
    let group = byHillId.get(hill.id);
    if (!group) {
      group = {
        hill: {
          id: hill.id,
          code: hill.code,
          name: hill.name,
          virtueName: hill.virtueName,
          colorTheme: hill.colorTheme,
        },
        missions: [],
      };
      byHillId.set(hill.id, group);
    }
    group.missions.push({
      id: row.mission.id,
      title: row.mission.title,
      coinsAwarded: row.coinsAwarded,
      kind: row.kind,
      completedAt: row.createdAt.toISOString(),
    });
  }

  const byHill = [...byHillId.values()];
  const coins = completions.reduce((sum, row) => sum + row.coinsAwarded, 0);

  return {
    count: completions.length,
    coins,
    byHill,
  };
}
