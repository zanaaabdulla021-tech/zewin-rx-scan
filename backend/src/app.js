require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = require('./lib/prisma');
const {
  requireAuth,
  requireOrgManager,
  requireReviewer,
  requireOrgWideRead,
  requireScanner,
  requireSuperAdmin,
  requireBuilderPermission,
  ALL_BUILDER_PERMISSIONS,
} = require('./middleware/auth');
const { limitsFor, ALLOWED_PLANS, billingFor, ALLOWED_BILLING_CYCLES } = require('./plans');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' })); // prescription photos travel as base64

// A suspended or expired company's users can still log in (so they see
// the warning) but every other endpoint is blocked until reactivated.
// Registered before the route handlers below so it runs first.
async function checkCompanyActive(req, res, next) {
  if (req.user.role === 'super_admin' || !req.user.organizationId) return next();
  const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
  if (!org) return res.status(404).json({ error: 'company_not_found' });
  if (org.status === 'suspended' || org.status === 'expired') {
    return res.status(402).json({ error: 'subscription_inactive', status: org.status });
  }
  if (org.expiryDate && org.expiryDate.getTime() < Date.now()) {
    return res.status(402).json({ error: 'subscription_inactive', status: 'expired' });
  }
  next();
}
app.use('/api/branches', requireAuth, checkCompanyActive);
app.use('/api/users', requireAuth, checkCompanyActive);
app.use('/api/prescriptions', requireAuth, checkCompanyActive);
app.use('/api/reports', requireAuth, checkCompanyActive);
app.use('/api/item-image', requireAuth, checkCompanyActive);
app.use('/api/item-names', requireAuth, checkCompanyActive);
app.use('/api/medicine-info', requireAuth, checkCompanyActive);
app.use('/api/medicine-verify-photo', requireAuth, checkCompanyActive);
app.use('/api/scan', requireAuth, checkCompanyActive);
app.use('/api/activity-logs', requireAuth, checkCompanyActive);

// The shape returned for "who am I / what can I act as right now" — built
// from the JWT session (id, email, role, branchId, organizationId), never
// from the User row directly, since role/branch/org are per-membership.
function formatSession(s) {
  return {
    id: s.id,
    email: s.email,
    role: s.role,
    branchId: s.branchId ?? null,
    branchName: s.branchName ?? null,
    organizationName: s.organizationName ?? null,
    avatarData: s.avatarData ?? null,
  };
}

// The shape for one row in a company's user/member list — built from a
// Membership joined with its User.
function formatMember(user, membership) {
  return {
    id: user.id,
    email: user.email,
    role: membership.role,
    branchId: membership.branchId,
    branchName: membership.branch?.name ?? null,
    avatarData: user.avatarData ?? null,
  };
}

// The companies (and role at each) a signed-in person can switch between.
function formatCompanyList(memberships) {
  return memberships.map((m) => ({
    organizationId: m.organizationId,
    organizationName: m.organization.name,
    role: m.role,
  }));
}

function formatPrescription(row) {
  return {
    id: row.id,
    doctorName: row.doctorName,
    phone: row.phone,
    medicines: JSON.parse(row.medicines || '[]'),
    category: row.category,
    source: row.source,
    status: row.status,
    imageCount: row._count?.images ?? (row.images ? row.images.length : 0),
    branchId: row.branchId,
    branchName: row.branch?.name,
    employeeEmail: row.user?.email,
    createdAt: row.createdAt,
  };
}

// Signs a session token. `session` is a plain object — never a raw
// Prisma User row, since role/branchId/organizationId live on whichever
// Membership is currently active, not on User itself.
function signToken(session) {
  return jwt.sign(
    {
      id: session.id,
      email: session.email,
      role: session.role,
      branchId: session.branchId ?? null,
      organizationId: session.organizationId ?? null,
    },
    process.env.JWT_SECRET,
    { expiresIn: '30d' },
  );
}

// ---------------------------------------------------------------- auth ---

// Self-service sign-up: one pharmacy at a time. Creates a brand-new
// Organization with its first branch and its first owner login — this is
// the only way a new pharmacy gets onto the system, and their data is
// isolated from every other organization from this point on.
app.post('/api/auth/register-organization', async (req, res) => {
  const { organizationName, branchName, adminEmail, adminPassword } = req.body || {};
  if (!organizationName || !adminEmail || !adminPassword) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  if (adminPassword.length < 4) return res.status(400).json({ error: 'password_too_short' });

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) return res.status(409).json({ error: 'email_taken' });

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data: { name: organizationName.trim() } });
      const branch = await tx.branch.create({
        data: { name: (branchName || 'Main Branch').trim(), organizationId: organization.id },
      });
      const user = await tx.user.create({ data: { email: adminEmail, passwordHash } });
      await tx.membership.create({
        data: { userId: user.id, organizationId: organization.id, role: 'owner', branchId: branch.id },
      });
      return { user, organization, branch };
    });

    const session = {
      id: result.user.id,
      email: result.user.email,
      role: 'owner',
      branchId: result.branch.id,
      organizationId: result.organization.id,
    };
    const token = signToken(session);
    await logActivity({
      organizationId: result.organization.id,
      userId: result.user.id,
      userEmail: result.user.email,
      action: 'company_registered',
      details: `Company "${organizationName.trim()}" self-registered`,
    });
    res.status(201).json({
      token,
      user: formatSession({ ...session, branchName: result.branch.name, organizationName: result.organization.name }),
      companies: [{ organizationId: result.organization.id, organizationName: result.organization.name, role: 'owner' }],
    });
  } catch (e) {
    res.status(409).json({ error: 'email_taken' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  if (user.globalRole === 'super_admin') {
    const session = { id: user.id, email: user.email, role: 'super_admin', branchId: null, organizationId: null };
    const token = signToken(session);
    await logActivity({ organizationId: null, userId: user.id, userEmail: user.email, action: 'login' });
    return res.json({ token, user: formatSession({ ...session, avatarData: user.avatarData }), companies: [] });
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { organization: true, branch: true },
    orderBy: { createdAt: 'asc' },
  });
  if (memberships.length === 0) return res.status(403).json({ error: 'no_company_access' });

  const chosen = memberships[0];
  const session = {
    id: user.id,
    email: user.email,
    role: chosen.role,
    branchId: chosen.branchId,
    organizationId: chosen.organizationId,
  };
  const token = signToken(session);
  await logActivity({ organizationId: chosen.organizationId, userId: user.id, userEmail: user.email, action: 'login' });
  res.json({
    token,
    user: formatSession({
      ...session,
      branchName: chosen.branch?.name,
      organizationName: chosen.organization.name,
      avatarData: user.avatarData,
    }),
    companies: formatCompanyList(memberships),
  });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'not_found' });

  if (req.user.role === 'super_admin') {
    return res.json({ ...formatSession({ ...req.user, avatarData: user.avatarData }), companies: [] });
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { organization: true, branch: true },
    orderBy: { createdAt: 'asc' },
  });
  const current = memberships.find((m) => m.organizationId === req.user.organizationId);
  res.json({
    ...formatSession({
      ...req.user,
      branchName: current?.branch?.name,
      organizationName: current?.organization?.name,
      avatarData: user.avatarData,
    }),
    companies: formatCompanyList(memberships),
  });
});

// Switch which company a signed-in person is currently acting as, without
// logging out. Only works for a company you actually belong to.
app.post('/api/auth/switch-company', requireAuth, async (req, res) => {
  if (req.user.role === 'super_admin') return res.status(400).json({ error: 'not_applicable' });
  const targetOrgId = Number(req.body?.organizationId);
  if (!targetOrgId) return res.status(400).json({ error: 'missing_organization_id' });

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: req.user.id, organizationId: targetOrgId } },
    include: { organization: true, branch: true },
  });
  if (!membership) return res.status(403).json({ error: 'not_a_member' });

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const memberships = await prisma.membership.findMany({
    where: { userId: req.user.id },
    include: { organization: true, branch: true },
    orderBy: { createdAt: 'asc' },
  });

  const session = {
    id: req.user.id,
    email: req.user.email,
    role: membership.role,
    branchId: membership.branchId,
    organizationId: membership.organizationId,
  };
  const token = signToken(session);
  await logActivity({
    organizationId: membership.organizationId,
    userId: req.user.id,
    userEmail: req.user.email,
    action: 'company_switched',
    details: `Switched to "${membership.organization.name}"`,
  });
  res.json({
    token,
    user: formatSession({
      ...session,
      branchName: membership.branch?.name,
      organizationName: membership.organization.name,
      avatarData: user?.avatarData ?? null,
    }),
    companies: formatCompanyList(memberships),
  });
});

// Any signed-in company user can see their own subscription: plan, limits,
// and current usage against those limits. Works even when suspended/expired
// so the company can see exactly why they're blocked and what plan fixes it.
app.get('/api/company/subscription', requireAuth, async (req, res) => {
  if (!req.user.organizationId) return res.status(404).json({ error: 'not_found' });
  const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
  if (!org) return res.status(404).json({ error: 'not_found' });
  const limits = limitsFor(org.plan);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [branchCount, userCount, scansThisMonth] = await Promise.all([
    prisma.branch.count({ where: { organizationId: org.id } }),
    prisma.membership.count({ where: { organizationId: org.id } }),
    prisma.prescription.count({
      where: { branch: { organizationId: org.id }, createdAt: { gte: monthStart } },
    }),
  ]);

  res.json({
    plan: org.plan,
    status: org.status,
    limits,
    billing: billingFor(org.billingCycle, branchCount),
    expiryDate: org.expiryDate,
    logoData: org.logoData ?? null,
    usage: { branches: branchCount, users: userCount, scansThisMonth },
  });
});

