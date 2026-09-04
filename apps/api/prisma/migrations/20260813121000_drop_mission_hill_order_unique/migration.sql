-- Ensure legacy (hillId, order) unique is removed after category-scoped missions.
ALTER TABLE "Mission" DROP CONSTRAINT IF EXISTS "Mission_hillId_order_key";
DROP INDEX IF EXISTS "Mission_hillId_order_key";
