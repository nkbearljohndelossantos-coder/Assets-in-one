exports.up = async function(knex) {
  // 1. agent_enrollment_tokens
  await knex.schema.createTable('agent_enrollment_tokens', (table) => {
    table.increments('id').primary();
    table.integer('asset_id').unsigned().notNullable().references('id').inTable('assets').onDelete('CASCADE');
    table.string('token_hash', 255).notNullable().unique();
    table.timestamp('expires_at').notNullable();
    table.timestamp('used_at').nullable();
    table.timestamp('revoked_at').nullable();
    table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
  });

  // 2. agents
  await knex.schema.createTable('agents', (table) => {
    table.increments('id').primary();
    table.string('uuid', 100).notNullable().unique();
    table.integer('asset_id').unsigned().notNullable().references('id').inTable('assets').onDelete('CASCADE');
    table.string('organization_id', 100).defaultTo('NKB_MAIN');
    table.string('hostname', 150).notNullable();
    table.string('device_uuid', 100).nullable();
    table.enum('status', ['active', 'revoked', 'pending_upgrade']).defaultTo('active');
    table.enum('enrollment_status', ['enrolled', 'unassigned', 'revoked']).defaultTo('enrolled');
    table.string('agent_version', 50).defaultTo('1.0.0');
    table.string('os_name', 150).nullable();
    table.string('os_version', 50).nullable();
    table.string('os_build', 50).nullable();
    table.string('architecture', 20).defaultTo('x64');
    table.string('current_ip', 50).nullable();
    table.string('current_user', 100).nullable();
    table.string('agent_key_hash', 255).notNullable();
    table.timestamp('last_seen_at').nullable();
    table.timestamp('last_heartbeat_at').nullable();
    table.timestamp('last_inventory_at').nullable();
    table.timestamp('last_security_inventory_at').nullable();
    table.integer('credential_version').defaultTo(1);
    table.timestamp('credential_expires_at').nullable();
    table.timestamp('enrolled_at').defaultTo(knex.fn.now());
    table.timestamp('revoked_at').nullable();
    table.timestamps(true, true);
  });

  // 3. agent_heartbeats
  await knex.schema.createTable('agent_heartbeats', (table) => {
    table.increments('id').primary();
    table.integer('agent_id').unsigned().notNullable().references('id').inTable('agents').onDelete('CASCADE');
    table.timestamp('recorded_at').defaultTo(knex.fn.now());
    table.string('ip_address', 50).nullable();
    table.string('logged_in_user', 100).nullable();
    table.decimal('cpu_percent', 5, 2).defaultTo(0);
    table.decimal('memory_percent', 5, 2).defaultTo(0);
    table.decimal('disk_percent', 5, 2).defaultTo(0);
    table.integer('uptime_seconds').defaultTo(0);
    table.string('health_status', 50).defaultTo('HEALTHY');
    table.string('agent_version', 50).defaultTo('1.0.0');
  });

  // 4. computer_hardware (Normalized Summary)
  await knex.schema.createTable('computer_hardware', (table) => {
    table.increments('id').primary();
    table.integer('agent_id').unsigned().notNullable().references('id').inTable('agents').onDelete('CASCADE');
    table.string('hostname', 150).nullable();
    table.string('domain', 150).nullable();
    table.string('manufacturer', 150).nullable();
    table.string('model', 150).nullable();
    table.string('serial_number', 150).nullable();
    table.string('bios_version', 150).nullable();
    table.string('bios_vendor', 150).nullable();
    table.string('cpu_name', 200).nullable();
    table.integer('cpu_cores').defaultTo(0);
    table.integer('cpu_threads').defaultTo(0);
    table.bigInteger('total_memory_bytes').defaultTo(0);
    table.integer('memory_slots_used').defaultTo(0);
    table.integer('memory_slots_total').defaultTo(0);
    table.string('graphics_card', 200).nullable();
    table.text('raw_json').nullable();
    table.timestamps(true, true);
  });

  // 5. physical_disks
  await knex.schema.createTable('physical_disks', (table) => {
    table.increments('id').primary();
    table.integer('agent_id').unsigned().notNullable().references('id').inTable('agents').onDelete('CASCADE');
    table.string('model', 150).nullable();
    table.string('serial_number', 150).nullable();
    table.string('media_type', 50).defaultTo('SSD');
    table.string('bus_type', 50).defaultTo('NVMe');
    table.bigInteger('capacity_bytes').defaultTo(0);
    table.string('health_status', 50).defaultTo('OK');
    table.timestamps(true, true);
  });

  // 6. disk_volumes
  await knex.schema.createTable('disk_volumes', (table) => {
    table.increments('id').primary();
    table.integer('agent_id').unsigned().notNullable().references('id').inTable('agents').onDelete('CASCADE');
    table.string('drive_letter', 10).notNullable();
    table.string('volume_name', 100).nullable();
    table.string('file_system', 50).defaultTo('NTFS');
    table.bigInteger('total_bytes').defaultTo(0);
    table.bigInteger('free_bytes').defaultTo(0);
    table.decimal('used_pct', 5, 2).defaultTo(0);
    table.string('bitlocker_status', 50).defaultTo('ProtectionOff');
    table.timestamps(true, true);
  });

  // 7. network_adapters
  await knex.schema.createTable('network_adapters', (table) => {
    table.increments('id').primary();
    table.integer('agent_id').unsigned().notNullable().references('id').inTable('agents').onDelete('CASCADE');
    table.string('adapter_name', 150).notNullable();
    table.string('mac_address', 50).nullable();
    table.string('ip_address', 50).nullable();
    table.string('subnet_mask', 50).nullable();
    table.string('gateway', 50).nullable();
    table.string('dns_servers', 255).nullable();
    table.boolean('dhcp_enabled').defaultTo(true);
    table.string('connection_status', 50).defaultTo('Connected');
    table.timestamps(true, true);
  });

  // 8. installed_software
  await knex.schema.createTable('installed_software', (table) => {
    table.increments('id').primary();
    table.integer('agent_id').unsigned().notNullable().references('id').inTable('agents').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('version', 100).nullable();
    table.string('publisher', 255).nullable();
    table.string('install_date', 50).nullable();
    table.string('install_location', 255).nullable();
    table.string('uninstall_string', 500).nullable();
    table.string('architecture', 20).defaultTo('x64');
    table.timestamps(true, true);
  });

  // 9. installed_updates
  await knex.schema.createTable('installed_updates', (table) => {
    table.increments('id').primary();
    table.integer('agent_id').unsigned().notNullable().references('id').inTable('agents').onDelete('CASCADE');
    table.string('hotfix_id', 50).notNullable();
    table.string('description', 255).nullable();
    table.string('installed_on', 50).nullable();
    table.string('installed_by', 100).nullable();
    table.timestamps(true, true);
  });

  // 10. windows_security_inventory
  await knex.schema.createTable('windows_security_inventory', (table) => {
    table.increments('id').primary();
    table.integer('agent_id').unsigned().notNullable().references('id').inTable('agents').onDelete('CASCADE');
    table.boolean('defender_enabled').defaultTo(true);
    table.boolean('defender_realtime').defaultTo(true);
    table.string('antivirus_name', 150).defaultTo('Microsoft Defender');
    table.string('signature_version', 100).nullable();
    table.boolean('firewall_domain').defaultTo(true);
    table.boolean('firewall_private').defaultTo(true);
    table.boolean('firewall_public').defaultTo(true);
    table.boolean('bitlocker_enabled').defaultTo(false);
    table.boolean('tpm_present').defaultTo(true);
    table.string('tpm_version', 20).defaultTo('2.0');
    table.boolean('secure_boot_enabled').defaultTo(true);
    table.boolean('uac_enabled').defaultTo(true);
    table.boolean('pending_reboot').defaultTo(false);
    table.text('local_admins_json').nullable();
    table.timestamps(true, true);
  });

  // 11. performance_metrics
  await knex.schema.createTable('performance_metrics', (table) => {
    table.increments('id').primary();
    table.integer('agent_id').unsigned().notNullable().references('id').inTable('agents').onDelete('CASCADE');
    table.timestamp('recorded_at').defaultTo(knex.fn.now());
    table.decimal('cpu_percent', 5, 2).defaultTo(0);
    table.decimal('memory_percent', 5, 2).defaultTo(0);
    table.bigInteger('available_memory_bytes').defaultTo(0);
    table.decimal('disk_percent', 5, 2).defaultTo(0);
    table.bigInteger('disk_read_bytes_sec').defaultTo(0);
    table.bigInteger('disk_write_bytes_sec').defaultTo(0);
    table.bigInteger('net_recv_bytes_sec').defaultTo(0);
    table.bigInteger('net_sent_bytes_sec').defaultTo(0);
    table.integer('battery_percent').nullable();
    table.boolean('is_ac_powered').defaultTo(true);
  });

  // 12. device_events
  await knex.schema.createTable('device_events', (table) => {
    table.increments('id').primary();
    table.integer('agent_id').unsigned().notNullable().references('id').inTable('agents').onDelete('CASCADE');
    table.enum('event_type', ['HARDWARE_CHANGE', 'SOFTWARE_INSTALLED', 'SOFTWARE_REMOVED', 'SECURITY_ALERT', 'PERFORMANCE_ALERT', 'IP_CHANGE']).notNullable();
    table.enum('severity', ['INFO', 'WARNING', 'CRITICAL']).defaultTo('INFO');
    table.string('summary', 255).notNullable();
    table.text('details_json').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 13. agent_logs
  await knex.schema.createTable('agent_logs', (table) => {
    table.increments('id').primary();
    table.integer('agent_id').unsigned().notNullable().references('id').inTable('agents').onDelete('CASCADE');
    table.string('level', 20).defaultTo('INFO');
    table.string('component', 100).defaultTo('AgentService');
    table.text('message').notNullable();
    table.text('exception_details').nullable();
    table.timestamp('logged_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('agent_logs');
  await knex.schema.dropTableIfExists('device_events');
  await knex.schema.dropTableIfExists('performance_metrics');
  await knex.schema.dropTableIfExists('windows_security_inventory');
  await knex.schema.dropTableIfExists('installed_updates');
  await knex.schema.dropTableIfExists('installed_software');
  await knex.schema.dropTableIfExists('network_adapters');
  await knex.schema.dropTableIfExists('disk_volumes');
  await knex.schema.dropTableIfExists('physical_disks');
  await knex.schema.dropTableIfExists('computer_hardware');
  await knex.schema.dropTableIfExists('agent_heartbeats');
  await knex.schema.dropTableIfExists('agents');
  await knex.schema.dropTableIfExists('agent_enrollment_tokens');
};
