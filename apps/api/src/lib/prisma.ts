import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaUrl?: string;
};

/**
 * Prisma Postgres (local `prisma dev`) allows about 10 TCP connections.
 * Prisma Client’s default pool is ~num_cpus*2+1, which overflows that limit.
 * Extra sockets get ECONNRESET; the API then reports “Database is offline”
 * even though the server is still listening. Cap the pool in development.
 * pgbouncer=true also disables prepared statements (portal errors on Windows).
 */
function databaseUrlForClient(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || process.env.NODE_ENV === 'production') return undefined;

  const extras: string[] = [];
  if (!/[?&]pgbouncer=/i.test(url)) extras.push('pgbouncer=true');
  if (!/[?&]connection_limit=/i.test(url)) extras.push('connection_limit=5');
  if (extras.length === 0) return url;

  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}${extras.join('&')}`;
}

const databaseUrl = databaseUrlForClient();

if (globalForPrisma.prisma && globalForPrisma.prismaUrl !== databaseUrl) {
  void globalForPrisma.prisma.$disconnect().catch(() => {});
  globalForPrisma.prisma = undefined;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaUrl = databaseUrl;
}

/** Drop a dead pool and reconnect — Prisma Postgres on Windows often leaves stale sockets. */
export async function reconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  await prisma.$connect();
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    try {
      await reconnectPrisma();
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
