import pg from 'pg';

const url =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:51214/gofam_grow?sslmode=disable';

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const r = await client.query('SELECT COUNT(*)::int AS n FROM "User"');
  console.log('DB OK users=', r.rows[0].n);
} catch (err) {
  console.error('DB FAIL', err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
