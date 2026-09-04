import { GlowSeedStatus, GlowSeedChannel, Virtue } from '@prisma/client';
import { randomBytes } from 'crypto';
import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';
import { getAdminConfigNumber } from './adminConfig';
import {
  countCollectedVirtues,
  endOfCurrentMonth,
  findHillIdForVirtue,
  pickRandomVirtue,
  activateOrRefreshVirtueBoost,
  VIRTUE_LABELS,
  VIRTUES,
} from './virtue';
import { ensureFriends, listFriends } from './friendshipService';
import { getHarvestDashboard } from './glowHarvestService';
import {
  isQualifyingCoachSeedThisMonth,
  recordQualifyingCoachSeed,
  isCoachBalaGiftSeed,
} from './coachBalaService';

export const DEFAULT_MONTHLY_SEND_LIMIT = 49;

function seedExpiryDate(days = 30) {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return expires;
}

export async function getActiveExternalShareToken(userId: string): Promise<string | null> {
  const now = new Date();
  const row = await prisma.glowSeed.findFirst({
    where: {
      senderId: userId,
      channel: GlowSeedChannel.external,
      status: GlowSeedStatus.pending,
      receiverId: null,
      shareToken: { not: null },
      expiresAt: { gt: now },
    },
    orderBy: { sentAt: 'desc' },
    select: { shareToken: true },
  });
  return row?.shareToken ?? null;
}

function startOfMonth(date = new Date()) {
  const monthStart = new Date(date);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart;
}

const COACH_SYSTEM_SEED_KINDS = ['welcome_coach', 'monthly_coach'] as const;

/** Friend/referral seeds — Coach Bala system gifts are separate and don't block these. */
function friendReferralSeedWhere(
  extra: {
    receiverId?: string;
    id?: { not: string };
    receiverId_in?: string[];
  } = {},
) {
  return {
    ...extra,
    NOT: {
      isSystemSeed: true,
      seedKind: { in: [...COACH_SYSTEM_SEED_KINDS] },
    },
  };
}

export async function countPendingGlowRequests(userId: string) {
  return prisma.glowSeed.count({
    where: {
      receiverId: userId,
      status: GlowSeedStatus.pending,
      expiresAt: { gt: new Date() },
    },
  });
}

async function loadGlowHubSocial(userId: string) {
  const [friends, harvest] = await Promise.all([
    listFriends(userId).catch(() => []),
    getHarvestDashboard(userId).catch(() => null),
  ]);
  return { friends, harvest };
}

