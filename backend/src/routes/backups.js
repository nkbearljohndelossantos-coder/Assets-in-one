const express = require('express');
const router = express.Router();
const backupsController = require('../controllers/backupsController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', requirePermission('backups.view'), backupsController.getAllBackups);
router.post('/', requirePermission('backups.create'), backupsController.createBackup);
router.get('/:id', requirePermission('backups.view'), backupsController.getBackupById);
router.put('/:id', requirePermission('backups.create'), backupsController.updateBackup);
router.post('/:id/verify', requirePermission('backups.verify'), backupsController.verifyBackup);
router.delete('/:id', requirePermission('backups.create'), backupsController.deleteBackup);

module.exports = router;
