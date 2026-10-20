const cron = require('node-cron');
const db = require('../config/db');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Example worker definitions
const WORKERS = {
  'daily_backup_check': async () => {
    logger.info('Executing daily_backup_check...');
    // Implementation for verifying backup completion statuses could go here
    return true;
  },
  'website_uptime_ping': async () => {
    logger.info('Executing website_uptime_ping...');
    // Implementation for pinging websites could go here
    return true;
  }
};

class SchedulerService {
  constructor() {
    this.hostname = process.env.HOSTNAME || 'itms-worker-1';
  }

  start() {
    logger.info('Initializing Scheduler Service...');
    // Run the job checker every minute
    cron.schedule('* * * * *', () => {
      this.checkAndRunJobs();
    });
  }

  async checkAndRunJobs() {
    try {
      // Find jobs that are active and either haven't run, or next_run_at is past
      const pendingJobs = await db('scheduler_jobs')
        .where('is_active', true)
        .where(builder => {
          builder.whereNull('next_run_at').orWhere('next_run_at', '<=', new Date());
        })
        .where(builder => {
          builder.whereNull('locked_until').orWhere('locked_until', '<', new Date()); // Also pick up stale locks
        })
        .select('id', 'job_name', 'cron_expression');

      for (const job of pendingJobs) {
        await this.tryAcquireAndRun(job);
      }
    } catch (error) {
      logger.error(`Scheduler Check Error: ${error.message}`);
    }
  }

  async tryAcquireAndRun(job) {
    const lockToken = uuidv4();
    const lockDurationMs = 5 * 60 * 1000; // 5 minute lock
    const lockedUntil = new Date(Date.now() + lockDurationMs);

    let acquired = false;
    let trx;

    try {
      trx = await db.transaction();

      // Attempt atomic lock
      const updated = await trx('scheduler_jobs')
        .where('id', job.id)
        .where(builder => {
          builder.whereNull('locked_until').orWhere('locked_until', '<', new Date());
        })
        .update({
          locked_by: this.hostname,
          lock_token: lockToken,
          locked_until: lockedUntil,
          updated_at: new Date()
        });

      if (updated > 0) {
        acquired = true;
      }
      
      await trx.commit();
    } catch (error) {
      if (trx) await trx.rollback();
      logger.error(`Locking Error for job ${job.job_name}: ${error.message}`);
      return;
    }

    if (!acquired) return; // Another worker got it

    logger.info(`Acquired lock for job: ${job.job_name}`);

    let status = 'Success';
    let output = null;

    try {
      if (WORKERS[job.job_name]) {
        await WORKERS[job.job_name]();
        output = 'Completed successfully.';
      } else {
        throw new Error(`Worker function for ${job.job_name} not found.`);
      }
    } catch (error) {
      status = 'Failed';
      output = error.message;
      logger.error(`Execution Error for job ${job.job_name}: ${error.message}`);
    }

    // Calculate next run if cron is set (for now, simply bump by an hour if no cron parsing, or null if one-shot)
    // You could use cron-parser here to calculate exactly. We'll set a naive next run for demonstration.
    const nextRun = new Date(Date.now() + 60 * 60 * 1000); 

    // Release lock and update status
    try {
      await db('scheduler_jobs')
        .where({ id: job.id, lock_token: lockToken })
        .update({
          last_run_at: new Date(),
          next_run_at: nextRun,
          status: status,
          last_run_output: output,
          locked_by: null,
          lock_token: null,
          locked_until: null,
          updated_at: new Date()
        });
      logger.info(`Released lock for job: ${job.job_name}`);
    } catch (error) {
      logger.error(`Unlock Error for job ${job.job_name}: ${error.message}`);
    }
  }
}

module.exports = new SchedulerService();
