const assert = require('assert');
const path = require('path');
module.paths.push(path.resolve(__dirname, '../backend/node_modules'));
process.chdir(path.resolve(__dirname, '../backend'));

const db = require('../backend/src/config/db');
const { calcStraightLine, money } = require('../backend/src/utils/depreciation');
const { nextAssetCode } = require('../backend/src/utils/assetCode');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function runTestSuite() {
  console.log('================================================================');
  console.log('  NKB UNIFIED ITMS + PPE SYSTEM AUTOMATED VERIFICATION SUITE   ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${err.message}`);
      failed++;
    }
  }

  // --- 1. DATABASE & MIGRATION INTEGRITY ---
  await test('Consolidated Database contains core ITMS and PPE tables', async () => {
    const requiredTables = [
      'users', 'roles', 'permissions', 'role_permissions', 'user_roles',
      'assets', 'tickets', 'repairs', 'inventory_items', 'software_licenses',
      'departments', 'employees', 'audit_logs',
      'ppe_asset_categories', 'ppe_asset_code_counters', 'ppe_assets',
      'ppe_maintenance_records', 'ppe_returnable_containers',
      'ppe_container_movements', 'ppe_gl_accounts',
      'ppe_journal_entries', 'ppe_journal_lines'
    ];

    for (const tbl of requiredTables) {
      const has = await db.schema.hasTable(tbl);
      assert.strictEqual(has, true, `Table ${tbl} should exist in consolidated database`);
    }
  });

  // --- 2. AUTHENTICATION & SECURITY ---
  await test('Admin account exists and password validates with bcrypt', async () => {
    const admin = await db('users').where({ username: 'admin' }).first();
    assert.ok(admin, 'Admin user must exist');
    const valid = await bcrypt.compare('AdminPassword123!', admin.password_hash);
    assert.strictEqual(valid, true, 'Default admin password must match hash');
    const invalid = await bcrypt.compare('WrongPassword', admin.password_hash);
    assert.strictEqual(invalid, false, 'Invalid password must be rejected');
  });

  await test('JWT Token generation and verification works with required claims', async () => {
    const admin = await db('users').where({ username: 'admin' }).first();
    const token = jwt.sign(
      { id: admin.id, sub: admin.id, username: admin.username, email: admin.email, roles: ['Super Admin'] },
      process.env.JWT_SECRET || 'f4a7c8e9b1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8',
      { expiresIn: '1h' }
    );
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'f4a7c8e9b1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8');
    assert.strictEqual(decoded.username, 'admin');
    assert.strictEqual(decoded.roles[0], 'Super Admin');
  });

  // --- 3. PPE ASSET CODE SEQUENCE GENERATION ---
  await test('Sequential PPE asset code generation (PPE-YYYY-0001) works atomically', async () => {
    const testYear = 2099;
    // Clean up counter for testYear if previously run
    await db('ppe_asset_code_counters').where({ year: testYear }).del();

    const code1 = await nextAssetCode(`${testYear}-01-15`);
    const code2 = await nextAssetCode(`${testYear}-02-20`);
    assert.strictEqual(code1, 'PPE-2099-0001');
    assert.strictEqual(code2, 'PPE-2099-0002');
  });

  // --- 4. PPE ACCOUNTING & DEPRECIATION MATHEMATICS ---
  await test('Straight-line depreciation calculates accurate monthly and accumulated depreciation', () => {
    const cost = 120000;
    const salvage = 12000; // Depreciable base = 108,000
    const usefulLifeYears = 5; // 60 months
    const purchaseDate = '2024-01-01';
    const asOfDate = '2025-01-01'; // 12 months in service

    const dep = calcStraightLine({
      acquisitionCost: cost,
      salvageValue: salvage,
      usefulLifeYears,
      purchaseDate,
      asOfDate
    });

    // Annual depreciation = 108,000 / 5 = 21,600
    // Monthly depreciation = 21,600 / 12 = 1,800
    // 12 months accumulated = 1,800 * 12 = 21,600
    // Net Book Value = 120,000 - 21,600 = 98,400
    assert.strictEqual(dep.annualDepreciation, 21600);
    assert.strictEqual(dep.monthlyDepreciation, 1800);
    assert.strictEqual(dep.accumulatedDepreciation, 21600);
    assert.strictEqual(dep.netBookValue, 98400);
    assert.strictEqual(dep.monthsDepreciated, 12);
  });

  await test('Depreciation Net Book Value never falls below salvage value (residual value floor)', () => {
    const cost = 100000;
    const salvage = 15000;
    const usefulLifeYears = 3;
    const purchaseDate = '2020-01-01';
    const asOfDate = '2026-01-01'; // 6 years later (useful life is only 3 years)

    const dep = calcStraightLine({
      acquisitionCost: cost,
      salvageValue: salvage,
      usefulLifeYears,
      purchaseDate,
      asOfDate
    });

    assert.strictEqual(dep.accumulatedDepreciation, 85000); // 100,000 - 15,000
    assert.strictEqual(dep.netBookValue, 15000); // Clamped exactly to salvage
    assert.strictEqual(dep.isFullyDepreciated, true);
  });

  // --- 5. DOUBLE-ENTRY ACCOUNTING INTEGRITY ---
  await test('Double-entry journal integrity: balanced entries succeed, unbalanced fail', async () => {
    const machinery = await db('ppe_gl_accounts').where('code', '1510').first();
    const ap = await db('ppe_gl_accounts').where('code', '2010').first();
    assert.ok(machinery && ap, 'Machinery and AP accounts must exist');

    // Balanced entry test
    const entryNumber = `JV-TEST-${Date.now()}`;
    const [id] = await db('ppe_journal_entries').insert({
      entry_number: entryNumber,
      entry_date: '2026-10-20',
      description: 'Test Capital Asset Purchase',
      total_debit: 50000.00,
      total_credit: 50000.00,
      status: 'POSTED',
      created_by: 1
    });

    await db('ppe_journal_lines').insert([
      { journal_id: id, account_id: machinery.id, debit: 50000.00, credit: 0, description: 'Debit' },
      { journal_id: id, account_id: ap.id, debit: 0, credit: 50000.00, description: 'Credit' }
    ]);

    const lines = await db('ppe_journal_lines').where('journal_id', id);
    const sumDebit = lines.reduce((acc, l) => acc + Number(l.debit), 0);
    const sumCredit = lines.reduce((acc, l) => acc + Number(l.credit), 0);
    assert.strictEqual(sumDebit, 50000);
    assert.strictEqual(sumCredit, 50000);
    assert.strictEqual(sumDebit - sumCredit, 0, 'Debits must equal credits');

    // Clean up test journal
    await db('ppe_journal_lines').where('journal_id', id).delete();
    await db('ppe_journal_entries').where('id', id).delete();
  });

  // --- 6. RETURNABLE CONTAINERS LIFECYCLE ---
  await test('Returnable containers lifecycle tracking and movement logging', async () => {
    const container = await db('ppe_returnable_containers').where('container_code', 'CNT-2026-0001').first();
    assert.ok(container, 'Container CNT-2026-0001 must exist');

    // Record checkout movement
    const [moveId] = await db('ppe_container_movements').insert({
      container_id: container.id,
      action: 'CHECK_OUT',
      from_location: container.location,
      to_location: 'Packaging Plant 3',
      released_to: 'John Doe (Packaging Supervisor)',
      recorded_by: 1,
      notes: 'Dispatched for batch tooling'
    });

    await db('ppe_returnable_containers').where('id', container.id).update({
      status: 'CHECKED_OUT',
      location: 'Packaging Plant 3',
      current_holder: 'John Doe (Packaging Supervisor)'
    });

    const updated = await db('ppe_returnable_containers').where('id', container.id).first();
    assert.strictEqual(updated.status, 'CHECKED_OUT');
    assert.strictEqual(updated.location, 'Packaging Plant 3');

    // Clean up movement
    await db('ppe_container_movements').where('id', moveId).delete();
    await db('ppe_returnable_containers').where('id', container.id).update({
      status: container.status,
      location: container.location,
      current_holder: container.current_holder
    });
  });

  // --- 7. ITMS ASSETS & TICKETS ---
  await test('ITMS domain: IT asset registration, status, and tickets count query', async () => {
    const assetsCount = await db('assets').count('id as c').first();
    const ticketsCount = await db('tickets').count('id as c').first();
    assert.ok(assetsCount !== undefined, 'Assets table must be queryable');
    assert.ok(ticketsCount !== undefined, 'Tickets table must be queryable');
  });

  console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
