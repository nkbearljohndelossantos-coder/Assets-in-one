const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { getNextNumber } = require('../utils/numberSequence');

// ==========================================
// 1. INVENTORY MASTER LIST (With alerts)
// ==========================================
router.get('/', authenticateToken, requirePermission('inventory.view'), async (req, res) => {
  const { page = 1, limit = 10, search = '', categoryId = '', lowStock = 'false' } = req.query;

  try {
    const query = db('inventory_items')
      .join('inventory_categories', 'inventory_items.category_id', 'inventory_categories.id')
      .select('inventory_items.*', 'inventory_categories.name as category_name');

    if (search) {
      query.where((builder) => {
        builder.where('inventory_items.item_code', 'like', `%${search}%`)
          .orWhere('inventory_items.name', 'like', `%${search}%`)
          .orWhere('inventory_items.brand', 'like', `%${search}%`)
          .orWhere('inventory_items.model', 'like', `%${search}%`)
          .orWhere('inventory_items.storage_location', 'like', `%${search}%`);
      });
    }

    if (categoryId) {
      query.where('inventory_items.category_id', categoryId);
    }

    // Filter low stock (reorder alerts)
    if (lowStock === 'true') {
      query.whereRaw('inventory_items.current_quantity <= inventory_items.minimum_stock');
    }

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('inventory_items.item_code', 'asc')
      .limit(limit)
      .offset(offset);

    return res.json({
      success: true,
      data: {
        items: data,
        pagination: {
          total: parseInt(count),
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });

  } catch (err) {
    logger.error(`Get inventory items list error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve inventory items.' });
  }
});

// ==========================================
// 1.1 INVENTORY CATEGORIES LOOKUP
// ==========================================
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const cats = await db('inventory_categories').select('*').orderBy('name', 'asc');
    return res.json({ success: true, data: cats });
  } catch (err) {
    logger.error(`Get inventory categories error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve inventory categories.' });
  }
});

// ==========================================
// 1.2 INVENTORY STOCK CARD MOVEMENTS LEDGER
// ==========================================
router.get('/movements', authenticateToken, requirePermission('inventory.view'), async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

  try {
    const movements = await db('inventory_transactions')
      .join('inventory_items', 'inventory_transactions.item_id', 'inventory_items.id')
      .leftJoin('users', 'inventory_transactions.performed_by', 'users.id')
      .select(
        'inventory_transactions.id',
        'inventory_transactions.transaction_number as reference_number',
        'inventory_transactions.transaction_type as movement_type',
        'inventory_transactions.quantity',
        'inventory_transactions.unit_cost',
        'inventory_transactions.storage_location',
        'inventory_transactions.remarks',
        'inventory_transactions.created_at',
        'inventory_items.item_code',
        'inventory_items.name as part_name',
        'users.username'
      )
      .orderBy('inventory_transactions.created_at', 'desc')
      .limit(limit);

    return res.json({ success: true, data: movements });
  } catch (err) {
    logger.error(`Get inventory movements error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve inventory movements.' });
  }
});

// Get single item detail
router.get('/:id', authenticateToken, requirePermission('inventory.view'), async (req, res) => {
  const { id } = req.params;
  try {
    const item = await db('inventory_items')
      .join('inventory_categories', 'inventory_items.category_id', 'inventory_categories.id')
      .select('inventory_items.*', 'inventory_categories.name as category_name')
      .where('inventory_items.id', id)
      .first();

    if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found.' });

    return res.json({ success: true, data: item });
  } catch (err) {
    logger.error(`Get inventory item by ID error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve item details.' });
  }
});

// Create inventory item (Opening balance)
router.post('/', authenticateToken, requirePermission('inventory.receive'), async (req, res) => {
  const {
    name,
    category_id,
    brand = 'Generic',
    model = 'Standard',
    unit_of_measure = 'pcs',
    minimum_stock,
    reorder_level,
    reorder_quantity,
    unit_cost = 0,
    supplier,
    storage_location,
    remarks,
    description,
    item_code,
    initialQty = 0
  } = req.body;

  if (!name || !category_id) {
    return res.status(400).json({ success: false, message: 'Part name and category are required.' });
  }

  try {
    let newItemId;
    let finalItemCode = item_code;

    await db.transaction(async (trx) => {
      // 1. If no item_code provided, generate unique item code (INV-00000X)
      if (!finalItemCode) {
        const [countObj] = await trx('inventory_items').count('* as count');
        const count = parseInt(countObj.count, 10) + 1;
        finalItemCode = `INV-${String(count).padStart(5, '0')}`;
      }

      const minStock = minimum_stock !== undefined ? Number(minimum_stock) : (reorder_level !== undefined ? Number(reorder_level) : 5);
      const reorderQty = reorder_quantity !== undefined ? Number(reorder_quantity) : 10;
      const parsedUnitCost = unit_cost !== undefined ? Number(unit_cost) : 0;
      const finalRemarks = remarks || description || null;

      // 2. Insert item
      const [id] = await trx('inventory_items').insert({
        item_code: finalItemCode,
        barcode: finalItemCode,
        name,
        category_id: Number(category_id),
        brand: brand || 'Generic',
        model: model || 'Standard',
        unit_of_measure: unit_of_measure || 'pcs',
        current_quantity: Number(initialQty) || 0,
        minimum_stock: minStock,
        reorder_quantity: reorderQty,
        unit_cost: parsedUnitCost,
        supplier: supplier || null,
        storage_location: storage_location || null,
        status: 'Active',
        remarks: finalRemarks,
        created_at: new Date(),
        updated_at: new Date()
      });
      newItemId = id;

      // 3. Create Opening Balance Transaction if initial qty > 0
      if (initialQty > 0) {
        const transNum = await getNextNumber('Inventory', trx);
        await trx('inventory_transactions').insert({
          transaction_number: transNum,
          item_id: newItemId,
          transaction_type: 'Opening Balance',
          quantity: Number(initialQty),
          unit_cost: parsedUnitCost,
          storage_location: storage_location || null,
          remarks: 'Initial stock setup opening balance.',
          performed_by: req.user.id,
          created_at: new Date()
        });
      }
    });

    const newItem = await db('inventory_items').where('id', newItemId).first();
    await logAudit(req, { action: 'Create Inventory Item', module: 'Inventory', recordId: newItemId, newValues: newItem });

    return res.json({ success: true, message: 'Inventory item registered successfully.', data: newItem });

  } catch (err) {
    logger.error(`Create inventory item error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to register inventory item.' });
  }
});

// ==========================================
// 2. STOCK RECEIVING (Stock In)
// ==========================================
router.post('/:id/stock-in', authenticateToken, requirePermission('inventory.receive'), async (req, res) => {
  const { id } = req.params;
  const { quantity, unitCost, storageLocation, remarks } = req.body;

  if (!quantity || quantity <= 0 || !unitCost || unitCost < 0) {
    return res.status(400).json({ success: false, message: 'Valid positive quantity and unit cost are required.' });
  }

  try {
    const item = await db('inventory_items').where('id', id).first();
    if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found.' });

    let transactionNumber;

    await db.transaction(async (trx) => {
      // 1. Generate transaction code
      transactionNumber = await getNextNumber('Inventory', trx);

      // 2. Insert transaction record
      await trx('inventory_transactions').insert({
        transaction_number: transactionNumber,
        item_id: id,
        transaction_type: 'Stock In',
        quantity: quantity,
        unit_cost: unitCost,
        storage_location: storageLocation || item.storage_location,
        remarks: remarks || 'Received spare parts stock.',
        performed_by: req.user.id,
        created_at: new Date()
      });

      // 3. Update quantity and average unit cost
      const newQty = item.current_quantity + quantity;
      
      await trx('inventory_items').where('id', id).update({
        current_quantity: newQty,
        unit_cost: unitCost, // Set latest unit cost
        storage_location: storageLocation || item.storage_location,
        updated_at: new Date()
      });
    });

    const updatedItem = await db('inventory_items').where('id', id).first();
    await logAudit(req, { action: 'Receive Stock In', module: 'Inventory', recordId: id, newValues: updatedItem });

    return res.json({
      success: true,
      message: `Successfully received ${quantity} unit(s) of ${item.name}.`,
      data: updatedItem
    });

  } catch (err) {
    logger.error(`Stock receiving error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to execute stock-in transaction.' });
  }
});

// ==========================================
// 3. STOCK ADJUSTMENT (Manual Adjust)
// ==========================================
router.post('/:id/adjust', authenticateToken, requirePermission('inventory.adjust'), async (req, res) => {
  const { id } = req.params;
  const { type, quantity, remarks } = req.body; // type: 'Adjustment Increase' or 'Adjustment Decrease'

  if (type !== 'Adjustment Increase' && type !== 'Adjustment Decrease') {
    return res.status(400).json({ success: false, message: "Adjustment type must be 'Adjustment Increase' or 'Adjustment Decrease'." });
  }

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ success: false, message: 'Positive quantity is required for stock adjustment.' });
  }

  try {
    const item = await db('inventory_items').where('id', id).first();
    if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found.' });

    // Validate if deduction leaves negative balance
    if (type === 'Adjustment Decrease' && item.current_quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient inventory quantity. Current stock: ${item.current_quantity}. Cannot deduct ${quantity}.`
      });
    }

    let transactionNumber;

    await db.transaction(async (trx) => {
      // 1. Generate transaction sequence code
      transactionNumber = await getNextNumber('Inventory', trx);

      // 2. Insert transaction ledger
      await trx('inventory_transactions').insert({
        transaction_number: transactionNumber,
        item_id: id,
        transaction_type: type,
        quantity: quantity,
        unit_cost: item.unit_cost,
        storage_location: item.storage_location,
        remarks: remarks || 'Manual inventory adjustment.',
        performed_by: req.user.id,
        created_at: new Date()
      });

      // 3. Update stock levels
      const newQty = type === 'Adjustment Increase' 
        ? item.current_quantity + quantity 
        : item.current_quantity - quantity;

      await trx('inventory_items').where('id', id).update({
        current_quantity: newQty,
        updated_at: new Date()
      });
    });

    const updatedItem = await db('inventory_items').where('id', id).first();
    await logAudit(req, { action: `Stock Adjustment (${type})`, module: 'Inventory', recordId: id, newValues: updatedItem });

    return res.json({
      success: true,
      message: `Stock level adjusted successfully. Current: ${updatedItem.current_quantity}.`,
      data: updatedItem
    });

  } catch (err) {
    logger.error(`Stock adjustment error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to process stock adjustment.' });
  }
});

// ==========================================
// 4. STOCK CARD LEDGER HISTORY
// ==========================================
router.get('/:id/transactions', authenticateToken, requirePermission('inventory.view'), async (req, res) => {
  const { id } = req.params;

  try {
    const transactions = await db('inventory_transactions')
      .leftJoin('users', 'inventory_transactions.performed_by', 'users.id')
      .leftJoin('repairs', 'inventory_transactions.related_repair_id', 'repairs.id')
      .leftJoin('maintenance_schedules as pm', 'inventory_transactions.related_maintenance_id', 'pm.id')
      .select(
        'inventory_transactions.*',
        'users.username as performed_by_username',
        'repairs.repair_number as related_repair_number',
        'pm.maintenance_number as related_maintenance_number'
      )
      .where('inventory_transactions.item_id', id)
      .orderBy('inventory_transactions.created_at', 'desc');

    return res.json({ success: true, data: transactions });
  } catch (err) {
    logger.error(`Get inventory item ledger card error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve item stock ledger card.' });
  }
});

module.exports = router;
