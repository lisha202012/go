-- Remove legacy unique (hillId, order) so multiple categories can share order numbers per hill.
ALTER TABLE "Mission" DROP CONSTRAINT IF EXISTS "Mission_hillId_order_key";
DROP INDEX IF EXISTS "Mission_hillId_order_key";
