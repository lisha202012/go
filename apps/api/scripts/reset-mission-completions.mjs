/**
 * Reset FLOW mission completions so Home Hill / chakra can be retested.
 * Usage: node scripts/reset-mission-completions.mjs [username]
 * Default: most recently active FLOW user with completions.
 */
import pg from 'pg';

const usernameArg = process.argv[2] ?? null;

const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:51214/gofam_grow?sslmode=disable',
});

await client.connect();

try {
  let user;
  if (usernameArg) {
    const r = await client.query(
      `SELECT id, username, "walletCoins", "seedInventoryCount"
       FROM "User" WHERE username ILIKE $1 LIMIT 1`,
      [usernameArg],
    );
    user = r.rows[0];
  } else {
    const r = await client.query(
      `SELECT u.id, u.username, u."walletCoins", u."seedInventoryCount"
       FROM "User" u
       WHERE EXISTS (SELECT 1 FROM "MissionCompletion" mc WHERE mc."userId" = u.id)
          OR EXISTS (
            SELECT 1 FROM "PersonalWeekSchedule" pws
            JOIN "PersonalDayAssignment" pda ON pda."scheduleId" = pws.id
            WHERE pws."userId" = u.id
              AND (pda."prescribedCompleted" > 0 OR pda."dailyFlowComplete" = true)
          )
       ORDER BY u."updatedAt" DESC NULLS LAST
       LIMIT 1`,
    );
    user = r.rows[0];
  }

  if (!user) {
    console.log('No user with mission progress found.');
    process.exit(0);
  }

  console.log('Resetting missions for:', user);

  const before = await client.query(
    `SELECT COUNT(*)::int AS n FROM "MissionCompletion" WHERE "userId" = $1`,
    [user.id],
  );
  const progressBefore = await client.query(
    `SELECT COUNT(*)::int AS n FROM "UserMissionProgress"
     WHERE "userId" = $1 AND (status = 'completed' OR "completionCount" > 0 OR "completedAt" IS NOT NULL)`,
    [user.id],
  );
  const daysBefore = await client.query(
    `SELECT pda.id, pda."dayIndex", pda."calendarDate", pda."prescribedCompleted", pda."dailyFlowComplete", h.code AS hill
     FROM "PersonalDayAssignment" pda
     JOIN "PersonalWeekSchedule" pws ON pws.id = pda."scheduleId"
     JOIN "Hill" h ON h.id = pda."hillId"
     WHERE pws."userId" = $1
       AND (pda."prescribedCompleted" > 0 OR pda."dailyFlowComplete" = true)
     ORDER BY pda."calendarDate" DESC`,
    [user.id],
  );

  console.log('Before — MissionCompletion:', before.rows[0].n);
  console.log('Before — progressed UserMissionProgress:', progressBefore.rows[0].n);
  console.log('Before — days with FLOW progress:');
  console.table(daysBefore.rows);

  await client.query('BEGIN');

  const delMc = await client.query(`DELETE FROM "MissionCompletion" WHERE "userId" = $1`, [
    user.id,
  ]);

  const resetProgress = await client.query(
    `UPDATE "UserMissionProgress"
     SET status = 'locked',
         "startedAt" = NULL,
         "completedAt" = NULL,
         "completionCount" = 0,
         "reflectionText" = NULL,
         "evidenceUrl" = NULL
     WHERE "userId" = $1
       AND (status IN ('completed', 'current', 'locked')
            OR "completionCount" > 0
            OR "completedAt" IS NOT NULL
            OR "startedAt" IS NOT NULL)`,
    [user.id],
  );

  // Unlock all missions so FLOW Week list can Start → Complete again.
  await client.query(
    `UPDATE "UserMissionProgress"
     SET status = 'current'
     WHERE "userId" = $1`,
    [user.id],
  );

  const resetDays = await client.query(
    `UPDATE "PersonalDayAssignment" pda
     SET "prescribedCompleted" = 0,
         "dailyFlowComplete" = false
     FROM "PersonalWeekSchedule" pws
     WHERE pda."scheduleId" = pws.id
       AND pws."userId" = $1
       AND (pda."prescribedCompleted" > 0 OR pda."dailyFlowComplete" = true)
     RETURNING pda.id`,
    [user.id],
  );

  const dayIds = resetDays.rows.map((r) => r.id);
  let ledgerDeleted = 0;
  if (dayIds.length > 0) {
    const refs = dayIds.flatMap((id) => [
      `flow_daily_bonus:${id}`,
      `flow_daily_seed:${id}`,
    ]);
    const delLedger = await client.query(
      `DELETE FROM "CoinLedgerEntry"
       WHERE "userId" = $1
         AND source = 'flow_week'
         AND (
           "referenceId" = ANY($2::text[])
           OR "referenceId" LIKE 'flow_prescribed:%'
           OR "referenceId" LIKE 'flow_home_bonus:%'
           OR "referenceId" LIKE 'flow_completion:%'
           OR "referenceId" LIKE 'flow_optional:%'
         )`,
      [user.id, refs],
    );
    ledgerDeleted = delLedger.rowCount ?? 0;
  }

  // Clear perfect-week / step flags on current schedules so daily FLOW can award again.
  await client.query(
    `UPDATE "PersonalWeekSchedule"
     SET "perfectWeek" = false,
         "stepAwardedAt" = NULL
     WHERE "userId" = $1`,
    [user.id],
  );

  await client.query('COMMIT');

  console.log(`Deleted MissionCompletion rows: ${delMc.rowCount}`);
  console.log(`Reset UserMissionProgress rows: ${resetProgress.rowCount}`);
  console.log(`Reset PersonalDayAssignment rows: ${resetDays.rowCount}`);
  console.log(`Deleted related CoinLedgerEntry rows: ${ledgerDeleted}`);
  console.log('Done. Refresh Missions and complete again.');
  console.log('(Wallet/seed counts were not reversed — only completion state + bonus ledger refs.)');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(err);
  process.exit(1);
} finally {
  await client.end();
}