// Owner/company_admin can upload/replace their own company's logo.
app.post('/api/company/logo', requireAuth, requireOrgManager, async (req, res) => {
  const { imageBase64, mediaType } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'missing_image' });
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const type = allowedTypes.includes(mediaType) ? mediaType : 'image/png';
  const logoData = `data:${type};base64,${imageBase64}`;
  await prisma.organization.update({ where: { id: req.user.organizationId }, data: { logoData } });
  logActivity({ organizationId: req.user.organizationId, userId: req.user.id, userEmail: req.user.email, action: 'company_logo_updated' });
  res.json({ ok: true, logoData });
});

// Any signed-in user can change their own password (must know the current one).
// This is the one login shared across every company they belong to.
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'missing_fields' });
  if (newPassword.length < 4) return res.status(400).json({ error: 'password_too_short' });

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'not_found' });

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid_current_password' });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.json({ ok: true });
});

// Profile photo — stored as a data URI directly on the user row (shared
// across every company the person belongs to).
app.post('/api/auth/avatar', requireAuth, async (req, res) => {
  const { imageBase64, mediaType } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'missing_image' });
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const type = allowedTypes.includes(mediaType) ? mediaType : 'image/jpeg';
  const avatarData = `data:${type};base64,${imageBase64}`;
  await prisma.user.update({ where: { id: req.user.id }, data: { avatarData } });
  res.json({ ok: true, avatarData });
});

// ------------------------------------------------------------ branches ---
// Every signed-in user can read their own organization's branch names.
// Only owners/company_admins create or remove branches — and only within
// their own org.

app.get('/api/branches', requireAuth, async (req, res) => {
  const branches = await prisma.branch.findMany({
    where: { organizationId: req.user.organizationId },
    orderBy: { name: 'asc' },
  });
  res.json(branches);
});

// One row per branch (or just the caller's own, if they're a branch_manager
// or employee) with live counts — powers the branch cards / control panel.
app.get('/api/branches/stats', requireAuth, async (req, res) => {
  const isOrgWide = req.user.role === 'owner' || req.user.role === 'company_admin' || req.user.role === 'viewer';
  const where = isOrgWide
    ? { organizationId: req.user.organizationId }
    : { id: req.user.branchId ?? 0 };

  const branches = await prisma.branch.findMany({ where, orderBy: { name: 'asc' } });
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const stats = await Promise.all(
    branches.map(async (b) => {
      const [userCount, prescriptionCount, scansToday, pendingCount, approvedCount, rejectedCount, manager] = await Promise.all([
        prisma.membership.count({ where: { branchId: b.id } }),
        prisma.prescription.count({ where: { branchId: b.id } }),
        prisma.prescription.count({ where: { branchId: b.id, createdAt: { gte: todayStart } } }),
        prisma.prescription.count({ where: { branchId: b.id, status: 'pending' } }),
        prisma.prescription.count({ where: { branchId: b.id, status: 'approved' } }),
        prisma.prescription.count({ where: { branchId: b.id, status: 'rejected' } }),
        prisma.membership.findFirst({ where: { branchId: b.id, role: 'branch_manager' }, include: { user: true } }),
      ]);
      return {
        id: b.id,
        name: b.name,
        approved: b.approved,
        createdAt: b.createdAt,
        userCount,
        prescriptionCount,
        scansToday,
        pendingCount,
        approvedCount,
        rejectedCount,
        managerEmail: manager?.user?.email ?? null,
      };
    }),
  );
  res.json(stats);
});

app.post('/api/branches', requireAuth, requireOrgManager, async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'missing_name' });

  const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
  const limits = limitsFor(org.plan);
  if (limits.maxBranches !== null) {
    const count = await prisma.branch.count({ where: { organizationId: req.user.organizationId } });
    if (count >= limits.maxBranches) {
      return res.status(402).json({ error: 'plan_limit_reached', limit: 'branches', max: limits.maxBranches });
    }
  }

  const branch = await prisma.branch.create({
    data: { name: name.trim(), organizationId: req.user.organizationId, approved: false },
  });
  await logActivity({ organizationId: req.user.organizationId, userId: req.user.id, userEmail: req.user.email, action: 'branch_created', details: `Branch "${branch.name}" (pending approval)` });
  notify({
    organizationId: req.user.organizationId,
    userId: null,
    title: `Branch "${branch.name}" is pending approval`,
    body: 'The platform admin must approve it before it can be used for scanning.',
  });
  res.status(201).json(branch);
});

app.delete('/api/branches/:id', requireAuth, requireOrgManager, async (req, res) => {
  const id = Number(req.params.id);
  const branch = await prisma.branch.findUnique({ where: { id } });
  await prisma.branch
    .delete({ where: { id, organizationId: req.user.organizationId } })
    .catch(() => {});
  if (branch && branch.organizationId === req.user.organizationId) {
    await logActivity({ organizationId: req.user.organizationId, userId: req.user.id, userEmail: req.user.email, action: 'branch_deleted', details: `Branch "${branch.name}"` });
  }
  res.status(204).end();
});

// ---------------------------------------------------------------- users --
// Owner/company_admin only: create the login for each pharmacy employee,
// tied to a branch — scoped to their own organization only. If the email
// already belongs to someone with an account elsewhere (another company),
// this adds them as a new member here rather than creating a duplicate
// login — one identity, one password, many company memberships.

app.get('/api/users', requireAuth, requireOrgManager, async (req, res) => {
  const memberships = await prisma.membership.findMany({
    where: { organizationId: req.user.organizationId },
    include: { user: true, branch: true },
  });
  memberships.sort((a, b) => a.user.email.localeCompare(b.user.email));
  res.json(memberships.map((m) => formatMember(m.user, m)));
});

const ALLOWED_USER_ROLES = ['owner', 'company_admin', 'branch_manager', 'employee', 'viewer'];

app.post('/api/users', requireAuth, requireOrgManager, async (req, res) => {
  const { email, password, role, branchId } = req.body || {};
  if (!email) return res.status(400).json({ error: 'missing_fields' });

  const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
  const limits = limitsFor(org.plan);
  if (limits.maxUsers !== null) {
    const count = await prisma.membership.count({ where: { organizationId: req.user.organizationId } });
    if (count >= limits.maxUsers) {
      return res.status(402).json({ error: 'plan_limit_reached', limit: 'users', max: limits.maxUsers });
    }
  }

  const safeRole = ALLOWED_USER_ROLES.includes(role) ? role : 'employee';
  // Only an owner can create another owner or a company_admin — a
  // company_admin cannot elevate anyone above their own authority.
  if (req.user.role === 'company_admin' && (safeRole === 'owner' || safeRole === 'company_admin')) {
    return res.status(403).json({ error: 'forbidden' });
  }

  // A branch can only be assigned if it belongs to the same organization.
  let safeBranchId = null;
  if (branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: Number(branchId) } });
    if (branch && branch.organizationId === req.user.organizationId) {
      safeBranchId = branch.id;
    }
  }

  try {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      if (!password || password.length < 4) return res.status(400).json({ error: 'password_too_short' });
      const passwordHash = await bcrypt.hash(password, 10);
      user = await prisma.user.create({ data: { email, passwordHash } });
    }
    const membership = await prisma.membership.create({
      data: { userId: user.id, organizationId: req.user.organizationId, role: safeRole, branchId: safeBranchId },
      include: { branch: true },
    });
    res.status(201).json(formatMember(user, membership));
    logActivity({ organizationId: req.user.organizationId, userId: req.user.id, userEmail: req.user.email, action: 'user_created', details: `${email} (${safeRole})` });
    notify({
      organizationId: req.user.organizationId,
      userId: user.id,
      title: `You've been added to a company`,
      body: `Role: ${safeRole}`,
    });
  } catch (e) {
    // unique constraint on (userId, organizationId) -> already a member here
    res.status(409).json({ error: 'already_member' });
  }
});

// A company_admin may never touch an owner's or another company_admin's
// account — only an owner can manage those.
async function assertCanManageTarget(req, res, targetUserId) {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId: req.user.organizationId } },
  });
  if (!membership) {
    res.status(404).json({ error: 'not_found' });
    return null;
  }
  if (req.user.role === 'company_admin' && (membership.role === 'owner' || membership.role === 'company_admin')) {
    res.status(403).json({ error: 'forbidden' });
    return null;
  }
  return membership;
}

// Removes this person's access to THIS company only — their login (and
// any other company they belong to) is untouched.
app.delete('/api/users/:id', requireAuth, requireOrgManager, async (req, res) => {
  const id = Number(req.params.id);
  const membership = await assertCanManageTarget(req, res, id);
  if (membership === null) return;
  const user = await prisma.user.findUnique({ where: { id } });
  await prisma.membership.delete({ where: { id: membership.id } });
  logActivity({ organizationId: req.user.organizationId, userId: req.user.id, userEmail: req.user.email, action: 'user_deleted', details: user?.email });
  res.status(204).end();
});

