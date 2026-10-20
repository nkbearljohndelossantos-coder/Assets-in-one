exports.up = async function(knex) {
  // 1. remote_sessions
  await knex.schema.createTable('remote_sessions', (table) => {
    table.increments('id').primary();
    table.string('session_code', 50).notNullable().unique();
    table.string('device_id', 100).notNullable().references('device_id').inTable('managed_devices').onDelete('CASCADE');
    table.integer('technician_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('access_mode', ['attended', 'unattended', 'view_only']).defaultTo('attended');
    table.string('connection_type', 50).defaultTo('Desktop Full Control');
    table.enum('status', ['active', 'ended', 'terminated']).defaultTo('active');
    table.timestamp('started_at').defaultTo(knex.fn.now());
    table.timestamp('ended_at').nullable();
    table.integer('duration_seconds').defaultTo(0);
    table.string('source_ip', 50).nullable();
    table.boolean('is_simulated').defaultTo(true);
    table.timestamps(true, true);
  });

  // 2. remote_session_events
  await knex.schema.createTable('remote_session_events', (table) => {
    table.increments('id').primary();
    table.integer('session_id').unsigned().notNullable().references('id').inTable('remote_sessions').onDelete('CASCADE');
    table.string('event_type', 50).notNullable();
    table.text('payload').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 3. remote_session_authorizations
  await knex.schema.createTable('remote_session_authorizations', (table) => {
    table.increments('id').primary();
    table.integer('session_id').unsigned().nullable().references('id').inTable('remote_sessions').onDelete('CASCADE');
    table.string('token_hash', 255).notNullable().unique();
    table.string('nonce', 64).notNullable();
    table.string('request_hash', 255).notNullable();
    table.timestamp('expires_at').notNullable();
    table.boolean('is_used').defaultTo(false);
    table.timestamps(true, true);
  });

  // 4. remote_session_permissions
  await knex.schema.createTable('remote_session_permissions', (table) => {
    table.increments('id').primary();
    table.integer('session_id').unsigned().notNullable().references('id').inTable('remote_sessions').onDelete('CASCADE');
    table.string('permission_code', 100).notNullable();
    table.boolean('is_granted').defaultTo(true);
  });

  // 5. remote_session_recordings
  await knex.schema.createTable('remote_session_recordings', (table) => {
    table.increments('id').primary();
    table.integer('session_id').unsigned().notNullable().references('id').inTable('remote_sessions').onDelete('CASCADE');
    table.string('file_path', 255).notNullable();
    table.integer('duration_seconds').defaultTo(0);
    table.bigInteger('file_size_bytes').defaultTo(0);
    table.timestamps(true, true);
  });

  // 6. remote_file_transfers
  await knex.schema.createTable('remote_file_transfers', (table) => {
    table.increments('id').primary();
    table.integer('session_id').unsigned().notNullable().references('id').inTable('remote_sessions').onDelete('CASCADE');
    table.enum('direction', ['upload', 'download']).notNullable();
    table.string('file_name', 255).notNullable();
    table.bigInteger('file_size_bytes').defaultTo(0);
    table.string('status', 50).defaultTo('completed');
    table.timestamps(true, true);
  });

  // 7. remote_terminal_sessions
  await knex.schema.createTable('remote_terminal_sessions', (table) => {
    table.increments('id').primary();
    table.integer('session_id').unsigned().notNullable().references('id').inTable('remote_sessions').onDelete('CASCADE');
    table.text('command_summary').nullable();
    table.timestamp('started_at').defaultTo(knex.fn.now());
    table.timestamp('ended_at').nullable();
  });

  // 8. technician_reauthentication_tokens (Action-bound, device-bound, 5-min single-use tokens)
  await knex.schema.createTable('technician_reauthentication_tokens', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('device_id', 100).notNullable();
    table.string('action_type', 100).notNullable();
    table.string('token_hash', 255).notNullable().unique();
    table.string('nonce', 64).notNullable();
    table.string('request_hash', 255).notNullable();
    table.timestamp('expires_at').notNullable();
    table.boolean('is_used').defaultTo(false);
    table.timestamps(true, true);
  });

  // 9. remote_action_audit_logs (Append-only hash-chained audit logs)
  await knex.schema.createTable('remote_action_audit_logs', (table) => {
    table.increments('id').primary();
    table.bigInteger('sequence_id').notNullable().unique();
    table.string('action_type', 100).notNullable();
    table.integer('technician_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('device_id', 100).nullable();
    table.text('access_reason').nullable();
    table.string('source_ip', 50).nullable();
    table.string('previous_hash', 128).notNullable();
    table.string('hash', 128).notNullable();
    table.text('metadata_json').nullable();
    table.boolean('is_simulated').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('remote_action_audit_logs');
  await knex.schema.dropTableIfExists('technician_reauthentication_tokens');
  await knex.schema.dropTableIfExists('remote_terminal_sessions');
  await knex.schema.dropTableIfExists('remote_file_transfers');
  await knex.schema.dropTableIfExists('remote_session_recordings');
  await knex.schema.dropTableIfExists('remote_session_permissions');
  await knex.schema.dropTableIfExists('remote_session_authorizations');
  await knex.schema.dropTableIfExists('remote_session_events');
  await knex.schema.dropTableIfExists('remote_sessions');
};
