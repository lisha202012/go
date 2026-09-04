/**
 * One-time: create official Coach Bala + connect existing users.
 * Run: npx tsx scripts/backfill-coach-bala.ts
 */
import 'dotenv/config';
import { AccountType, PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';
import { setupOfficialCoachForNewUser } from '../src/lib/coachBalaService';

const prisma = new PrismaClient();

async function ensureOfficialCoach() {
  const coachHash = await hashPassword('coach-bala-dev-only');
  return prisma.user.upsert({
    where: { username: 'coach_bala' },
    update: {
      displayName: 'GoFam Coach Bala',
      accountType: AccountType.official_coach,
      officialAccount: true,
      autoConnectNewUsers: true,
      welcomeGlowSeedEnabled: true,
      monthlyGlowSeedEnabled: true,
      autoBloomReceivedSeed: true,
      qualifyingReceivedSeedLimit: 1,
    },
    create: {
      username: 'coach_bala',
      displayName: 'GoFam Coach Bala',
      email: 'coach.bala@gofam.test',
      passwordHash: coachHash,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=coachbala',
      accountType: AccountType.official_coach,
      officialAccount: true,
      autoConnectNewUsers: true,
      welcomeGlowSeedEnabled: true,
      monthlyGlowSeedEnabled: true,
      autoBloomReceivedSeed: true,
      qualifyingReceivedSeedLimit: 1,
    },
  });
}

async function main() {
  const coach = await ensureOfficialCoach();
  console.log('Official coach ready:', coach.username, coach.id);

  const users = await prisma.user.findMany({
    where: { id: { not: coach.id }, role: 'user' },
    select: { id: true, username: true },
  });

  for (const user of users) {
    await setupOfficialCoachForNewUser(user.id);
    console.log(`Connected + welcome seed for @${user.username}`);
  }

  const welcomeCount = await prisma.glowSeed.count({ where: { seedKind: 'welcome_coach' } });
  const friendCount = await prisma.friendship.count();
  console.log(`Done. Friendships: ${friendCount}, welcome seeds: ${welcomeCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
