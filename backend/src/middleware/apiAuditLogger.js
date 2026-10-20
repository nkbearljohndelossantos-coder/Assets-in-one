const db = require('../config/db');
const { randomUUID } = require('crypto');

/**
 * Audit Logging Middleware for External API Requests.
 * Captures request metrics and stores permanent logs in api_audit_logs.
 */
function apiAuditLogger(req, res, next) {
  const startTime = Date.now();

  res.on('finish', async () => {
    try {
      const responseTimeMs = Date.now() - startTime;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      const clientId = req.apiClient ? req.apiClient.id : null;
      const apiKeyId = req.apiKey ? req.apiKey.id : null;
      const authStatus = req.apiKey ? 'authenticated' : (res.statusCode === 401 || res.statusCode === 403 ? 'failed' : 'unauthenticated');
      const scopesUsed = req.apiKey && req.apiKey.allowedScopes ? JSON.stringify(req.apiKey.allowedScopes) : null;

      // Sanitize request payload to prevent logging secret parameters
      let sanitizedPayload = null;
      if (req.body && Object.keys(req.body).length > 0) {
        const bodyCopy = { ...req.body };
        const sensitiveKeys = ['password', 'secret', 'apiKey', 'token', 'creditCard', 'cvv'];
        for (const key of Object.keys(bodyCopy)) {
          if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
            bodyCopy[key] = '[REDACTED]';
          }
        }
        sanitizedPayload = JSON.stringify(bodyCopy);
      }

      await db('api_audit_logs').insert({
        id: randomUUID(),
        request_id: req.requestId || randomUUID(),
        client_id: clientId,
        api_key_id: apiKeyId,
        endpoint: req.originalUrl || req.url,
        http_method: req.method,
        status_code: res.statusCode,
        response_time_ms: responseTimeMs,
        ip_address: ipAddress,
        user_agent: userAgent,
        auth_status: authStatus,
        scope_used: scopesUsed,
        error_code: res.errorCode || (res.statusCode >= 400 ? `HTTP_${res.statusCode}` : null),
        request_payload: sanitizedPayload,
        created_at: new Date()
      });
    } catch (err) {
      console.error('API Audit Logging Error:', err.message);
    }
  });

  next();
}

module.exports = {
  apiAuditLogger
};
