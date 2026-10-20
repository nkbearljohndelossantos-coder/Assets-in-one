const express = require('express');
const router = express.Router();
const printersController = require('../controllers/printersController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.use(authenticateToken);

// Printers hardware
router.get('/', requirePermission('printers.view'), printersController.getAllPrinters);
router.post('/', requirePermission('printers.manage'), printersController.createPrinter);
router.get('/:id', requirePermission('printers.view'), printersController.getPrinterById);
router.put('/:id', requirePermission('printers.manage'), printersController.updatePrinter);
router.delete('/:id', requirePermission('printers.manage'), printersController.deletePrinter);

// Mapped Users
router.get('/:id/users', requirePermission('printers.view'), printersController.getPrinterUsers);
router.post('/:id/users', requirePermission('printers.manage'), printersController.assignUser);
router.delete('/:id/users/:employeeId', requirePermission('printers.manage'), printersController.removeUser);

// Maintenance Logs
router.get('/:id/logs', requirePermission('printers.view'), printersController.getPrinterLogs);
router.post('/:id/logs', requirePermission('printers.manage'), printersController.createMaintenanceLog); // tech creates it

module.exports = router;
