const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth'); // Standard JWT user auth for admin dashboard
const { generateApiKey, hashApiKey, maskApiKey } = require('../utils/apiKeyUtils');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { randomUUID } = require('crypto');

// Enforce standard JWT auth for admin endpoints
router.use(authenticateToken);

/**
 * GET /api/admin/api-clients
 * List all API client applications with keys overview
 */
router.get('/', async (req, res) => {
  try {
    const clients = await db('api_clients').select('*').orderBy('created_at', 'desc');

    // Fetch key summaries for each client
    const clientIds = clients.map(c => c.id);
    const keys = await db('api_keys').whereIn('client_id', clientIds);

    const result = clients.map(client => {
      const clientKeys = keys.filter(k => k.client_id === client.id);
      return {
        ...client,
        allowed_scopes: typeof client.allowed_scopes === 'string' ? JSON.parse(client.allowed_scopes) : client.allowed_scopes,
        keys: clientKeys.map(k => ({
          id: k.id,
          name: k.name,
          keyPrefix: k.key_prefix,
          maskedKey: k.masked_key,
          status: k.status,
          allowedScopes: typeof k.allowed_scopes === 'string' ? JSON.parse(k.allowed_scopes) : k.allowed_scopes,
          lastUsedAt: k.last_used_at,
          expiresAt: k.expires_at,
          createdAt: k.created_at
        }))
      };
    });

    return sendSuccess(res, result);
  } catch (err) {
    console.error('Error fetching API Clients:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve API client applications.');
  }
});

/**
 * POST /api/admin/api-clients
 * Create a new API Client Application
 */
router.post('/', async (req, res) => {
  try {
    const { name, appCode, description, ownerEmail, rateLimitPerMin, rateLimitPerHour, scopes } = req.body;

    if (!name || !appCode || !ownerEmail) {
      return sendError(res, 400, 'BAD_REQUEST', 'name, appCode, and ownerEmail are required fields.');
    }

    // Check duplicate appCode
    const existing = await db('api_clients').where('app_code', appCode).first();
    if (existing) {
      return sendError(res, 409, 'CONFLICT', `An application with app_code '${appCode}' already exists.`);
    }

    const clientId = randomUUID();
    const allowedScopesJson = JSON.stringify(scopes || ['documents:read', 'assets:read']);

    const newClient = {
      id: clientId,
      name,
      app_code: appCode.toUpperCase(),
      description: description || '',
      owner_email: ownerEmail,
      status: 'active',
      allowed_scopes: allowedScopesJson,
      rate_limit_per_min: rateLimitPerMin || 100,
      rate_limit_per_hour: rateLimitPerHour || 1000,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('api_clients').insert(newClient);

    // Automatically generate initial primary API Key for the new client
    const keyData = generateApiKey('nkb_live_');
    const keyHash = hashApiKey(keyData.rawKey);
    const keyId = randomUUID();

    await db('api_keys').insert({
      id: keyId,
      client_id: clientId,
      key_prefix: keyData.keyPrefix,
      key_hash: keyHash,
      masked_key: keyData.maskedKey,
      name: 'Primary Live Key',
      allowed_scopes: allowedScopesJson,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    });

    return sendSuccess(
      res,
      {
        client: {
          ...newClient,
          allowed_scopes: JSON.parse(allowedScopesJson)
        },
        apiKey: {
          id: keyId,
          name: 'Primary Live Key',
          maskedKey: keyData.maskedKey,
          // CRITICAL: Raw API key is shown ONCE to admin upon creation!
          rawApiKey: keyData.rawKey,
          warning: 'Store this raw API key safely. It will NEVER be shown again!'
        }
      },
      {},
      201
    );
  } catch (err) {
    console.error('Error creating API Client:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to create API client application.');
  }
});

/**
 * POST /api/admin/api-clients/:id/keys
 * Generate an additional API Key for a client application
 */
router.post('/:id/keys', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, scopes, customRateLimit, expiresAt } = req.body;

    const client = await db('api_clients').where('id', id).first();
    if (!client) {
      return sendError(res, 404, 'NOT_FOUND', 'API client application not found.');
    }

    const keyData = generateApiKey('nkb_live_');
    const keyHash = hashApiKey(keyData.rawKey);
    const keyId = randomUUID();
    const scopesJson = JSON.stringify(scopes || JSON.parse(client.allowed_scopes || '[]'));

    const newKeyRecord = {
      id: keyId,
      client_id: client.id,
      key_prefix: keyData.keyPrefix,
      key_hash: keyHash,
      masked_key: keyData.maskedKey,
      name: name || 'API Key',
      allowed_scopes: scopesJson,
      custom_rate_limit: customRateLimit || null,
      status: 'active',
      expires_at: expiresAt ? new Date(expiresAt) : null,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('api_keys').insert(newKeyRecord);

    return sendSuccess(
      res,
      {
        id: keyId,
        clientId: client.id,
        name: newKeyRecord.name,
        maskedKey: keyData.maskedKey,
        rawApiKey: keyData.rawKey,
        allowedScopes: JSON.parse(scopesJson),
        expiresAt: newKeyRecord.expires_at,
        warning: 'Store this raw API key safely. It will NEVER be shown again!'
      },
      {},
      201
    );
  } catch (err) {
    console.error('Error generating API key:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to generate API key.');
  }
});

