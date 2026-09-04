CREATE TABLE IF NOT EXISTS "TreeStarGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "stars" INTEGER NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TreeStarGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TreeStarGrant_userId_source_sourceKey_key" ON "TreeStarGrant"("userId", "source", "sourceKey");
CREATE INDEX IF NOT EXISTS "TreeStarGrant_userId_idx" ON "TreeStarGrant"("userId");
DO $$ BEGIN
  ALTER TABLE "TreeStarGrant" ADD CONSTRAINT "TreeStarGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
