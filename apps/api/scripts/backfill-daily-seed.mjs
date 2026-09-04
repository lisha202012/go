/**
 * One-time backfill: award +1 Glow Seed for daily 3/3 completed before seed rewards shipped.
 * Usage: node scripts/backfill-daily-seed.mjs <username> <dayAssignmentId>
 */
import pg from 'pg';

const username = process.argv[2];
const dayAssignmentId = process.argv[3];

if (!username || !dayAssignmentId) {
  console.error('Usage: node scripts/backfill-daily-seed.mjs <username> <dayAssignmentId>');
  process.exit(1);
}

const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:51214/gofam_grow?sslmode=disable',
});

const referenceId = `flow_daily_seed:${dayAssignmentId}`;

await client.connect();

try {
  await client.query('BEGIN');

  const user = await client.query(`SELECT id FROM "User" WHERE username = $1`, [username]);
  if (!user.rows[0]) throw new Error(`User ${username} not found`);
  const userId = user.rows[0].id;

  const existing = await client.query(
    `SELECT id FROM "CoinLedgerEntry" WHERE "userId" = $1 AND "referenceId" = $2`,
    [userId, referenceId],
  );
  if (existing.rowCount > 0) {
    console.log('Seed already awarded for this day — skipping.');
    await client.query('ROLLBACK');
    process.exit(0);
  }

  await client.query(
    `INSERT INTO "CoinLedgerEntry" ("id", "userId", amount, "ledgerType", source, "referenceId", "createdAt")
     VALUES (gen_random_uuid()::text, $1, 0, 'personal_growth', 'flow_week', $2, NOW())`,
    [userId, referenceId],
  );

  const updated = await client.query(
    `UPDATE "User" SET "seedInventoryCount" = "seedInventoryCount" + 1 WHERE id = $1
     RETURNING "seedInventoryCount"`,
    [userId],
  );

  await client.query('COMMIT');
  console.log(`Awarded +1 Glow Seed to ${username}. New count: ${updated.rows[0].seedInventoryCount}`);
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  await client.end();
}
