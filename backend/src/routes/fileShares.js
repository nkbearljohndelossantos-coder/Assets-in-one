const express = require('express');
const router = express.Router();
const fileSharesController = require('../controllers/fileSharesController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', requirePermission('file_shares.view'), fileSharesController.getAllFileShares);
router.post('/', requirePermission('file_shares.manage'), fileSharesController.createFileShare);
router.get('/:id', requirePermission('file_shares.view'), fileSharesController.getFileShareById);
router.put('/:id', requirePermission('file_shares.manage'), fileSharesController.updateFileShare);
router.delete('/:id', requirePermission('file_shares.manage'), fileSharesController.deleteFileShare);

// Permissions Mappings
router.get('/:id/permissions', requirePermission('file_shares.view'), fileSharesController.getPermissions);
router.post('/:id/permissions', requirePermission('file_shares.manage'), fileSharesController.createPermission);
router.delete('/:id/permissions/:permId', requirePermission('file_shares.manage'), fileSharesController.removePermission);

module.exports = router;
