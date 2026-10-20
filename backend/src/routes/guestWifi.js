const express = require('express');
const router = express.Router();
const guestWifiController = require('../controllers/guestWifiController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', requirePermission('guest_wifi.view'), guestWifiController.getAllGuestWifi);
router.post('/', requirePermission('guest_wifi.create'), guestWifiController.createGuestWifi);
router.get('/:id', requirePermission('guest_wifi.view'), guestWifiController.getGuestWifiById);
router.put('/:id', requirePermission('guest_wifi.create'), guestWifiController.updateGuestWifi);
router.delete('/:id', requirePermission('guest_wifi.disable'), guestWifiController.deleteGuestWifi);

module.exports = router;
