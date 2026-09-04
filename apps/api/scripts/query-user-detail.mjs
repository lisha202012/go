import pg from 'pg';

const username = process.argv[2] ?? 'LincysStyle';
const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:51214/gofam_grow?sslmode=disable',
});

await client.connect();
const user = await client.query(
  `SELECT id, username, "onboardingCompleted", "journeyModelVersion", "gofamWeekStartDay"
   FROM "User" WHERE username = $1`,
  [username],
);
console.log('User:', user.rows[0] ?? '(not found)');

if (user.rows[0]) {
  const gap = await client.query(
    `SELECT id, "completedAt", "dayRankings" FROM "GapAssessment" WHERE "userId" = $1`,
    [user.rows[0].id],
  );
  console.log('GAP:', gap.rows[0] ?? 'none');

  const progress = await client.query(
    `SELECT m.title, ump.status, ump."startedAt", ump."completedAt"
     FROM "UserMissionProgress" ump
     JOIN "Mission" m ON m.id = ump."missionId"
     WHERE ump."userId" = $1
     ORDER BY ump."completedAt" NULLS LAST, m."orderInHill"`,
    [user.rows[0].id],
  );
  console.table(progress.rows);
}

await client.end();
