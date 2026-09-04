export enum Role {
  user = 'user',
  admin = 'admin',
}

export enum TreeLevel {
  Seed = 'Seed',
  Sprout = 'Sprout',
  Sapling = 'Sapling',
  YoungTree = 'YoungTree',
  FlourishingTree = 'FlourishingTree',
  BlossomingTree = 'BlossomingTree',
}

export enum HillCode {
  HOPE = 'HOPE',
  HONE = 'HONE',
  HOLD = 'HOLD',
  HOOD = 'HOOD',
  HOST = 'HOST',
  HORN = 'HORN',
  HOOK = 'HOOK',
}

export enum MissionStatus {
  locked = 'locked',
  current = 'current',
  completed = 'completed',
}

export enum LedgerType {
  personal_growth = 'personal_growth',
  promotional = 'promotional',
}

export enum LedgerSource {
  mission = 'mission',
  reflection = 'reflection',
  evidence = 'evidence',
  growth_set = 'growth_set',
  flow_week = 'flow_week',
  camp = 'camp',
  family_mission = 'family_mission',
  welcome_bonus = 'welcome_bonus',
  admin_grant = 'admin_grant',
  spend = 'spend',
}

export enum GlowSeedStatus {
  pending = 'pending',
  accepted = 'accepted',
  expired = 'expired',
}

export enum Virtue {
  Kindness = 'Kindness',
  Responsibility = 'Responsibility',
  Discipline = 'Discipline',
  Integrity = 'Integrity',
  HardWork = 'HardWork',
  Courage = 'Courage',
  Patience = 'Patience',
}

export enum FriendshipStatus {
  following = 'following',
  friends = 'friends',
  blocked = 'blocked',
}

export interface JwtPayload {
  sub: string;
  role: Role;
  username: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  ageGroup: string | null;
  isChildProfile: boolean;
  familyId: string | null;
  walletCoins: number;
  growthCoinsLifetime: number;
  flowIndex: number;
  currentStep: number;
  currentCampId: string | null;
  treeLevel: TreeLevel;
  seedInventoryCount: number;
  currentStreak: number;
  onboardingCompleted: boolean;
}

export const MAX_SEED_INVENTORY = 49;

export const CAMP_COIN_REWARDS = [500, 750, 1000, 1250, 1500, 2000, 10000] as const;

export const HILL_CODES = Object.values(HillCode);
