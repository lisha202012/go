import type { User } from '@prisma/client';

export type UserMigrationSnapshot = {
  user: Pick<
    User,
    | 'id'
    | 'journeyModelVersion'
    | 'migratedAt'
    | 'flowLockstepSteps'
    | 'legacyStepsByHill'
    | 'legacyPeakSteps'
    | 'legacyJourneySnapshot'
    | 'currentStep'
    | 'currentCampId'
    | 'gofamWeekStartDay'
    | 'starterWeekActive'
    | 'starterWeekCompletedAt'
    | 'walletCoins'
  >;
  growthSetCountsByHill: Record<string, number>;
  lockstepStepsAtMigration: number;
};

export function buildUserMigrationBeforeSnapshot(
  user: UserMigrationSnapshot['user'],
  growthSetCountsByHill: Record<string, number>,
  lockstepStepsAtMigration: number,
): UserMigrationSnapshot {
  return {
    user: {
      id: user.id,
      journeyModelVersion: user.journeyModelVersion,
      migratedAt: user.migratedAt,
      flowLockstepSteps: user.flowLockstepSteps,
      legacyStepsByHill: user.legacyStepsByHill,
      legacyPeakSteps: user.legacyPeakSteps,
      legacyJourneySnapshot: user.legacyJourneySnapshot,
      currentStep: user.currentStep,
      currentCampId: user.currentCampId,
      gofamWeekStartDay: user.gofamWeekStartDay,
      starterWeekActive: user.starterWeekActive,
      starterWeekCompletedAt: user.starterWeekCompletedAt,
      walletCoins: user.walletCoins,
    },
    growthSetCountsByHill,
    lockstepStepsAtMigration,
  };
}
