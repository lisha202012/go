import pg from 'pg';

const username = process.argv[2] ?? 'lisha12';
const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:51214/gofam_grow?sslmode=disable',
});

await client.connect();

const user = await client.query(`SELECT id FROM "User" WHERE username = $1`, [username]);
const userId = user.rows[0]?.id;

if (userId) {
  const schedule = await client.query(
    `SELECT id, "personalWeekStart", "isStarterWeek", "perfectWeek"
     FROM "PersonalWeekSchedule" WHERE "userId" = $1 ORDER BY "personalWeekStart" DESC LIMIT 1`,
    [userId],
  );
  console.log('Schedule:', schedule.rows[0]);

  const day2 = await client.query(
    `SELECT pda.id, pda."dayIndex", pda."calendarDate", pda."prescribedMissionIds", pda."prescribedCompleted", pda."dailyFlowComplete", h.code
     FROM "PersonalDayAssignment" pda
     JOIN "Hill" h ON h.id = pda."hillId"
     WHERE pda."scheduleId" = $1 AND pda."dayIndex" = 2`,
    [schedule.rows[0].id],
  );
  console.log('Day 2:', day2.rows[0]);

  console.log('Server now:', new Date().toString());
  console.log('Server TZ offset (min):', new Date().getTimezoneOffset());
}

await client.end();