// Owner/company_admin can reset a user's password (within their own org
// and their own authority) without knowing the old one. This resets their
// one shared login, so it affects every company they belong to.
app.post('/api/users/:id/reset-password', requireAuth, requireOrgManager, async (req, res) => {
  const id = Number(req.params.id);
  const membership = await assertCanManageTarget(req, res, id);
  if (membership === null) return;
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'password_too_short' });
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } }).catch(() => {});
  res.json({ ok: true });
});

// --------------------------------------------------------- prescriptions -
// Employees see only the prescriptions they personally scanned; branch
// managers see their whole branch; owners/company_admins/viewers see
// every branch — but always bounded to their own organization, never
// another company's data.

app.get('/api/prescriptions', requireAuth, async (req, res) => {
  let where;
  const filterBranchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  if (req.user.role === 'owner' || req.user.role === 'company_admin' || req.user.role === 'viewer') {
    where = { branch: { organizationId: req.user.organizationId } };
    if (filterBranchId) where = { branchId: filterBranchId, branch: { organizationId: req.user.organizationId } };
  } else if (req.user.role === 'branch_manager') {
    where = { branchId: req.user.branchId };
  } else {
    where = { userId: req.user.id };
  }
  const rows = await prisma.prescription.findMany({
    where,
    include: { branch: true, user: true, _count: { select: { images: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(rows.map(formatPrescription));
});

const ALLOWED_CATEGORIES = ['Medicine', 'Dairy', 'Beauty', 'Equipment'];
const ALLOWED_SOURCES = ['Government', 'Private'];

app.post('/api/prescriptions', requireAuth, requireScanner, async (req, res) => {
  if (!req.user.branchId) return res.status(400).json({ error: 'no_branch_assigned' });

  const branch = await prisma.branch.findUnique({ where: { id: req.user.branchId } });
  if (!branch || !branch.approved) {
    return res.status(402).json({ error: 'branch_pending_approval' });
  }

  const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
  const limits = limitsFor(org.plan);
  if (limits.maxScansPerMonth !== null) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const scanCount = await prisma.prescription.count({
      where: { branch: { organizationId: req.user.organizationId }, createdAt: { gte: monthStart } },
    });
    if (scanCount >= limits.maxScansPerMonth) {
      return res.status(402).json({ error: 'plan_limit_reached', limit: 'scans', max: limits.maxScansPerMonth });
    }
  }

  const { doctorName, phone, medicines, category, source, images } = req.body || {};
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const imageList = Array.isArray(images) ? images : [];
  const imageCreates = imageList
    .filter((img) => img && img.imageBase64)
    .map((img) => {
      const type = allowedTypes.includes(img.mediaType) ? img.mediaType : 'image/jpeg';
      return { imageData: `data:${type};base64,${img.imageBase64}` };
    });
  const medicineList = Array.isArray(medicines) ? medicines : [];

  const row = await prisma.prescription.create({
    data: {
      doctorName: doctorName || '',
      phone: phone || '',
      medicines: JSON.stringify(medicineList),
      category: ALLOWED_CATEGORIES.includes(category) ? category : 'Medicine',
      source: ALLOWED_SOURCES.includes(source) ? source : 'Private',
      branchId: req.user.branchId,
      userId: req.user.id,
      images: imageCreates.length ? { create: imageCreates } : undefined,
    },
    include: { _count: { select: { images: true } } },
  });

  // Remember one photo per item name (scoped to this organization), so
  // next time it's typed the photo can be shown automatically.
  if (imageCreates.length && medicineList.length) {
    const imageData = imageCreates[0].imageData;
    await Promise.all(
      medicineList
        .map((m) => String(m).trim().toLowerCase())
        .filter(Boolean)
        .map((name) =>
          prisma.itemImage.upsert({
            where: { name },
            update: { imageData, createdByOrgId: req.user.organizationId, createdByOrgName: org.name },
            create: { name, imageData, createdByOrgId: req.user.organizationId, createdByOrgName: org.name },
          }),
        ),
    );
  }

  res.status(201).json(formatPrescription(row));
  logActivity({ organizationId: req.user.organizationId, userId: req.user.id, userEmail: req.user.email, action: 'prescription_scanned', details: `#${row.id}${doctorName ? ' — Dr. ' + doctorName : ''}` });
});

// Look up a remembered photo for an item/medicine name — shared across
// every company on the platform (a medicine looks the same everywhere).
// createdByOrgName is returned for transparency only; it never restricts
// who can see or reuse the photo.
// Every distinct item/medicine name this company has used before —
// powers autocomplete so an item is picked from what's already on file
// instead of being retyped (and possibly mis-typed) each time.
app.get('/api/item-names', requireAuth, async (req, res) => {
  const rows = await prisma.prescription.findMany({
    where: { branch: { organizationId: req.user.organizationId } },
    select: { medicines: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const names = new Set();
  for (const row of rows) {
    let meds = [];
    try {
      meds = JSON.parse(row.medicines || '[]');
    } catch (_) {}
    meds.forEach((m) => {
      const trimmed = String(m).trim();
      if (trimmed) names.add(trimmed);
    });
  }
  res.json(Array.from(names).sort((a, b) => a.localeCompare(b)));
});

app.get('/api/item-image', requireAuth, async (req, res) => {
  const name = (req.query.name || '').toString().trim().toLowerCase();
  if (!name) return res.status(400).json({ error: 'missing_name' });
  const row = await prisma.itemImage.findUnique({ where: { name } });
  res.json({ imageData: row?.imageData ?? null, createdByOrgName: row?.createdByOrgName ?? null });
});

// Save/replace the remembered photo for an item name — platform-wide,
// so it then appears automatically for that item name at every branch,
// for every user, in every company, from now on. Records which company
// saved it (createdByOrgId/Name) purely for provenance.
app.post('/api/item-image', requireAuth, async (req, res) => {
  const name = (req.body?.name || '').toString().trim().toLowerCase();
  const { imageBase64, mediaType } = req.body || {};
  if (!name) return res.status(400).json({ error: 'missing_name' });
  if (!imageBase64 || typeof imageBase64 !== 'string') return res.status(400).json({ error: 'missing_image' });
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const type = allowedTypes.includes(mediaType) ? mediaType : 'image/jpeg';
  const imageData = `data:${type};base64,${imageBase64}`;
  const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
  await prisma.itemImage.upsert({
    where: { name },
    update: { imageData, createdByOrgId: req.user.organizationId, createdByOrgName: org?.name ?? null },
    create: { name, imageData, createdByOrgId: req.user.organizationId, createdByOrgName: org?.name ?? null },
  });
  res.json({ ok: true, imageData });
});

// Best-effort reference info for a medicine name, via Gemini — never
// fabricated with confidence: the model is instructed to say so plainly
// when it can't confidently identify the item, and every response is
// informational only, never a substitute for pharmacist/doctor review.
const MEDICINE_INFO_PROMPT =
  'You are a pharmacy reference lookup. Given a medicine/item name (which ' +
  'may be in English, Kurdish, or Arabic, and may be misspelled or a brand ' +
  'name), identify it if you can do so with reasonable confidence. ' +
  'Reply with ONLY a JSON object, no other text, of this exact shape: ' +
  '{"identified": boolean, "type": string, "manufacturer": string, "strength": string, "usedFor": string, ' +
  '"activeIngredient": string, "important": string[], "sideEffects": string[]}. ' +
  '"manufacturer" is the pharmaceutical company that makes this brand/product ' +
  '(e.g. for Panadol, the manufacturer is Haleon/GSK) — leave it "" if you are ' +
  'not confident which company makes it, even if you can identify the medicine ' +
  'itself. "strength" is the dose/strength if the name itself states or implies ' +
  'one (e.g. "500mg", "120ml", "500mg/5ml") — leave it "" if the name does not ' +
  'include or clearly imply a specific strength; never guess a strength the name ' +
  'does not support. If you cannot confidently identify the item as a real ' +
  'medicine, set "identified" to false and leave the other string fields as "" ' +
  'and the arrays as []. Never invent or guess plausible-sounding details for an ' +
  'item you are not confident about. Keep each field brief (one short ' +
  'sentence or a few short bullet phrases).';

app.post('/api/medicine-info', requireAuth, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'server_misconfigured' });
  const name = (req.body?.name || '').toString().trim();
  if (!name) return res.status(400).json({ error: 'missing_name' });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: MEDICINE_INFO_PROMPT + '\n\nItem name: ' + name }] }],
      }),
    });
    if (!response.ok) return res.status(502).json({ identified: false });

    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('\n');
    const parsed = extractJson(text);
    if (!parsed || !parsed.identified) {
      return res.json({ identified: false });
    }
    res.json({
      identified: true,
      type: typeof parsed.type === 'string' ? parsed.type : '',
      manufacturer: typeof parsed.manufacturer === 'string' ? parsed.manufacturer : '',
      strength: typeof parsed.strength === 'string' ? parsed.strength : '',
      usedFor: typeof parsed.usedFor === 'string' ? parsed.usedFor : '',
      activeIngredient: typeof parsed.activeIngredient === 'string' ? parsed.activeIngredient : '',
      important: Array.isArray(parsed.important) ? parsed.important.map(String) : [],
      sideEffects: Array.isArray(parsed.sideEffects) ? parsed.sideEffects.map(String) : [],
    });
  } catch (e) {
    res.json({ identified: false });
  }
});

