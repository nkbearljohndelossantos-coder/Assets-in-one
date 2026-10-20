/**
 * Standardized API Response Formatter
 * 
 * Success Format:
 * {
 *   "success": true,
 *   "data": {},
 *   "meta": {
 *     "requestId": "uuid-v4",
 *     "timestamp": "2026-10-06T11:00:00.000Z"
 *   }
 * }
 * 
 * Error Format:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "Human readable message",
 *     "details": []
 *   },
 *   "meta": {
 *     "requestId": "uuid-v4",
 *     "timestamp": "2026-10-06T11:00:00.000Z"
 *   }
 * }
 */

function sendSuccess(res, data = {}, statusCode = 200, additionalMeta = {}) {
  const requestId = res.req?.requestId || res.getHeader('X-Request-Id') || 'unknown';
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      ...additionalMeta
    }
  });
}

function sendError(res, statusCode = 400, code = 'INVALID_REQUEST', message = 'The request is invalid.', details = [], additionalMeta = {}) {
  const requestId = res.req?.requestId || res.getHeader('X-Request-Id') || 'unknown';
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details: Array.isArray(details) ? details : [details]
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      ...additionalMeta
    }
  });
}

module.exports = {
  sendSuccess,
  sendError
};
