const db = require('../src/config/db');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const API_KEY_PEPPER = process.env.API_KEY_PEPPER || 'nkb_api_platform_secret_pepper_2026';

function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey + API_KEY_PEPPER).digest('hex');
}

async function runApiPlatformMigration() {
  try {
    console.log('--- Initializing API Platform Database Schema & Seeds ---');

    // 1. Ensure api_clients table exists
    const hasClients = await db.schema.hasTable('api_clients');
    if (!hasClients) {
      console.log('Running Knex migration for API Platform tables...');
      const migration = require('../migrations/20261006000000_create_api_platform_tables');
      await migration.up(db);
      console.log('API Platform tables created successfully!');
    } else {
      console.log('API Platform tables already exist.');
    }

    // 2. Seed Granular API Scopes
    const defaultScopes = [
      { id: 'documents:read', category: 'Documents', name: 'Read Documents', description: 'Allows viewing and listing official DCC documents' },
      { id: 'documents:create', category: 'Documents', name: 'Create Documents', description: 'Allows uploading and registering new DCC documents' },
      { id: 'documents:update', category: 'Documents', name: 'Update Documents', description: 'Allows modifying existing DCC documents' },
      { id: 'documents:delete', category: 'Documents', name: 'Delete Documents', description: 'Allows archiving or soft deleting documents' },
      
      { id: 'assets:read', category: 'Assets', name: 'Read Assets', description: 'Allows viewing IT equipment and mobile assets' },
      { id: 'assets:create', category: 'Assets', name: 'Create Assets', description: 'Allows registering new equipment and mobile assets' },
      
      { id: 'formulas:read', category: 'Formulation', name: 'Read Formulas', description: 'Allows querying production batch formulation recipes' },
      { id: 'formulas:create', category: 'Formulation', name: 'Create Formulas', description: 'Allows creating new chemical formulation entries' },
      
      { id: 'ppe:read', category: 'PPE Management', name: 'Read PPE Records', description: 'Allows tracking safety gear allocations' },
      { id: 'ppe:create', category: 'PPE Management', name: 'Create PPE Issuance', description: 'Allows issuing safety equipment to workers' },
      
      { id: 'users:read', category: 'User Management', name: 'Read User Profiles', description: 'Allows looking up employee directory information' }
    ];

    for (const scope of defaultScopes) {
      const existing = await db('api_scopes').where('id', scope.id).first();
      if (!existing) {
        await db('api_scopes').insert(scope);
      }
    }
    console.log(`Seeded ${defaultScopes.length} API Scopes!`);

    // 3. Seed Default API Applications (NKB-DCC, NKB-PPE, NKB-FORMULATION) if none exist
    const clientCount = await db('api_clients').count('id as count').first();
    if (parseInt(clientCount.count) === 0) {
      const defaultClients = [
        {
          id: uuidv4(),
          name: 'NKB Document Control Center (DCC)',
          app_code: 'NKB-DCC',
          description: 'Centralized document repository and ISO quality control system',
          owner_email: 'dcc.admin@nkbmanufacturing.com',
          status: 'active',
          rate_limit_per_min: 150,
          rate_limit_per_hour: 2000,
          scopes: ['documents:read', 'documents:create', 'documents:update', 'users:read']
        },
        {
          id: uuidv4(),
          name: 'NKB PPE Management System',
          app_code: 'NKB-PPE',
          description: 'Personal Protective Equipment issuance and inventory tracker',
          owner_email: 'safety@nkbmanufacturing.com',
          status: 'active',
          rate_limit_per_min: 100,
          rate_limit_per_hour: 1000,
          scopes: ['ppe:read', 'ppe:create', 'assets:read', 'users:read']
        },
        {
          id: uuidv4(),
          name: 'NKB Chemical Formulation Engine',
          app_code: 'NKB-FORMULATION',
          description: 'Batch production recipe calculator and formulation vault',
          owner_email: 'rnd@nkbmanufacturing.com',
          status: 'active',
          rate_limit_per_min: 100,
          rate_limit_per_hour: 1000,
          scopes: ['formulas:read', 'formulas:create', 'users:read']
        }
      ];

      for (const client of defaultClients) {
        const { scopes, ...clientData } = client;
        await db('api_clients').insert(clientData);

        // Generate an initial API Key for each sample app
        const randomHex = crypto.randomBytes(16).toString('hex');
        const rawApiKey = `nkb_live_${randomHex}`;
        const keyPrefix = `nkb_live_${randomHex.substring(0, 4)}...${randomHex.substring(randomHex.length - 4)}`;
        const keyHash = hashApiKey(rawApiKey);

        await db('api_keys').insert({
          id: uuidv4(),
          client_id: client.id,
          key_prefix: keyPrefix,
          key_hash: keyHash,
          name: 'Production Primary Key',
          status: 'active',
          allowed_scopes: JSON.stringify(scopes),
          custom_rate_limit: client.rate_limit_per_min
        });

        console.log(`\n======================================================`);
        console.log(`[SEED] Created Application: ${client.app_code} (${client.name})`);
        console.log(`[RAW API KEY] ${rawApiKey}`);
        console.log(`[WARNING] Copy this raw key now! DB stores hash only: ${keyPrefix}`);
        console.log(`======================================================\n`);
      }
    }

    console.log('--- API Platform Database Setup Complete! ---');
    process.exit(0);
  } catch (err) {
    console.error('API Platform Migration Error:', err);
    process.exit(1);
  }
}

runApiPlatformMigration();