export async function getGlowHub(userId: string) {
  const now = new Date();
  const [user, pendingReceived, pendingSent, bloomed, activeThisMonth, distinctVirtues] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { seedInventoryCount: true, username: true },
      }),
      prisma.glowSeed.findMany({
        where: {
          receiverId: userId,
          senderId: { not: userId },
          status: GlowSeedStatus.pending,
          expiresAt: { gt: now },
        },
        orderBy: { sentAt: 'desc' },
        include: { sender: { select: { id: true, username: true, avatarUrl: true, displayName: true, officialAccount: true } } },
      }),
      prisma.glowSeed.findMany({
        where: { senderId: userId, status: GlowSeedStatus.pending, expiresAt: { gt: now } },
        orderBy: { sentAt: 'desc' },
        include: { receiver: { select: { id: true, username: true, avatarUrl: true } } },
      }),
      prisma.glowSeed.findMany({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
          status: GlowSeedStatus.accepted,
        },
        orderBy: { bloomedAt: 'desc' },
        take: 12,
        include: {
          sender: {
            select: {
              username: true,
              displayName: true,
              officialAccount: true,
            },
          },
          receiver: { select: { username: true } },
        },
      }),
      prisma.activeVirtue.findMany({
        where: { userId, expiresAt: { gt: now } },
        include: { hill: { select: { code: true, name: true } } },
      }),
      prisma.activeVirtue.findMany({
        where: { userId },
        distinct: ['virtue'],
        select: { virtue: true, hillId: true, activatedAt: true },
      }),
    ]);

  const collected = new Set(distinctVirtues.map((v) => v.virtue));
  const monthlyActive = new Set(activeThisMonth.map((v) => v.virtue));
  const sentThisMonthWhere = {
    senderId: userId,
    sentAt: { gte: startOfMonth() },
    channel: GlowSeedChannel.in_app,
  } as const;
  const [monthlyLimit, inventoryMax, sentThisMonth, usedThisMonth, notUsedThisMonth, activeShareToken, social] = await Promise.all([
    getAdminConfigNumber('monthly_send_limit', DEFAULT_MONTHLY_SEND_LIMIT),
    getAdminConfigNumber('max_seed_inventory', 49),
    prisma.glowSeed.count({ where: sentThisMonthWhere }),
    prisma.glowSeed.count({ where: { ...sentThisMonthWhere, status: GlowSeedStatus.accepted } }),
    prisma.glowSeed.count({ where: { ...sentThisMonthWhere, status: GlowSeedStatus.pending } }),
    getActiveExternalShareToken(userId),
    loadGlowHubSocial(userId),
  ]);
  const { friends, harvest } = social;

  return {
    inventoryCount: user.seedInventoryCount,
    inventoryMax,
    // Remaining monthly sends (not empty inventory slots).
    inventoryFree: Math.max(0, monthlyLimit - sentThisMonth),
    sentThisMonth,
    usedThisMonth,
    notUsedThisMonth,
    monthlyLimit,
    pendingReceivedCount: pendingReceived.length,
    pendingReceived: pendingReceived.map((s) => ({
      id: s.id,
      status: s.status,
      expiresAt: s.expiresAt.toISOString(),
      seedKind: s.seedKind,
      coachGift: isCoachBalaGiftSeed(s),
      sender: s.sender,
    })),
    pendingSent: pendingSent
      .filter(
        (s) =>
          s.channel !== GlowSeedChannel.external || s.receiverId != null,
      )
      .map((s) => ({
      id: s.id,
      status: s.status,
      channel: s.channel,
      shareToken: s.shareToken,
      expiresAt: s.expiresAt.toISOString(),
      receiver: s.receiver,
    })),
    recentBlooms: bloomed.map((s) => {
      const coachGift = isCoachBalaGiftSeed(s);
      const withUser =
        s.senderId === userId ? s.receiver?.username ?? 'member' : s.sender.username;
      const withDisplayName =
        s.senderId === userId
          ? null
          : s.sender.displayName?.trim() || null;
      return {
        id: s.id,
        virtue: s.virtue,
        virtueLabel: s.virtue ? VIRTUE_LABELS[s.virtue] : null,
        bloomedAt: s.bloomedAt?.toISOString() ?? null,
        with: withUser,
        withDisplayName,
        role: s.senderId === userId ? 'gave' : 'received',
        seedKind: s.seedKind,
        coachGift,
        welcomeCoach: s.seedKind === 'welcome_coach',
        monthlyCoach: s.seedKind === 'monthly_coach',
      };
    }),
    collection: VIRTUES.map((virtue) => ({
      virtue,
      label: VIRTUE_LABELS[virtue],
      collected: collected.has(virtue),
      monthlyActive: monthlyActive.has(virtue),
    })),
    collectedCount: collected.size,
    sevenVirtuesComplete: collected.size >= 7,
    monthlyActiveHills: activeThisMonth.map((v) => ({
      virtue: v.virtue,
      hillCode: v.hill.code,
      hillName: v.hill.name,
      expiresAt: v.expiresAt.toISOString(),
    })),
    friends,
    harvest,
    activeShareToken: activeShareToken ?? null,
  };
}

