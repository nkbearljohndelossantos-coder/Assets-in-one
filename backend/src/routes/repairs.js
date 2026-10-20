const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { getNextNumber } = require('../utils/numberSequence');
const { uploadImage } = require('../utils/uploader');
const fs = require('fs');

// ==========================================
// 1. REPAIRS LIST (Searched, Filtered, Paginated)
// ==========================================
router.get('/', authenticateToken, requirePermission('repairs.view'), async (req, res) => {
  const { page = 1, limit = 10, search = '', status = '', assetId = '' } = req.query;

  try {
    const query = db('repairs')
      .join('assets', 'repairs.asset_id', 'assets.id')
      .leftJoin('users as tech', 'repairs.technician_id', 'tech.id')
      .select(
        'repairs.*',
        'assets.name as asset_name',
        'assets.asset_code',
        'assets.serial_number',
        'tech.username as technician_username'
      );

    if (search) {
      query.where((builder) => {
        builder.where('repairs.repair_number', 'like', `%${search}%`)
          .orWhere('repairs.reported_issue', 'like', `%${search}%`)
          .orWhere('assets.name', 'like', `%${search}%`)
          .orWhere('assets.asset_code', 'like', `%${search}%`);
      });
    }

    if (status) query.where('repairs.status', status);
    if (assetId) query.where('repairs.asset_id', assetId);

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('repairs.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return res.json({
      success: true,
      data: {
        repairs: data,
        pagination: {
          total: parseInt(count),
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });

  } catch (err) {
    logger.error(`Get repairs list error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve repair logs.' });
  }
});

// View single repair profile details
router.get('/:id', authenticateToken, requirePermission('repairs.view'), async (req, res) => {
  const { id } = req.params;

  try {
    const repair = await db('repairs')
      .join('assets', 'repairs.asset_id', 'assets.id')
      .leftJoin('users as tech', 'repairs.technician_id', 'tech.id')
      .leftJoin('tickets', 'repairs.ticket_id', 'tickets.id')
      .select(
        'repairs.*',
        'assets.name as asset_name',
        'assets.asset_code',
        'assets.serial_number',
        'tech.username as technician_username',
        'tickets.ticket_number as related_ticket_number'
      )
      .where('repairs.id', id)
      .first();

    if (!repair) return res.status(404).json({ success: false, message: 'Repair record not found.' });

    // Retrieve used spare parts
    const partsUsed = await db('repair_parts')
      .join('inventory_items', 'repair_parts.inventory_item_id', 'inventory_items.id')
      .select('repair_parts.*', 'inventory_items.name as part_name', 'inventory_items.item_code')
      .where('repair_parts.repair_id', id);

    return res.json({
      success: true,
      data: {
        repair,
        partsUsed
      }
    });

  } catch (err) {
    logger.error(`Get repair ID error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve repair details.' });
  }
});

// ==========================================
// 2. CREATE REPAIR LOG (Sets Asset Status to 'Under Repair')
// ==========================================
router.post('/', authenticateToken, requirePermission('repairs.create'), async (req, res) => {
  const { assetId, ticketId, dateReceived, reportedIssue, technicianId, laborCost = 0, externalServiceCost = 0, remarks } = req.body;

  if (!assetId || !dateReceived || !reportedIssue) {
    return res.status(400).json({ success: false, message: 'Asset, Received Date, and Reported Issue details are required.' });
  }

  try {
    const asset = await db('assets').where('id', assetId).first();
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });

    let newRepairId;
    let repairNumber;

    await db.transaction(async (trx) => {
      // 1. Generate unique repair code (REP-2026-000001)
      repairNumber = await getNextNumber('Repair', trx);

      // 2. Insert repair record
      const [id] = await trx('repairs').insert({
        repair_number: repairNumber,
        asset_id: assetId,
        ticket_id: ticketId || null,
        date_received: dateReceived,
        reported_issue: reportedIssue,
        technician_id: technicianId || req.user.id,
        parts_cost: 0,
        labor_cost: laborCost,
        external_service_cost: externalServiceCost,
        total_repair_cost: Number(laborCost) + Number(externalServiceCost),
        status: 'Received',
        remarks: remarks || null,
        created_at: new Date(),
        updated_at: new Date()
      });
      newRepairId = id;

      // 3. Mark asset status as 'Under Repair'
      await trx('assets').where('id', assetId).update({
        status: 'Under Repair',
        updated_at: new Date()
      });

      // 4. Log asset history
      await trx('asset_history').insert({
        asset_id: assetId,
        action: 'Under Repair',
        notes: `Asset pulled for repairs under code: ${repairNumber}. Issue: ${reportedIssue}`,
        performed_by: req.user.id,
        created_at: new Date()
      });
    });

    const newRepair = await db('repairs').where('id', newRepairId).first();
    await logAudit(req, { action: 'Create Repair Log', module: 'Repairs', recordId: newRepairId, newValues: newRepair });

    return res.json({ success: true, message: 'Repair record created. Asset status set to Under Repair.', data: newRepair });

  } catch (err) {
    logger.error(`Create repair record error: ${err.message}`);
    return res.status(500).json({ success: false, message: `Failed to create repair log: ${err.message}` });
  }
});

