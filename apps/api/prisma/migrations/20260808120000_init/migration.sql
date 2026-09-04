-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "TreeLevel" AS ENUM ('Seed', 'Sprout', 'Sapling', 'YoungTree', 'FlourishingTree', 'BlossomingTree');

-- CreateEnum
CREATE TYPE "HillCode" AS ENUM ('HOPE', 'HONE', 'HOLD', 'HOOD', 'HOST', 'HORN', 'HOOK');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('locked', 'current', 'completed');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('personal_growth', 'promotional');

-- CreateEnum
CREATE TYPE "LedgerSource" AS ENUM ('mission', 'reflection', 'evidence', 'growth_set', 'flow_week', 'camp', 'family_mission', 'welcome_bonus', 'admin_grant', 'spend');

-- CreateEnum
CREATE TYPE "GlowSeedStatus" AS ENUM ('pending', 'accepted', 'expired');

-- CreateEnum
CREATE TYPE "Virtue" AS ENUM ('Kindness', 'Responsibility', 'Discipline', 'Integrity', 'HardWork', 'Courage', 'Patience');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('following', 'friends', 'blocked');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'user',
    "ageGroup" TEXT,
    "isChildProfile" BOOLEAN NOT NULL DEFAULT false,
    "familyId" TEXT,
    "walletCoins" INTEGER NOT NULL DEFAULT 0,
    "growthCoinsLifetime" INTEGER NOT NULL DEFAULT 0,
    "flowIndex" INTEGER NOT NULL DEFAULT 0,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "currentCampId" TEXT,
    "treeLevel" "TreeLevel" NOT NULL DEFAULT 'Seed',
    "seedInventoryCount" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hill" (
    "id" TEXT NOT NULL,
    "code" "HillCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "virtueName" TEXT NOT NULL,
    "colorTheme" TEXT NOT NULL,

    CONSTRAINT "Hill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "hillId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "coinReward" INTEGER NOT NULL,
    "pulseReward" INTEGER NOT NULL DEFAULT 0,
    "requiresReflection" BOOLEAN NOT NULL DEFAULT false,
    "requiresEvidence" BOOLEAN NOT NULL DEFAULT false,
    "isFamilyMission" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMissionProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "status" "MissionStatus" NOT NULL DEFAULT 'locked',
    "completedAt" TIMESTAMP(3),
    "reflectionText" TEXT,
    "evidenceUrl" TEXT,

    CONSTRAINT "UserMissionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hillId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrowthSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Camp" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "stepThreshold" INTEGER NOT NULL,
    "coinReward" INTEGER NOT NULL,

    CONSTRAINT "Camp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "ledgerType" "LedgerType" NOT NULL,
    "source" "LedgerSource" NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlowSeed" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" "GlowSeedStatus" NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "virtue" "Virtue",
    "bloomedAt" TIMESTAMP(3),

    CONSTRAINT "GlowSeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveVirtue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "virtue" "Virtue" NOT NULL,
    "hillId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sourceSeedId" TEXT NOT NULL,

    CONSTRAINT "ActiveVirtue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'following',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "renewsAt" TIMESTAMP(3),

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,

    CONSTRAINT "AdminConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_familyId_idx" ON "User"("familyId");

-- CreateIndex
CREATE INDEX "User_currentCampId_idx" ON "User"("currentCampId");

-- CreateIndex
CREATE UNIQUE INDEX "Hill_code_key" ON "Hill"("code");

-- CreateIndex
CREATE INDEX "Mission_hillId_idx" ON "Mission"("hillId");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_hillId_order_key" ON "Mission"("hillId", "order");

-- CreateIndex
CREATE INDEX "UserMissionProgress_userId_idx" ON "UserMissionProgress"("userId");

-- CreateIndex
CREATE INDEX "UserMissionProgress_missionId_idx" ON "UserMissionProgress"("missionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMissionProgress_userId_missionId_key" ON "UserMissionProgress"("userId", "missionId");

-- CreateIndex
CREATE INDEX "GrowthSet_userId_idx" ON "GrowthSet"("userId");

-- CreateIndex
CREATE INDEX "GrowthSet_hillId_idx" ON "GrowthSet"("hillId");

-- CreateIndex
CREATE UNIQUE INDEX "Camp_number_key" ON "Camp"("number");

-- CreateIndex
CREATE INDEX "CoinLedgerEntry_userId_idx" ON "CoinLedgerEntry"("userId");

-- CreateIndex
CREATE INDEX "CoinLedgerEntry_createdAt_idx" ON "CoinLedgerEntry"("createdAt");

-- CreateIndex
CREATE INDEX "GlowSeed_senderId_idx" ON "GlowSeed"("senderId");

-- CreateIndex
CREATE INDEX "GlowSeed_receiverId_idx" ON "GlowSeed"("receiverId");

-- CreateIndex
CREATE INDEX "GlowSeed_status_expiresAt_idx" ON "GlowSeed"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ActiveVirtue_userId_idx" ON "ActiveVirtue"("userId");

-- CreateIndex
CREATE INDEX "ActiveVirtue_expiresAt_idx" ON "ActiveVirtue"("expiresAt");

-- CreateIndex
CREATE INDEX "Friendship_userAId_idx" ON "Friendship"("userAId");

-- CreateIndex
CREATE INDEX "Friendship_userBId_idx" ON "Friendship"("userBId");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_userAId_userBId_key" ON "Friendship"("userAId", "userBId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminConfig_key_key" ON "AdminConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_currentCampId_fkey" FOREIGN KEY ("currentCampId") REFERENCES "Camp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_hillId_fkey" FOREIGN KEY ("hillId") REFERENCES "Hill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMissionProgress" ADD CONSTRAINT "UserMissionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMissionProgress" ADD CONSTRAINT "UserMissionProgress_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthSet" ADD CONSTRAINT "GrowthSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthSet" ADD CONSTRAINT "GrowthSet_hillId_fkey" FOREIGN KEY ("hillId") REFERENCES "Hill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinLedgerEntry" ADD CONSTRAINT "CoinLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlowSeed" ADD CONSTRAINT "GlowSeed_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlowSeed" ADD CONSTRAINT "GlowSeed_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveVirtue" ADD CONSTRAINT "ActiveVirtue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveVirtue" ADD CONSTRAINT "ActiveVirtue_hillId_fkey" FOREIGN KEY ("hillId") REFERENCES "Hill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveVirtue" ADD CONSTRAINT "ActiveVirtue_sourceSeedId_fkey" FOREIGN KEY ("sourceSeedId") REFERENCES "GlowSeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