// Given a typed item name and a photo of the actual product, ask Gemini
// whether the photo looks like that item — a quick sanity check before
// saving, not a substitute for the pharmacist's own verification.
const MEDICINE_PHOTO_VERIFY_PROMPT =
  'You are a pharmacy assistant. The pharmacist typed this item name: "%NAME%". ' +
  'Look at the attached photo of a medicine/product package or item. Decide ' +
  'whether the photo plausibly shows that same item (matching brand/name, ' +
  'even if angle, language, or packaging design differs). Reply with ONLY a ' +
  'JSON object, no other text: {"matches": boolean, "confidence": "high"|"medium"|"low", ' +
  '"detectedName": string, "note": string}. "detectedName" is your best reading ' +
  'of the name/brand actually printed on the item in the photo (or "" if unreadable). ' +
  '"note" is one short sentence explaining the result, e.g. why it does or does not ' +
  'match. If you cannot read the photo well enough to judge, set "matches" to false, ' +
  '"confidence" to "low", and explain that in "note". Never guess a specific brand ' +
  'you cannot actually see written or clearly depicted in the image.';

app.post('/api/medicine-verify-photo', requireAuth, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'server_misconfigured' });
  const name = (req.body?.name || '').toString().trim();
  const { imageBase64, mediaType } = req.body || {};
  if (!name) return res.status(400).json({ error: 'missing_name' });
  if (!imageBase64 || typeof imageBase64 !== 'string') return res.status(400).json({ error: 'missing_image' });
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const type = allowedTypes.includes(mediaType) ? mediaType : 'image/jpeg';

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: MEDICINE_PHOTO_VERIFY_PROMPT.replace('%NAME%', name) },
              { inlineData: { mimeType: type, data: imageBase64 } },
            ],
          },
        ],
      }),
    });
    if (!response.ok) return res.status(502).json({ checked: false });

    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('\n');
    const parsed = extractJson(text);
    if (!parsed) return res.json({ checked: false });
    res.json({
      checked: true,
      matches: Boolean(parsed.matches),
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
      detectedName: typeof parsed.detectedName === 'string' ? parsed.detectedName : '',
      note: typeof parsed.note === 'string' ? parsed.note : '',
    });
  } catch (e) {
    res.json({ checked: false });
  }
});

