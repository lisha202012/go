-- CreateEnum
CREATE TYPE "GapCategory" AS ENUM ('S1E', 'S1G', 'S1R', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7');

-- CreateEnum
CREATE TYPE "GapAnswer" AS ENUM ('always', 'often', 'sometimes', 'rarely', 'never');

-- AlterTable
ALTER TABLE "GapAssessment" ADD COLUMN     "category" "GapCategory" NOT NULL DEFAULT 'N7',
ADD COLUMN     "flowStatus" TEXT,
ADD COLUMN     "totalRawScore" INTEGER,
ADD COLUMN     "servedQuestionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "responsesSnapshot" JSONB,
ADD COLUMN     "assessmentCycle" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "GapHillScore" ADD COLUMN     "rawScore" INTEGER;

-- CreateTable
CREATE TABLE "GapQuestion" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "GapCategory" NOT NULL,
    "hillCode" "HillCode" NOT NULL,
    "text" TEXT NOT NULL,
    "isReverse" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    CONSTRAINT "GapQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GapSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "GapCategory" NOT NULL DEFAULT 'N7',
    "servedQuestionIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GapSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GapQuestion_category_hillCode_idx" ON "GapQuestion"("category", "hillCode");

-- CreateIndex
CREATE UNIQUE INDEX "GapQuestion_category_code_key" ON "GapQuestion"("category", "code");

-- CreateIndex
CREATE UNIQUE INDEX "GapSession_userId_key" ON "GapSession"("userId");

-- AddForeignKey
ALTER TABLE "GapSession" ADD CONSTRAINT "GapSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
