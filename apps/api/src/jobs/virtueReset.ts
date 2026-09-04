import { prisma } from '../lib/prisma';

/**
 * Monthly ×2 expires via `expiresAt` — do not delete rows.
 * Collection (7/7 virtues) must persist after month-end.
 */
export async function resetExpiredVirtues(): Promise<number> {
  const expired = await prisma.activeVirtue.count({
    where: { expiresAt: { lt: new Date() } },
  });
  if (expired > 0) {
    console.log(`[cron] ${expired} virtues past monthly ×2 window (collection kept)`);
  }
  return 0;
}
