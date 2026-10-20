const { randomUUID } = require('crypto');

/**
 * Request ID Middleware
 * Generates or propagates a unique Request ID for every incoming HTTP request.
 */
function requestIdMiddleware(req, res, next) {
  const existingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const requestId = existingId && typeof existingId === 'string' ? existingId : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}

module.exports = requestIdMiddleware;
