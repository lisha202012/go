import { prisma } from './prisma';

export async function getAdminConfigNumber(key: string, fallback: number): Promise<number> {
  const row = await prisma.adminConfig.findUnique({ where: { key } });
  if (!row) return fallback;
  const value = row.value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && !Number.isNaN(Number(value))) return Number(value);
  return fallback;
}
