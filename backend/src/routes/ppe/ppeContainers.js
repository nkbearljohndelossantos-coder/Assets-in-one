const express = require('express');
const { z } = require('zod');
const db = require('../../config/db');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/auditLogger');

const ppeContainersRouter = express.Router();

const containerSchema = z.object({
  containerCode: z.string().min(1, 'Container code is required'),
  containerType: z.string().min(1, 'Container type is required'),
  description: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  status: z.enum(['AVAILABLE', 'CHECKED_OUT', 'IN_TRANSIT', 'DAMAGED', 'RETIRED']).default('AVAILABLE'),
  currentHolder: z.string().optional().nullable(),
  departmentId: z.preprocess((v) => (v ? Number(v) : null), z.number().nullable().optional()),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

const movementSchema = z.object({
  action: z.enum(['CHECK_OUT', 'CHECK_IN', 'TRANSFER', 'MAINTENANCE', 'STATUS_CHANGE']),
  fromLocation: z.string().optional().nullable(),
  toLocation: z.string().min(1, 'Destination / to location is required'),
  releasedTo: z.string().min(1, 'Released to person or department is required'),
  newStatus: z.enum(['AVAILABLE', 'CHECKED_OUT', 'IN_TRANSIT', 'DAMAGED', 'RETIRED']).optional(),
  notes: z.string().optional().nullable()
});

// 1. GET ALL RETURNABLE CONTAINERS
ppeContainersRouter.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { status, type, q } = req.query;

    let query = db('ppe_returnable_containers as c')
      .leftJoin('departments as d', 'c.department_id', 'd.id')
      .select('c.*', 'd.name as department_name');

    if (status) query = query.where('c.status', status);
    if (type) query = query.where('c.container_type', type);
    if (q) {
      const term = `%${q}%`;
      query = query.where(function() {
        this.where('c.container_code', 'like', term)
          .orWhere('c.container_type', 'like', term)
          .orWhere('c.description', 'like', term)
          .orWhere('c.current_holder', 'like', term)
          .orWhere('c.location', 'like', term);
      });
    }

    const containers = await query.orderBy('c.container_code', 'asc');
    return res.json({ success: true, count: containers.length, data: containers });
  } catch (err) {
    return next(err);
  }
});

// 2. GET CONTAINER STATS
ppeContainersRouter.get('/stats', authenticateToken, async (req, res, next) => {
  try {
    const stats = await db('ppe_returnable_containers')
      .select('status')
      .count('id as count')
      .groupBy('status');

    const result = {
      total: 0,
      available: 0,
      checkedOut: 0,
      inTransit: 0,
      damaged: 0,
      retired: 0
    };

    for (const s of stats) {
      const c = Number(s.count);
      result.total += c;
      if (s.status === 'AVAILABLE') result.available = c;
      if (s.status === 'CHECKED_OUT') result.checkedOut = c;
      if (s.status === 'IN_TRANSIT') result.inTransit = c;
      if (s.status === 'DAMAGED') result.damaged = c;
      if (s.status === 'RETIRED') result.retired = c;
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
});

// 3. GET SINGLE CONTAINER WITH MOVEMENTS
ppeContainersRouter.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const id = req.params.id;
    const container = await db('ppe_returnable_containers as c')
      .leftJoin('departments as d', 'c.department_id', 'd.id')
      .where('c.id', id)
      .select('c.*', 'd.name as department_name')
      .first();

    if (!container) return res.status(404).json({ error: 'NOT_FOUND', message: 'Container not found' });

    const movements = await db('ppe_container_movements as m')
      .leftJoin('users as u', 'm.recorded_by', 'u.id')
      .where('m.container_id', id)
      .select('m.*', 'u.username as recorded_by_username')
      .orderBy('m.created_at', 'desc');

    return res.json({
      success: true,
      data: {
        ...container,
        movements
      }
    });
  } catch (err) {
    return next(err);
  }
});

// 4. CREATE CONTAINER
ppeContainersRouter.post('/', authenticateToken, requireRole('ADMIN', 'STAFF', 'IT Manager', 'Super Admin'), async (req, res, next) => {
  try {
    const input = containerSchema.parse(req.body);

    const existing = await db('ppe_returnable_containers').where('container_code', input.containerCode).first();
    if (existing) {
      return res.status(400).json({ error: 'DUPLICATE_CODE', message: `Container code ${input.containerCode} already exists.` });
    }

    const [id] = await db('ppe_returnable_containers').insert({
      container_code: input.containerCode,
      container_type: input.containerType,
      description: input.description || null,
      barcode: input.barcode || null,
      status: input.status,
      current_holder: input.currentHolder || null,
      department_id: input.departmentId || null,
      location: input.location || null,
      notes: input.notes || null,
    });

    // Record initial movement log
    await db('ppe_container_movements').insert({
      container_id: id,
      action: 'CHECK_IN',
      from_location: 'Initial Intake',
      to_location: input.location || 'Warehouse',
      released_to: input.currentHolder || 'Inventory Custodian',
      recorded_by: req.user.id || null,
      notes: 'Initial container registration'
    });

    const created = await db('ppe_returnable_containers').where('id', id).first();
    await logAudit(req, {
      action: 'Create Container',
      module: 'PPE Containers',
      recordId: id,
      newValues: created
    });

    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', issues: err.issues });
    }
    return next(err);
  }
});

// 5. RECORD CONTAINER MOVEMENT
ppeContainersRouter.post('/:id/movements', authenticateToken, async (req, res, next) => {
  try {
    const id = req.params.id;
    const input = movementSchema.parse(req.body);

    const container = await db('ppe_returnable_containers').where('id', id).first();
    if (!container) return res.status(404).json({ error: 'NOT_FOUND', message: 'Container not found' });

    // Determine new status based on action
    let targetStatus = input.newStatus;
    if (!targetStatus) {
      if (input.action === 'CHECK_OUT') targetStatus = 'CHECKED_OUT';
      else if (input.action === 'CHECK_IN') targetStatus = 'AVAILABLE';
      else if (input.action === 'TRANSFER') targetStatus = 'IN_TRANSIT';
      else if (input.action === 'MAINTENANCE') targetStatus = 'DAMAGED';
      else targetStatus = container.status;
    }

    await db.transaction(async (trx) => {
      // 1. Insert movement log
      await trx('ppe_container_movements').insert({
        container_id: id,
        action: input.action,
        from_location: input.fromLocation || container.location,
        to_location: input.toLocation,
        released_to: input.releasedTo,
        recorded_by: req.user.id || null,
        notes: input.notes || null,
      });

      // 2. Update container state
      await trx('ppe_returnable_containers').where('id', id).update({
        status: targetStatus,
        current_holder: input.releasedTo,
        location: input.toLocation,
        updated_at: new Date()
      });
    });

    await logAudit(req, {
      action: `Container ${input.action}`,
      module: 'PPE Containers',
      recordId: id,
      notes: `Container ${container.container_code} moved to ${input.toLocation} (${input.releasedTo})`
    });

    const updated = await db('ppe_returnable_containers').where('id', id).first();
    return res.json({ success: true, message: 'Movement recorded successfully', data: updated });
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', issues: err.issues });
    }
    return next(err);
  }
});

module.exports = { ppeContainersRouter };
