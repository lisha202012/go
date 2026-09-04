import type { User } from '@prisma/client';
import { prisma } from './prisma';
import { toPublicUser } from './publicUser';
import { syncAgeGroupFromDob } from './deriveAgeFromDob';
import { ensureCoachBalaMonthlySeed, setupOfficialCoachForNewUser } from './coachBalaService';

/** GAP assessment is the gate — onboardingCompleted is true only when a GapAssessment row exists. */
export async function withEffectiveOnboardingStatus(user: User) {
  const synced = syncAgeGroupFromDob(user);
  if (synced) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: synced,
    });
  }

  await ensureCoachBalaMonthlySeed(user.id).catch(() => null);
  await setupOfficialCoachForNewUser(user.id).catch(() => null);

  const [progressCount, gap] = await Promise.all([
    prisma.userMissionProgress.count({ where: { userId: user.id } }),
    prisma.gapAssessment.findUnique({ where: { userId: user.id } }),
  ]);

  if (!gap) {
    if (user.onboardingCompleted || user.flowIndex !== 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { onboardingCompleted: false, flowIndex: 0 },
      });
    }

    return {
      ...toPublicUser({ ...user, onboardingCompleted: false, flowIndex: 0 }),
      onboardingCompleted: false,
      needsMissionSelection: false,
    };
  }

  if (!user.onboardingCompleted) {
    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingCompleted: true },
    });
  }

  const isFlowWeek = user.journeyModelVersion >= 2;

  return {
    ...toPublicUser({ ...user, onboardingCompleted: true }),
    onboardingCompleted: true,
    needsMissionSelection: isFlowWeek ? false : progressCount === 0,
  };
}
