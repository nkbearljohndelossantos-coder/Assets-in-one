exports.up = async function(knex) {
  // 1. backup_jobs
  await knex.schema.createTable('backup_jobs', (table) => {
    table.increments('id').primary();
    table.string('job_code', 50).notNullable().unique();
    table.string('name', 150).notNullable();
    table.integer('device_id').unsigned().notNullable()
      .references('id').inTable('backup_devices').onDelete('CASCADE');
    table.integer('policy_id').unsigned().nullable()
      .references('id').inTable('backup_policies').onDelete('SET NULL');
    table.integer('repository_id').unsigned().notNullable()
      .references('id').inTable('backup_repositories').onDelete('RESTRICT');
    table.string('job_type', 30).notNullable().defaultTo('FileBackup'); // FileBackup (Phase 1)
    table.string('backup_mode', 20).notNullable().defaultTo('Incremental'); // Full, Incremental
    table.string('status', 30).notNullable().defaultTo('Idle'); // Idle, Running, Paused, Disabled
    table.timestamps(true, true);
  });

  // 2. backup_job_sources (Folders & File paths included/excluded)
  await knex.schema.createTable('backup_job_sources', (table) => {
    table.increments('id').primary();
    table.integer('job_id').unsigned().notNullable()
      .references('id').inTable('backup_jobs').onDelete('CASCADE');
    table.text('source_path').notNullable();
    table.boolean('is_exclude').notNullable().defaultTo(false);
    table.timestamps(true, true);
  });

  // 3. backup_executions (Job Runs & Leasing)
  await knex.schema.createTable('backup_executions', (table) => {
    table.increments('id').primary();
    table.string('execution_code', 64).notNullable().unique();
    table.integer('job_id').unsigned().notNullable()
      .references('id').inTable('backup_jobs').onDelete('CASCADE');
    table.integer('device_id').unsigned().notNullable()
      .references('id').inTable('backup_devices').onDelete('CASCADE');
    table.string('lease_id', 64).notNullable().unique();
    table.datetime('lease_expires_at').notNullable();
    table.integer('attempt_number').notNullable().defaultTo(1);
    table.string('idempotency_key', 64).notNullable().unique();
    
    // Server-controlled state machine (Mandatory correction #16)
    table.string('state', 40).notNullable().defaultTo('queued'); 
    // queued, assigned, accepted, validating, scanning, reading, compressing, encrypting, writing, finalizing, verifying, completed, completed_with_warnings, retry_wait, cancelling, cancelled, interrupted, failed, quarantined

    table.integer('progress_percent').notNullable().defaultTo(0);
    table.decimal('transfer_speed_mbps', 10, 2).notNullable().defaultTo(0);
    table.bigInteger('bytes_scanned').notNullable().defaultTo(0);
    table.bigInteger('bytes_read').notNullable().defaultTo(0);
    table.bigInteger('bytes_transferred').notNullable().defaultTo(0);
    table.bigInteger('files_processed').notNullable().defaultTo(0);
    table.text('error_message').nullable();
    table.datetime('started_at').nullable();
    table.datetime('finished_at').nullable();
    table.timestamps(true, true);
  });

  // 4. backup_execution_phases
  await knex.schema.createTable('backup_execution_phases', (table) => {
    table.increments('id').primary();
    table.integer('execution_id').unsigned().notNullable()
      .references('id').inTable('backup_executions').onDelete('CASCADE');
    table.string('phase_name', 40).notNullable();
    table.string('status', 20).notNullable(); // InProgress, Completed, Failed
    table.datetime('started_at').notNullable().defaultTo(knex.fn.now());
    table.datetime('finished_at').nullable();
    table.text('phase_details').nullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('backup_execution_phases');
  await knex.schema.dropTableIfExists('backup_executions');
  await knex.schema.dropTableIfExists('backup_job_sources');
  await knex.schema.dropTableIfExists('backup_jobs');
};
