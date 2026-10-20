/**
 * MDM enrolled Android devices & enrollment tokens (persistent storage)
 */
exports.up = async function (knex) {
  await knex.schema.createTable('mdm_enrollment_tokens', (table) => {
    table.increments('id').primary();
    table.string('enrollment_id', 64).notNullable().unique();
    table.string('token_hash', 255).notNullable();
    table.integer('employee_id').unsigned().nullable().references('id').inTable('employees').onDelete('SET NULL');
    table.string('employee_name', 150).nullable();
    table.string('department', 100).nullable();
    table.integer('policy_id').unsigned().nullable().references('id').inTable('webfilter_policies').onDelete('SET NULL');
    table.enum('status', ['pending', 'used', 'expired', 'revoked']).defaultTo('pending');
    table.datetime('expires_at').notNullable();
    table.timestamp('used_at').nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('mdm_enrolled_devices', (table) => {
    table.increments('id').primary();
    table.string('device_id', 128).notNullable().unique();
    table.string('device_name', 200).notNullable();
    table.string('manufacturer', 100).nullable();
    table.string('model', 100).nullable();
    table.string('android_version', 50).nullable();
    table.string('serial_number', 128).nullable();
    table.integer('asset_id').unsigned().nullable().references('id').inTable('assets').onDelete('SET NULL');
    table.integer('employee_id').unsigned().nullable().references('id').inTable('employees').onDelete('SET NULL');
    table.string('employee_name', 150).nullable();
    table.integer('policy_id').unsigned().nullable().references('id').inTable('webfilter_policies').onDelete('SET NULL');
    table.string('api_key_hash', 255).notNullable();
    table.string('enrollment_id', 64).nullable();
    table.boolean('work_mode_enabled').defaultTo(true);
    table.boolean('is_online').defaultTo(false);
    table.boolean('is_compliant').defaultTo(true);
    table.enum('status', ['enrolled', 'pending', 'revoked']).defaultTo('enrolled');
    table.timestamp('last_seen').nullable();
    table.timestamp('enrolled_at').defaultTo(knex.fn.now());
    table.timestamps(true, true);
  });

  await knex.schema.createTable('mdm_device_commands', (table) => {
    table.increments('id').primary();
    table.string('command_uuid', 64).notNullable().unique();
    table.string('device_id', 128).nullable();
    table.string('command', 50).notNullable();
    table.text('parameters').nullable();
    table.enum('status', ['pending', 'delivered', 'acknowledged', 'failed']).defaultTo('pending');
    table.string('issued_by', 100).nullable();
    table.timestamp('delivered_at').nullable();
    table.timestamp('acknowledged_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('mdm_device_commands');
  await knex.schema.dropTableIfExists('mdm_enrolled_devices');
  await knex.schema.dropTableIfExists('mdm_enrollment_tokens');
};
