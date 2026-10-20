const db = require('../config/db');
const logger = require('../utils/logger');
const crypto = require('crypto');
const RemoteProviderFactory = require('./meshcentral/RemoteProviderFactory');
const { appendAuditLog } = require('../utils/auditChain');

class RemoteSchedulerService {
  /**
   * Acquire a distributed worker lock to ensure multi-node idempotency.
   */
  static async acquireLock(lockKey, ownerId, ttlSeconds = 60) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    try {
      const existing = await db('scheduler_locks').where({ lock_key: lockKey }).first();
      if (existing && new Date(existing.expires_at) > now && existing.owner_id !== ownerId) {
        return false; // Lock owned by another node
      }

      if (existing) {
        await db('scheduler_locks')
          .where({ lock_key: lockKey })
          .update({ owner_id: ownerId, acquired_at: now, expires_at: expiresAt });
      } else {
        await db('scheduler_locks').insert({
          lock_key: lockKey,
          owner_id: ownerId,
          acquired_at: now,
          expires_at: expiresAt
        });
      }
      return true;
    } catch (err) {
      logger.error(`[SchedulerLock] Lock acquisition error: ${err.message}`);
      return false;
    }
  }

  /**
   * Release worker lock.
   */
  static async releaseLock(lockKey, ownerId) {
    await db('scheduler_locks').where({ lock_key: lockKey, owner_id: ownerId }).del();
  }

  /**
   * Check eligibility 1 second immediately before executing power action.
   */
  static async checkDeviceEligibility(deviceId) {
    // 1. Check if device is in device_exclusions
    const isExcluded = await db('device_exclusions').where({ device_id: deviceId }).first();
    if (isExcluded) {
      return { eligible: false, reason: `Excluded: ${isExcluded.exclusion_reason}` };
    }

    // 2. Check if device is in protected_devices
    const isProtected = await db('protected_devices').where({ device_id: deviceId }).first();
    if (isProtected) {
      return { eligible: false, reason: `Protected Infrastructure Device (${isProtected.protection_level})` };
    }

    // 3. Check active maintenance
    const activeMaintenance = await db('maintenance_schedules')
      .where({ status: 'Scheduled' })
      .first();
    if (activeMaintenance) {
      return { eligible: false, reason: 'Active Maintenance Mode Window' };
    }

    return { eligible: true };
  }

  /**
   * Execute scheduled power task loop.
   */
  static async runSchedulerTick() {
    const workerId = `worker-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    const acquired = await this.acquireLock('power_scheduler_tick_lock', workerId, 30);
    if (!acquired) return; // Another worker node is processing this tick

    try {
      const now = new Date();
      // Fetch active schedules due for execution
      const dueSchedules = await db('remote_schedules')
        .where('is_active', true)
        .where('next_run_at', '<=', now);

      for (const schedule of dueSchedules) {
        const idempotencyKey = crypto.createHash('sha256').update(`${schedule.id}:${schedule.next_run_at.toISOString()}`).digest('hex');
        const existingExecution = await db('remote_schedule_executions').where({ idempotency_key: idempotencyKey }).first();

        if (existingExecution) continue; // Already processed idempotently

        // Create execution log
        const [executionId] = await db('remote_schedule_executions').insert({
          schedule_id: schedule.id,
          idempotency_key: idempotencyKey,
          status: 'running',
          started_at: now
        });

        // Resolve target devices
        const targetRecords = await db('remote_schedule_targets').where({ schedule_id: schedule.id });
        let targetDeviceIds = [];

        if (schedule.target_type === 'all') {
          targetDeviceIds = await db('managed_devices').pluck('device_id');
        } else if (schedule.target_type === 'single') {
          targetDeviceIds = targetRecords.map(t => t.target_id);
        } else if (schedule.target_type === 'department') {
          const deptIds = targetRecords.map(t => t.target_id);
          targetDeviceIds = await db('managed_devices').whereIn('department_id', deptIds).pluck('device_id');
        }

        const provider = await RemoteProviderFactory.getProvider();

        for (const devId of targetDeviceIds) {
          // Pre-execution eligibility check
          const eligibility = await this.checkDeviceEligibility(devId);
          if (!eligibility.eligible) {
            await db('remote_schedule_execution_targets').insert({
              execution_id: executionId,
              device_id: devId,
              status: 'skipped_protected',
              skip_reason: eligibility.reason
            });
            continue;
          }

          // Execute scheduled power action via provider
          const result = await provider.executeCommand(devId, schedule.created_by, schedule.command_type, { scheduled: true });
          
          await db('remote_schedule_execution_targets').insert({
            execution_id: executionId,
            device_id: devId,
            status: 'executed',
            executed_at: new Date()
          });

          await appendAuditLog(
            `SCHEDULED_${schedule.command_type.toUpperCase()}`,
            schedule.created_by,
            devId,
            `Automated schedule execution: ${schedule.schedule_name}`,
            '127.0.0.1',
            { scheduleId: schedule.id, commandType: schedule.command_type },
            result.simulated
          );
        }

        await db('remote_schedule_executions')
          .where({ id: executionId })
          .update({ status: 'completed', completed_at: new Date() });
      }

    } catch (err) {
      logger.error(`[RemoteScheduler] Execution error: ${err.message}`);
    } finally {
      await this.releaseLock('power_scheduler_tick_lock', workerId);
    }
  }
}

module.exports = RemoteSchedulerService;
