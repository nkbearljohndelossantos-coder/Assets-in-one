const { z } = require('zod');

const createBackupSchema = z.object({
  name: z.string().min(3).max(100),
  backup_location: z.string().min(2).max(100),
  backup_type: z.enum(['Full', 'Incremental']),
  status: z.enum(['Success', 'Failed', 'Pending']).default('Success'),
  backup_size_gb: z.number().nonnegative(),
  backup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format. Expected YYYY-MM-DD" }),
  next_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format. Expected YYYY-MM-DD" }),
  remarks: z.string().max(500).optional().nullable()
});

const updateBackupSchema = createBackupSchema.partial();

const verifyBackupSchema = z.object({
  verification_status: z.enum(['Verified', 'Failed']),
  checksum: z.string().min(5).max(100).optional().nullable(),
  restore_test_result: z.string().min(5).max(1000),
  retention_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  backup_file_count: z.number().int().nonnegative().optional()
});

module.exports = {
  createBackupSchema,
  updateBackupSchema,
  verifyBackupSchema
};
