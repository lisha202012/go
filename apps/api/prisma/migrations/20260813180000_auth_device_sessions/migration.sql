-- Per-device sessions (Section 53): metadata on refresh tokens for Active Sessions UI.

ALTER TABLE "RefreshToken" ADD COLUMN "jti" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "deviceName" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "locationLabel" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "RefreshToken" SET "deviceName" = 'Web browser' WHERE "deviceName" IS NULL;
UPDATE "RefreshToken" SET "locationLabel" = 'Unknown location' WHERE "locationLabel" IS NULL;

CREATE UNIQUE INDEX "RefreshToken_jti_key" ON "RefreshToken"("jti");
