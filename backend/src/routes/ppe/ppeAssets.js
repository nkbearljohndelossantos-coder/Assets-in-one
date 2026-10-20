const express = require('express');
const path = require('path');
const multer = require('multer');
const QRCode = require('qrcode');
const { z } = require('zod');
const db = require('../../config/db');
const { authenticateToken, requirePermission, requireRole } = require('../../middleware/auth');
const { logAudit } = require('../../utils/auditLogger');
const { nextAssetCode } = require('../../utils/assetCode');
const { calcStraightLine, money } = require('../../utils/depreciation');
const logger = require('../../utils/logger');

const ppeAssetsRouter = express.Router();

const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
const maxMb = Number(process.env.MAX_UPLOAD_MB || 10);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `ppe-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: maxMb * 1024 * 1024 }
});

const assetSchema = z.object({
  assetName: z.string().min(1, 'Asset name is required'),
  roomId: z.string().optional().nullable(),
  roomName: z.string().optional().nullable(),
  glAccount: z.string().optional().nullable(),
  category: z.string().min(1, 'Category is required'),
  serialNumber: z.string().optional().nullable(),
  autoGenerateSerial: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional().default(false),
  purchaseDate: z.string().min(4, 'Valid purchase date is required'),
  acquisitionCost: z.preprocess((v) => Number(v), z.number().nonnegative()),
  usefulLifeYears: z.preprocess((v) => Number(v), z.number().int().positive()),
  salvageValue: z.preprocess((v) => (v === undefined || v === null || v === '' ? 0 : Number(v)), z.number().nonnegative().default(0)),
  assignedTo: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'UNDER_MAINTENANCE', 'RETIRED']).default('ACTIVE'),
  remarks: z.string().optional().nullable(),
});

function genSerial() {
  return `SN-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
}

// 1. GET ALL CATEGORIES
ppeAssetsRouter.get('/categories', authenticateToken, async (req, res, next) => {
  try {
    const categories = await db('ppe_asset_categories').orderBy('name', 'asc');
    return res.json({ success: true, data: categories });
  } catch (err) {
    return next(err);
  }
});

// 2. GET ASSETS (SEARCH, FILTER, PAGINATE)
ppeAssetsRouter.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { q, category, status, month, year, asOf } = req.query;

    let query = db('ppe_assets as a')
      .whereNull('a.deleted_at');

    if (category) {
      query = query.where('a.category_name', category);
    }
    if (status) {
      query = query.where('a.status', status);
    }
    if (year) {
      const yr = Number(year);
      query = query.whereRaw("strftime('%Y', a.purchase_date) = ?", [String(yr)]);
    }
    if (month) {
      const mo = String(month).padStart(2, '0');
      query = query.whereRaw("strftime('%m', a.purchase_date) = ?", [mo]);
    }
    if (q) {
      const term = `%${q}%`;
      query = query.where((builder) => {
        builder.where('a.asset_name', 'like', term)
          .orWhere('a.asset_code', 'like', term)
          .orWhere('a.serial_number', 'like', term)
          .orWhere('a.assigned_to', 'like', term)
          .orWhere('a.room_name', 'like', term)
          .orWhere('a.location', 'like', term);
      });
    }

    const rows = await query
      .select('a.*')
      .orderBy('a.created_at', 'desc')
      .limit(500);

    const targetDate = asOf ? String(asOf) : new Date().toISOString().slice(0, 10);
    const enriched = rows.map((a) => {
      const d = calcStraightLine({
        acquisitionCost: a.acquisition_cost,
        salvageValue: a.salvage_value,
        usefulLifeYears: a.useful_life_years,
        purchaseDate: a.purchase_date,
        asOfDate: targetDate,
      });
      return {
        ...a,
        depreciation: d,
        netBookValue: d.netBookValue,
        accumulatedDepreciation: d.accumulatedDepreciation,
      };
    });

    // Provide both raw array and { success: true, data } for compatibility
    res.setHeader('X-Total-Count', enriched.length);
    if (req.headers['x-api-format'] === 'wrapped') {
      return res.json({ success: true, count: enriched.length, data: enriched });
    }
    return res.json(enriched);
  } catch (err) {
    return next(err);
  }
});

// 3. GET ASSET BY ID
ppeAssetsRouter.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const id = req.params.id;
    const isNum = /^\d+$/.test(id);

    const asset = await db('ppe_assets')
      .where(function() {
        if (isNum) this.where('id', Number(id)).orWhere('asset_code', id);
        else this.where('asset_code', id);
      })
      .whereNull('deleted_at')
      .first();

    if (!asset) return res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });

    const asOf = req.query.asOf ? String(req.query.asOf) : new Date().toISOString().slice(0, 10);
    const dep = calcStraightLine({
      acquisitionCost: asset.acquisition_cost,
      salvageValue: asset.salvage_value,
      usefulLifeYears: asset.useful_life_years,
      purchaseDate: asset.purchase_date,
      asOfDate: asOf,
    });

    const maintenance = await db('ppe_maintenance_records')
      .where('asset_id', asset.id)
      .orderBy('maintenance_date', 'desc');

    const result = {
      ...asset,
      depreciation: dep,
      netBookValue: dep.netBookValue,
      accumulatedDepreciation: dep.accumulatedDepreciation,
      maintenanceRecords: maintenance
    };

    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// 4. CREATE NEW ASSET
