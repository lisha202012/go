-- Rebuild GAP assessment to fixed 35-question instrument

-- Clear dependent rows (dev-safe reset)
DELETE FROM "GapHillScore";
DELETE FROM "GapAssessment";

-- Remove session-based flow
DROP TABLE IF EXISTS "GapSession";

-- Replace question bank
DROP TABLE IF EXISTS "GapQuestion";

CREATE TABLE "GapQuestion" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "hillId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isReverseScored" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GapQuestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GapQuestion_order_key" ON "GapQuestion"("order");

ALTER TABLE "GapQuestion" ADD CONSTRAINT "GapQuestion_hillId_fkey" FOREIGN KEY ("hillId") REFERENCES "Hill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- GapAssessment: rename/replace columns
ALTER TABLE "GapAssessment" DROP CONSTRAINT IF EXISTS "GapAssessment_growthHillId_fkey";

ALTER TABLE "GapAssessment" DROP COLUMN IF EXISTS "category";
ALTER TABLE "GapAssessment" DROP COLUMN IF EXISTS "flowStatus";
ALTER TABLE "GapAssessment" DROP COLUMN IF EXISTS "servedQuestionIds";
ALTER TABLE "GapAssessment" DROP COLUMN IF EXISTS "responsesSnapshot";
ALTER TABLE "GapAssessment" DROP COLUMN IF EXISTS "assessmentCycle";

ALTER TABLE "GapAssessment" RENAME COLUMN "flowIndexResult" TO "flowIndex";
ALTER TABLE "GapAssessment" RENAME COLUMN "growthHillId" TO "focusHillId";

ALTER TABLE "GapAssessment" ADD COLUMN IF NOT EXISTS "isOfficial" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GapAssessment" ADD COLUMN IF NOT EXISTS "nextRecalibrationAt" TIMESTAMP(3);

UPDATE "GapAssessment" SET "nextRecalibrationAt" = "completedAt" + INTERVAL '90 days' WHERE "nextRecalibrationAt" IS NULL;
ALTER TABLE "GapAssessment" ALTER COLUMN "nextRecalibrationAt" SET NOT NULL;

ALTER TABLE "GapAssessment" ALTER COLUMN "totalRawScore" SET NOT NULL;

DROP INDEX IF EXISTS "GapAssessment_growthHillId_idx";
CREATE INDEX "GapAssessment_focusHillId_idx" ON "GapAssessment"("focusHillId");

ALTER TABLE "GapAssessment" ADD CONSTRAINT "GapAssessment_focusHillId_fkey" FOREIGN KEY ("focusHillId") REFERENCES "Hill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- GapHillScore: flowPercent replaces score
ALTER TABLE "GapHillScore" RENAME COLUMN "score" TO "flowPercent";
ALTER TABLE "GapHillScore" ALTER COLUMN "rawScore" SET NOT NULL;

-- Per-response storage
CREATE TABLE "GapResponse" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "rawAnswer" INTEGER NOT NULL,
    "scoredValue" INTEGER NOT NULL,

    CONSTRAINT "GapResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GapResponse_assessmentId_idx" ON "GapResponse"("assessmentId");
CREATE UNIQUE INDEX "GapResponse_assessmentId_questionId_key" ON "GapResponse"("assessmentId", "questionId");

ALTER TABLE "GapResponse" ADD CONSTRAINT "GapResponse_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "GapAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GapResponse" ADD CONSTRAINT "GapResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "GapQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
