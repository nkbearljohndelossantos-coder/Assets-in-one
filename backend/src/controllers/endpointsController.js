const endpointsService = require('../services/endpointsService');
const { createOSSchema, updateOSSchema, createAntivirusSchema, updateAntivirusSchema } = require('../validators/endpointsValidator');
const logger = require('../utils/logger');

// ==========================================
// OPERATING SYSTEMS
// ==========================================
exports.getAllOS = async (req, res) => {
  try {
    const { page, limit, search, activationStatus } = req.query;
    const result = await endpointsService.getAllOS({ 
      page: parseInt(page) || 1, 
      limit: parseInt(limit) || 10, 
      search, activationStatus 
    });
    res.json(result);
  } catch (error) {
    logger.error(`Error in getAllOS: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve operating systems' });
  }
};

exports.getOSById = async (req, res) => {
  try {
    const os = await endpointsService.getOSById(req.params.id);
    if (!os) {
      return res.status(404).json({ error: 'Operating system record not found' });
    }
    res.json(os);
  } catch (error) {
    logger.error(`Error in getOSById: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve OS record' });
  }
};

exports.createOS = async (req, res) => {
  try {
    const validatedData = createOSSchema.parse(req.body);
    const newOS = await endpointsService.createOS(validatedData, req);
    res.status(201).json(newOS);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error(`Error in createOS: ${error.message}`);
    res.status(500).json({ error: 'Failed to create OS record' });
  }
};

exports.updateOS = async (req, res) => {
  try {
    const validatedData = updateOSSchema.parse(req.body);
    const updatedOS = await endpointsService.updateOS(req.params.id, validatedData, req);
    if (!updatedOS) {
      return res.status(404).json({ error: 'Operating system record not found' });
    }
    res.json(updatedOS);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error(`Error in updateOS: ${error.message}`);
    res.status(500).json({ error: 'Failed to update OS record' });
  }
};

exports.deleteOS = async (req, res) => {
  try {
    const success = await endpointsService.deleteOS(req.params.id, req);
    if (!success) {
      return res.status(404).json({ error: 'Operating system record not found' });
    }
    res.status(204).send();
  } catch (error) {
    logger.error(`Error in deleteOS: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete OS record' });
  }
};

// ==========================================
// ANTIVIRUS
// ==========================================
exports.getAllAntivirus = async (req, res) => {
  try {
    const { page, limit, search, scanResult } = req.query;
    const result = await endpointsService.getAllAntivirus({ 
      page: parseInt(page) || 1, 
      limit: parseInt(limit) || 10, 
      search, scanResult 
    });
    res.json(result);
  } catch (error) {
    logger.error(`Error in getAllAntivirus: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve antivirus records' });
  }
};

exports.getAntivirusById = async (req, res) => {
  try {
    const av = await endpointsService.getAntivirusById(req.params.id);
    if (!av) {
      return res.status(404).json({ error: 'Antivirus record not found' });
    }
    res.json(av);
  } catch (error) {
    logger.error(`Error in getAntivirusById: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve antivirus record' });
  }
};

exports.createAntivirus = async (req, res) => {
  try {
    const validatedData = createAntivirusSchema.parse(req.body);
    const newAV = await endpointsService.createAntivirus(validatedData, req);
    res.status(201).json(newAV);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error(`Error in createAntivirus: ${error.message}`);
    res.status(500).json({ error: 'Failed to create antivirus record' });
  }
};

exports.updateAntivirus = async (req, res) => {
  try {
    const validatedData = updateAntivirusSchema.parse(req.body);
    const updatedAV = await endpointsService.updateAntivirus(req.params.id, validatedData, req);
    if (!updatedAV) {
      return res.status(404).json({ error: 'Antivirus record not found' });
    }
    res.json(updatedAV);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error(`Error in updateAntivirus: ${error.message}`);
    res.status(500).json({ error: 'Failed to update antivirus record' });
  }
};

exports.deleteAntivirus = async (req, res) => {
  try {
    const success = await endpointsService.deleteAntivirus(req.params.id, req);
    if (!success) {
      return res.status(404).json({ error: 'Antivirus record not found' });
    }
    res.status(204).send();
  } catch (error) {
    logger.error(`Error in deleteAntivirus: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete antivirus record' });
  }
};
