const express = require('express');
const router = express.Router();
const endpointsController = require('../controllers/endpointsController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.use(authenticateToken);

// Operating Systems
router.get('/os', requirePermission('endpoint_security.view'), endpointsController.getAllOS);
router.post('/os', requirePermission('endpoint_security.manage'), endpointsController.createOS);
router.get('/os/:id', requirePermission('endpoint_security.view'), endpointsController.getOSById);
router.put('/os/:id', requirePermission('endpoint_security.manage'), endpointsController.updateOS);
router.delete('/os/:id', requirePermission('endpoint_security.manage'), endpointsController.deleteOS);

// Antivirus
router.get('/antivirus', requirePermission('endpoint_security.view'), endpointsController.getAllAntivirus);
router.post('/antivirus', requirePermission('endpoint_security.manage'), endpointsController.createAntivirus);
router.get('/antivirus/:id', requirePermission('endpoint_security.view'), endpointsController.getAntivirusById);
router.put('/antivirus/:id', requirePermission('endpoint_security.manage'), endpointsController.updateAntivirus);
router.delete('/antivirus/:id', requirePermission('endpoint_security.manage'), endpointsController.deleteAntivirus);

module.exports = router;
