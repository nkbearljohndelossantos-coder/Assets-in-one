exports.up = async function(knex) {
  // 1. data_backups (Backup Monitoring and Verification)
  await knex.schema.createTable('data_backups', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('backup_location').notNullable();
    table.string('backup_type').notNullable(); // Full, Incremental
    table.string('status').notNullable().defaultTo('Success'); // Success, Failed, Pending
    table.decimal('backup_size_gb', 10, 2).notNullable().defaultTo(0);
    table.date('backup_date').notNullable();
    table.date('next_due_date').notNullable();
    table.string('verification_status').notNullable().defaultTo('Unverified'); // Verified, Unverified, Failed
    table.integer('verified_by_user_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.datetime('verified_at').nullable();
    table.string('checksum').nullable();
    table.text('restore_test_result').nullable();
    table.date('retention_until').nullable();
    table.text('failure_reason').nullable();
    table.integer('backup_file_count').notNullable().defaultTo(0);
    table.text('remarks').nullable();
    table.datetime('deleted_at').nullable();
    table.timestamps(true, true);
  });

  // 2. operating_systems (OS Tracking)
  await knex.schema.createTable('operating_systems', (table) => {
    table.increments('id').primary();
    table.integer('asset_id').unsigned().notNullable()
      .references('id').inTable('assets').onDelete('RESTRICT');
    table.string('edition').notNullable(); // Windows 11 Pro, etc.
    table.string('build_version').notNullable();
    table.string('license_type').notNullable(); // OEM, Retail, Volume
    table.string('activation_status').notNullable().defaultTo('Activated'); // Activated, Not Activated
    table.datetime('last_activation_check_at').nullable();
    table.text('activation_details').nullable();
    table.string('product_key_ciphertext').nullable();
    table.string('product_key_iv').nullable();
    table.string('product_key_tag').nullable();
    table.string('product_key_version').nullable();
    table.date('last_update_date').nullable();
    table.date('end_of_support_date').nullable();
    table.timestamps(true, true);
  });

  // 3. antivirus_tracking (Endpoint Antivirus Management)
  await knex.schema.createTable('antivirus_tracking', (table) => {
    table.increments('id').primary();
    table.integer('asset_id').unsigned().notNullable()
      .references('id').inTable('assets').onDelete('RESTRICT');
    table.string('antivirus_name').notNullable();
    table.string('version').notNullable();
    table.string('license_key_ciphertext').nullable();
    table.string('license_key_iv').nullable();
    table.string('license_key_tag').nullable();
    table.string('license_key_version').nullable();
    table.date('expiration_date').nullable();
    table.date('last_scan_date').nullable();
    table.string('scan_result').notNullable().defaultTo('Clean'); // Clean, Threat Found, Warning
    table.timestamps(true, true);
  });

  // 4. network_devices (Network Infrastructure Master)
  await knex.schema.createTable('network_devices', (table) => {
    table.increments('id').primary();
    table.string('device_name').notNullable();
    table.string('device_type').notNullable(); // Router, Switch, Firewall, AP, Server, etc.
    table.string('brand').notNullable();
    table.string('model').notNullable();
    table.string('status').notNullable().defaultTo('Online'); // Online, Offline, Maintenance
    table.text('remarks').nullable();
    table.datetime('deleted_at').nullable();
    table.timestamps(true, true);
  });

  // 5. printers (Printers Asset List)
  await knex.schema.createTable('printers', (table) => {
    table.increments('id').primary();
    table.string('printer_name').notNullable();
    table.string('brand').notNullable();
    table.string('model').notNullable();
    table.string('location').nullable();
    table.integer('department_id').unsigned().nullable()
      .references('id').inTable('departments').onDelete('SET NULL');
    table.string('toner_model').nullable();
    table.integer('ink_level').notNullable().defaultTo(100); // 0-100 manual percentage
    table.string('status').notNullable().defaultTo('Online'); // Online, Offline, Maintenance Required
    table.text('remarks').nullable();
    table.datetime('deleted_at').nullable();
    table.timestamps(true, true);
  });

  // 6. printer_user_assignments (Normalized Printer Access)
  await knex.schema.createTable('printer_user_assignments', (table) => {
    table.increments('id').primary();
    table.integer('printer_id').unsigned().notNullable()
      .references('id').inTable('printers').onDelete('RESTRICT');
    table.integer('employee_id').unsigned().notNullable()
      .references('id').inTable('employees').onDelete('RESTRICT');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.unique(['printer_id', 'employee_id']);
  });

  // 7. printer_maintenance_logs (Printer Repairs history)
  await knex.schema.createTable('printer_maintenance_logs', (table) => {
    table.increments('id').primary();
    table.integer('printer_id').unsigned().notNullable()
      .references('id').inTable('printers').onDelete('RESTRICT');
    table.integer('technician_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.string('action_type').notNullable(); // Repair, Cleaning, Toner, Other
    table.date('action_date').notNullable();
    table.text('parts_replaced').nullable();
    table.decimal('cost', 10, 2).notNullable().defaultTo(0);
    table.text('findings').notNullable();
    table.text('action_performed').notNullable();
    table.date('next_maintenance_date').nullable();
    table.string('attachments_path').nullable();
    table.timestamps(true, true);
  });

  // 8. file_shares (Company Network Directories)
  await knex.schema.createTable('file_shares', (table) => {
    table.increments('id').primary();
    table.string('folder_name').notNullable();
    table.string('server_location').notNullable();
    table.integer('owner_employee_id').unsigned().nullable()
      .references('id').inTable('employees').onDelete('SET NULL');
    table.text('purpose').nullable();
    table.datetime('deleted_at').nullable();
    table.timestamps(true, true);
  });

  // 9. file_share_permissions (Normalized Folders Security)
  await knex.schema.createTable('file_share_permissions', (table) => {
    table.increments('id').primary();
    table.integer('file_share_id').unsigned().notNullable()
      .references('id').inTable('file_shares').onDelete('RESTRICT');
    table.integer('employee_id').unsigned().nullable()
      .references('id').inTable('employees').onDelete('RESTRICT');
    table.integer('department_id').unsigned().nullable()
      .references('id').inTable('departments').onDelete('RESTRICT');
    table.string('access_level').notNullable().defaultTo('Read/Write'); // Read-Only, Read/Write, Full Control
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 10. wifi_networks (Wifi Infrastructure APs)
  await knex.schema.createTable('wifi_networks', (table) => {
    table.increments('id').primary();
    table.string('access_point_name').notNullable();
    table.string('building').nullable();
    table.string('floor').nullable();
    table.string('ssid').notNullable();
    table.string('coverage_area').nullable();
    table.string('channel').nullable();
    table.string('status').notNullable().defaultTo('Active'); // Active, Inactive
    table.datetime('deleted_at').nullable();
    table.timestamps(true, true);
  });

  // 11. guest_wifi_accounts (Encrypted Guest Wi-Fi Account Tracking)
  await knex.schema.createTable('guest_wifi_accounts', (table) => {
    table.increments('id').primary();
    table.string('guest_name').notNullable();
    table.string('wifi_username').notNullable().unique();
    table.string('wifi_password_ciphertext').notNullable();
    table.string('wifi_password_iv').notNullable();
    table.string('wifi_password_tag').notNullable();
    table.string('wifi_password_version').notNullable();
    table.datetime('start_date').notNullable();
    table.datetime('expiration_date').notNullable();
    table.text('purpose').nullable();
    table.integer('requested_by_employee_id').unsigned().nullable()
      .references('id').inTable('employees').onDelete('SET NULL');
    table.string('status').notNullable().defaultTo('Active'); // Active, Expired, Disabled
    table.datetime('deleted_at').nullable();
    table.timestamps(true, true);
  });

  // 12. website_monitoring (Domain Availability, HTTP, SSL Checks)
  await knex.schema.createTable('website_monitoring', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('domain').notNullable().unique();
    table.string('hosting_provider').nullable();
    table.date('domain_expiration_date').nullable();
    table.date('ssl_expiration_date').nullable();
    table.text('dns_info').nullable();
    table.date('last_content_update').nullable();
    table.integer('admin_employee_id').unsigned().nullable()
      .references('id').inTable('employees').onDelete('SET NULL');
    table.string('status').notNullable().defaultTo('Active'); // Active, Down, Maintenance
    table.datetime('last_checked_at').nullable();
    table.integer('response_time_ms').nullable();
    table.integer('http_status_code').nullable();
    table.boolean('ssl_valid').nullable();
    table.integer('consecutive_failures').notNullable().defaultTo(0);
    table.datetime('last_success_at').nullable();
    table.datetime('last_failure_at').nullable();
    table.datetime('deleted_at').nullable();
    table.timestamps(true, true);
  });

  // 13. website_uptime_logs (HTTP Check Logs History - Restrict Deletes)
  await knex.schema.createTable('website_uptime_logs', (table) => {
    table.increments('id').primary();
    table.integer('website_id').unsigned().notNullable()
      .references('id').inTable('website_monitoring').onDelete('RESTRICT');
    table.datetime('checked_at').notNullable();
    table.integer('response_time_ms').notNullable();
    table.integer('http_status_code').nullable();
    table.boolean('ssl_valid').notNullable();
    table.string('status').notNullable(); // Up, Down
    table.text('error_message').nullable();
  });

  // 14. ip_allocations (Centralized Global IP & MAC Address Registry)
  await knex.schema.createTable('ip_allocations', (table) => {
    table.increments('id').primary();
    table.string('ip_address').notNullable();
    table.string('mac_address').nullable();
    table.string('vlan').nullable();
    table.string('subnet').nullable();
    table.string('gateway').nullable();
    
    // Explicit foreign key mappings for network endpoints
    table.integer('network_device_id').unsigned().nullable()
      .references('id').inTable('network_devices').onDelete('RESTRICT');
    table.integer('printer_id').unsigned().nullable()
      .references('id').inTable('printers').onDelete('RESTRICT');
    table.integer('wifi_network_id').unsigned().nullable()
      .references('id').inTable('wifi_networks').onDelete('RESTRICT');
    table.integer('asset_id').unsigned().nullable()
      .references('id').inTable('assets').onDelete('RESTRICT');
    table.integer('employee_id').unsigned().nullable()
      .references('id').inTable('employees').onDelete('RESTRICT');

    table.string('assignment_type').notNullable(); // Network Device, Printer, WiFi AP, User Assignment
    table.string('status').notNullable().defaultTo('Active'); // Active, Released
    table.datetime('deleted_at').nullable();
    table.timestamps(true, true);

    // MySQL and SQLite Virtual Generated Columns for unique constraints (ignoring duplicates when deleted_at is not null)
    table.specificType('active_ip_key', "varchar(45) GENERATED ALWAYS AS (CASE WHEN status = 'Active' AND deleted_at IS NULL THEN ip_address ELSE NULL END) VIRTUAL");
    table.specificType('active_mac_key', "varchar(45) GENERATED ALWAYS AS (CASE WHEN status = 'Active' AND deleted_at IS NULL THEN mac_address ELSE NULL END) VIRTUAL");
  });

  // Unique constraint mappings to virtual generated keys
  await knex.schema.alterTable('ip_allocations', (table) => {
    table.unique('active_ip_key', 'uniq_active_ip_key');
    table.unique('active_mac_key', 'uniq_active_mac_key');
  });

  // 15. network_history_logs (Manual Network Assignment Logs)
  await knex.schema.createTable('network_history_logs', (table) => {
    table.increments('id').primary();
    table.integer('employee_id').unsigned().nullable()
      .references('id').inTable('employees').onDelete('SET NULL');
    table.integer('asset_id').unsigned().nullable()
      .references('id').inTable('assets').onDelete('SET NULL');
    table.string('ip_address').notNullable();
    table.string('mac_address').notNullable();
    table.string('switch_port').nullable();
    table.string('action').notNullable(); // Assign, Release
    table.integer('performed_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 16. scheduler_jobs (Locking Table for Background Cron Runner)
  await knex.schema.createTable('scheduler_jobs', (table) => {
    table.string('name', 100).primary();
    table.datetime('last_run_at').nullable();
    table.datetime('next_run_at').nullable();
    table.boolean('is_locked').notNullable().defaultTo(false);
    table.string('locked_by', 150).nullable();
    table.string('lock_token', 100).nullable();
    table.datetime('locked_until').nullable();
    table.integer('attempt_count').notNullable().defaultTo(0);
    table.text('last_error').nullable();
    table.datetime('last_success_at').nullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('scheduler_jobs');
  await knex.schema.dropTableIfExists('network_history_logs');
  await knex.schema.dropTableIfExists('ip_allocations');
  await knex.schema.dropTableIfExists('website_uptime_logs');
  await knex.schema.dropTableIfExists('website_monitoring');
  await knex.schema.dropTableIfExists('guest_wifi_accounts');
  await knex.schema.dropTableIfExists('wifi_networks');
  await knex.schema.dropTableIfExists('file_share_permissions');
  await knex.schema.dropTableIfExists('file_shares');
  await knex.schema.dropTableIfExists('printer_maintenance_logs');
  await knex.schema.dropTableIfExists('printer_user_assignments');
  await knex.schema.dropTableIfExists('printers');
  await knex.schema.dropTableIfExists('network_devices');
  await knex.schema.dropTableIfExists('antivirus_tracking');
  await knex.schema.dropTableIfExists('operating_systems');
  await knex.schema.dropTableIfExists('data_backups');
};