export async function searchGlowPeople(userId: string, query: string) {
  const q = query.trim().replace(/^@/, '');
  if (q.length < 1) return { people: [] };

  const people = await prisma.user.findMany({
    where: {
      id: { not: userId },
      username: { contains: q, mode: 'insensitive' },
      accountStatus: 'active',
      role: { not: 'admin' },
    },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      flowIndex: true,
      growthCoinsLifetime: true,
      currentStreak: true,
      treeLevel: true,
      seedInventoryCount: true,
      officialAccount: true,
    },
    take: 8,
  });

  const ids = people.map((p) => p.id);
  const seeds =
    ids.length === 0
      ? []
      : await prisma.glowSeed.findMany({
          where: {
            receiverId: { in: ids },
            status: { in: [GlowSeedStatus.pending, GlowSeedStatus.accepted] },
            ...friendReferralSeedWhere(),
          },
          orderBy: { sentAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                flowIndex: true,
                growthCoinsLifetime: true,
                currentStreak: true,
                treeLevel: true,
              },
            },
          },
        });

  const firstSeedByReceiver = new Map<string, (typeof seeds)[number]>();
  for (const seed of seeds) {
    if (!firstSeedByReceiver.has(seed.receiverId)) {
      firstSeedByReceiver.set(seed.receiverId, seed);
    }
  }

  return {
    people: people.map((p) => {
      const seed = firstSeedByReceiver.get(p.id);
      return {
        id: p.id,
        username: p.username,
        avatarUrl: p.avatarUrl,
        flowIndex: p.flowIndex,
        growthCoinsLifetime: p.growthCoinsLifetime,
        currentStreak: p.currentStreak,
        treeLevel: p.treeLevel,
        officialAccount: Boolean(p.officialAccount),
        hasGlowSeedInventory: (p.seedInventoryCount ?? 0) >= 1,
        alreadyHasGlowSeed: Boolean(seed),
        seedStatus: seed?.status ?? null,
        referredBy: seed
          ? {
              id: seed.sender.id,
              username: seed.sender.username,
              flowIndex: seed.sender.flowIndex,
              growthCoinsLifetime: seed.sender.growthCoinsLifetime,
              currentStreak: seed.sender.currentStreak,
              treeLevel: seed.sender.treeLevel,
            }
          : null,
      };
    }),
  };
}

export async function sendGlowSeed(senderId: string, receiverUsername: string) {
  const username = receiverUsername.trim().replace(/^@/, '');
  if (!username) throw new AppError('Enter a username to share with', 400);

  const [sender, receiver] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: senderId },
      select: { id: true, seedInventoryCount: true, username: true },
    }),
    prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        seedInventoryCount: true,
        officialAccount: true,
        autoBloomReceivedSeed: true,
        displayName: true,
        accountType: true,
      },
    }),
  ]);

  if (!receiver) throw new AppError('No member found with that username', 404);
  if (receiver.id === senderId) throw new AppError('You cannot send a Glow Seed to yourself', 400);
  if (sender.seedInventoryCount < 1) {
    throw new AppError('You need a Glow Seed in your inventory to share', 400);
  }
  if ((receiver.seedInventoryCount ?? 0) < 1 && !receiver.officialAccount) {
    throw new AppError(
      `@${receiver.username} needs at least 1 Glow Seed to receive. They must earn one through FLOW first.`,
      409,
    );
  }

  if (!receiver.officialAccount) {
    const existingSeed = await prisma.glowSeed.findFirst({
      where: {
        receiverId: receiver.id,
        status: { in: [GlowSeedStatus.pending, GlowSeedStatus.accepted] },
        ...friendReferralSeedWhere(),
      },
      include: { sender: { select: { username: true } } },
      orderBy: { sentAt: 'asc' },
    });
    if (existingSeed) {
      const from = existingSeed.sender?.username ? ` from @${existingSeed.sender.username}` : '';
      throw new AppError(`They already have a GLOW seed${from}. A second request cannot be sent.`, 409);
    }
  }

  const monthStart = startOfMonth();
  const monthlyLimit = await getAdminConfigNumber('monthly_send_limit', DEFAULT_MONTHLY_SEND_LIMIT);
  const sentThisMonth = await prisma.glowSeed.count({
    where: { senderId, sentAt: { gte: monthStart }, channel: GlowSeedChannel.in_app },
  });
  if (sentThisMonth >= monthlyLimit) {
    throw new AppError(`You can send at most ${monthlyLimit} GLOW seeds per month`, 409);
  }

  const expiryDays = await getAdminConfigNumber('seed_expiry_days', 30);

  const seed = await prisma.$transaction(async (tx) => {
    const fresh = await tx.user.update({
      where: { id: senderId },
      data: { seedInventoryCount: { decrement: 1 } },
      select: { seedInventoryCount: true },
    });
    if (fresh.seedInventoryCount < 0) {
      throw new AppError('You need a Glow Seed in your inventory to share', 400);
    }

    return tx.glowSeed.create({
      data: {
        senderId,
        receiverId: receiver.id,
        status: GlowSeedStatus.pending,
        channel: GlowSeedChannel.in_app,
        expiresAt: seedExpiryDate(expiryDays),
      },
    });
  });

  if (receiver.officialAccount && receiver.autoBloomReceivedSeed) {
    const bloom = await autoBloomOfficialCoachReceivedSeed(senderId, seed.id);
    return {
      seed: {
        id: seed.id,
        status: GlowSeedStatus.accepted,
        expiresAt: seed.expiresAt.toISOString(),
        receiver,
      },
      seedInventoryCount: sender.seedInventoryCount - 1,
      sentThisMonth: sentThisMonth + 1,
      monthlyLimit,
      autoBloom: bloom,
      message: bloom.qualifying
        ? `Coach Bala opened your Glow Seed! ${bloom.virtueLabel} bloomed.`
        : `Coach Bala opened your Glow Seed! (Monthly virtue boost already used.)`,
    };
  }

  return {
    seed: {
      id: seed.id,
      status: seed.status,
      expiresAt: seed.expiresAt.toISOString(),
      receiver,
    },
    seedInventoryCount: sender.seedInventoryCount - 1,
    sentThisMonth: sentThisMonth + 1,
    monthlyLimit,
    message: `Glow Seed sent to @${receiver.username}. They will see it on GLOW to open.`,
  };
}

