const request = require('supertest');
const { app, server } = require('../src/server');
const db = require('../src/config/db');

let token;
let createdPrinterId;
let createdGuestWifiId;

// Initialize testing database schema and seeds
beforeAll(async () => {
  await db.migrate.latest();
  await db.seed.run();
});

// Cleanup server and database connections after tests
afterAll(async () => {
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  await db.destroy();
});

describe('NKB ITMS Additional Modules Integration Test Suite', () => {

  describe('Authentication & Setup', () => {
    it('should login successfully with default seeded admin credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'AdminPassword123!' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      token = res.body.data.accessToken;
    });

    it('should block unauthenticated access to new modules', async () => {
      const res = await request(app).get('/api/printers');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('IP/MAC Conflict Triggers & Uniqueness', () => {
    it('should create a printer with a unique IP and MAC address', async () => {
      const res = await request(app)
        .post('/api/printers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          printer_name: 'Test Network Printer',
          brand: 'HP',
          model: 'LaserJet',
          ip_address: '192.168.1.150',
          mac_address: '00:11:22:33:44:55',
          status: 'Online'
        });

      expect(res.statusCode).toBe(201);
      createdPrinterId = res.body.id;
    });

    it('should fail to create a second active printer with the same IP address', async () => {
      const res = await request(app)
        .post('/api/printers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          printer_name: 'Test Network Printer 2',
          brand: 'Canon',
          model: 'Pixma',
          ip_address: '192.168.1.150', // Duplicate IP
          mac_address: 'AA:BB:CC:DD:EE:FF',
          status: 'Online'
        });

      // Should be rejected by DB constraint or Service layer logic
      expect(res.statusCode).not.toBe(201);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('Encryption Keys & Guest WiFi Expirations', () => {
    it('should create a Guest WiFi account and encrypt the password', async () => {
      const res = await request(app)
        .post('/api/guest-wifi')
        .set('Authorization', `Bearer ${token}`)
        .send({
          guest_name: 'John Doe',
          wifi_username: 'guest_john',
          wifi_password: 'SuperSecretPassword123!',
          start_date: '2026-07-18T08:00:00.000Z',
          expiration_date: '2026-07-25T17:00:00.000Z', // 7 days expiration
          status: 'Active'
        });

      expect(res.statusCode).toBe(201);
      createdGuestWifiId = res.body.id;

      // Verify it was stored encrypted in DB
      const dbRecord = await db('guest_wifi_accounts').where({ id: createdGuestWifiId }).first();
      expect(dbRecord.wifi_password_ciphertext).toBeDefined();
      expect(dbRecord.wifi_password_ciphertext).not.toBe('SuperSecretPassword123!');
      expect(dbRecord.wifi_password_iv).toBeDefined();
    });

    it('should decrypt the password when requested via secrets API', async () => {
      const res = await request(app)
        .post('/api/secrets/reveal')
        .set('Authorization', `Bearer ${token}`)
        .send({
          module: 'GuestWifi',
          recordId: createdGuestWifiId,
          reason: 'Testing decryption'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.secret).toBe('SuperSecretPassword123!');
    });
  });

  describe('Soft Deletion Integrity', () => {
    it('should soft delete the printer and not remove it entirely', async () => {
      // Delete via API
      const delRes = await request(app)
        .delete(`/api/printers/${createdPrinterId}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(delRes.statusCode).toBe(204);

      // Verify it is not in the active API GET response
      const getRes = await request(app)
        .get('/api/printers')
        .set('Authorization', `Bearer ${token}`);
      
      const foundInApi = getRes.body.printers.some(p => p.id === createdPrinterId);
      expect(foundInApi).toBe(false);

      // Verify it STILL EXISTS in the database with a deleted_at timestamp
      const dbRecord = await db('printers').where({ id: createdPrinterId }).first();
      expect(dbRecord).toBeDefined();
      expect(dbRecord.deleted_at).not.toBeNull();
    });
  });

});
