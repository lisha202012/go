-- AlterTable
ALTER TABLE "GapAssessment" ADD COLUMN "focusMissionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
