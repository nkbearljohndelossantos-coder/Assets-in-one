const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');

// ==========================================
// 1. SYSTEM SETTINGS (Key-Value)
// ==========================================

// Get all settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const settings = await db('system_settings').select('*');
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    return res.json({ success: true, data: settingsObj });
  } catch (err) {
    logger.error(`Get settings error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve settings.' });
  }
});

// Update settings (requires settings.manage permission)
router.post('/', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  const settingsData = req.body; // Key-Value pair object
  try {
    const oldSettings = await db('system_settings').select('*');
    
    await db.transaction(async (trx) => {
      for (const [key, value] of Object.entries(settingsData)) {
        // Upsert setting key
        const exists = await trx('system_settings').where('key', key).first();
        if (exists) {
          await trx('system_settings').where('key', key).update({ value, updated_at: new Date() });
        } else {
          await trx('system_settings').insert({ key, value, description: `System setting for ${key}`, updated_at: new Date() });
        }
      }
    });

    const newSettings = await db('system_settings').select('*');
    await logAudit(req, {
      action: 'Update Settings',
      module: 'Settings',
      oldValues: oldSettings,
      newValues: newSettings
    });

    return res.json({ success: true, message: 'System settings updated successfully.' });
  } catch (err) {
    logger.error(`Update settings error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update settings.' });
  }
});

// ==========================================
// 2. POSITIONS (CRUD)
// ==========================================

