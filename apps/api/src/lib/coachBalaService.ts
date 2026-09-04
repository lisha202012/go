import { AccountType, GlowSeedChannel, GlowSeedStatus } from '@prisma/client';
import { randomInt } from 'crypto';
import { prisma } from './prisma';
import { ensureFriends } from './friendshipService';
import { getAdminConfigNumber } from './adminConfig';
import { VIRTUE_HILL_CODE, VIRTUE_LABELS } from './virtue';

function seedExpiryDate(days = 30) {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return expires;
}

function startOfMonth(date = new Date()) {
  const monthStart = new Date(date);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart;
}

function monthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function findOfficialCoach() {
  return prisma.user.findFirst({
    where: {
      accountType: AccountType.official_coach,
      autoConnectNewUsers: true,
    },
    orderBy: { createdAt: 'asc' },
  });
}

async function plantSystemCoachSeed(
  coachId: string,
  receiverId: string,
  seedKind: 'welcome_coach' | 'monthly_coach',
  db: Pick<typeof prisma, 'glowSeed'> = prisma,
) {
  const expiryDays = await getAdminConfigNumber('seed_expiry_days', 30);
  return db.glowSeed.create({
    data: {
      senderId: coachId,
      receiverId,
      status: GlowSeedStatus.pending,
      channel: GlowSeedChannel.in_app,
      expiresAt: seedExpiryDate(expiryDays),
      isSystemSeed: true,
      seedKind,
    },
  });
}

export async function setupOfficialCoachForNewUser(userId: string) {
  const coach = await findOfficialCoach();
  if (!coach) return null;
  if (coach.id === userId) return coach;

  await ensureFriends(coach.id, userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coachBalaWelcomeSentAt: true, coachBalaMonthlyDueDay: true },
  });
  if (!user) return null;

  const updates: { coachBalaMonthlyDueDay?: number; coachBalaWelcomeSentAt?: Date } = {};
  if (user.coachBalaMonthlyDueDay == null) {
    updates.coachBalaMonthlyDueDay = randomInt(1, 8);
  }

  if (coach.welcomeGlowSeedEnabled) {
    const existingWelcome = await prisma.glowSeed.findFirst({
      where: {
        receiverId: userId,
        seedKind: 'welcome_coach',
        status: { in: [GlowSeedStatus.pending, GlowSeedStatus.accepted] },
      },
      orderBy: { sentAt: 'desc' },
    });

    if (existingWelcome) {
      if (!user.coachBalaWelcomeSentAt) {
        updates.coachBalaWelcomeSentAt = existingWelcome.sentAt;
      }
    } else {
      await plantSystemCoachSeed(coach.id, userId, 'welcome_coach');
      updates.coachBalaWelcomeSentAt = new Date();
    }
  }

  if (Object.keys(updates).length > 0) {
    await prisma.user.update({ where: { id: userId }, data: updates });
  }

  return coach;
}

export async function ensureCoachBalaMonthlySeed(userId: string) {
  const coach = await findOfficialCoach();
  if (!coach?.monthlyGlowSeedEnabled) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coachBalaMonthlyDueDay: true, coachBalaWelcomeSentAt: true, currentStreak: true },
  });
  if (!user) return null;

  const now = new Date();
  const monthStart = startOfMonth(now);

  const monthlyThisMonth = await prisma.glowSeed.findFirst({
    where: {
      receiverId: userId,
      seedKind: 'monthly_coach',
      sentAt: { gte: monthStart },
    },
    select: { id: true },
  });
  if (monthlyThisMonth) return null;

  const dueDay = await ensureMonthlySurpriseDueDay(userId);
  if (now.getDate() < dueDay) return null;

  // One welcome at a time — bloom that before monthly surprises.
  const pendingWelcome = await prisma.glowSeed.findFirst({
    where: {
      receiverId: userId,
      seedKind: 'welcome_coach',
      status: GlowSeedStatus.pending,
    },
  });
  if (pendingWelcome) return null;

  if (!(await isUserActiveForMonthlyCoachGift(userId, user.currentStreak))) return null;

  return prisma.$transaction(async (tx) => {
    const already = await tx.glowSeed.findFirst({
      where: {
        receiverId: userId,
        seedKind: 'monthly_coach',
        sentAt: { gte: monthStart },
      },
    });
    if (already) return null;

    return plantSystemCoachSeed(coach.id, userId, 'monthly_coach', tx);
  });
}

