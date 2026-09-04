-- Align camp checkpoints with hill climb spec (1 Step = 3 missions on a hill).
UPDATE "Camp" SET "name" = 'Base Camp', "stepThreshold" = 1 WHERE "number" = 1;
UPDATE "Camp" SET "name" = 'Camp 2', "stepThreshold" = 3 WHERE "number" = 2;
UPDATE "Camp" SET "name" = 'Camp 3', "stepThreshold" = 7 WHERE "number" = 3;
UPDATE "Camp" SET "name" = 'Camp 4', "stepThreshold" = 14 WHERE "number" = 4;
UPDATE "Camp" SET "name" = 'Camp 5', "stepThreshold" = 21 WHERE "number" = 5;
UPDATE "Camp" SET "name" = 'Camp 6', "stepThreshold" = 35 WHERE "number" = 6;
UPDATE "Camp" SET "name" = 'Summit', "stepThreshold" = 49 WHERE "number" = 7;

-- Backfill GrowthSet rows from pre-tracking completed missions (3/3 on a hill = 1 step).
-- Idempotent: only inserts missing steps; never deletes existing GrowthSet rows.

WITH ranked AS (
  SELECT
    ump."userId" AS user_id,
    m."hillId" AS hill_id,
    ump."completedAt" AS completed_at,
    ROW_NUMBER() OVER (
      PARTITION BY ump."userId", m."hillId"
      ORDER BY ump."completedAt" ASC NULLS LAST
    ) AS rn
  FROM "UserMissionProgress" ump
  INNER JOIN "Mission" m ON m.id = ump."missionId"
  WHERE ump.status = 'completed'
    AND ump."completedAt" IS NOT NULL
),
step_completions AS (
  SELECT
    user_id,
    hill_id,
    (rn / 3)::int AS step_num,
    completed_at
  FROM ranked
  WHERE rn % 3 = 0
),
expected AS (
  SELECT user_id, hill_id, MAX(step_num)::int AS step_count
  FROM step_completions
  GROUP BY user_id, hill_id
),
existing AS (
  SELECT "userId" AS user_id, "hillId" AS hill_id, COUNT(*)::int AS cnt
  FROM "GrowthSet"
  GROUP BY "userId", "hillId"
),
to_insert AS (
  SELECT
    e.user_id,
    e.hill_id,
    gs.n AS step_num,
    sc.completed_at
  FROM expected e
  LEFT JOIN existing x
    ON x.user_id = e.user_id AND x.hill_id = e.hill_id
  CROSS JOIN LATERAL generate_series(COALESCE(x.cnt, 0) + 1, e.step_count) AS gs(n)
  INNER JOIN step_completions sc
    ON sc.user_id = e.user_id
    AND sc.hill_id = e.hill_id
    AND sc.step_num = gs.n
  WHERE e.step_count > COALESCE(x.cnt, 0)
)
INSERT INTO "GrowthSet" ("id", "userId", "hillId", "completedAt")
SELECT
  'gs' || substr(md5(t.user_id || t.hill_id || t.step_num::text), 1, 23),
  t.user_id,
  t.hill_id,
  t.completed_at
FROM to_insert t
ON CONFLICT ("id") DO NOTHING;

-- Sync focus-hill currentStep + permanent camp from backfilled GrowthSet counts.
WITH focus_steps AS (
  SELECT
    ga."userId" AS user_id,
    COUNT(gs.id)::int AS steps
  FROM "GapAssessment" ga
  LEFT JOIN "GrowthSet" gs
    ON gs."userId" = ga."userId"
    AND gs."hillId" = ga."focusHillId"
  GROUP BY ga."userId"
),
camp_match AS (
  SELECT
    fs.user_id,
    LEAST(fs.steps, 49) AS steps,
    (
      SELECT c.id
      FROM "Camp" c
      WHERE c."stepThreshold" <= LEAST(fs.steps, 49)
      ORDER BY c."stepThreshold" DESC
      LIMIT 1
    ) AS camp_id
  FROM focus_steps fs
  WHERE fs.steps > 0
)
UPDATE "User" u
SET
  "currentStep" = cm.steps,
  "currentCampId" = cm.camp_id
FROM camp_match cm
WHERE u.id = cm.user_id;
