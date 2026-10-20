const { z } = require('zod');

const createWebsiteSchema = z.object({
  name: z.string().min(2).max(100),
  domain: z.string().url({ message: "Invalid URL format. Domain must start with http:// or https://" }),
  hosting_provider: z.string().max(100).optional().nullable(),
  domain_expiration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('Never')).optional().nullable(),
  ssl_expiration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('Never')).optional().nullable(),
  dns_info: z.string().max(500).optional().nullable(),
  admin_employee_id: z.number().int().positive().optional().nullable()
});

const updateWebsiteSchema = createWebsiteSchema.partial();

module.exports = {
  createWebsiteSchema,
  updateWebsiteSchema
};