/**
 * POST /api/admin/api-clients/keys/:keyId/rotate
 * Rotate an existing API key (revokes target key, creates new replacement key)
 */
router.post('/keys/:keyId/rotate', async (req, res) => {
  try {
    const { keyId } = req.params;
    const oldKey = await db('api_keys').where('id', keyId).first();

    if (!oldKey) {
      return sendError(res, 404, 'NOT_FOUND', 'API key not found.');
    }

    // Revoke old key
    await db('api_keys').where('id', keyId).update({
      status: 'revoked',
      revoked_at: new Date(),
      updated_at: new Date()
    });

    // Generate replacement key
    const keyData = generateApiKey('nkb_live_');
    const keyHash = hashApiKey(keyData.rawKey);
    const newKeyId = randomUUID();

    const newKeyRecord = {
      id: newKeyId,
      client_id: oldKey.client_id,
      key_prefix: keyData.keyPrefix,
      key_hash: keyHash,
      masked_key: keyData.maskedKey,
      name: `${oldKey.name} (Rotated ${new Date().toISOString().slice(0, 10)})`,
      allowed_scopes: oldKey.allowed_scopes,
      custom_rate_limit: oldKey.custom_rate_limit,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('api_keys').insert(newKeyRecord);

    return sendSuccess(res, {
      oldKeyId: oldKey.id,
      newKeyId,
      maskedKey: keyData.maskedKey,
      rawApiKey: keyData.rawKey,
      warning: 'Store this replacement raw API key safely. It will NEVER be shown again!'
    });
  } catch (err) {
    console.error('Error rotating API key:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to rotate API key.');
  }
});

/**
 * POST /api/admin/api-clients/keys/:keyId/revoke
 * Revoke an API key permanently
 */
router.post('/keys/:keyId/revoke', async (req, res) => {
  try {
    const { keyId } = req.params;
    const key = await db('api_keys').where('id', keyId).first();

    if (!key) {
      return sendError(res, 404, 'NOT_FOUND', 'API key not found.');
    }

    await db('api_keys').where('id', keyId).update({
      status: 'revoked',
      revoked_at: new Date(),
      updated_at: new Date()
    });

    return sendSuccess(res, { message: `API Key '${key.masked_key}' has been revoked successfully.` });
  } catch (err) {
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to revoke API key.');
  }
});

/**
 * GET /api/admin/api-clients/scopes
 * List all available system permissions/scopes
 */
router.get('/scopes', async (req, res) => {
  try {
    const scopes = await db('api_scopes').select('*').orderBy('resource', 'asc');
    return sendSuccess(res, scopes);
  } catch (err) {
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch API scopes.');
  }
});

/**
 * GET /api/admin/api-clients/audit-logs
 * Permanent Audit Log viewer with filters and pagination
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
    const offset = (page - 1) * limit;

    let query = db('api_audit_logs');
    if (req.query.clientId) query = query.where('client_id', req.query.clientId);
    if (req.query.authStatus) query = query.where('auth_status', req.query.authStatus);
    if (req.query.endpoint) query = query.where('endpoint', 'like', `%${req.query.endpoint}%`);

    const [{ count }] = await query.clone().count('* as count');
    const totalRecords = parseInt(count, 10);
    const logs = await query.select('*').orderBy('created_at', 'desc').limit(limit).offset(offset);

    return sendSuccess(res, logs, {
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch audit logs.');
  }
});

/**
 * GET /api/admin/api-clients/stats
 * Dashboard usage metrics and statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const [{ totalClients }] = await db('api_clients').count('* as totalClients');
    const [{ activeClients }] = await db('api_clients').where('status', 'active').count('* as activeClients');
    const [{ totalKeys }] = await db('api_keys').count('* as totalKeys');
    const [{ totalRequests }] = await db('api_audit_logs').count('* as totalRequests');
    const [{ failedRequests }] = await db('api_audit_logs').where('status_code', '>=', 400).count('* as failedRequests');
    const [{ rateLimitedRequests }] = await db('api_audit_logs').where('status_code', 429).count('* as rateLimitedRequests');

    const recentLogs = await db('api_audit_logs').select('response_time_ms').orderBy('created_at', 'desc').limit(100);
    const avgResponseTime = recentLogs.length > 0
      ? Math.round(recentLogs.reduce((acc, curr) => acc + (curr.response_time_ms || 0), 0) / recentLogs.length)
      : 0;

    return sendSuccess(res, {
      totalClients: parseInt(totalClients, 10),
      activeClients: parseInt(activeClients, 10),
      totalKeys: parseInt(totalKeys, 10),
      totalRequests: parseInt(totalRequests, 10),
      failedRequests: parseInt(failedRequests, 10),
      rateLimitedRequests: parseInt(rateLimitedRequests, 10),
      avgResponseTimeMs: avgResponseTime
    });
  } catch (err) {
    console.error('Error fetching API stats:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch API stats.');
  }
});

module.exports = router;
