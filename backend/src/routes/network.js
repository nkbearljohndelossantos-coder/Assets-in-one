const express = require('express');
const router = express.Router();
const networkController = require('../controllers/networkController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.use(authenticateToken);

// Devices
router.get('/devices', requirePermission('network.view'), networkController.getAllDevices);
router.post('/devices', requirePermission('network.manage'), networkController.createDevice);
router.get('/devices/:id', requirePermission('network.view'), networkController.getDeviceById);
router.put('/devices/:id', requirePermission('network.manage'), networkController.updateDevice);
router.delete('/devices/:id', requirePermission('network.manage'), networkController.deleteDevice);

// WiFi Access Points
router.get('/wifi', requirePermission('network.view'), networkController.getAllWifi);
router.post('/wifi', requirePermission('network.manage'), networkController.createWifi);
router.get('/wifi/:id', requirePermission('network.view'), networkController.getWifiById);
router.put('/wifi/:id', requirePermission('network.manage'), networkController.updateWifi);
router.delete('/wifi/:id', requirePermission('network.manage'), networkController.deleteWifi);

// User Network Assignments
router.get('/assignments', requirePermission('network.view'), networkController.getAllAssignments);
router.post('/assignments', requirePermission('network.manage'), networkController.createAssignment);
router.get('/assignments/:id', requirePermission('network.view'), networkController.getAssignmentById);
router.put('/assignments/:id', requirePermission('network.manage'), networkController.updateAssignment);
router.delete('/assignments/:id', requirePermission('network.manage'), networkController.deleteAssignment);

module.exports = router;
