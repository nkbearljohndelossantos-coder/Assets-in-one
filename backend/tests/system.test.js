const request = require('supertest');
const { app, server } = require('../src/server');
const db = require('../src/config/db');

let token;
let createdAssetId;
let createdAssignmentId;
let createdTicketId;
let createdPartId;
let createdRepairId;
let createdLicenseId;

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

describe('NKB ITMS System Integration Test Suite', () => {

  // ==========================================
  // 1. LOGIN TESTS
  // ==========================================
  describe('Authentication API', () => {
    it('should fail login with incorrect credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'WrongPassword!' });
      
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should login successfully with default seeded admin credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'AdminPassword123!' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      token = res.body.data.accessToken;
    });

    it('should verify authentication middleware with a profile call', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe('admin');
    });
  });

  // ==========================================
  // 2. ASSETS CRUD TESTS
  // ==========================================
  describe('IT Assets Registry API', () => {
    it('should create a new workstation asset profile', async () => {
      const res = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Developer Testing Workstation',
          category_id: '1', // Desktops
          brand: 'Lenovo',
          model: 'ThinkCentre M70q',
          serial_number: 'SN-TEST-998877',
          condition: 'New',
          specs_cpu: 'i7-12700',
          specs_ram: '16GB',
          specs_storage: '512GB SSD',
          specs_os: 'Windows 11',
          purchase_price: 45000,
          purchase_date: '2026-07-18'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      createdAssetId = res.body.data.id;
    });

    it('should fetch the assets register list containing the new workstation', async () => {
      const res = await request(app)
        .get('/api/assets')
        .set('Authorization', `Bearer ${token}`)
        .query({ search: 'SN-TEST-998877' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assets.length).toBeGreaterThan(0);
      expect(res.body.data.assets[0].name).toBe('Developer Testing Workstation');
    });
  });

  // ==========================================
  // 3. CUSTODY ASSIGNMENT FLOWS
  // ==========================================
  describe('IT Custody Assignments API', () => {
    it('should assign the workstation to Employee 1', async () => {
      const res = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          assetId: createdAssetId,
          employeeId: 1,
          dateAssigned: '2026-07-18',
          releaseCondition: 'Good',
          remarks: 'Assigned for testing'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      createdAssignmentId = res.body.data.id;
    });

    it('should confirm asset status is updated to Assigned', async () => {
      const res = await request(app)
        .get(`/api/assets/${createdAssetId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.data.asset.status).toBe('Assigned');
    });

    it('should return the workstation to storage', async () => {
      const res = await request(app)
        .post(`/api/assignments/${createdAssignmentId}/return`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          actualReturnDate: '2026-07-18',
          returnCondition: 'Good',
          assetStatus: 'Available',
          remarks: 'Returned clean'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should confirm asset status reverted to Available after return', async () => {
      const res = await request(app)
        .get(`/api/assets/${createdAssetId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.data.asset.status).toBe('Available');
    });
  });

  // ==========================================
  // 4. HELP DESK TICKETS
  // ==========================================
  describe('Help Desk Tickets API', () => {
    it('should file a support ticket', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          categoryId: '1', // Desktop support
          subject: 'Screen flickering on desk unit',
          description: 'The LCD screen is flickering on full brightness.',
          priority: 'High'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      createdTicketId = res.body.data.id;
    });

    it('should allow IT managers to assign a technician', async () => {
      const res = await request(app)
        .post(`/api/tickets/${createdTicketId}/assign`)
        .set('Authorization', `Bearer ${token}`)
        .send({ technicianId: 1 }); // Seeded user admin

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // 5. REPAIRS & SPARE PARTS DEPRECIATION
  // ==========================================
  describe('Hardware Repairs & Parts Allocation', () => {
    it('should register a spare part SKU in inventory catalog', async () => {
      const res = await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Kingston DDR4 8GB RAM Stick',
          item_code: 'RAM-KNG-D48G',
          category_id: '1', // Seeded categories
          brand: 'Kingston',
          model: 'ValueRAM DDR4',
          unit_of_measure: 'pcs',
          reorder_level: 2,
          unit_cost: 1500
        });

      expect(res.statusCode).toBe(200);
      createdPartId = res.body.data.id;
    });

    it('should stock-in 5 sticks of RAM in inventory', async () => {
      const res = await request(app)
        .post(`/api/inventory/${createdPartId}/stock-in`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          quantity: 5,
          unitCost: 1500,
          remarks: 'Received spare parts stock.'
        });

      expect(res.statusCode).toBe(200);
    });

    it('should create an asset repair log', async () => {
      const res = await request(app)
        .post('/api/repairs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          assetId: createdAssetId,
          ticketId: createdTicketId,
          dateReceived: '2026-07-18',
          reportedIssue: 'Defective RAM causing BSODs',
          laborCost: 500,
          externalServiceCost: 0
        });

      expect(res.statusCode).toBe(200);
      createdRepairId = res.body.data.id;
    });

    it('should allocate 1 RAM stick to the repair, decreasing stock and raising repair cost', async () => {
      // 1. Allocate part
      const allocateRes = await request(app)
        .post(`/api/repairs/${createdRepairId}/parts`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          inventoryItemId: createdPartId,
          quantity: 1
        });

      expect(allocateRes.statusCode).toBe(200);

      // 2. Read inventory quantity
      const invRes = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${token}`)
        .query({ search: 'Kingston' });
      
      // Stock should have decreased from 5 to 4
      expect(invRes.body.data.items[0].current_quantity).toBe(4);

      // 3. Read repair total cost
      const repRes = await request(app)
        .get(`/api/repairs/${createdRepairId}`)
        .set('Authorization', `Bearer ${token}`);
      
      // Cost should include labor (500) + 1 RAM stick (1500) = 2000
      expect(repRes.body.data.repair.total_repair_cost).toBe(2000);
    });
  });

  // ==========================================
  // 6. LICENSE SEATS CAPACITY BOUNDS
  // ==========================================
  describe('Software Licenses Management API', () => {
    it('should create a software license with exactly 1 available seat', async () => {
      const res = await request(app)
        .post('/api/licenses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Sketch App Designer License',
          vendor: 'Sketch BV',
          license_type: 'Subscription',
          product_key: 'KEY-SKT-1111-2222',
          seats_total: 1,
          purchase_date: '2026-07-18'
        });

      expect(res.statusCode).toBe(200);
      createdLicenseId = res.body.data.id;
    });

    it('should allocate the single seat to Employee 1', async () => {
      const res = await request(app)
        .post(`/api/licenses/${createdLicenseId}/assign`)
        .set('Authorization', `Bearer ${token}`)
        .send({ employeeId: 1 });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should fail when trying to allocate a second seat (exceeding seat limit)', async () => {
      const res = await request(app)
        .post(`/api/licenses/${createdLicenseId}/assign`)
        .set('Authorization', `Bearer ${token}`)
        .send({ employeeId: 2 }); // employee 2

      // Server should reject request due to limits
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('seats are already fully assigned');
    });
  });

});
