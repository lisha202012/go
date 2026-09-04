-- GAP question bank: 15 questions per hill per age category; app serves 5 per hill.

DELETE FROM "GapResponse";
DELETE FROM "GapQuestion";

ALTER TABLE "GapQuestion" ADD COLUMN IF NOT EXISTS "categoryCode" TEXT;

DROP INDEX IF EXISTS "GapQuestion_order_key";

ALTER TABLE "GapQuestion" ALTER COLUMN "categoryCode" SET NOT NULL;

CREATE UNIQUE INDEX "GapQuestion_categoryCode_hillId_order_key"
  ON "GapQuestion"("categoryCode", "hillId", "order");

CREATE INDEX "GapQuestion_categoryCode_idx" ON "GapQuestion"("categoryCode");
