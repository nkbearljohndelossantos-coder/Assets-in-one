const express = require('express');
const router = express.Router();
const wifiMonitorController = require('../controllers/wifiMonitorController');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { authenticateNetworkAgent } = require('../middleware/agentAuth');

// ==========================================
// 1. ON-PREMISE AGENT TELEMETRY (SECURE REVERSIBLE CREDENTIAL AUTH)
// ==========================================
router.post('/telemetry', authenticateNetworkAgent, wifiMonitorController.ingestTelemetry);

// ==========================================
// 2. ADMIN USER WEB INTERFACE (JWT + ROLE PERMISSIONS)
// ==========================================
router.use(authenticateToken);

// Overview & Connected Devices
router.get('/overview', requirePermission('wifi_monitor.view'), wifiMonitorController.getOverview);
router.get('/devices', requirePermission('wifi_monitor.view'), wifiMonitorController.getDevices);
router.get('/routers', requirePermission('wifi_monitor.view'), wifiMonitorController.getRouters);
router.get('/logs', requirePermission('wifi_monitor.view'), wifiMonitorController.getLogs);

// Trusted Inventory Management
router.get('/trusted', requirePermission('wifi_monitor.view'), wifiMonitorController.getTrusted);
router.post('/trusted', requirePermission('wifi_monitor.manage'), wifiMonitorController.registerTrusted);
router.delete('/trusted/:id', requirePermission('wifi_monitor.manage'), wifiMonitorController.removeTrusted);

// Access Control Operations (Hardware-validated)
router.post('/block', requirePermission('wifi_monitor.manage'), wifiMonitorController.blockDevice);
router.post('/unblock', requirePermission('wifi_monitor.manage'), wifiMonitorController.unblockDevice);

module.exports = router;
