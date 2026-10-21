const request = require('supertest');
const crypto = require('crypto');
const { app, server } = require('../src/server');
const db = require('../src/config/db');

let adminToken;
const AGENT_UUID = 'agent-nkb-plant-01';
const AGENT_KEY = 'nkb_agent_test_key_abc1234567890abcdef12345678';
const ROTATED_KEY = 'nkb_agent_rotated_key_fedcba0987654321fedcba09';

beforeAll(async () => {
  await db.migrate.latest();
  await db.seed.run();

  // Seed test hash for the test agent key
  const testHash = crypto.createHash('sha256').update(AGENT_KEY).digest('hex');
  await db('wifi_agent_credentials').where('agent_uuid', AGENT_UUID).update({
    api_key_hash: testHash,
    status: 'Active'
  });
});

afterAll(async () => {
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  await db.destroy();
});

describe('Wi-Fi Device Monitor & Access Control Test Suite', () => {
  // ==========================================
  // 1. ADMIN AUTHENTICATION
  // ==========================================
  describe('Admin Authentication', () => {
    it('should authenticate admin user to access monitor endpoints', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'AdminPassword123!' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      adminToken = res.body.data.accessToken;
    });

    it('should reject unauthenticated requests to wifi monitor endpoints', async () => {
      const res = await request(app).get('/api/wifi-monitor/overview');
      expect(res.statusCode).toBe(401);
    });
  });

  // ==========================================
  // 2. NETWORK AGENT TELEMETRY AUTHENTICATION & REPLAY PROTECTION
  // ==========================================
  describe('On-Premise Network Agent Telemetry Ingestion', () => {
    it('should reject telemetry with missing headers', async () => {
      const res = await request(app)
        .post('/api/wifi-monitor/telemetry')
        .send({ source: 'Test Agent', devices: [] });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED_AGENT');
    });

    it('should reject telemetry with invalid agent key', async () => {
      const now = Date.now();
      const res = await request(app)
        .post('/api/wifi-monitor/telemetry')
        .set('X-Agent-UUID', AGENT_UUID)
        .set('X-Agent-Key', 'wrong_secret_key_1234567890')
        .set('X-Agent-Timestamp', String(now))
        .set('X-Agent-Nonce', 'nonce-test-invalid-key')
        .send({ source: 'Test Agent', devices: [] });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('should reject telemetry with expired timestamp (> 5 minutes skew)', async () => {
      const staleTime = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      const res = await request(app)
        .post('/api/wifi-monitor/telemetry')
        .set('X-Agent-UUID', AGENT_UUID)
        .set('X-Agent-Key', AGENT_KEY)
        .set('X-Agent-Timestamp', String(staleTime))
        .set('X-Agent-Nonce', 'nonce-test-stale')
        .send({ source: 'Test Agent', devices: [] });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('REQUEST_EXPIRED');
    });

    it('should accept valid telemetry from authorized agent', async () => {
      const now = Date.now();
      const nonce = `nonce-${Date.now()}-1`;
      const res = await request(app)
        .post('/api/wifi-monitor/telemetry')
        .set('X-Agent-UUID', AGENT_UUID)
        .set('X-Agent-Key', AGENT_KEY)
        .set('X-Agent-Timestamp', String(now))
        .set('X-Agent-Nonce', nonce)
        .send({
          source: 'On-Premise Network Agent',
          timestamp: now,
          devices: [
            {
              mac: '84:3C:99:A5:A8:10',
              ip: '192.168.254.254',
              hostname: 'globe-modem.lan',
              connectionType: 'LAN (ARP Observed)'
            },
            {
              mac: '7A:12:34:56:78:9A', // Private randomized MAC (2nd bit of first byte is 1 -> 0x7A & 0x02 === 2)
              ip: '192.168.254.105',
              hostname: 'iPhone-14-Pro',
              connectionType: 'LAN (ARP Observed)'
            },
            {
              mac: '00:24:E8:11:22:33', // Dell Inc.
              ip: '192.168.254.120',
              hostname: 'NKB-PROD-PC01',
              connectionType: 'LAN (ARP Observed)'
            }
          ]
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.ingested).toBe(3);
    });

    it('should reject replayed nonce request (replay protection)', async () => {
      const now = Date.now();
      const duplicateNonce = 'nonce-test-duplicate-check';

      // First call -> Success
      const firstRes = await request(app)
        .post('/api/wifi-monitor/telemetry')
        .set('X-Agent-UUID', AGENT_UUID)
        .set('X-Agent-Key', AGENT_KEY)
        .set('X-Agent-Timestamp', String(now))
        .set('X-Agent-Nonce', duplicateNonce)
        .send({ source: 'Test Agent', devices: [] });
      expect(firstRes.statusCode).toBe(200);

      // Second call with same nonce -> 401 REPLAY_DETECTED
      const secondRes = await request(app)
        .post('/api/wifi-monitor/telemetry')
        .set('X-Agent-UUID', AGENT_UUID)
        .set('X-Agent-Key', AGENT_KEY)
        .set('X-Agent-Timestamp', String(now))
        .set('X-Agent-Nonce', duplicateNonce)
        .send({ source: 'Test Agent', devices: [] });
      expect(secondRes.statusCode).toBe(401);
      expect(secondRes.body.error).toBe('REPLAY_DETECTED');
    });

    it('should successfully rotate agent credentials, invalidating old key and accepting new key', async () => {
      const now = Date.now();
      const rotatedHash = crypto.createHash('sha256').update(ROTATED_KEY).digest('hex');

      // Update hash in database (simulates rotation)
      await db('wifi_agent_credentials').where('agent_uuid', AGENT_UUID).update({
        api_key_hash: rotatedHash,
        updated_at: db.fn.now()
      });

      // 1. Old key should now fail with 401 INVALID_CREDENTIALS
      const oldKeyRes = await request(app)
        .post('/api/wifi-monitor/telemetry')
        .set('X-Agent-UUID', AGENT_UUID)
        .set('X-Agent-Key', AGENT_KEY)
        .set('X-Agent-Timestamp', String(now))
        .set('X-Agent-Nonce', `nonce-old-key-${now}`)
        .send({ source: 'Test Agent', devices: [] });

      expect(oldKeyRes.statusCode).toBe(401);
      expect(oldKeyRes.body.error).toBe('INVALID_CREDENTIALS');

      // 2. New rotated key should succeed
      const newKeyRes = await request(app)
        .post('/api/wifi-monitor/telemetry')
        .set('X-Agent-UUID', AGENT_UUID)
        .set('X-Agent-Key', ROTATED_KEY)
        .set('X-Agent-Timestamp', String(now))
        .set('X-Agent-Nonce', `nonce-new-key-${now}`)
        .send({ source: 'Test Agent', devices: [] });

      expect(newKeyRes.statusCode).toBe(200);
      expect(newKeyRes.body.success).toBe(true);
    });

    it('should immediately reject telemetry when an agent credential is revoked', async () => {
      const now = Date.now();

      // Mark agent as Revoked
      await db('wifi_agent_credentials').where('agent_uuid', AGENT_UUID).update({
        status: 'Revoked',
        updated_at: db.fn.now()
      });

      const res = await request(app)
        .post('/api/wifi-monitor/telemetry')
        .set('X-Agent-UUID', AGENT_UUID)
        .set('X-Agent-Key', ROTATED_KEY)
        .set('X-Agent-Timestamp', String(now))
        .set('X-Agent-Nonce', `nonce-revoked-${now}`)
        .send({ source: 'Test Agent', devices: [] });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
      expect(res.body.message).toContain('revoked');

      // Restore Active status for remaining tests
      await db('wifi_agent_credentials').where('agent_uuid', AGENT_UUID).update({
        status: 'Active',
        updated_at: db.fn.now()
      });
    });
  });

  // ==========================================
  // 3. OVERVIEW & DEVICE LISTING
  // ==========================================
  describe('Overview & Device Queries', () => {
    it('should return overview metrics including observed devices and router status', async () => {
      const res = await request(app)
        .get('/api/wifi-monitor/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics.totalObserved).toBeGreaterThanOrEqual(3);
      expect(res.body.data.routers).toBeDefined();
      expect(res.body.data.routers.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.routers[0].capabilities.can_block_clients).toBe(false);
    });

    it('should list monitored devices with correctly identified randomized MACs and OUI vendors', async () => {
      const res = await request(app)
        .get('/api/wifi-monitor/devices')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.devices.length).toBeGreaterThanOrEqual(3);

      const randomizedDevice = res.body.devices.find(d => d.mac_address === '7A:12:34:56:78:9A');
      expect(randomizedDevice).toBeDefined();
      expect(randomizedDevice.is_randomized_mac).toBeTruthy();

      const dellDevice = res.body.devices.find(d => d.mac_address === '00:24:E8:11:22:33');
      expect(dellDevice).toBeDefined();
      expect(dellDevice.vendor).toBe('Dell Inc.');
    });
  });

  // ==========================================
  // 4. TRUSTED INVENTORY LIFECYCLE
  // ==========================================
  describe('Trusted Inventory Lifecycle', () => {
    let createdTrustedId;

    it('should register an unknown device into Trusted Inventory and update classification', async () => {
      const res = await request(app)
        .post('/api/wifi-monitor/trusted')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          macAddress: '00:24:E8:11:22:33',
          deviceName: 'Dell Production PC #1',
          ownerName: 'Juan Dela Cruz',
          department: 'Plant Operations',
          location: 'Building 1 Floor 2',
          deviceType: 'Desktop',
          notes: 'Company-issued workstation verified by IT'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.device_name).toBe('Dell Production PC #1');
      createdTrustedId = res.body.data.id;

      // Verify device classification in monitored devices is updated to TRUSTED
      const devRes = await request(app)
        .get('/api/wifi-monitor/devices?search=00:24:E8:11:22:33')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(devRes.body.devices[0].classification).toBe('TRUSTED');
      expect(devRes.body.devices[0].trusted_name).toBe('Dell Production PC #1');
    });

    it('should list trusted inventory items', async () => {
      const res = await request(app)
        .get('/api/wifi-monitor/trusted')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.inventory.some(i => i.mac_address === '00:24:E8:11:22:33')).toBe(true);
    });

    it('should remove a device from Trusted Inventory and revert classification to UNKNOWN', async () => {
      const res = await request(app)
        .delete(`/api/wifi-monitor/trusted/${createdTrustedId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify classification reverted to UNKNOWN
      const devRes = await request(app)
        .get('/api/wifi-monitor/devices?search=00:24:E8:11:22:33')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(devRes.body.devices[0].classification).toBe('UNKNOWN');
    });
  });

  // ==========================================
  // 5. HARDWARE-ENFORCED ACCESS CONTROL (GLOBE/ZTE ONT)
  // ==========================================
  describe('Access Control Capability Enforcement', () => {
    it('should safely reject block requests on unsupported ZTE ONT and return manual guidance', async () => {
      const res = await request(app)
        .post('/api/wifi-monitor/block')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          macAddress: '7A:12:34:56:78:9A',
          ipAddress: '192.168.254.105',
          reason: 'Unauthorized guest device on plant subnet'
        });

      // Must return 422 Unprocessable Entity
      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.status).toBe('UNSUPPORTED');
      expect(res.body.error).toBe('HARDWARE_UNSUPPORTED');
      expect(res.body.manualGuidance).toBeDefined();
      expect(res.body.manualGuidance.managementUrl).toBe('http://192.168.254.254');
      expect(res.body.manualGuidance.steps.length).toBeGreaterThan(0);
    });

    it('should log the unsupported block attempt in the access audit log', async () => {
      const res = await request(app)
        .get('/api/wifi-monitor/logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const blockLog = res.body.logs.find(l => l.action === 'BLOCK_DEVICE' && l.target_mac === '7A:12:34:56:78:9A');
      expect(blockLog).toBeDefined();
      expect(blockLog.status).toBe('UNSUPPORTED');
      expect(blockLog.details).toContain('Block rejected');
    });
  });
});
