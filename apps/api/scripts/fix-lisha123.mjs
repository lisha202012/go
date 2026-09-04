import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const user = await prisma.user.update({
  where: { username: 'lisha123' },
  data: { onboardingCompleted: false, flowIndex: 0 },
});

const deleted = await prisma.userMissionProgress.deleteMany({
  where: { userId: user.id },
});

console.log(`Fixed ${user.username}: onboardingCompleted=${user.onboardingCompleted}, flowIndex=${user.flowIndex}`);
console.log(`Deleted ${deleted.count} orphaned mission progress row(s)`);

await prisma.$disconnect();
