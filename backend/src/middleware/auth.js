const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, role, branchId }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

function requireManagerOrAdmin(req, res, next) {
  if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireManagerOrAdmin };
