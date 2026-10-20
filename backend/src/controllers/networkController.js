const networkService = require('../services/networkService');
const { 
  createNetworkDeviceSchema, 
  updateNetworkDeviceSchema, 
  createWifiNetworkSchema, 
  updateWifiNetworkSchema, 
  createUserNetworkAssignmentSchema, 
  updateUserNetworkAssignmentSchema 
} = require('../validators/networkValidator');
const logger = require('../utils/logger');

// ==========================================
// NETWORK DEVICES
// ==========================================
exports.getAllDevices = async (req, res) => {
  try {
    const { page, limit, search, type, status } = req.query;
    const result = await networkService.getAllDevices({ 
      page: parseInt(page) || 1, 
      limit: parseInt(limit) || 10, 
      search, type, status 
    });
    res.json(result);
  } catch (error) {
    logger.error(`Error in getAllDevices: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve network devices' });
  }
};

exports.getDeviceById = async (req, res) => {
  try {
    const device = await networkService.getDeviceById(req.params.id);
    if (!device) return res.status(404).json({ error: 'Network device not found' });
    res.json(device);
  } catch (error) {
    logger.error(`Error in getDeviceById: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve network device' });
  }
};

exports.createDevice = async (req, res) => {
  try {
    const validatedData = createNetworkDeviceSchema.parse(req.body);
    const newDevice = await networkService.createDevice(validatedData, req);
    res.status(201).json(newDevice);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (error.message.includes('conflict')) return res.status(400).json({ error: error.message });
    logger.error(`Error in createDevice: ${error.message}`);
    res.status(500).json({ error: 'Failed to create network device' });
  }
};

exports.updateDevice = async (req, res) => {
  try {
    const validatedData = updateNetworkDeviceSchema.parse(req.body);
    const updatedDevice = await networkService.updateDevice(req.params.id, validatedData, req);
    if (!updatedDevice) return res.status(404).json({ error: 'Network device not found' });
    res.json(updatedDevice);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (error.message.includes('conflict')) return res.status(400).json({ error: error.message });
    logger.error(`Error in updateDevice: ${error.message}`);
    res.status(500).json({ error: 'Failed to update network device' });
  }
};

exports.deleteDevice = async (req, res) => {
  try {
    const success = await networkService.softDeleteDevice(req.params.id, req);
    if (!success) return res.status(404).json({ error: 'Network device not found' });
    res.status(204).send();
  } catch (error) {
    logger.error(`Error in deleteDevice: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete network device' });
  }
};

// ==========================================
// WIFI NETWORKS
// ==========================================
exports.getAllWifi = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;
    const result = await networkService.getAllWifi({ 
      page: parseInt(page) || 1, 
      limit: parseInt(limit) || 10, 
      search, status 
    });
    res.json(result);
  } catch (error) {
    logger.error(`Error in getAllWifi: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve WiFi networks' });
  }
};

exports.getWifiById = async (req, res) => {
  try {
    const wifi = await networkService.getWifiById(req.params.id);
    if (!wifi) return res.status(404).json({ error: 'WiFi network not found' });
    res.json(wifi);
  } catch (error) {
    logger.error(`Error in getWifiById: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve WiFi network' });
  }
};

exports.createWifi = async (req, res) => {
  try {
    const validatedData = createWifiNetworkSchema.parse(req.body);
    const newWifi = await networkService.createWifi(validatedData, req);
    res.status(201).json(newWifi);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (error.message.includes('conflict')) return res.status(400).json({ error: error.message });
    logger.error(`Error in createWifi: ${error.message}`);
    res.status(500).json({ error: 'Failed to create WiFi network' });
  }
};

exports.updateWifi = async (req, res) => {
  try {
    const validatedData = updateWifiNetworkSchema.parse(req.body);
    const updatedWifi = await networkService.updateWifi(req.params.id, validatedData, req);
    if (!updatedWifi) return res.status(404).json({ error: 'WiFi network not found' });
    res.json(updatedWifi);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (error.message.includes('conflict')) return res.status(400).json({ error: error.message });
    logger.error(`Error in updateWifi: ${error.message}`);
    res.status(500).json({ error: 'Failed to update WiFi network' });
  }
};

exports.deleteWifi = async (req, res) => {
  try {
    const success = await networkService.softDeleteWifi(req.params.id, req);
    if (!success) return res.status(404).json({ error: 'WiFi network not found' });
    res.status(204).send();
  } catch (error) {
    logger.error(`Error in deleteWifi: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete WiFi network' });
  }
};

// ==========================================
// USER NETWORK ASSIGNMENTS
// ==========================================
exports.getAllAssignments = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const result = await networkService.getAllAssignments({ 
      page: parseInt(page) || 1, 
      limit: parseInt(limit) || 10, 
      search 
    });
    res.json(result);
  } catch (error) {
    logger.error(`Error in getAllAssignments: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve network assignments' });
  }
};

exports.getAssignmentById = async (req, res) => {
  try {
    const assignment = await networkService.getAssignmentById(req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Network assignment not found' });
    res.json(assignment);
  } catch (error) {
    logger.error(`Error in getAssignmentById: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve network assignment' });
  }
};

exports.createAssignment = async (req, res) => {
  try {
    const validatedData = createUserNetworkAssignmentSchema.parse(req.body);
    const newAssignment = await networkService.createAssignment(validatedData, req);
    res.status(201).json(newAssignment);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (error.message.includes('conflict')) return res.status(400).json({ error: error.message });
    logger.error(`Error in createAssignment: ${error.message}`);
    res.status(500).json({ error: 'Failed to create network assignment' });
  }
};

exports.updateAssignment = async (req, res) => {
  try {
    const validatedData = updateUserNetworkAssignmentSchema.parse(req.body);
    const updatedAssignment = await networkService.updateAssignment(req.params.id, validatedData, req);
    if (!updatedAssignment) return res.status(404).json({ error: 'Network assignment not found' });
    res.json(updatedAssignment);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (error.message.includes('conflict')) return res.status(400).json({ error: error.message });
    logger.error(`Error in updateAssignment: ${error.message}`);
    res.status(500).json({ error: 'Failed to update network assignment' });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const success = await networkService.deleteAssignment(req.params.id, req);
    if (!success) return res.status(404).json({ error: 'Network assignment not found' });
    res.status(204).send();
  } catch (error) {
    logger.error(`Error in deleteAssignment: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete network assignment' });
  }
};
