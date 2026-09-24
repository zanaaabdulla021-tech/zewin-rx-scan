-- Fake demo data: 3 companies, each with branches, users, and sample
-- prescriptions. Safe to run once. All passwords are: demo1234
-- Run this whole block in Neon's SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  org_id INT;
  branch1_id INT;
  branch2_id INT;
  branch3_id INT;
  owner_id INT;
  mgr1_id INT;
  mgr2_id INT;
  mgr3_id INT;
  emp1_id INT;
  emp2_id INT;
  emp3_id INT;
  pwhash TEXT := crypt('demo1234', gen_salt('bf'));
BEGIN

  -- ============= COMPANY 1: Sarwaran Pharmacy =============
  INSERT INTO "Organization" (name, status, plan, "billingCycle", city, country, "createdAt")
  VALUES ('Sarwaran Pharmacy', 'active', 'business', 'monthly', 'Erbil', 'Iraq', NOW())
  RETURNING id INTO org_id;

  INSERT INTO "Branch" (name, "organizationId", approved, "createdAt")
  VALUES ('Main Branch', org_id, true, NOW()) RETURNING id INTO branch1_id;
  INSERT INTO "Branch" (name, "organizationId", approved, "createdAt")
  VALUES ('Koya Road', org_id, true, NOW()) RETURNING id INTO branch2_id;
  INSERT INTO "Branch" (name, "organizationId", approved, "createdAt")
  VALUES ('Ainkawa', org_id, true, NOW()) RETURNING id INTO branch3_id;

  INSERT INTO "User" (email, "passwordHash", "createdAt")
  VALUES ('owner@sarwaran.local', pwhash, NOW()) RETURNING id INTO owner_id;
  INSERT INTO "User" (email, "passwordHash", "createdAt")
  VALUES ('manager1@sarwaran.local', pwhash, NOW()) RETURNING id INTO mgr1_id;
  INSERT INTO "User" (email, "passwordHash", "createdAt")
  VALUES ('manager2@sarwaran.local', pwhash, NOW()) RETURNING id INTO mgr2_id;
  INSERT INTO "User" (email, "passwordHash", "createdAt")
  VALUES ('staff1@sarwaran.local', pwhash, NOW()) RETURNING id INTO emp1_id;

  INSERT INTO "Membership" ("userId", "organizationId", role, "branchId", "createdAt") VALUES
    (owner_id, org_id, 'owner', branch1_id, NOW()),
    (mgr1_id, org_id, 'branch_manager', branch1_id, NOW()),
    (mgr2_id, org_id, 'branch_manager', branch2_id, NOW()),
    (emp1_id, org_id, 'employee', branch3_id, NOW());

  INSERT INTO "Prescription" ("doctorName", phone, medicines, category, source, status, "branchId", "userId", "createdAt") VALUES
    ('Dr. Aras Mohammed', '07501234567', '["Panadol 500mg"]', 'Medicine', 'Private', 'approved', branch1_id, owner_id, NOW() - INTERVAL '2 days'),
    ('Dr. Sara Ahmed', '07507654321', '["Amoxicillin 500mg","Panadol 500mg"]', 'Medicine', 'Government', 'pending', branch2_id, mgr2_id, NOW() - INTERVAL '1 day'),
    ('Dr. Karwan Hussein', '07509998877', '["Taido gel"]', 'Medicine', 'Private', 'approved', branch3_id, emp1_id, NOW() - INTERVAL '5 days'),
    ('Dr. Rezan Salih', '07501112233', '["Vitamin D3 drops"]', 'Dairy', 'Private', 'rejected', branch1_id, mgr1_id, NOW() - INTERVAL '10 days'),
    ('Dr. Lana Omar', '07504445566', '["Cystof sachet"]', 'Medicine', 'Private', 'pending', branch2_id, mgr2_id, NOW() - INTERVAL '3 days');

  -- ============= COMPANY 2: Al-Noor Pharmacy =============
  INSERT INTO "Organization" (name, status, plan, "billingCycle", city, country, "createdAt")
  VALUES ('Al-Noor Pharmacy', 'active', 'basic', 'monthly', 'Sulaymaniyah', 'Iraq', NOW())
  RETURNING id INTO org_id;

  INSERT INTO "Branch" (name, "organizationId", approved, "createdAt")
  VALUES ('City Center', org_id, true, NOW()) RETURNING id INTO branch1_id;
  INSERT INTO "Branch" (name, "organizationId", approved, "createdAt")
  VALUES ('Salim Street', org_id, true, NOW()) RETURNING id INTO branch2_id;

  INSERT INTO "User" (email, "passwordHash", "createdAt")
  VALUES ('owner@alnoor.local', pwhash, NOW()) RETURNING id INTO owner_id;
  INSERT INTO "User" (email, "passwordHash", "createdAt")
  VALUES ('manager1@alnoor.local', pwhash, NOW()) RETURNING id INTO mgr1_id;
  INSERT INTO "User" (email, "passwordHash", "createdAt")
  VALUES ('staff1@alnoor.local', pwhash, NOW()) RETURNING id INTO emp1_id;

  INSERT INTO "Membership" ("userId", "organizationId", role, "branchId", "createdAt") VALUES
    (owner_id, org_id, 'owner', branch1_id, NOW()),
    (mgr1_id, org_id, 'branch_manager', branch1_id, NOW()),
    (emp1_id, org_id, 'employee', branch2_id, NOW());

  INSERT INTO "Prescription" ("doctorName", phone, medicines, category, source, status, "branchId", "userId", "createdAt") VALUES
    ('Dr. Aras Mohammed', '07501230000', '["Brufen 400mg"]', 'Medicine', 'Private', 'approved', branch1_id, owner_id, NOW() - INTERVAL '4 days'),
    ('Dr. Sara Ahmed', '07507650000', '["Zinnat 250mg"]', 'Medicine', 'Government', 'pending', branch2_id, emp1_id, NOW() - INTERVAL '2 days'),
    ('Dr. Lana Omar', '07504440000', '["Vagi cure gel"]', 'Beauty', 'Private', 'approved', branch1_id, mgr1_id, NOW() - INTERVAL '7 days');

  -- ============= COMPANY 3: Health Plus =============
  INSERT INTO "Organization" (name, status, plan, "billingCycle", city, country, "createdAt")
  VALUES ('Health Plus', 'active', 'free', 'yearly', 'Duhok', 'Iraq', NOW())
  RETURNING id INTO org_id;

  INSERT INTO "Branch" (name, "organizationId", approved, "createdAt")
  VALUES ('Main', org_id, true, NOW()) RETURNING id INTO branch1_id;

  INSERT INTO "User" (email, "passwordHash", "createdAt")
  VALUES ('owner@healthplus.local', pwhash, NOW()) RETURNING id INTO owner_id;
  INSERT INTO "User" (email, "passwordHash", "createdAt")
  VALUES ('staff1@healthplus.local', pwhash, NOW()) RETURNING id INTO emp1_id;

  INSERT INTO "Membership" ("userId", "organizationId", role, "branchId", "createdAt") VALUES
    (owner_id, org_id, 'owner', branch1_id, NOW()),
    (emp1_id, org_id, 'employee', branch1_id, NOW());

  INSERT INTO "Prescription" ("doctorName", phone, medicines, category, source, status, "branchId", "userId", "createdAt") VALUES
    ('Dr. Karwan Hussein', '07509990000', '["Active meno"]', 'Medicine', 'Private', 'pending', branch1_id, owner_id, NOW() - INTERVAL '1 day'),
    ('Dr. Rezan Salih', '07501110000', '["Panadol 500mg","Taido gel"]', 'Medicine', 'Private', 'approved', branch1_id, emp1_id, NOW() - INTERVAL '6 days');

END $$;
