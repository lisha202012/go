-- CreateTable
CREATE TABLE "MissionSurfacing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "surfacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,

    CONSTRAINT "MissionSurfacing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionSwap" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hillId" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "cycleKey" TEXT NOT NULL,
    "originalMissionId" TEXT NOT NULL,
    "replacementMissionId" TEXT NOT NULL,
    "swapCount" INTEGER NOT NULL,
    "swappedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionSwap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MissionSurfacing_userId_missionId_idx" ON "MissionSurfacing"("userId", "missionId");

-- CreateIndex
CREATE INDEX "MissionSurfacing_userId_surfacedAt_idx" ON "MissionSurfacing"("userId", "surfacedAt");

-- CreateIndex
CREATE INDEX "MissionSwap_userId_cycleKey_idx" ON "MissionSwap"("userId", "cycleKey");

-- CreateIndex
CREATE INDEX "MissionSwap_userId_swappedAt_idx" ON "MissionSwap"("userId", "swappedAt");

-- AddForeignKey
ALTER TABLE "MissionSurfacing" ADD CONSTRAINT "MissionSurfacing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionSurfacing" ADD CONSTRAINT "MissionSurfacing_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionSwap" ADD CONSTRAINT "MissionSwap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionSwap" ADD CONSTRAINT "MissionSwap_originalMissionId_fkey" FOREIGN KEY ("originalMissionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionSwap" ADD CONSTRAINT "MissionSwap_replacementMissionId_fkey" FOREIGN KEY ("replacementMissionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
