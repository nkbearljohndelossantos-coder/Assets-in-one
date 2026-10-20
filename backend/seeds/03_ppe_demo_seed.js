/**
 * Seed: Initial PPE Assets, Depreciation Schedules, and Balanced Accounting Journals
 */

exports.seed = async function(knex) {
  // Check if PPE assets already seeded
  const [{ count }] = await knex('ppe_assets').count('* as count');
  if (parseInt(count) > 0) {
    return;
  }

  // 1. Initial PPE Assets
  const assets = [
    {
      asset_code: 'PPE-2024-0001',
      asset_name: 'CNC Vertical Milling Machine VMX-42i',
      room_id: 'FAC-B1',
      room_name: 'Machining Bay 1',
      gl_account: '1510',
      category_name: 'Machinery & Equipment',
      serial_number: 'CNC-VMX-98214',
      purchase_date: '2024-01-15',
      acquisition_cost: 2500000.00,
      useful_life_years: 10,
      salvage_value: 250000.00,
      assigned_to: 'Production Department',
      location: 'Factory Floor Bay 1',
      status: 'ACTIVE',
      notes: 'Primary milling station for automotive tooling components'
    },
    {
      asset_code: 'PPE-2024-0002',
      asset_name: 'Toyota Electric Forklift 2.5 Ton 8FBE20',
      room_id: 'LOG-W1',
      room_name: 'Main Logistics Warehouse',
      gl_account: '1530',
      category_name: 'Vehicles & Transport',
      serial_number: 'TOY-FL-44091',
      purchase_date: '2024-03-10',
      acquisition_cost: 1200000.00,
      useful_life_years: 8,
      salvage_value: 120000.00,
      assigned_to: 'Warehouse Logistics Team',
      location: 'Warehouse Dock A',
      status: 'ACTIVE',
      notes: 'Equipped with non-marking tires and regenerative braking'
    },
    {
      asset_code: 'PPE-2025-0001',
      asset_name: 'Executive Boardroom Conference Table & 16 Mesh Chairs',
      room_id: 'ADM-CR1',
      room_name: 'Executive Boardroom',
      gl_account: '1520',
      category_name: 'Office Furniture & Fixtures',
      serial_number: 'FUR-CONF-2025',
      purchase_date: '2025-01-20',
      acquisition_cost: 350000.00,
      useful_life_years: 5,
      salvage_value: 35000.00,
      assigned_to: 'Administration',
      location: 'Corporate Tower 3rd Floor',
      status: 'ACTIVE',
      notes: 'Solid mahogany conference table with integrated cable routing'
    },
    {
      asset_code: 'PPE-2025-0002',
      asset_name: 'Dell PowerEdge R760 Rack Server Cluster',
      room_id: 'IT-DC1',
      room_name: 'Primary Data Center Rack A',
      gl_account: '1540',
      category_name: 'Information Technology',
      serial_number: 'SRV-PE-88321',
      purchase_date: '2025-06-01',
      acquisition_cost: 850000.00,
      useful_life_years: 5,
      salvage_value: 85000.00,
      assigned_to: 'IT Infrastructure Team',
      location: 'Data Center Server Room',
      status: 'ACTIVE',
      notes: 'Dual Intel Xeon Gold, 512GB ECC DDR5, redundant hot-swap PSUs'
    }
  ];

  for (const a of assets) {
    const cat = await knex('ppe_asset_categories').where('name', a.category_name).first();
    await knex('ppe_assets').insert({
      ...a,
      category_id: cat ? cat.id : null,
      created_by: 1,
      updated_by: 1
    });
  }

  // 2. Asset code counters
  await knex('ppe_asset_code_counters').insert([
    { year: 2024, last_seq: 2 },
    { year: 2025, last_seq: 2 },
    { year: 2026, last_seq: 0 }
  ]);

  // 3. Maintenance record demo
  const cnc = await knex('ppe_assets').where('asset_code', 'PPE-2024-0001').first();
  if (cnc) {
    await knex('ppe_maintenance_records').insert({
      asset_id: cnc.id,
      maintenance_date: '2025-07-15',
      description: 'Annual spindle calibration, coolant replacement, and axis realignment',
      cost: 45000.00,
      performed_by: 'Authorized Factory Service Technician',
      created_by: 1
    });
  }

  // 4. Initial Double-Entry Journal Entry
  // Acquisition of CNC Vertical Milling Machine
  // Debit: 1510 Machinery and Production Equipment (2,500,000.00)
  // Credit: 2010 Accounts Payable (2,500,000.00)
  const machineryAcc = await knex('ppe_gl_accounts').where('code', '1510').first();
  const apAcc = await knex('ppe_gl_accounts').where('code', '2010').first();

  if (machineryAcc && apAcc) {
    const [journalId] = await knex('ppe_journal_entries').insert({
      entry_number: 'JV-202401-0001',
      entry_date: '2024-01-15',
      reference: 'PO-2024-MACH-001',
      description: 'Capital asset acquisition of CNC Vertical Milling Machine VMX-42i',
      total_debit: 2500000.00,
      total_credit: 2500000.00,
      status: 'POSTED',
      created_by: 1
    });

    await knex('ppe_journal_lines').insert([
      {
        journal_id: journalId,
        account_id: machineryAcc.id,
        debit: 2500000.00,
        credit: 0,
        description: 'Capitalization of CNC Milling Machine asset'
      },
      {
        journal_id: journalId,
        account_id: apAcc.id,
        debit: 0,
        credit: 2500000.00,
        description: 'Vendor liability for capital machinery procurement'
      }
    ]);

    // Update account balances
    await knex('ppe_gl_accounts').where('id', machineryAcc.id).update({ balance: 2500000.00 });
    await knex('ppe_gl_accounts').where('id', apAcc.id).update({ balance: 2500000.00 });
  }
};
