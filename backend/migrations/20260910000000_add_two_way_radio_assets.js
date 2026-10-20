/**
 * Migration: Add Two-Way Radio / Walkie-Talkie asset category and radio spec columns
 */
exports.up = async function(knex) {
  // 1. Add Two-Way Radio asset category if missing
  const existingCategory = await knex('asset_categories')
    .whereRaw('LOWER(name) LIKE ?', ['%radio%'])
    .orWhereRaw('LOWER(name) LIKE ?', ['%walkie%'])
    .first();

  if (!existingCategory) {
    await knex('asset_categories').insert({
      name: 'Two-Way Radio / Walkie-Talkie',
      description: 'Communication radios, walkie-talkies, base stations, and portable transceivers'
    });
  }

  // 2. Add Radio specific columns to assets table if missing
  const hasRadioBand = await knex.schema.hasColumn('assets', 'radio_frequency_band');
  if (!hasRadioBand) {
    await knex.schema.alterTable('assets', (table) => {
      table.string('radio_frequency_band').nullable(); // e.g. UHF 400-470MHz, VHF 136-174MHz
      table.string('radio_channel_count').nullable();   // e.g. 16 Channels, 32 Channels
      table.string('radio_power_output').nullable();    // e.g. 5W, 10W
      table.string('call_sign').nullable();             // e.g. SECURITY-ALPHA-1, DISPATCH-BASE
      table.string('license_number').nullable();        // NTC License / Permit Number
      table.string('battery_serial').nullable();        // Battery Pack Serial / Model
    });
  }
};

exports.down = async function(knex) {
  const hasRadioBand = await knex.schema.hasColumn('assets', 'radio_frequency_band');
  if (hasRadioBand) {
    await knex.schema.alterTable('assets', (table) => {
      table.dropColumn('radio_frequency_band');
      table.dropColumn('radio_channel_count');
      table.dropColumn('radio_power_output');
      table.dropColumn('call_sign');
      table.dropColumn('license_number');
      table.dropColumn('battery_serial');
    });
  }
};
