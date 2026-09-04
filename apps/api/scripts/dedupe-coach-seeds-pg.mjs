import pg from 'pg';

const url =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:51214/gofam_grow?sslmode=disable';

const client = new pg.Client({ connectionString: url });
await client.connect();

const dupes = await client.query(`
  DELETE FROM "GlowSeed" g
  USING (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY "receiverId", "seedKind"
        ORDER BY "sentAt" ASC
      ) AS rn
    FROM "GlowSeed"
    WHERE status = 'pending'
      AND "seedKind" IN ('welcome_coach', 'monthly_coach')
  ) d
  WHERE g.id = d.id AND d.rn > 1
  RETURNING g.id, g."seedKind"
`);
console.log('Removed duplicate pending seeds:', dupes.rowCount);

const monthlyWhileWelcome = await client.query(`
  DELETE FROM "GlowSeed" m
  USING "GlowSeed" w
  WHERE m."receiverId" = w."receiverId"
    AND m.status = 'pending'
    AND w.status = 'pending'
    AND m."seedKind" = 'monthly_coach'
    AND w."seedKind" = 'welcome_coach'
  RETURNING m.id
`);
console.log('Removed monthly while welcome pending:', monthlyWhileWelcome.rowCount);

await client.end();
