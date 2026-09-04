import pg from 'pg';

const username = process.argv[2] ?? 'lisha12';
const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:51214/gofam_grow?sslmode=disable',
});

await client.connect();

const user = await client.query(
  `SELECT id, username, "seedInventoryCount", "walletCoins", "journeyModelVersion"
   FROM "User" WHERE username ILIKE $1 LIMIT 1`,
  [username],
);
console.log('User:', user.rows[0] ?? '(not found)');

if (user.rows[0]) {
  const userId = user.rows[0].id;

  const seedLedger = await client.query(
    `SELECT "referenceId", amount, "createdAt"
     FROM "CoinLedgerEntry"
     WHERE "userId" = $1 AND "referenceId" LIKE 'flow_%seed%'
     ORDER BY "createdAt" DESC`,
    [userId],
  );
  console.log('Seed ledger entries:', seedLedger.rows);

  const dailyBonus = await client.query(
    `SELECT "referenceId", amount, "createdAt"
     FROM "CoinLedgerEntry"
     WHERE "userId" = $1 AND "referenceId" LIKE 'flow_daily_bonus:%'
     ORDER BY "createdAt" DESC LIMIT 5`,
    [userId],
  );
  console.log('Daily bonus entries:', dailyBonus.rows);

  const days = await client.query(
    `SELECT pda.id, pda."dayIndex", pda."dailyFlowComplete", pda."prescribedCompleted", pda."calendarDate"
     FROM "PersonalDayAssignment" pda
     JOIN "PersonalWeekSchedule" pws ON pws.id = pda."scheduleId"
     WHERE pws."userId" = $1
     ORDER BY pda."calendarDate" DESC
     LIMIT 7`,
    [userId],
  );
  console.log('Recent FLOW days:', days.rows);
}

await client.end();