/** Fresh random day (1–7) each calendar month before the gift is sent. */
async function ensureMonthlySurpriseDueDay(userId: string): Promise<number> {
  const monthStart = startOfMonth();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coachBalaMonthlyDueDay: true },
  });

  const lastMonthly = await prisma.glowSeed.findFirst({
    where: { receiverId: userId, seedKind: 'monthly_coach' },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true },
  });

  // New calendar month since the last gift → roll a fresh surprise day.
  const needNewRoll = lastMonthly != null && lastMonthly.sentAt < monthStart;
  if (!needNewRoll && user?.coachBalaMonthlyDueDay != null) {
    return user.coachBalaMonthlyDueDay;
  }

  const newDay = randomInt(1, 8);
  await prisma.user.update({
    where: { id: userId },
    data: { coachBalaMonthlyDueDay: newDay },
  });
  return newDay;
}

/** Active = finished GAP, bloomed welcome, and recent growth (mission or streak). */
async function isUserActiveForMonthlyCoachGift(
  userId: string,
  currentStreak: number | null,
): Promise<boolean> {
  const [gap, welcomeBloom] = await Promise.all([
    prisma.gapAssessment.findUnique({ where: { userId }, select: { id: true } }),
    prisma.glowSeed.findFirst({
      where: { receiverId: userId, seedKind: 'welcome_coach', status: GlowSeedStatus.accepted },
      select: { id: true },
    }),
  ]);
  if (!gap || !welcomeBloom) return false;
  if ((currentStreak ?? 0) > 0) return true;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentMissions = await prisma.missionCompletion.count({
    where: { userId, createdAt: { gte: thirtyDaysAgo } },
  });
  return recentMissions > 0;
}

export async function isQualifyingCoachSeedThisMonth(userId: string): Promise<boolean> {
  const key = monthKey();
  const existing = await prisma.coachBalaQualifyingGrant.findUnique({
    where: { userId_monthKey: { userId, monthKey: key } },
  });
  return !existing;
}

export async function recordQualifyingCoachSeed(userId: string, seedId: string) {
  const key = monthKey();
  await prisma.coachBalaQualifyingGrant.upsert({
    where: { userId_monthKey: { userId, monthKey: key } },
    create: { userId, monthKey: key, seedId },
    update: { seedId },
  });
}

export async function onUserAccountCreated(userId: string) {
  await setupOfficialCoachForNewUser(userId);
}

/** Coach → user system seeds (welcome / monthly): collection only — no ×2 boost, no welcome coin bonus. */
export function isCoachBalaGiftSeed(seed: {
  isSystemSeed?: boolean;
  seedKind?: string | null;
  sender?: { officialAccount?: boolean } | null;
}): boolean {
  if (!seed.isSystemSeed) return false;
  if (seed.seedKind === 'welcome_coach' || seed.seedKind === 'monthly_coach') return true;
  return Boolean(seed.sender?.officialAccount);
}

export type CoachWelcomePhase = 'pending_seed' | 'seed_bloomed';

export type CoachWelcomeHome = {
  phase: CoachWelcomePhase;
  seedId: string;
  coachUsername: string;
  coachDisplayName: string;
  virtue?: string;
  virtueLabel?: string;
  hillCode?: string;
  hillName?: string;
  bloomedAt?: string;
  /** Pending friend/referral seed alongside Coach Bala welcome (invite joiners get both). */
  friendSeed?: {
    seedId: string;
    senderUsername: string;
    senderDisplayName: string | null;
  } | null;
};

