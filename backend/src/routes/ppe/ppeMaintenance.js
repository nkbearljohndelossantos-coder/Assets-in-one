const express = require('express');
const { z } = require('zod');
const db = require('../../config/db');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/auditLogger');

const ppeMaintenanceRouter = express.Router();

const maintenanceSchema = z.object({
  maintenanceDate: z.string().min(4, 'Maintenance date is required'),
  description: z.string().min(1, 'Description of maintenance is required'),
  cost: z.preprocess((v) => (v ? Number(v) : 0), z.number().nonnegative().default(0)),
  performedBy: z.string().optional().nullable(),
  assetStatus: z.enum(['ACTIVE', 'UNDER_MAINTENANCE', 'RETIRED']).optional()
});

// 1. GET ALL MAINTENANCE RECORDS ACROSS ALL PPE ASSETS
ppeMaintenanceRouter.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { assetId, from, to } = req.query;

    let query = db('ppe_maintenance_records as m')
      .join('ppe_assets as a', 'm.asset_id', 'a.id')
      .leftJoin('users as u', 'm.created_by', 'u.id')
      .select(
        'm.*',
        'a.asset_code',
        'a.asset_name',
        'a.category_name',
        'u.username as created_by_username'
      );

    if (assetId) query = query.where('m.asset_id', assetId);
    if (from) query = query.where('m.maintenance_date', '>=', from);
    if (to) query = query.where('m.maintenance_date', '<=', to);

    const records = await query.orderBy('m.maintenance_date', 'desc');
    return res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    return next(err);
  }
});

// 2. GET MAINTENANCE RECORDS FOR A SPECIFIC ASSET
ppeMaintenanceRouter.get('/:assetId', authenticateToken, async (req, res, next) => {
  try {
    const assetId = req.params.assetId;
    const records = await db('ppe_maintenance_records as m')
      .leftJoin('users as u', 'm.created_by', 'u.id')
      .where('m.asset_id', assetId)
      .select('m.*', 'u.username as created_by_username')
      .orderBy('m.maintenance_date', 'desc');

    return res.json({ success: true, data: records });
  } catch (err) {
    return next(err);
  }
});

// 3. LOG NEW MAINTENANCE RECORD
ppeMaintenanceRouter.post('/:assetId', authenticateToken, requireRole('ADMIN', 'STAFF', 'IT Manager', 'Technician', 'Super Admin'), async (req, res, next) => {
  try {
    const assetId = req.params.assetId;
    const asset = await db('ppe_assets').where('id', assetId).first();
    if (!asset) return res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });

    const input = maintenanceSchema.parse(req.body);

    let createdRecord;
    await db.transaction(async (trx) => {
      const [id] = await trx('ppe_maintenance_records').insert({
        asset_id: assetId,
        maintenance_date: input.maintenanceDate,
        description: input.description,
        cost: input.cost,
        performed_by: input.performedBy || null,
        created_by: req.user.id || null,
      });

      if (input.assetStatus && input.assetStatus !== asset.status) {
        await trx('ppe_assets').where('id', assetId).update({
          status: input.assetStatus,
          updated_at: new Date()
        });
      }

      createdRecord = await trx('ppe_maintenance_records').where('id', id).first();
    });

    await logAudit(req, {
      action: 'Log PPE Maintenance',
      module: 'PPE Maintenance',
      recordId: createdRecord.id,
      notes: `Maintenance for ${asset.asset_code}: ${input.description}`
    });

    return res.status(201).json({ success: true, data: createdRecord });
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', issues: err.issues });
    }
    return next(err);
  }
});

module.exports = { ppeMaintenanceRouter };
