import { prisma } from '../src/lib/prisma';

async function main() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connection: OK');
  } catch (e) {
    console.error('Database connection: FAILED');
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