// Fetch every saved photo for one prescription — kept out of the list
// endpoint so ordinary list/history requests stay light.
app.get('/api/prescriptions/:id/images', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const row = await prisma.prescription.findUnique({ where: { id }, include: { images: true, branch: true } });
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (row.branch.organizationId !== req.user.organizationId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (req.user.role === 'employee' && row.userId !== req.user.id) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (req.user.role === 'branch_manager' && row.branchId !== req.user.branchId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  res.json({ images: row.images.map((img) => ({ id: img.id, imageData: img.imageData })) });
});

app.delete('/api/prescriptions/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const row = await prisma.prescription.findUnique({ where: { id }, include: { branch: true } });
  if (!row) return res.status(204).end();
  if (row.branch.organizationId !== req.user.organizationId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const isOrgManager = req.user.role === 'owner' || req.user.role === 'company_admin';
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (!isOrgManager && row.userId !== req.user.id) {
    return res.status(403).json({ error: 'forbidden' });
  }
  await prisma.prescription.delete({ where: { id } });
  res.status(204).end();
  logActivity({ organizationId: req.user.organizationId, userId: req.user.id, userEmail: req.user.email, action: 'prescription_deleted', details: `#${id}` });
});

// A branch manager reviews everything scanned at their own branch and
// approves or rejects it; owners/company_admins can do this across any
// branch in their own org.

async function setPrescriptionStatus(req, res, status) {
  const id = Number(req.params.id);
  const row = await prisma.prescription.findUnique({ where: { id }, include: { branch: true } });
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (row.branch.organizationId !== req.user.organizationId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const isOrgManager = req.user.role === 'owner' || req.user.role === 'company_admin';
  if (!isOrgManager && row.branchId !== req.user.branchId) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const updated = await prisma.prescription.update({ where: { id }, data: { status } });
  res.json(formatPrescription(updated));
  logActivity({ organizationId: req.user.organizationId, userId: req.user.id, userEmail: req.user.email, action: status === 'approved' ? 'prescription_approved' : 'prescription_rejected', details: `#${id}` });
  if (status === 'rejected') {
    notify({
      organizationId: req.user.organizationId,
      userId: row.userId,
      title: 'A prescription you scanned was rejected',
      body: `#${id}${row.doctorName ? ' — Dr. ' + row.doctorName : ''}`,
    });
  }
}

app.post('/api/prescriptions/:id/approve', requireAuth, requireReviewer, (req, res) =>
  setPrescriptionStatus(req, res, 'approved'),
);

app.post('/api/prescriptions/:id/reject', requireAuth, requireReviewer, (req, res) =>
  setPrescriptionStatus(req, res, 'rejected'),
);

// --------------------------------------------------------------- reports -
// Owner/company_admin/viewer only, and always bounded to their own
// organization. Built by pulling every prescription into memory and
// tallying in JS rather than SQL GROUP BY — medicines live in a JSON text
// column, so this is simpler and fast enough at pharmacy-chain scale.

app.get('/api/reports/overview', requireAuth, requireOrgWideRead, async (req, res) => {
  const orgWhere = { branch: { organizationId: req.user.organizationId } };
  const [prescriptions, branches, memberships] = await Promise.all([
    prisma.prescription.findMany({ where: orgWhere, orderBy: { createdAt: 'desc' } }),
    prisma.branch.findMany({ where: { organizationId: req.user.organizationId } }),
    prisma.membership.findMany({ where: { organizationId: req.user.organizationId }, include: { user: true } }),
  ]);
  const branchNameById = Object.fromEntries(branches.map((b) => [b.id, b.name]));
  const userEmailById = Object.fromEntries(memberships.map((m) => [m.userId, m.user.email]));

  const byBranch = {};
  const byEmployee = {};
  const byDoctor = {};
  const byCategory = {};
  const bySource = {};
  const medicineCounts = {};
  const byDay = {};
  const byMonth = {};
  const byYear = {};

  for (const p of prescriptions) {
    const branchName = branchNameById[p.branchId] || 'Unknown';
    byBranch[branchName] = (byBranch[branchName] || 0) + 1;

    const empEmail = userEmailById[p.userId] || 'Unknown';
    byEmployee[empEmail] = (byEmployee[empEmail] || 0) + 1;

    const doctorKey = (p.doctorName || '').trim() || 'No doctor name';
    byDoctor[doctorKey] = (byDoctor[doctorKey] || 0) + 1;

    const categoryKey = p.category || 'Medicine';
    byCategory[categoryKey] = (byCategory[categoryKey] || 0) + 1;

    const sourceKey = p.source || 'Private';
    bySource[sourceKey] = (bySource[sourceKey] || 0) + 1;

    let meds = [];
    try {
      meds = JSON.parse(p.medicines || '[]');
    } catch (_) {}
    meds.forEach((m) => {
      const key = String(m).trim();
      if (key) medicineCounts[key] = (medicineCounts[key] || 0) + 1;
    });

    const iso = p.createdAt.toISOString();
    const day = iso.slice(0, 10);
    const month = iso.slice(0, 7);
    const year = iso.slice(0, 4);
    byDay[day] = (byDay[day] || 0) + 1;
    byMonth[month] = (byMonth[month] || 0) + 1;
    byYear[year] = (byYear[year] || 0) + 1;
  }

  const toSortedArray = (obj) =>
    Object.entries(obj)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

  const toDateSortedArray = (obj) =>
    Object.entries(obj)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([name, count]) => ({ name, count }));

  res.json({
    total: prescriptions.length,
    byBranch: toSortedArray(byBranch),
    byEmployee: toSortedArray(byEmployee),
    byDoctor: toSortedArray(byDoctor),
    byCategory: toSortedArray(byCategory),
    bySource: toSortedArray(bySource),
    topMedicines: toSortedArray(medicineCounts).slice(0, 20),
    byDay: toDateSortedArray(byDay),
    byMonth: toDateSortedArray(byMonth),
    byYear: toDateSortedArray(byYear),
  });
});

// Drill into one doctor: which employees filled their prescriptions, at
// which branches, and which medicines — exactly what a pharmacy owner
// wants to check for a given doctor. Bounded to the caller's own org.
app.get('/api/reports/doctor', requireAuth, requireOrgWideRead, async (req, res) => {
  const name = (req.query.name || '').toString().trim();
  if (!name) return res.status(400).json({ error: 'missing_name' });

  const [prescriptions, branches, memberships] = await Promise.all([
    prisma.prescription.findMany({
      where: {
        doctorName: name === 'No doctor name' ? '' : name,
        branch: { organizationId: req.user.organizationId },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.branch.findMany({ where: { organizationId: req.user.organizationId } }),
    prisma.membership.findMany({ where: { organizationId: req.user.organizationId }, include: { user: true } }),
  ]);
  const branchNameById = Object.fromEntries(branches.map((b) => [b.id, b.name]));
  const userEmailById = Object.fromEntries(memberships.map((m) => [m.userId, m.user.email]));

  const rows = prescriptions.map((p) => ({
    id: p.id,
    branchName: branchNameById[p.branchId] || null,
    employeeEmail: userEmailById[p.userId] || null,
    medicines: JSON.parse(p.medicines || '[]'),
    category: p.category,
    source: p.source,
    phone: p.phone,
    createdAt: p.createdAt,
  }));

  res.json({ doctorName: name, total: rows.length, prescriptions: rows });
});

// ---------------------------------------------------------- activity log -
// Owner/company_admin can see their own company's audit trail.

app.get('/api/activity-logs', requireAuth, requireOrgManager, async (req, res) => {
  const logs = await prisma.activityLog.findMany({
    where: { organizationId: req.user.organizationId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(
    logs.map((l) => ({
      id: l.id,
      action: l.action,
      details: l.details,
      userEmail: l.userEmail,
      createdAt: l.createdAt,
    })),
  );
});

function formatCompany(org) {
  const branchCount = org._count?.branches ?? 0;
  return {
    id: org.id,
    name: org.name,
    status: org.status,
    plan: org.plan,
    limits: limitsFor(org.plan),
    billing: billingFor(org.billingCycle, branchCount),
    expiryDate: org.expiryDate,
    logoData: org.logoData ?? null,
    phone: org.phone,
    email: org.email,
    address: org.address,
    country: org.country,
    city: org.city,
    createdAt: org.createdAt,
    branchCount,
    userCount: org._count?.memberships ?? 0,
  };
}

// Fire-and-forget audit trail. Never let a logging failure break the
// actual request — activity logs are a convenience, not a source of truth.
async function logActivity({ organizationId, userId, userEmail, action, details }) {
  try {
    await prisma.activityLog.create({
      data: { organizationId: organizationId ?? null, userId: userId ?? null, userEmail: userEmail ?? null, action, details: details ?? null },
    });
  } catch (e) {
    // swallow — logging must never break the request it's logging
  }
}

// Creates an in-app notification. userId set = personal; userId null =
// every owner/company_admin of that organization sees it.
async function notify({ organizationId, userId, title, body }) {
  try {
    await prisma.notification.create({
      data: { organizationId: organizationId ?? null, userId: userId ?? null, title, body: body ?? null },
    });
  } catch (e) {
    // swallow — a failed notification must never break the request
  }
}

// Any signed-in person sees: their personal notifications, plus (if this
// company has any) the organization-wide ones meant for owners/admins.
app.get('/api/notifications', requireAuth, async (req, res) => {
  const isOrgManager = req.user.role === 'owner' || req.user.role === 'company_admin';
  const where = req.user.organizationId
    ? {
        organizationId: req.user.organizationId,
        OR: [{ userId: req.user.id }, ...(isOrgManager ? [{ userId: null }] : [])],
      }
    : { userId: req.user.id };
  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({
    unreadCount: notifications.filter((n) => !n.read).length,
    notifications,
  });
});

app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.notification.updateMany({
    where: { id, OR: [{ userId: req.user.id }, { userId: null, organizationId: req.user.organizationId }] },
    data: { read: true },
  });
  res.json({ ok: true });
});

app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  const isOrgManager = req.user.role === 'owner' || req.user.role === 'company_admin';
  await prisma.notification.updateMany({
    where: {
      organizationId: req.user.organizationId,
      OR: [{ userId: req.user.id }, ...(isOrgManager ? [{ userId: null }] : [])],
    },
    data: { read: true },
  });
  res.json({ ok: true });
});

// ------------------------------------------------------------- billing --
// A company can always be activated manually by the super admin (set
// status/expiry directly) — that never goes away. On top of that, a
// company can submit a payment claim here for the super admin to review
// and approve, which turns into the same activation automatically. Once
// a real gateway (e.g. ZainCash) is wired up, it becomes just another way
// to create an already-approved Payment — the manual path keeps working
// alongside it.

app.get('/api/company/payments', requireAuth, requireOrgManager, async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { organizationId: req.user.organizationId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(payments);
});

app.post('/api/company/payments/request', requireAuth, requireOrgManager, async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
  if (!org) return res.status(404).json({ error: 'not_found' });
  const branchCount = await prisma.branch.count({ where: { organizationId: org.id } });
  const billing = billingFor(org.billingCycle, branchCount);
  const { reference } = req.body || {};

  const payment = await prisma.payment.create({
    data: {
      organizationId: org.id,
      amount: billing.totalCost,
      currency: 'USD',
      method: 'manual',
      status: 'pending',
      reference: reference || null,
      requestedBy: req.user.email,
    },
  });
  logActivity({ organizationId: org.id, userId: req.user.id, userEmail: req.user.email, action: 'payment_requested', details: `$${billing.totalCost} (${billing.cycle})` });
  res.status(201).json(payment);
});

app.get('/api/superadmin/payments', requireAuth, requireSuperAdmin, async (req, res) => {
  const status = req.query.status;
  const payments = await prisma.payment.findMany({
    where: status ? { status } : {},
    include: { organization: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(
    payments.map((p) => ({
      id: p.id,
      organizationId: p.organizationId,
      companyName: p.organization?.name ?? null,
      amount: p.amount,
      currency: p.currency,
      method: p.method,
      status: p.status,
      reference: p.reference,
      requestedBy: p.requestedBy,
      reviewedBy: p.reviewedBy,
      createdAt: p.createdAt,
      reviewedAt: p.reviewedAt,
    })),
  );
});

app.post('/api/superadmin/payments/:id/approve', requireAuth, requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const payment = await prisma.payment.findUnique({ where: { id }, include: { organization: true } });
  if (!payment) return res.status(404).json({ error: 'not_found' });

  const org = payment.organization;
  const now = new Date();
  const base = org.expiryDate && org.expiryDate.getTime() > now.getTime() ? org.expiryDate : now;
  const newExpiry = new Date(base);
  if (org.billingCycle === 'yearly') newExpiry.setFullYear(newExpiry.getFullYear() + 1);
  else newExpiry.setMonth(newExpiry.getMonth() + 1);

  await prisma.$transaction([
    prisma.payment.update({
      where: { id },
      data: { status: 'approved', reviewedBy: req.user.email, reviewedAt: now },
    }),
    prisma.organization.update({
      where: { id: org.id },
      data: { status: 'active', expiryDate: newExpiry },
    }),
  ]);

  logActivity({ organizationId: org.id, userId: req.user.id, userEmail: req.user.email, action: 'payment_approved', details: `$${payment.amount} — extended to ${newExpiry.toISOString().slice(0, 10)}` });
  notify({
    organizationId: org.id,
    userId: null,
    title: 'Payment approved — your account is active',
    body: `Extended to ${newExpiry.toISOString().slice(0, 10)}`,
  });
  res.json({ ok: true, expiryDate: newExpiry });
});

app.post('/api/superadmin/payments/:id/reject', requireAuth, requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const payment = await prisma.payment
    .update({ where: { id }, data: { status: 'rejected', reviewedBy: req.user.email, reviewedAt: new Date() }, include: { organization: true } })
    .catch(() => null);
  if (!payment) return res.status(404).json({ error: 'not_found' });
  notify({
    organizationId: payment.organizationId,
    userId: null,
    title: 'Payment claim rejected',
    body: payment.reference ? `Reference: ${payment.reference}` : null,
  });
  res.json({ ok: true });
});

// ------------------------------------------------------- branch approval -
// A branch created by a company (not the platform) starts unapproved and
// cannot be used for scanning until the super admin approves it.

app.get('/api/superadmin/branches/pending', requireAuth, requireSuperAdmin, async (req, res) => {
  const branches = await prisma.branch.findMany({
    where: { approved: false },
    include: { organization: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(
    branches.map((b) => ({
      id: b.id,
      name: b.name,
      companyId: b.organizationId,
      companyName: b.organization?.name ?? null,
      createdAt: b.createdAt,
    })),
  );
});

app.post('/api/superadmin/branches/:id/approve', requireAuth, requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const branch = await prisma.branch
    .update({ where: { id }, data: { approved: true }, include: { organization: true } })
    .catch(() => null);
  if (!branch) return res.status(404).json({ error: 'not_found' });
  logActivity({ organizationId: null, userId: req.user.id, userEmail: req.user.email, action: 'branch_approved', details: `"${branch.name}" — ${branch.organization.name}` });
  notify({
    organizationId: branch.organizationId,
    userId: null,
    title: `Branch "${branch.name}" has been approved`,
    body: 'It can now be used for scanning.',
  });
  res.json({ ok: true });
});

app.post('/api/superadmin/branches/:id/reject', requireAuth, requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const branch = await prisma.branch.findUnique({ where: { id }, include: { organization: true } });
  if (!branch) return res.status(404).json({ error: 'not_found' });
  await prisma.branch.delete({ where: { id } });
  logActivity({ organizationId: null, userId: req.user.id, userEmail: req.user.email, action: 'branch_rejected', details: `"${branch.name}" — ${branch.organization.name}` });
  notify({
    organizationId: branch.organizationId,
    userId: null,
    title: `Branch "${branch.name}" was rejected`,
    body: 'Contact the platform admin for details.',
  });
  res.json({ ok: true });
});

// ------------------------------------------------------- super admin ---
// Platform-level management: create/suspend/activate/delete companies,
// and see usage across the whole platform. None of this is scoped to an
// organization — a super_admin account has organizationId = null.

const ALLOWED_COMPANY_STATUSES = ['trial', 'active', 'suspended', 'expired'];

// A super admin can create another platform-level super admin account —
// the only way to get one, since it's never self-service and never tied
// to any company.
app.post('/api/superadmin/create-admin', requireAuth, requireSuperAdmin, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });
  if (password.length < 4) return res.status(400).json({ error: 'password_too_short' });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'email_taken' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, passwordHash, globalRole: 'super_admin' } });
  logActivity({ organizationId: null, userId: req.user.id, userEmail: req.user.email, action: 'super_admin_created', details: email });
  res.status(201).json({ id: user.id, email: user.email });
});

