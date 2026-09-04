/**
 * Reset today's FLOW mission completions only (keeps past days intact).
 * Usage: node scripts/reset-today-missions.mjs [username]
 */
import pg from 'pg';

const username = process.argv[2] ?? 'lisha12';

const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:51214/gofam_grow?sslmode=disable',
});

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

await client.connect();

try {
  const userRes = await client.query(
    `SELECT id, username FROM "User" WHERE username ILIKE $1 LIMIT 1`,
    [username],
  );
  const user = userRes.rows[0];
  if (!user) {
    console.log('User not found:', username);
    process.exit(1);
  }

  const todayStart = startOfDay();
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  console.log('Resetting today missions for:', user.username);
  console.log('Today window:', todayStart.toISOString(), '→', tomorrowStart.toISOString());

  const todayCompletions = await client.query(
    `SELECT mc.id, mc."missionId", mc."dayAssignmentId", mc."calendarDate", mc.kind, m.title
     FROM "MissionCompletion" mc
     JOIN "Mission" m ON m.id = mc."missionId"
     WHERE mc."userId" = $1
       AND mc."calendarDate" >= $2
       AND mc."calendarDate" < $3`,
    [user.id, todayStart, tomorrowStart],
  );

  console.log('Today completions to remove:', todayCompletions.rowCount);
  if (todayCompletions.rows.length) console.table(todayCompletions.rows);

  const todayDay = await client.query(
    `SELECT pda.id, pda."dayIndex", pda."prescribedCompleted", pda."dailyFlowComplete", h.code AS hill
     FROM "PersonalDayAssignment" pda
     JOIN "PersonalWeekSchedule" pws ON pws.id = pda."scheduleId"
     JOIN "Hill" h ON h.id = pda."hillId"
     WHERE pws."userId" = $1
       AND pda."calendarDate" >= $2
       AND pda."calendarDate" < $3
     LIMIT 1`,
    [user.id, todayStart, tomorrowStart],
  );

  const dayRow = todayDay.rows[0];
  if (dayRow) {
    console.log('Today day assignment before:', dayRow);
  }

  const missionIds = [...new Set(todayCompletions.rows.map((r) => r.missionId))];
  const dayIds = [...new Set(todayCompletions.rows.map((r) => r.dayAssignmentId).filter(Boolean))];
  if (dayRow?.id) dayIds.push(dayRow.id);

  await client.query('BEGIN');

  const delMc = await client.query(
    `DELETE FROM "MissionCompletion"
     WHERE "userId" = $1
       AND "calendarDate" >= $2
       AND "calendarDate" < $3`,
    [user.id, todayStart, tomorrowStart],
  );

  if (dayRow) {
    await client.query(
      `UPDATE "PersonalDayAssignment"
       SET "prescribedCompleted" = 0, "dailyFlowComplete" = false
       WHERE id = $1`,
      [dayRow.id],
    );
  }

  for (const dayId of [...new Set(dayIds)]) {
    await client.query(
      `UPDATE "PersonalDayAssignment"
       SET "prescribedCompleted" = GREATEST(0, "prescribedCompleted" - (
         SELECT COUNT(*)::int FROM "MissionCompletion"
         WHERE "dayAssignmentId" = $1 AND "userId" = $2 AND kind = 'home_bonus_slot'
       )),
       "dailyFlowComplete" = false
       WHERE id = $1`,
      [dayId, user.id],
    );
  }

  // Recalculate progress for missions touched today.
  for (const missionId of missionIds) {
    const countRes = await client.query(
      `SELECT COUNT(*)::int AS n, MAX("createdAt") AS last
       FROM "MissionCompletion" WHERE "userId" = $1 AND "missionId" = $2`,
      [user.id, missionId],
    );
    const remaining = countRes.rows[0]?.n ?? 0;
    const last = countRes.rows[0]?.last ?? null;
    if (remaining === 0) {
      await client.query(
        `UPDATE "UserMissionProgress"
         SET status = 'current', "startedAt" = NULL, "completedAt" = NULL, "completionCount" = 0
         WHERE "userId" = $1 AND "missionId" = $2`,
        [user.id, missionId],
      );
    } else {
      await client.query(
        `UPDATE "UserMissionProgress"
         SET "completionCount" = $3, "completedAt" = $4,
             status = CASE WHEN $3 > 0 THEN 'completed'::"MissionStatus" ELSE 'current'::"MissionStatus" END
         WHERE "userId" = $1 AND "missionId" = $2`,
        [user.id, missionId, remaining, last],
      );
    }
  }

  const refs = [...new Set(dayIds)].flatMap((id) => [
    `flow_daily_bonus:${id}`,
    `flow_daily_seed:${id}`,
    `flow_dev_test_seed:${id}`,
  ]);
  const completionIds = todayCompletions.rows.map((r) => r.id);
  if (refs.length || completionIds.length) {
    await client.query(
      `DELETE FROM "CoinLedgerEntry"
       WHERE "userId" = $1
         AND source = 'flow_week'
         AND (
           "referenceId" = ANY($2::text[])
           OR "referenceId" = ANY($3::text[])
         )`,
      [user.id, refs, completionIds.map((id) => `flow_complete:${id}`)],
    );
  }

  await client.query('COMMIT');

  console.log(`Deleted MissionCompletion rows: ${delMc.rowCount}`);
  console.log(`Reset progress for ${missionIds.length} mission(s).`);
  console.log('Done — refresh Journey/Missions and test again.');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(err);
  process.exit(1);
} finally {
  await client.end();
}
