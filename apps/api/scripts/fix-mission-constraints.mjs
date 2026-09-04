import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conrelid = '"Mission"'::regclass;
`);

console.log('Mission constraints:');
for (const row of rows) {
  console.log(`- ${row.conname}: ${row.def}`);
}

const stale = rows.filter(
  (r) => r.def.includes('hillId') && r.def.includes('order') && !r.def.includes('categoryCode'),
);

for (const row of stale) {
  console.log(`Dropping stale constraint: ${row.conname}`);
  await client.query(`ALTER TABLE "Mission" DROP CONSTRAINT IF EXISTS "${row.conname}"`);
}

await client.end();
