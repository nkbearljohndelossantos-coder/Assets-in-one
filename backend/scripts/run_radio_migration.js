const db = require('../src/config/db');

async function runRadioMigration() {
  try {
    console.log('Checking asset_categories table for Two-Way Radio category...');
    let radioCat = await db('asset_categories')
      .whereRaw('LOWER(name) LIKE ?', ['%radio%'])
      .orWhereRaw('LOWER(name) LIKE ?', ['%walkie%'])
      .first();

    if (!radioCat) {
      const [newId] = await db('asset_categories').insert({
        name: 'Two-Way Radio / Walkie-Talkie',
        description: 'Communication radios, walkie-talkies, base stations, and portable transceivers'
      });
      radioCat = await db('asset_categories').where('id', newId).first();
      console.log('Inserted category: Two-Way Radio / Walkie-Talkie');
    } else {
      console.log('Radio category already exists:', radioCat.name);
    }

    const hasRadioBand = await db.schema.hasColumn('assets', 'radio_frequency_band');
    if (!hasRadioBand) {
      await db.schema.alterTable('assets', (table) => {
        table.string('radio_frequency_band').nullable();
        table.string('radio_channel_count').nullable();
        table.string('radio_power_output').nullable();
        table.string('call_sign').nullable();
        table.string('license_number').nullable();
        table.string('battery_serial').nullable();
      });
      console.log('Added radio spec columns (radio_frequency_band, radio_channel_count, radio_power_output, call_sign, license_number, battery_serial) to assets table');
    } else {
      console.log('Radio spec columns already exist on assets table');
    }

    // Insert 2 Sample Corporate Two-Way Radio Assets if none exist
    if (radioCat) {
      const existingRadioAsset = await db('assets').where('category_id', radioCat.id).first();
      if (!existingRadioAsset) {
        await db('assets').insert([
          {
            asset_code: 'AST-RAD-0001',
            name: 'Motorola XiR P6620i Digital Two-Way Radio',
            category_id: radioCat.id,
            brand: 'Motorola Solutions',
            model: 'XiR P6620i TIA4950',
            serial_number: '807TRF9102',
            description: 'Heavy duty UHF digital two-way radio assigned to Security & Operations',
            specs_cpu: 'DMR Digital Processing Unit',
            specs_ram: 'Built-in Audio DSP',
            specs_storage: 'IP67 Waterproof',
            specs_os: 'MOTOTRBO Firmware v2.10',
            radio_frequency_band: 'UHF (400 - 527 MHz)',
            radio_channel_count: '256 Channels',
            radio_power_output: '4W High Power',
            call_sign: 'SECURITY-DISPATCH-1',
            license_number: 'NTC-PR2026-8801',
            battery_serial: 'PMNN4490A-901',
            purchase_date: '2026-03-10',
            purchase_price: 18500.00,
            supplier: 'Commsys Radio Telecom Inc.',
            condition: 'Good',
            status: 'Assigned',
            remarks: 'Includes IMPRES Li-Ion Battery & Heavy-Duty Belt Clip'
          },
          {
            asset_code: 'AST-RAD-0002',
            name: 'Kenwood NX-3300E VHF Portable Radio',
            category_id: radioCat.id,
            brand: 'Kenwood Communications',
            model: 'NX-3300E NEXEDGE',
            serial_number: 'B9A0284102',
            description: 'VHF multi-protocol digital radio for Factory Operations & Dispatch',
            specs_cpu: 'NXDN/DMR Dual Mode',
            specs_ram: 'Active Noise Cancelling',
            specs_storage: 'IP68 Submersible',
            specs_os: 'NEXEDGE OS v3.1',
            radio_frequency_band: 'VHF (136 - 174 MHz)',
            radio_channel_count: '512 Channels',
            radio_power_output: '5W High Power',
            call_sign: 'FACTORY-BASE-ALPHA',
            license_number: 'NTC-PR2026-9042',
            battery_serial: 'KNB-57L-1049',
            purchase_date: '2026-04-01',
            purchase_price: 21000.00,
            supplier: 'Radio City Comms Philippines',
            condition: 'New',
            status: 'Available',
            remarks: 'Pre-configured with NKB Factory VHF Dispatch Channels'
          }
        ]);
        console.log('Inserted 2 sample corporate Two-Way Radio assets into database!');
      }
    }

    console.log('Two-Way Radio migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Radio Migration Error:', err);
    process.exit(1);
  }
}

runRadioMigration();
