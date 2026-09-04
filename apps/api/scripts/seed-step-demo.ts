/**
 * Seeds stepdemo@gofam.test for screenshot verification:
 * - HOPE: 2 steps complete (6 missions), step 3 in progress (2/3)
 * - HONE: 1 step complete (3 missions)
 * Password: StepDemo123!
 */
import { PrismaClient, MissionStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { backfillGrowthSetsForUser } from '../src/lib/backfillGrowthSets';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `${process.env.DATABASE_URL}${process.env.DATABASE_URL?.includes('?') ? '&' : '?'}pgbouncer=true`,
    },
  },
});

const EMAIL = 'stepdemo@gofam.test';
const PASSWORD = 'StepDemo123!';

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const hills = await prisma.hill.findMany();
  const hope = hills.find((h) => h.code === 'HOPE');
  const hone = hills.find((h) => h.code === 'HONE');
  if (!hope || !hone) throw new Error('Run prisma db seed first');

  const categoryCode = 'V6';
  const hopeMissions = await prisma.mission.findMany({
    where: { hillId: hope.id, categoryCode },
    orderBy: { order: 'asc' },
    take: 9,
  });
  const honeMissions = await prisma.mission.findMany({
    where: { hillId: hone.id, categoryCode },
    orderBy: { order: 'asc' },
    take: 6,
  });

  if (hopeMissions.length < 9 || honeMissions.length < 6) {
    throw new Error('Need seeded missions — run prisma db seed');
  }

  /** Block-0 picks for every hill so the journey builder reaches HOPE Step 3. */
  const hillMissionSelections: Record<string, string[][]> = {
    [hope.id]: [
      hopeMissions.slice(0, 3).map((m) => m.id),
      hopeMissions.slice(3, 6).map((m) => m.id),
      hopeMissions.slice(6, 9).map((m) => m.id),
    ],
    [hone.id]: [
      honeMissions.slice(0, 3).map((m) => m.id),
      honeMissions.slice(3, 6).map((m) => m.id),
    ],
  };

  for (const hill of hills) {
    if (hill.id === hope.id || hill.id === hone.id) continue;
    const block = await prisma.mission.findMany({
      where: { hillId: hill.id, categoryCode },
      orderBy: { order: 'asc' },
      take: 3,
    });
    if (block.length === 3) {
      hillMissionSelections[hill.id] = [block.map((m) => m.id)];
    }
  }

  let user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (user) {
    await prisma.growthSet.deleteMany({ where: { userId: user.id } });
    await prisma.userMissionProgress.deleteMany({ where: { userId: user.id } });
    await prisma.gapAssessment.deleteMany({ where: { userId: user.id } });
  } else {
    user = await prisma.user.create({
      data: {
        email: EMAIL,
        username: 'stepdemo',
        passwordHash,
        onboardingCompleted: true,
        ageGroup: 'adult',
      },
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, onboardingCompleted: true, username: 'stepdemo' },
  });

  const baseCamp = await prisma.camp.findFirst({ where: { number: 1 } });

  await prisma.gapAssessment.create({
    data: {
      userId: user.id,
      focusHillId: hope.id,
      strongestHillId: hope.id,
      flowIndex: 62,
      totalRawScore: 120,
      focusMissionIds: hopeMissions.slice(6, 9).map((m) => m.id),
      hillMissionSelections,
      completedAt: new Date(),
      nextRecalibrationAt: new Date(Date.now() + 90 * 86400000),
      hillScores: {
        create: hills.map((h) => ({
          hillId: h.id,
          rawScore: h.code === 'HOPE' ? 55 : 40,
          flowPercent: h.code === 'HOPE' ? 55 : 40,
        })),
      },
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { currentCampId: baseCamp?.id ?? null, currentStep: 0 },
  });

  const now = Date.now();
  let t = 0;
  const stamp = () => new Date(now - t++ * 3600000);

  for (let i = 0; i < 6; i++) {
    await prisma.userMissionProgress.create({
      data: {
        userId: user.id,
        missionId: hopeMissions[i].id,
        status: MissionStatus.completed,
        startedAt: stamp(),
        completedAt: stamp(),
      },
    });
  }

  for (let i = 0; i < 3; i++) {
    await prisma.userMissionProgress.create({
      data: {
        userId: user.id,
        missionId: honeMissions[i].id,
        status: MissionStatus.completed,
        startedAt: stamp(),
        completedAt: stamp(),
      },
    });
  }

  await prisma.userMissionProgress.create({
    data: {
      userId: user.id,
      missionId: hopeMissions[6].id,
      status: MissionStatus.completed,
      startedAt: stamp(),
      completedAt: stamp(),
    },
  });
  await prisma.userMissionProgress.create({
    data: {
      userId: user.id,
      missionId: hopeMissions[7].id,
      status: MissionStatus.completed,
      startedAt: stamp(),
      completedAt: stamp(),
    },
  });
  await prisma.userMissionProgress.create({
    data: {
      userId: user.id,
      missionId: hopeMissions[8].id,
      status: MissionStatus.current,
      startedAt: stamp(),
    },
  });

  await backfillGrowthSetsForUser(prisma, user.id);

  console.log(JSON.stringify({ email: EMAIL, password: PASSWORD, userId: user.id }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
