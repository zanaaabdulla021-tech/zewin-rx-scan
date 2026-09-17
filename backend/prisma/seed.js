const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const branch = await prisma.branch.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'لقی سەرەکی' },
  });

  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@zewin.local' },
    update: {},
    create: {
      email: 'admin@zewin.local',
      passwordHash,
      role: 'admin',
      branchId: branch.id,
    },
  });

  console.log('Seeded branch "لقی سەرەکی" and admin login:');
  console.log('  email:    admin@zewin.local');
  console.log('  password: admin123');
  console.log('Log in and change this password / create real accounts right away.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