export type BloomOutcome = 'both' | 'receiver' | 'giver' | 'neither';

export async function acceptGlowSeed(userId: string, seedId: string) {
  const seed = await prisma.glowSeed.findUnique({
    where: { id: seedId },
    include: {
      sender: {
        select: { id: true, username: true, avatarUrl: true, officialAccount: true },
      },
    },
  });

  if (!seed) throw new AppError('Glow seed not found', 404);
  if (seed.receiverId !== userId) throw new AppError('This seed is not addressed to you', 403);
  if (seed.status !== GlowSeedStatus.pending) {
    throw new AppError(`Seed cannot be accepted (status: ${seed.status})`, 400);
  }
  if (seed.expiresAt < new Date()) {
    await prisma.glowSeed.update({
      where: { id: seed.id },
      data: { status: GlowSeedStatus.expired },
    });
    throw new AppError('This seed has expired', 400);
  }

  const coachGift = isCoachBalaGiftSeed(seed);

  const accepter = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { seedInventoryCount: true },
  });
  const priorAccepted = await prisma.glowSeed.count({
    where: {
      receiverId: userId,
      status: GlowSeedStatus.accepted,
      channel: GlowSeedChannel.in_app,
    },
  });
  const isFirstTimeReceiver = priorAccepted === 0;
  const skipInventoryGate =
    seed.isSystemSeed ||
    seed.channel === GlowSeedChannel.external ||
    (seed.channel === GlowSeedChannel.in_app && isFirstTimeReceiver);
  if (!skipInventoryGate && (accepter.seedInventoryCount ?? 0) < 1) {
    throw new AppError(
      'You need at least 1 Glow Seed in your inventory to accept. Earn one through FLOW first.',
      409,
    );
  }

  if (!seed.receiverId) {
    throw new AppError('This invite has not been claimed yet', 400);
  }

  const virtue = pickRandomVirtue();
  const hillId = await findHillIdForVirtue(virtue);
  if (!hillId) throw new AppError(`No hill mapped for virtue ${virtue}`, 500);

  const hill = await prisma.hill.findUnique({ where: { id: hillId } });
  if (!hill) throw new AppError('Hill not found for bloomed virtue', 500);

  const receiverId = seed.receiverId;

  const expiresAt = endOfCurrentMonth();
  const now = new Date();
  const collectedBefore = await countCollectedVirtues(userId);

  let giverActivated = false;
  let receiverActivated = false;

  const updated = await prisma.$transaction(async (tx) => {
    const bloomed = await tx.glowSeed.update({
      where: { id: seed.id },
      data: {
        status: GlowSeedStatus.accepted,
        acceptedAt: now,
        bloomedAt: now,
        virtue,
      },
    });

    // Coach Bala gifts: receiver gets the same ×2 hill boost as a peer bloom. No giver-side boost since Coach Bala isn't a real player.
    if (coachGift) {
      receiverActivated = await activateOrRefreshVirtueBoost(tx, {
        userId: receiverId,
        virtue,
        hillId,
        expiresAt,
        sourceSeedId: seed.id,
      });
    } else {
      giverActivated = await activateOrRefreshVirtueBoost(tx, {
        userId: seed.senderId,
        virtue,
        hillId,
        expiresAt,
        sourceSeedId: seed.id,
      });
      receiverActivated = await activateOrRefreshVirtueBoost(tx, {
        userId: receiverId,
        virtue,
        hillId,
        expiresAt,
        sourceSeedId: seed.id,
      });
    }

    return bloomed;
  });

  await ensureFriends(seed.senderId, receiverId);

  const collectedAfter = await countCollectedVirtues(userId);
  const sevenVirtuesJustCompleted = collectedBefore < 7 && collectedAfter >= 7;

  let outcome: BloomOutcome = 'neither';
  if (giverActivated && receiverActivated) outcome = 'both';
  else if (!giverActivated && receiverActivated) outcome = 'receiver';
  else if (giverActivated && !receiverActivated) outcome = 'giver';

  return {
    seed: updated,
    virtue,
    virtueLabel: VIRTUE_LABELS[virtue],
    hill: { code: hill.code, name: hill.name },
    outcome,
    giverActivated,
    receiverActivated,
    coachGift,
    sevenVirtuesJustCompleted,
    sender: seed.sender,
    friendsNow: true,
    monthBoostNote:
      coachGift && !receiverActivated
        ? 'You already had this virtue in your collection.'
        : !giverActivated && !receiverActivated
          ? 'This hill was already boosted this month — ×2 does not stack.'
          : undefined,
  };
}

