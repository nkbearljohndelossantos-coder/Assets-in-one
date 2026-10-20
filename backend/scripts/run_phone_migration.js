const db = require('../src/config/db');

async function runPhoneMigration() {
  try {
    console.log('Checking asset_categories table...');
    const existingCategory = await db('asset_categories')
      .whereRaw('LOWER(name) LIKE ?', ['%phone%'])
      .orWhereRaw('LOWER(name) LIKE ?', ['%mobile%'])
      .first();

    if (!existingCategory) {
      await db('asset_categories').insert({
        name: 'Smartphone / Mobile Phone',
        description: 'Corporate mobile phones, smartphones, iPhones, and Android MDM devices'
      });
      console.log('Inserted category: Smartphone / Mobile Phone');
    } else {
      console.log('Phone category already exists:', existingCategory.name);
    }

    const hasImei = await db.schema.hasColumn('assets', 'imei_number');
    if (!hasImei) {
      await db.schema.alterTable('assets', (table) => {
        table.string('imei_number').nullable();
        table.string('phone_number').nullable();
        table.string('sim_carrier').nullable();
        table.boolean('mdm_enrolled').notNullable().defaultTo(false);
        table.string('mdm_device_id').nullable();
      });
      console.log('Added phone spec columns (imei_number, phone_number, sim_carrier, mdm_enrolled, mdm_device_id) to assets table');
    } else {
      console.log('Phone spec columns already exist on assets table');
    }

    // Insert 2 Sample Corporate Phone Assets if none exist
    const phoneCat = await db('asset_categories')
      .whereRaw('LOWER(name) LIKE ?', ['%phone%'])
      .orWhereRaw('LOWER(name) LIKE ?', ['%mobile%'])
      .first();

    if (phoneCat) {
      const existingPhoneAsset = await db('assets').where('category_id', phoneCat.id).first();
      if (!existingPhoneAsset) {
        await db('assets').insert([
          {
            asset_code: 'AST-MOB-0001',
            name: 'Samsung Galaxy A54 5G - Executive Unit',
            category_id: phoneCat.id,
            brand: 'Samsung',
            model: 'Galaxy A54 5G (128GB)',
            serial_number: 'RF8W409X2PK',
            description: 'Corporate Android smartphone assigned for operations management',
            specs_cpu: 'Exynos 1380 (5nm)',
            specs_ram: '8GB RAM',
            specs_storage: '128GB Storage',
            specs_os: 'Android 14 / One UI 6.0',
            imei_number: '358940112938475',
            phone_number: '0917-889-1029',
            sim_carrier: 'Globe Corporate Postpaid',
            mdm_enrolled: true,
            mdm_device_id: 'DEV-MDM-A54-8821',
            purchase_date: '2026-01-15',
            purchase_price: 24500.00,
            supplier: 'Globe Telecom Business',
            condition: 'Good',
            status: 'Assigned',
            remarks: 'Enrolled in NKB Enterprise MDM Work Mode Security'
          },
          {
            asset_code: 'AST-MOB-0002',
            name: 'iPhone 15 Pro (256GB) - Field IT Unit',
            category_id: phoneCat.id,
            brand: 'Apple',
            model: 'iPhone 15 Pro A3102',
            serial_number: 'DNPZ9081048K',
            description: 'Executive iOS device for field IT management',
            specs_cpu: 'Apple A17 Pro',
            specs_ram: '8GB RAM',
            specs_storage: '256GB Storage',
            specs_os: 'iOS 17.4',
            imei_number: '354890129038471',
            phone_number: '0918-992-3049',
            sim_carrier: 'Smart Enterprise Unlimited',
            mdm_enrolled: true,
            mdm_device_id: 'DEV-MDM-IPHONE-9012',
            purchase_date: '2026-02-01',
            purchase_price: 68990.00,
            supplier: 'Beyond the Box Enterprise',
            condition: 'New',
            status: 'Available',
            remarks: 'Prepared for MDM Work Mode deployment'
          }
        ]);
        console.log('Inserted 2 sample corporate phone assets into database!');
      }
    }

    console.log('Phone migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

runPhoneMigration();
