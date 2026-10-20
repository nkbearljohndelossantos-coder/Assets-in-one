const guestWifiService = require('../services/guestWifiService');
const { createGuestWifiSchema, updateGuestWifiSchema } = require('../validators/guestWifiValidator');
const logger = require('../utils/logger');

exports.getAllGuestWifi = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;
    const result = await guestWifiService.getAllGuestWifi({ 
      page: parseInt(page) || 1, 
      limit: parseInt(limit) || 10, 
      search, status 
    });
    res.json(result);
  } catch (error) {
    logger.error(`Error in getAllGuestWifi: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve guest wifi accounts' });
  }
};

exports.getGuestWifiById = async (req, res) => {
  try {
    const gw = await guestWifiService.getGuestWifiById(req.params.id);
    if (!gw) return res.status(404).json({ error: 'Guest WiFi account not found' });
    res.json(gw);
  } catch (error) {
    logger.error(`Error in getGuestWifiById: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve guest wifi account' });
  }
};

exports.createGuestWifi = async (req, res) => {
  try {
    const validatedData = createGuestWifiSchema.parse(req.body);
    const newGW = await guestWifiService.createGuestWifi(validatedData, req);
    res.status(201).json(newGW);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    logger.error(`Error in createGuestWifi: ${error.message}`);
    res.status(500).json({ error: 'Failed to create guest wifi account' });
  }
};

exports.updateGuestWifi = async (req, res) => {
  try {
    const validatedData = updateGuestWifiSchema.parse(req.body);
    const updatedGW = await guestWifiService.updateGuestWifi(req.params.id, validatedData, req);
    if (!updatedGW) return res.status(404).json({ error: 'Guest WiFi account not found' });
    res.json(updatedGW);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    logger.error(`Error in updateGuestWifi: ${error.message}`);
    res.status(500).json({ error: 'Failed to update guest wifi account' });
  }
};

exports.deleteGuestWifi = async (req, res) => {
  try {
    const success = await guestWifiService.softDeleteGuestWifi(req.params.id, req);
    if (!success) return res.status(404).json({ error: 'Guest WiFi account not found' });
    res.status(204).send();
  } catch (error) {
    logger.error(`Error in deleteGuestWifi: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete guest wifi account' });
  }
};