async function autoBloomOfficialCoachReceivedSeed(senderId: string, seedId: string) {
  const seed = await prisma.glowSeed.findUniqueOrThrow({
    where: { id: seedId },
    include: {
      receiver: {
        select: { id: true, officialAccount: true, autoBloomReceivedSeed: true, username: true },
      },
    },
  });

  if (!seed.receiver?.officialAccount || !seed.receiver.autoBloomReceivedSeed) {
    throw new AppError('Auto-bloom is not enabled for this recipient', 400);
  }

  const virtue = pickRandomVirtue();
  const hillId = await findHillIdForVirtue(virtue);
  if (!hillId) throw new AppError(`No hill mapped for virtue ${virtue}`, 500);

  const hill = await prisma.hill.findUnique({ where: { id: hillId } });
  if (!hill) throw new AppError('Hill not found for bloomed virtue', 500);

  const expiresAt = endOfCurrentMonth();
  const now = new Date();
  const qualifying = await isQualifyingCoachSeedThisMonth(senderId);

  let senderActivated = false;

  await prisma.$transaction(async (tx) => {
    await tx.glowSeed.update({
      where: { id: seed.id },
      data: {
        status: GlowSeedStatus.accepted,
        acceptedAt: now,
        bloomedAt: now,
        virtue,
      },
    });

    if (qualifying) {
      senderActivated = await activateOrRefreshVirtueBoost(tx, {
        userId: senderId,
        virtue,
        hillId,
        expiresAt,
        sourceSeedId: seed.id,
      });
    }
  });

  if (qualifying) {
    await recordQualifyingCoachSeed(senderId, seed.id);
  }

  await ensureFriends(senderId, seed.receiver.id);

  const outcome: BloomOutcome = senderActivated ? 'giver' : 'neither';

  return {
    qualifying,
    senderActivated,
    outcome,
    virtue,
    virtueLabel: VIRTUE_LABELS[virtue],
    hill: { code: hill.code, name: hill.name },
    coachUsername: seed.receiver.username,
  };
}