// ==========================================
// 3. UPLOAD REPAIR IMAGES (Before / After Photos)
// ==========================================
router.post('/:id/photos', authenticateToken, requirePermission('repairs.update'), uploadImage.fields([
  { name: 'beforePhoto', maxCount: 1 },
  { name: 'afterPhoto', maxCount: 1 }
]), async (req, res) => {
  const { id } = req.params;

  try {
    const repair = await db('repairs').where('id', id).first();
    if (!repair) return res.status(404).json({ success: false, message: 'Repair record not found.' });

    const updates = {};
    if (req.files['beforePhoto']) {
      updates.before_photo_path = `/uploads/images/${req.files['beforePhoto'][0].filename}`;
    }
    if (req.files['afterPhoto']) {
      updates.after_photo_path = `/uploads/images/${req.files['afterPhoto'][0].filename}`;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No photo files uploaded.' });
    }

    await db('repairs').where('id', id).update(updates);
    const updatedRepair = await db('repairs').where('id', id).first();
    await logAudit(req, { action: 'Upload Repair Photos', module: 'Repairs', recordId: id, newValues: updates });

    return res.json({ success: true, message: 'Repair photos updated successfully.', data: updatedRepair });

  } catch (err) {
    logger.error(`Upload repair photos error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to upload repair photos.' });
  }
});

// ==========================================
// 4. ADD SPARE PARTS TO REPAIR (Deducts stock)
// ==========================================
router.post('/:id/parts', authenticateToken, requirePermission('repairs.update'), async (req, res) => {
  const { id } = req.params;
  const { inventoryItemId, quantity } = req.body;

  if (!inventoryItemId || !quantity || quantity <= 0) {
    return res.status(400).json({ success: false, message: 'Inventory item and positive quantity are required.' });
  }

  try {
    const repair = await db('repairs').where('id', id).first();
    if (!repair) return res.status(404).json({ success: false, message: 'Repair record not found.' });

    const item = await db('inventory_items').where('id', inventoryItemId).first();
    if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found.' });

    // Validate inventory quantity
    if (item.current_quantity < quantity) {
      return res.status(400).json({ success: false, message: `Insufficient inventory quantity. Available: ${item.current_quantity}. Requested: ${quantity}.` });
    }

    let transactionNumber;

    await db.transaction(async (trx) => {
      // 1. Generate inventory transaction code
      transactionNumber = await getNextNumber('Inventory', trx);

      // 2. Insert repair parts mapping
      await trx('repair_parts').insert({
        repair_id: id,
        inventory_item_id: inventoryItemId,
        quantity: quantity,
        unit_cost: item.unit_cost,
        created_at: new Date()
      });

      // 3. Log ledger transaction (Repair Use)
      await trx('inventory_transactions').insert({
        transaction_number: transactionNumber,
        item_id: inventoryItemId,
        transaction_type: 'Repair Use',
        quantity: quantity,
        unit_cost: item.unit_cost,
        storage_location: item.storage_location,
        related_repair_id: id,
        remarks: `Spare parts issued for repair ${repair.repair_number}.`,
        performed_by: req.user.id,
        created_at: new Date()
      });

      // 4. Deduct stock quantity in inventory items
      const newQty = item.current_quantity - quantity;
      await trx('inventory_items').where('id', inventoryItemId).update({
        current_quantity: newQty,
        updated_at: new Date()
      });

      // 5. Recalculate parts cost on repair record
      const sumObj = await trx('repair_parts')
        .where('repair_id', id)
        .select(db.raw('SUM(quantity * unit_cost) as total'))
        .first();
      
      const newPartsCost = sumObj ? (sumObj.total || 0) : 0;
      const totalRepairCost = Number(newPartsCost) + Number(repair.labor_cost) + Number(repair.external_service_cost);

      await trx('repairs').where('id', id).update({
        parts_cost: newPartsCost,
        total_repair_cost: totalRepairCost,
        updated_at: new Date()
      });
    });

    const updatedRepair = await db('repairs').where('id', id).first();
    const partsUsed = await db('repair_parts').where('repair_id', id);

    await logAudit(req, {
      action: 'Add Repair Parts',
      module: 'Repairs',
      recordId: id,
      newValues: { item_code: item.item_code, quantity, parts_cost: updatedRepair.parts_cost }
    });

    return res.json({
      success: true,
      message: 'Spare parts successfully issued and deducted from stock.',
      data: { repair: updatedRepair, partsUsed }
    });

  } catch (err) {
    logger.error(`Add repair parts error: ${err.message}`);
    return res.status(500).json({ success: false, message: `Failed to issue spare parts: ${err.message}` });
  }
});

// ==========================================
// 5. UPDATE REPAIR STATUS & COMPLETION
// ==========================================
router.put('/:id', authenticateToken, requirePermission('repairs.update'), async (req, res) => {
  const { id } = req.params;
  const { status, diagnosis, rootCause, repairAction, laborCost, externalServiceCost, testingResult, finalCondition, remarks } = req.body;

  try {
    const repair = await db('repairs').where('id', id).first();
    if (!repair) return res.status(404).json({ success: false, message: 'Repair record not found.' });

    // Validate completion statuses
    if ((status === 'Completed' || status === 'Unrepairable') && (!diagnosis || !rootCause || !repairAction)) {
      return res.status(400).json({ success: false, message: 'Repair logs cannot be completed without diagnosis, root cause, and action performed.' });
    }

    const updates = {
      diagnosis: diagnosis !== undefined ? diagnosis : repair.diagnosis,
      root_cause: rootCause !== undefined ? rootCause : repair.root_cause,
      repair_action: repairAction !== undefined ? repairAction : repair.repair_action,
      labor_cost: laborCost !== undefined ? Number(laborCost) : repair.labor_cost,
      external_service_cost: externalServiceCost !== undefined ? Number(externalServiceCost) : repair.external_service_cost,
      testing_result: testingResult !== undefined ? testingResult : repair.testing_result,
      final_condition: finalCondition !== undefined ? finalCondition : repair.final_condition,
      remarks: remarks !== undefined ? remarks : repair.remarks,
      updated_at: new Date()
    };

    if (status && status !== repair.status) {
      updates.status = status;
      if (status === 'Repairing' || status === 'Diagnosing') {
        updates.repair_start_date = new Date();
      }
      if (status === 'Completed' || status === 'Unrepairable' || status === 'Cancelled') {
        updates.repair_completion_date = new Date();
      }
    }

    // Recalculate total cost in database updates
    const currentPartsCost = repair.parts_cost;
    const finalLabor = updates.labor_cost;
    const finalExt = updates.external_service_cost;
    updates.total_repair_cost = Number(currentPartsCost) + Number(finalLabor) + Number(finalExt);

    await db.transaction(async (trx) => {
      // 1. Update repair log
      await trx('repairs').where('id', id).update(updates);

      // 2. If Completed or Unrepairable: update asset status
      if (status === 'Completed') {
        // If repair succeeded, return asset back to Available or In Use/Assigned
        // Check if asset has active assignment
        const activeAssignment = await trx('asset_assignments')
          .where('asset_id', repair.asset_id)
          .andWhere('status', 'Active')
          .first();

        const finalAssetStatus = activeAssignment ? 'Assigned' : 'Available';
        const finalAssetCondition = finalCondition || 'Good';

        await trx('assets').where('id', repair.asset_id).update({
          status: finalAssetStatus,
          condition: finalAssetCondition,
          updated_at: new Date()
        });

        // Write asset history
        await trx('asset_history').insert({
          asset_id: repair.asset_id,
          action: 'Repair Completed',
          notes: `Repair ${repair.repair_number} completed. Final condition: ${finalAssetCondition}. Status set to ${finalAssetStatus}`,
          performed_by: req.user.id,
          created_at: new Date()
        });
      } else if (status === 'Unrepairable') {
        // If unrepairable, update asset status to Damaged or Disposed
        await trx('assets').where('id', repair.asset_id).update({
          status: 'Damaged',
          condition: 'Damaged',
          updated_at: new Date()
        });

        // Write asset history
        await trx('asset_history').insert({
          asset_id: repair.asset_id,
          action: 'Repair Unrepairable',
          notes: `Repair ${repair.repair_number} marked unrepairable. Asset status set to Damaged.`,
          performed_by: req.user.id,
          created_at: new Date()
        });
      } else if (status === 'Cancelled') {
        // Return asset back to previous state
        const activeAssignment = await trx('asset_assignments')
          .where('asset_id', repair.asset_id)
          .andWhere('status', 'Active')
          .first();
        const restoreStatus = activeAssignment ? 'Assigned' : 'Available';
        
        await trx('assets').where('id', repair.asset_id).update({
          status: restoreStatus,
          updated_at: new Date()
        });
      }
    });

    const updatedRepair = await db('repairs').where('id', id).first();
    await logAudit(req, { action: 'Update Repair', module: 'Repairs', recordId: id, oldValues: repair, newValues: updatedRepair });

    return res.json({ success: true, message: `Repair status updated to ${status || repair.status}.`, data: updatedRepair });

  } catch (err) {
    logger.error(`Update repair progress error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update repair log progress.' });
  }
});

module.exports = router;
