-- AlterTable
ALTER TABLE "UserMissionProgress" ADD COLUMN "completionCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill: missions already marked completed count as 1
UPDATE "UserMissionProgress"
SET "completionCount" = 1
WHERE "status" = 'completed' AND "completionCount" = 0;

-- CreateTable
CREATE TABLE "MissionCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "hillId" TEXT NOT NULL,
    "dayAssignmentId" TEXT,
    "calendarDate" TIMESTAMP(3) NOT NULL,
    "coinsAwarded" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MissionCompletion_userId_missionId_idx" ON "MissionCompletion"("userId", "missionId");

-- CreateIndex
CREATE INDEX "MissionCompletion_userId_calendarDate_idx" ON "MissionCompletion"("userId", "calendarDate");

-- CreateIndex
CREATE INDEX "MissionCompletion_userId_dayAssignmentId_idx" ON "MissionCompletion"("userId", "dayAssignmentId");

-- CreateIndex
CREATE INDEX "MissionCompletion_userId_hillId_idx" ON "MissionCompletion"("userId", "hillId");

-- AddForeignKey
ALTER TABLE "MissionCompletion" ADD CONSTRAINT "MissionCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionCompletion" ADD CONSTRAINT "MissionCompletion_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionCompletion" ADD CONSTRAINT "MissionCompletion_hillId_fkey" FOREIGN KEY ("hillId") REFERENCES "Hill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