// Get all positions
router.get('/positions', authenticateToken, async (req, res) => {
  try {
    const positions = await db('positions').select('*').orderBy('name', 'asc');
    return res.json({ success: true, data: positions });
  } catch (err) {
    logger.error(`Get positions error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve positions.' });
  }
});

// Create position
router.post('/positions', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Position name is required.' });

  try {
    const exists = await db('positions').where('name', name).first();
    if (exists) return res.status(400).json({ success: false, message: 'Position name already exists.' });

    const [id] = await db('positions').insert({ name, description, created_at: new Date(), updated_at: new Date() });
    const newRecord = await db('positions').where('id', id).first();
    await logAudit(req, { action: 'Create Position', module: 'Settings', recordId: id, newValues: newRecord });

    return res.json({ success: true, message: 'Position created successfully.', data: newRecord });
  } catch (err) {
    logger.error(`Create position error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create position.' });
  }
});

// Update position
router.put('/positions/:id', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Position name is required.' });

  try {
    const oldRecord = await db('positions').where('id', id).first();
    if (!oldRecord) return res.status(404).json({ success: false, message: 'Position not found.' });

    // Prevent duplicate name
    const exists = await db('positions').where('name', name).whereNot('id', id).first();
    if (exists) return res.status(400).json({ success: false, message: 'Position name already exists.' });

    await db('positions').where('id', id).update({ name, description, updated_at: new Date() });
    const newRecord = await db('positions').where('id', id).first();
    await logAudit(req, { action: 'Update Position', module: 'Settings', recordId: id, oldValues: oldRecord, newValues: newRecord });

    return res.json({ success: true, message: 'Position updated successfully.', data: newRecord });
  } catch (err) {
    logger.error(`Update position error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update position.' });
  }
});

// ==========================================
// 3. ASSET CATEGORIES (CRUD)
// ==========================================

router.get('/asset-categories', authenticateToken, async (req, res) => {
  try {
    const cats = await db('asset_categories').select('*').orderBy('name', 'asc');
    return res.json({ success: true, data: cats });
  } catch (err) {
    logger.error(`Get asset categories error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve asset categories.' });
  }
});

router.post('/asset-categories', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Category name is required.' });

  try {
    const exists = await db('asset_categories').where('name', name).first();
    if (exists) return res.status(400).json({ success: false, message: 'Category name already exists.' });

    const [id] = await db('asset_categories').insert({ name, description, created_at: new Date(), updated_at: new Date() });
    const newRecord = await db('asset_categories').where('id', id).first();
    await logAudit(req, { action: 'Create Asset Category', module: 'Settings', recordId: id, newValues: newRecord });

    return res.json({ success: true, message: 'Asset category created successfully.', data: newRecord });
  } catch (err) {
    logger.error(`Create asset category error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create asset category.' });
  }
});

router.put('/asset-categories/:id', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Category name is required.' });

  try {
    const oldRecord = await db('asset_categories').where('id', id).first();
    if (!oldRecord) return res.status(404).json({ success: false, message: 'Asset category not found.' });

    const exists = await db('asset_categories').where('name', name).whereNot('id', id).first();
    if (exists) return res.status(400).json({ success: false, message: 'Category name already exists.' });

    await db('asset_categories').where('id', id).update({ name, description, updated_at: new Date() });
    const newRecord = await db('asset_categories').where('id', id).first();
    await logAudit(req, { action: 'Update Asset Category', module: 'Settings', recordId: id, oldValues: oldRecord, newValues: newRecord });

    return res.json({ success: true, message: 'Asset category updated successfully.', data: newRecord });
  } catch (err) {
    logger.error(`Update asset category error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update asset category.' });
  }
});

// ==========================================
// 4. TICKET CATEGORIES (CRUD)
// ==========================================

router.get('/ticket-categories', authenticateToken, async (req, res) => {
  try {
    const cats = await db('ticket_categories').select('*').orderBy('name', 'asc');
    return res.json({ success: true, data: cats });
  } catch (err) {
    logger.error(`Get ticket categories error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve ticket categories.' });
  }
});

router.post('/ticket-categories', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Category name is required.' });

  try {
    const exists = await db('ticket_categories').where('name', name).first();
    if (exists) return res.status(400).json({ success: false, message: 'Category name already exists.' });

    const [id] = await db('ticket_categories').insert({ name, description, created_at: new Date(), updated_at: new Date() });
    const newRecord = await db('ticket_categories').where('id', id).first();
    await logAudit(req, { action: 'Create Ticket Category', module: 'Settings', recordId: id, newValues: newRecord });

    return res.json({ success: true, message: 'Ticket category created successfully.', data: newRecord });
  } catch (err) {
    logger.error(`Create ticket category error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create ticket category.' });
  }
});

router.put('/ticket-categories/:id', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Category name is required.' });

  try {
    const oldRecord = await db('ticket_categories').where('id', id).first();
    if (!oldRecord) return res.status(404).json({ success: false, message: 'Ticket category not found.' });

    const exists = await db('ticket_categories').where('name', name).whereNot('id', id).first();
    if (exists) return res.status(400).json({ success: false, message: 'Category name already exists.' });

    await db('ticket_categories').where('id', id).update({ name, description, updated_at: new Date() });
    const newRecord = await db('ticket_categories').where('id', id).first();
    await logAudit(req, { action: 'Update Ticket Category', module: 'Settings', recordId: id, oldValues: oldRecord, newValues: newRecord });

    return res.json({ success: true, message: 'Ticket category updated successfully.', data: newRecord });
  } catch (err) {
    logger.error(`Update ticket category error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update ticket category.' });
  }
});

// ==========================================
// 5. INVENTORY CATEGORIES (CRUD)
// ==========================================

router.get('/inventory-categories', authenticateToken, async (req, res) => {
  try {
    const cats = await db('inventory_categories').select('*').orderBy('name', 'asc');
    return res.json({ success: true, data: cats });
  } catch (err) {
    logger.error(`Get inventory categories error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve inventory categories.' });
  }
});

router.post('/inventory-categories', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Category name is required.' });

  try {
    const exists = await db('inventory_categories').where('name', name).first();
    if (exists) return res.status(400).json({ success: false, message: 'Category name already exists.' });

    const [id] = await db('inventory_categories').insert({ name, description, created_at: new Date(), updated_at: new Date() });
    const newRecord = await db('inventory_categories').where('id', id).first();
    await logAudit(req, { action: 'Create Inventory Category', module: 'Settings', recordId: id, newValues: newRecord });

    return res.json({ success: true, message: 'Inventory category created successfully.', data: newRecord });
  } catch (err) {
    logger.error(`Create inventory category error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create inventory category.' });
  }
});

router.put('/inventory-categories/:id', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Category name is required.' });

  try {
    const oldRecord = await db('inventory_categories').where('id', id).first();
    if (!oldRecord) return res.status(404).json({ success: false, message: 'Inventory category not found.' });

    const exists = await db('inventory_categories').where('name', name).whereNot('id', id).first();
    if (exists) return res.status(400).json({ success: false, message: 'Category name already exists.' });

    await db('inventory_categories').where('id', id).update({ name, description, updated_at: new Date() });
    const newRecord = await db('inventory_categories').where('id', id).first();
    await logAudit(req, { action: 'Update Inventory Category', module: 'Settings', recordId: id, oldValues: oldRecord, newValues: newRecord });

    return res.json({ success: true, message: 'Inventory category updated successfully.', data: newRecord });
  } catch (err) {
    logger.error(`Update inventory category error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update inventory category.' });
  }
});

module.exports = router;
