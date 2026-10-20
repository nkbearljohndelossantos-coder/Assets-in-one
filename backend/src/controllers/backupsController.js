const backupsService = require('../services/backupsService');
const { createBackupSchema, updateBackupSchema, verifyBackupSchema } = require('../validators/backupsValidator');
const logger = require('../utils/logger');

exports.getAllBackups = async (req, res) => {
  try {
    const { page, limit, search, status, type, verificationStatus, sortBy, sortOrder } = req.query;
    const result = await backupsService.getAllBackups({ 
      page: parseInt(page) || 1, 
      limit: parseInt(limit) || 10, 
      search, status, type, verificationStatus, sortBy, sortOrder 
    });
    res.json(result);
  } catch (error) {
    logger.error(`Error in getAllBackups: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve backups' });
  }
};

exports.getBackupById = async (req, res) => {
  try {
    const backup = await backupsService.getBackupById(req.params.id);
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    res.json(backup);
  } catch (error) {
    logger.error(`Error in getBackupById: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve backup' });
  }
};

exports.createBackup = async (req, res) => {
  try {
    const validatedData = createBackupSchema.parse(req.body);
    const newBackup = await backupsService.createBackup(validatedData, req);
    res.status(201).json(newBackup);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error(`Error in createBackup: ${error.message}`);
    res.status(500).json({ error: 'Failed to create backup' });
  }
};

exports.updateBackup = async (req, res) => {
  try {
    const validatedData = updateBackupSchema.parse(req.body);
    const updatedBackup = await backupsService.updateBackup(req.params.id, validatedData, req);
    if (!updatedBackup) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    res.json(updatedBackup);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error(`Error in updateBackup: ${error.message}`);
    res.status(500).json({ error: 'Failed to update backup' });
  }
};

exports.verifyBackup = async (req, res) => {
  try {
    const validatedData = verifyBackupSchema.parse(req.body);
    const updatedBackup = await backupsService.verifyBackup(req.params.id, validatedData, req);
    if (!updatedBackup) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    res.json(updatedBackup);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error(`Error in verifyBackup: ${error.message}`);
    res.status(500).json({ error: 'Failed to verify backup' });
  }
};

exports.deleteBackup = async (req, res) => {
  try {
    const success = await backupsService.softDeleteBackup(req.params.id, req);
    if (!success) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    res.status(204).send();
  } catch (error) {
    logger.error(`Error in deleteBackup: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
};
