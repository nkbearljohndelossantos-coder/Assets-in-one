#!/usr/bin/env node
/**
 * NKB ITMS — Agent Credential Security Manager
 * Allows authorized administrators on the server to securely generate,
 * rotate, and revoke On-Premise Network Agent API credentials.
 * Raw secret keys are displayed ONCE upon generation and NEVER stored in plaintext.
 */

const crypto = require('crypto');
const fs = require('fs');
const db = require('../src/config/db');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`
NKB ITMS Agent Credential Manager
Usage:
  node backend/scripts/manage_agent_credential.js <command> [options]

Commands:
  create    Register a new agent and generate a secure random API key
  rotate    Rotate the API key for an existing agent (invalidates previous key)
  revoke    Immediately revoke an agent's access
  list      List registered agents and their current statuses

Options:
  --uuid       Agent UUID (e.g., agent-nkb-plant-01)
  --name       Descriptive agent name (e.g., "Main Plant Floor Collector")
  --out-file   Path to write protected environment file (chmod 600, suppresses stdout)
`);
    process.exit(0);
  }

  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const writeSecretFile = (filePath, agentUuid, rawKey) => {
    const content = `# NKB ITMS On-Premise Network Agent Runtime Environment
# Generated securely: ${new Date().toISOString()}
# Strict File Permissions: 0600 (owner read/write only)
ITMS_API_URL=https://asset.nkbmanufacturing.com
ITMS_AGENT_UUID=${agentUuid}
ITMS_AGENT_KEY=${rawKey}
`;
    fs.writeFileSync(filePath, content, { mode: 0o600 });
    try {
      fs.chmodSync(filePath, 0o600);
    } catch (_) {}
  };

  try {
    if (command === 'list') {
      const agents = await db('wifi_agent_credentials').select('id', 'agent_uuid', 'agent_name', 'status', 'last_seen_at', 'last_ip', 'created_at');
      console.log('\n--- Registered Network Agents ---');
      console.table(agents);
      process.exit(0);
    }

    if (command === 'create') {
      const agentUuid = getArg('--uuid') || `agent-${crypto.randomBytes(4).toString('hex')}`;
      const agentName = getArg('--name') || 'On-Premise Network Agent';

      const existing = await db('wifi_agent_credentials').where('agent_uuid', agentUuid).first();
      if (existing) {
        console.error(`[!] Agent with UUID '${agentUuid}' already exists. Use 'rotate' to change its key.`);
        process.exit(1);
      }

      // Generate cryptographically random 256-bit API key
      const rawKey = `nkb_agent_${crypto.randomBytes(24).toString('hex')}`;
      const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

      await db('wifi_agent_credentials').insert({
        agent_uuid: agentUuid,
        agent_name: agentName,
        api_key_hash: hash,
        status: 'Active',
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      });

      const outFile = getArg('--out-file');
      if (outFile) {
        writeSecretFile(outFile, agentUuid, rawKey);
        console.log(`[+] New agent credential created. Protected runtime env written to: ${outFile} (mode 0600)`);
        console.log(`[+] Raw secret key suppressed from stdout. Only SHA-256 hash stored in DB.`);
        process.exit(0);
      }

      console.log('\n============================================================');
      console.log('       NEW ON-PREMISE AGENT CREDENTIAL GENERATED            ');
      console.log('============================================================');
      console.log(`Agent UUID:  ${agentUuid}`);
      console.log(`Agent Name:  ${agentName}`);
      console.log(`Raw API Key: [SUPPRESSED - Run with --out-file to write directly to protected env]`);
      console.log('============================================================\n');
      process.exit(0);
    }

    if (command === 'rotate') {
      const agentUuid = getArg('--uuid');
      if (!agentUuid) {
        console.error('[!] Missing required argument: --uuid <agent-uuid>');
        process.exit(1);
      }

      const existing = await db('wifi_agent_credentials').where('agent_uuid', agentUuid).first();
      if (!existing) {
        console.error(`[!] Agent UUID '${agentUuid}' not found.`);
        process.exit(1);
      }

      // Generate new key
      const newRawKey = `nkb_agent_${crypto.randomBytes(24).toString('hex')}`;
      const newHash = crypto.createHash('sha256').update(newRawKey).digest('hex');

      await db('wifi_agent_credentials')
        .where('agent_uuid', agentUuid)
        .update({
          api_key_hash: newHash,
          status: 'Active',
          updated_at: db.fn.now()
        });

      // Record audit log
      await db('wifi_access_logs').insert({
        action: 'ROTATE_AGENT_KEY',
        target_mac: 'N/A',
        target_name: existing.agent_name,
        router_name: 'ITMS Security Credential Store',
        requested_by_name: 'CLI Security Admin',
        status: 'SUCCESS',
        details: `Rotated API key hash for agent ${agentUuid}. Previous key invalidated immediately.`
      });

      const outFile = getArg('--out-file');
      if (outFile) {
        writeSecretFile(outFile, agentUuid, newRawKey);
        console.log(`[+] Agent credential rotated. Protected runtime env written to: ${outFile} (mode 0600)`);
        console.log(`[+] Previous key invalidated immediately. Raw secret key suppressed from stdout.`);
        process.exit(0);
      }

      console.log('\n============================================================');
      console.log('         AGENT CREDENTIAL ROTATED SUCCESSFULLY              ');
      console.log('============================================================');
      console.log(`Agent UUID:      ${agentUuid}`);
      console.log(`Status:          Active (New SHA-256 hash stored in DB)`);
      console.log(`Raw API Key:     [SUPPRESSED - Run with --out-file to write directly to protected env]`);
      console.log('============================================================\n');
      process.exit(0);
    }

    if (command === 'revoke') {
      const agentUuid = getArg('--uuid');
      if (!agentUuid) {
        console.error('[!] Missing required argument: --uuid <agent-uuid>');
        process.exit(1);
      }

      const existing = await db('wifi_agent_credentials').where('agent_uuid', agentUuid).first();
      if (!existing) {
        console.error(`[!] Agent UUID '${agentUuid}' not found.`);
        process.exit(1);
      }

      await db('wifi_agent_credentials')
        .where('agent_uuid', agentUuid)
        .update({
          status: 'Revoked',
          updated_at: db.fn.now()
        });

      await db('wifi_access_logs').insert({
        action: 'REVOKE_AGENT',
        target_mac: 'N/A',
        target_name: existing.agent_name,
        router_name: 'ITMS Security Credential Store',
        requested_by_name: 'CLI Security Admin',
        status: 'SUCCESS',
        details: `Revoked agent ${agentUuid}. All future telemetry requests will be rejected with 401.`
      });

      console.log(`[+] Agent '${agentUuid}' has been REVOKED. Telemetry access is blocked.`);
      process.exit(0);
    }

    console.error(`[!] Unknown command: ${command}. Use --help for usage.`);
    process.exit(1);
  } catch (err) {
    console.error(`[!] Execution error: ${err.message}`);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
