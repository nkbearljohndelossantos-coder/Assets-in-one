const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

// Get all notifications for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await db('notifications')
      .where('user_id', req.user.id)
      .orderBy('created_at', 'desc')
      .limit(50); // limit to recent 50 notifications

    const [{ unreadCount }] = await db('notifications')
      .where({ user_id: req.user.id, is_read: false })
      .count('* as unreadCount');

    return res.json({
      success: true,
      data: {
        notifications,
        unreadCount: parseInt(unreadCount)
      }
    });
  } catch (err) {
    logger.error(`Get notifications error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve notifications.' });
  }
});

// Mark single notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const notify = await db('notifications').where({ id, user_id: req.user.id }).first();
    if (!notify) return res.status(404).json({ success: false, message: 'Notification not found.' });

    await db('notifications').where('id', id).update({ is_read: true });

    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    logger.error(`Mark notification read error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
});

// Mark all as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await db('notifications')
      .where({ user_id: req.user.id, is_read: false })
      .update({ is_read: true });

    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    logger.error(`Mark all notifications read error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update notifications.' });
  }
});

module.exports = router;
