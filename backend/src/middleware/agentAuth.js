const crypto = require('crypto');
const db = require('../config/db');
const logger = require('../utils/logger');

// In-memory replay cache: fast path with TTL 6 minutes
const nonceCache = new Map();
setInterval(async () => {
  const cutoff = Date.now() - 6 * 60 * 1000;
  for (const [nonce, ts] of nonceCache.entries()) {
    if (ts < cutoff) nonceCache.delete(nonce);
  }
  // Also prune database nonce table for entries older than 10 minutes
  try {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const hasNoncesTable = await db.schema.hasTable('wifi_agent_nonces');
    if (hasNoncesTable) {
      await db('wifi_agent_nonces').where('created_at', '<', tenMinAgo).del();
    }
  } catch (err) {
    // Non-fatal cleanup error
  }
}, 60 * 1000).unref();

/**
 * Middleware: Authenticate On-Premise Network Agent with Replay Protection
 */
async function authenticateNetworkAgent(req, res, next) {
  try {
    const agentUuid = req.header('X-Agent-UUID');
    const agentKey = req.header('X-Agent-Key');
    const agentTimestamp = req.header('X-Agent-Timestamp');
    const agentNonce = req.header('X-Agent-Nonce');

    if (!agentUuid || !agentKey) {
      return res.status(401).json({
        error: 'UNAUTHORIZED_AGENT',
        message: 'Missing agent credentials (X-Agent-UUID, X-Agent-Key required).'
      });
    }

    // 1. Replay Protection: Check timestamp window (within 5 minutes)
    if (agentTimestamp) {
      const reqTime = parseInt(agentTimestamp, 10);
      const now = Date.now();
      // If timestamp is older than 5 mins or in future by > 1 min
      if (isNaN(reqTime) || Math.abs(now - reqTime) > 5 * 60 * 1000) {
        logger.warn(`Agent ${agentUuid} telemetry rejected: timestamp skew > 5 minutes.`);
        return res.status(401).json({
          error: 'REQUEST_EXPIRED',
          message: 'Request timestamp is outside the allowed 5-minute synchronization window.'
        });
      }
    }

    // 2. Replay Protection: Multi-instance & restart safe nonce verification
    if (agentNonce) {
      // Fast path: in-memory cache check
      if (nonceCache.has(agentNonce)) {
        logger.warn(`Agent ${agentUuid} telemetry rejected: duplicate nonce replay detected (memory cache).`);
        return res.status(401).json({
          error: 'REPLAY_DETECTED',
          message: 'Nonce has already been processed. Replay attack prevented.'
        });
      }

      // Multi-instance persistent path: check DB
      try {
        const hasTable = await db.schema.hasTable('wifi_agent_nonces');
        if (hasTable) {
          const existingNonce = await db('wifi_agent_nonces').where('nonce', agentNonce).first();
          if (existingNonce) {
            logger.warn(`Agent ${agentUuid} telemetry rejected: duplicate nonce replay detected (database).`);
            nonceCache.set(agentNonce, Date.now());
            return res.status(401).json({
              error: 'REPLAY_DETECTED',
              message: 'Nonce has already been processed. Replay attack prevented.'
            });
          }
          await db('wifi_agent_nonces').insert({
            nonce: agentNonce,
            agent_uuid: agentUuid,
            created_at: db.fn.now()
          });
        }
      } catch (dbErr) {
        // If unique constraint violation occurs during concurrent insert
        if (dbErr.message && (dbErr.message.includes('UNIQUE') || dbErr.message.includes('Duplicate'))) {
          logger.warn(`Agent ${agentUuid} telemetry rejected: concurrent nonce collision.`);
          return res.status(401).json({
            error: 'REPLAY_DETECTED',
            message: 'Nonce has already been processed. Replay attack prevented.'
          });
        }
      }

      nonceCache.set(agentNonce, Date.now());
    }

    // 3. Lookup Agent by UUID
    const agent = await db('wifi_agent_credentials')
      .where('agent_uuid', agentUuid)
      .where('status', 'Active')
      .first();

    if (!agent) {
      logger.warn(`Network agent authentication failed: unknown or inactive UUID '${agentUuid}'.`);
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Agent UUID not found or has been revoked.'
      });
    }

    // 4. Verify SHA-256 API Key hash using constant-time comparison
    const incomingHash = crypto.createHash('sha256').update(agentKey).digest('hex');
    const bufferA = Buffer.from(incomingHash, 'utf8');
    const bufferB = Buffer.from(agent.api_key_hash, 'utf8');

    if (bufferA.length !== bufferB.length || !crypto.timingSafeEqual(bufferA, bufferB)) {
      logger.warn(`Network agent authentication failed: invalid key for '${agentUuid}'.`);
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid agent API key.'
      });
    }

    req.agent = agent;
    next();
  } catch (err) {
    logger.error(`Error in authenticateNetworkAgent: ${err.message}`);
    return res.status(500).json({ error: 'AGENT_AUTH_ERROR', message: 'Authentication failure' });
  }
}

module.exports = { authenticateNetworkAgent };
