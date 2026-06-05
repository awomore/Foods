const jwt = require('jsonwebtoken');
const { sql } = require('../supabase/db');

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

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Attaches req.user if a valid token is present, but does not block unauthenticated requests
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  try {
    const token = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const users = await sql`SELECT id, full_name, phone, role FROM users WHERE id = ${token.userId} AND is_active = true`;
    if (users[0]) req.user = users[0];
  } catch {}
  next();
}

module.exports = { authenticate, optionalAuth };
