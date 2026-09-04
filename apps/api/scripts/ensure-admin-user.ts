import { AdminStaffRoleType, PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';
import { grantStaffRole } from '../src/lib/adminStaffService';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword('Admin@123');
  const user = await prisma.user.upsert({
    where: { email: 'admn@gmail.com' },
    update: {
      role: 'admin',
      passwordHash,
      onboardingCompleted: true,
      adminPasswordMustReset: true,
      adminMfaEnabled: false,
      adminMfaSecret: null,
      adminMfaEnrolledAt: null,
    },
    create: {
      username: 'gofam_admin',
      email: 'admn@gmail.com',
      passwordHash,
      role: 'admin',
      onboardingCompleted: true,
      adminPasswordMustReset: true,
    },
  });

  await grantStaffRole(user.id, AdminStaffRoleType.super_admin);

  console.log(`Admin ready: ${user.email} (super_admin)`);
  console.log('Sign in at /admin/login — password Admin@123 (forced reset on first login).');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
