/**
 * Migration: Create PPE Domain Tables
 * Integrates Property, Plant & Equipment (PPE), Depreciation, Maintenance,
 * Returnable Containers, and Accounting General Ledger & Journals into the unified database.
 */

exports.up = async function(knex) {
  // 1. PPE Asset Categories
  await knex.schema.createTable('ppe_asset_categories', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable().unique();
    table.text('description').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 2. PPE Asset Code Year Counters (e.g. PPE-2026-0001)
  await knex.schema.createTable('ppe_asset_code_counters', (table) => {
    table.integer('year').primary();
    table.integer('last_seq').notNullable().defaultTo(0);
  });

  // 3. PPE Chart of Accounts / General Ledger Accounts
  await knex.schema.createTable('ppe_gl_accounts', (table) => {
    table.increments('id').primary();
    table.string('code', 20).notNullable().unique();
    table.string('name', 150).notNullable();
    table.string('type', 30).notNullable(); // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    table.text('description').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.decimal('balance', 14, 2).notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 4. PPE Assets
  await knex.schema.createTable('ppe_assets', (table) => {
    table.increments('id').primary();
    table.string('asset_code', 50).notNullable().unique();
    table.string('asset_name', 200).notNullable();
    table.string('room_id', 50).nullable();
    table.string('room_name', 100).nullable();
    table.string('gl_account', 50).nullable();
    table.integer('category_id').unsigned().nullable().references('id').inTable('ppe_asset_categories').onDelete('SET NULL');
    table.string('category_name', 100).notNullable();
    table.string('serial_number', 100).nullable();
    table.date('purchase_date').notNullable();
    table.decimal('acquisition_cost', 14, 2).notNullable().defaultTo(0);
    table.integer('useful_life_years').notNullable().defaultTo(5);
    table.decimal('salvage_value', 14, 2).notNullable().defaultTo(0);
    table.string('assigned_to', 150).nullable();
    table.string('location', 150).nullable();
    table.string('status', 30).notNullable().defaultTo('ACTIVE'); // ACTIVE, UNDER_MAINTENANCE, RETIRED
    table.string('image_path', 255).nullable();
    table.text('notes').nullable();
    table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('updated_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();

    table.index(['asset_code']);
    table.index(['category_name']);
    table.index(['status']);
    table.index(['deleted_at']);
  });

  // 5. PPE Maintenance Records
  await knex.schema.createTable('ppe_maintenance_records', (table) => {
    table.increments('id').primary();
    table.integer('asset_id').unsigned().notNullable().references('id').inTable('ppe_assets').onDelete('CASCADE');
    table.date('maintenance_date').notNullable();
    table.text('description').notNullable();
    table.decimal('cost', 14, 2).notNullable().defaultTo(0);
    table.string('performed_by', 150).nullable();
    table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['asset_id']);
    table.index(['maintenance_date']);
  });

  // 6. PPE Returnable Containers
  await knex.schema.createTable('ppe_returnable_containers', (table) => {
    table.increments('id').primary();
    table.string('container_code', 50).notNullable().unique();
    table.string('container_type', 50).notNullable(); // Tote Box, Steel Drum, Gas Cylinder, Pallet, Plastic Bin
    table.string('description', 200).nullable();
    table.string('barcode', 100).nullable();
    table.string('status', 30).notNullable().defaultTo('AVAILABLE'); // AVAILABLE, CHECKED_OUT, IN_TRANSIT, DAMAGED, RETIRED
    table.string('current_holder', 150).nullable();
    table.integer('department_id').unsigned().nullable().references('id').inTable('departments').onDelete('SET NULL');
    table.string('location', 150).nullable();
    table.text('notes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['container_code']);
    table.index(['status']);
  });

  // 7. PPE Container Movement History
  await knex.schema.createTable('ppe_container_movements', (table) => {
    table.increments('id').primary();
    table.integer('container_id').unsigned().notNullable().references('id').inTable('ppe_returnable_containers').onDelete('CASCADE');
    table.string('action', 50).notNullable(); // CHECK_OUT, CHECK_IN, TRANSFER, MAINTENANCE, STATUS_CHANGE
    table.string('from_location', 150).nullable();
    table.string('to_location', 150).nullable();
    table.string('released_to', 150).nullable();
    table.integer('recorded_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.text('notes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['container_id']);
    table.index(['action']);
  });

  // 8. PPE Accounting Journal Entries (Double-Entry Header)
  await knex.schema.createTable('ppe_journal_entries', (table) => {
    table.increments('id').primary();
    table.string('entry_number', 50).notNullable().unique(); // JV-2026-0001
    table.date('entry_date').notNullable();
    table.string('reference', 150).nullable();
    table.text('description').notNullable();
    table.decimal('total_debit', 14, 2).notNullable();
    table.decimal('total_credit', 14, 2).notNullable();
    table.string('status', 30).notNullable().defaultTo('POSTED'); // POSTED, DRAFT, VOID
    table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['entry_number']);
    table.index(['entry_date']);
    table.index(['status']);
  });

  // 9. PPE Accounting Journal Lines (Double-Entry Details)
  await knex.schema.createTable('ppe_journal_lines', (table) => {
    table.increments('id').primary();
    table.integer('journal_id').unsigned().notNullable().references('id').inTable('ppe_journal_entries').onDelete('CASCADE');
    table.integer('account_id').unsigned().notNullable().references('id').inTable('ppe_gl_accounts').onDelete('RESTRICT');
    table.decimal('debit', 14, 2).notNullable().defaultTo(0);
    table.decimal('credit', 14, 2).notNullable().defaultTo(0);
    table.string('description', 255).nullable();

    table.index(['journal_id']);
    table.index(['account_id']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('ppe_journal_lines');
  await knex.schema.dropTableIfExists('ppe_journal_entries');
  await knex.schema.dropTableIfExists('ppe_container_movements');
  await knex.schema.dropTableIfExists('ppe_returnable_containers');
  await knex.schema.dropTableIfExists('ppe_maintenance_records');
  await knex.schema.dropTableIfExists('ppe_assets');
  await knex.schema.dropTableIfExists('ppe_gl_accounts');
  await knex.schema.dropTableIfExists('ppe_asset_code_counters');
  await knex.schema.dropTableIfExists('ppe_asset_categories');
};
