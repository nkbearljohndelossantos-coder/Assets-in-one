/**
 * Knex Migration: Create Enterprise Work Mode MDM Security & Web Filtering Tables
 */
exports.up = async function(knex) {
  // 1. Web Filtering Categories
  await knex.schema.createTable('webfilter_categories', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable().unique();
    table.string('code', 50).notNullable().unique();
    table.text('description').nullable();
    table.boolean('is_blocked_by_default').defaultTo(false);
    table.boolean('is_custom').defaultTo(false);
    table.timestamps(true, true);
  });

  // 2. Web Filter Policies
  await knex.schema.createTable('webfilter_policies', (table) => {
    table.increments('id').primary();
    table.string('name', 150).notNullable();
    table.text('description').nullable();
    table.boolean('is_work_mode_enabled').defaultTo(false);
    table.boolean('block_gambling').defaultTo(true);
    table.boolean('block_adult').defaultTo(false);
    table.boolean('block_torrent').defaultTo(false);
    table.boolean('block_social_media').defaultTo(false);
    table.boolean('block_streaming').defaultTo(false);
    table.boolean('block_messaging').defaultTo(false);
    table.boolean('block_ai_chat').defaultTo(false);
    table.boolean('hide_camera').defaultTo(false);
    table.boolean('hide_browsers').defaultTo(false);
    table.boolean('disable_screenshots').defaultTo(false);
    table.boolean('disable_usb_transfer').defaultTo(false);
    table.boolean('disable_developer_options').defaultTo(true);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // 3. Domain Blacklist
  await knex.schema.createTable('webfilter_blacklist', (table) => {
    table.increments('id').primary();
    table.string('domain', 255).notNullable();
    table.string('pattern', 255).notNullable(); // e.g. *.bet, *.casino, bet88.com
    table.integer('category_id').unsigned().nullable().references('id').inTable('webfilter_categories').onDelete('SET NULL');
    table.string('match_type', 50).defaultTo('wildcard'); // wildcard, exact, subdomain
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // 4. Domain Whitelist
  await knex.schema.createTable('webfilter_whitelist', (table) => {
    table.increments('id').primary();
    table.string('domain', 255).notNullable();
    table.string('pattern', 255).notNullable();
    table.text('description').nullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // 5. Device Groups
  await knex.schema.createTable('webfilter_device_groups', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable().unique();
    table.string('code', 50).notNullable().unique();
    table.text('description').nullable();
    table.integer('policy_id').unsigned().nullable().references('id').inTable('webfilter_policies').onDelete('SET NULL');
    table.timestamps(true, true);
  });

  // 6. Policy Templates (by Department / Role)
  await knex.schema.createTable('webfilter_policy_templates', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable().unique();
    table.integer('department_id').unsigned().nullable().references('id').inTable('departments').onDelete('SET NULL');
    table.integer('policy_id').unsigned().nullable().references('id').inTable('webfilter_policies').onDelete('SET NULL');
    table.timestamps(true, true);
  });

  // 7. App Inventory Catalog
  await knex.schema.createTable('webfilter_app_inventory', (table) => {
    table.increments('id').primary();
    table.integer('asset_id').unsigned().notNullable().references('id').inTable('assets').onDelete('CASCADE');
    table.string('package_name', 255).notNullable();
    table.string('app_name', 255).notNullable();
    table.string('version_name', 100).nullable();
    table.integer('version_code').nullable();
    table.string('category', 100).nullable().defaultTo('General');
    table.bigInteger('size_bytes').defaultTo(0);
    table.timestamp('installed_at').nullable();
    table.string('status', 50).defaultTo('allowed'); // allowed, blocked, hidden
    table.timestamps(true, true);
  });

  // 8. App Blacklist (Package Name Blocker)
  await knex.schema.createTable('webfilter_app_blacklist', (table) => {
    table.increments('id').primary();
    table.string('package_name', 255).notNullable().unique();
    table.string('app_name', 255).notNullable();
    table.string('category', 100).defaultTo('Gambling');
    table.boolean('is_hidden').defaultTo(true);
    table.boolean('is_disabled').defaultTo(true);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // 9. Work Mode Schedules
  await knex.schema.createTable('webfilter_schedules', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.integer('policy_id').unsigned().nullable().references('id').inTable('webfilter_policies').onDelete('CASCADE');
    table.integer('department_id').unsigned().nullable().references('id').inTable('departments').onDelete('CASCADE');
    table.string('start_time', 10).notNullable(); // HH:mm
    table.string('end_time', 10).notNullable(); // HH:mm
    table.string('days_of_week', 100).defaultTo('Mon,Tue,Wed,Thu,Fri');
    table.boolean('skip_holidays').defaultTo(true);
    table.boolean('skip_weekends').defaultTo(true);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // 10. WiFi & GPS Geofences
  await knex.schema.createTable('webfilter_geofences', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.string('wifi_ssid', 100).nullable();
    table.decimal('latitude', 10, 8).nullable();
    table.decimal('longitude', 11, 8).nullable();
    table.integer('radius_meters').defaultTo(100);
    table.boolean('auto_enable_work_mode').defaultTo(true);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // 11. Single-Use Signed QR Tokens
  await knex.schema.createTable('webfilter_qr_tokens', (table) => {
    table.increments('id').primary();
    table.string('token_uuid', 100).notNullable().unique();
    table.string('action_type', 50).notNullable(); // ENABLE_WORK_MODE, DISABLE_WORK_MODE
    table.integer('asset_id').unsigned().nullable().references('id').inTable('assets').onDelete('CASCADE');
    table.integer('employee_id').unsigned().nullable().references('id').inTable('employees').onDelete('CASCADE');
    table.string('nonce', 64).notNullable();
    table.string('signature', 255).notNullable(); // HMAC-SHA256
    table.datetime('expires_at').notNullable();
    table.boolean('is_used').defaultTo(false);
    table.timestamp('used_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 12. Device Telemetry & Health Monitoring
  await knex.schema.createTable('webfilter_telemetry', (table) => {
    table.increments('id').primary();
    table.integer('asset_id').unsigned().notNullable().references('id').inTable('assets').onDelete('CASCADE');
    table.integer('battery_level').defaultTo(100);
    table.boolean('is_charging').defaultTo(false);
    table.string('network_type', 50).nullable(); // WiFi, Cellular, None
    table.string('wifi_ssid', 100).nullable();
    table.string('ip_address', 50).nullable();
    table.bigInteger('storage_used_bytes').defaultTo(0);
    table.bigInteger('storage_total_bytes').defaultTo(0);
    table.bigInteger('ram_used_bytes').defaultTo(0);
    table.bigInteger('ram_total_bytes').defaultTo(0);
    table.decimal('cpu_usage_percent', 5, 2).defaultTo(0);
    table.string('android_version', 50).nullable();
    table.string('security_patch_level', 50).nullable();
    table.boolean('is_work_mode_active').defaultTo(false);
    table.boolean('is_compliant').defaultTo(true);
    table.timestamp('last_heartbeat').defaultTo(knex.fn.now());
  });

  // 13. Anti-Tamper & Security Incidents
  await knex.schema.createTable('webfilter_security_incidents', (table) => {
    table.increments('id').primary();
    table.integer('asset_id').unsigned().notNullable().references('id').inTable('assets').onDelete('CASCADE');
    table.string('threat_type', 100).notNullable(); // ROOT, USB_DEBUGGING, FAKE_GPS, VPN_BYPASS, APP_CLONE
    table.string('severity', 20).defaultTo('HIGH'); // CRITICAL, HIGH, MEDIUM, LOW
    table.text('details').nullable();
    table.string('action_taken', 100).defaultTo('INCIDENT_LOGGED');
    table.boolean('is_resolved').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 14. Blocked Attempt Audit Logs
  await knex.schema.createTable('webfilter_audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('asset_id').unsigned().nullable().references('id').inTable('assets').onDelete('CASCADE');
    table.integer('employee_id').unsigned().nullable().references('id').inTable('employees').onDelete('SET NULL');
    table.string('target_type', 20).notNullable(); // WEBSITE, APPLICATION
    table.string('blocked_target', 255).notNullable(); // e.g. bet88.com, com.ph.sabong
    table.string('browser_or_app', 100).nullable(); // e.g. Chrome, Edge, WebView
    table.string('category_name', 100).defaultTo('Gambling');
    table.string('policy_name', 100).defaultTo('Work Mode Security');
    table.string('action_taken', 50).defaultTo('BLOCKED');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('webfilter_audit_logs');
  await knex.schema.dropTableIfExists('webfilter_security_incidents');
  await knex.schema.dropTableIfExists('webfilter_telemetry');
  await knex.schema.dropTableIfExists('webfilter_qr_tokens');
  await knex.schema.dropTableIfExists('webfilter_geofences');
  await knex.schema.dropTableIfExists('webfilter_schedules');
  await knex.schema.dropTableIfExists('webfilter_app_blacklist');
  await knex.schema.dropTableIfExists('webfilter_app_inventory');
  await knex.schema.dropTableIfExists('webfilter_policy_templates');
  await knex.schema.dropTableIfExists('webfilter_device_groups');
  await knex.schema.dropTableIfExists('webfilter_whitelist');
  await knex.schema.dropTableIfExists('webfilter_blacklist');
  await knex.schema.dropTableIfExists('webfilter_policies');
  await knex.schema.dropTableIfExists('webfilter_categories');
};
