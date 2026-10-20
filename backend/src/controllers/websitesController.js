const websitesService = require('../services/websitesService');
const { createWebsiteSchema, updateWebsiteSchema } = require('../validators/websitesValidator');
const logger = require('../utils/logger');

exports.getAllWebsites = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;
    const result = await websitesService.getAllWebsites({ 
      page: parseInt(page) || 1, 
      limit: parseInt(limit) || 10, 
      search, status 
    });
    res.json(result);
  } catch (error) {
    logger.error(`Error in getAllWebsites: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve websites' });
  }
};

exports.getWebsiteById = async (req, res) => {
  try {
    const website = await websitesService.getWebsiteById(req.params.id);
    if (!website) return res.status(404).json({ error: 'Website not found' });
    res.json(website);
  } catch (error) {
    logger.error(`Error in getWebsiteById: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve website' });
  }
};

exports.createWebsite = async (req, res) => {
  try {
    const validatedData = createWebsiteSchema.parse(req.body);
    const newWeb = await websitesService.createWebsite(validatedData, req);
    res.status(201).json(newWeb);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    logger.error(`Error in createWebsite: ${error.message}`);
    res.status(500).json({ error: 'Failed to create website' });
  }
};

exports.updateWebsite = async (req, res) => {
  try {
    const validatedData = updateWebsiteSchema.parse(req.body);
    const updatedWeb = await websitesService.updateWebsite(req.params.id, validatedData, req);
    if (!updatedWeb) return res.status(404).json({ error: 'Website not found' });
    res.json(updatedWeb);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    logger.error(`Error in updateWebsite: ${error.message}`);
    res.status(500).json({ error: 'Failed to update website' });
  }
};

exports.deleteWebsite = async (req, res) => {
  try {
    const success = await websitesService.softDeleteWebsite(req.params.id, req);
    if (!success) return res.status(404).json({ error: 'Website not found' });
    res.status(204).send();
  } catch (error) {
    logger.error(`Error in deleteWebsite: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete website' });
  }
};

exports.getWebsiteLogs = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await websitesService.getWebsiteLogs(req.params.id, { 
      page: parseInt(page) || 1, 
      limit: parseInt(limit) || 50
    });
    res.json(result);
  } catch (error) {
    logger.error(`Error in getWebsiteLogs: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve website logs' });
  }
};

exports.checkWebsiteNow = async (req, res) => {
  try {
    const updatedWeb = await websitesService.checkWebsiteNow(req.params.id);
    if (!updatedWeb) return res.status(404).json({ error: 'Website not found' });
    res.json({ success: true, data: updatedWeb });
  } catch (error) {
    logger.error(`Error in checkWebsiteNow: ${error.message}`);
    res.status(500).json({ error: 'Failed to check website' });
  }
};

