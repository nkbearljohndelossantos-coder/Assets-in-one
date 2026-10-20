exports.up = async function(knex) {
  // 1. managed_devices
  await knex.schema.createTable('managed_devices', (table) => {
    table.increments('id').primary();
    table.string('device_id', 100).notNullable().unique();
    table.string('name', 150).notNullable();
    table.integer('asset_id').unsigned().nullable().references('id').inTable('assets').onDelete('SET NULL');
    table.integer('employee_id').unsigned().nullable().references('id').inTable('employees').onDelete('SET NULL');
    table.integer('department_id').unsigned().nullable().references('id').inTable('departments').onDelete('SET NULL');
    table.string('location', 255).nullable();
    table.string('ip_address', 50).nullable();
    table.string('mac_address', 50).nullable();
    table.string('os_name', 100).defaultTo('Windows 11 Pro');
    table.string('os_version', 50).defaultTo('23H2');
    table.string('logged_in_user', 100).nullable();
    table.string('agent_version', 50).defaultTo('v1.2.4');
    table.timestamp('last_heartbeat').nullable();
    table.boolean('is_online').defaultTo(false);
    table.boolean('remote_access_enabled').defaultTo(true);
    table.boolean('protected_status').defaultTo(false);
    table.enum('approved_access_mode', ['attended', 'unattended', 'view_only']).defaultTo('attended');
    table.integer('last_technician_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('last_remote_session_at').nullable();
    table.string('pending_power_command', 50).nullable();
    table.boolean('is_simulated').defaultTo(true);
    table.timestamps(true, true);
  });

  // 2. device_agents
  await knex.schema.createTable('device_agents', (table) => {
    table.increments('id').primary();
    table.string('agent_id', 100).notNullable().unique();
    table.string('device_id', 100).notNullable().references('device_id').inTable('managed_devices').onDelete('CASCADE');
    table.string('enrollment_token_hash', 255).notNullable();
    table.string('agent_key_hash', 255).notNullable();
    table.enum('status', ['active', 'revoked', 'pending_upgrade']).defaultTo('active');
    table.string('version', 50).defaultTo('1.2.4');
    table.timestamp('installed_at').defaultTo(knex.fn.now());
    table.timestamp('last_checkin').nullable();
    table.string('ad_gpo_policy_id', 100).nullable();
    table.timestamps(true, true);
  });

  // 3. device_capabilities
  await knex.schema.createTable('device_capabilities', (table) => {
    table.increments('id').primary();
    table.string('device_id', 100).notNullable().references('device_id').inTable('managed_devices').onDelete('CASCADE');
    table.boolean('desktop').defaultTo(true);
    table.boolean('terminal').defaultTo(true);
    table.boolean('file_transfer').defaultTo(true);
    table.boolean('power').defaultTo(true);
    table.boolean('process_manage').defaultTo(true);
    table.boolean('service_manage').defaultTo(true);
    table.timestamps(true, true);
  });

  // 4. device_heartbeats (Connectivity heartbeats - lightweight state tracking)
  await knex.schema.createTable('device_heartbeats', (table) => {
    table.increments('id').primary();
    table.string('device_id', 100).notNullable().references('device_id').inTable('managed_devices').onDelete('CASCADE');
    table.boolean('is_online').defaultTo(true);
    table.string('ip_address', 50).nullable();
    table.string('logged_in_user', 100).nullable();
    table.timestamp('logged_at').defaultTo(knex.fn.now());
  });

  // 5. remote_telemetry_samples (Historical sampled metrics - subject to retention/purge)
  await knex.schema.createTable('remote_telemetry_samples', (table) => {
    table.increments('id').primary();
    table.string('device_id', 100).notNullable().references('device_id').inTable('managed_devices').onDelete('CASCADE');
    table.decimal('cpu_usage_pct', 5, 2).defaultTo(0);
    table.decimal('ram_usage_pct', 5, 2).defaultTo(0);
    table.decimal('disk_usage_pct', 5, 2).defaultTo(0);
    table.timestamp('sampled_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('remote_telemetry_samples');
  await knex.schema.dropTableIfExists('device_heartbeats');
  await knex.schema.dropTableIfExists('device_capabilities');
  await knex.schema.dropTableIfExists('device_agents');
  await knex.schema.dropTableIfExists('managed_devices');
};
