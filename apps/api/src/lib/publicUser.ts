export function toPublicUser(user: {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  displayName?: string | null;
  ageGroup: string | null;
  standard?: string | null;
  dateOfBirth?: Date | null;
  guardianSupported?: boolean | null;
  journeyRole?: string | null;
  accountType?: string;
  officialAccount?: boolean;
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  locationSetupDeferred?: boolean;
  belongingSetupDeferred?: boolean;
  flowLeadershipScore?: number;
  isChildProfile: boolean;
  familyId: string | null;
  familyOnboardingComplete?: boolean;
  familySetupDeferred?: boolean;
  walletCoins: number;
  growthCoinsLifetime: number;
  flowIndex: number;
  currentStep: number;
  currentCampId: string | null;
  treeLevel: string;
  seedInventoryCount: number;
  currentStreak: number;
  onboardingCompleted: boolean;
  journeyModelVersion?: number;
  gofamWeekStartDay?: number | null;
  flowLockstepSteps?: number;
  legacyPeakSteps?: number;
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName ?? null,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    ageGroup: user.ageGroup,
    standard: user.standard ?? null,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
    guardianSupported: user.guardianSupported ?? null,
    journeyRole: user.journeyRole ?? null,
    accountType: user.accountType ?? 'member',
    officialAccount: user.officialAccount ?? false,
    countryId: user.countryId ?? null,
    stateId: user.stateId ?? null,
    cityId: user.cityId ?? null,
    locationSetupDeferred: user.locationSetupDeferred ?? false,
    belongingSetupDeferred: user.belongingSetupDeferred ?? false,
    flowLeadershipScore: user.flowLeadershipScore ?? 0,
    isChildProfile: user.isChildProfile,
    familyId: user.familyId,
    familyOnboardingComplete: user.familyOnboardingComplete ?? false,
    familySetupDeferred: user.familySetupDeferred ?? false,
    walletCoins: user.walletCoins,
    growthCoinsLifetime: user.growthCoinsLifetime,
    flowIndex: user.flowIndex,
    currentStep: user.currentStep,
    currentCampId: user.currentCampId,
    treeLevel: user.treeLevel,
    seedInventoryCount: user.seedInventoryCount,
    currentStreak: user.currentStreak,
    onboardingCompleted: user.onboardingCompleted,
    journeyModelVersion: user.journeyModelVersion ?? 1,
    gofamWeekStartDay: user.gofamWeekStartDay ?? null,
    flowLockstepSteps: user.flowLockstepSteps ?? 0,
    legacyPeakSteps: user.legacyPeakSteps ?? 0,
  };
}
