import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

for (const username of ['Eshop_Chennai', 'lisha12', 'lincy']) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.log(`@${username}: not found`);
    continue;
  }
  const pending = await prisma.glowSeed.findMany({
    where: { receiverId: user.id, status: 'pending' },
    include: { sender: { select: { username: true, displayName: true, officialAccount: true } } },
  });
  const friends = await prisma.friendship.findMany({
    where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
  });
  console.log(`\n@${username}:`);
  console.log('  pending seeds:', pending.map((s) => ({ from: s.sender.username, kind: s.seedKind, official: s.sender.officialAccount })));
  console.log('  friendships:', friends.length);
}

await prisma.$disconnect();
