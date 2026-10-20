const path = require('path');
process.chdir(path.resolve(__dirname, '../backend'));
const db = require('../backend/src/config/db');

async function purgeDemoData() {
  console.log('================================================================');
  console.log('  PURGING DEMO AND SAMPLE RECORDS PERMANENTLY');
  console.log('================================================================\n');

  const trx = await db.transaction();
  try {
    // 1. Purge PPE maintenance records
    const deletedMaint = await trx('ppe_maintenance_records').del();
    console.log(`[PURGE] ppe_maintenance_records deleted: ${deletedMaint}`);

    // 2. Purge PPE journal lines and entries
    const deletedJLines = await trx('ppe_journal_lines').del();
    console.log(`[PURGE] ppe_journal_lines deleted: ${deletedJLines}`);
    const deletedJEntries = await trx('ppe_journal_entries').del();
    console.log(`[PURGE] ppe_journal_entries deleted: ${deletedJEntries}`);

    // 3. Purge PPE assets
    const deletedAssets = await trx('ppe_assets').del();
    console.log(`[PURGE] ppe_assets deleted: ${deletedAssets}`);

    // 4. Purge PPE container movements and containers
    const deletedMovements = await trx('ppe_container_movements').del();
    console.log(`[PURGE] ppe_container_movements deleted: ${deletedMovements}`);
    const deletedContainers = await trx('ppe_returnable_containers').del();
    console.log(`[PURGE] ppe_returnable_containers deleted: ${deletedContainers}`);

    // 5. Reset GL account balances to 0.00 (clean Chart of Accounts)
    const resetGl = await trx('ppe_gl_accounts').update({ balance: 0.00 });
    console.log(`[RESET] ppe_gl_accounts balances reset to 0.00 (rows affected: ${resetGl})`);

    // 6. Reset asset code counters to 0
    const resetCounters = await trx('ppe_asset_code_counters').update({ last_seq: 0 });
    console.log(`[RESET] ppe_asset_code_counters reset to 0 (rows affected: ${resetCounters})`);

    // 7. Reset number sequences to 0
    const resetSeqs = await trx('number_sequences').update({ last_number: 0 });
    console.log(`[RESET] number_sequences reset to 0 (rows affected: ${resetSeqs})`);

    // 8. Delete test users (keep only admin)
    const testUsers = await trx('users').whereNot('username', 'admin').select('id', 'username');
    if (testUsers.length > 0) {
      const testUserIds = testUsers.map(u => u.id);
      await trx('user_roles').whereIn('user_id', testUserIds).del();
      await trx('refresh_tokens').whereIn('user_id', testUserIds).del();
      await trx('users').whereIn('id', testUserIds).del();
      console.log(`[PURGE] Deleted non-admin test users: ${testUsers.map(u => u.username).join(', ')}`);
    }

    await trx.commit();
    console.log('\n[SUCCESS] All demo records permanently removed from database.');

    // Verification
    console.log('\n--- VERIFICATION OF REMAINING RECORDS ---');
    const checkTables = [
      'users', 'roles', 'permissions', 'role_permissions',
      'ppe_asset_categories', 'asset_categories', 'ppe_gl_accounts',
      'ppe_assets', 'ppe_journal_entries', 'ppe_journal_lines',
      'ppe_maintenance_records', 'ppe_returnable_containers', 'ppe_container_movements',
      'assets', 'tickets', 'repairs', 'inventory_items'
    ];
    for (const t of checkTables) {
      const [{ count }] = await db(t).count('* as count');
      console.log(`  ${t.padEnd(28)}: ${count}`);
    }

    process.exit(0);
  } catch (err) {
    await trx.rollback();
    console.error('\n[ERROR] Failed to purge demo data:', err);
    process.exit(1);
  }
}

purgeDemoData();
