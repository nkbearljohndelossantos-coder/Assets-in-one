/**
 * Migration: Auto-seed default inventory categories for spare parts
 */
exports.up = async function(knex) {
  const defaultCategories = [
    { name: 'Peripherals & Input', description: 'Keyboards, mice, webcams, and external input devices' },
    { name: 'RAM / Memory', description: 'DDR4, DDR5, and SODIMM memory modules' },
    { name: 'Storage (SSD / HDD)', description: 'NVMe M.2 SSDs, 2.5 SATA SSDs, and hard drives' },
    { name: 'Power Supplies & Chargers', description: 'Laptop AC adapters, desktop PSUs, and power cables' },
    { name: 'Cables & Adapters', description: 'HDMI, DisplayPort, USB-C, and Ethernet patch cables' },
    { name: 'Printer Consumables & Spares', description: 'Toner cartridges, pickup rollers, and maintenance kits' },
    { name: 'Network Parts & Accessories', description: 'SFP modules, RJ45 connectors, and keystone jacks' },
    { name: 'Internal Components & Cooling', description: 'Case fans, CPU coolers, thermal paste, and CMOS batteries' },
    { name: 'Batteries & UPS Spares', description: 'Replacement laptop batteries and 12V UPS batteries' }
  ];

  for (const cat of defaultCategories) {
    const existing = await knex('inventory_categories').where('name', cat.name).first();
    if (!existing) {
      await knex('inventory_categories').insert({
        name: cat.name,
        description: cat.description,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
  }
};

exports.down = async function(knex) {
  // Safe rollback: do not delete user-created records
};
