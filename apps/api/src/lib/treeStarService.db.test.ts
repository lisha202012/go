import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient, LedgerType, LedgerSource, Virtue } from '@prisma/client';
import {
  awardCampTreeStar,
  awardGapTreeStars,
  awardVirtueTreeStar,
  checkAndAwardCoinMilestones,
  getTreeProgress,
  GLOW_VIRTUE_MONTHLY_CAP,
} from './treeStarService';

describe('treeStarService — database grants', () => {
  it('idempotent camp/gap/coins/virtue grants + monthly virtue cap', async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip('DATABASE_URL not set');
      return;
    }

    const prisma = new PrismaClient();
    const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    let userId = '';

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      await prisma.$disconnect();
      t.skip('Database unavailable');
      return;
    }

    try {
      const user = await prisma.user.create({
        data: {
          email: `tree_${suffix}@test.local`,
          username: `tree_${suffix}`.slice(0, 24),
          passwordHash: 'x',
        },
      });
      userId = user.id;

      await prisma.$transaction(async (tx) => {
        const first = await awardCampTreeStar(tx, userId, { number: 1, name: 'Base Camp' });
        assert.equal(first?.granted, true);
        assert.equal(first?.stars, 1);

        const again = await awardCampTreeStar(tx, userId, { number: 1, name: 'Base Camp' });
        assert.equal(again?.granted, false);

        const camp2 = await awardCampTreeStar(tx, userId, { number: 2, name: 'Camp 2' });
        assert.equal(camp2?.granted, true);
        assert.equal(camp2?.stars, 1);
      });

      const gap = await prisma.gapAssessment.create({
        data: {
          userId,
          flowIndex: 90,
          totalRawScore: 900,
          strongestHillId: (await prisma.hill.findFirstOrThrow()).id,
          focusHillId: (await prisma.hill.findFirstOrThrow()).id,
          isOfficial: true,
          completedAt: new Date(),
          nextRecalibrationAt: new Date(Date.now() + 90 * 86400000),
        },
      });

      await prisma.$transaction(async (tx) => {
        const official = await awardGapTreeStars(tx, userId, gap);
        assert.equal(official?.granted, true);
        assert.equal(official?.stars, 7);

        const dup = await awardGapTreeStars(tx, userId, gap);
        assert.equal(dup?.granted, false);

        const practice = await awardGapTreeStars(tx, userId, {
          ...gap,
          id: 'practice-fake',
          isOfficial: false,
        });
        assert.equal(practice, null);
      });

      await prisma.coinLedgerEntry.create({
        data: {
          userId,
          amount: 100_000,
          ledgerType: LedgerType.personal_growth,
          source: LedgerSource.mission,
          referenceId: `tree_coins_${suffix}`,
        },
      });

      await prisma.$transaction(async (tx) => {
        const grants = await checkAndAwardCoinMilestones(tx, userId);
        const newly = grants.filter((g) => g.granted);
        assert.equal(
          newly.reduce((s, g) => s + g.stars, 0),
          20,
        );
        const again = await checkAndAwardCoinMilestones(tx, userId);
        assert.equal(again.every((g) => !g.granted), true);
      });

      await prisma.coinLedgerEntry.create({
        data: {
          userId,
          amount: 1_400_000,
          ledgerType: LedgerType.personal_growth,
          source: LedgerSource.mission,
          referenceId: `tree_coins_15_${suffix}`,
        },
      });

      await prisma.$transaction(async (tx) => {
        const grants = await checkAndAwardCoinMilestones(tx, userId);
        const hit15 = grants.find((g) => g.granted && g.stars === 100);
        assert.ok(hit15);
      });

      const virtues = [
        Virtue.Kindness,
        Virtue.Responsibility,
        Virtue.Discipline,
        Virtue.Integrity,
        Virtue.HardWork,
        Virtue.Courage,
        Virtue.Patience,
      ];

      await prisma.$transaction(async (tx) => {
        for (const v of virtues) {
          const r = await awardVirtueTreeStar(tx, userId, v);
          assert.equal(r?.granted, true);
        }
        assert.equal(virtues.length, GLOW_VIRTUE_MONTHLY_CAP);

        const dupVirtue = await awardVirtueTreeStar(tx, userId, Virtue.Kindness);
        assert.equal(dupVirtue?.granted, false);

        // Cap: invent an 8th key by using a fake virtue string (ledger accepts string)
        const eighth = await awardVirtueTreeStar(tx, userId, 'ExtraVirtue');
        assert.equal(eighth?.granted, false);
      });

      const progress = await getTreeProgress(userId, prisma);
      assert.ok(progress.treeStarsTotal >= 1 + 1 + 7 + 20 + 100 + 7);
    } finally {
      if (userId) {
        await prisma.treeStarGrant.deleteMany({ where: { userId } });
        await prisma.coinLedgerEntry.deleteMany({ where: { userId } });
        await prisma.gapAssessment.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
      }
      await prisma.$disconnect();
    }
  });
});
