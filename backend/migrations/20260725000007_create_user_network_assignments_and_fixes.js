exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('user_network_assignments');
  if (!exists) {
    await knex.schema.createTable('user_network_assignments', (table) => {
      table.increments('id').primary();
      table.integer('employee_id').unsigned().notNullable()
        .references('id').inTable('employees').onDelete('CASCADE');
      table.integer('asset_id').unsigned().nullable()
        .references('id').inTable('assets').onDelete('SET NULL');
      table.string('ip_address').notNullable();
      table.string('mac_address').notNullable();
      table.string('switch_port').nullable();
      table.integer('switch_id').unsigned().nullable()
        .references('id').inTable('network_devices').onDelete('SET NULL');
      table.integer('access_point_id').unsigned().nullable()
        .references('id').inTable('wifi_networks').onDelete('SET NULL');
      table.integer('department_id').unsigned().nullable()
        .references('id').inTable('departments').onDelete('SET NULL');
      table.string('vlan').nullable();
      table.string('subnet').nullable();
      table.string('gateway').nullable();
      table.datetime('deleted_at').nullable();
      table.timestamps(true, true);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('user_network_assignments');
};
