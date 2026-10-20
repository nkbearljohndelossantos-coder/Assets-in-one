exports.up = async function(knex) {
  // 1. backup_devices
  await knex.schema.createTable('backup_devices', (table) => {
    table.increments('id').primary();
    table.string('device_id', 100).notNullable().unique();
    table.string('device_name', 150).notNullable();
    table.string('hostname', 150).notNullable();
    table.string('ip_address', 50).nullable();
    table.string('mac_address', 50).nullable();
    table.string('os_version', 150).nullable();
    table.string('agent_version', 50).nullable();
    table.integer('cpu_count').nullable();
    table.bigInteger('total_ram_bytes').nullable();
    table.string('status', 30).notNullable().defaultTo('offline'); // online, offline, backing_up, restoring, error
    table.datetime('last_heartbeat_at').nullable();
    table.datetime('enrolled_at').notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);
  });

  // 2. backup_device_certificates
  await knex.schema.createTable('backup_device_certificates', (table) => {
    table.increments('id').primary();
    table.integer('device_id_ref').unsigned().notNullable()
      .references('id').inTable('backup_devices').onDelete('CASCADE');
    table.string('fingerprint', 128).notNullable().unique();
    table.text('public_key_pem').notNullable();
    table.string('status', 20).notNullable().defaultTo('active'); // active, revoked, expired
    table.datetime('issued_at').notNullable().defaultTo(knex.fn.now());
    table.datetime('expires_at').notNullable();
    table.datetime('revoked_at').nullable();
    table.timestamps(true, true);
  });

  // 3. backup_enrollment_tokens
  await knex.schema.createTable('backup_enrollment_tokens', (table) => {
    table.increments('id').primary();
    table.string('token', 100).notNullable().unique();
    table.integer('created_by_user_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.integer('max_uses').notNullable().defaultTo(1);
    table.integer('uses_count').notNullable().defaultTo(0);
    table.datetime('expires_at').notNullable();
    table.boolean('is_revoked').notNullable().defaultTo(false);
    table.timestamps(true, true);
  });

  // 4. backup_device_disks
  await knex.schema.createTable('backup_device_disks', (table) => {
    table.increments('id').primary();
    table.integer('device_id_ref').unsigned().notNullable()
      .references('id').inTable('backup_devices').onDelete('CASCADE');
    table.integer('disk_number').notNullable();
    table.string('model', 150).nullable();
    table.string('manufacturer', 150).nullable();
    table.string('serial_number', 150).nullable();
    table.string('bus_type', 50).nullable(); // NVMe, SSD, HDD, USB
    table.bigInteger('capacity_bytes').notNullable();
    table.string('partition_style', 20).nullable(); // GPT, MBR
    table.boolean('is_boot_disk').notNullable().defaultTo(false);
    table.boolean('is_system_disk').notNullable().defaultTo(false);
    table.string('smart_health', 30).nullable();
    table.timestamps(true, true);
  });

  // 5. backup_device_volumes
  await knex.schema.createTable('backup_device_volumes', (table) => {
    table.increments('id').primary();
    table.integer('disk_id_ref').unsigned().notNullable()
      .references('id').inTable('backup_device_disks').onDelete('CASCADE');
    table.string('drive_letter', 10).nullable();
    table.string('volume_label', 100).nullable();
    table.string('filesystem', 30).nullable(); // NTFS, FAT32, exFAT
    table.bigInteger('total_bytes').notNullable();
    table.bigInteger('free_bytes').notNullable();
    table.boolean('is_system_volume').notNullable().defaultTo(false);
    table.boolean('is_bitlocker_enabled').notNullable().defaultTo(false);
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('backup_device_volumes');
  await knex.schema.dropTableIfExists('backup_device_disks');
  await knex.schema.dropTableIfExists('backup_enrollment_tokens');
  await knex.schema.dropTableIfExists('backup_device_certificates');
  await knex.schema.dropTableIfExists('backup_devices');
};
