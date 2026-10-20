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

  // 4. Returnable Containers (Demo sample entries removed for production)
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
