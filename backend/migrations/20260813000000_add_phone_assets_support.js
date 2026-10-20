/**
 * Migration: Add Smartphone / Mobile Phone asset category and mobile phone spec columns
 */
exports.up = async function(knex) {
  // 1. Add Smartphone / Mobile Phone asset category if missing
  const existingCategory = await knex('asset_categories')
    .whereRaw('LOWER(name) LIKE ?', ['%phone%'])
    .orWhereRaw('LOWER(name) LIKE ?', ['%mobile%'])
    .first();

  if (!existingCategory) {
    await knex('asset_categories').insert({
      name: 'Smartphone / Mobile Phone',
      description: 'Corporate mobile phones, smartphones, iPhones, and Android MDM devices'
    });
  }

  // 2. Add Phone specific columns to assets table if missing
  const hasImei = await knex.schema.hasColumn('assets', 'imei_number');
  if (!hasImei) {
    await knex.schema.alterTable('assets', (table) => {
      table.string('imei_number').nullable();
      table.string('phone_number').nullable();
      table.string('sim_carrier').nullable();
      table.boolean('mdm_enrolled').notNullable().defaultTo(false);
      table.string('mdm_device_id').nullable();
    });
  }
};

exports.down = async function(knex) {
  const hasImei = await knex.schema.hasColumn('assets', 'imei_number');
  if (hasImei) {
    await knex.schema.alterTable('assets', (table) => {
      table.dropColumn('imei_number');
      table.dropColumn('phone_number');
      table.dropColumn('sim_carrier');
      table.dropColumn('mdm_enrolled');
      table.dropColumn('mdm_device_id');
    });
  }
};
