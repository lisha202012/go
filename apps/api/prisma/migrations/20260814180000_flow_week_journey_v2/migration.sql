-- FLOW Week journey model v2 (Phase 1 schema)

ALTER TYPE "LedgerSource" ADD VALUE IF NOT EXISTS 'migration_block_conversion';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gofamWeekStartDay" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "journeyModelVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "migratedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "flowLockstepSteps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "legacyStepsByHill" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "legacyPeakSteps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "legacyJourneySnapshot" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "starterWeekActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "starterWeekCompletedAt" TIMESTAMP(3);

ALTER TABLE "GapAssessment" ADD COLUMN IF NOT EXISTS "dayRankings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "GapAssessment" ADD COLUMN IF NOT EXISTS "rankingsEffectiveFrom" TIMESTAMP(3);
ALTER TABLE "GapAssessment" ADD COLUMN IF NOT EXISTS "rankingsLockedUntil" TIMESTAMP(3);
ALTER TABLE "GapAssessment" ADD COLUMN IF NOT EXISTS "supersededById" TEXT;

ALTER TABLE "GrowthSet" ADD COLUMN IF NOT EXISTS "awardBatchId" TEXT;
ALTER TABLE "GrowthSet" ADD COLUMN IF NOT EXISTS "awardSource" TEXT;

CREATE INDEX IF NOT EXISTS "GrowthSet_userId_awardBatchId_idx" ON "GrowthSet"("userId", "awardBatchId");
CREATE INDEX IF NOT EXISTS "GrowthSet_userId_awardSource_idx" ON "GrowthSet"("userId", "awardSource");

CREATE TABLE IF NOT EXISTS "PersonalWeekSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personalWeekStart" TIMESTAMP(3) NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "isStarterWeek" BOOLEAN NOT NULL DEFAULT false,
    "perfectWeek" BOOLEAN NOT NULL DEFAULT false,
    "stepAwardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalWeekSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PersonalDayAssignment" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "calendarDate" TIMESTAMP(3) NOT NULL,
    "hillId" TEXT NOT NULL,
    "prescribedMissionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "prescribedCompleted" INTEGER NOT NULL DEFAULT 0,
    "dailyFlowComplete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PersonalDayAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PersonalWeekSchedule_userId_personalWeekStart_key"
  ON "PersonalWeekSchedule"("userId", "personalWeekStart");
CREATE INDEX IF NOT EXISTS "PersonalWeekSchedule_userId_idx" ON "PersonalWeekSchedule"("userId");
CREATE INDEX IF NOT EXISTS "PersonalWeekSchedule_assessmentId_idx" ON "PersonalWeekSchedule"("assessmentId");

CREATE UNIQUE INDEX IF NOT EXISTS "PersonalDayAssignment_scheduleId_dayIndex_key"
  ON "PersonalDayAssignment"("scheduleId", "dayIndex");
CREATE INDEX IF NOT EXISTS "PersonalDayAssignment_scheduleId_idx" ON "PersonalDayAssignment"("scheduleId");
CREATE INDEX IF NOT EXISTS "PersonalDayAssignment_hillId_idx" ON "PersonalDayAssignment"("hillId");

ALTER TABLE "PersonalWeekSchedule" DROP CONSTRAINT IF EXISTS "PersonalWeekSchedule_userId_fkey";
ALTER TABLE "PersonalWeekSchedule" ADD CONSTRAINT "PersonalWeekSchedule_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PersonalWeekSchedule" DROP CONSTRAINT IF EXISTS "PersonalWeekSchedule_assessmentId_fkey";
ALTER TABLE "PersonalWeekSchedule" ADD CONSTRAINT "PersonalWeekSchedule_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "GapAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PersonalDayAssignment" DROP CONSTRAINT IF EXISTS "PersonalDayAssignment_scheduleId_fkey";
ALTER TABLE "PersonalDayAssignment" ADD CONSTRAINT "PersonalDayAssignment_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "PersonalWeekSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PersonalDayAssignment" DROP CONSTRAINT IF EXISTS "PersonalDayAssignment_hillId_fkey";
ALTER TABLE "PersonalDayAssignment" ADD CONSTRAINT "PersonalDayAssignment_hillId_fkey"
  FOREIGN KEY ("hillId") REFERENCES "Hill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GapAssessment" DROP CONSTRAINT IF EXISTS "GapAssessment_supersededById_fkey";
ALTER TABLE "GapAssessment" ADD CONSTRAINT "GapAssessment_supersededById_fkey"
  FOREIGN KEY ("supersededById") REFERENCES "GapAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "GapAssessment_supersededById_idx" ON "GapAssessment"("supersededById");
