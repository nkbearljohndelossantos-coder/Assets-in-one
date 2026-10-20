const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');
const logger = require('../utils/logger');
const { logAudit } = require('../utils/auditLogger');

// Helper: Hash enrollment token or key
const hashSecret = (secret) => {
  return crypto.createHash('sha256').update(secret).digest('hex');
};

// ==========================================
// 1. AGENT ENROLLMENT
// ==========================================
router.post('/enroll', async (req, res) => {
  const { enrollmentToken, hostname, deviceUuid, osName, osVersion, osBuild, architecture, currentIp, currentUser, agentVersion } = req.body;

  if (!enrollmentToken || !hostname) {
    return res.status(400).json({ success: false, message: 'Enrollment token and hostname are required.' });
  }

  const tokenHash = hashSecret(enrollmentToken);

  try {
    const tokenRecord = await db('agent_enrollment_tokens')
      .where('token_hash', tokenHash)
      .andWhere('expires_at', '>', new Date())
      .whereNull('used_at')
      .whereNull('revoked_at')
      .first();

    if (!tokenRecord) {
      return res.status(401).json({ success: false, message: 'Invalid, expired, or previously used enrollment token.' });
    }

    const agentUuid = 'agent-' + crypto.randomUUID();
    const agentKey = crypto.randomBytes(32).toString('hex');
    const agentKeyHash = hashSecret(agentKey);

    const [agentId] = await db('agents').insert({
      uuid: agentUuid,
      asset_id: tokenRecord.asset_id,
      organization_id: 'NKB_MAIN',
      hostname,
      device_uuid: deviceUuid || ('dev-' + crypto.randomUUID()),
      status: 'active',
      enrollment_status: 'enrolled',
      agent_version: agentVersion || '1.0.0',
      os_name: osName || 'Windows 11 Pro',
      os_version: osVersion || '23H2',
      os_build: osBuild || '22631',
      architecture: architecture || 'x64',
      current_ip: currentIp || req.ip,
      current_user: currentUser || 'SYSTEM',
      agent_key_hash: agentKeyHash,
      last_seen_at: new Date(),
      last_heartbeat_at: new Date(),
      enrolled_at: new Date()
    });

    // Mark token as used
    await db('agent_enrollment_tokens')
      .where('id', tokenRecord.id)
      .update({ used_at: new Date() });

    // Link/Sync to managed_devices table
    const existingDevice = await db('managed_devices').where('asset_id', tokenRecord.asset_id).first();
    if (existingDevice) {
      await db('managed_devices').where('id', existingDevice.id).update({
        name: hostname,
        ip_address: currentIp || req.ip,
        os_name: osName || 'Windows 11 Pro',
        os_version: osVersion || '23H2',
        logged_in_user: currentUser || 'SYSTEM',
        agent_version: agentVersion || '1.0.0',
        last_heartbeat: new Date(),
        is_online: true,
        is_simulated: false
      });
    } else {
      await db('managed_devices').insert({
        device_id: deviceUuid || ('dev-' + crypto.randomUUID()),
        name: hostname,
        asset_id: tokenRecord.asset_id,
        ip_address: currentIp || req.ip,
        os_name: osName || 'Windows 11 Pro',
        os_version: osVersion || '23H2',
        logged_in_user: currentUser || 'SYSTEM',
        agent_version: agentVersion || '1.0.0',
        last_heartbeat: new Date(),
        is_online: true,
        is_simulated: false
      });
    }

    logger.info(`Agent enrolled successfully for asset #${tokenRecord.asset_id} [Hostname: ${hostname}]`);

    return res.json({
      success: true,
      data: {
        agentUuid,
        agentKey,
        assetId: tokenRecord.asset_id,
        organizationId: 'NKB_MAIN',
        heartbeatIntervalSeconds: 30,
        inventoryIntervalHours: 12
      }
    });

  } catch (err) {
    logger.error(`Agent enrollment error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to enroll agent.' });
  }
});

// Middleware: Authenticate Agent Key
const authenticateAgent = async (req, res, next) => {
  const agentUuid = req.headers['x-agent-uuid'];
  const agentKey = req.headers['x-agent-key'];

  if (!agentUuid || !agentKey) {
    return res.status(401).json({ success: false, message: 'Missing X-Agent-UUID or X-Agent-Key headers.' });
  }

  try {
    const keyHash = hashSecret(agentKey);
    const agent = await db('agents')
      .where('uuid', agentUuid)
      .andWhere('agent_key_hash', keyHash)
      .andWhere('status', 'active')
      .first();

    if (!agent) {
      return res.status(401).json({ success: false, message: 'Invalid or revoked agent credentials.' });
    }

    req.agent = agent;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Agent authentication failed.' });
  }
};

// ==========================================
// 2. HEARTBEAT API
// ==========================================
router.post('/heartbeat', authenticateAgent, async (req, res) => {
  const { currentIp, currentUser, cpuPercent, memoryPercent, diskPercent, uptimeSeconds, healthStatus, agentVersion } = req.body;

  try {
    const now = new Date();

    await db('agents').where('id', req.agent.id).update({
      current_ip: currentIp || req.ip,
      current_user: currentUser || req.agent.current_user,
      agent_version: agentVersion || req.agent.agent_version,
      last_seen_at: now,
      last_heartbeat_at: now
    });

    await db('agent_heartbeats').insert({
      agent_id: req.agent.id,
      recorded_at: now,
      ip_address: currentIp || req.ip,
      logged_in_user: currentUser || req.agent.current_user,
      cpu_percent: cpuPercent || 0,
      memory_percent: memoryPercent || 0,
      disk_percent: diskPercent || 0,
      uptime_seconds: uptimeSeconds || 0,
      health_status: healthStatus || 'HEALTHY',
      agent_version: agentVersion || '1.0.0'
    });

    // Update managed_devices table
    await db('managed_devices').where('asset_id', req.agent.asset_id).update({
      ip_address: currentIp || req.ip,
      logged_in_user: currentUser || req.agent.current_user,
      last_heartbeat: now,
      is_online: true
    });

    // Check for pending commands
    const pendingCommands = await db('remote_commands')
      .where('device_id', req.agent.device_uuid || req.agent.uuid)
      .andWhere('status', 'pending');

    return res.json({
      success: true,
      pendingCommandsCount: pendingCommands.length,
      timestamp: now
    });

  } catch (err) {
    logger.error(`Heartbeat ingestion error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Heartbeat processing failed.' });
  }
});

// ==========================================
// 3. HARDWARE INVENTORY INGESTION
// ==========================================
router.post('/inventory/hardware', authenticateAgent, async (req, res) => {
  const { system, cpu, memory, disks, volumes, network, graphics } = req.body;

  try {
    const now = new Date();

    // 1. Update/Upsert computer_hardware
    const existingHW = await db('computer_hardware').where('agent_id', req.agent.id).first();
    const hwData = {
      agent_id: req.agent.id,
      hostname: system?.hostname || req.agent.hostname,
      domain: system?.domain || 'WORKGROUP',
      manufacturer: system?.manufacturer || 'Generic',
      model: system?.model || 'PC',
      serial_number: system?.serialNumber || 'N/A',
      bios_version: system?.biosVersion || 'N/A',
      bios_vendor: system?.biosVendor || 'N/A',
      cpu_name: cpu?.name || 'Processor',
      cpu_cores: cpu?.cores || 4,
      cpu_threads: cpu?.threads || 8,
      total_memory_bytes: memory?.totalBytes || 0,
      memory_slots_used: memory?.slotsUsed || 1,
      memory_slots_total: memory?.slotsTotal || 2,
      graphics_card: graphics?.cardName || 'Integrated Graphics',
      raw_json: JSON.stringify(req.body)
    };

    if (existingHW) {
      await db('computer_hardware').where('id', existingHW.id).update(hwData);
    } else {
      await db('computer_hardware').insert(hwData);
    }

    // 2. Physical Disks
    if (Array.isArray(disks)) {
      await db('physical_disks').where('agent_id', req.agent.id).del();
      for (const d of disks) {
        await db('physical_disks').insert({
          agent_id: req.agent.id,
          model: d.model || 'Disk',
          serial_number: d.serialNumber || 'N/A',
          media_type: d.mediaType || 'SSD',
          bus_type: d.busType || 'NVMe',
          capacity_bytes: d.capacityBytes || 0,
          health_status: d.healthStatus || 'OK'
        });
      }
    }

    // 3. Disk Volumes
    if (Array.isArray(volumes)) {
      await db('disk_volumes').where('agent_id', req.agent.id).del();
      for (const v of volumes) {
        await db('disk_volumes').insert({
          agent_id: req.agent.id,
          drive_letter: v.driveLetter || 'C:',
          volume_name: v.label || 'System',
          file_system: v.fileSystem || 'NTFS',
          total_bytes: v.totalBytes || 0,
          free_bytes: v.freeBytes || 0,
          used_pct: v.usedPct || 0,
          bitlocker_status: v.bitlockerStatus || 'ProtectionOff'
        });
      }
    }

    // 4. Network Adapters
    if (Array.isArray(network)) {
      await db('network_adapters').where('agent_id', req.agent.id).del();
      for (const n of network) {
        await db('network_adapters').insert({
          agent_id: req.agent.id,
          adapter_name: n.name || 'Ethernet',
          mac_address: n.macAddress || 'N/A',
          ip_address: n.ipAddress || '0.0.0.0',
          subnet_mask: n.subnetMask || '255.255.255.0',
          gateway: n.gateway || '0.0.0.0',
          dns_servers: n.dnsServers || '',
          dhcp_enabled: n.dhcpEnabled ?? true,
          connection_status: n.connectionStatus || 'Connected'
        });
      }
    }

    await db('agents').where('id', req.agent.id).update({ last_inventory_at: now });

    return res.json({ success: true, message: 'Hardware inventory processed successfully.' });

  } catch (err) {
    logger.error(`Hardware inventory error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to process hardware inventory.' });
  }
});

// ==========================================
// 4. SOFTWARE INVENTORY INGESTION
// ==========================================
router.post('/inventory/software', authenticateAgent, async (req, res) => {
  const { software } = req.body;

  if (!Array.isArray(software)) {
    return res.status(400).json({ success: false, message: 'Software list array is required.' });
  }

  try {
    await db('installed_software').where('agent_id', req.agent.id).del();

    for (const item of software) {
      await db('installed_software').insert({
        agent_id: req.agent.id,
        name: item.name,
        version: item.version || '1.0',
        publisher: item.publisher || 'Unknown',
        install_date: item.installDate || '',
        install_location: item.installLocation || '',
        uninstall_string: item.uninstallString || '',
        architecture: item.architecture || 'x64'
      });
    }

    return res.json({ success: true, count: software.length });

  } catch (err) {
    logger.error(`Software inventory error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to process software inventory.' });
  }
});

// ==========================================
// 5. SECURITY INVENTORY INGESTION
// ==========================================
router.post('/inventory/security', authenticateAgent, async (req, res) => {
  const { defenderEnabled, defenderRealtime, antivirusName, signatureVersion, firewallDomain, firewallPrivate, firewallPublic, bitlockerEnabled, tpmPresent, tpmVersion, secureBootEnabled, uacEnabled, pendingReboot, localAdmins } = req.body;

  try {
    const existingSec = await db('windows_security_inventory').where('agent_id', req.agent.id).first();
    const secData = {
      agent_id: req.agent.id,
      defender_enabled: defenderEnabled ?? true,
      defender_realtime: defenderRealtime ?? true,
      antivirus_name: antivirusName || 'Microsoft Defender',
      signature_version: signatureVersion || 'Latest',
      firewall_domain: firewallDomain ?? true,
      firewall_private: firewallPrivate ?? true,
      firewall_public: firewallPublic ?? true,
      bitlocker_enabled: bitlockerEnabled ?? false,
      tpm_present: tpmPresent ?? true,
      tpm_version: tpmVersion || '2.0',
      secure_boot_enabled: secureBootEnabled ?? true,
      uac_enabled: uacEnabled ?? true,
      pending_reboot: pendingReboot ?? false,
      local_admins_json: JSON.stringify(localAdmins || ['Administrator'])
    };

    if (existingSec) {
      await db('windows_security_inventory').where('id', existingSec.id).update(secData);
    } else {
      await db('windows_security_inventory').insert(secData);
    }

    await db('agents').where('id', req.agent.id).update({ last_security_inventory_at: new Date() });

    return res.json({ success: true, message: 'Security inventory updated.' });

  } catch (err) {
    logger.error(`Security inventory error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update security inventory.' });
  }
});

// ==========================================
// 6. PERFORMANCE METRICS INGESTION
// ==========================================
router.post('/metrics', authenticateAgent, async (req, res) => {
  const { cpuPercent, memoryPercent, availableMemoryBytes, diskPercent, diskReadBytesSec, diskWriteBytesSec, netRecvBytesSec, netSentBytesSec, batteryPercent, isAcPowered } = req.body;

  try {
    await db('performance_metrics').insert({
      agent_id: req.agent.id,
      recorded_at: new Date(),
      cpu_percent: cpuPercent || 0,
      memory_percent: memoryPercent || 0,
      available_memory_bytes: availableMemoryBytes || 0,
      disk_percent: diskPercent || 0,
      disk_read_bytes_sec: diskReadBytesSec || 0,
      disk_write_bytes_sec: diskWriteBytesSec || 0,
      net_recv_bytes_sec: netRecvBytesSec || 0,
      net_sent_bytes_sec: netSentBytesSec || 0,
      battery_percent: batteryPercent || null,
      is_ac_powered: isAcPowered ?? true
    });

    return res.json({ success: true });

  } catch (err) {
    logger.error(`Performance metrics error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to record metrics.' });
  }
});

// ==========================================
// 7. GET COMMANDS & SEND COMMAND RESULTS
// ==========================================
router.get('/commands', authenticateAgent, async (req, res) => {
  try {
    const commands = await db('remote_commands')
      .where('device_id', req.agent.device_uuid || req.agent.uuid)
      .andWhere('status', 'pending');

    return res.json({ success: true, commands });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch pending commands.' });
  }
});

router.post('/commands/:commandId/result', authenticateAgent, async (req, res) => {
  const { commandId } = req.params;
  const { exitCode, stdout, stderr } = req.body;

  try {
    await db('remote_commands').where('id', commandId).update({
      status: exitCode === 0 ? 'completed' : 'failed',
      executed_at: new Date()
    });

    await db('remote_command_results').insert({
      command_id: commandId,
      exit_code: exitCode || 0,
      stdout_truncated: stdout || '',
      stderr_truncated: stderr || ''
    });

    return res.json({ success: true });

  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to save command result.' });
  }
});

module.exports = router;
