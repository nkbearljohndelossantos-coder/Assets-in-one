const path = require('path');
process.chdir(path.resolve(__dirname, '../backend'));

const db = require('../backend/src/config/db');

async function main() {
  try {
    console.log('--- 1. RUNNING KNEX MIGRATIONS ---');
    const [batchNo, log] = await db.migrate.latest();
    console.log(`Batch ${batchNo} migrated ${log.length} file(s):`);
    log.forEach(file => console.log(`  - ${file}`));

    console.log('\n--- 2. RUNNING KNEX SEEDS ---');
    const [seedFiles] = await db.seed.run();
    console.log(`Executed ${seedFiles.length} seed file(s):`);
    seedFiles.forEach(s => console.log(`  - ${s}`));

    console.log('\n--- 3. VERIFYING CONSOLIDATED SCHEMA ---');
    const tables = await db.raw("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'knex_%' ORDER BY name;");
    console.log(`Total Domain Tables Created: ${tables.length}`);
    tables.forEach(t => console.log(`  - ${t.name}`));

    console.log('\n--- 4. VERIFYING SEEDED DATA ---');
    const userCount = await db('users').count('id as c').first();
    const roleCount = await db('roles').count('id as c').first();
    const permCount = await db('permissions').count('id as c').first();
    const ppeCatCount = await db('ppe_asset_categories').count('id as c').first();
    const ppeAssetCount = await db('ppe_assets').count('id as c').first();
    const ppeGlCount = await db('ppe_gl_accounts').count('id as c').first();
    const ppeJournalCount = await db('ppe_journal_entries').count('id as c').first();
    const ppeContainerCount = await db('ppe_returnable_containers').count('id as c').first();

    console.log(`Users: ${userCount.c}`);
    console.log(`Roles: ${roleCount.c}`);
    console.log(`Permissions: ${permCount.c}`);
    console.log(`PPE Categories: ${ppeCatCount.c}`);
    console.log(`PPE Assets: ${ppeAssetCount.c}`);
    console.log(`PPE GL Accounts: ${ppeGlCount.c}`);
    console.log(`PPE Journal Entries: ${ppeJournalCount.c}`);
    console.log(`PPE Returnable Containers: ${ppeContainerCount.c}`);

    console.log('\nDatabase consolidation and verification SUCCEEDED.');
    process.exit(0);
  } catch (err) {
    console.error('\nDatabase migration/seed FAILED:', err);
    process.exit(1);
  }
}

main();
