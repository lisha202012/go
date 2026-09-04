import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';
import type { AgeCategoryCode } from './ageCategories';
import { syncAgeGroupFromDob } from './deriveAgeFromDob';
import { resolveUserCategoryCode } from './missionEngine';

type SyncOptions = {
  /** When true, users without dateOfBirth cannot proceed (GAP, onboarding content). */
  requireDob?: boolean;
};

/**
 * Recompute leadership / GAP category from stored dateOfBirth and persist when it changed.
 * Never stores a raw age number — only the derived category code (S1E, B3, …).
 */
export async function syncUserAgeGroupFromDob(
  userId: string,
  options: SyncOptions = {},
): Promise<AgeCategoryCode> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      dateOfBirth: true,
      ageGroup: true,
      journeyRole: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.dateOfBirth) {
    if (options.requireDob) {
      throw new AppError(
        'Add your date of birth before continuing. GAP questions and missions are chosen from your date of birth, not a fixed age.',
        400,
      );
    }
    return resolveUserCategoryCode(user.ageGroup);
  }

  const synced = syncAgeGroupFromDob(user);
  if (synced) {
    await prisma.user.update({
      where: { id: userId },
      data: synced,
    });
    return synced.ageGroup as AgeCategoryCode;
  }

  return resolveUserCategoryCode(user.ageGroup);
}
