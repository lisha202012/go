/**
 * Remove duplicate pending Coach Bala seeds (keep newest per kind).
 * Run: npx tsx scripts/dedupe-coach-seeds.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function dedupeUser(userId: string, username: string) {
  const pendingWelcome = await prisma.glowSeed.findFirst({
    where: { receiverId: userId, seedKind: 'welcome_coach', status: 'pending' },
  });

  for (const kind of ['welcome_coach', 'monthly_coach'] as const) {
    const pending = await prisma.glowSeed.findMany({
      where: { receiverId: userId, seedKind: kind, status: 'pending' },
      orderBy: { sentAt: 'asc' },
    });
    if (pending.length <= 1) continue;
    const [, ...extras] = pending;
    await prisma.glowSeed.deleteMany({ where: { id: { in: extras.map((s) => s.id) } } });
    console.log(`@${username}: removed ${extras.length} duplicate ${kind} seed(s)`);
  }

  if (pendingWelcome) {
    const removed = await prisma.glowSeed.deleteMany({
      where: { receiverId: userId, seedKind: 'monthly_coach', status: 'pending' },
    });
    if (removed.count) {
      console.log(`@${username}: removed ${removed.count} monthly seed(s) until welcome is opened`);
    }
  }
}

async function main() {
  const users = await prisma.user.findMany({
    where: { role: 'user' },
    select: { id: true, username: true },
  });
  for (const u of users) {
    await dedupeUser(u.id, u.username);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
