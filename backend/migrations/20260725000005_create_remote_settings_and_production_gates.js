exports.up = async function(knex) {
  // 1. remote_management_settings
  await knex.schema.createTable('remote_management_settings', (table) => {
    table.increments('id').primary();
    table.string('setting_key', 100).notNullable().unique();
    table.text('setting_value').notNullable();
    table.string('description', 255).nullable();
    table.timestamps(true, true);
  });

  // 2. production_activation_gates (12-point checklist for production enablement)
  await knex.schema.createTable('production_activation_gates', (table) => {
    table.increments('id').primary();
    table.string('check_code', 100).notNullable().unique();
    table.string('check_title', 200).notNullable();
    table.text('description').nullable();
    table.boolean('is_passed').defaultTo(false);
    table.timestamp('passed_at').nullable();
    table.integer('signed_off_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('production_activation_gates');
  await knex.schema.dropTableIfExists('remote_management_settings');
};
