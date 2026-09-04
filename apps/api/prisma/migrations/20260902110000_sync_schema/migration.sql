-- AlterEnum
BEGIN;
CREATE TYPE "TreeLevel_new" AS ENUM ('Seedling', 'Sprouting', 'YoungTree', 'Flourishing', 'Blossoming', 'Fruiting', 'Ancient', 'Radiant', 'Sacred', 'TreeOfFlow');
ALTER TABLE "User" ALTER COLUMN "treeLevel" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "treeLevel" TYPE "TreeLevel_new" USING ("treeLevel"::text::"TreeLevel_new");
ALTER TYPE "TreeLevel" RENAME TO "TreeLevel_old";
ALTER TYPE "TreeLevel_new" RENAME TO "TreeLevel";
DROP TYPE "TreeLevel_old";
ALTER TABLE "User" ALTER COLUMN "treeLevel" SET DEFAULT 'Seedling';
COMMIT;

-- DropIndex
DROP INDEX "Mission_hillId_idx";

DROP INDEX "SchoolRegistrationLinkClaim_linkId_idx";

-- AlterTable
ALTER TABLE "FamilyMember" ADD COLUMN "dateOfBirth" TIMESTAMP(3);

ALTER TABLE "Mission"
  ALTER COLUMN "categoryCode" DROP DEFAULT,
  ALTER COLUMN "missionGroup" DROP DEFAULT;

ALTER TABLE "Organization"
  DROP COLUMN "registrationLinks",
  ADD COLUMN "cityName" TEXT,
  ADD COLUMN "countryName" TEXT,
  ADD COLUMN "stateName" TEXT;

ALTER TABLE "User" ADD COLUMN "standard" TEXT;

-- CreateTable
CREATE TABLE "TreeStarGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreeStarGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TreeStarGrant_userId_idx"
ON "TreeStarGrant"("userId");

CREATE UNIQUE INDEX "TreeStarGrant_userId_source_sourceKey_key"
ON "TreeStarGrant"("userId", "source", "sourceKey");

CREATE UNIQUE INDEX IF NOT EXISTS "Mission_externalId_key"
ON "Mission"("externalId");

CREATE INDEX IF NOT EXISTS "RefreshToken_userId_revokedAt_idx"
ON "RefreshToken"("userId", "revokedAt");

ALTER TABLE "TreeStarGrant"
ADD CONSTRAINT "TreeStarGrant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;