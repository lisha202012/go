import { PrismaClient } from '@prisma/client';
import { getEligibleMissionAlternates } from '../src/lib/missionAlternates.ts';
import { getHillMissionRecommendations } from '../src/lib/missionRecommendations.ts';

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findFirst({ where: { onboardingCompleted: true } });
  if (!user) {
    console.log('No onboarded user found');
    process.exit(0);
  }

  const assessment = await prisma.gapAssessment.findUnique({
    where: { userId: user.id },
    include: { focusHill: true },
  });
  if (!assessment) {
    console.log('No assessment');
    process.exit(1);
  }

  const { recommended } = await getHillMissionRecommendations(
    user.id,
    assessment.focusHill,
    'focus',
  );

  const selectedIds = recommended.map((m) => m.id);
  console.log('selected', selectedIds.length, selectedIds[0]);

  const result = await getEligibleMissionAlternates(
    user.id,
    assessment.focusHill.id,
    selectedIds[0],
    selectedIds,
    'focus',
  );
  console.log('alternates count', result.alternates.length);
  console.log('first alternate', result.alternates[0]?.title);
} catch (e) {
  console.error('ERROR', e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
