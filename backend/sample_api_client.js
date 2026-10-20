/**
 * Standalone Sample API Client Script
 * Demonstrates external web application integration with NKB Centralized API Platform.
 * 
 * Usage:
 *   node sample_api_client.js
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
// Replace with raw API key generated from Admin Dashboard (/api-platform)
const API_KEY = process.env.NKB_API_KEY || 'nkb_live_0123456789abcdef0123456789abcdef';

async function makeApiRequest(endpoint, method = 'GET', body = null, idempotencyKey = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  console.log(`\n--------------------------------------------------`);
  console.log(`🚀 [OUTBOUND API CALL] ${method} ${url}`);
  if (idempotencyKey) console.log(`🔑 Idempotency-Key: ${idempotencyKey}`);

  try {
    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const requestId = response.headers.get('X-Request-Id');
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    const rateLimitLimit = response.headers.get('X-RateLimit-Limit');

    console.log(`📥 [RESPONSE STATUS] HTTP ${response.status}`);
    console.log(`🆔 Request ID: ${requestId}`);
    console.log(`📊 Rate Limit: ${rateLimitRemaining}/${rateLimitLimit} remaining`);

    const json = await response.json();

    if (!response.ok) {
      console.error(`❌ [API ERROR] Code: ${json.error?.code}`);
      console.error(`   Message: ${json.error?.message}`);
      if (json.error?.details) {
        console.error(`   Details:`, json.error.details);
      }
      return json;
    }

    console.log(`✅ [SUCCESS] Payload:`, JSON.stringify(json.data, null, 2));
    return json;
  } catch (err) {
    console.error(`💥 [NETWORK ERROR]:`, err.message);
  }
}

async function runDemo() {
  console.log('==================================================');
  console.log('  NKB Manufacturing API Platform - External Client Demo');
  console.log('==================================================');

  // 1. Health Probe
  console.log('\n--- 1. Testing Health Probe Endpoint ---');
  await makeApiRequest('/api/health');

  // 2. Fetch Documents (Scope: documents:read)
  console.log('\n--- 2. Fetching Documents (Scope: documents:read) ---');
  await makeApiRequest('/api/v1/documents?limit=5');

  // 3. Create Document with Idempotency Key (Scope: documents:create)
  console.log('\n--- 3. Creating Document with Idempotency Key (Scope: documents:create) ---');
  const uniqueKey = `idempotent-doc-${Date.now()}`;
  const docPayload = {
    title: 'Standard Operating Procedure - External API Test',
    documentNumber: `DOC-${Date.now().toString().slice(-4)}`,
    category: 'SOP',
    version: '1.0',
    department: 'External Integration System',
    status: 'draft'
  };

  // First Call: Creates Document
  await makeApiRequest('/api/v1/documents', 'POST', docPayload, uniqueKey);

  // Second Call: Re-uses Same Idempotency Key (Returns Cached Response instantly)
  console.log('\n--- 4. Retrying Same Call with Identical Idempotency Key ---');
  await makeApiRequest('/api/v1/documents', 'POST', docPayload, uniqueKey);

  // 5. Fetch Assets (Scope: assets:read)
  console.log('\n--- 5. Fetching Assets (Scope: assets:read) ---');
  await makeApiRequest('/api/v1/platform-assets?limit=3');
}

runDemo();
