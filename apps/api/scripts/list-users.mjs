import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const users = await prisma.user.findMany({ select: { username: true, email: true } });
console.log(users);
await prisma.$disconnect();
