-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "GapAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flowIndexResult" INTEGER NOT NULL,
    "strongestHillId" TEXT NOT NULL,
    "growthHillId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GapAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GapHillScore" (
    "id" TEXT NOT NULL,
    "gapAssessmentId" TEXT NOT NULL,
    "hillId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "GapHillScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GapAssessment_userId_key" ON "GapAssessment"("userId");

-- CreateIndex
CREATE INDEX "GapAssessment_strongestHillId_idx" ON "GapAssessment"("strongestHillId");

-- CreateIndex
CREATE INDEX "GapAssessment_growthHillId_idx" ON "GapAssessment"("growthHillId");

-- CreateIndex
CREATE INDEX "GapHillScore_gapAssessmentId_idx" ON "GapHillScore"("gapAssessmentId");

-- CreateIndex
CREATE INDEX "GapHillScore_hillId_idx" ON "GapHillScore"("hillId");

-- CreateIndex
CREATE UNIQUE INDEX "GapHillScore_gapAssessmentId_hillId_key" ON "GapHillScore"("gapAssessmentId", "hillId");

-- AddForeignKey
ALTER TABLE "GapAssessment" ADD CONSTRAINT "GapAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GapAssessment" ADD CONSTRAINT "GapAssessment_strongestHillId_fkey" FOREIGN KEY ("strongestHillId") REFERENCES "Hill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GapAssessment" ADD CONSTRAINT "GapAssessment_growthHillId_fkey" FOREIGN KEY ("growthHillId") REFERENCES "Hill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GapHillScore" ADD CONSTRAINT "GapHillScore_gapAssessmentId_fkey" FOREIGN KEY ("gapAssessmentId") REFERENCES "GapAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GapHillScore" ADD CONSTRAINT "GapHillScore_hillId_fkey" FOREIGN KEY ("hillId") REFERENCES "Hill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

