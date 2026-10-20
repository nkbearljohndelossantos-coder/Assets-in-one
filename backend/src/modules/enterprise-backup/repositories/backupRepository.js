const db = require('../../../config/db');

class BackupRepository {

  // Devices
  async getDeviceById(id) {
    return db('backup_devices').where({ id }).first();
  }

  async getDeviceByDeviceId(deviceId) {
    return db('backup_devices').where({ device_id: deviceId }).first();
  }

  async getAllDevices() {
    return db('backup_devices').select('*').orderBy('enrolled_at', 'desc');
  }

  async updateDeviceStatus(deviceId, status, agentVersion = null) {
    const updatePayload = { status, last_heartbeat_at: new Date(), updated_at: new Date() };
    if (agentVersion) updatePayload.agent_version = agentVersion;
    return db('backup_devices').where({ device_id: deviceId }).update(updatePayload);
  }

  // Enrollment Tokens
  async getEnrollmentToken(token) {
    return db('backup_enrollment_tokens').where({ token }).first();
  }

  async incrementTokenUsage(token, trx) {
    const knexClient = trx || db;
    return knexClient('backup_enrollment_tokens')
      .where({ token })
      .increment('uses_count', 1);
  }

  // Repositories
  async getAllRepositories() {
    return db('backup_repositories')
      .select('id', 'name', 'type', 'target_path', 'quota_bytes', 'free_space_bytes', 'status', 'is_encrypted_at_rest', 'concurrent_job_limit', 'bandwidth_limit_mbps', 'last_connectivity_check', 'last_verification_date', 'created_at', 'updated_at')
      .orderBy('name', 'asc');
  }

  async getRepositoryById(id) {
    return db('backup_repositories')
      .select('id', 'name', 'type', 'target_path', 'quota_bytes', 'free_space_bytes', 'status', 'is_encrypted_at_rest', 'concurrent_job_limit', 'bandwidth_limit_mbps', 'last_connectivity_check', 'last_verification_date', 'created_at', 'updated_at')
      .where({ id })
      .first();
  }

  // Jobs
  async getAllJobs() {
    return db('backup_jobs')
      .join('backup_devices', 'backup_jobs.device_id', 'backup_devices.id')
      .join('backup_repositories', 'backup_jobs.repository_id', 'backup_repositories.id')
      .select(
        'backup_jobs.*',
        'backup_devices.device_name',
        'backup_devices.hostname',
        'backup_repositories.name as repository_name',
        'backup_repositories.type as repository_type'
      )
      .orderBy('backup_jobs.created_at', 'desc');
  }

  async getJobById(id) {
    const job = await db('backup_jobs').where({ id }).first();
    if (!job) return null;
    const sources = await db('backup_job_sources').where({ job_id: id });
    return { ...job, sources };
  }

  // Executions & Leases
  async getActiveExecutionForJob(jobId) {
    return db('backup_executions')
      .where({ job_id: jobId })
      .whereIn('state', ['queued', 'assigned', 'accepted', 'validating', 'scanning', 'reading', 'compressing', 'encrypting', 'writing', 'finalizing', 'verifying'])
      .first();
  }

  async updateExecutionState(executionId, state, updateData = {}, trx) {
    const knexClient = trx || db;
    return knexClient('backup_executions')
      .where({ id: executionId })
      .update({
        state,
        ...updateData,
        updated_at: new Date()
      });
  }

  // Restore Points
  async getRestorePointsForDevice(deviceId) {
    return db('backup_restore_points')
      .where({ device_id: deviceId })
      .orderBy('created_at', 'desc');
  }

  // Audit Logs
  async getAuditLogs(limit = 100) {
    return db('backup_audit_events')
      .select('*')
      .orderBy('sequence_number', 'desc')
      .limit(limit);
  }
}

module.exports = new BackupRepository();
