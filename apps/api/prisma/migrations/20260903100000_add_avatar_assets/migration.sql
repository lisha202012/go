-- CreateTable
CREATE TABLE "AvatarAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvatarAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvatarAsset_isActive_sortOrder_idx" ON "AvatarAsset"("isActive", "sortOrder");
