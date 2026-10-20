const { z } = require('zod');

const createOSSchema = z.object({
  asset_id: z.number().int().positive(),
  edition: z.string().min(2).max(100),
  build_version: z.string().min(2).max(100),
  license_type: z.string().min(2).max(50),
  activation_status: z.enum(['Activated', 'Not Activated']).default('Activated'),
  product_key: z.string().max(100).optional().nullable(),
  last_update_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  end_of_support_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()
});

const updateOSSchema = createOSSchema.partial();

const createAntivirusSchema = z.object({
  asset_id: z.number().int().positive(),
  antivirus_name: z.string().min(2).max(100),
  version: z.string().min(1).max(50),
  license_key: z.string().max(100).optional().nullable(),
  expiration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  last_scan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  scan_result: z.enum(['Clean', 'Threat Found', 'Warning']).default('Clean')
});

const updateAntivirusSchema = createAntivirusSchema.partial();

module.exports = {
  createOSSchema,
  updateOSSchema,
  createAntivirusSchema,
  updateAntivirusSchema
};
