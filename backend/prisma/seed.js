const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Demo Pharmacy' },
  });

  const branch = await prisma.branch.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Main Branch', organizationId: organization.id },
  });

  const passwordHash = await bcrypt.hash('admin123', 10);
  const owner = await prisma.user.upsert({
    where: { email: 'admin@zewin.local' },
    update: {},
    create: { email: 'admin@zewin.local', passwordHash },
  });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: owner.id, organizationId: organization.id } },
    update: {},
    create: { userId: owner.id, organizationId: organization.id, role: 'owner', branchId: branch.id },
  });

  const superAdminHash = await bcrypt.hash('superadmin123', 10);
  await prisma.user.upsert({
    where: { email: 'superadmin@zewin.local' },
    update: {},
    create: { email: 'superadmin@zewin.local', passwordHash: superAdminHash, globalRole: 'super_admin' },
  });

  console.log('Seeded organization "Demo Pharmacy", branch "Main Branch", and owner login:');
  console.log('  email:    admin@zewin.local');
  console.log('  password: admin123');
  console.log('Also seeded the platform super admin login:');
  console.log('  email:    superadmin@zewin.local');
  console.log('  password: superadmin123');
  console.log('Log in and change these passwords / create real accounts right away.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