// Builder permissions per super admin. A null builderPermissions means
// unrestricted (every builder.* permission) — the state every admin
// starts in, and the only state that lets someone grant/restrict others'
// builder access (so a restricted admin can never escalate themselves).
app.get('/api/superadmin/admins', requireAuth, requireSuperAdmin, async (req, res) => {
  const admins = await prisma.user.findMany({ where: { globalRole: 'super_admin' }, orderBy: { createdAt: 'asc' } });
  res.json(admins.map((a) => ({
    id: a.id,
    email: a.email,
    builderPermissions: a.builderPermissions == null ? null : JSON.parse(a.builderPermissions),
    isSelf: a.id === req.user.id,
  })));
});

app.patch('/api/superadmin/admins/:id/builder-permissions', requireAuth, requireSuperAdmin, async (req, res) => {
  const actingAdmin = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (actingAdmin.builderPermissions != null) {
    return res.status(403).json({ error: 'forbidden', reason: 'only an unrestricted admin can change builder permissions' });
  }
  const targetId = Number(req.params.id);
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target || target.globalRole !== 'super_admin') return res.status(404).json({ error: 'not_found' });

  const permissions = req.body?.permissions;
  let value;
  if (permissions === null) {
    value = null; // unrestricted
  } else if (Array.isArray(permissions) && permissions.every((p) => ALL_BUILDER_PERMISSIONS.includes(p))) {
    value = JSON.stringify(permissions);
  } else {
    return res.status(400).json({ error: 'invalid_permissions' });
  }

  const updated = await prisma.user.update({ where: { id: targetId }, data: { builderPermissions: value } });
  logActivity({ organizationId: null, userId: req.user.id, userEmail: req.user.email, action: 'builder_permissions_changed', details: `${target.email}: ${value === null ? 'unrestricted' : value}` });
  res.json({ id: updated.id, email: updated.email, builderPermissions: value === null ? null : JSON.parse(value) });
});

// -------------------------------------------------------- module builder -
// Phase 1: create/list/view/delete module records. Code and Studio editing
// (actually writing the module's `definition`), AI assistance, versioning,
// and publishing come in later phases — this lays the real foundation
// (the same data shape) they'll all build on.

function formatModule(m) {
  let definition = {};
  try {
    definition = JSON.parse(m.definition || '{}');
  } catch (_) {}
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    creationMethod: m.creationMethod,
    status: m.status,
    definition,
    createdBy: m.createdBy,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

// The real tables/fields Studio components can bind to — matches
// backend/prisma/schema.prisma exactly, not a made-up list. Only the
// business-data models are exposed (internal bookkeeping tables like
// ActivityLog/ModuleVersion are left out on purpose).
const MODULE_DATA_SOURCES = [
  { table: 'organizations', label: 'Organizations', fields: ['id', 'name', 'status', 'plan', 'billingCycle', 'expiryDate', 'phone', 'email', 'address', 'country', 'city', 'createdAt'] },
  { table: 'branches', label: 'Branches', fields: ['id', 'name', 'organizationId', 'approved', 'createdAt'] },
  { table: 'users', label: 'Users', fields: ['id', 'email', 'globalRole', 'createdAt'] },
  { table: 'memberships', label: 'Memberships', fields: ['id', 'userId', 'organizationId', 'role', 'branchId', 'createdAt'] },
  { table: 'prescriptions', label: 'Prescriptions', fields: ['id', 'doctorName', 'phone', 'medicines', 'category', 'source', 'status', 'branchId', 'userId', 'createdAt'] },
  { table: 'payments', label: 'Payments', fields: ['id', 'amount', 'currency', 'method', 'status', 'reference', 'organizationId', 'createdAt'] },
];

app.get('/api/superadmin/data-sources', requireAuth, requireBuilderPermission('builder.view'), async (req, res) => {
  res.json(MODULE_DATA_SOURCES);
});

app.get('/api/superadmin/modules', requireAuth, requireBuilderPermission('builder.view'), async (req, res) => {
  const modules = await prisma.module.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json(modules.map(formatModule));
});

app.post('/api/superadmin/modules', requireAuth, requireBuilderPermission('builder.create'), async (req, res) => {
  const { name, description, creationMethod } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name_required' });
  if (!['code', 'studio'].includes(creationMethod)) return res.status(400).json({ error: 'invalid_creation_method' });

  const emptyDefinition = {
    metadata: { name: String(name).trim(), description: description || '' },
    pages: [],
    components: [],
    dataSources: [],
    apis: [],
    actions: [],
    permissions: { view: [], create: [], edit: [], delete: [], publish: [], restore: [] },
    settings: {},
  };

  const module = await prisma.module.create({
    data: {
      name: String(name).trim(),
      description: description || null,
      creationMethod,
      status: 'draft',
      definition: JSON.stringify(emptyDefinition),
      createdBy: req.user.email,
    },
  });
  logActivity({ organizationId: null, userId: req.user.id, userEmail: req.user.email, action: 'module_created', details: `"${module.name}" (${creationMethod})` });
  res.status(201).json(formatModule(module));
});

app.get('/api/superadmin/modules/:id', requireAuth, requireBuilderPermission('builder.view'), async (req, res) => {
  const id = Number(req.params.id);
  const module = await prisma.module.findUnique({ where: { id } });
  if (!module) return res.status(404).json({ error: 'not_found' });
  res.json(formatModule(module));
});

// Generic save — Code Mode (files) and Studio Mode (pages/components) both
// write here, since every module shares the same `definition` shape.
app.patch('/api/superadmin/modules/:id', requireAuth, requireBuilderPermission('builder.edit'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.module.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const data = {};
  if (req.body?.name) data.name = String(req.body.name).trim();
  if (typeof req.body?.description === 'string') data.description = req.body.description;
  if (req.body?.status) data.status = req.body.status;
  if (req.body?.definition && typeof req.body.definition === 'object') {
    data.definition = JSON.stringify(req.body.definition);
  }
  const module = await prisma.module.update({ where: { id }, data });
  logActivity({ organizationId: null, userId: req.user.id, userEmail: req.user.email, action: 'module_updated', details: `"${module.name}"` });
  res.json(formatModule(module));
});

// AI assistant inside Code Mode. Always returns a SUGGESTION for the
// human to review and apply themselves — it never writes to the module.
const MODULE_AI_ACTIONS = {
  generate: 'Write the code the user is asking for. Reply with the complete file content only — no explanation, no markdown fences.',
  explain: 'Explain in plain language what this code does, section by section. Be concise. Reply as plain text, not code.',
  fix: 'Find and fix any bugs or errors in this code. Reply with the complete corrected file content only — no explanation, no markdown fences.',
  refactor: 'Refactor this code for clarity and maintainability without changing its behavior. Reply with the complete refactored file content only — no explanation, no markdown fences.',
};

// ------------------------------------------------------ module versions -
// A version is a snapshot of the module's definition at a point in time.
// Saving a version never changes the module itself; restoring one does
// (it becomes the module's current definition, and is itself snapshotted
// first so nothing is ever silently lost).

app.get('/api/superadmin/modules/:id/versions', requireAuth, requireBuilderPermission('builder.view'), async (req, res) => {
  const moduleId = Number(req.params.id);
  const versions = await prisma.moduleVersion.findMany({
    where: { moduleId },
    orderBy: { versionNumber: 'desc' },
    select: { id: true, versionNumber: true, note: true, createdBy: true, createdAt: true },
  });
  res.json(versions);
});

app.get('/api/superadmin/modules/:id/versions/:versionId', requireAuth, requireBuilderPermission('builder.view'), async (req, res) => {
  const version = await prisma.moduleVersion.findUnique({ where: { id: Number(req.params.versionId) } });
  if (!version || version.moduleId !== Number(req.params.id)) return res.status(404).json({ error: 'not_found' });
  let definition = {};
  try { definition = JSON.parse(version.definition || '{}'); } catch (_) {}
  res.json({ ...version, definition });
});

app.post('/api/superadmin/modules/:id/versions', requireAuth, requireBuilderPermission('builder.edit'), async (req, res) => {
  const moduleId = Number(req.params.id);
  const module = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!module) return res.status(404).json({ error: 'not_found' });

  const last = await prisma.moduleVersion.findFirst({ where: { moduleId }, orderBy: { versionNumber: 'desc' } });
  const nextNumber = (last?.versionNumber ?? 0) + 1;
  const version = await prisma.moduleVersion.create({
    data: {
      moduleId,
      versionNumber: nextNumber,
      definition: module.definition,
      note: req.body?.note || null,
      createdBy: req.user.email,
    },
  });
  logActivity({ organizationId: null, userId: req.user.id, userEmail: req.user.email, action: 'module_version_saved', details: `"${module.name}" v${nextNumber}` });
  res.status(201).json(version);
});

