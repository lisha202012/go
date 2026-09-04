-- Verified Belonging POC: org invite codes, interest notifications, belonging deferral

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "belongingSetupDeferred" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "inviteCode" TEXT;

ALTER TABLE "OrganizationInterest" ADD COLUMN IF NOT EXISTS "verifiedNotifiedAt" TIMESTAMP(3);
