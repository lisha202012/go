-- Add missing user geo name columns used by the live country/state/city API flow

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "countryName" TEXT;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "stateName" TEXT;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "cityName" TEXT;
