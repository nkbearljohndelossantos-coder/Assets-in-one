const db = require('../config/db');
const { hashApiKey } = require('../utils/apiKeyUtils');
const { sendError } = require('../utils/apiResponse');
const { randomUUID } = require('crypto');

/**
 * Log Security Events (Auth failures, rate limit breaches, etc.)
 */
async function logSecurityEvent(eventType, severity, clientId, ipAddress, endpoint, details) {
  try {
    const exists = await db.schema.hasTable('security_events');
    if (!exists) return;

    await db('security_events').insert({
      id: randomUUID(),
      event_type: eventType,
      severity,
      client_id: clientId || null,
      ip_address: ipAddress || '0.0.0.0',
      endpoint: endpoint || '',
      details: typeof details === 'object' ? JSON.stringify(details) : String(details),
      created_at: new Date()
    });
  } catch (err) {
    console.error('Failed to log security event:', err.message);
  }
}

/**
 * Primary External API Key Authentication Middleware
 * Expects: Authorization: Bearer nkb_live_xxxxxxxxxxxxxxxxxxxxxxxxx
 */
async function apiKeyAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';

  if (!authHeader || typeof authHeader !== 'string') {
    await logSecurityEvent('AUTH_FAILURE', 'warning', null, ipAddress, req.originalUrl, 'Missing Authorization header');
    return sendError(res, 401, 'UNAUTHORIZED', 'Authorization header is required. Format: Authorization: Bearer <API_KEY>');
  }

  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    await logSecurityEvent('AUTH_FAILURE', 'warning', null, ipAddress, req.originalUrl, 'Invalid Authorization header format');
    return sendError(res, 401, 'UNAUTHORIZED', 'Invalid Authorization header format. Expected: Bearer <API_KEY>');
  }

  const rawKey = parts[1].trim();
  if (!rawKey.startsWith('nkb_live_')) {
    await logSecurityEvent('AUTH_FAILURE', 'warning', null, ipAddress, req.originalUrl, 'Invalid API Key prefix');
    return sendError(res, 401, 'UNAUTHORIZED', 'Invalid API key format. API keys must start with nkb_live_');
  }

  const keyHash = hashApiKey(rawKey);

  try {
    // Lookup key and joined client data
    const apiKey = await db('api_keys')
      .where('key_hash', keyHash)
      .first();

    if (!apiKey) {
      await logSecurityEvent('AUTH_FAILURE', 'warning', null, ipAddress, req.originalUrl, 'API Key not found in database');
      return sendError(res, 401, 'UNAUTHORIZED', 'Invalid or un-recognized API key provided.');
    }

    if (apiKey.status !== 'active') {
      await logSecurityEvent('REVOKED_KEY_ATTEMPT', 'warning', apiKey.client_id, ipAddress, req.originalUrl, `Attempted to use ${apiKey.status} key`);
      return sendError(res, 401, 'UNAUTHORIZED', `This API key has been ${apiKey.status}.`);
    }

    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      await logSecurityEvent('EXPIRED_KEY_ATTEMPT', 'warning', apiKey.client_id, ipAddress, req.originalUrl, 'API key expired');
      return sendError(res, 401, 'UNAUTHORIZED', 'This API key has expired.');
    }

    // Fetch Client App
    const client = await db('api_clients')
      .where('id', apiKey.client_id)
      .first();

    if (!client) {
      await logSecurityEvent('AUTH_FAILURE', 'error', apiKey.client_id, ipAddress, req.originalUrl, 'Client application missing');
      return sendError(res, 401, 'UNAUTHORIZED', 'Associated API client application no longer exists.');
    }

    if (client.status !== 'active') {
      await logSecurityEvent('DISABLED_CLIENT_ATTEMPT', 'warning', client.id, ipAddress, req.originalUrl, `Client status is ${client.status}`);
      return sendError(res, 403, 'FORBIDDEN', `API Client Application "${client.app_code}" is currently ${client.status}.`);
    }

    if (client.expires_at && new Date(client.expires_at) < new Date()) {
      await logSecurityEvent('EXPIRED_CLIENT_ATTEMPT', 'warning', client.id, ipAddress, req.originalUrl, 'Client subscription expired');
      return sendError(res, 403, 'FORBIDDEN', `API Client Application "${client.app_code}" access subscription has expired.`);
    }

    // Parse allowed scopes
    let scopes = [];
    try {
      scopes = typeof apiKey.allowed_scopes === 'string' ? JSON.parse(apiKey.allowed_scopes) : apiKey.allowed_scopes;
    } catch (e) {
      scopes = [];
    }

    // Attach Context to Request
    req.apiClient = {
      id: client.id,
      name: client.name,
      appCode: client.app_code,
      ownerEmail: client.owner_email,
      rateLimitPerMin: client.rate_limit_per_min,
      rateLimitPerHour: client.rate_limit_per_hour
    };

    req.apiKey = {
      id: apiKey.id,
      keyPrefix: apiKey.key_prefix,
      name: apiKey.name,
      allowedScopes: Array.isArray(scopes) ? scopes : [],
      customRateLimit: apiKey.custom_rate_limit
    };

    // Update last_used_at timestamps asynchronously
    const now = new Date();
    db('api_keys').where('id', apiKey.id).update({ last_used_at: now }).catch(() => {});
    db('api_clients').where('id', client.id).update({ last_used_at: now }).catch(() => {});

    next();
  } catch (err) {
    console.error('API Key Auth Middleware Error:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'An authentication error occurred while validating credentials.');
  }
}

module.exports = {
  apiKeyAuth,
  logSecurityEvent
};
