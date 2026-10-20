const db = require('../config/db');
const logger = require('./logger');

/**
 * Log an audit event to the database.
 * 
 * @param {Object} req - Express request object (to extract user, IP, and user-agent)
 * @param {Object} params - Audit parameters
 * @param {string} params.action - Action performed (e.g., 'Create', 'Update', 'Delete', 'Assign', 'Login')
 * @param {string} params.module - Target module (e.g., 'Assets', 'Tickets', 'Inventory', 'Users')
 * @param {number} [params.recordId] - ID of the affected database record
 * @param {Object|Array} [params.oldValues] - State before changes (will be stringified to JSON)
 * @param {Object|Array} [params.newValues] - State after changes (will be stringified to JSON)
 */
async function logAudit(req, { action, module, recordId = null, oldValues = null, newValues = null }) {
  try {
    const userId = req.user ? req.user.id : null;
    const username = req.user ? req.user.username : 'system';
    
    // Express client IP and User Agent extraction
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Stringify old/new values to JSON for database text columns
    const oldValuesStr = oldValues ? JSON.stringify(oldValues) : null;
    const newValuesStr = newValues ? JSON.stringify(newValues) : null;

    await db('audit_logs').insert({
      user_id: userId,
      username: username,
      action: action,
      module: module,
      record_id: recordId,
      old_values: oldValuesStr,
      new_values: newValuesStr,
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date()
    });

    logger.debug(`Audit logged successfully: ${action} on ${module} (Record ID: ${recordId}) by ${username}`);
  } catch (err) {
    // Fail-safe to avoid crashing the main application thread
    logger.error(`Failed to write audit log: ${err.message}`);
  }
}

module.exports = {
  logAudit
};
