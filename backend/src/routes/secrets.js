const express = require('express');
const router = express.Router();
const secretsController = require('../controllers/secretsController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// This is a highly sensitive endpoint, ensuring strictly guarded reveal accesses
router.post('/reveal', authenticateToken, requirePermission('secrets.reveal'), secretsController.revealSecret);

module.exports = router;
