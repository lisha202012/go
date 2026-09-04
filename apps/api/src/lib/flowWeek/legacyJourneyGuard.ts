import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../prisma';

/** Reject legacy journey mutations for FLOW Week (v2) users. */
export async function assertLegacyJourneyAccess(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { journeyModelVersion: true },
  });
  if (user.journeyModelVersion >= 2) {
    throw new AppError(
      'Legacy hill-block journey is closed. Use FLOW Week daily missions instead.',
      410,
    );
  }
}
