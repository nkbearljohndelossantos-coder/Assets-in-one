const { z } = require('zod');

const createPrinterSchema = z.object({
  printer_name: z.string().min(2).max(100),
  brand: z.string().min(2).max(50),
  model: z.string().min(2).max(50),
  location: z.string().max(100).optional().nullable(),
  department_id: z.number().int().positive().optional().nullable(),
  toner_model: z.string().max(100).optional().nullable(),
  ink_level: z.number().int().min(0).max(100).default(100),
  status: z.enum(['Online', 'Offline', 'Maintenance Required']).default('Online'),
  remarks: z.string().max(500).optional().nullable(),

  // Mapped IP Allocation info
  ip_address: z.string().regex(/^[\w.:]+$/, { message: "Invalid IPv4/IPv6 address" }).optional().nullable(),
  mac_address: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, { message: "Invalid MAC format" }).optional().nullable(),
  vlan: z.string().optional().nullable(),
  subnet: z.string().optional().nullable(),
  gateway: z.string().regex(/^[\w.:]+$/, { message: "Invalid Gateway IP" }).optional().nullable()
});

const updatePrinterSchema = createPrinterSchema.partial();

const assignPrinterUserSchema = z.object({
  employee_id: z.number().int().positive()
});

const createPrinterMaintenanceLogSchema = z.object({
  action_type: z.enum(['Repair', 'Cleaning', 'Toner Replacement', 'Other']),
  action_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  parts_replaced: z.string().max(500).optional().nullable(),
  cost: z.number().nonnegative().default(0),
  findings: z.string().min(5),
  action_performed: z.string().min(5),
  next_maintenance_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  attachments_path: z.string().optional().nullable()
});

module.exports = {
  createPrinterSchema,
  updatePrinterSchema,
  assignPrinterUserSchema,
  createPrinterMaintenanceLogSchema
};
