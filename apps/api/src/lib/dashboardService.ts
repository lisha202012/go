import type { Camp, HillCode } from '@prisma/client';
import { MissionStatus } from '@prisma/client';
import { prisma } from './prisma';
import {
  buildJourneyResponse,
  loadJourneyContext,
  repairCurrentMissionIfNeeded,
} from './journeyService';
import { MISSIONS_PER_HILL } from './journeyPlan';
import { clampSteps, resolveCampProgress, buildClimbChallenge } from './hillProgress';
import { getHillStepCounts } from './hillStepService';
import { getFlowWeekDashboardSlice } from './flowWeek/flowWeekService';
import { MISSIONS_SHOWN } from './missionEngine';
import { buildThreeWeekHillChallenge } from './flowWeek/threeWeekHillChallenge';
import { countPendingFamilyInvitesForUser } from './familyInvites';
import {
  EMPTY_CAMP_STREAK,
  getBlockingMissedDay,
  getCampStreakStatus,
} from './flowWeek/campStreakService';
import { getTodayExtraMissionsByHill } from './flowWeek/flowWeekOptionalMissions';
import { getGrowChallengeProgress } from './flowWeek/growChallengeService';
import { syncFlowLeadershipScore } from './flowLeadershipService';
import { getCoachWelcomeForHome, getCoachMonthlySurpriseForHome, ensureCoachBalaMonthlySeed } from './coachBalaService';
import { syncUserAgeGroupFromDob } from './userAgeSync';

/** Tree of Life radial layout order (clockwise from top). */
export const TREE_HILL_ORDER: HillCode[] = [
  'HOOK',
  'HOPE',
  'HONE',
  'HOLD',
  'HOOD',
  'HOST',
  'HORN',
];

const FLOW_RING_FOUNDATION_THRESHOLD = 40;

function hillStatus(score: number): 'Emerging' | 'Developing' | 'Strong' | 'Flourishing' {
  if (score < FLOW_RING_FOUNDATION_THRESHOLD) return 'Emerging';
  if (score < 60) return 'Developing';
  if (score < 80) return 'Strong';
  return 'Flourishing';
}

function resolveCampFromDb(camps: Camp[], step: number) {
  let current = camps[0];
  for (const camp of camps) {
    if (step >= camp.stepThreshold) current = camp;
    else break;
  }
  const next = camps.find((c) => c.stepThreshold > step) ?? null;
  return { current, next };
}

function serializeCamp(camp: { number: number; name: string; stepThreshold: number } | null) {
  if (!camp) return null;
  return {
    number: camp.number,
    name: camp.name,
    stepThreshold: camp.stepThreshold,
  };
}