app.post('/api/superadmin/modules/:id/versions/:versionId/restore', requireAuth, requireBuilderPermission('builder.restore'), async (req, res) => {
  const moduleId = Number(req.params.id);
  const module = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!module) return res.status(404).json({ error: 'not_found' });
  const version = await prisma.moduleVersion.findUnique({ where: { id: Number(req.params.versionId) } });
  if (!version || version.moduleId !== moduleId) return res.status(404).json({ error: 'not_found' });

  // Snapshot the current state first, so restoring never loses work.
  const last = await prisma.moduleVersion.findFirst({ where: { moduleId }, orderBy: { versionNumber: 'desc' } });
  const nextNumber = (last?.versionNumber ?? 0) + 1;
  await prisma.moduleVersion.create({
    data: { moduleId, versionNumber: nextNumber, definition: module.definition, note: `Auto-saved before restoring v${version.versionNumber}`, createdBy: req.user.email },
  });

  const updated = await prisma.module.update({ where: { id: moduleId }, data: { definition: version.definition } });
  logActivity({ organizationId: null, userId: req.user.id, userEmail: req.user.email, action: 'module_version_restored', details: `"${module.name}" restored to v${version.versionNumber}` });
  res.json(formatModule(updated));
});

// -------------------------------------------------------- publishing ---
// Draft -> Preview -> Testing -> Approved -> Published. Always an
// explicit action a super admin takes here — nothing elsewhere in the
// builder ever changes a module's status on its own.
const MODULE_STATUS_ORDER = ['draft', 'preview', 'testing', 'approved', 'published'];

app.post('/api/superadmin/modules/:id/status', requireAuth, requireBuilderPermission('builder.edit'), async (req, res) => {
  const id = Number(req.params.id);
  const module = await prisma.module.findUnique({ where: { id } });
  if (!module) return res.status(404).json({ error: 'not_found' });
  const status = req.body?.status;
  if (!MODULE_STATUS_ORDER.includes(status)) return res.status(400).json({ error: 'invalid_status' });

  if (status === 'published') {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const granted = user.builderPermissions == null ? null : JSON.parse(user.builderPermissions || '[]');
    if (granted !== null && !granted.includes('builder.publish')) {
      return res.status(403).json({ error: 'missing_builder_permission', permission: 'builder.publish' });
    }
  }

  const updated = await prisma.module.update({ where: { id }, data: { status } });
  logActivity({ organizationId: null, userId: req.user.id, userEmail: req.user.email, action: 'module_status_changed', details: `"${module.name}": ${module.status} → ${status}` });
  res.json(formatModule(updated));
});

app.post('/api/superadmin/modules/:id/ai', requireAuth, requireBuilderPermission('builder.edit'), async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'server_misconfigured' });
  const id = Number(req.params.id);
  const module = await prisma.module.findUnique({ where: { id } });
  if (!module) return res.status(404).json({ error: 'not_found' });

  const { action, instruction, filePath, fileContent } = req.body || {};
  if (!MODULE_AI_ACTIONS[action]) return res.status(400).json({ error: 'invalid_action' });

  const prompt =
    `You are a coding assistant working inside the "${module.name}" module ` +
    `(a reusable module in a larger multi-tenant SaaS platform). ` +
    `${MODULE_AI_ACTIONS[action]}\n\n` +
    `File: ${filePath || '(untitled)'}\n` +
    `--- current file content ---\n${fileContent || '(empty file)'}\n--- end file content ---\n\n` +
    (instruction ? `Additional instruction from the developer: ${instruction}\n` : '') +
    `Never invent details about the rest of the project you have not been shown.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!response.ok) return res.status(502).json({ error: 'ai_unavailable' });
    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('\n');
    // Strip accidental markdown code fences, if the model added them anyway.
    const cleaned = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '');
    res.json({ action, result: cleaned.trim() });
  } catch (e) {
    res.status(502).json({ error: 'ai_unavailable' });
  }
});

app.delete('/api/superadmin/modules/:id', requireAuth, requireBuilderPermission('builder.delete'), async (req, res) => {
  const id = Number(req.params.id);
  const module = await prisma.module.findUnique({ where: { id } });
  if (!module) return res.status(404).json({ error: 'not_found' });
  await prisma.module.delete({ where: { id } });
  logActivity({ organizationId: null, userId: req.user.id, userEmail: req.user.email, action: 'module_deleted', details: `"${module.name}"` });
  res.json({ ok: true });
});

app.get('/api/superadmin/overview', requireAuth, requireSuperAdmin, async (req, res) => {
  const [companies, totalUsers, totalBranches, totalScans, recentActivity] = await Promise.all([
    prisma.organization.findMany({ include: { _count: { select: { branches: true, memberships: true } } } }),
    prisma.membership.count(),
    prisma.branch.count(),
    prisma.prescription.count(),
    prisma.activityLog.findMany({ include: { organization: true }, orderBy: { createdAt: 'desc' }, take: 6 }),
  ]);
  const byStatus = { trial: 0, active: 0, suspended: 0, expired: 0 };
  let estimatedMonthlyRevenue = 0;
  companies.forEach((c) => {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    const branchCount = c._count?.branches ?? 0;
    const monthlyEquivalent =
      c.billingCycle === 'yearly'
        ? (billingFor('yearly', branchCount).totalCost / 12)
        : billingFor('monthly', branchCount).totalCost;
    estimatedMonthlyRevenue += monthlyEquivalent;
  });

  // Last 12 months, oldest first — real counts, not projections.
  const monthKeys = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(d.toISOString().slice(0, 7));
  }
  const orgsByMonth = Object.fromEntries(monthKeys.map((k) => [k, 0]));
  companies.forEach((c) => {
    const key = c.createdAt.toISOString().slice(0, 7);
    if (key in orgsByMonth) orgsByMonth[key] += 1;
  });
  const scanRows = await prisma.prescription.findMany({
    where: { createdAt: { gte: new Date(monthKeys[0] + '-01') } },
    select: { createdAt: true },
  });
  const scansByMonth = Object.fromEntries(monthKeys.map((k) => [k, 0]));
  scanRows.forEach((r) => {
    const key = r.createdAt.toISOString().slice(0, 7);
    if (key in scansByMonth) scansByMonth[key] += 1;
  });

  const recentCompanies = [...companies]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5)
    .map((c) => formatCompany(c));

  res.json({
    totalCompanies: companies.length,
    activeCompanies: byStatus.active,
    trialCompanies: byStatus.trial,
    suspendedCompanies: byStatus.suspended,
    expiredCompanies: byStatus.expired,
    totalUsers,
    totalBranches,
    totalScans,
    estimatedMonthlyRevenue: Math.round(estimatedMonthlyRevenue * 100) / 100,
    organizationsGrowth: monthKeys.map((k) => ({ name: k, count: orgsByMonth[k] })),
    scansGrowth: monthKeys.map((k) => ({ name: k, count: scansByMonth[k] })),
    recentCompanies,
    recentActivity: recentActivity.map((l) => ({
      id: l.id,
      action: l.action,
      details: l.details,
      userEmail: l.userEmail,
      companyName: l.organization?.name ?? null,
      createdAt: l.createdAt,
    })),
  });
});

// Platform-wide audit trail — optionally filtered to one company.
app.get('/api/superadmin/activity-logs', requireAuth, requireSuperAdmin, async (req, res) => {
  const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
  const logs = await prisma.activityLog.findMany({
    where: companyId !== undefined ? { organizationId: companyId } : {},
    include: { organization: true },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json(
    logs.map((l) => ({
      id: l.id,
      action: l.action,
      details: l.details,
      userEmail: l.userEmail,
      companyName: l.organization?.name ?? null,
      createdAt: l.createdAt,
    })),
  );
});

app.get('/api/superadmin/companies', requireAuth, requireSuperAdmin, async (req, res) => {
  const companies = await prisma.organization.findMany({
    include: { _count: { select: { branches: true, memberships: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(companies.map(formatCompany));
});

app.get('/api/superadmin/companies/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const org = await prisma.organization.findUnique({
    where: { id },
    include: { _count: { select: { branches: true, memberships: true } } },
  });
  if (!org) return res.status(404).json({ error: 'not_found' });
  const [scanCount, memberships] = await Promise.all([
    prisma.prescription.count({ where: { branch: { organizationId: id } } }),
    prisma.membership.findMany({ where: { organizationId: id }, include: { user: true, branch: true } }),
  ]);
  res.json({ ...formatCompany(org), scanCount, users: memberships.map((m) => formatMember(m.user, m)) });
});

// Branch cards with live stats for one company — powers the super admin's
// drill-down: Companies → this company's branches → that branch's team.
app.get('/api/superadmin/companies/:id/branches', requireAuth, requireSuperAdmin, async (req, res) => {
  const organizationId = Number(req.params.id);
  const branches = await prisma.branch.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const stats = await Promise.all(
    branches.map(async (b) => {
      const [userCount, prescriptionCount, scansToday, pendingCount, manager] = await Promise.all([
        prisma.membership.count({ where: { branchId: b.id } }),
        prisma.prescription.count({ where: { branchId: b.id } }),
        prisma.prescription.count({ where: { branchId: b.id, createdAt: { gte: todayStart } } }),
        prisma.prescription.count({ where: { branchId: b.id, status: 'pending' } }),
        prisma.membership.findFirst({ where: { branchId: b.id, role: 'branch_manager' }, include: { user: true } }),
      ]);
      return {
        id: b.id,
        name: b.name,
        approved: b.approved,
        createdAt: b.createdAt,
        userCount,
        prescriptionCount,
        scansToday,
        pendingCount,
        managerEmail: manager?.user?.email ?? null,
      };
    }),
  );
  res.json(stats);
});

// Creates a company plus its first branch and first owner login in one
// call — this is how the super admin onboards a brand-new pharmacy. If
// the given admin email already has an account elsewhere, they're simply
// added as this company's owner rather than getting a duplicate login.
app.post('/api/superadmin/companies', requireAuth, requireSuperAdmin, async (req, res) => {
  const { name, phone, email, address, country, city, plan, billingCycle, branchName, adminEmail, adminPassword } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'missing_name' });
  const safePlan = ALLOWED_PLANS.includes(plan) ? plan : 'free';
  const safeBillingCycle = ALLOWED_BILLING_CYCLES.includes(billingCycle) ? billingCycle : 'monthly';

  try {
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: name.trim(),
          status: 'trial',
          plan: safePlan,
          billingCycle: safeBillingCycle,
          phone: phone || null,
          email: email || null,
          address: address || null,
          country: country || null,
          city: city || null,
        },
      });
      const branch = await tx.branch.create({
        data: { name: (branchName || 'Main Branch').trim(), organizationId: organization.id },
      });
      let adminUser = null;
      if (adminEmail) {
        adminUser = await tx.user.findUnique({ where: { email: adminEmail } });
        if (!adminUser) {
          if (!adminPassword || adminPassword.length < 4) throw new Error('password_too_short');
          const passwordHash = await bcrypt.hash(adminPassword, 10);
          adminUser = await tx.user.create({ data: { email: adminEmail, passwordHash } });
        }
        await tx.membership.create({
          data: { userId: adminUser.id, organizationId: organization.id, role: 'owner', branchId: branch.id },
        });
      }
      return { organization, branch, adminUser };
    });
    res.status(201).json({
      ...formatCompany({ ...result.organization, _count: { branches: 1, memberships: result.adminUser ? 1 : 0 } }),
    });
    logActivity({ organizationId: null, userId: req.user.id, userEmail: req.user.email, action: 'company_created', details: `Company "${result.organization.name}" (id ${result.organization.id})` });
  } catch (e) {
    res.status(409).json({ error: 'email_taken_or_invalid' });
  }
});

app.patch('/api/superadmin/companies/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, phone, email, address, country, city, expiryDate } = req.body || {};
  const data = {};
  if (name !== undefined) data.name = name;
  if (phone !== undefined) data.phone = phone;
  if (email !== undefined) data.email = email;
  if (address !== undefined) data.address = address;
  if (country !== undefined) data.country = country;
  if (city !== undefined) data.city = city;
  if (expiryDate !== undefined) data.expiryDate = expiryDate ? new Date(expiryDate) : null;
  const org = await prisma.organization
    .update({ where: { id }, data, include: { _count: { select: { branches: true, memberships: true } } } })
    .catch(() => null);
  if (!org) return res.status(404).json({ error: 'not_found' });
  res.json(formatCompany(org));
});

app.post('/api/superadmin/companies/:id/status', requireAuth, requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!ALLOWED_COMPANY_STATUSES.includes(status)) return res.status(400).json({ error: 'invalid_status' });
  const org = await prisma.organization
    .update({ where: { id }, data: { status }, include: { _count: { select: { branches: true, memberships: true } } } })
    .catch(() => null);
  if (!org) return res.status(404).json({ error: 'not_found' });
  res.json(formatCompany(org));
  logActivity({ organizationId: null, userId: req.user.id, userEmail: req.user.email, action: 'company_status_changed', details: `"${org.name}" → ${status}` });
  if (status === 'suspended' || status === 'expired') {
    notify({
      organizationId: org.id,
      userId: null,
      title: `Your company's account is now ${status}`,
      body: 'Contact the platform admin to reactivate your account.',
    });
  } else if (status === 'active') {
    notify({ organizationId: org.id, userId: null, title: 'Your company\'s account is now active', body: null });
  }
});

