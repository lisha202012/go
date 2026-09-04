import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://postgres:postgres@127.0.0.1:51214/gofam_grow?sslmode=disable',
});

await client.connect();

const [configRows, missionRow] = await Promise.all([
  client.query(`SELECT key, value FROM "AdminConfig" WHERE key IN ('mission_coin_amounts', 'growth_set_bonus')`),
  client.query(`SELECT "coinReward" FROM "Mission" WHERE "categoryCode" = 'V6' LIMIT 1`),
]);

console.log(
  JSON.stringify(
    {
      adminConfig: Object.fromEntries(configRows.rows.map((r) => [r.key, r.value])),
      sampleMissionCoinReward: missionRow.rows[0]?.coinReward,
      uiShouldShow: {
        perMission: '+5 coins',
      },
    },
    null,
    2,
  ),
);

await client.end();
