/** Cohort C legacy block snapshot at v1 → v2 cutover (schemaVersion 1). */
export type LegacyJourneySnapshot = {
  schemaVersion: 1;
  capturedAt: string;
  cohort: 'C';
  journeyModelVersion: 1;
  focusHillId: string;
  focusHillCode: string;
  blockMissionIds: string[];
  blockHillId: string;
  missions: Array<{
    missionId: string;
    orderInBlock: 1 | 2 | 3;
    status: 'locked' | 'current' | 'completed';
    completedAt: string | null;
    startedAt: string | null;
  }>;
  weekGate: {
    waitingNextWeek: boolean;
    nextOpensAt: string | null;
    currentMissionId: string | null;
  };
  hillMissionSelections: Record<string, string[] | string[][]>;
  focusMissionIds: string[];
  coinConversion: {
    completedMissionIds: string[];
    coinsPerMission: 10;
    totalCoinsGranted: number;
    ledgerEntryIds: string[];
  } | null;
  blockClosed: true;
};

export type MigrationCohort = 'A' | 'B' | 'C' | 'D' | 'E';

/** Monday — FLOW week runs Mon–Sun (Perfect FLOW Week bonus). */
export const DEFAULT_GOFAM_WEEK_START_DAY = 1;

/** Total calendar days in the 30-day GOFAM GROW challenge period. */
export const CHALLENGE_PERIOD_DAYS = 30;

/** Glow Seeds required to complete the 30-day challenge. */
export const CHALLENGE_GLOW_SEED_TARGET = 21;

/** Total assigned mission days in one schedule block (matches challenge period). */
export const JOURNEY_DAYS = CHALLENGE_PERIOD_DAYS;

/** When true, missed days do not block new missions (challenge philosophy). */
export const CHALLENGE_DISABLE_MISSED_DAY_BLOCK = true;

/** Weekday index (0=Sun) when FLOW Index is calculated. */
export const FLOW_INDEX_WEEKDAY = 0;

export const FLOW_WEEK_AWARD_SOURCES = {
  legacyBlock: 'legacy_block',
  perfectWeek: 'flow_perfect_week',
  dailyFlowStep: 'flow_daily_step',
  starterWeek: 'flow_starter_week',
  migrationBaseline: 'migration_baseline',
  streakForgive: 'streak_forgive',
} as const;

export const FLOW_WEEK_COIN_REWARDS = {
  prescribedMission: 100,
  dailyFlowBonus: 200,
  optionalOffHillMission: 10,
  latePrescribedMission: 10,
  perfectWeekBonus: 1500,
} as const;

export const FLOW_WEEK_SEED_REWARDS = {
  dailyFlow: 1,
  perfectWeek: 3,
} as const;

export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export type FlowWeekAwardSource = (typeof FLOW_WEEK_AWARD_SOURCES)[keyof typeof FLOW_WEEK_AWARD_SOURCES];
