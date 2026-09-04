-- AlterTable
ALTER TABLE "User" ADD COLUMN "familyOnboardingComplete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "familySetupDeferred" BOOLEAN NOT NULL DEFAULT false;

-- Existing users who already have a family or finished onboarding should not be sent back to the family step.
UPDATE "User" SET "familyOnboardingComplete" = true WHERE "familyId" IS NOT NULL;
UPDATE "User" SET "familyOnboardingComplete" = true WHERE "onboardingCompleted" = true AND "familyId" IS NULL;
