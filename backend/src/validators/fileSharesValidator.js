const { z } = require('zod');

const createFileShareSchema = z.object({
  folder_name: z.string().min(2).max(100),
  server_location: z.string().min(2).max(250), // e.g. \\fileserver\dept
  owner_employee_id: z.number().int().positive().optional().nullable(),
  purpose: z.string().max(500).optional().nullable()
});

const updateFileShareSchema = createFileShareSchema.partial();

const createFileSharePermissionSchema = z.object({
  employee_id: z.number().int().positive().optional().nullable(),
  department_id: z.number().int().positive().optional().nullable(),
  access_level: z.enum(['Read-Only', 'Read/Write', 'Full Control'])
}).refine(data => data.employee_id || data.department_id, {
  message: "Either employee_id or department_id must be provided to map fileshare permissions.",
  path: ["employee_id"]
});

module.exports = {
  createFileShareSchema,
  updateFileShareSchema,
  createFileSharePermissionSchema
};
