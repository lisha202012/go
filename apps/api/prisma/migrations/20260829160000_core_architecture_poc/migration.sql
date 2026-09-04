-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('member', 'official_coach');
CREATE TYPE "JourneyRole" AS ENUM ('self_growth', 'next_generation_guidance', 'both');
CREATE TYPE "OrganizationStatus" AS ENUM ('listed', 'community_interest', 'gofam_verified');
CREATE TYPE "OrganizationMembershipStatus" AS ENUM ('unverified', 'pending', 'verified');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "displayName" TEXT;
ALTER TABLE "User" ADD COLUMN "guardianSupported" BOOLEAN;
ALTER TABLE "User" ADD COLUMN "guardianUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "journeyRole" "JourneyRole";
ALTER TABLE "User" ADD COLUMN "accountType" "AccountType" NOT NULL DEFAULT 'member';
ALTER TABLE "User" ADD COLUMN "officialAccount" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "autoConnectNewUsers" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "welcomeGlowSeedEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "monthlyGlowSeedEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "autoBloomReceivedSeed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "qualifyingReceivedSeedLimit" INTEGER;
ALTER TABLE "User" ADD COLUMN "countryId" TEXT;
ALTER TABLE "User" ADD COLUMN "stateId" TEXT;
ALTER TABLE "User" ADD COLUMN "cityId" TEXT;
ALTER TABLE "User" ADD COLUMN "locationUpdatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "locationSetupDeferred" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "flowLeadershipScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "flowLeadershipInternal" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "coachBalaMonthlyDueDay" INTEGER;
ALTER TABLE "User" ADD COLUMN "coachBalaWelcomeSentAt" TIMESTAMP(3);

-- AlterTable GlowSeed
ALTER TABLE "GlowSeed" ADD COLUMN "isSystemSeed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GlowSeed" ADD COLUMN "seedKind" TEXT;

-- CreateTable GeoCountry
CREATE TABLE "GeoCountry" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "GeoCountry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeoState" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "GeoState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeoCity" (
    "id" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "GeoCity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'school',
    "status" "OrganizationStatus" NOT NULL DEFAULT 'listed',
    "orgGroupId" TEXT,
    "cityId" TEXT,
    "interestCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "OrganizationMembershipStatus" NOT NULL DEFAULT 'unverified',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "organizationName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationInterest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoachBalaQualifyingGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "seedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachBalaQualifyingGrant_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "GeoCountry_code_key" ON "GeoCountry"("code");
CREATE UNIQUE INDEX "GeoState_countryId_name_key" ON "GeoState"("countryId", "name");
CREATE UNIQUE INDEX "GeoCity_stateId_name_key" ON "GeoCity"("stateId", "name");
CREATE INDEX "GeoState_countryId_idx" ON "GeoState"("countryId");
CREATE INDEX "GeoCity_stateId_idx" ON "GeoCity"("stateId");
CREATE INDEX "Organization_cityId_idx" ON "Organization"("cityId");
CREATE INDEX "Organization_status_idx" ON "Organization"("status");
CREATE INDEX "Organization_name_idx" ON "Organization"("name");
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");
CREATE INDEX "OrganizationMembership_organizationId_status_idx" ON "OrganizationMembership"("organizationId", "status");
CREATE UNIQUE INDEX "OrganizationInterest_userId_organizationId_key" ON "OrganizationInterest"("userId", "organizationId");
CREATE INDEX "OrganizationInterest_organizationId_idx" ON "OrganizationInterest"("organizationId");
CREATE UNIQUE INDEX "CoachBalaQualifyingGrant_seedId_key" ON "CoachBalaQualifyingGrant"("seedId");
CREATE UNIQUE INDEX "CoachBalaQualifyingGrant_userId_monthKey_key" ON "CoachBalaQualifyingGrant"("userId", "monthKey");
CREATE INDEX "CoachBalaQualifyingGrant_userId_idx" ON "CoachBalaQualifyingGrant"("userId");
CREATE INDEX "User_countryId_idx" ON "User"("countryId");
CREATE INDEX "User_stateId_idx" ON "User"("stateId");
CREATE INDEX "User_cityId_idx" ON "User"("cityId");
CREATE INDEX "User_ageGroup_flowLeadershipInternal_idx" ON "User"("ageGroup", "flowLeadershipInternal");
CREATE INDEX "User_cityId_ageGroup_flowLeadershipInternal_idx" ON "User"("cityId", "ageGroup", "flowLeadershipInternal");

-- Foreign keys
ALTER TABLE "User" ADD CONSTRAINT "User_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "GeoCountry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "GeoState"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "GeoCity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GeoState" ADD CONSTRAINT "GeoState_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "GeoCountry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeoCity" ADD CONSTRAINT "GeoCity_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "GeoState"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_orgGroupId_fkey" FOREIGN KEY ("orgGroupId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "GeoCity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationInterest" ADD CONSTRAINT "OrganizationInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationInterest" ADD CONSTRAINT "OrganizationInterest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachBalaQualifyingGrant" ADD CONSTRAINT "CoachBalaQualifyingGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
