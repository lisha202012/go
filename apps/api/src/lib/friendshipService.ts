import { FriendshipStatus, GlowSeedStatus } from '@prisma/client';
import { prisma } from './prisma';

function orderedPair(userIdA: string, userIdB: string): [string, string] {
  return userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
}

export async function ensureFriends(userIdA: string, userIdB: string) {
  if (userIdA === userIdB) return null;
  const [a, b] = orderedPair(userIdA, userIdB);
  return prisma.friendship.upsert({
    where: { userAId_userBId: { userAId: a, userBId: b } },
    create: { userAId: a, userBId: b, status: FriendshipStatus.friends },
    update: { status: FriendshipStatus.friends },
  });
}

export async function listFriends(userId: string) {
  const rows = await prisma.friendship.findMany({
    where: {
      status: FriendshipStatus.friends,
      OR: [
        { userAId: userId, userB: { role: { not: 'admin' } } },
        { userBId: userId, userA: { role: { not: 'admin' } } },
      ],
    },
    include: {
      userA: { select: { id: true, username: true, displayName: true, avatarUrl: true, flowIndex: true, officialAccount: true, accountType: true } },
      userB: { select: { id: true, username: true, displayName: true, avatarUrl: true, flowIndex: true, officialAccount: true, accountType: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const friendIds = rows.map((row) => (row.userAId === userId ? row.userBId : row.userAId));
  const glowLinks =
    friendIds.length === 0
      ? []
      : await prisma.glowSeed.findMany({
          where: {
            status: GlowSeedStatus.accepted,
            OR: [
              { senderId: userId, receiverId: { in: friendIds } },
              { receiverId: userId, senderId: { in: friendIds } },
            ],
          },
          select: { senderId: true, receiverId: true },
        });

  return rows.map((row) => {
    const friend = row.userAId === userId ? row.userB : row.userA;
    const planted = glowLinks.some((s) => s.senderId === userId && s.receiverId === friend.id);
    const received = glowLinks.some((s) => s.receiverId === userId && s.senderId === friend.id);
    // Receiver must not see sender FLOW score; only show when you planted for them.
    return {
      friendshipId: row.id,
      since: row.createdAt.toISOString(),
      planted,
      received,
      showFlowScore: planted,
      friend: {
        id: friend.id,
        username: friend.username,
        displayName: friend.displayName,
        avatarUrl: friend.avatarUrl,
        officialAccount: friend.officialAccount,
        accountType: friend.accountType,
        ...(planted ? { flowIndex: friend.flowIndex } : {}),
      },
    };
  });
}
