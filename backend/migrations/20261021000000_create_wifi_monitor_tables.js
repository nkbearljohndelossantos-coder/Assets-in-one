const crypto = require('crypto');

/**
 * Migration: Create Wi-Fi Device Monitor & Access Control Tables
 */
exports.up = async function(knex) {
  // 1. Monitored Network Devices Table
  const hasMonitored = await knex.schema.hasTable('wifi_monitored_devices');
  if (!hasMonitored) {
    await knex.schema.createTable('wifi_monitored_devices', (table) => {
      table.increments('id').primary();
      table.string('mac_address', 50).notNullable().index();
      table.string('ip_address', 50).nullable().index();
      table.string('hostname', 255).nullable();
      table.string('vendor', 255).nullable();
      table.string('connection_type', 50).notNullable().defaultTo('Unknown'); // 'Wi-Fi' | 'Wired' | 'LAN (ARP Observed)'
      table.string('ssid', 100).nullable();
      table.string('signal_strength', 50).nullable();
      table.string('ap_source', 100).notNullable().defaultTo('On-Premise Network Agent');
      table.string('status', 50).notNullable().defaultTo('Online'); // 'Online' | 'Offline'
      table.string('classification', 50).notNullable().defaultTo('UNKNOWN'); // 'UNKNOWN' | 'TRUSTED' | 'BLOCKED'
      table.boolean('is_randomized_mac').notNullable().defaultTo(false);
      table.timestamp('first_seen_at').defaultTo(knex.fn.now());
      table.timestamp('last_seen_at').defaultTo(knex.fn.now());
      table.timestamp('last_synced_at').defaultTo(knex.fn.now());
      table.text('metadata').nullable();
      table.timestamps(true, true);
    });
  }

  // 2. Trusted Device Inventory Registry
  const hasTrusted = await knex.schema.hasTable('wifi_trusted_inventory');
  if (!hasTrusted) {
    await knex.schema.createTable('wifi_trusted_inventory', (table) => {
      table.increments('id').primary();
      table.string('mac_address', 50).notNullable().unique().index();
      table.string('device_name', 255).notNullable();
      table.string('owner_name', 255).nullable();
      table.string('department', 100).nullable();
      table.string('location', 255).nullable();
      table.string('device_type', 100).nullable().defaultTo('Other');
      table.text('notes').nullable();
      table.boolean('is_randomized_mac').notNullable().defaultTo(false);
      table.integer('approved_by_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      table.string('approved_by_name', 255).nullable();
      table.timestamps(true, true);
    });
  }

  // 3. Router & Access Point Integrations Table
  const hasRouters = await knex.schema.hasTable('wifi_router_integrations');
  if (!hasRouters) {
    await knex.schema.createTable('wifi_router_integrations', (table) => {
      table.increments('id').primary();
      table.string('name', 255).notNullable();
      table.string('router_type', 100).notNullable(); // 'zte_gpon', 'on_prem_agent', 'unifi', 'omada', 'mikrotik'
      table.string('ip_address', 50).nullable();
      table.string('mac_address', 50).nullable();
      table.string('status', 50).notNullable().defaultTo('Active');
      table.text('capabilities').nullable(); // JSON string
      table.timestamp('last_heartbeat_at').nullable();
      table.text('remarks').nullable();
      table.timestamps(true, true);
    });

    // Seed physical ZTE gateway and on-premise agent router profiles
    await knex('wifi_router_integrations').insert([
      {
        name: 'Globe / ZTE GPON Gateway (ONT)',
        router_type: 'zte_gpon',
        ip_address: '192.168.254.254',
        mac_address: '84:3C:99:54:BC:73',
        status: 'Active',
        capabilities: JSON.stringify({
          can_read_clients: false,
          can_block_clients: false,
          hardware_model: 'ZTE GPON ONT (Globe Telecom)',
          management_url: 'http://192.168.254.254',
          block_reason: 'Hardware API Unsupported: ISP ZTE GPON ONT firmware lacks a public vendor REST/RADIUS API. Programmatic blocking is disabled to prevent modem lockout.',
          telemetry_source: 'Inferred via On-Premise Network Agent'
        }),
        remarks: 'Physical office gateway managing primary local subnet 192.168.254.0/24'
      },
      {
        name: 'ITMS On-Premise Network Agent',
        router_type: 'on_prem_agent',
        ip_address: '192.168.254.20',
        mac_address: null,
        status: 'Active',
        capabilities: JSON.stringify({
          can_read_clients: true,
          can_block_clients: false,
          telemetry_type: 'Local Subnet ARP & Ping Probe',
          block_reason: 'Passive network observer only; active packet dropping requires 802.1X or managed switch port control.',
          medium_classification: 'Distinguishes Known Wi-Fi SSIDs vs Local LAN ARP'
        }),
        remarks: 'Dedicated local collector reporting real-time client presence to cloud ITMS'
      }
    ]);
  }

  // 4. Wi-Fi Access Control Audit Logs
  const hasLogs = await knex.schema.hasTable('wifi_access_logs');
  if (!hasLogs) {
    await knex.schema.createTable('wifi_access_logs', (table) => {
      table.increments('id').primary();
      table.string('action', 100).notNullable();
      table.string('target_mac', 50).notNullable().index();
      table.string('target_ip', 50).nullable();
      table.string('target_name', 255).nullable();
      table.string('router_name', 100).nullable();
      table.integer('requested_by_user_id').unsigned().nullable();
      table.string('requested_by_name', 255).nullable();
      table.string('status', 50).notNullable(); // 'SUCCESS' | 'FAILED' | 'UNSUPPORTED'
      table.text('details').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  // 5. Agent Credentials Table (Secure Revocable Per-Agent Keys)
  const hasAgentCreds = await knex.schema.hasTable('wifi_agent_credentials');
  if (!hasAgentCreds) {
    await knex.schema.createTable('wifi_agent_credentials', (table) => {
      table.increments('id').primary();
      table.string('agent_uuid', 64).notNullable().unique().index();
      table.string('agent_name', 255).notNullable();
      table.string('api_key_hash', 255).notNullable();
      table.string('status', 50).notNullable().defaultTo('Active');
      table.timestamp('last_seen_at').nullable();
      table.string('last_ip', 50).nullable();
      table.timestamps(true, true);
    });

    // Initial Agent Credential Record (Stores ONLY one-way SHA-256 hash)
    // Never store plaintext credentials in migrations or source files
    const initialHash = process.env.INITIAL_WIFI_AGENT_KEY_HASH 
      || crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');

    await knex('wifi_agent_credentials').insert({
      agent_uuid: 'agent-nkb-plant-01',
      agent_name: 'NKB Main Plant On-Premise Network Agent',
      api_key_hash: initialHash,
      status: process.env.INITIAL_WIFI_AGENT_KEY_HASH ? 'Active' : 'Pending',
      last_ip: '192.168.254.20'
    });
  }

  // 6. Agent Nonce Replay Protection Table (Multi-Instance & Restart Safe)
  const hasAgentNonces = await knex.schema.hasTable('wifi_agent_nonces');
  if (!hasAgentNonces) {
    await knex.schema.createTable('wifi_agent_nonces', (table) => {
      table.string('nonce', 100).primary();
      table.string('agent_uuid', 64).notNullable().index();
      table.timestamp('created_at').defaultTo(knex.fn.now()).index();
    });
  }

  // 7. Seed Permissions for Wi-Fi Monitor
  const perms = [
    { code: 'wifi_monitor.view', name: 'View Wi-Fi Device Monitor', description: 'Allows viewing connected devices, network topology, and access logs' },
    { code: 'wifi_monitor.manage', name: 'Manage Wi-Fi Access Control', description: 'Allows registering trusted devices, initiating block actions, and managing network integrations' }
  ];

  for (const p of perms) {
    const existing = await knex('permissions').where({ code: p.code }).first();
    let permId = existing?.id;
    if (!existing) {
      const [id] = await knex('permissions').insert(p);
      permId = Array.isArray(id) ? id[0] : id;
    }

    // Assign to Super Admin (1) and IT Manager (2)
    for (const roleId of [1, 2]) {
      const roleExists = await knex('roles').where({ id: roleId }).first();
      if (roleExists) {
        const hasAssigned = await knex('role_permissions').where({ role_id: roleId, permission_id: permId }).first();
        if (!hasAssigned) {
          await knex('role_permissions').insert({ role_id: roleId, permission_id: permId });
        }
      }
    }
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('wifi_agent_nonces');
  await knex.schema.dropTableIfExists('wifi_access_logs');
  await knex.schema.dropTableIfExists('wifi_monitored_devices');
  await knex.schema.dropTableIfExists('wifi_trusted_inventory');
  await knex.schema.dropTableIfExists('wifi_router_integrations');
  await knex.schema.dropTableIfExists('wifi_agent_credentials');
  await knex('permissions').whereIn('code', ['wifi_monitor.view', 'wifi_monitor.manage']).del();
};
