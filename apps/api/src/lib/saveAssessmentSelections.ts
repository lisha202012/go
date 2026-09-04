import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import type { HillMissionSelections } from './journeySelections';

/** Persist focus picks + full hill map; works before/after hillMissionSelections migration. */
export async function saveAssessmentSelections(
  userId: string,
  focusMissionIds: string[],
  hillSelections: HillMissionSelections,
) {
  await prisma.gapAssessment.update({
    where: { userId },
    data: { focusMissionIds: focusMissionIds },
  });

  try {
    await prisma.gapAssessment.update({
      where: { userId },
      data: { hillMissionSelections: hillSelections as Prisma.InputJsonValue },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const missingColumn =
      message.includes('hillMissionSelections') ||
      (err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === 'P2022' || err.code === 'P2010'));

    if (missingColumn) {
      try {
        await prisma.$executeRaw`
          UPDATE "GapAssessment"
          SET "hillMissionSelections" = ${JSON.stringify(hillSelections)}::jsonb
          WHERE "userId" = ${userId}
        `;
        return;
      } catch {
        console.warn(
          '[journey] hillMissionSelections unavailable — run: npx prisma migrate deploy',
        );
        return;
      }
    }

    if (err instanceof Prisma.PrismaClientValidationError) {
      console.warn(
        '[journey] Prisma client missing hillMissionSelections — run: npx prisma generate',
      );
      return;
    }

    throw err;
  }
}
