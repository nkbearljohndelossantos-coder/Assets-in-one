const db = require('../src/config/db');

async function runMouseMigration() {
  try {
    console.log('Checking asset_categories table for Computer Mouse category...');
    let mouseCat = await db('asset_categories')
      .whereRaw('LOWER(name) LIKE ?', ['%mouse%'])
      .first();

    if (!mouseCat) {
      const [newId] = await db('asset_categories').insert({
        name: 'Computer Mouse / Peripherals',
        description: 'Wired and wireless optical mice, trackballs, and pointing peripherals'
      });
      mouseCat = await db('asset_categories').where('id', newId).first();
      console.log('Inserted category: Computer Mouse / Peripherals');
    } else {
      console.log('Mouse category already exists:', mouseCat.name);
    }

    const hasMouseConnectivity = await db.schema.hasColumn('assets', 'mouse_connectivity');
    if (!hasMouseConnectivity) {
      await db.schema.alterTable('assets', (table) => {
        table.string('mouse_connectivity').nullable();
        table.string('mouse_sensor_dpi').nullable();
        table.string('mouse_buttons_count').nullable();
        table.string('mouse_hand_orientation').nullable();
      });
      console.log('Added mouse spec columns (mouse_connectivity, mouse_sensor_dpi, mouse_buttons_count, mouse_hand_orientation) to assets table');
    } else {
      console.log('Mouse spec columns already exist on assets table');
    }

    // Insert 2 Sample Corporate Computer Mouse Assets if none exist
    if (mouseCat) {
      const existingMouseAsset = await db('assets').where('category_id', mouseCat.id).first();
      if (!existingMouseAsset) {
        await db('assets').insert([
          {
            asset_code: 'AST-MOU-0001',
            name: 'Logitech MX Master 3S Wireless Performance Mouse',
            category_id: mouseCat.id,
            brand: 'Logitech',
            model: 'MX Master 3S Graphic Grey',
            serial_number: '2234LZM0901',
            description: 'Ergonomic 8K DPI Quiet Click Bluetooth/Logi Bolt wireless mouse assigned to Lead Executive',
            specs_cpu: 'Logi Bolt USB Receiver + Bluetooth LE',
            specs_ram: 'MagSpeed Electromagnetic Scroll',
            specs_storage: 'Rechargeable 500mAh Li-Po',
            specs_os: 'Logi Options+ Compatible',
            mouse_connectivity: 'Logi Bolt 2.4GHz + Bluetooth LE Dual Mode',
            mouse_sensor_dpi: '8000 DPI Darkfield High Precision',
            mouse_buttons_count: '7 Programmable Buttons + Thumb Wheel',
            mouse_hand_orientation: 'Ergonomic Right-Handed',
            purchase_date: '2026-05-15',
            purchase_price: 5850.00,
            supplier: 'Complink Marketing Inc.',
            condition: 'New',
            status: 'Assigned',
            remarks: 'Includes Logi Bolt USB Receiver & USB-C Charging Cable'
          },
          {
            asset_code: 'AST-MOU-0002',
            name: 'Dell MS116 Optical Wired Business Mouse',
            category_id: mouseCat.id,
            brand: 'Dell Technologies',
            model: 'MS116 USB Optical Mouse',
            serial_number: 'CN-0DV307-73891',
            description: 'Standard 1000 DPI wired USB optical mouse for Workstation PCs',
            specs_cpu: 'Wired USB-A Plug & Play',
            specs_ram: 'LED Optical Tracking',
            specs_storage: 'Wired Cable 1.8m',
            specs_os: 'Windows / Linux / macOS',
            mouse_connectivity: 'Wired USB-A 2.0',
            mouse_sensor_dpi: '1000 DPI Optical',
            mouse_buttons_count: '3 Buttons (Left, Right, Scroll Click)',
            mouse_hand_orientation: 'Ambidextrous',
            purchase_date: '2026-06-01',
            purchase_price: 450.00,
            supplier: 'Silicon Valley Computer Group',
            condition: 'Good',
            status: 'Available',
            remarks: 'Bulk workstation peripheral for IT deployment'
          }
        ]);
        console.log('Inserted 2 sample corporate Computer Mouse assets into database!');
      }
    }

    // Check inventory consumables for Mouse items
    let invCat = await db('inventory_categories')
      .whereRaw('LOWER(name) LIKE ?', ['%peripheral%'])
      .orWhereRaw('LOWER(name) LIKE ?', ['%mouse%'])
      .first();

    if (!invCat) {
      const [catId] = await db('inventory_categories').insert({
        name: 'Computer Peripherals & Accessories',
        description: 'Mice, Keyboards, Adapters, Dongles, and Cable accessories'
      });
      invCat = await db('inventory_categories').where('id', catId).first();
    }

    if (invCat) {
      const existingInvItem = await db('inventory_items').where('category_id', invCat.id).first();
      if (!existingInvItem) {
        await db('inventory_items').insert([
          {
            item_code: 'ACC-MOU-001',
            name: 'Logitech M185 Wireless USB Optical Mouse',
            brand: 'Logitech',
            model: 'M185 Nano',
            category_id: invCat.id,
            unit_of_measure: 'Piece',
            unit_cost: 650.00,
            current_quantity: 15,
            minimum_stock: 5,
            storage_location: 'Shelf B-2 (Peripherals Bin)'
          },
          {
            item_code: 'ACC-PAD-001',
            name: 'Ergonomic Memory Foam Wrist Rest Mouse Pad',
            brand: 'Generic',
            model: 'Comfort Foam Pad',
            category_id: invCat.id,
            unit_of_measure: 'Piece',
            unit_cost: 280.00,
            current_quantity: 20,
            minimum_stock: 8,
            storage_location: 'Shelf B-3 (Accessories Bin)'
          }
        ]);
        console.log('Inserted sample Mouse inventory items into Spare Parts!');
      }
    }

    console.log('Computer Mouse migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Mouse Migration Error:', err);
    process.exit(1);
  }
}

runMouseMigration();
