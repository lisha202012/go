/**
 * Delete a user by username (cascades related rows). Run from apps/api:
 *   node scripts/delete-user.mjs [username]
 */
import 'dotenv/config';
import pg from 'pg';

const username = process.argv[2] ?? 'lisha12';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

try {
  const found = await client.query('SELECT id, username FROM "User" WHERE username = $1', [
    username,
  ]);

  if (found.rowCount === 0) {
    console.log(`User "${username}" not found — nothing to delete.`);
  } else {
    const userId = found.rows[0].id;
    await client.query('DELETE FROM "User" WHERE id = $1', [userId]);
    console.log(`Deleted user "${username}".`);
  }

  const orphanFamilies = await client.query(`
    DELETE FROM "Family" f
    WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."familyId" = f.id)
  `);
  if (orphanFamilies.rowCount > 0) {
    console.log(`Removed ${orphanFamilies.rowCount} orphan family record(s).`);
  }
} finally {
  await client.end();
}
