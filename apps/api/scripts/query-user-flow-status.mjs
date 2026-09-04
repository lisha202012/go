import pg from 'pg';

const username = process.argv[2] ?? 'lisha12';
const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:51214/gofam_grow?sslmode=disable',
});

await client.connect();

const user = await client.query(`SELECT id, username, "seedInventoryCount", "walletCoins" FROM "User" WHERE username = $1`, [username]);
const userId = user.rows[0]?.id;
console.log('User:', user.rows[0]);

if (userId) {
  const ledger = await client.query(
    `SELECT "referenceId", amount, "createdAt"
     FROM "CoinLedgerEntry"
     WHERE "userId" = $1 AND source = 'flow_week'
     ORDER BY "createdAt" DESC LIMIT 20`,
    [userId],
  );
  console.log('\nRecent flow_week ledger:');
  console.table(ledger.rows);

  const todayDay = await client.query(
    `SELECT pda.*, h.code AS "hillCode"
     FROM "PersonalDayAssignment" pda
     JOIN "PersonalWeekSchedule" pws ON pws.id = pda."scheduleId"
     JOIN "Hill" h ON h.id = pda."hillId"
     WHERE pws."userId" = $1
     ORDER BY pda."calendarDate" ASC`,
    [userId],
  );
  console.log('\nAll week days:');
  console.table(todayDay.rows.map((r) => ({
    id: r.id,
    dayIndex: r.dayIndex,
    hill: r.hillCode,
    calendarDate: r.calendarDate,
    prescribedCompleted: r.prescribedCompleted,
    dailyFlowComplete: r.dailyFlowComplete,
  })));

  const progress = await client.query(
    `SELECT m.title, ump.status, ump."completedAt"
     FROM "UserMissionProgress" ump
     JOIN "Mission" m ON m.id = ump."missionId"
     WHERE ump."userId" = $1 AND ump."completedAt" IS NOT NULL
     ORDER BY ump."completedAt" DESC LIMIT 10`,
    [userId],
  );
  console.log('\nRecent completed missions:');
  console.table(progress.rows);
}

await client.end();
