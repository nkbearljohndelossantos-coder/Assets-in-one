exports.up = async function(knex) {
  // 1. backup_restore_points
  await knex.schema.createTable('backup_restore_points', (table) => {
    table.increments('id').primary();
    table.string('restore_point_code', 64).notNullable().unique();
    table.integer('execution_id').unsigned().notNullable()
      .references('id').inTable('backup_executions').onDelete('CASCADE');
    table.integer('device_id').unsigned().notNullable()
      .references('id').inTable('backup_devices').onDelete('CASCADE');
    table.integer('repository_id').unsigned().notNullable()
      .references('id').inTable('backup_repositories').onDelete('RESTRICT');
    table.string('backup_type', 20).notNullable(); // Full, Incremental
    table.integer('parent_restore_point_id').unsigned().nullable()
      .references('id').inTable('backup_restore_points').onDelete('SET NULL');
    table.bigInteger('total_size_bytes').notNullable();
    table.integer('file_count').notNullable().defaultTo(0);
    table.string('status', 30).notNullable().defaultTo('PendingVerification'); // Verified, PendingVerification, Failed, Expired, Quarantined
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    table.datetime('expires_at').nullable();
  });

  // 2. backup_manifests
  await knex.schema.createTable('backup_manifests', (table) => {
    table.increments('id').primary();
    table.integer('restore_point_id').unsigned().notNullable().unique()
      .references('id').inTable('backup_restore_points').onDelete('CASCADE');
    table.text('manifest_rel_path').notNullable();
    table.string('manifest_sha256', 64).notNullable();
    table.string('provider_name', 50).notNullable().defaultTo('FileBackupProvider');
    table.string('provider_version', 20).notNullable().defaultTo('1.0.0');
    table.string('compression_algo', 20).notNullable().defaultTo('Balanced');
    table.string('encryption_algo', 20).notNullable().defaultTo('AES-256-GCM');
    table.text('encrypted_dek_b64').notNullable(); // Wrapped Data Encryption Key
    table.string('dek_key_ref', 100).notNullable();
    table.boolean('has_completion_marker').notNullable().defaultTo(false);
    table.timestamps(true, true);
  });

  // 3. backup_chunks
  await knex.schema.createTable('backup_chunks', (table) => {
    table.increments('id').primary();
    table.integer('restore_point_id').unsigned().notNullable()
      .references('id').inTable('backup_restore_points').onDelete('CASCADE');
    table.integer('chunk_index').notNullable();
    table.string('chunk_sha256', 64).notNullable();
    table.bigInteger('original_size_bytes').notNullable();
    table.bigInteger('stored_size_bytes').notNullable();
    table.string('aes_gcm_nonce_b64', 32).notNullable();
    table.string('aes_gcm_tag_b64', 32).notNullable();
    table.text('storage_rel_path').notNullable();
    table.boolean('is_verified').notNullable().defaultTo(false);
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('backup_chunks');
  await knex.schema.dropTableIfExists('backup_manifests');
  await knex.schema.dropTableIfExists('backup_restore_points');
};