export async function buildDashboardHome(userId: string) {
  await syncUserAgeGroupFromDob(userId);

  const [user, assessment, camps, hillStepCounts, glowPendingCount, coachWelcome, coachMonthlySurprise] =
    await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { currentCamp: true },
    }),
    prisma.gapAssessment.findUnique({
      where: { userId },
      include: {
        focusHill: true,
        hillScores: { include: { hill: true } },
      },
    }),
    prisma.camp.findMany({ orderBy: { number: 'asc' } }),
    getHillStepCounts(userId),
    prisma.glowSeed.count({
      where: {
        receiverId: userId,
          senderId: { not: userId },
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
    }),
    getCoachWelcomeForHome(userId),
    (async () => {
      await ensureCoachBalaMonthlySeed(userId).catch(() => null);
      return getCoachMonthlySurpriseForHome(userId);
    })(),
  ]);

  const familyInviteCount = await countPendingFamilyInvitesForUser(user);
  const notificationCount = glowPendingCount + familyInviteCount;
  const [campStreak, blockingMissedDay] = await Promise.all([
    getCampStreakStatus(userId).catch(() => EMPTY_CAMP_STREAK),
    getBlockingMissedDay(userId).catch(() => null),
  ]);

  const gapCompleted = assessment != null;

  let ctx = null;
  if (user.journeyModelVersion < 2) {
    ctx = await loadJourneyContext(userId);
    if (ctx) {
      ctx = (await repairCurrentMissionIfNeeded(userId)) ?? ctx;
    }
  }

  const focusHillId = assessment?.focusHillId;
  const focusCompletedSteps = clampSteps(
    focusHillId ? (hillStepCounts.get(focusHillId) ?? user.currentStep) : user.currentStep,
  );
  const focusCampProgress = resolveCampProgress(focusCompletedSteps);
  const { current: currentCamp, next: nextCamp } = resolveCampFromDb(camps, focusCompletedSteps);

  const climbChallenge = buildClimbChallenge([...hillStepCounts.values()]);
  const climbMax = climbChallenge.displayMax;

  const recentSteps = camps
    .filter((camp) => camp.stepThreshold <= climbMax)
    .map((camp) => ({
      step: camp.stepThreshold,
      completed: focusCompletedSteps >= camp.stepThreshold,
    }));

  const baseUser = {
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    ageGroup: user.ageGroup,
    walletCoins: user.walletCoins,
    seedInventoryCount: user.seedInventoryCount,
    currentStreak: user.currentStreak,
    flowIndex: gapCompleted ? assessment!.flowIndex : 0,
    flowLeadershipScore: user.flowLeadershipScore ?? 0,
    currentStep: focusCompletedSteps,
    treeLevel: user.treeLevel,
    treeStars: user.treeStars,
    currentCamp: currentCamp
      ? { number: currentCamp.number, name: currentCamp.name }
      : null,
  };

  const campProgress = {
    currentStep: focusCompletedSteps,
    stepsPerHill: climbMax,
    nextMilestoneStep: nextCamp?.stepThreshold ?? null,
    campNumber: focusCampProgress.currentCamp.number,
    campName: focusCampProgress.currentCamp.name,
    stepsRemaining: focusCampProgress.stepsRemaining,
    recentSteps,
    reachedCamps: focusCampProgress.reachedCamps,
  };

  if (!gapCompleted) {
    return {
      gapCompleted: false,
      user: baseUser,
      hills: null,
      flowRing: null,
      focusHill: null,
      todaysFocusMission: null,
      campProgress,
      climbChallenge,
      weeklyMissions: { completed: 0, total: MISSIONS_PER_HILL },
      notificationCount,
      campStreak,
      blockingMissedDay,
      coachWelcome,
      coachMonthlySurprise,
    };
  }

  const hills = await prisma.hill.findMany({ orderBy: { code: 'asc' } });
  const scoreByHillId = new Map(
    assessment?.hillScores.map((s) => [s.hillId, s.flowPercent]) ?? [],
  );

  let flowWeek: Awaited<ReturnType<typeof getFlowWeekDashboardSlice>> | null = null;
  if (user.journeyModelVersion >= 2) {
    try {
      flowWeek = await getFlowWeekDashboardSlice(userId);
    } catch {
      flowWeek = null;
    }
  }
  const weekDayByHillId = new Map<
    string,
    { hill: { id: string }; prescribedCompleted: number; dailyFlowComplete: boolean; isToday: boolean }
  >();
  for (const day of flowWeek?.weekDays ?? []) {
    const existing = weekDayByHillId.get(day.hill.id);
    // Prefer today's assignment; otherwise keep the day with more progress
    // (same hill can appear on multiple journey days and would overwrite).
    if (
      !existing ||
      day.isToday ||
      (!existing.isToday && day.prescribedCompleted > existing.prescribedCompleted)
    ) {
      weekDayByHillId.set(day.hill.id, day);
    }
  }

  const treeHills = TREE_HILL_ORDER.map((code) => {
    const hill = hills.find((h) => h.code === code);
    const score = hill ? (scoreByHillId.get(hill.id) ?? 0) : 0;
    const steps = hill ? clampSteps(hillStepCounts.get(hill.id) ?? 0) : 0;
    const camp = resolveCampProgress(steps);
    const isFocus = Boolean(hill && assessment?.focusHillId === hill.id);
    const weekDay = hill ? weekDayByHillId.get(hill.id) : undefined;
    const missionsThisWeek = weekDay?.prescribedCompleted ?? 0;
    const dailyFlowComplete = weekDay?.dailyFlowComplete ?? false;
    let status: string = hillStatus(score);
    if (isFocus) status = 'Focus Hill';
    else if (hill && assessment?.strongestHillId === hill.id) status = 'Strongest Hill';
    return {
      code,
      name: hill?.name ?? code,
      score,
      status,
      completedSteps: steps,
      workingStep: steps >= climbMax ? climbMax : steps + 1,
      stepsPerHill: climbMax,
      currentCamp: camp.currentCamp.name,
      camp: serializeCamp(camp.currentCamp),
      nextCamp: serializeCamp(
        camp.nextCamp && camp.nextCamp.stepThreshold <= climbMax ? camp.nextCamp : null,
      ),
      nextMilestoneStep:
        camp.nextCamp && camp.nextCamp.stepThreshold <= climbMax
          ? camp.nextCamp.stepThreshold
          : null,
      stepsRemaining:
        camp.nextCamp && camp.nextCamp.stepThreshold <= climbMax
          ? camp.nextCamp.stepThreshold - steps
          : 0,
      missionsCompletedThisStep: missionsThisWeek,
      missionsRequiredThisStep: MISSIONS_SHOWN,
      threeWeekChallenge: buildThreeWeekHillChallenge({
        completedSteps: steps,
        missionsThisWeek,
        dailyFlowComplete,
      }),
      isFocus,
    };
  });

  const hillsAtFoundation = treeHills.filter(
    (h) => (h.score ?? 0) >= FLOW_RING_FOUNDATION_THRESHOLD,
  ).length;
  const hillsTotal = treeHills.length || TREE_HILL_ORDER.length;
  const complete = hillsTotal > 0 && hillsAtFoundation === hillsTotal;
  const hillsBelowFoundation = treeHills
    .filter((h) => (h.score ?? 0) < FLOW_RING_FOUNDATION_THRESHOLD)
    .map((h) => ({ code: h.code, name: h.name, score: h.score }));

  const journey = ctx
    ? buildJourneyResponse(
        ctx.assessment,
        ctx.hills,
        ctx.missions,
        ctx.progressRows,
        hillStepCounts,
      )
    : null;

  const activeStep = journey?.summary.activeStep;
  const weeklyProgress = journey?.summary.weeklyProgress;
  const weeklyCompleted = weeklyProgress?.thisWeekComplete ? 1 : 0;

  let todaysFocusMission: {
    id: string;
    title: string;
    description: string;
  } | null = null;

  let weeklyMissions: {
    completed: number;
    total: number;
    thisWeekComplete: boolean;
    opensAt: string | null;
    /** FLOW Week v2: progress is today's 3 prescribed missions. */
    mode: 'flow_today' | 'legacy_week';
  } = {
    completed: weeklyCompleted,
    total: 1,
    thisWeekComplete: weeklyProgress?.thisWeekComplete ?? false,
    opensAt: weeklyProgress?.opensAt ?? null,
    mode: 'legacy_week',
  };

  let missionsCompletedThisStep = activeStep?.missionsCompleted ?? weeklyCompleted;
  let missionsRequiredThisStep = MISSIONS_PER_HILL;
  let focusDayMissionsThisWeek = 0;
  let focusDayDailyComplete = false;

  if (flowWeek) {
    const today = flowWeek.today;
    const focusDay =
      flowWeek.weekDays.find((d) => d.hill.id === assessment?.focusHillId) ?? null;

    if (focusDay) {
      focusDayMissionsThisWeek = focusDay.prescribedCompleted;
      focusDayDailyComplete = focusDay.dailyFlowComplete;
    }

    if (today) {
      weeklyMissions = {
        completed: today.prescribedCompleted,
        total: MISSIONS_SHOWN,
        thisWeekComplete: today.dailyFlowComplete,
        opensAt: null,
        mode: 'flow_today',
      };

      const nextOpen = today.prescribedMissions.find((m) => !m.completed);
      if (nextOpen) {
        todaysFocusMission = {
          id: nextOpen.id,
          title: nextOpen.title,
          description: nextOpen.description,
        };
      }
    } else if (flowWeek.weekNotStartedYet) {
      weeklyMissions = {
        completed: 0,
        total: MISSIONS_SHOWN,
        thisWeekComplete: false,
        opensAt: flowWeek.personalWeekStart,
        mode: 'flow_today',
      };
    }

    // Focus Hill climb = that hill's day in this FLOW week (3 missions → 1 Step).
    if (focusDay) {
      missionsCompletedThisStep = focusDay.prescribedCompleted;
      missionsRequiredThisStep = MISSIONS_SHOWN;
    } else if (today) {
      missionsCompletedThisStep = today.prescribedCompleted;
      missionsRequiredThisStep = MISSIONS_SHOWN;
    }
  } else if (ctx && journey) {
    const currentProgress = ctx.progressRows.find(
      (p) => p.status === MissionStatus.current,
    );
    if (currentProgress) {
      const mission = ctx.missions.find((m) => m.id === currentProgress.missionId);
      if (mission) {
        todaysFocusMission = {
          id: mission.id,
          title: mission.title,
          description: mission.description,
        };
      }
    }
  }

  const focusHillRecord = assessment?.focusHill;
  const todayHill = flowWeek?.today?.hill ?? null;

  let extraMissionsToday = { count: 0, coins: 0, byHill: [] as Awaited<
    ReturnType<typeof getTodayExtraMissionsByHill>
  >['byHill'] };
  let growChallenge = null as Awaited<ReturnType<typeof getGrowChallengeProgress>> | null;
  if (flowWeek) {
    try {
      extraMissionsToday = await getTodayExtraMissionsByHill(userId);
    } catch {
      extraMissionsToday = { count: 0, coins: 0, byHill: [] };
    }
    try {
      growChallenge = await getGrowChallengeProgress(userId);
    } catch {
      growChallenge = null;
    }
  }

  if (gapCompleted) {
    try {
      const leadership = await syncFlowLeadershipScore(userId);
      baseUser.flowLeadershipScore = leadership.display;
    } catch {
      /* keep cached score */
    }
  }

  return {
    gapCompleted: true,
    user: baseUser,
    hills: treeHills,
    /** Today's scheduled FLOW hill (null on FLOW Index / off-schedule days). */
    todayHillCode: todayHill?.code ?? null,
    extraMissionsToday,
    flowRing: {
      /** Spec: complete only when every hill GAP is ≥ 40. */
      complete,
      broken: !complete,
      foundationThreshold: FLOW_RING_FOUNDATION_THRESHOLD,
      hillsAtFoundation,
      hillsTotal,
      hillsBelowFoundation,
    },
    focusHill: focusHillRecord
      ? {
          code: focusHillRecord.code,
          name: focusHillRecord.name,
          virtueName: focusHillRecord.virtueName,
          completedSteps: focusCompletedSteps,
          workingStep: activeStep?.workingStep ?? (focusCompletedSteps >= climbMax ? climbMax : focusCompletedSteps + 1),
          stepsPerHill: climbMax,
          currentCamp: focusCampProgress.currentCamp,
          nextCamp: focusCampProgress.nextCamp,
          missionsCompletedThisStep,
          missionsRequiredThisStep,
          /** 3 weeks · 3 tasks · 9 missions on this hill. */
          threeWeekChallenge: buildThreeWeekHillChallenge({
            completedSteps: focusCompletedSteps,
            missionsThisWeek: focusDayMissionsThisWeek,
            dailyFlowComplete: focusDayDailyComplete,
          }),
        }
      : null,
    todaysFocusMission,
    campProgress,
    climbChallenge,
    weeklyMissions,
    notificationCount,
    campStreak,
    blockingMissedDay,
    growChallenge,
    coachWelcome,
    coachMonthlySurprise,
  };
}
