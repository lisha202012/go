-- CreateEnum
CREATE TYPE "FamilyMemberRole" AS ENUM ('Mom', 'Dad', 'Sister', 'Brother', 'Son', 'Daughter', 'Grandma', 'Grandpa', 'Aunt', 'Uncle', 'Cousin', 'Other');

-- CreateEnum
CREATE TYPE "FamilyMemberStatus" AS ENUM ('pending', 'active', 'declined');

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT,
    "role" "FamilyMemberRole" NOT NULL,
    "displayName" TEXT,
    "invitedByUserId" TEXT,
    "inviteEmail" TEXT,
    "inviteUsername" TEXT,
    "status" "FamilyMemberStatus" NOT NULL DEFAULT 'pending',
    "inviteToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_inviteToken_key" ON "FamilyMember"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_familyId_userId_key" ON "FamilyMember"("familyId", "userId");

-- CreateIndex
CREATE INDEX "FamilyMember_familyId_idx" ON "FamilyMember"("familyId");

-- CreateIndex
CREATE INDEX "FamilyMember_userId_idx" ON "FamilyMember"("userId");

-- CreateIndex
CREATE INDEX "FamilyMember_inviteEmail_idx" ON "FamilyMember"("inviteEmail");

-- CreateIndex
CREATE INDEX "FamilyMember_inviteUsername_idx" ON "FamilyMember"("inviteUsername");

-- CreateIndex
CREATE INDEX "FamilyMember_status_idx" ON "FamilyMember"("status");

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
