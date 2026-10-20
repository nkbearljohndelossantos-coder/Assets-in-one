const crypto = require('crypto');
const db = require('../../config/db');
const logger = require('../../utils/logger');

/**
 * Session Lifecycle & Authorization Token Generator for MeshCentral.
 */
class MeshCentralSessionService {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
  }

  async generateAuthorizedSessionUrl(deviceId, technicianId, accessMode, connectionType, nonce) {
    const rawToken = `${deviceId}:${technicianId}:${accessMode}:${nonce}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const requestHash = crypto.createHash('sha256').update(`${deviceId}:${technicianId}:${accessMode}`).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes single-use expiration

    await db('remote_session_authorizations').insert({
      token_hash: tokenHash,
      nonce: nonce,
      request_hash: requestHash,
      expires_at: expiresAt,
      is_used: false
    });

    const baseUrl = this.serverUrl || 'https://192.168.254.139';
    const sessionUrl = `${baseUrl}/?gotonode=${encodeURIComponent(deviceId)}&auth=${tokenHash}&mode=${accessMode}`;
    logger.info(`[MeshCentralSession] Generated short-lived authorization token for device ${deviceId}`);
    return { sessionUrl, tokenHash, expiresAt };
  }
}

module.exports = MeshCentralSessionService;
