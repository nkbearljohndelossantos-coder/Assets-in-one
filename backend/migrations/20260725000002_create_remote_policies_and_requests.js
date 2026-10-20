exports.up = async function(knex) {
  // 1. remote_access_policies
  await knex.schema.createTable('remote_access_policies', (table) => {
    table.increments('id').primary();
    table.string('device_id', 100).notNullable().references('device_id').inTable('managed_devices').onDelete('CASCADE');
    table.boolean('employee_approval_required').defaultTo(true);
    table.boolean('visible_notification_enabled').defaultTo(true);
    table.boolean('clipboard_allowed').defaultTo(true);
    table.boolean('file_transfer_allowed').defaultTo(true);
    table.boolean('screen_recording_enabled').defaultTo(false);
    table.integer('max_session_hours').defaultTo(4);
    table.string('allowed_hours_start', 10).defaultTo('08:00');
    table.string('allowed_hours_end', 10).defaultTo('18:00');
    table.timestamps(true, true);
  });

  // 2. remote_access_requests
  await knex.schema.createTable('remote_access_requests', (table) => {
    table.increments('id').primary();
    table.string('request_code', 50).notNullable().unique();
    table.string('device_id', 100).notNullable().references('device_id').inTable('managed_devices').onDelete('CASCADE');
    table.integer('technician_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('access_type', ['view_only', 'full_control']).defaultTo('full_control');
    table.enum('access_mode', ['attended', 'unattended']).defaultTo('attended');
    table.text('reason').notNullable();
    table.enum('status', ['pending', 'approved', 'denied', 'expired']).defaultTo('pending');
    table.string('nonce', 64).notNullable();
    table.string('endpoint_signature', 255).nullable();
    table.timestamp('expires_at').notNullable();
    table.timestamps(true, true);
  });

  // 3. protected_devices
  await knex.schema.createTable('protected_devices', (table) => {
    table.increments('id').primary();
    table.string('device_id', 100).notNullable().references('device_id').inTable('managed_devices').onDelete('CASCADE');
    table.string('protection_level', 50).defaultTo('High Infrastructure Protection');
    table.integer('designated_approver_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.text('remarks').nullable();
    table.timestamps(true, true);
  });

  // 4. device_exclusions
  await knex.schema.createTable('device_exclusions', (table) => {
    table.increments('id').primary();
    table.string('device_id', 100).notNullable().references('device_id').inTable('managed_devices').onDelete('CASCADE');
    table.string('exclusion_reason', 255).notNullable();
    table.integer('excluded_by').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('device_exclusions');
  await knex.schema.dropTableIfExists('protected_devices');
  await knex.schema.dropTableIfExists('remote_access_requests');
  await knex.schema.dropTableIfExists('remote_access_policies');
};
