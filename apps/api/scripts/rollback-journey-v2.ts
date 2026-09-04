/**
 * Roll back FLOW Week v2 cutover for one or all migrated users.
 *
 * Run:
 *   npx tsx scripts/rollback-journey-v2.ts [--user-id=<id>] [--force] [--actor=<userId>] [--reason="..."]
 */
import { randomUUID } from 'node:crypto';
import { LedgerSource } from '@prisma/client';
import { writeAuditLog } from '../src/lib/auditService';
import type { UserMigrationSnapshot } from '../src/lib/flowWeek/migrationSnapshot';
import { evaluateRollbackGuard } from '../src/lib/flowWeek/rollbackGuard';
import { prisma } from '../src/lib/prisma';

const SCRIPT_VERSION = 'rollback-journey-v2@1.0.0';
const V2_AWARD_SOURCES = ['flow_perfect_week', 'flow_starter_week'] as const;

type CliOptions = {
  userId?: string;
  force: boolean;
  actor?: string;
  reason?: string;
};

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const userArg = args.find((a) => a.startsWith('--user-id='));
  const actorArg = args.find((a) => a.startsWith('--actor='));
  const reasonArg = args.find((a) => a.startsWith('--reason='));
  return {
    userId: userArg?.split('=')[1],
    force: args.includes('--force'),
    actor: actorArg?.split('=')[1],
    reason: reasonArg ? reasonArg.slice('--reason='.length) : undefined,
  };
}

async function checkRollbackGuard(userId: string, beforeJson: UserMigrationSnapshot) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { flowLockstepSteps: true },
  });

  const postCutoverAwardRows = await prisma.growthSet.count({
    where: {
      userId,
      awardSource: { in: [...V2_AWARD_SOURCES] },
    },
  });

  const guard = evaluateRollbackGuard({
    flowLockstepSteps: user.flowLockstepSteps,
    lockstepStepsAtMigration: beforeJson.lockstepStepsAtMigration,
    postCutoverAwardRows,
  });

  return { ...guard, postCutoverAwardRows };
}

