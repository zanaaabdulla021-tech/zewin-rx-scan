const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, role, branchId, organizationId }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

// Roles, from broadest to narrowest authority within one company:
//   owner          — full control of their own company, including other admins
//   company_admin  — manages branches/users/settings, but not other admins/the owner
//   branch_manager — reviews everything scanned at their one assigned branch
//   employee       — scans and sees only their own scans
//   viewer         — read-only: can see prescriptions and reports, nothing else
// (separately, "super_admin" is platform-level and belongs to no company)

const ORG_MANAGER_ROLES = ['owner', 'company_admin'];
const REVIEWER_ROLES = ['owner', 'company_admin', 'branch_manager'];
const READ_ONLY_ROLES = ['owner', 'company_admin', 'viewer'];
const SCANNER_ROLES = ['owner', 'company_admin', 'branch_manager', 'employee'];

// Manages branches, users, and company-wide settings.
function requireOrgManager(req, res, next) {
  if (!ORG_MANAGER_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

// Can approve/reject prescriptions (their own branch, or any branch for
// owner/company_admin).
function requireReviewer(req, res, next) {
  if (!REVIEWER_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

// Can see prescriptions/reports across the whole company (owner,
// company_admin) or read-only (viewer) — but never write anything.
function requireOrgWideRead(req, res, next) {
  if (!READ_ONLY_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

// Can scan and save a new prescription. Viewers cannot.
function requireScanner(req, res, next) {
  if (!SCANNER_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

// Platform-level: manages every company (organization) on the system.
function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

module.exports = {
  requireAuth,
  requireOrgManager,
  requireReviewer,
  requireOrgWideRead,
  requireScanner,
  requireSuperAdmin,
  ORG_MANAGER_ROLES,
  REVIEWER_ROLES,
  READ_ONLY_ROLES,
  SCANNER_ROLES,
};
