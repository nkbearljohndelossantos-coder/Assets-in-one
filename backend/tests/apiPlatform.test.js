const request = require('supertest');
const { app } = require('../src/server');
const { generateApiKey, hashApiKey, maskApiKey } = require('../src/utils/apiKeyUtils');

describe('NKB Centralized API Platform Integration Tests', () => {

  test('1. API Key Utilities - Hashing & Masking', () => {
    const keyData = generateApiKey('nkb_live_');
    expect(keyData.rawKey).toMatch(/^nkb_live_[a-f0-9]+$/);
    expect(keyData.keyPrefix).toBe('nkb_live_');
    expect(keyData.maskedKey).toMatch(/^nkb_live_\*+[a-f0-9]{4}$/);

    const hash1 = hashApiKey(keyData.rawKey);
    const hash2 = hashApiKey(keyData.rawKey);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 Hex output
  });

  test('2. GET /api/health - Public Health Probe', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('UP');
    expect(res.body.meta.requestId).toBeDefined();
  });

  test('3. GET /api/v1/documents - Reject Un-authenticated Requests', async () => {
    const res = await request(app).get('/api/v1/documents');
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('4. GET /api/v1/documents - Reject Invalid Key Format', async () => {
    const res = await request(app)
      .get('/api/v1/documents')
      .set('Authorization', 'Bearer invalid_key_without_prefix');
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('5. OpenAPI Docs Endpoint /docs/openapi.json', async () => {
    const res = await request(app).get('/docs/openapi.json');
    expect(res.statusCode).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.info.title).toContain('NKB Manufacturing');
  });

});
