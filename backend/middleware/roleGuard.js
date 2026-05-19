/**
 * Restrict access to specific roles.
 * Usage: router.get('/admin-only', authenticate, roleGuard('admin'), handler)
 *        router.get('/cook-or-admin', authenticate, roleGuard('cook', 'admin'), handler)
 */
function roleGuard(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'You do not have permission to access this resource' 
      });
    }

    next();
  };
}

module.exports = { roleGuard };
