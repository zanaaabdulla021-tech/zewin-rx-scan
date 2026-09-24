// Fake/demo data for testing — several companies, each with a few
// branches, users, and sample prescriptions. Safe to run multiple times
// (uses upsert where it can); does NOT touch the real super admin account
// created by seed.js.
//
// Run with:
//   node prisma/seed-demo.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DOCTORS = ['Dr. Aras Mohammed', 'Dr. Sara Ahmed', 'Dr. Karwan Hussein', 'Dr. Rezan Salih', 'Dr. Lana Omar'];
const MEDICINES = [
  ['Panadol 500mg'], ['Amoxicillin 500mg'], ['Taido gel'], ['Cystof sachet'],
  ['Vagi cure gel'], ['Active meno'], ['Augmentin 625mg', 'Panadol 500mg'],
  ['Zinnat 250mg'], ['Brufen 400mg'], ['Vitamin D3 drops'],
];
const CATEGORIES = ['Medicine', 'Medicine', 'Medicine', 'Dairy', 'Beauty'];
const SOURCES = ['Private', 'Private', 'Government'];
const PASSWORD = 'demo1234';

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDateWithinDays(days) {
  const now = Date.now();
  const past = now - Math.random() * days * 24 * 60 * 60 * 1000;
  return new Date(past);
}

async function makeCompany({ name, plan, billingCycle, city, country, branchNames, ownerEmail }) {
  // findFirst-or-create, since Organization.name isn't unique in the schema.
  let org = await prisma.organization.findFirst({ where: { name } });
  if (!org) {
    org = await prisma.organization.create({ data: { name, plan, billingCycle, status: 'active', city, country } });
  }

  const branches = [];
  for (const bName of branchNames) {
    let branch = await prisma.branch.findFirst({ where: { organizationId: org.id, name: bName } });
    if (!branch) {
      branch = await prisma.branch.create({ data: { name: bName, organizationId: org.id, approved: true } });
    }
    branches.push(branch);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  let owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) {
    owner = await prisma.user.create({ data: { email: ownerEmail, passwordHash } });
  }
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: owner.id, organizationId: org.id } },
    update: {},
    create: { userId: owner.id, organizationId: org.id, role: 'owner', branchId: branches[0].id },
  });

  // One branch_manager + one employee per extra branch, for realism.
  const staff = [owner];
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i];
    const managerEmail = `manager${i + 1}@${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.local`;
    let manager = await prisma.user.findUnique({ where: { email: managerEmail } });
    if (!manager) manager = await prisma.user.create({ data: { email: managerEmail, passwordHash } });
    await prisma.membership.upsert({
      where: { userId_organizationId: { userId: manager.id, organizationId: org.id } },
      update: {},
      create: { userId: manager.id, organizationId: org.id, role: 'branch_manager', branchId: branch.id },
    });
    staff.push({ ...manager, branchId: branch.id });

    const empEmail = `staff${i + 1}@${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.local`;
    let emp = await prisma.user.findUnique({ where: { email: empEmail } });
    if (!emp) emp = await prisma.user.create({ data: { email: empEmail, passwordHash } });
    await prisma.membership.upsert({
      where: { userId_organizationId: { userId: emp.id, organizationId: org.id } },
      update: {},
      create: { userId: emp.id, organizationId: org.id, role: 'employee', branchId: branch.id },
    });
    staff.push({ ...emp, branchId: branch.id });
  }

  // A handful of sample prescriptions spread across branches and dates.
  const scanCount = 12 + Math.floor(Math.random() * 10);
  for (let i = 0; i < scanCount; i++) {
    const branch = pick(branches);
    const scanner = staff.find((s) => s.branchId === branch.id) || owner;
    const status = pick(['pending', 'pending', 'approved', 'approved', 'approved', 'rejected']);
    await prisma.prescription.create({
      data: {
        doctorName: pick(DOCTORS),
        phone: '0750' + Math.floor(1000000 + Math.random() * 8999999),
        medicines: JSON.stringify(pick(MEDICINES)),
        category: pick(CATEGORIES),
        source: pick(SOURCES),
        status,
        branchId: branch.id,
        userId: scanner.id,
        createdAt: randomDateWithinDays(60),
      },
    });
  }

  console.log(`Seeded "${name}": ${branches.length} branch(es), ${staff.length} staff, ${scanCount} prescriptions.`);
  return org;
}

async function main() {
  await makeCompany({
    name: 'Sarwaran Pharmacy',
    plan: 'business',
    billingCycle: 'monthly',
    city: 'Erbil',
    country: 'Iraq',
    branchNames: ['Main Branch', 'Koya Road', 'Ainkawa'],
    ownerEmail: 'owner@sarwaran.local',
  });

  await makeCompany({
    name: 'Al-Noor Pharmacy',
    plan: 'basic',
    billingCycle: 'monthly',
    city: 'Sulaymaniyah',
    country: 'Iraq',
    branchNames: ['City Center', 'Salim Street'],
    ownerEmail: 'owner@alnoor.local',
  });

  await makeCompany({
    name: 'Health Plus',
    plan: 'free',
    billingCycle: 'yearly',
    city: 'Duhok',
    country: 'Iraq',
    branchNames: ['Main'],
    ownerEmail: 'owner@healthplus.local',
  });

  console.log('\nAll demo logins use the password: ' + PASSWORD);
  console.log('Owners: owner@sarwaran.local, owner@alnoor.local, owner@healthplus.local');
  console.log('Change or delete these before going to production.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
