-- Add school registration link support

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "section" TEXT;

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "registrationLinks" TEXT;

CREATE TABLE IF NOT EXISTS "SchoolRegistrationLink" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "standard" TEXT,
  "section" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "usesCount" INTEGER NOT NULL DEFAULT 0,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SchoolRegistrationLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SchoolRegistrationLink_token_key"
  ON "SchoolRegistrationLink"("token");

CREATE INDEX IF NOT EXISTS "SchoolRegistrationLink_organizationId_idx"
  ON "SchoolRegistrationLink"("organizationId");

CREATE TABLE IF NOT EXISTS "SchoolRegistrationLinkClaim" (
  "id" TEXT NOT NULL,
  "linkId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SchoolRegistrationLinkClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SchoolRegistrationLinkClaim_userId_key"
  ON "SchoolRegistrationLinkClaim"("userId");

CREATE INDEX IF NOT EXISTS "SchoolRegistrationLinkClaim_linkId_idx"
  ON "SchoolRegistrationLinkClaim"("linkId");

ALTER TABLE "SchoolRegistrationLink"
  ADD CONSTRAINT "SchoolRegistrationLink_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchoolRegistrationLinkClaim"
  ADD CONSTRAINT "SchoolRegistrationLinkClaim_linkId_fkey"
  FOREIGN KEY ("linkId") REFERENCES "SchoolRegistrationLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchoolRegistrationLinkClaim"
  ADD CONSTRAINT "SchoolRegistrationLinkClaim_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;