exports.up = async function(knex) {
  // 1. backup_repositories
  await knex.schema.createTable('backup_repositories', (table) => {
    table.increments('id').primary();
    table.string('name', 150).notNullable().unique();
    table.string('type', 30).notNullable(); // LocalFolder, ExternalDisk, SMB
    table.text('target_path').notNullable();
    table.bigInteger('quota_bytes').nullable();
    table.bigInteger('free_space_bytes').nullable();
    table.string('status', 30).notNullable().defaultTo('Healthy'); // Healthy, Unreachable, Warning, Full
    table.boolean('is_encrypted_at_rest').notNullable().defaultTo(true);
    table.integer('concurrent_job_limit').notNullable().defaultTo(3);
    table.integer('bandwidth_limit_mbps').nullable();
    table.datetime('last_connectivity_check').nullable();
    table.datetime('last_verification_date').nullable();
    table.timestamps(true, true);
  });

  // 2. backup_repository_credentials (SMB Credentials encrypted server-side)
  await knex.schema.createTable('backup_repository_credentials', (table) => {
    table.increments('id').primary();
    table.integer('repository_id').unsigned().notNullable().unique()
      .references('id').inTable('backup_repositories').onDelete('CASCADE');
    table.string('domain', 150).nullable();
    table.string('username', 150).notNullable();
    table.text('password_ciphertext').notNullable(); // AES-256-GCM encrypted
    table.text('password_iv').notNullable();
    table.text('password_tag').notNullable();
    table.timestamps(true, true);
  });

  // 3. backup_policies
  await knex.schema.createTable('backup_policies', (table) => {
    table.increments('id').primary();
    table.string('name', 150).notNullable().unique();
    table.text('description').nullable();
    table.integer('repository_id').unsigned().notNullable()
      .references('id').inTable('backup_repositories').onDelete('RESTRICT');
    table.string('compression_mode', 20).notNullable().defaultTo('Balanced'); // None, Fast, Balanced, Maximum
    table.string('encryption_algo', 20).notNullable().defaultTo('AES-256-GCM');
    table.integer('retention_keep_count').notNullable().defaultTo(7);
    table.integer('retention_days').notNullable().defaultTo(30);
    table.boolean('strict_hash_mode').notNullable().defaultTo(false);
    table.timestamps(true, true);
  });

  // 4. backup_schedules (Created EXACTLY ONCE here per mandatory correction #2)
  await knex.schema.createTable('backup_schedules', (table) => {
    table.increments('id').primary();
    table.integer('policy_id').unsigned().nullable()
      .references('id').inTable('backup_policies').onDelete('SET NULL');
    table.string('schedule_type', 30).notNullable(); // Daily, Weekly, Monthly, Manual
    table.string('cron_expression', 100).nullable();
    table.string('time_of_day', 10).nullable(); // e.g. "23:00"
    table.boolean('is_active').notNullable().defaultTo(true);
    table.datetime('last_run_at').nullable();
    table.datetime('next_run_at').nullable();
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('backup_schedules');
  await knex.schema.dropTableIfExists('backup_policies');
  await knex.schema.dropTableIfExists('backup_repository_credentials');
  await knex.schema.dropTableIfExists('backup_repositories');
};