/** Home dashboard: friendly welcome state for new members + Coach Bala's first seed. */
export async function getCoachWelcomeForHome(userId: string): Promise<CoachWelcomeHome | null> {
  const recipient = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountType: true, role: true },
  });
  if (recipient?.accountType === AccountType.official_coach || recipient?.role === 'admin') {
    return null;
  }

  async function loadFriendSeedPending() {
    const row = await prisma.glowSeed.findFirst({
      where: {
        receiverId: userId,
        senderId: { not: userId },
        status: GlowSeedStatus.pending,
        expiresAt: { gt: new Date() },
        NOT: {
          isSystemSeed: true,
          seedKind: { in: ['welcome_coach', 'monthly_coach'] },
        },
      },
      orderBy: { sentAt: 'asc' },
      include: {
        sender: { select: { username: true, displayName: true } },
      },
    });
    if (!row?.sender) return null;
    return {
      seedId: row.id,
      senderUsername: row.sender.username,
      senderDisplayName: row.sender.displayName?.trim() || null,
    };
  }

  const pendingWelcome = await prisma.glowSeed.findFirst({
    where: {
      receiverId: userId,
      senderId: { not: userId },
      status: GlowSeedStatus.pending,
      seedKind: 'welcome_coach',
      expiresAt: { gt: new Date() },
    },
    include: {
      sender: { select: { username: true, displayName: true, officialAccount: true } },
    },
  });

  if (pendingWelcome?.sender) {
    const friendSeed = await loadFriendSeedPending();
    return {
      phase: 'pending_seed',
      seedId: pendingWelcome.id,
      coachUsername: pendingWelcome.sender.username,
      coachDisplayName: pendingWelcome.sender.displayName?.trim() || 'GoFam Coach Bala',
      friendSeed,
    };
  }

  const welcomeBloom = await prisma.glowSeed.findFirst({
    where: {
      receiverId: userId,
      senderId: { not: userId },
      status: GlowSeedStatus.accepted,
      seedKind: 'welcome_coach',
    },
    orderBy: { bloomedAt: 'desc' },
    include: {
      sender: { select: { username: true, displayName: true } },
    },
  });

  if (!welcomeBloom?.sender || !welcomeBloom.virtue || !welcomeBloom.bloomedAt) return null;

  const hillCode = VIRTUE_HILL_CODE[welcomeBloom.virtue];
  const hill = hillCode
    ? await prisma.hill.findUnique({ where: { code: hillCode }, select: { name: true } })
    : null;

  return {
    phase: 'seed_bloomed',
    seedId: welcomeBloom.id,
    coachUsername: welcomeBloom.sender.username,
    coachDisplayName: welcomeBloom.sender.displayName?.trim() || 'GoFam Coach Bala',
    virtue: welcomeBloom.virtue,
    virtueLabel: VIRTUE_LABELS[welcomeBloom.virtue],
    hillCode,
    hillName: hill?.name,
    bloomedAt: welcomeBloom.bloomedAt.toISOString(),
    friendSeed: await loadFriendSeedPending(),
  };
}

export type CoachMonthlySurpriseHome = {
  seedId: string;
  coachUsername: string;
  coachDisplayName: string;
  monthLabel: string;
};

/** Home: pending monthly_coach surprise planted this month. */
export async function getCoachMonthlySurpriseForHome(
  userId: string,
): Promise<CoachMonthlySurpriseHome | null> {
  const recipient = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountType: true, role: true },
  });
  if (recipient?.accountType === AccountType.official_coach || recipient?.role === 'admin') {
    return null;
  }

  const monthStart = startOfMonth();

  const pendingWelcome = await prisma.glowSeed.findFirst({
    where: {
      receiverId: userId,
      senderId: { not: userId },
      seedKind: 'welcome_coach',
      status: GlowSeedStatus.pending,
    },
    select: { id: true },
  });
  if (pendingWelcome) return null;

  const pendingMonthly = await prisma.glowSeed.findFirst({
    where: {
      receiverId: userId,
      senderId: { not: userId },
      seedKind: 'monthly_coach',
      status: GlowSeedStatus.pending,
      expiresAt: { gt: new Date() },
      sentAt: { gte: monthStart },
    },
    orderBy: { sentAt: 'desc' },
    include: {
      sender: { select: { username: true, displayName: true } },
    },
  });
  if (!pendingMonthly?.sender) return null;

  return {
    seedId: pendingMonthly.id,
    coachUsername: pendingMonthly.sender.username,
    coachDisplayName: pendingMonthly.sender.displayName?.trim() || 'GoFam Coach Bala',
    monthLabel: new Date().toLocaleString('en-US', { month: 'long' }),
  };
}
