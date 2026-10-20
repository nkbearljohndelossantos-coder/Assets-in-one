/**
 * Migration: Create Production-Grade API Platform Tables
 * Tables: api_clients, api_keys, api_scopes, api_client_scopes, api_audit_logs, security_events, idempotency_records
 */
exports.up = async function(knex) {
  // 1. API Clients Table (Applications e.g. NKB-DCC, NKB-PPE, NKB-FORMULATION, External Apps)
  const hasClients = await knex.schema.hasTable('api_clients');
  if (!hasClients) {
    await knex.schema.createTable('api_clients', (table) => {
      table.string('id', 36).primary(); // UUID
      table.string('name', 100).notNullable();
      table.string('app_code', 50).notNullable().unique(); // e.g. NKB-DCC, NKB-PPE
      table.text('description').nullable();
      table.string('owner_email', 150).notNullable();
      table.string('status', 20).notNullable().defaultTo('active'); // active, disabled, suspended
      table.integer('rate_limit_per_min').notNullable().defaultTo(100);
      table.integer('rate_limit_per_hour').notNullable().defaultTo(1000);
      table.timestamp('expires_at').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.timestamp('last_used_at').nullable();

      table.index(['app_code', 'status']);
    });
  }

  // 2. API Keys Table (Hashes of nkb_live_... keys)
  const hasKeys = await knex.schema.hasTable('api_keys');
  if (!hasKeys) {
    await knex.schema.createTable('api_keys', (table) => {
      table.string('id', 36).primary(); // UUID
      table.string('client_id', 36).notNullable().references('id').inTable('api_clients').onDelete('CASCADE');
      table.string('key_prefix', 30).notNullable(); // e.g. nkb_live_...7X92
      table.string('key_hash', 128).notNullable().unique(); // SHA-256 peppered hash
      table.string('name', 100).notNullable().defaultTo('Primary Production Key');
      table.string('status', 20).notNullable().defaultTo('active'); // active, revoked, expired
      table.text('allowed_scopes').notNullable(); // JSON array string e.g. ["documents:read","assets:read"]
      table.integer('custom_rate_limit').nullable();
      table.timestamp('expires_at').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('last_used_at').nullable();
      table.timestamp('revoked_at').nullable();

      table.index(['key_hash', 'status']);
      table.index(['client_id']);
    });
  }

  // 3. API Scopes Table (Granular scope definitions)
  const hasScopes = await knex.schema.hasTable('api_scopes');
  if (!hasScopes) {
    await knex.schema.createTable('api_scopes', (table) => {
      table.string('id', 50).primary(); // e.g. documents:read
      table.string('category', 50).notNullable(); // e.g. Documents, Assets, Users, Formulas, PPE
      table.string('name', 100).notNullable();
      table.text('description').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  // 4. API Audit Logs Table (Permanent audit trail)
  const hasAuditLogs = await knex.schema.hasTable('api_audit_logs');
  if (!hasAuditLogs) {
    await knex.schema.createTable('api_audit_logs', (table) => {
      table.string('id', 36).primary(); // UUID
      table.string('request_id', 36).notNullable();
      table.string('client_id', 36).nullable().references('id').inTable('api_clients').onDelete('SET NULL');
      table.string('key_prefix', 30).nullable();
      table.string('endpoint', 255).notNullable();
      table.string('method', 10).notNullable();
      table.integer('status_code').notNullable();
      table.integer('response_time_ms').notNullable();
      table.string('ip_address', 45).notNullable();
      table.string('user_agent', 255).nullable();
      table.string('scope_used', 50).nullable();
      table.string('error_code', 50).nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['request_id']);
      table.index(['client_id']);
      table.index(['created_at']);
      table.index(['status_code']);
    });
  }

  // 5. Security Events Table (Failed auth, rate limits, suspicious calls)
  const hasSecurityEvents = await knex.schema.hasTable('security_events');
  if (!hasSecurityEvents) {
    await knex.schema.createTable('security_events', (table) => {
      table.string('id', 36).primary();
      table.string('event_type', 50).notNullable(); // AUTH_FAILURE, RATE_LIMIT_EXCEEDED, SCOPE_DENIED, EXPIRED_KEY
      table.string('severity', 20).notNullable().defaultTo('warning'); // info, warning, error, critical
      table.string('client_id', 36).nullable();
      table.string('ip_address', 45).notNullable();
      table.string('endpoint', 255).notNullable();
      table.text('details').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['event_type', 'created_at']);
      table.index(['ip_address']);
    });
  }

  // 6. Idempotency Records Table
  const hasIdempotency = await knex.schema.hasTable('idempotency_records');
  if (!hasIdempotency) {
    await knex.schema.createTable('idempotency_records', (table) => {
      table.string('key_hash', 128).primary(); // SHA-256 of Idempotency-Key + client_id
      table.string('client_id', 36).notNullable();
      table.string('endpoint', 255).notNullable();
      table.integer('status_code').notNullable();
      table.text('response_body').notNullable(); // JSON string
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('expires_at').notNullable();

      table.index(['client_id', 'expires_at']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('idempotency_records');
  await knex.schema.dropTableIfExists('security_events');
  await knex.schema.dropTableIfExists('api_audit_logs');
  await knex.schema.dropTableIfExists('api_scopes');
  await knex.schema.dropTableIfExists('api_keys');
  await knex.schema.dropTableIfExists('api_clients');
};
