const fileSharesService = require('../services/fileSharesService');
const { createFileShareSchema, updateFileShareSchema, createFileSharePermissionSchema } = require('../validators/fileSharesValidator');
const logger = require('../utils/logger');

// ==========================================
// FILE SHARES
// ==========================================
exports.getAllFileShares = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const result = await fileSharesService.getAllFileShares({ 
      page: parseInt(page) || 1, 
      limit: parseInt(limit) || 10, 
      search 
    });
    res.json(result);
  } catch (error) {
    logger.error(`Error in getAllFileShares: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve file shares' });
  }
};

exports.getFileShareById = async (req, res) => {
  try {
    const share = await fileSharesService.getFileShareById(req.params.id);
    if (!share) return res.status(404).json({ error: 'File share not found' });
    res.json(share);
  } catch (error) {
    logger.error(`Error in getFileShareById: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve file share' });
  }
};

exports.createFileShare = async (req, res) => {
  try {
    const validatedData = createFileShareSchema.parse(req.body);
    const newShare = await fileSharesService.createFileShare(validatedData, req);
    res.status(201).json(newShare);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    logger.error(`Error in createFileShare: ${error.message}`);
    res.status(500).json({ error: 'Failed to create file share' });
  }
};

exports.updateFileShare = async (req, res) => {
  try {
    const validatedData = updateFileShareSchema.parse(req.body);
    const updatedShare = await fileSharesService.updateFileShare(req.params.id, validatedData, req);
    if (!updatedShare) return res.status(404).json({ error: 'File share not found' });
    res.json(updatedShare);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    logger.error(`Error in updateFileShare: ${error.message}`);
    res.status(500).json({ error: 'Failed to update file share' });
  }
};

exports.deleteFileShare = async (req, res) => {
  try {
    const success = await fileSharesService.softDeleteFileShare(req.params.id, req);
    if (!success) return res.status(404).json({ error: 'File share not found' });
    res.status(204).send();
  } catch (error) {
    logger.error(`Error in deleteFileShare: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete file share' });
  }
};

// ==========================================
// FILE SHARE PERMISSIONS
// ==========================================
exports.getPermissions = async (req, res) => {
  try {
    const perms = await fileSharesService.getPermissions(req.params.id);
    res.json(perms);
  } catch (error) {
    logger.error(`Error in getPermissions: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve file share permissions' });
  }
};

exports.createPermission = async (req, res) => {
  try {
    const validatedData = createFileSharePermissionSchema.parse(req.body);
    await fileSharesService.createPermission(req.params.id, validatedData, req);
    res.status(201).json({ message: 'Permission created successfully' });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (error.message.includes('already exists')) return res.status(400).json({ error: error.message });
    logger.error(`Error in createPermission: ${error.message}`);
    res.status(500).json({ error: 'Failed to assign file share permission' });
  }
};

exports.removePermission = async (req, res) => {
  try {
    const success = await fileSharesService.removePermission(req.params.permId, req);
    if (!success) return res.status(404).json({ error: 'Permission mapping not found' });
    res.status(204).send();
  } catch (error) {
    logger.error(`Error in removePermission: ${error.message}`);
    res.status(500).json({ error: 'Failed to remove file share permission' });
  }
};
