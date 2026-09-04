import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const [hills, camps, adminConfig, campRewards] = await Promise.all([
  prisma.hill.count(),
  prisma.camp.count(),
  prisma.adminConfig.count(),
  prisma.camp.findMany({ orderBy: { number: 'asc' }, select: { number: true, coinReward: true } }),
]);
console.log({ hills, camps, adminConfig, campRewards });
await prisma.$disconnect();
