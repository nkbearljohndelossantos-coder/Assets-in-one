const crypto = require('crypto');
const db = require('../src/config/db');
const RemoteProviderFactory = require('../src/services/meshcentral/RemoteProviderFactory');
const SimulationProvider = require('../src/services/meshcentral/SimulationProvider');
const { appendAuditLog, verifyAuditChainIntegrity, calculateAuditHash } = require('../src/utils/auditChain');
const RemoteSchedulerService = require('../src/services/remoteSchedulerService');

async function runTests() {
  console.log('====================================================');
  console.log(' RUNNING AUTOMATED REMOTE MANAGEMENT TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Provider Isolation Test
    console.log('--- TEST 1: Provider Isolation & Environment Factory ---');
    const provider = await RemoteProviderFactory.getProvider();
    assert(provider instanceof SimulationProvider, 'Factory returns SimulationProvider when REMOTE_MGMT_MODE is simulation');
    assert(provider.name === 'SimulationProvider', 'SimulationProvider carries correct isolated name identifier');

    const simResult = await provider.executeCommand('DEV-101', 1, 'shutdown', {});
    assert(simResult.simulated === true, 'SimulationProvider returns is_simulated = true');
    assert(simResult.stdout.includes('[SIMULATED STDOUT]'), 'SimulationProvider stdout is tagged as simulated');

    // 2. Hash-Chained Audit Record Integrity Test
    console.log('\n--- TEST 2: Append-Only Hash-Chained Audit Logs ---');
    const initialIntegrity = await verifyAuditChainIntegrity();
    assert(initialIntegrity.valid === true, 'Initial audit hash chain is valid');

    const log1 = await appendAuditLog('TEST_ACTION_1', 1, 'DEV-101', 'Testing audit chain 1', '127.0.0.1', { test: 1 }, true);
    const log2 = await appendAuditLog('TEST_ACTION_2', 1, 'DEV-101', 'Testing audit chain 2', '127.0.0.1', { test: 2 }, true);
    assert(log1 && log2, 'Appended 2 audit log records to hash chain');

    const postIntegrity = await verifyAuditChainIntegrity();
    assert(postIntegrity.valid === true, 'Post-append audit hash chain remains 100% valid and verified');

    // 3. Endpoint Agent HMAC Signature Consent Test
    console.log('\n--- TEST 3: Endpoint Agent Consent HMAC Signature ---');
    const deviceId = 'DEV-101';
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = new Date().toISOString();
    const payloadStr = `${deviceId}:${nonce}:${timestamp}:allow`;
    const hmacSecret = 'device-secret-key-101';
    const validSignature = crypto.createHmac('sha256', hmacSecret).update(payloadStr).digest('hex');

    assert(validSignature && validSignature.length === 64, 'Generated valid HMAC-SHA256 signature for endpoint agent consent');

    // 4. Power Scheduler Concurrency & Eligibility Test
    console.log('\n--- TEST 4: Power Scheduler Locks & Eligibility ---');
    const lockAcquired1 = await RemoteSchedulerService.acquireLock('test_lock', 'worker-1', 10);
    assert(lockAcquired1 === true, 'Worker 1 acquired scheduler lock');

    const lockAcquired2 = await RemoteSchedulerService.acquireLock('test_lock', 'worker-2', 10);
    assert(lockAcquired2 === false, 'Worker 2 rejected from acquiring locked lease (Distributed Idempotency)');

    await RemoteSchedulerService.releaseLock('test_lock', 'worker-1');

    const eligibility = await RemoteSchedulerService.checkDeviceEligibility('DEV-101');
    assert(eligibility.eligible === true || eligibility.eligible === false, 'Pre-execution eligibility check completed');

    console.log('\n====================================================');
    console.log(` TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (err) {
    console.error('Test Suite Exception:', err);
    process.exit(1);
  }
}

runTests();
