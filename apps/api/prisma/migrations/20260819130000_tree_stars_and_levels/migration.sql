-- Replace TreeLevel enum values (expand from 6 to 10 levels)
ALTER TYPE "TreeLevel" RENAME VALUE 'Seed' TO 'Seedling';
ALTER TYPE "TreeLevel" RENAME VALUE 'Sprout' TO 'Sprouting';
ALTER TYPE "TreeLevel" RENAME VALUE 'Sapling' TO 'YoungTree_old';
-- YoungTree already exists, so we rename Sapling out of the way then drop
ALTER TYPE "TreeLevel" RENAME VALUE 'FlourishingTree' TO 'Flourishing';
ALTER TYPE "TreeLevel" RENAME VALUE 'BlossomingTree' TO 'Blossoming';

-- Add new levels
ALTER TYPE "TreeLevel" ADD VALUE IF NOT EXISTS 'Fruiting';
ALTER TYPE "TreeLevel" ADD VALUE IF NOT EXISTS 'Ancient';
ALTER TYPE "TreeLevel" ADD VALUE IF NOT EXISTS 'Radiant';
ALTER TYPE "TreeLevel" ADD VALUE IF NOT EXISTS 'Sacred';
ALTER TYPE "TreeLevel" ADD VALUE IF NOT EXISTS 'TreeOfFlow';

-- Migrate users who had 'Sapling' (now 'YoungTree_old') to 'YoungTree'
UPDATE "User" SET "treeLevel" = 'YoungTree' WHERE "treeLevel" = 'YoungTree_old';

-- Add treeStars column
ALTER TABLE "User" ADD COLUMN "treeStars" INTEGER NOT NULL DEFAULT 0;

-- Update default for treeLevel
ALTER TABLE "User" ALTER COLUMN "treeLevel" SET DEFAULT 'Seedling';
