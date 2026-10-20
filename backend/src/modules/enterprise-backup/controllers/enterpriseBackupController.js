const backupDeviceService = require('../services/backupDeviceService');
const backupRepositoryService = require('../services/backupRepositoryService');
const backupJobService = require('../services/backupJobService');
const backupRestoreService = require('../services/backupRestoreService');
const backupRepository = require('../repositories/backupRepository');
const {
  createEnrollmentTokenSchema,
  enrollAgentSchema,
  createRepositorySchema,
  createPolicySchema,
  createJobSchema,
  authorizeRestoreSchema
} = require('../schemas/backupSchemas');

// 1. Enrollment
exports.createEnrollmentToken = async (req, res) => {
  try {
    const validated = createEnrollmentTokenSchema.parse(req.body);
    const result = await backupDeviceService.createEnrollmentToken({
      userId: req.user?.id,
      expiresInHours: validated.expiresInHours,
      maxUses: validated.maxUses
    }, req);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.enrollAgent = async (req, res) => {
  try {
    const validated = enrollAgentSchema.parse(req.body);
    const result = await backupDeviceService.enrollAgent(validated, req);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    res.status(400).json({ success: false, error: err.message });
  }
};

// 2. Devices
exports.getDevices = async (req, res) => {
  try {
    const devices = await backupRepository.getAllDevices();
    res.json({ success: true, data: devices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getDeviceById = async (req, res) => {
  try {
    const device = await backupRepository.getDeviceById(req.params.id);
    if (!device) return res.status(404).json({ success: false, error: 'Device not found' });
    res.json({ success: true, data: device });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 3. Repositories
exports.getRepositories = async (req, res) => {
  try {
    const repositories = await backupRepository.getAllRepositories();
    res.json({ success: true, data: repositories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createRepository = async (req, res) => {
  try {
    const validated = createRepositorySchema.parse(req.body);
    const repo = await backupRepositoryService.createRepository(validated, req);
    res.status(201).json({ success: true, data: repo });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.testRepository = async (req, res) => {
  try {
    const result = await backupRepositoryService.testRepositoryConnection(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// 4. Jobs
exports.getJobs = async (req, res) => {
  try {
    const jobs = await backupRepository.getAllJobs();
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createJob = async (req, res) => {
  try {
    const validated = createJobSchema.parse(req.body);
    const job = await backupJobService.createJob(validated, req);
    res.status(201).json({ success: true, data: job });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.runJob = async (req, res) => {
  try {
    const executionContext = await backupJobService.triggerJobExecution(req.params.id, req);
    res.status(200).json({ success: true, data: executionContext });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// 5. Restores
exports.authorizeRestore = async (req, res) => {
  try {
    const validated = authorizeRestoreSchema.parse(req.body);
    const result = await backupRestoreService.authorizeRestore(validated, req);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    res.status(400).json({ success: false, error: err.message });
  }
};

// 6. Audit Logs
exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await backupRepository.getAuditLogs();
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
