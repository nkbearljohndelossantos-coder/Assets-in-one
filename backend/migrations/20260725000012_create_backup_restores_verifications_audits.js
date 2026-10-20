exports.up = async function(knex) {
  // 1. backup_restore_jobs
  await knex.schema.createTable('backup_restore_jobs', (table) => {
    table.increments('id').primary();
    table.string('restore_code', 64).notNullable().unique();
    table.integer('restore_point_id').unsigned().notNullable()
      .references('id').inTable('backup_restore_points').onDelete('RESTRICT');
    table.integer('target_device_id').unsigned().notNullable()
      .references('id').inTable('backup_devices').onDelete('CASCADE');
    table.integer('authorized_by_user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.string('restore_type', 30).notNullable().defaultTo('FileLevel'); // FileLevel
    table.text('target_directory').notNullable();
    table.string('conflict_option', 20).notNullable().defaultTo('Overwrite'); // Overwrite, Skip, Rename
    table.string('status', 30).notNullable().defaultTo('Authorized'); // Authorized, InProgress, Completed, Failed, Cancelled
    table.integer('files_restored').notNullable().defaultTo(0);
    table.bigInteger('bytes_restored').notNullable().defaultTo(0);
    table.text('error_message').nullable();
    table.datetime('started_at').nullable();
    table.datetime('finished_at').nullable();
    table.timestamps(true, true);
  });

  // 2. backup_verification_runs
  await knex.schema.createTable('backup_verification_runs', (table) => {
    table.increments('id').primary();
    table.integer('restore_point_id').unsigned().notNullable()
      .references('id').inTable('backup_restore_points').onDelete('CASCADE');
    table.string('verification_level', 30).notNullable().defaultTo('FullChecksum'); // Metadata, Manifest, FullChecksum
    table.string('status', 20).notNullable(); // Verified, Failed, Corrupted
    table.text('result_summary').nullable();
    table.datetime('run_at').notNullable().defaultTo(knex.fn.now());
  });

  // 3. backup_audit_events (Cryptographic Hash-Chain Audit Logging per Mandatory Correction #14)
  await knex.schema.createTable('backup_audit_events', (table) => {
    table.increments('id').primary();
    table.bigInteger('sequence_number').notNullable().unique();
    table.string('previous_hash', 64).notNullable();
    table.string('record_hash', 64).notNullable();
    table.string('actor_type', 30).notNullable(); // User, Agent, System
    table.string('actor_id', 100).notNullable();
    table.string('device_id', 100).nullable();
    table.string('action', 100).notNullable();
    table.string('result', 20).notNullable(); // Success, Failure, Denied
    table.string('correlation_id', 64).notNullable();
    table.datetime('event_timestamp').notNullable().defaultTo(knex.fn.now());
    table.text('metadata_json').nullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('backup_audit_events');
  await knex.schema.dropTableIfExists('backup_verification_runs');
  await knex.schema.dropTableIfExists('backup_restore_jobs');
};