ppeAssetsRouter.post('/', authenticateToken, requireRole('ADMIN', 'STAFF', 'IT Manager', 'Super Admin'), upload.single('image'), async (req, res, next) => {
  try {
    const input = assetSchema.parse(req.body);
    const assetCode = await nextAssetCode(input.purchaseDate);
    const serial = input.autoGenerateSerial ? genSerial() : (input.serialNumber || null);
    const imagePath = req.file ? `/uploads/${path.basename(req.file.path)}` : null;

    // Check or find category
    let category = await db('ppe_asset_categories').where('name', input.category).first();
    if (!category) {
      const [newCatId] = await db('ppe_asset_categories').insert({ name: input.category });
      category = { id: newCatId, name: input.category };
    }

    const newRecord = {
      asset_code: assetCode,
      asset_name: input.assetName,
      room_id: input.roomId || null,
      room_name: input.roomName || null,
      gl_account: input.glAccount || null,
      category_id: category ? category.id : null,
      category_name: input.category,
      serial_number: serial,
      purchase_date: input.purchaseDate,
      acquisition_cost: input.acquisitionCost,
      useful_life_years: input.usefulLifeYears,
      salvage_value: input.salvageValue,
      assigned_to: input.assignedTo || null,
      location: input.location || null,
      status: input.status,
      notes: input.remarks || null,
      image_path: imagePath,
      created_by: req.user.id || null,
      updated_by: req.user.id || null,
    };

    const [id] = await db('ppe_assets').insert(newRecord);
    const created = await db('ppe_assets').where('id', id).first();

    await logAudit(req, {
      action: 'Create PPE Asset',
      module: 'PPE',
      recordId: id,
      newValues: created,
    });

    return res.status(201).json(created);
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', issues: err.issues });
    }
    return next(err);
  }
});

// 5. UPDATE ASSET
ppeAssetsRouter.put('/:id', authenticateToken, requireRole('ADMIN', 'STAFF', 'IT Manager', 'Super Admin'), upload.single('image'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const existing = await db('ppe_assets')
      .where('id', id)
      .whereNull('deleted_at')
      .first();

    if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });

    const input = assetSchema.partial().parse(req.body);
    const imagePath = req.file ? `/uploads/${path.basename(req.file.path)}` : existing.image_path;

    const updates = {
      asset_name: input.assetName ?? existing.asset_name,
      room_id: input.roomId ?? existing.room_id,
      room_name: input.roomName ?? existing.room_name,
      gl_account: input.glAccount ?? existing.gl_account,
      category_name: input.category ?? existing.category_name,
      serial_number: input.serialNumber ?? existing.serial_number,
      purchase_date: input.purchaseDate ?? existing.purchase_date,
      acquisition_cost: input.acquisitionCost ?? existing.acquisition_cost,
      useful_life_years: input.usefulLifeYears ?? existing.useful_life_years,
      salvage_value: input.salvageValue ?? existing.salvage_value,
      assigned_to: input.assignedTo ?? existing.assigned_to,
      location: input.location ?? existing.location,
      status: input.status ?? existing.status,
      notes: input.remarks ?? existing.notes,
      image_path: imagePath,
      updated_by: req.user.id || null,
      updated_at: new Date()
    };

    await db('ppe_assets').where('id', id).update(updates);
    const updated = await db('ppe_assets').where('id', id).first();

    await logAudit(req, {
      action: 'Update PPE Asset',
      module: 'PPE',
      recordId: id,
      oldValues: existing,
      newValues: updated,
    });

    return res.json(updated);
  } catch (err) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', issues: err.issues });
    }
    return next(err);
  }
});

// 6. DELETE ASSET (SOFT DELETE)
ppeAssetsRouter.delete('/:id', authenticateToken, requireRole('ADMIN', 'Super Admin', 'IT Manager'), async (req, res, next) => {
  try {
    const id = req.params.id;
    const existing = await db('ppe_assets')
      .where('id', id)
      .whereNull('deleted_at')
      .first();

    if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });

    await db('ppe_assets')
      .where('id', id)
      .update({
        deleted_at: new Date(),
        updated_by: req.user.id || null
      });

    await logAudit(req, {
      action: 'Delete PPE Asset',
      module: 'PPE',
      recordId: id,
      oldValues: existing
    });

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// 7. GET DEPRECIATION BREAKDOWN
ppeAssetsRouter.get('/:id/depreciation', authenticateToken, async (req, res, next) => {
  try {
    const id = req.params.id;
    const asset = await db('ppe_assets')
      .where('id', id)
      .whereNull('deleted_at')
      .first();

    if (!asset) return res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });

    const asOf = req.query.asOf ? String(req.query.asOf) : new Date().toISOString().slice(0, 10);
    const d = calcStraightLine({
      acquisitionCost: asset.acquisition_cost,
      salvageValue: asset.salvage_value,
      usefulLifeYears: asset.useful_life_years,
      purchaseDate: asset.purchase_date,
      asOfDate: asOf,
    });

    return res.json({ asOf, ...d });
  } catch (err) {
    return next(err);
  }
});

// 8. GENERATE QR CODE FOR ASSET
ppeAssetsRouter.get('/:id/qrcode', authenticateToken, async (req, res, next) => {
  try {
    const id = req.params.id;
    const asset = await db('ppe_assets')
      .where('id', id)
      .whereNull('deleted_at')
      .first();

    if (!asset) return res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });

    const payload = JSON.stringify({
      id: asset.id,
      assetCode: asset.asset_code,
      name: asset.asset_name,
      serial: asset.serial_number || '',
      category: asset.category_name,
      room: asset.room_name || asset.location || ''
    });

    const png = await QRCode.toBuffer(payload, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 6
    });

    res.setHeader('Content-Type', 'image/png');
    return res.send(png);
  } catch (err) {
    return next(err);
  }
});

module.exports = { ppeAssetsRouter };
