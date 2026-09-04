-- Mission engine Section 3: category-scoped pools (15/hill) with internal groups (5×3).

ALTER TABLE "Mission" ADD COLUMN "categoryCode" TEXT NOT NULL DEFAULT 'V6';
ALTER TABLE "Mission" ADD COLUMN "missionGroup" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Mission" ADD COLUMN "externalId" TEXT;

UPDATE "Mission"
SET "missionGroup" = LEAST(5, CEIL("order"::float / 3)::int)
WHERE "missionGroup" = 1;

ALTER TABLE "Mission" DROP CONSTRAINT IF EXISTS "Mission_hillId_order_key";

ALTER TABLE "Mission"
  ADD CONSTRAINT "Mission_hillId_categoryCode_order_key"
  UNIQUE ("hillId", "categoryCode", "order");

CREATE UNIQUE INDEX "Mission_externalId_key" ON "Mission"("externalId") WHERE "externalId" IS NOT NULL;

CREATE INDEX "Mission_hillId_categoryCode_idx" ON "Mission"("hillId", "categoryCode");
