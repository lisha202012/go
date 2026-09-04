-- Glow invite links + harvest rewards foundation

-- CreateEnum
CREATE TYPE "GlowSeedChannel" AS ENUM ('in_app', 'external');

-- AlterTable: external invites may not have a receiver yet
ALTER TABLE "GlowSeed" ALTER COLUMN "receiverId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "GlowSeed" ADD COLUMN "channel" "GlowSeedChannel" NOT NULL DEFAULT 'in_app';
ALTER TABLE "GlowSeed" ADD COLUMN "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GlowSeed_shareToken_key" ON "GlowSeed"("shareToken");

-- AlterEnum
ALTER TYPE "LedgerSource" ADD VALUE IF NOT EXISTS 'harvest_reward';

-- CreateTable
CREATE TABLE "HarvestMilestoneClaim" (
    "id" TEXT NOT NULL,
    "planterId" TEXT NOT NULL,
    "sproutId" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "rewardAmount" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HarvestMilestoneClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HarvestMilestoneClaim_planterId_sproutId_threshold_key" ON "HarvestMilestoneClaim"("planterId", "sproutId", "threshold");

-- CreateIndex
CREATE INDEX "HarvestMilestoneClaim_planterId_idx" ON "HarvestMilestoneClaim"("planterId");

-- CreateIndex
CREATE INDEX "HarvestMilestoneClaim_sproutId_idx" ON "HarvestMilestoneClaim"("sproutId");

-- AddForeignKey
ALTER TABLE "HarvestMilestoneClaim" ADD CONSTRAINT "HarvestMilestoneClaim_planterId_fkey" FOREIGN KEY ("planterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarvestMilestoneClaim" ADD CONSTRAINT "HarvestMilestoneClaim_sproutId_fkey" FOREIGN KEY ("sproutId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
