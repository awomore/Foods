const jwt = require('jsonwebtoken');
const { sql } = require('../supabase/db');

/**
 * A creator's account (role 'cook') can also order from other creators: the
 * app has a customer mode and sends `X-Active-Mode: customer` while in it.
 *
 *   req.user.role         — the side this request acts for. Drives "which list
 *                           do I get" decisions (my orders vs my kitchen's orders).
 *   req.user.account_role — the stored role. Use it for "is this user a party to
 *                           this record" checks, so a creator can always open
 *                           their own kitchen's records whatever mode the app is in.
 *
 * Only cook → customer is honoured; the header can never raise a role, and
 * requests without it (older app builds, the web) keep the stored role.
 */
function applyActiveMode(req, user) {
  const account_role = user.role;
  const mode = String(req.headers['x-active-mode'] ?? '').toLowerCase();
  const role = account_role === 'cook' && mode === 'customer' ? 'customer' : account_role;
  return { ...user, role, account_role };
}

/**
 * Authenticate request using JWT token from Authorization header.
 * Sets req.user with { id, role, phone, full_name }
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const users = await sql`
      SELECT id, full_name, phone, role, is_active
      FROM users WHERE id = ${decoded.userId}
    `;
    const user = users[0];

    if (!user) return res.status(401).json({ error: 'Invalid token' });
    if (!user.is_active) return res.status(403).json({ error: 'Account is deactivated' });

    req.user = applyActiveMode(req, user);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    // DB or unexpected error — return 503 so the client knows to retry
    console.error('[Auth] Middleware error:', err);
    return res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
  }
}

// Attaches req.user if a valid token is present, but does not block unauthenticated requests
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  try {
    const token = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const users = await sql`SELECT id, full_name, phone, role FROM users WHERE id = ${token.userId} AND is_active = true`;
    if (users[0]) req.user = applyActiveMode(req, users[0]);
  } catch {}
  next();
}

module.exports = { authenticate, optionalAuth, applyActiveMode };
