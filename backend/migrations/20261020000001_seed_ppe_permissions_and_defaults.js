/**
 * Migration: Seed PPE Permissions, Categories, Chart of Accounts, and Initial Data
 */

exports.up = async function(knex) {
  // 1. PPE Permissions
  const ppePermissions = [
    { code: 'ppe.view', name: 'View PPE Assets', description: 'Allows viewing property, plant & equipment assets and details' },
    { code: 'ppe.create', name: 'Create PPE Assets', description: 'Allows registering new capital assets and generating PPE codes' },
    { code: 'ppe.update', name: 'Update PPE Assets', description: 'Allows editing asset specs, GL accounts, and locations' },
    { code: 'ppe.delete', name: 'Delete PPE Assets', description: 'Allows soft-deleting retired PPE records' },
    { code: 'ppe.depreciate', name: 'Calculate Depreciation', description: 'Allows viewing and recalculating asset depreciation schedules and NBV' },
    { code: 'ppe.maintenance', name: 'Manage PPE Maintenance', description: 'Allows logging and viewing equipment maintenance logs' },
    { code: 'ppe.containers', name: 'Returnable Containers', description: 'Allows tracking returnable containers and logging movements' },
    { code: 'ppe.accounting', name: 'Manage Accounting Journals', description: 'Allows viewing Chart of Accounts and posting double-entry journals' },
    { code: 'ppe.reports', name: 'Export PPE Reports', description: 'Allows exporting asset registers to Excel/PDF and printing QR labels' },
  ];

  for (const perm of ppePermissions) {
    let permId;
    const existing = await knex('permissions').where({ code: perm.code }).first();
    if (!existing) {
      const [id] = await knex('permissions').insert(perm);
      permId = typeof id === 'object' ? id.id : id;
    } else {
      permId = existing.id;
    }

    // Role mapping:
    // Super Admin (1) gets all
    const rolesToAssign = [1];
    // IT Manager (2)
    rolesToAssign.push(2);
    // IT Staff (3)
    if (!['ppe.delete', 'ppe.accounting'].includes(perm.code)) rolesToAssign.push(3);
    // Auditor (7)
    if (['ppe.view', 'ppe.depreciate', 'ppe.accounting', 'ppe.reports'].includes(perm.code)) rolesToAssign.push(7);
    // Department Head (5)
    if (['ppe.view', 'ppe.containers', 'ppe.reports'].includes(perm.code)) rolesToAssign.push(5);

    for (const roleId of rolesToAssign) {
      const roleExists = await knex('roles').where({ id: roleId }).first();
      if (roleExists) {
        const rp = await knex('role_permissions').where({ role_id: roleId, permission_id: permId }).first();
        if (!rp) {
          await knex('role_permissions').insert({ role_id: roleId, permission_id: permId });
        }
      }
    }
  }

  // 2. Default PPE Categories
  const categories = [
    { name: 'Machinery & Equipment', description: 'Heavy machinery, factory equipment, and assembly tools' },
    { name: 'Office Furniture & Fixtures', description: 'Desks, chairs, cabinets, conference tables, and partitions' },
    { name: 'Information Technology', description: 'Servers, networking racks, workstations, and high-value IT equipment' },
    { name: 'Vehicles & Transport', description: 'Company delivery trucks, forklifts, and service vans' },
    { name: 'Returnable Containers', description: 'High-grade chemical totes, steel drums, gas cylinders, and industrial crates' }
  ];

  for (const cat of categories) {
    const existing = await knex('ppe_asset_categories').where({ name: cat.name }).first();
    if (!existing) {
      await knex('ppe_asset_categories').insert(cat);
    }
  }

  // 3. Default Chart of Accounts (GL Accounts)
  const glAccounts = [
    { code: '1010', name: 'Cash and Cash Equivalents', type: 'ASSET', description: 'Bank and liquid cash balances' },
    { code: '1500', name: 'Property, Plant and Equipment', type: 'ASSET', description: 'Control account for capitalized tangible assets' },
    { code: '1510', name: 'Machinery and Production Equipment', type: 'ASSET', description: 'Factory machinery, machining tools, and assembly lines' },
    { code: '1520', name: 'Office Furniture and Equipment', type: 'ASSET', description: 'Office fixtures, ergonomic chairs, conference amenities' },
    { code: '1530', name: 'Vehicles and Transport Equipment', type: 'ASSET', description: 'Fleet delivery vehicles, shuttles, and forklifts' },
    { code: '1540', name: 'IT Infrastructure and Hardware', type: 'ASSET', description: 'Enterprise servers, storage arrays, core network switches' },
    { code: '1590', name: 'Accumulated Depreciation - PPE', type: 'ASSET', description: 'Contra-asset account tracking cumulative depreciation' },
    { code: '2010', name: 'Accounts Payable', type: 'LIABILITY', description: 'Vendor payables for asset procurement and services' },
    { code: '6500', name: 'Depreciation Expense - PPE', type: 'EXPENSE', description: 'Monthly and annual depreciation charges' },
    { code: '6510', name: 'Maintenance & Repairs Expense', type: 'EXPENSE', description: 'Routine servicing, spare part replacement, and repairs' }
  ];

  for (const acc of glAccounts) {
    const existing = await knex('ppe_gl_accounts').where({ code: acc.code }).first();
    if (!existing) {
      await knex('ppe_gl_accounts').insert(acc);
    }
  }

  // 4. Returnable Containers sample entries
  const containers = [
    { container_code: 'CNT-2026-0001', container_type: 'Steel Drum 200L', description: 'Reinforced 200L steel storage drum for chemical solvents', barcode: 'BC-CNT-001', status: 'AVAILABLE', location: 'Warehouse A - Chemical Bay' },
    { container_code: 'CNT-2026-0002', container_type: 'IBC Tote 1000L', description: '1000L intermediate bulk container on galvanized steel pallet', barcode: 'BC-CNT-002', status: 'CHECKED_OUT', current_holder: 'Production Line 2', location: 'Factory Floor Bay 4' },
    { container_code: 'CNT-2026-0003', container_type: 'Heavy Industrial Crate', description: 'High-density polyethylene returnable transport crate', barcode: 'BC-CNT-003', status: 'IN_TRANSIT', current_holder: 'Logistics Courier', location: 'Transit to Plant B' },
    { container_code: 'CNT-2026-0004', container_type: 'Gas Cylinder 50L', description: 'High pressure argon gas industrial cylinder', barcode: 'BC-CNT-004', status: 'AVAILABLE', location: 'Gas Storage Facility' }
  ];

  for (const c of containers) {
    const existing = await knex('ppe_returnable_containers').where({ container_code: c.container_code }).first();
    if (!existing) {
      const [newId] = await knex('ppe_returnable_containers').insert(c);
      const containerId = typeof newId === 'object' ? newId.id : newId;
      // Add initial check-in movement
      await knex('ppe_container_movements').insert({
        container_id: containerId,
        action: 'CHECK_IN',
        from_location: 'Supplier Intake',
        to_location: c.location,
        released_to: c.current_holder || 'Inventory Custodian',
        notes: 'Initial registration and quality check'
      });
    }
  }
};

exports.down = async function(knex) {
  // Remove seeded PPE permissions
  const codes = [
    'ppe.view', 'ppe.create', 'ppe.update', 'ppe.delete',
    'ppe.depreciate', 'ppe.maintenance', 'ppe.containers',
    'ppe.accounting', 'ppe.reports'
  ];
  await knex('role_permissions')
    .whereIn('permission_id', knex('permissions').select('id').whereIn('code', codes))
    .delete();
  await knex('permissions').whereIn('code', codes).delete();
};
