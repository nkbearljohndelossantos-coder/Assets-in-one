const { sendError } = require('../utils/apiResponse');
const { logSecurityEvent } = require('./apiKeyAuth');

/**
 * Middleware factory to enforce granular scope-based access control.
 * @param {string | string[]} requiredScopes - Single scope or array of scopes required (ALL must be present unless wildcard '*')
 */
function requireScope(requiredScopes) {
  const needed = Array.isArray(requiredScopes) ? requiredScopes : [requiredScopes];

  return async (req, res, next) => {
    if (!req.apiKey || !Array.isArray(req.apiKey.allowedScopes)) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Authentication context missing.');
    }

    const clientScopes = req.apiKey.allowedScopes;

    // Check if client has wildcard full access '*'
    if (clientScopes.includes('*')) {
      return next();
    }

    // Check if client has all required scopes
    const hasAllScopes = needed.every(scope => clientScopes.includes(scope));

    if (!hasAllScopes) {
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
      const clientId = req.apiClient ? req.apiClient.id : null;

      await logSecurityEvent(
        'SCOPE_VIOLATION',
        'warning',
        clientId,
        ipAddress,
        req.originalUrl,
        `Client lacked required scope(s): ${needed.join(', ')}. Granted scopes: ${clientScopes.join(', ')}`
      );

      return sendError(
        res,
        403,
        'INSUFFICIENT_SCOPES',
        `Access denied. Client application does not possess required API scope(s): ${needed.join(', ')}`,
        { requiredScopes: needed, grantedScopes: clientScopes }
      );
    }

    next();
  };
}

module.exports = {
  requireScope
};
