const express = require('express');
const router = express.Router();
const websitesController = require('../controllers/websitesController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', requirePermission('websites.view'), websitesController.getAllWebsites);
router.post('/', requirePermission('websites.manage'), websitesController.createWebsite);
router.get('/:id', requirePermission('websites.view'), websitesController.getWebsiteById);
router.put('/:id', requirePermission('websites.manage'), websitesController.updateWebsite);
router.delete('/:id', requirePermission('websites.manage'), websitesController.deleteWebsite);

router.get('/:id/logs', requirePermission('websites.view'), websitesController.getWebsiteLogs);
router.post('/:id/check', requirePermission('websites.manage'), websitesController.checkWebsiteNow);

module.exports = router;

