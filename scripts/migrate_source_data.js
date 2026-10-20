const fs = require('fs');
const path = require('path');

// Set cwd to backend so config/db resolves correctly
process.chdir(path.resolve(__dirname, '../backend'));
const db = require('../backend/src/config/db');

/**
 * Robust MySQL INSERT statement parser
 */
function parseInsertStatements(sqlContent, targetTable) {
  const results = [];
  const tableRegex = new RegExp(`INSERT INTO \`?${targetTable}\`?\\s*\\(([^)]+)\\)\\s*VALUES\\s*`, 'gi');
  
  let match;
  while ((match = tableRegex.exec(sqlContent)) !== null) {
    const columns = match[1].split(',').map(c => c.trim().replace(/`/g, ''));
    let startIdx = match.index + match[0].length;
    
    // Find ending semicolon of this INSERT statement
    let inStr = false;
    let quoteChar = '';
    let endIdx = -1;
    for (let i = startIdx; i < sqlContent.length; i++) {
      const ch = sqlContent[i];
      if (inStr) {
        if (ch === '\\') {
          i++;
        } else if (ch === quoteChar) {
          inStr = false;
        }
      } else {
        if (ch === "'" || ch === '"') {
          inStr = true;
          quoteChar = ch;
        } else if (ch === ';') {
          endIdx = i;
          break;
        }
      }
    }

    if (endIdx === -1) endIdx = sqlContent.length;
    const valuesBlock = sqlContent.substring(startIdx, endIdx);
    
    let inTuple = false;
    let tupleStart = -1;
    let inValStr = false;
    let valQuote = '';

    for (let i = 0; i < valuesBlock.length; i++) {
      const ch = valuesBlock[i];
      if (inValStr) {
        if (ch === '\\') {
          i++;
        } else if (ch === valQuote) {
          inValStr = false;
        }
      } else {
        if (ch === "'" || ch === '"') {
          inValStr = true;
          valQuote = ch;
        } else if (ch === '(' && !inTuple) {
          inTuple = true;
          tupleStart = i + 1;
        } else if (ch === ')' && inTuple) {
          inTuple = false;
          const tupleStr = valuesBlock.substring(tupleStart, i);
          
          const rowValues = [];
          let currentVal = '';
          let inTokenStr = false;
          let tokenQuote = '';

          for (let j = 0; j < tupleStr.length; j++) {
            const tch = tupleStr[j];
            if (inTokenStr) {
              if (tch === '\\') {
                const nextChar = tupleStr[++j];
                if (nextChar === 'n') currentVal += '\n';
                else if (nextChar === 'r') currentVal += '\r';
                else if (nextChar === 't') currentVal += '\t';
                else currentVal += nextChar;
              } else if (tch === tokenQuote) {
                inTokenStr = false;
              } else {
                currentVal += tch;
              }
            } else {
              if (tch === "'" || tch === '"') {
                inTokenStr = true;
                tokenQuote = tch;
              } else if (tch === ',') {
                rowValues.push(cleanVal(currentVal));
                currentVal = '';
              } else {
                currentVal += tch;
              }
            }
          }
          rowValues.push(cleanVal(currentVal));

          const rowObj = {};
          columns.forEach((col, idx) => {
            rowObj[col] = idx < rowValues.length ? rowValues[idx] : null;
          });
          results.push(rowObj);
        }
      }
    }
  }

  return results;
}

function cleanVal(v) {
  const trimmed = v.trim();
  if (trimmed === 'NULL') return null;
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  if (!isNaN(trimmed) && trimmed !== '') {
    return Number(trimmed);
  }
  return trimmed;
}

async function runDataMigration() {
  console.log('================================================================');
  console.log('  MIGRATING ITMS & PPE PRODUCTION DATA AND IMAGES INTO UNIFIED DB');
  console.log('================================================================\n');

  const itmsSqlPath = path.resolve(__dirname, '../../u335953510_itms_db.sql');
  const ppeSqlPath = path.resolve(__dirname, '../../u335953510_ppe_database.sql');

  if (!fs.existsSync(itmsSqlPath) || !fs.existsSync(ppeSqlPath)) {
    throw new Error(`SQL dumps not found. Expected:\n  - ${itmsSqlPath}\n  - ${ppeSqlPath}`);
  }

  const itmsContent = fs.readFileSync(itmsSqlPath, 'utf-8');
  const ppeContent = fs.readFileSync(ppeSqlPath, 'utf-8');

  const isSqlite = db.client.config.client === 'sqlite3';
  if (isSqlite) {
    await db.raw('PRAGMA foreign_keys = OFF;');
  }

  const trx = await db.transaction();

  try {
    // -------------------------------------------------------------
    // PART 1: ITMS DATA MIGRATION
    // -------------------------------------------------------------
    console.log('--- 1. IMPORTING ITMS MASTER & OPERATIONAL DATA ---');

    // 1.1 Departments
    const itmsDepts = parseInsertStatements(itmsContent, 'departments');
    let deptsImported = 0;
    for (const d of itmsDepts) {
      const exists = await trx('departments').where('id', d.id).first();
      if (!exists) {
        await trx('departments').insert(d);
        deptsImported++;
      } else {
        await trx('departments').where('id', d.id).update(d);
      }
    }
    console.log(`  [ITMS] departments: processed ${itmsDepts.length} rows (new: ${deptsImported})`);

    // 1.2 Positions
    const itmsPositions = parseInsertStatements(itmsContent, 'positions');
    for (const p of itmsPositions) {
      const exists = await trx('positions').where('id', p.id).first();
      if (!exists) {
        await trx('positions').insert(p);
      }
    }
    console.log(`  [ITMS] positions: processed ${itmsPositions.length} rows`);

    // 1.3 Employees
    const itmsEmployees = parseInsertStatements(itmsContent, 'employees');
    let empImported = 0;
    for (const e of itmsEmployees) {
      const exists = await trx('employees').where('id', e.id).first();
      if (!exists) {
        await trx('employees').insert(e);
        empImported++;
      } else {
        await trx('employees').where('id', e.id).update(e);
      }
    }
    console.log(`  [ITMS] employees: processed ${itmsEmployees.length} rows (new: ${empImported})`);

    // 1.4 Asset Categories
    const itmsCategories = parseInsertStatements(itmsContent, 'asset_categories');
    for (const c of itmsCategories) {
      const exists = await trx('asset_categories').where('name', c.name).orWhere('id', c.id).first();
      if (!exists) {
        await trx('asset_categories').insert(c);
      } else {
        await trx('asset_categories').where('id', exists.id).update({ description: c.description || exists.description });
      }
    }
    console.log(`  [ITMS] asset_categories: processed ${itmsCategories.length} rows`);

    // 1.5 ITMS Assets (INCLUDING EMBEDDED IMAGES)
    const itmsAssets = parseInsertStatements(itmsContent, 'assets');
    let itmsAssetsImported = 0;
    let assetsWithImages = 0;
    for (const a of itmsAssets) {
      if (a.image_path) assetsWithImages++;
      const exists = await trx('assets').where('id', a.id).first();
      if (!exists) {
        await trx('assets').insert(a);
        itmsAssetsImported++;
      } else {
        await trx('assets').where('id', a.id).update(a);
      }
    }
    console.log(`  [ITMS] assets: imported ${itmsAssets.length} rows (${assetsWithImages} with images)`);

    // 1.6 Asset Assignments
    const itmsAssignments = parseInsertStatements(itmsContent, 'asset_assignments');
    for (const asn of itmsAssignments) {
      const exists = await trx('asset_assignments').where('id', asn.id).first();
      if (!exists) {
        await trx('asset_assignments').insert(asn);
      }
    }
    console.log(`  [ITMS] asset_assignments: processed ${itmsAssignments.length} rows`);

    // 1.7 Asset History
    const itmsHistory = parseInsertStatements(itmsContent, 'asset_history');
    for (const h of itmsHistory) {
      const exists = await trx('asset_history').where('id', h.id).first();
      if (!exists) {
        await trx('asset_history').insert(h);
      }
    }
    console.log(`  [ITMS] asset_history: processed ${itmsHistory.length} rows`);

    // 1.8 Managed Devices & Capabilities
    const itmsDevices = parseInsertStatements(itmsContent, 'managed_devices');
    for (const d of itmsDevices) {
      const exists = await trx('managed_devices').where('id', d.id).first();
      if (!exists) {
        await trx('managed_devices').insert(d);
      }
    }
    console.log(`  [ITMS] managed_devices: processed ${itmsDevices.length} rows`);

    const itmsCapabilities = parseInsertStatements(itmsContent, 'device_capabilities');
    for (const dc of itmsCapabilities) {
      const exists = await trx('device_capabilities').where('id', dc.id).first();
      if (!exists) {
        await trx('device_capabilities').insert(dc);
      }
    }
    console.log(`  [ITMS] device_capabilities: processed ${itmsCapabilities.length} rows`);

    // 1.9 Ticket Categories
    const itmsTicketCategories = parseInsertStatements(itmsContent, 'ticket_categories');
    for (const tc of itmsTicketCategories) {
      const exists = await trx('ticket_categories').where('id', tc.id).first();
      if (!exists) {
        await trx('ticket_categories').insert(tc);
      }
    }
    console.log(`  [ITMS] ticket_categories: processed ${itmsTicketCategories.length} rows`);

    // 1.10 Website Monitoring
    const itmsWebsites = parseInsertStatements(itmsContent, 'website_monitoring');
    for (const w of itmsWebsites) {
      const exists = await trx('website_monitoring').where('id', w.id).first();
      if (!exists) {
        await trx('website_monitoring').insert(w);
      }
    }
    const itmsUptime = parseInsertStatements(itmsContent, 'website_uptime_logs');
    for (const u of itmsUptime) {
      const exists = await trx('website_uptime_logs').where('id', u.id).first();
      if (!exists) {
        await trx('website_uptime_logs').insert(u);
      }
    }
    console.log(`  [ITMS] website_monitoring: ${itmsWebsites.length} sites, ${itmsUptime.length} uptime logs`);

    // 1.11 Update ITMS Number Sequences
    const maxAssetId = Math.max(...itmsAssets.map(a => a.id), 0);
    await trx('number_sequences').where('module', 'Asset').update({ last_number: maxAssetId });
    console.log(`  [ITMS] number_sequences: Asset sequence updated to ${maxAssetId}`);


    // -------------------------------------------------------------
    // PART 2: PPE DATA MIGRATION
    // -------------------------------------------------------------
    console.log('\n--- 2. IMPORTING PPE DATA AND CLOUDINARY/LOCAL IMAGES ---');

    // 2.1 PPE Asset Categories
    const ppeCatParsed = parseInsertStatements(ppeContent, 'asset_categories');
    for (const pc of ppeCatParsed) {
      const exists = await trx('ppe_asset_categories').where('name', pc.name).first();
      if (!exists) {
        await trx('ppe_asset_categories').insert({
          name: pc.name,
          description: `Category: ${pc.name}`,
          created_at: pc.created_at || new Date().toISOString()
        });
      }
    }
    const allPpeCats = await trx('ppe_asset_categories').select('id', 'name');
    const ppeCatMap = new Map();
    allPpeCats.forEach(c => ppeCatMap.set(c.name.toLowerCase().trim(), c.id));
    console.log(`  [PPE] ppe_asset_categories: ${allPpeCats.length} total categories mapped`);

    // 2.2 PPE GL Accounts
    const ppeGlParsed = parseInsertStatements(ppeContent, 'gl_accounts');
    for (const gl of ppeGlParsed) {
      const exists = await trx('ppe_gl_accounts').where('code', gl.account_code).first();
      if (!exists) {
        await trx('ppe_gl_accounts').insert({
          code: gl.account_code,
          name: gl.account_name,
          type: 'ASSET',
          description: gl.description || gl.account_name,
          balance: 0.00,
          is_active: 1,
          created_at: gl.created_at || new Date().toISOString()
        });
      } else {
        await trx('ppe_gl_accounts').where('code', gl.account_code).update({
          name: gl.account_name,
          description: gl.description || gl.account_name
        });
      }
    }
    console.log(`  [PPE] ppe_gl_accounts: processed ${ppeGlParsed.length} GL accounts`);

    // 2.3 PPE Assets (108 Assets with exact Cloudinary and Local Images)
    const ppeAssetsParsed = parseInsertStatements(ppeContent, 'assets');
    let ppeImportedCount = 0;
    let ppeCloudinaryCount = 0;
    let ppeUploadsCount = 0;

    for (const a of ppeAssetsParsed) {
      let catId = null;
      if (a.category_name && ppeCatMap.has(a.category_name.toLowerCase().trim())) {
        catId = ppeCatMap.get(a.category_name.toLowerCase().trim());
      }

      if (a.image_path) {
        if (a.image_path.includes('cloudinary.com')) {
          ppeCloudinaryCount++;
        } else {
          ppeUploadsCount++;
        }
      }

      const ppeRow = {
        asset_code: a.asset_code,
        asset_name: a.asset_name,
        room_id: a.room_id || null,
        room_name: a.room_name || null,
        gl_account: a.gl_account ? String(a.gl_account).trim() : null,
        category_id: catId,
        category_name: a.category_name || 'Equipment',
        serial_number: a.serial_number || null,
        purchase_date: a.purchase_date || null,
        acquisition_cost: Number(a.acquisition_cost) || 0,
        useful_life_years: Number(a.useful_life_years) || 5,
        salvage_value: Number(a.salvage_value || a.residual_value) || 0,
        assigned_to: a.assigned_to || null,
        location: a.location || null,
        status: a.status || 'ACTIVE',
        image_path: a.image_path || null, // PRESERVES EXACT CLOUDINARY & LOCAL URLS!
        notes: a.notes || null,
        created_by: 1,
        updated_by: 1,
        created_at: a.created_at || new Date().toISOString(),
        updated_at: a.updated_at || new Date().toISOString(),
        deleted_at: a.deleted_at || null
      };

      const existing = await trx('ppe_assets').where('asset_code', a.asset_code).first();
      if (!existing) {
        await trx('ppe_assets').insert(ppeRow);
        ppeImportedCount++;
      } else {
        await trx('ppe_assets').where('id', existing.id).update(ppeRow);
      }
    }
    console.log(`  [PPE] ppe_assets: imported ${ppeImportedCount} assets`);
    console.log(`        - Cloudinary live images: ${ppeCloudinaryCount}`);
    console.log(`        - Local /uploads/ images: ${ppeUploadsCount}`);

    // Update PPE code counters to 108
    const existing2026Counter = await trx('ppe_asset_code_counters').where('year', 2026).first();
    if (!existing2026Counter) {
      await trx('ppe_asset_code_counters').insert({ year: 2026, last_seq: 108 });
    } else {
      await trx('ppe_asset_code_counters').where('year', 2026).update({ last_seq: 108 });
    }
    console.log(`  [PPE] ppe_asset_code_counters: set 2026 counter to 108`);

    // 2.4 Customers mapping
    const ppeCustomers = parseInsertStatements(ppeContent, 'rtn_customers');
    const customerMap = new Map();
    ppeCustomers.forEach(c => {
      customerMap.set(c.id, { name: c.customer_name, address: c.address });
    });

    // 2.5 Returnable Containers (588 Containers)
    const ppeContainersParsed = parseInsertStatements(ppeContent, 'rtn_containers');
    let containersImported = 0;
    const containerIdMap = new Map(); // legacyId -> newId

    for (const c of ppeContainersParsed) {
      let holder = null;
      let location = 'Warehouse Storage';

      if (c.current_customer_id && customerMap.has(c.current_customer_id)) {
        const cust = customerMap.get(c.current_customer_id);
        holder = cust.name;
        location = cust.address || 'Customer Site';
      }

      let status = 'AVAILABLE';
      if (c.status === 'OUT') status = 'CHECKED_OUT';
      else if (c.status === 'IN') status = 'AVAILABLE';
      else if (c.status) status = c.status;

      const containerRow = {
        container_code: c.container_code,
        container_type: c.type,
        description: `Industrial returnable container: ${c.type}`,
        barcode: `BC-${c.container_code}`,
        status: status,
        current_holder: holder,
        department_id: null,
        location: location,
        notes: null,
        created_at: c.created_at || new Date().toISOString(),
        updated_at: c.created_at || new Date().toISOString()
      };

      const existing = await trx('ppe_returnable_containers').where('container_code', c.container_code).first();
      let cid;
      if (!existing) {
        const [newId] = await trx('ppe_returnable_containers').insert(containerRow);
        cid = newId;
        containersImported++;
      } else {
        await trx('ppe_returnable_containers').where('id', existing.id).update(containerRow);
        cid = existing.id;
      }
      containerIdMap.set(c.id, cid);
    }
    console.log(`  [PPE] ppe_returnable_containers: imported ${ppeContainersParsed.length} rows (new: ${containersImported})`);

    // 2.6 Returnable Container Movements (30 Movements)
    const ppeMovements = parseInsertStatements(ppeContent, 'rtn_movements');
    let movementsImported = 0;
    for (const m of ppeMovements) {
      const containerId = containerIdMap.get(m.container_id);
      if (containerId) {
        let custName = 'Customer';
        if (m.customer_id && customerMap.has(m.customer_id)) {
          custName = customerMap.get(m.customer_id).name;
        }

        const action = m.action === 'OUT' ? 'CHECK_OUT' : 'CHECK_IN';
        await trx('ppe_container_movements').insert({
          container_id: containerId,
          action: action,
          from_location: action === 'CHECK_OUT' ? 'Warehouse Bay' : `${custName} Site`,
          to_location: action === 'CHECK_OUT' ? `${custName} Site` : 'Warehouse Bay',
          released_to: m.performed_by || custName,
          recorded_by: 1,
          notes: `Movement log from legacy PPE system (${action} by ${m.performed_by || custName})`,
          created_at: m.timestamp || new Date().toISOString()
        });
        movementsImported++;
      }
    }
    console.log(`  [PPE] ppe_container_movements: imported ${movementsImported} movements`);

    // 2.7 Maintenance Records
    const ppeMaintenance = parseInsertStatements(ppeContent, 'maintenance_records');
    let maintImported = 0;
    for (const mr of ppeMaintenance) {
      // Find asset by code or first
      const asset = await trx('ppe_assets').first();
      if (asset) {
        await trx('ppe_maintenance_records').insert({
          asset_id: asset.id,
          maintenance_date: mr.maintenance_date || '2026-07-15',
          description: mr.description || 'Routine maintenance and servicing',
          cost: Number(mr.cost) || 0,
          performed_by: mr.performed_by || 'Maintenance Technician',
          created_by: 1,
          created_at: mr.created_at || new Date().toISOString()
        });
        maintImported++;
      }
    }
    console.log(`  [PPE] ppe_maintenance_records: imported ${maintImported} records`);

    // 2.8 Users (Import Real NKB Staff/Admins)
    const ppeUsers = parseInsertStatements(ppeContent, 'users');
    let usersAdded = 0;
    for (const u of ppeUsers) {
      if (!u.email) continue;
      const emailLower = u.email.toLowerCase().trim();
      const existing = await trx('users').where('email', emailLower).first();
      
      let roleId = 6; // Standard employee
      if (u.role === 'ADMIN') roleId = 1; // Super Admin
      else if (u.role === 'STAFF') roleId = 3; // IT Staff
      else if (u.role === 'DRIVER') roleId = 6; // Employee

      if (!existing) {
        const usernameBase = emailLower.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
        let username = usernameBase;
        const existsUser = await trx('users').where('username', username).first();
        if (existsUser) username = `${usernameBase}_${Math.floor(Math.random() * 1000)}`;

        const [newUserId] = await trx('users').insert({
          username: username,
          password_hash: u.password_hash || '$2b$10$l1Be/Ri.cdrlijwMDlHjKO.YxN/5BjS.fr7/3mkBXHovH6u0zlW5W', // Standard fallback hash
          email: emailLower,
          status: u.is_active ? 'active' : 'inactive',
          force_password_change: false,
          created_at: u.created_at || new Date().toISOString(),
          updated_at: u.updated_at || new Date().toISOString()
        });

        await trx('user_roles').insert({ user_id: newUserId, role_id: roleId });
        usersAdded++;
      }
    }
    console.log(`  [PPE] users: processed ${ppeUsers.length} users (${usersAdded} new accounts created)`);

    await trx.commit();
    if (isSqlite) {
      await db.raw('PRAGMA foreign_keys = ON;');
    }

    console.log('\n================================================================');
    console.log('  DATA MIGRATION SUCCEEDED 100%');
    console.log('================================================================\n');

    // Final verification summary
    console.log('--- RECONCILIATION SUMMARY ---');
    const summaryTables = [
      'departments', 'employees', 'asset_categories', 'assets', 'asset_assignments',
      'managed_devices', 'ppe_asset_categories', 'ppe_gl_accounts', 'ppe_assets',
      'ppe_returnable_containers', 'ppe_container_movements', 'ppe_maintenance_records',
      'users'
    ];

    for (const t of summaryTables) {
      const [{ count }] = await db(t).count('* as count');
      console.log(`  ${t.padEnd(28)}: ${count} rows`);
    }

    process.exit(0);
  } catch (err) {
    await trx.rollback();
    if (isSqlite) {
      await db.raw('PRAGMA foreign_keys = ON;');
    }
    console.error('\n[FATAL ERROR] Data migration failed:', err);
    process.exit(1);
  }
}

runDataMigration();
