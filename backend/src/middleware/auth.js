const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  // Fallback to query parameter (useful for file downloads/PDF receipts/QR images opened in browser tabs)
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Access token required.'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_123456_nkb_itms', (err, user) => {
    if (err) {
      logger.warn(`JWT verification failed: ${err.message}`);
      return res.status(403).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired access token.'
      });
    }

    // Normalize user object across ITMS & PPE conventions
    user.id = user.id || user.sub;
    user.sub = user.sub || user.id;
    user.username = user.username || user.email || `user_${user.id}`;
    user.fullName = user.fullName || user.name || user.username;
    if (!user.roles) {
      user.roles = user.role ? [user.role] : ['STAFF'];
    }
    user.role = user.role || user.roles[0] || 'STAFF';
    user.permissions = Array.isArray(user.permissions) ? user.permissions : [];

    req.user = user;
    next();
  });
};

const requirePermission = (permissionCode) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Unauthorized. User authentication required.'
      });
    }

    // Super Admin, IT Manager, and ADMIN bypass individual permission checks
    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : (req.user.role ? [req.user.role] : []);
    if (userRoles.some(r => ['Super Admin', 'IT Manager', 'Admin', 'ADMIN'].includes(r))) {
      return next();
    }

    if (req.user.permissions && req.user.permissions.includes(permissionCode)) {
      return next();
    }

    logger.warn(`User ${req.user.username} was denied permission to ${permissionCode}`);
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: `Forbidden. You do not have the required permission (${permissionCode}) to perform this action.`
    });
  };
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Unauthorized. User authentication required.'
      });
    }

    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : (req.user.role ? [req.user.role] : []);
    // Map between ITMS and PPE role naming
    const normalizedUserRoles = userRoles.map(r => {
      const up = String(r).toUpperCase();
      if (up === 'SUPER ADMIN' || up === 'ADMIN') return 'ADMIN';
      if (up === 'IT MANAGER' || up === 'IT STAFF' || up === 'STAFF') return 'STAFF';
      return up;
    });

    const normalizedAllowed = allowedRoles.map(r => String(r).toUpperCase());

    const hasMatch = userRoles.some(r => allowedRoles.includes(r)) ||
      normalizedUserRoles.some(r => normalizedAllowed.includes(r)) ||
      userRoles.includes('Super Admin');

    if (!hasMatch) {
      logger.warn(`User ${req.user.username} denied access. Required roles: ${allowedRoles.join(', ')}`);
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Forbidden. You do not have the required role to perform this action.'
      });
    }

    return next();
  };
};

module.exports = {
  authenticateToken,
  requirePermission,
  requireRole,
  requireAuth: authenticateToken // Alias for PPE compatibility
};