async function rollbackUser(
  userId: string,
  opts: CliOptions,
  runId: string,
): Promise<{ ok: boolean; error?: string }> {
  const audit = await prisma.auditLog.findFirst({
    where: {
      module: 'journey',
      action: 'migration.v2_cutover',
      subjectUserId: userId,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!audit?.beforeJson) {
    return { ok: false, error: 'No migration.v2_cutover audit with beforeJson found' };
  }

  const beforeJson = audit.beforeJson as UserMigrationSnapshot;
  const afterJson = audit.afterJson as { user?: { migratedAt?: string } } | null;
  const migratedAtStr = afterJson?.user?.migratedAt;
  if (!migratedAtStr) {
    return { ok: false, error: 'Cutover audit missing migratedAt in afterJson' };
  }
  const migratedAt = new Date(migratedAtStr);

  const guard = await checkRollbackGuard(userId, beforeJson);
  if (!guard.allowed) {
    if (!opts.force) {
      return { ok: false, error: guard.reason };
    }

    await writeAuditLog({
      module: 'system',
      action: 'migration.v2_rollback.force_used',
      actorUserId: opts.actor ?? null,
      subjectUserId: userId,
      entityType: 'User',
      entityId: userId,
      metadata: {
        runId,
        scriptVersion: SCRIPT_VERSION,
        actor: opts.actor ?? null,
        reason: opts.reason ?? '(no reason provided)',
        guardReason: guard.reason,
        postCutoverAwardRows: guard.postCutoverAwardRows,
      },
    });
  }

  const userBeforeRollback = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  await prisma.$transaction(async (tx) => {
    await tx.personalWeekSchedule.deleteMany({
      where: {
        userId,
        createdAt: { gte: migratedAt },
      },
    });

    await tx.growthSet.deleteMany({
      where: {
        userId,
        OR: [
          { awardSource: { in: [...V2_AWARD_SOURCES] } },
          {
            awardBatchId: { not: null },
            completedAt: { gte: migratedAt },
            NOT: { awardSource: 'legacy_block' },
          },
        ],
      },
    });

    const migrationCoins = await tx.coinLedgerEntry.findMany({
      where: {
        userId,
        source: LedgerSource.migration_block_conversion,
      },
    });

    const coinReversal = migrationCoins.reduce((sum, e) => sum + e.amount, 0);
    if (migrationCoins.length > 0) {
      await tx.coinLedgerEntry.deleteMany({
        where: { id: { in: migrationCoins.map((e) => e.id) } },
      });
      if (coinReversal > 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            walletCoins: { decrement: coinReversal },
            growthCoinsLifetime: { decrement: coinReversal },
          },
        });
      }
    }

    const restore = beforeJson.user;
    await tx.user.update({
      where: { id: userId },
      data: {
        journeyModelVersion: restore.journeyModelVersion,
        migratedAt: restore.migratedAt,
        flowLockstepSteps: restore.flowLockstepSteps,
        legacyStepsByHill: restore.legacyStepsByHill ?? undefined,
        legacyPeakSteps: restore.legacyPeakSteps,
        legacyJourneySnapshot: restore.legacyJourneySnapshot ?? undefined,
        currentStep: restore.currentStep,
        currentCampId: restore.currentCampId,
        gofamWeekStartDay: restore.gofamWeekStartDay,
        starterWeekActive: restore.starterWeekActive,
        starterWeekCompletedAt: restore.starterWeekCompletedAt,
      },
    });
  });

  const userAfterRollback = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  await writeAuditLog({
    module: 'journey',
    action: 'migration.v2_rollback',
    actorUserId: opts.actor ?? null,
    subjectUserId: userId,
    entityType: 'User',
    entityId: userId,
    beforeJson: userBeforeRollback,
    afterJson: userAfterRollback,
    metadata: {
      runId,
      scriptVersion: SCRIPT_VERSION,
      originalCutoverAuditId: audit.id,
      forced: opts.force && !guard.allowed,
      forceReason: opts.reason ?? null,
      actor: opts.actor ?? null,
    },
  });

  return { ok: true };
}

async function main() {
  const opts = parseArgs();
  const runId = randomUUID();
  const startedAt = new Date();
  const errors: Array<{ userId: string; error: string }> = [];
  let usersRolledBack = 0;

  if (opts.force && !opts.reason) {
    console.warn('Warning: --force used without --reason; audit will record "(no reason provided)"');
  }

  const userIds = opts.userId
    ? [opts.userId]
    : (
        await prisma.auditLog.findMany({
          where: { module: 'journey', action: 'migration.v2_cutover' },
          select: { subjectUserId: true },
          distinct: ['subjectUserId'],
        })
      )
        .map((a) => a.subjectUserId)
        .filter((id): id is string => Boolean(id));

  console.log(`Rolling back ${userIds.length} user(s) (force=${opts.force})`);

  for (const userId of userIds) {
    const result = await rollbackUser(userId, opts, runId);
    if (result.ok) {
      usersRolledBack += 1;
      console.log(`Rolled back user ${userId}`);
    } else {
      errors.push({ userId, error: result.error ?? 'unknown error' });
      console.error(`Rollback failed for ${userId}: ${result.error}`);
    }
  }

  const finishedAt = new Date();

  await writeAuditLog({
    module: 'system',
    action: 'migration.v2_rollback.batch_complete',
    actorUserId: opts.actor ?? null,
    metadata: {
      runId,
      scriptVersion: SCRIPT_VERSION,
      usersRolledBack,
      usersFailed: errors.length,
      forced: opts.force,
      forceActor: opts.actor ?? null,
      forceReason: opts.reason ?? null,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      errors,
    },
  });

  console.log(`Rollback complete: ok=${usersRolledBack} failed=${errors.length}`);

  if (errors.length > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
