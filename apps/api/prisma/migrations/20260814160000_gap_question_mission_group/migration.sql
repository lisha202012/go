-- Add missionGroup to GAP questions (1–5 maps to mission internal groups).

ALTER TABLE "GapQuestion" ADD COLUMN IF NOT EXISTS "missionGroup" INTEGER;

UPDATE "GapQuestion" SET "missionGroup" = "order" WHERE "missionGroup" IS NULL;

ALTER TABLE "GapQuestion" ALTER COLUMN "missionGroup" SET NOT NULL;
