const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// Get all audit logs (paginated, filtered, read-only)
router.get('/', authenticateToken, requirePermission('audit_logs.view'), async (req, res) => {
  const { page = 1, limit = 20, search = '', module = '', action = '' } = req.query;

  try {
    const query = db('audit_logs');

    if (search) {
      query.where((builder) => {
        builder.where('username', 'like', `%${search}%`)
          .orWhere('action', 'like', `%${search}%`)
          .orWhere('module', 'like', `%${search}%`)
          .orWhere('ip_address', 'like', `%${search}%`);
      });
    }

    if (module) query.where('module', module);
    if (action) query.where('action', action);

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Parse JSON string fields for the UI
    const formattedData = data.map(log => ({
      ...log,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null
    }));

    return res.json({
      success: true,
      data: {
        logs: formattedData,
        pagination: {
          total: parseInt(count),
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });

  } catch (err) {
    logger.error(`Get audit logs list error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve audit logs.' });
  }
});

module.exports = router;
