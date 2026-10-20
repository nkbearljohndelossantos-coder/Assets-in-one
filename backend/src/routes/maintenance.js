const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { getNextNumber } = require('../utils/numberSequence');
const { sendNotification } = require('../utils/notifier');

// ==========================================
// 1. LIST MAINTENANCE SCHEDULES (Calendar & Status checks)
// ==========================================
router.get('/', authenticateToken, requirePermission('maintenance.view'), async (req, res) => {
  const { page = 1, limit = 10, search = '', status = '', technicianId = '' } = req.query;

  try {
    const query = db('maintenance_schedules')
      .join('assets', 'maintenance_schedules.asset_id', 'assets.id')
      .leftJoin('users as tech', 'maintenance_schedules.assigned_technician_id', 'tech.id')
      .select(
        'maintenance_schedules.*',
        'assets.name as asset_name',
        'assets.asset_code',
        'assets.serial_number',
        'tech.username as technician_username'
      );

    if (search) {
      query.where((builder) => {
        builder.where('maintenance_schedules.maintenance_number', 'like', `%${search}%`)
          .orWhere('assets.name', 'like', `%${search}%`)
          .orWhere('assets.asset_code', 'like', `%${search}%`);
      });
    }

    if (status) query.where('maintenance_schedules.status', status);
    if (technicianId) query.where('maintenance_schedules.assigned_technician_id', technicianId);

    // If check for overdue
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Auto flag overdue items in active query (if status is Scheduled/Due and date passed today)
    // We will do a bulk update of overdue items before returning list, which is highly robust!
    await db('maintenance_schedules')
      .whereIn('status', ['Scheduled', 'Due'])
      .andWhere('scheduled_date', '<', todayStr)
      .update({ status: 'Overdue' });

    const countQuery = db.select(db.raw('count(*) as count')).from(query.clone().as('subquery'));
    const [{ count }] = await countQuery;

    const offset = (page - 1) * limit;
    const data = await query
      .orderBy('maintenance_schedules.scheduled_date', 'asc')
      .limit(limit)
      .offset(offset);

    return res.json({
      success: true,
      data: {
        schedules: data,
        pagination: {
          total: parseInt(count),
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });

  } catch (err) {
    logger.error(`Get maintenance schedules error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve maintenance schedules.' });
  }
});

// Get single maintenance details (with checklist and findings)
router.get('/:id', authenticateToken, requirePermission('maintenance.view'), async (req, res) => {
  const { id } = req.params;

  try {
    const schedule = await db('maintenance_schedules')
      .join('assets', 'maintenance_schedules.asset_id', 'assets.id')
      .leftJoin('users as tech', 'maintenance_schedules.assigned_technician_id', 'tech.id')
      .select(
        'maintenance_schedules.*',
        'assets.name as asset_name',
        'assets.asset_code',
        'assets.serial_number',
        'tech.username as technician_username'
      )
      .where('maintenance_schedules.id', id)
      .first();

    if (!schedule) return res.status(404).json({ success: false, message: 'Maintenance record not found.' });

    // Retrieve Checklist Items
    const checklist = await db('maintenance_checklists').where('schedule_id', id);

    // Retrieve Results
    const results = await db('maintenance_results').where('schedule_id', id).first();

    return res.json({
      success: true,
      data: {
        schedule,
        checklist,
        results
      }
    });

  } catch (err) {
    logger.error(`Get maintenance details error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve details.' });
  }
});

// ==========================================
// 2. CREATE PM SCHEDULE
// ==========================================
router.post('/', authenticateToken, requirePermission('maintenance.create'), async (req, res) => {
  const { assetId, maintenanceType, frequency, scheduledDate, assignedTechnicianId, checklist, remarks } = req.body;

  if (!assetId || !maintenanceType || !frequency || !scheduledDate || !assignedTechnicianId) {
    return res.status(400).json({ success: false, message: 'Asset, Type, Frequency, Scheduled Date, and Technician are required.' });
  }

  try {
    const asset = await db('assets').where('id', assetId).first();
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });

    let newScheduleId;
    let pmNumber;

    await db.transaction(async (trx) => {
      // 1. Generate code (PM-2026-000001)
      pmNumber = await getNextNumber('Maintenance', trx);

      // 2. Insert schedule
      const [id] = await trx('maintenance_schedules').insert({
        maintenance_number: pmNumber,
        asset_id: assetId,
        maintenance_type: maintenanceType,
        frequency: frequency,
        scheduled_date: scheduledDate,
        assigned_technician_id: assignedTechnicianId,
        status: 'Scheduled',
        remarks: remarks || null,
        created_at: new Date(),
        updated_at: new Date()
      });
      newScheduleId = id;

      // 3. Insert checklist items
      // If no custom checklist provided, load standard checklist items
      const items = (checklist && checklist.length) ? checklist : [
        'Physical cleaning', 'Cable inspection', 'Hardware inspection',
        'Disk health check', 'RAM check', 'Antivirus status',
        'Operating system updates', 'Software updates', 'Backup verification',
        'Temperature check'
      ];

      const checklistInserts = items.map(item => ({
        schedule_id: newScheduleId,
        checklist_item: item,
        is_checked: false
      }));

      await trx('maintenance_checklists').insert(checklistInserts);
    });

    // Notify technician
    await sendNotification(assignedTechnicianId, {
      title: 'New Maintenance Scheduled',
      message: `Preventive maintenance PM ${pmNumber} has been scheduled and assigned to you on ${scheduledDate}.`,
      type: 'Info',
      relatedRecordId: newScheduleId,
      relatedModule: 'Maintenance'
    });

    const newPM = await db('maintenance_schedules').where('id', newScheduleId).first();
    await logAudit(req, { action: 'Create PM Schedule', module: 'Maintenance', recordId: newScheduleId, newValues: newPM });

    return res.json({ success: true, message: 'Preventive maintenance schedule created successfully.', data: newPM });

  } catch (err) {
    logger.error(`Create PM schedule error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create schedule.' });
  }
});

// ==========================================
// 3. COMPLETE PM SCHEDULE (Autocalculate next recurrence)
// ==========================================
router.post('/:id/complete', authenticateToken, requirePermission('maintenance.complete'), async (req, res) => {
  const { id } = req.params;
  const { completionDate, findings, actionsPerformed, cost = 0, checklist, nextMaintenanceDate, remarks } = req.body;
  // checklist is array of { id, is_checked, remarks }

  if (!completionDate || !findings || !actionsPerformed) {
    return res.status(400).json({ success: false, message: 'Completion Date, Findings, and Actions Performed details are required.' });
  }

  try {
    const schedule = await db('maintenance_schedules').where('id', id).first();
    if (!schedule) return res.status(404).json({ success: false, message: 'Maintenance schedule not found.' });

    if (schedule.status === 'Completed' || schedule.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'This maintenance is already closed/completed.' });
    }

    let calculatedNextDate = nextMaintenanceDate;

    // Calculate next recurrence date if custom is not provided
    if (!calculatedNextDate && schedule.frequency !== 'Custom') {
      const baseDate = new Date(schedule.scheduled_date);
      if (schedule.frequency === 'Monthly') {
        baseDate.setMonth(baseDate.getMonth() + 1);
      } else if (schedule.frequency === 'Quarterly') {
        baseDate.setMonth(baseDate.getMonth() + 3);
      } else if (schedule.frequency === 'Semiannual') {
        baseDate.setMonth(baseDate.getMonth() + 6);
      } else if (schedule.frequency === 'Annual') {
        baseDate.setFullYear(baseDate.getFullYear() + 1);
      }
      calculatedNextDate = baseDate.toISOString().split('T')[0];
    }

    let nextPMId = null;

    await db.transaction(async (trx) => {
      // 1. Update checklist items checklist checkbox states
      if (checklist && Array.isArray(checklist)) {
        for (const item of checklist) {
          await trx('maintenance_checklists')
            .where('id', item.id)
            .update({
              is_checked: !!item.is_checked,
              remarks: item.remarks || null
            });
        }
      }

      // 2. Insert Maintenance Results
      await trx('maintenance_results').insert({
        schedule_id: id,
        findings,
        actions_performed: actionsPerformed,
        cost,
        created_at: new Date()
      });

      // 3. Update active PM status to Completed
      await trx('maintenance_schedules').where('id', id).update({
        status: 'Completed',
        completion_date: completionDate,
        next_maintenance_date: calculatedNextDate || null,
        cost,
        remarks: remarks || schedule.remarks,
        updated_at: new Date()
      });

      // 4. Update asset condition details
      await trx('assets').where('id', schedule.asset_id).update({
        remarks: db.raw(`concat(remarks, ' [PM Completed on ', ?, ']')`, [completionDate]),
        updated_at: new Date()
      });

      // 5. Log history timeline for asset
      await trx('asset_history').insert({
        asset_id: schedule.asset_id,
        action: 'Maintenance',
        notes: `Preventive Maintenance PM ${schedule.maintenance_number} completed. Findings: ${findings}`,
        performed_by: req.user.id,
        created_at: new Date()
      });

      // 6. AUTO-CREATE NEXT SCHEDULE RECURRENCE
      if (calculatedNextDate && schedule.frequency !== 'Custom') {
        const nextPMNumber = await getNextNumber('Maintenance', trx);
        const [insertedNextId] = await trx('maintenance_schedules').insert({
          maintenance_number: nextPMNumber,
          asset_id: schedule.asset_id,
          maintenance_type: schedule.maintenance_type,
          frequency: schedule.frequency,
          scheduled_date: calculatedNextDate,
          assigned_technician_id: schedule.assigned_technician_id,
          status: 'Scheduled',
          remarks: `Automatically recurring item from PM ${schedule.maintenance_number}.`,
          created_at: new Date(),
          updated_at: new Date()
        });
        nextPMId = insertedNextId;

        // Clone checklist definitions for the next schedule
        const activeChecklists = await trx('maintenance_checklists').where('schedule_id', id);
        const nextChecklistInserts = activeChecklists.map(c => ({
          schedule_id: nextPMId,
          checklist_item: c.checklist_item,
          is_checked: false
        }));
        await trx('maintenance_checklists').insert(nextChecklistInserts);
      }
    });

    const completedPM = await db('maintenance_schedules').where('id', id).first();
    await logAudit(req, { action: 'Complete PM Schedule', module: 'Maintenance', recordId: id, newValues: completedPM });

    return res.json({
      success: true,
      message: 'Preventive maintenance completed successfully. Next cycle scheduled.',
      data: {
        completedPM,
        nextPMId
      }
    });

  } catch (err) {
    logger.error(`Complete maintenance error: ${err.message}`);
    return res.status(500).json({ success: false, message: `Failed to complete maintenance: ${err.message}` });
  }
});

module.exports = router;
