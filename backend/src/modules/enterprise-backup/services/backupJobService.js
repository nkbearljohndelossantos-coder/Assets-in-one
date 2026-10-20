const crypto = require('crypto');
const db = require('../../../config/db');
const backupRepository = require('../repositories/backupRepository');
const backupRepositoryService = require('./backupRepositoryService');
const { generateDEK, encryptAES256GCM, appendAuditLog } = require('../security/backupSecurity');

class BackupJobService {

  async createJob(payload, req = {}) {
    const { name, deviceId, policyId, repositoryId, backupMode, sourcePaths } = payload;

    const device = await backupRepository.getDeviceById(deviceId);
    if (!device) throw new Error('DEVICE_NOT_FOUND');

    const repository = await backupRepository.getRepositoryById(repositoryId);
    if (!repository) throw new Error('REPOSITORY_NOT_FOUND');

    const jobCode = 'JOB-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    return db.transaction(async (trx) => {
      const [jobId] = await trx('backup_jobs').insert({
        job_code: jobCode,
        name,
        device_id: deviceId,
        policy_id: policyId || null,
        repository_id: repositoryId,
        job_type: 'FileBackup',
        backup_mode: backupMode || 'Incremental',
        status: 'Idle',
        created_at: new Date(),
        updated_at: new Date()
      });

      for (const pathStr of sourcePaths) {
        await trx('backup_job_sources').insert({
          job_id: jobId,
          source_path: pathStr,
          is_exclude: false,
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      await appendAuditLog(trx, {
        actorType: 'User',
        actorId: req.user?.id || 'system',
        deviceId: device.device_id,
        action: 'Create Backup Job',
        result: 'Success',
        correlationId: req.correlationId || crypto.randomUUID(),
        metadata: { jobId, jobCode, name, deviceId, repositoryId }
      });

      return backupRepository.getJobById(jobId);
    });
  }

  /**
   * Trigger / Lease a Job Execution (Mandatory Correction #15)
   */
  async triggerJobExecution(jobId, req = {}) {
    const job = await backupRepository.getJobById(jobId);
    if (!job) throw new Error('JOB_NOT_FOUND');

    const device = await backupRepository.getDeviceById(job.device_id);
    if (!device) throw new Error('DEVICE_NOT_FOUND');

    const repository = await backupRepository.getRepositoryById(job.repository_id);
    if (!repository) throw new Error('REPOSITORY_NOT_FOUND');

    // Check if job already has active running execution
    const activeExec = await backupRepository.getActiveExecutionForJob(jobId);
    if (activeExec) {
      throw new Error('JOB_EXECUTION_ALREADY_ACTIVE');
    }

    const executionCode = 'EXEC-' + crypto.randomBytes(8).toString('hex');
    const leaseId = 'LEASE-' + crypto.randomBytes(12).toString('hex');
    const idempotencyKey = 'IDEM-' + crypto.randomBytes(12).toString('hex');
    const leaseExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min lease

    // Generate random DEK for this backup run (Mandatory Correction #13)
    const rawDEK = generateDEK();
    const wrappedDEK = encryptAES256GCM(rawDEK.toString('base64'));

    // Check if SMB credentials needed
    let smbCredentials = null;
    if (repository.type === 'SMB') {
      smbCredentials = await backupRepositoryService.getDecryptedSMBCredentialsInternal(repository.id);
    }

    return db.transaction(async (trx) => {
      const [executionId] = await trx('backup_executions').insert({
        execution_code: executionCode,
        job_id: jobId,
        device_id: device.id,
        lease_id: leaseId,
        lease_expires_at: leaseExpiresAt,
        attempt_number: 1,
        idempotency_key: idempotencyKey,
        state: 'assigned', // Initial state
        progress_percent: 0,
        transfer_speed_mbps: 0,
        bytes_scanned: 0,
        bytes_read: 0,
        bytes_transferred: 0,
        files_processed: 0,
        started_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      });

      await trx('backup_jobs').where({ id: jobId }).update({
        status: 'Running',
        updated_at: new Date()
      });

      await appendAuditLog(trx, {
        actorType: req.user ? 'User' : 'System',
        actorId: req.user?.id || 'scheduler',
        deviceId: device.device_id,
        action: 'Trigger Job Execution',
        result: 'Success',
        correlationId: req.correlationId || crypto.randomUUID(),
        metadata: { executionId, executionCode, jobId, leaseId, leaseExpiresAt }
      });

      const sources = await trx('backup_job_sources').where({ job_id: jobId });

      return {
        executionId,
        executionCode,
        jobId,
        jobCode: job.job_code,
        jobName: job.name,
        deviceId: device.device_id,
        leaseId,
        leaseExpiresAt,
        attemptNumber: 1,
        idempotencyKey,
        backupMode: job.backup_mode,
        jobType: job.job_type,
        sourcePaths: sources.map(s => s.source_path),
        repository: {
          id: repository.id,
          name: repository.name,
          type: repository.type,
          targetPath: repository.target_path,
          bandwidthLimitMbps: repository.bandwidth_limit_mbps,
          smbCredentials
        },
        cryptoParams: {
          wrappedDEK: wrappedDEK.ciphertext,
          dekIv: wrappedDEK.iv,
          dekTag: wrappedDEK.tag,
          dekKeyRef: 'KEK-V1'
        }
      };
    });
  }

  /**
   * Server-controlled state machine transition validator (Mandatory Correction #16)
   */
  async updateExecutionStateFromAgent(deviceId, payload) {
    const { executionId, leaseId, state, progressPercent, transferSpeedMbps, bytesScanned, bytesRead, bytesTransferred, filesProcessed, errorMessage } = payload;

    const execution = await db('backup_executions').where({ id: executionId, lease_id: leaseId }).first();
    if (!execution) {
      throw new Error('INVALID_LEASE_OR_EXECUTION_NOT_FOUND');
    }

    const device = await backupRepository.getDeviceById(execution.device_id);
    if (device.device_id !== deviceId) {
      throw new Error('DEVICE_EXECUTION_MISMATCH');
    }

    // Validate state transitions
    const validStates = [
      'queued', 'assigned', 'accepted', 'validating', 'scanning', 
      'reading', 'compressing', 'encrypting', 'writing', 'finalizing', 
      'verifying', 'completed', 'completed_with_warnings', 'retry_wait', 
      'cancelling', 'cancelled', 'interrupted', 'failed', 'quarantined'
    ];

    if (!validStates.includes(state)) {
      throw new Error(`INVALID_EXECUTION_STATE: ${state}`);
    }

    const updatePayload = {
      state,
      progress_percent: progressPercent !== undefined ? progressPercent : execution.progress_percent,
      transfer_speed_mbps: transferSpeedMbps !== undefined ? transferSpeedMbps : execution.transfer_speed_mbps,
      bytes_scanned: bytesScanned !== undefined ? bytesScanned : execution.bytes_scanned,
      bytes_read: bytesRead !== undefined ? bytesRead : execution.bytes_read,
      bytes_transferred: bytesTransferred !== undefined ? bytesTransferred : execution.bytes_transferred,
      files_processed: filesProcessed !== undefined ? filesProcessed : execution.files_processed,
      updated_at: new Date()
    };

    if (errorMessage) updatePayload.error_message = errorMessage;
    if (['completed', 'completed_with_warnings', 'failed', 'cancelled'].includes(state)) {
      updatePayload.finished_at = new Date();
      await db('backup_jobs').where({ id: execution.job_id }).update({ status: 'Idle', updated_at: new Date() });
    }

    await backupRepository.updateExecutionState(executionId, state, updatePayload);

    return { executionId, state, updated: true };
  }
}

module.exports = new BackupJobService();
