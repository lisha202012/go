/**
 * Clear family invites and Glow Seed requests so invite/send flows can be retested.
 * Does not delete users or the family owner's own active roster row.
 *
 * Run from apps/api: node scripts/reset-family-glow-requests.mjs
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const joinedViaInvite = await prisma.familyMember.findMany({
    where: { status: 'active', invitedByUserId: { not: null }, userId: { not: null } },
    select: { id: true, userId: true, familyId: true },
  });

  const glowDeleted = await prisma.glowSeed.deleteMany();

  const pendingDeleted = await prisma.familyMember.deleteMany({
    where: { status: 'pending' },
  });

  if (joinedViaInvite.length > 0) {
    const userIds = [...new Set(joinedViaInvite.map((row) => row.userId).filter(Boolean))];
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { familyId: null },
    });
    await prisma.familyMember.deleteMany({
      where: { id: { in: joinedViaInvite.map((row) => row.id) } },
    });
  }

  console.log(`Deleted Glow Seeds: ${glowDeleted.count}`);
  console.log(`Deleted pending family invites: ${pendingDeleted.count}`);
  console.log(`Unlinked joined-via-invite members: ${joinedViaInvite.length}`);
  console.log('Ready to send family invites and Glow Seeds again.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
