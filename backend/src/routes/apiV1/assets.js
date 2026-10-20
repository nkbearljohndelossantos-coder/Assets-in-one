const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const { apiKeyAuth } = require('../../middleware/apiKeyAuth');
const { requireScope } = require('../../middleware/scopeAuth');
const { apiRateLimiter } = require('../../middleware/apiRateLimiter');
const { apiAuditLogger } = require('../../middleware/apiAuditLogger');
const { validateRequest } = require('../../middleware/validateRequest');
const { idempotencyMiddleware } = require('../../middleware/idempotencyMiddleware');
const { sendSuccess, sendError } = require('../../utils/apiResponse');
const { z } = require('zod');
const { randomUUID } = require('crypto');

// Apply global API middlewares
router.use(apiKeyAuth);
router.use(apiRateLimiter());
router.use(apiAuditLogger);

// Validation Schemas
const createAssetSchema = z.object({
  assetTag: z.string().min(2).max(100),
  name: z.string().min(2).max(255),
  category: z.string().default('Hardware'),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  status: z.enum(['available', 'assigned', 'maintenance', 'retired']).default('available'),
  location: z.string().optional(),
  specs: z.record(z.any()).optional()
});

const querySchema = z.object({
  page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform(val => (val ? Math.min(parseInt(val, 10), 100) : 20)),
  status: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional()
});

/**
 * GET /api/v1/assets
 * Required Scope: assets:read
 */
router.get('/', requireScope('assets:read'), validateRequest({ query: querySchema }), async (req, res) => {
  try {
    const { page, limit, status, category, search } = req.query;
    const offset = (page - 1) * limit;

    let query = db('assets');
    if (status) query = query.where('status', status);
    if (category) query = query.where('category', category);
    if (search) {
      query = query.where(function() {
        this.where('name', 'like', `%${search}%`)
            .orWhere('asset_tag', 'like', `%${search}%`)
            .orWhere('serial_number', 'like', `%${search}%`);
      });
    }

    const [{ count }] = await query.clone().count('* as count');
    const totalRecords = parseInt(count, 10);
    const assets = await query.select('*').orderBy('created_at', 'desc').limit(limit).offset(offset);

    return sendSuccess(res, assets, {
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching assets:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve assets.');
  }
});

/**
 * POST /api/v1/assets
 * Required Scope: assets:create
 */
router.post(
  '/',
  requireScope('assets:create'),
  idempotencyMiddleware(),
  validateRequest({ body: createAssetSchema }),
  async (req, res) => {
    try {
      const data = req.body;
      const assetId = randomUUID();

      const newAsset = {
        id: assetId,
        asset_tag: data.assetTag,
        name: data.name,
        category: data.category,
        brand: data.brand || null,
        model: data.model || null,
        serial_number: data.serialNumber || null,
        status: data.status,
        location: data.location || null,
        specs: data.specs ? JSON.stringify(data.specs) : null,
        created_at: new Date(),
        updated_at: new Date()
      };

      await db('assets').insert(newAsset);

      return sendSuccess(res, newAsset, {}, 201);
    } catch (err) {
      console.error('Error creating asset:', err);
      return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to create asset.');
    }
  }
);

/**
 * GET /api/v1/assets/:id
 * Required Scope: assets:read
 */
router.get('/:id', requireScope('assets:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await db('assets').where('id', id).orWhere('asset_tag', id).first();

    if (!asset) {
      return sendError(res, 404, 'NOT_FOUND', `Asset '${id}' not found.`);
    }

    return sendSuccess(res, asset);
  } catch (err) {
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch asset.');
  }
});

module.exports = router;
