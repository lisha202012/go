import pg from 'pg';

const username = process.argv[2] ?? process.env.GOFAM_USERNAME ?? 'lisha12';
const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:51214/gofam_grow?sslmode=disable',
});

await client.connect();
const result = await client.query(
  `SELECT id, username, "journeyModelVersion", "gofamWeekStartDay"
   FROM "User"
   WHERE username = $1`,
  [username],
);
console.log(`username = '${username}'`);
if (result.rowCount === 0) {
  console.log('(no rows)');
} else {
  console.table(result.rows);
}
await client.end();
