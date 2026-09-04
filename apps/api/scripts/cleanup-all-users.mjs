/**
 * Delete all app users except the seeded demo sender (coach_bala).
 * Run from apps/api: node scripts/cleanup-all-users.mjs
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const KEEP_USERNAMES = new Set(['coach_bala']);

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { username: { notIn: [...KEEP_USERNAMES] } },
    select: { id: true, username: true, email: true },
  });

  if (users.length === 0) {
    console.log('No users to delete (only kept accounts remain).');
    return;
  }

  console.log(`Deleting ${users.length} user(s):`);
  for (const user of users) {
    console.log(`  - ${user.username}`);
  }

  const deleted = await prisma.user.deleteMany({
    where: { id: { in: users.map((u) => u.id) } },
  });

  const orphanFamilies = await prisma.family.deleteMany({
    where: { members: { none: {} } },
  });

  console.log(`Deleted ${deleted.count} user(s).`);
  console.log(`Removed ${orphanFamilies.count} orphan family record(s).`);
  console.log(`Kept: ${[...KEEP_USERNAMES].join(', ')}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
