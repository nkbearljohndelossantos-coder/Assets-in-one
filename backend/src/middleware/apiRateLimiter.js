const { sendError } = require('../utils/apiResponse');
const { logSecurityEvent } = require('./apiKeyAuth');

// In-memory request tracking store: clientId/ip -> Array of timestamps
const requestBuckets = new Map();

// Periodic cleanup of stale entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  const windowMs = 3600 * 1000; // 1 hour max window
  for (const [key, timestamps] of requestBuckets.entries()) {
    const valid = timestamps.filter(t => now - t < windowMs);
    if (valid.length === 0) {
      requestBuckets.delete(key);
    } else {
      requestBuckets.set(key, valid);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Flexible per-client and per-IP Rate Limiting Middleware
 * Reads limits from req.apiKey / req.apiClient or defaults to parameters.
 */
function apiRateLimiter(options = {}) {
  const defaultPerMin = options.defaultPerMin || 100;
  const defaultPerHour = options.defaultPerHour || 1000;

  return async (req, res, next) => {
    const now = Date.now();
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';

    // Identifier is Client ID if authenticated, else IP Address
    const clientId = req.apiClient ? req.apiClient.id : null;
    const bucketKey = clientId ? `client_${clientId}` : `ip_${ipAddress}`;

    // Determine configured limits
    let limitPerMin = defaultPerMin;
    let limitPerHour = defaultPerHour;

    if (req.apiClient) {
      limitPerMin = req.apiClient.rateLimitPerMin || defaultPerMin;
      limitPerHour = req.apiClient.rateLimitPerHour || defaultPerHour;
    }
    if (req.apiKey && req.apiKey.customRateLimit) {
      limitPerMin = req.apiKey.customRateLimit;
    }

    if (!requestBuckets.has(bucketKey)) {
      requestBuckets.set(bucketKey, []);
    }

    const timestamps = requestBuckets.get(bucketKey);

    // Filter requests in the last minute (60s) and last hour (3600s)
    const minAgo = now - 60 * 1000;
    const hourAgo = now - 3600 * 1000;

    const requestsInLastMin = timestamps.filter(t => t > minAgo);
    const requestsInLastHour = timestamps.filter(t => t > hourAgo);

    // Rate limit check
    const isMinExceeded = requestsInLastMin.length >= limitPerMin;
    const isHourExceeded = requestsInLastHour.length >= limitPerHour;

    if (isMinExceeded || isHourExceeded) {
      const oldestInMin = requestsInLastMin[0] || now;
      const oldestInHour = requestsInLastHour[0] || now;
      const resetTimeMs = isMinExceeded ? oldestInMin + 60000 : oldestInHour + 3600000;
      const retryAfterSec = Math.max(1, Math.ceil((resetTimeMs - now) / 1000));

      res.setHeader('X-RateLimit-Limit', limitPerMin);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetTimeMs / 1000));
      res.setHeader('Retry-After', retryAfterSec);

      await logSecurityEvent(
        'RATE_LIMIT_EXCEEDED',
        'warning',
        clientId,
        ipAddress,
        req.originalUrl,
        `Rate limit exceeded: ${isMinExceeded ? 'Minute limit' : 'Hour limit'}. Requests in min: ${requestsInLastMin.length}/${limitPerMin}, hour: ${requestsInLastHour.length}/${limitPerHour}`
      );

      return sendError(
        res,
        429,
        'RATE_LIMIT_EXCEEDED',
        'Too many requests. Rate limit exceeded. Please try again later.',
        {
          limitPerMin,
          limitPerHour,
          retryAfterSeconds: retryAfterSec
        }
      );
    }

    // Record this request
    timestamps.push(now);
    // Keep array bounded to last hour
    const trimmed = timestamps.filter(t => t > hourAgo);
    requestBuckets.set(bucketKey, trimmed);

    // Set standard RateLimit headers for successful requests
    const remainingMin = Math.max(0, limitPerMin - trimmed.filter(t => t > minAgo).length);
    res.setHeader('X-RateLimit-Limit', limitPerMin);
    res.setHeader('X-RateLimit-Remaining', remainingMin);
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + 60000) / 1000));

    next();
  };
}

module.exports = {
  apiRateLimiter
};
