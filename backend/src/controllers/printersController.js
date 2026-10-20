const printersService = require('../services/printersService');
const { createPrinterSchema, updatePrinterSchema, assignPrinterUserSchema, createPrinterMaintenanceLogSchema } = require('../validators/printersValidator');
const logger = require('../utils/logger');

// ==========================================
// PRINTERS
// ==========================================
exports.getAllPrinters = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;
    const result = await printersService.getAllPrinters({ 
      page: parseInt(page) || 1, 
      limit: parseInt(limit) || 10, 
      search, status 
    });
    res.json(result);
  } catch (error) {
    logger.error(`Error in getAllPrinters: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve printers' });
  }
};

exports.getPrinterById = async (req, res) => {
  try {
    const printer = await printersService.getPrinterById(req.params.id);
    if (!printer) return res.status(404).json({ error: 'Printer not found' });
    res.json(printer);
  } catch (error) {
    logger.error(`Error in getPrinterById: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve printer' });
  }
};

exports.createPrinter = async (req, res) => {
  try {
    const validatedData = createPrinterSchema.parse(req.body);
    const newPrinter = await printersService.createPrinter(validatedData, req);
    res.status(201).json(newPrinter);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (error.message.includes('conflict')) return res.status(400).json({ error: error.message });
    logger.error(`Error in createPrinter: ${error.message}`);
    res.status(500).json({ error: 'Failed to create printer' });
  }
};

exports.updatePrinter = async (req, res) => {
  try {
    const validatedData = updatePrinterSchema.parse(req.body);
    const updatedPrinter = await printersService.updatePrinter(req.params.id, validatedData, req);
    if (!updatedPrinter) return res.status(404).json({ error: 'Printer not found' });
    res.json(updatedPrinter);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (error.message.includes('conflict')) return res.status(400).json({ error: error.message });
    logger.error(`Error in updatePrinter: ${error.message}`);
    res.status(500).json({ error: 'Failed to update printer' });
  }
};

exports.deletePrinter = async (req, res) => {
  try {
    const success = await printersService.softDeletePrinter(req.params.id, req);
    if (!success) return res.status(404).json({ error: 'Printer not found' });
    res.status(204).send();
  } catch (error) {
    logger.error(`Error in deletePrinter: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete printer' });
  }
};

// ==========================================
// PRINTER USER ASSIGNMENTS
// ==========================================
exports.getPrinterUsers = async (req, res) => {
  try {
    const users = await printersService.getPrinterUsers(req.params.id);
    res.json(users);
  } catch (error) {
    logger.error(`Error in getPrinterUsers: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve printer users' });
  }
};

exports.assignUser = async (req, res) => {
  try {
    const validatedData = assignPrinterUserSchema.parse(req.body);
    await printersService.assignUser(req.params.id, validatedData.employee_id, req);
    res.status(201).json({ message: 'User assigned successfully' });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    if (error.message === 'User is already assigned to this printer.') return res.status(400).json({ error: error.message });
    logger.error(`Error in assignUser: ${error.message}`);
    res.status(500).json({ error: 'Failed to assign user to printer' });
  }
};

exports.removeUser = async (req, res) => {
  try {
    const success = await printersService.removeUser(req.params.id, req.params.employeeId, req);
    if (!success) return res.status(404).json({ error: 'Assignment not found' });
    res.status(204).send();
  } catch (error) {
    logger.error(`Error in removeUser: ${error.message}`);
    res.status(500).json({ error: 'Failed to remove user from printer' });
  }
};

// ==========================================
// PRINTER MAINTENANCE LOGS
// ==========================================
exports.getPrinterLogs = async (req, res) => {
  try {
    const logs = await printersService.getPrinterLogs(req.params.id);
    res.json(logs);
  } catch (error) {
    logger.error(`Error in getPrinterLogs: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve printer maintenance logs' });
  }
};

exports.createMaintenanceLog = async (req, res) => {
  try {
    const validatedData = createPrinterMaintenanceLogSchema.parse(req.body);
    await printersService.createMaintenanceLog(req.params.id, validatedData, req);
    res.status(201).json({ message: 'Maintenance log created successfully' });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.errors });
    logger.error(`Error in createMaintenanceLog: ${error.message}`);
    res.status(500).json({ error: 'Failed to create printer maintenance log' });
  }
};
