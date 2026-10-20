const db = require('../config/db');
const { sendError } = require('../utils/apiResponse');
const { randomUUID } = require('crypto');

/**
 * Idempotency Middleware for API v1 POST/PUT/PATCH endpoints
 * Prevents duplicate operation execution when client sends `Idempotency-Key` header.
 */
function idempotencyMiddleware(options = {}) {
  const ttlMs = options.ttlMs || 86400 * 1000; // 24 hours default expiration

  return async (req, res, next) => {
    // Only check idempotency for state-modifying HTTP methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
      return next();
    }

    const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    // If client did not supply key, proceed normally
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return next();
    }

    const trimmedKey = idempotencyKey.trim();
    if (trimmedKey.length < 8 || trimmedKey.length > 128) {
      return sendError(res, 400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key must be between 8 and 128 characters.');
    }

    const clientId = req.apiClient ? req.apiClient.id : 'anonymous';

    try {
      // Check existing record
      const existing = await db('idempotency_records')
        .where('client_id', clientId)
        .where('idempotency_key', trimmedKey)
        .first();

      if (existing) {
        // Check if expired
        if (existing.expires_at && new Date(existing.expires_at) < new Date()) {
          // Record expired, delete and allow retry
          await db('idempotency_records').where('id', existing.id).del();
        } else if (existing.status === 'processing') {
          return sendError(
            res,
            409,
            'CONCURRENT_IDEMPOTENT_REQUEST',
            'A request with this Idempotency-Key is currently being processed. Please wait.'
          );
        } else if (existing.status === 'completed') {
          // Return cached response
          res.setHeader('X-Cache-Lookup', 'IDEMPOTENT_HIT');
          res.setHeader('Content-Type', 'application/json');
          return res.status(existing.response_status).send(existing.response_body);
        }
      }

      // Create new processing record
      const recordId = randomUUID();
      const expiresAt = new Date(Date.now() + ttlMs);

      await db('idempotency_records').insert({
        id: recordId,
        client_id: clientId,
        idempotency_key: trimmedKey,
        request_path: req.originalUrl || req.url,
        request_method: req.method,
        response_status: null,
        response_body: null,
        status: 'processing',
        created_at: new Date(),
        expires_at: expiresAt
      });

      // Intercept res.send and res.json to capture response
      const originalSend = res.send;
      let sendCalled = false;

      res.send = function (body) {
        if (!sendCalled) {
          sendCalled = true;

          let responseString = body;
          if (typeof body === 'object' && body !== null && !Buffer.isBuffer(body)) {
            responseString = JSON.stringify(body);
          } else if (Buffer.isBuffer(body)) {
            responseString = body.toString('utf-8');
          }

          // Asynchronously update record status to completed
          db('idempotency_records')
            .where('id', recordId)
            .update({
              status: 'completed',
              response_status: res.statusCode,
              response_body: responseString
            })
            .catch(err => {
              console.error('Failed to update idempotency record:', err.message);
            });
        }

        return originalSend.apply(res, arguments);
      };

      next();
    } catch (err) {
      console.error('Idempotency Middleware Error:', err);
      // Fail open if database error occurs during idempotency check
      next();
    }
  };
}

module.exports = {
  idempotencyMiddleware
};