app.post('/api/superadmin/companies/:id/plan', requireAuth, requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { plan } = req.body || {};
  if (!ALLOWED_PLANS.includes(plan)) return res.status(400).json({ error: 'invalid_plan' });
  const org = await prisma.organization
    .update({ where: { id }, data: { plan }, include: { _count: { select: { branches: true, memberships: true } } } })
    .catch(() => null);
  if (!org) return res.status(404).json({ error: 'not_found' });
  res.json(formatCompany(org));
  logActivity({ organizationId: null, userId: req.user.id, userEmail: req.user.email, action: 'company_plan_changed', details: `"${org.name}" → ${plan}` });
});

// Per-branch billing cycle — cost is branchCount × the rate for this
// cycle (see backend/src/plans.js), independent of the plan tier above.
app.post('/api/superadmin/companies/:id/billing-cycle', requireAuth, requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { billingCycle } = req.body || {};
  if (!ALLOWED_BILLING_CYCLES.includes(billingCycle)) return res.status(400).json({ error: 'invalid_billing_cycle' });
  const org = await prisma.organization
    .update({ where: { id }, data: { billingCycle }, include: { _count: { select: { branches: true, memberships: true } } } })
    .catch(() => null);
  if (!org) return res.status(404).json({ error: 'not_found' });
  res.json(formatCompany(org));
  logActivity({ organizationId: null, userId: req.user.id, userEmail: req.user.email, action: 'company_billing_cycle_changed', details: `"${org.name}" → ${billingCycle}` });
});

app.delete('/api/superadmin/companies/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const org = await prisma.organization.findUnique({ where: { id } });
  await prisma.organization.delete({ where: { id } }).catch(() => {});
  if (org) {
    logActivity({ organizationId: null, userId: req.user.id, userEmail: req.user.email, action: 'company_deleted', details: `"${org.name}" (id ${id})` });
  }
  res.status(204).end();
});

// A suspended or expired company's users can still log in (so they see
// the warning) but every other endpoint is blocked until reactivated —
// enforced by checkCompanyActive, registered near the top of this file.

// ----------------------------------------------------------- OCR proxy ---
// Reads Kurdish, Arabic, and Latin script — the piece on-device OCR can't do.

const OCR_PROMPT =
  "This is a photo of a medical prescription (handwritten or printed), " +
  "possibly in Kurdish, Arabic, or English. Extract exactly: the doctor's " +
  "name, a phone number if visible anywhere on the slip, and the list of " +
  "medicine names written on it. Keep every name exactly as written in " +
  "its original script and language — do not translate or transliterate. " +
  'Reply with ONLY a JSON object of this exact shape, no other text: ' +
  '{"doctorName": string, "phone": string, "medicines": string[]}. ' +
  'If a field cannot be found, use "" for strings and [] for medicines.';

// Uses Google's Gemini API — the Flash models have a genuinely free tier
// (no credit card, no expiry, just a daily request cap), unlike Anthropic's
// one-time trial credit. Get a key at https://aistudio.google.com/apikey.
const GEMINI_MODEL = 'gemini-3.6-flash';

app.post('/api/scan', requireAuth, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'server_misconfigured', message: 'GEMINI_API_KEY is not set' });
  }

  const { imageBase64, mediaType } = req.body || {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'missing_image' });
  }
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const type = allowedTypes.includes(mediaType) ? mediaType : 'image/jpeg';

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: OCR_PROMPT },
              { inlineData: { mimeType: type, data: imageBase64 } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return res.status(502).json({ error: 'upstream_error', message: errText });
    }

    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || '')
      .join('\n');

    const parsed = extractJson(text);
    if (!parsed) return res.status(502).json({ error: 'unparseable_response' });

    res.json({
      doctorName: typeof parsed.doctorName === 'string' ? parsed.doctorName : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      medicines: Array.isArray(parsed.medicines) ? parsed.medicines.map(String) : [],
    });
  } catch (e) {
    res.status(500).json({ error: 'internal_error', message: String(e) });
  }
});

function extractJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (_) {
      return null;
    }
  }
}

module.exports = app;
