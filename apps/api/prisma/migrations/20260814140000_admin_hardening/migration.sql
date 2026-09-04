-- Admin console hardening: password reset gate, account suspend, mission disable, MFA sessions
ALTER TABLE "User" ADD COLUMN "adminPasswordMustReset" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "accountStatus" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "User" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "suspendedReason" TEXT;

ALTER TABLE "Mission" ADD COLUMN "isDisabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Mission" ADD COLUMN "disabledAt" TIMESTAMP(3);
ALTER TABLE "Mission" ADD COLUMN "disabledReason" TEXT;

ALTER TABLE "RefreshToken" ADD COLUMN "adminConsoleSession" BOOLEAN NOT NULL DEFAULT false;
