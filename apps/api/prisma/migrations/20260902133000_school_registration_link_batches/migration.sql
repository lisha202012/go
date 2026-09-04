-- Group bulk-generated school registration links.
ALTER TABLE "SchoolRegistrationLink"
  ADD COLUMN IF NOT EXISTS "batchId" TEXT;

CREATE INDEX IF NOT EXISTS "SchoolRegistrationLink_batchId_idx"
  ON "SchoolRegistrationLink"("batchId");
