-- CreateEnum
CREATE TYPE "AdminStaffRoleType" AS ENUM ('super_admin', 'mission_content_admin', 'mission_analytics_viewer', 'journey_admin', 'journey_analytics_viewer', 'glow_admin', 'glow_analytics_viewer', 'trust_safety_admin', 'institution_admin', 'auditor');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "adminMfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "adminMfaSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "adminMfaEnrolledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AdminStaffAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AdminStaffRoleType" NOT NULL,
    "institutionId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedByUserId" TEXT,

    CONSTRAINT "AdminStaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminStaffAssignment_userId_idx" ON "AdminStaffAssignment"("userId");

-- CreateIndex
CREATE INDEX "AdminStaffAssignment_role_idx" ON "AdminStaffAssignment"("role");

-- CreateIndex
CREATE UNIQUE INDEX "AdminStaffAssignment_userId_role_institutionId_key" ON "AdminStaffAssignment"("userId", "role", "institutionId");

-- AddForeignKey
ALTER TABLE "AdminStaffAssignment" ADD CONSTRAINT "AdminStaffAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminStaffAssignment" ADD CONSTRAINT "AdminStaffAssignment_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
