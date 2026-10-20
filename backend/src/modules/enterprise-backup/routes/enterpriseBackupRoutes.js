const express = require('express');
const router = express.Router();
const controller = require('../controllers/enterpriseBackupController');
const { authenticateToken, requirePermission } = require('../../../middleware/auth');

// Public agent enrollment route
router.post('/agents/enroll', controller.enrollAgent);

// Protected routes (Require Auth & Permissions)
router.use(authenticateToken);

// Enrollment Tokens
router.post('/enrollment-tokens', requirePermission('backup.devices.enroll'), controller.createEnrollmentToken);

// Devices
router.get('/devices', requirePermission('backup.devices.view'), controller.getDevices);
router.get('/devices/:id', requirePermission('backup.devices.view'), controller.getDeviceById);

// Repositories
router.get('/repositories', requirePermission('backup.repositories.view'), controller.getRepositories);
router.post('/repositories', requirePermission('backup.repositories.manage'), controller.createRepository);
router.post('/repositories/:id/test', requirePermission('backup.repositories.manage'), controller.testRepository);

// Jobs
router.get('/jobs', requirePermission('backup.jobs.view'), controller.getJobs);
router.post('/jobs', requirePermission('backup.jobs.create'), controller.createJob);
router.post('/jobs/:id/run', requirePermission('backup.jobs.run'), controller.runJob);

// Restores
router.post('/restore-jobs/authorize', requirePermission('backup.restore.files'), controller.authorizeRestore);

// Audits
router.get('/audit-logs', requirePermission('backup.audit.view'), controller.getAuditLogs);

module.exports = router;
