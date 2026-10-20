const { z } = require('zod');

const createEnrollmentTokenSchema = z.object({
  expiresInHours: z.number().int().min(1).max(168).default(24),
  maxUses: z.number().int().min(1).max(100).default(1)
});

const enrollAgentSchema = z.object({
  enrollmentToken: z.string().min(10),
  deviceId: z.string().min(5).max(100),
  deviceName: z.string().min(1).max(150),
  hostname: z.string().min(1).max(150),
  ipAddress: z.string().nullable().optional(),
  macAddress: z.string().nullable().optional(),
  osVersion: z.string().nullable().optional(),
  agentVersion: z.string().min(1).max(50),
  publicKeyPem: z.string().min(20)
});

const createRepositorySchema = z.object({
  name: z.string().min(2).max(150),
  type: z.enum(['LocalFolder', 'ExternalDisk', 'SMB']),
  targetPath: z.string().min(2),
  quotaBytes: z.number().nullable().optional(),
  concurrentJobLimit: z.number().int().min(1).max(20).default(3),
  bandwidthLimitMbps: z.number().int().nullable().optional(),
  smbDomain: z.string().nullable().optional(),
  smbUsername: z.string().nullable().optional(),
  smbPassword: z.string().nullable().optional()
});

const createPolicySchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().nullable().optional(),
  repositoryId: z.number().int().positive(),
  compressionMode: z.enum(['None', 'Fast', 'Balanced', 'Maximum']).default('Balanced'),
  encryptionAlgo: z.enum(['AES-256-GCM']).default('AES-256-GCM'),
  retentionKeepCount: z.number().int().min(1).default(7),
  retentionDays: z.number().int().min(1).default(30),
  strictHashMode: z.boolean().default(false)
});

const createJobSchema = z.object({
  name: z.string().min(2).max(150),
  deviceId: z.number().int().positive(),
  policyId: z.number().int().positive().nullable().optional(),
  repositoryId: z.number().int().positive(),
  backupMode: z.enum(['Full', 'Incremental']).default('Incremental'),
  sourcePaths: z.array(z.string().min(1)).min(1)
});

const authorizeRestoreSchema = z.object({
  restorePointId: z.number().int().positive(),
  targetDeviceId: z.number().int().positive(),
  targetDirectory: z.string().min(2),
  conflictOption: z.enum(['Overwrite', 'Skip', 'Rename']).default('Overwrite')
});

module.exports = {
  createEnrollmentTokenSchema,
  enrollAgentSchema,
  createRepositorySchema,
  createPolicySchema,
  createJobSchema,
  authorizeRestoreSchema
};
