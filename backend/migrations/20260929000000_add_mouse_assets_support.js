/**
 * Migration: Add Computer Mouse / Peripherals asset category and mouse spec columns
 */
exports.up = async function(knex) {
  // 1. Add Computer Mouse / Peripherals asset category if missing
  const existingCategory = await knex('asset_categories')
    .whereRaw('LOWER(name) LIKE ?', ['%mouse%'])
    .first();

  if (!existingCategory) {
    await knex('asset_categories').insert({
      name: 'Computer Mouse / Peripherals',
      description: 'Wired and wireless optical mice, trackballs, and pointing peripherals'
    });
  }

  // 2. Add Mouse specific columns to assets table if missing
  const hasMouseConnectivity = await knex.schema.hasColumn('assets', 'mouse_connectivity');
  if (!hasMouseConnectivity) {
    await knex.schema.alterTable('assets', (table) => {
      table.string('mouse_connectivity').nullable(); // e.g. Wireless 2.4GHz USB Dongle, Bluetooth, Wired USB
      table.string('mouse_sensor_dpi').nullable();   // e.g. 1000 DPI, 4000 DPI, 8000 DPI
      table.string('mouse_buttons_count').nullable(); // e.g. 3 Buttons, 6 Programmable Buttons
      table.string('mouse_hand_orientation').nullable(); // e.g. Ambidextrous, Ergonomic Right-Handed
    });
  }
};

exports.down = async function(knex) {
  const hasMouseConnectivity = await knex.schema.hasColumn('assets', 'mouse_connectivity');
  if (hasMouseConnectivity) {
    await knex.schema.alterTable('assets', (table) => {
      table.dropColumn('mouse_connectivity');
      table.dropColumn('mouse_sensor_dpi');
      table.dropColumn('mouse_buttons_count');
      table.dropColumn('mouse_hand_orientation');
    });
  }
};
