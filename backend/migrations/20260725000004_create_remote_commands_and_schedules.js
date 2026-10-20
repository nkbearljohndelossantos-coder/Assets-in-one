exports.up = async function(knex) {
  // 1. remote_commands
  await knex.schema.createTable('remote_commands', (table) => {
    table.increments('id').primary();
    table.string('command_code', 50).notNullable().unique();
    table.string('device_id', 100).notNullable().references('device_id').inTable('managed_devices').onDelete('CASCADE');
    table.integer('technician_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('command_type', ['shutdown', 'restart', 'lock', 'logoff', 'sleep', 'hibernate', 'kill_process', 'service_action']).notNullable();
    table.text('parameters_json').nullable();
    table.enum('status', ['pending', 'executing', 'completed', 'failed', 'cancelled']).defaultTo('pending');
    table.boolean('is_simulated').defaultTo(true);
    table.timestamp('executed_at').nullable();
    table.timestamps(true, true);
  });

  // 2. remote_command_results
  await knex.schema.createTable('remote_command_results', (table) => {
    table.increments('id').primary();
    table.integer('command_id').unsigned().notNullable().references('id').inTable('remote_commands').onDelete('CASCADE');
    table.integer('exit_code').defaultTo(0);
    table.text('stdout_truncated').nullable();
    table.text('stderr_truncated').nullable();
    table.timestamp('executed_at').defaultTo(knex.fn.now());
  });

  // 3. remote_schedules
  await knex.schema.createTable('remote_schedules', (table) => {
    table.increments('id').primary();
    table.string('schedule_name', 150).notNullable();
    table.enum('command_type', ['shutdown', 'restart', 'lock', 'logoff', 'sleep', 'hibernate']).defaultTo('shutdown');
    table.enum('schedule_type', ['one_time', 'daily', 'weekday', 'weekly', 'custom']).defaultTo('one_time');
    table.string('cron_expression', 100).nullable();
    table.timestamp('next_run_at').nullable();
    table.integer('warning_minutes').defaultTo(15);
    table.enum('target_type', ['all', 'department', 'location', 'group', 'single']).defaultTo('single');
    table.boolean('is_active').defaultTo(true);
    table.integer('created_by').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true);
  });

  // 4. remote_schedule_targets
  await knex.schema.createTable('remote_schedule_targets', (table) => {
    table.increments('id').primary();
    table.integer('schedule_id').unsigned().notNullable().references('id').inTable('remote_schedules').onDelete('CASCADE');
    table.string('target_id', 100).notNullable();
  });

  // 5. remote_schedule_executions
  await knex.schema.createTable('remote_schedule_executions', (table) => {
    table.increments('id').primary();
    table.integer('schedule_id').unsigned().notNullable().references('id').inTable('remote_schedules').onDelete('CASCADE');
    table.string('idempotency_key', 128).notNullable().unique();
    table.enum('status', ['running', 'completed', 'failed', 'cancelled']).defaultTo('running');
    table.timestamp('started_at').defaultTo(knex.fn.now());
    table.timestamp('completed_at').nullable();
  });

  // 6. remote_schedule_execution_targets
  await knex.schema.createTable('remote_schedule_execution_targets', (table) => {
    table.increments('id').primary();
    table.integer('execution_id').unsigned().notNullable().references('id').inTable('remote_schedule_executions').onDelete('CASCADE');
    table.string('device_id', 100).notNullable().references('device_id').inTable('managed_devices').onDelete('CASCADE');
    table.enum('status', ['pending', 'warning_sent', 'executed', 'skipped_protected', 'skipped_exclusion', 'failed']).defaultTo('pending');
    table.string('skip_reason', 255).nullable();
    table.timestamp('executed_at').nullable();
  });

  // 7. scheduler_locks (Distributed worker leases)
  await knex.schema.createTable('scheduler_locks', (table) => {
    table.string('lock_key', 100).primary();
    table.string('owner_id', 100).notNullable();
    table.timestamp('acquired_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('scheduler_locks');
  await knex.schema.dropTableIfExists('remote_schedule_execution_targets');
  await knex.schema.dropTableIfExists('remote_schedule_executions');
  await knex.schema.dropTableIfExists('remote_schedule_targets');
  await knex.schema.dropTableIfExists('remote_schedules');
  await knex.schema.dropTableIfExists('remote_command_results');
  await knex.schema.dropTableIfExists('remote_commands');
};
