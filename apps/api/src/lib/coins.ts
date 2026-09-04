import { LedgerSource, LedgerType } from '@prisma/client';
import { prisma } from './prisma';

export async function hasWelcomeBonus(userId: string): Promise<boolean> {
  const existing = await prisma.coinLedgerEntry.findFirst({
    where: { userId, source: LedgerSource.welcome_bonus },
  });
  return Boolean(existing);
}

export async function grantWelcomeBonus(
  userId: string,
  amount: number,
  referenceId?: string,
): Promise<boolean> {
  if (amount <= 0) return false;
  if (await hasWelcomeBonus(userId)) return false;

  await prisma.$transaction([
    prisma.coinLedgerEntry.create({
      data: {
        userId,
        amount,
        ledgerType: LedgerType.promotional,
        source: LedgerSource.welcome_bonus,
        referenceId: referenceId ?? null,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        walletCoins: { increment: amount },
        growthCoinsLifetime: { increment: amount },
      },
    }),
  ]);

  return true;
}
