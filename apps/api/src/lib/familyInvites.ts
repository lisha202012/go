import { prisma } from './prisma';

export async function countPendingFamilyInvitesForUser(user: {
  email: string;
  username: string;
}) {
  return prisma.familyMember.count({
    where: {
      status: 'pending',
      OR: [
        { inviteEmail: { equals: user.email, mode: 'insensitive' } },
        { inviteUsername: { equals: user.username, mode: 'insensitive' } },
      ],
    },
  });
}

export async function avatarsByInviteUsername(usernames: string[]) {
  const unique = [...new Set(usernames.filter(Boolean))];
  if (unique.length === 0) return new Map<string, string | null>();

  const profiles = await prisma.user.findMany({
    where: {
      OR: unique.map((username) => ({
        username: { equals: username, mode: 'insensitive' as const },
      })),
    },
    select: { username: true, avatarUrl: true },
  });

  return new Map(profiles.map((p) => [p.username.toLowerCase(), p.avatarUrl]));
}
