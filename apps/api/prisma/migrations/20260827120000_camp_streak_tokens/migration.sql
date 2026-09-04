-- CreateTable
CREATE TABLE "CampStreakToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "usedForDayAssignmentId" TEXT,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "CampStreakToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampStreakToken_userId_campNumber_key" ON "CampStreakToken"("userId", "campNumber");

-- CreateIndex
CREATE INDEX "CampStreakToken_userId_status_idx" ON "CampStreakToken"("userId", "status");

-- AddForeignKey
ALTER TABLE "CampStreakToken" ADD CONSTRAINT "CampStreakToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
