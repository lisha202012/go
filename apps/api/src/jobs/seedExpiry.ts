import { GlowSeedStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

export async function expirePendingSeeds(): Promise<number> {
  const result = await prisma.glowSeed.updateMany({
    where: {
      status: GlowSeedStatus.pending,
      expiresAt: { lt: new Date() },
    },
    data: {
      status: GlowSeedStatus.expired,
    },
  });

  if (result.count > 0) {
    console.log(`[cron] Expired ${result.count} pending Glow Seeds`);
  }

  return result.count;
}