/** Plant a shareable GLOW invite for someone outside the app — no inventory cost. */
export async function createExternalShareLink(senderId: string, appOrigin: string) {
  const sender = await prisma.user.findUniqueOrThrow({
    where: { id: senderId },
    select: { id: true, seedInventoryCount: true, username: true },
  });

  const now = new Date();
  const existing = await prisma.glowSeed.findFirst({
    where: {
      senderId,
      channel: GlowSeedChannel.external,
      status: GlowSeedStatus.pending,
      receiverId: null,
      shareToken: { not: null },
      expiresAt: { gt: now },
    },
    orderBy: { sentAt: 'desc' },
  });

  const origin = appOrigin.replace(/\/$/, '');
  if (existing?.shareToken) {
    const shareUrl = `${origin}/invite/glow/${existing.shareToken}`;
    return {
      seed: {
        id: existing.id,
        status: existing.status,
        channel: existing.channel,
        expiresAt: existing.expiresAt.toISOString(),
        shareToken: existing.shareToken,
      },
      shareUrl,
      reused: true,
      seedInventoryCount: sender.seedInventoryCount,
      message: 'Share this link. They create an account and bloom your invite — link invites do not use your seed inventory.',
    };
  }

  const expiryDays = await getAdminConfigNumber('seed_expiry_days', 30);
  const shareToken = randomBytes(16).toString('hex');

  const seed = await prisma.glowSeed.create({
    data: {
      senderId,
      receiverId: null,
      status: GlowSeedStatus.pending,
      channel: GlowSeedChannel.external,
      shareToken,
      expiresAt: seedExpiryDate(expiryDays),
    },
  });

  const shareUrl = `${origin}/invite/glow/${shareToken}`;

  return {
    seed: {
      id: seed.id,
      status: seed.status,
      channel: seed.channel,
      expiresAt: seed.expiresAt.toISOString(),
      shareToken,
    },
    shareUrl,
    reused: false,
    seedInventoryCount: sender.seedInventoryCount,
    message:
      'Share this link. They create an account and bloom your invite — link invites do not use your seed inventory.',
  };
}

export async function previewGlowShareToken(token: string) {
  const seed = await prisma.glowSeed.findUnique({
    where: { shareToken: token },
    include: {
      sender: { select: { id: true, username: true, avatarUrl: true } },
    },
  });
  if (!seed) throw new AppError('Invite link not found', 404);
  if (seed.expiresAt < new Date() || seed.status === GlowSeedStatus.expired) {
    throw new AppError('This invite link has expired', 410);
  }
  if (seed.status === GlowSeedStatus.accepted) {
    throw new AppError('This invite was already accepted', 409);
  }
  return {
    token,
    status: seed.status,
    expiresAt: seed.expiresAt.toISOString(),
    claimed: Boolean(seed.receiverId),
    sender: seed.sender,
  };
}

/** Attach an external invite to a newly registered (or returning) user. */
export async function claimGlowShareToken(userId: string, token: string) {
  const seed = await prisma.glowSeed.findUnique({
    where: { shareToken: token },
    include: {
      sender: { select: { id: true, username: true, avatarUrl: true } },
    },
  });
  if (!seed) throw new AppError('Invite link not found', 404);
  if (seed.channel !== GlowSeedChannel.external) {
    throw new AppError('Not an external invite link', 400);
  }
  if (seed.expiresAt < new Date()) {
    await prisma.glowSeed.update({
      where: { id: seed.id },
      data: { status: GlowSeedStatus.expired },
    });
    throw new AppError('This invite link has expired', 410);
  }
  if (seed.status !== GlowSeedStatus.pending) {
    throw new AppError('This invite is no longer pending', 409);
  }
  if (seed.senderId === userId) {
    throw new AppError('You cannot claim your own invite', 400);
  }
  if (seed.receiverId && seed.receiverId !== userId) {
    throw new AppError('This invite was already claimed by someone else', 409);
  }

  const existingSeed = await prisma.glowSeed.findFirst({
    where: {
      receiverId: userId,
      status: { in: [GlowSeedStatus.pending, GlowSeedStatus.accepted] },
      id: { not: seed.id },
      ...friendReferralSeedWhere(),
    },
  });
  if (existingSeed) {
    throw new AppError('You already have a friend GLOW seed — this invite cannot be claimed', 409);
  }

  const updated = await prisma.glowSeed.update({
    where: { id: seed.id },
    data: { receiverId: userId },
    include: {
      sender: { select: { id: true, username: true, avatarUrl: true } },
    },
  });

  return {
    seed: {
      id: updated.id,
      status: updated.status,
      expiresAt: updated.expiresAt.toISOString(),
      sender: updated.sender,
    },
    message: `Invite from @${updated.sender.username} is ready. Complete onboarding (GAP), then open it on GLOW.`,
  };
}

export type { Virtue };
