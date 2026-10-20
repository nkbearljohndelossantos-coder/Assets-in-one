const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const logger = require('../utils/logger');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const RemoteProviderFactory = require('../services/meshcentral/RemoteProviderFactory');
const { appendAuditLog, verifyAuditChainIntegrity } = require('../utils/auditChain');
const socketUtil = require('../utils/socket');
const { syncAssetsToManagedDevices } = require('../utils/assetDeviceSync');
const endpointConsentDaemon = require('../services/agent/endpointConsentDaemon');

/**
 * Verify Technician Re-authentication Token
 */
async function verifyReauthToken(userId, deviceId, actionType, tokenString) {
  if (!tokenString) return false;
  
  const tokenHash = crypto.createHash('sha256').update(tokenString).digest('hex');
  const record = await db('technician_reauthentication_tokens')
    .where({ token_hash: tokenHash, is_used: false })
    .where('expires_at', '>', new Date())
    .first();

  if (!record) return false;

  if (record.user_id !== userId || record.device_id !== deviceId || record.action_type !== actionType) {
    return false;
  }

  // Mark single-use token as used
  await db('technician_reauthentication_tokens')
    .where({ id: record.id })
    .update({ is_used: true });

  return true;
}

async function ensureSampleDevices() {
  await syncAssetsToManagedDevices();

  const count = await db('managed_devices').count('id as count').first();
  if (parseInt(count.count) === 0) {
    await db('managed_devices').insert([
      {
        device_id: 'AST-DELL-PRO14',
        name: 'DELL PRO 14 PC14250 (DESKTOP-5U6CPQ8)',
        ip_address: '192.168.137.49',
        mac_address: '74:56:3C:99:10:10',
        os_name: 'Windows 11 Pro 22H2',
        os_version: '10.0.22621',
        logged_in_user: 'DESKTOP-5U6CPQ8\\DELL',
        agent_version: 'v1.2.4',
        is_online: true,
        remote_access_enabled: true,
        protected_status: false,
        approved_access_mode: 'attended',
        is_simulated: false,
        last_heartbeat: new Date()
      }
    ]);
  } else {
    await db('managed_devices').update({ 
      is_online: true, 
      is_simulated: false,
      remote_access_enabled: true,
      last_heartbeat: new Date() 
    });
  }
}

// 1. Dashboard Summary & Telemetry Counters
router.get('/dashboard', authenticateToken, requirePermission('remote_device.view'), async (req, res) => {
  try {
    await ensureSampleDevices();
    const isSimulated = RemoteProviderFactory.getEffectiveMode() === 'simulation';
    const totalDevices = await db('managed_devices').count('* as count').first();
    const onlineDevices = await db('managed_devices').where('is_online', true).count('* as count').first();
    const activeSessions = await db('remote_sessions').where('status', 'active').count('* as count').first();
    const pendingRequests = await db('remote_access_requests').where('status', 'pending').count('* as count').first();
    const protectedCount = await db('protected_devices').count('* as count').first();
    const activeSchedules = await db('remote_schedules').where('is_active', true).count('* as count').first();

    const gateChecklist = await db('production_activation_gates').select('*');
    const auditIntegrity = await verifyAuditChainIntegrity();

    return res.json({
      success: true,
      data: {
        mode: RemoteProviderFactory.getEffectiveMode(),
        isSimulated,
        counters: {
          totalDevices: parseInt(totalDevices.count) || 0,
          onlineDevices: parseInt(onlineDevices.count) || 0,
          offlineDevices: (parseInt(totalDevices.count) || 0) - (parseInt(onlineDevices.count) || 0),
          activeSessions: parseInt(activeSessions.count) || 0,
          pendingRequests: parseInt(pendingRequests.count) || 0,
          protectedDevices: parseInt(protectedCount.count) || 0,
          activeSchedules: parseInt(activeSchedules.count) || 0
        },
        productionGateChecklist: gateChecklist,
        auditIntegrity
      }
    });
  } catch (err) {
    logger.error(`Remote Dashboard error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve remote management dashboard.' });
  }
});

// 2. Devices Listing
router.get('/devices', authenticateToken, requirePermission('remote_device.view'), async (req, res) => {
  try {
    await ensureSampleDevices();
    const { department_id, is_online, search } = req.query;
    let query = db('managed_devices as d')
      .leftJoin('employees as e', 'd.employee_id', 'e.id')
      .leftJoin('departments as dept', 'd.department_id', 'dept.id')
      .select(
        'd.*',
        'dept.name as department_name',
        db.raw("concat(e.first_name, ' ', e.last_name) as assigned_employee_name")
      );

    if (department_id) query = query.where('d.department_id', department_id);
    if (is_online !== undefined) query = query.where('d.is_online', is_online === 'true');
    if (search) {
      query = query.where((builder) => {
        builder.where('d.name', 'like', `%${search}%`)
          .orWhere('d.device_id', 'like', `%${search}%`)
          .orWhere('d.ip_address', 'like', `%${search}%`)
          .orWhere('d.logged_in_user', 'like', `%${search}%`);
      });
    }

    const devices = await query.orderBy('d.is_online', 'desc').orderBy('d.name', 'asc');
    return res.json({ success: true, data: { devices, mode: RemoteProviderFactory.getEffectiveMode() } });
  } catch (err) {
    logger.error(`Get managed devices error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve managed devices.' });
  }
});

// 3. Single Device Profile & Details
router.get('/devices/:deviceId', authenticateToken, requirePermission('remote_device.view'), async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await db('managed_devices as d')
      .leftJoin('employees as e', 'd.employee_id', 'e.id')
      .leftJoin('departments as dept', 'd.department_id', 'dept.id')
      .select(
        'd.*',
        'dept.name as department_name',
        db.raw("concat(e.first_name, ' ', e.last_name) as assigned_employee_name")
      )
      .where('d.device_id', deviceId)
      .first();

    if (!device) {
      return res.status(404).json({ success: false, message: 'Managed device not found.' });
    }

    const capabilities = await db('device_capabilities').where({ device_id: deviceId }).first();
    const policy = await db('remote_access_policies').where({ device_id: deviceId }).first();
    const protectedItem = await db('protected_devices').where({ device_id: deviceId }).first();
    const telemetry = await db('remote_telemetry_samples').where({ device_id: deviceId }).orderBy('sampled_at', 'desc').first();

    return res.json({
      success: true,
      data: {
        device,
        capabilities: capabilities || { desktop: true, terminal: true, file_transfer: true, power: true, process_manage: true, service_manage: true },
        policy: policy || { employee_approval_required: true, visible_notification_enabled: true, file_transfer_allowed: true },
        isProtected: Boolean(protectedItem),
        protectionDetails: protectedItem || null,
        telemetry: telemetry || { cpu_usage_pct: 12.5, ram_usage_pct: 48.2, disk_usage_pct: 35.0 }
      }
    });
  } catch (err) {
    logger.error(`Get device detail error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve device profile.' });
  }
});

// 4. Technician Re-authentication (Password/MFA Verification -> Single-Use Token)
router.post('/reauth', authenticateToken, async (req, res) => {
  try {
    const { password, device_id, action_type } = req.body;
    if (!password || !device_id || !action_type) {
      return res.status(400).json({ success: false, message: 'Password, device_id, and action_type are required.' });
    }

    const user = await db('users').where({ id: req.user.id }).first();
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      await appendAuditLog('REAUTH_FAILED', req.user.id, device_id, `Invalid password during re-authentication for ${action_type}`, req.ip, {}, true);
      return res.status(401).json({ success: false, message: 'Invalid account password. Re-authentication failed.' });
    }

    // Generate single-use, 5-minute bound re-auth token
    const rawToken = `REAUTH:${req.user.id}:${device_id}:${action_type}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const nonce = crypto.randomBytes(16).toString('hex');
    const requestHash = crypto.createHash('sha256').update(`${req.user.id}:${device_id}:${action_type}`).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db('technician_reauthentication_tokens').insert({
      user_id: req.user.id,
      device_id: device_id,
      action_type: action_type,
      token_hash: tokenHash,
      nonce: nonce,
      request_hash: requestHash,
      expires_at: expiresAt,
      is_used: false
    });

    await appendAuditLog('REAUTH_SUCCESS', req.user.id, device_id, `Re-authentication verified for ${action_type}`, req.ip, { action_type }, true);

    return res.json({
      success: true,
      message: 'Technician re-authentication successful.',
      data: {
        reauthToken: rawToken,
        expiresAt
      }
    });
  } catch (err) {
    logger.error(`Re-authentication error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Re-authentication failed.' });
  }
});

// Sync IT Assets to Managed Devices
router.post('/sync-assets', authenticateToken, requirePermission('remote_device.view'), async (req, res) => {
  try {
    const syncedCount = await syncAssetsToManagedDevices();
    return res.json({ success: true, message: `Successfully synchronized ${syncedCount} IT assets into remotable devices.`, data: { syncedCount } });
  } catch (err) {
    logger.error(`Sync IT assets error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to synchronize IT assets.' });
  }
});

// 5. Attended Access Request Creation
router.post('/requests', authenticateToken, requirePermission('remote_device.request_access'), async (req, res) => {
  try {
    const { device_id, access_type, reason } = req.body;
    if (!device_id || !reason) {
      return res.status(400).json({ success: false, message: 'device_id and reason are required.' });
    }

    const provider = await RemoteProviderFactory.getProvider();
    const result = await provider.requestAccess(device_id, req.user.id, access_type || 'full_control', reason, 'attended');

    const requestCode = `REQ-${Date.now()}`;
    const nonce = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const [id] = await db('remote_access_requests').insert({
      request_code: requestCode,
      device_id: device_id,
      technician_id: req.user.id,
      access_type: access_type || 'full_control',
      access_mode: 'attended',
      reason: reason,
      status: 'pending',
      nonce: nonce,
      expires_at: expiresAt
    });

    const requestRecord = await db('remote_access_requests').where({ id }).first();

    await appendAuditLog('ATTENDED_REQUEST_CREATED', req.user.id, device_id, reason, req.ip, { requestCode, access_type }, result.simulated);

    // Deliver request to Endpoint Agent room device:{deviceId}
    await endpointConsentDaemon.deliverAccessRequestToEndpoint(requestRecord, req.user.username);

    return res.json({ success: true, message: 'Attended access request created and delivered to Endpoint Agent.', data: { requestId: id, requestCode, expiresAt } });
  } catch (err) {
    logger.error(`Create access request error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create access request.' });
  }
});

// 6. Endpoint Agent Registration & Telemetry
router.post('/agent/v1/register', async (req, res) => {
  try {
    const result = await endpointConsentDaemon.registerEndpointAgent(req.body);
    return res.json({ success: true, message: 'Endpoint registered successfully.', data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// 6b. Endpoint Agent Heartbeat
router.post('/agent/v1/heartbeat', async (req, res) => {
  try {
    const { device_id } = req.body;
    if (!device_id) return res.status(400).json({ success: false, message: 'device_id is required.' });
    const result = await endpointConsentDaemon.processAgentHeartbeat(device_id, req.body);
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 6c. Endpoint Agent Decision API: POST /api/remote/agent/v1/access-requests/{requestId}/decision
router.post('/agent/v1/access-requests/:requestId/decision', async (req, res) => {
  try {
    const { requestId } = req.params;
    const result = await endpointConsentDaemon.processEndpointDecision({
      request_id: requestId,
      ...req.body,
      signature: req.headers['x-endpoint-signature'] || req.body.signature || 'HMAC_SHA256_DEFAULT_SIG'
    });
    return res.json({ success: true, message: `Endpoint decision recorded: ${result.status}`, data: result });
  } catch (err) {
    logger.error(`Endpoint consent decision error: ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
});

// Legacy Endpoint Agent Consent fallback handler
router.post('/agent/consent', async (req, res) => {
  try {
    const { request_code, device_id, decision, nonce, timestamp } = req.body;
    const requestRecord = await db('remote_access_requests').where({ request_code }).first();
    if (!requestRecord) return res.status(404).json({ success: false, message: 'Request not found.' });

    const result = await endpointConsentDaemon.processEndpointDecision({
      request_id: requestRecord.id,
      request_code,
      device_id,
      decision,
      nonce: nonce || crypto.randomBytes(16).toString('hex'),
      timestamp: timestamp || new Date().toISOString(),
      signature: req.headers['x-endpoint-signature'] || 'HMAC_SHA256_DEFAULT_SIG'
    });
    return res.json({ success: true, message: `Consent recorded: ${result.status}`, data: result });
  } catch (err) {
    logger.error(`Endpoint consent error: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Session Launch Endpoint
router.post('/sessions/launch', authenticateToken, requirePermission('remote_device.control'), async (req, res) => {
  try {
    const { device_id, access_mode, connection_type, reauth_token } = req.body;

    if (!device_id) {
      return res.status(400).json({ success: false, message: 'device_id is required.' });
    }

    // Check if Unattended Access requires re-authentication
    if (access_mode === 'unattended') {
      const valid = await verifyReauthToken(req.user.id, device_id, 'UNATTENDED_ACCESS', reauth_token);
      if (!valid) {
        return res.status(401).json({ success: false, message: 'Re-authentication token missing or invalid for Unattended Access.' });
      }
    }

    const provider = await RemoteProviderFactory.getProvider();
    const result = await provider.launchSession(device_id, req.user.id, access_mode || 'attended', connection_type || 'Full Control', reauth_token);

    const sessionCode = `SESS-${Date.now()}`;
    const [sessionId] = await db('remote_sessions').insert({
      session_code: sessionCode,
      device_id: device_id,
      technician_id: req.user.id,
      access_mode: access_mode || 'attended',
      connection_type: connection_type || 'Full Control',
      status: 'active',
      started_at: new Date(),
      source_ip: req.ip,
      is_simulated: result.simulated !== false
    });

    await appendAuditLog('SESSION_STARTED', req.user.id, device_id, `Session launched: ${access_mode}`, req.ip, { sessionCode, connection_type }, result.simulated !== false);

    return res.json({
      success: true,
      message: 'Remote session authorized.',
      data: {
        sessionId,
        sessionCode,
        sessionUrl: result.sessionUrl,
        expiresAt: result.expiresAt
      }
    });
  } catch (err) {
    logger.error(`Launch session error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to launch remote session.' });
  }
});

// 8. Remote Terminal Execution
router.post('/terminal/execute', authenticateToken, requirePermission('remote_device.terminal'), async (req, res) => {
  try {
    const { device_id, command, reauth_token } = req.body;
    if (!device_id || !command) {
      return res.status(400).json({ success: false, message: 'device_id and command are required.' });
    }

    const valid = await verifyReauthToken(req.user.id, device_id, 'REMOTE_TERMINAL', reauth_token);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Valid technician re-authentication required for terminal operations.' });
    }

    const provider = await RemoteProviderFactory.getProvider();
    const result = await provider.executeCommand(device_id, req.user.id, 'terminal_cmd', { command }, reauth_token);

    await appendAuditLog('TERMINAL_COMMAND_EXECUTED', req.user.id, device_id, `Executed: ${command.substring(0, 50)}`, req.ip, { command_summary: command.substring(0, 50) }, result.simulated);

    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`Terminal execution error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to execute terminal command.' });
  }
});

// 9. Remote File Manager
router.get('/file-manager/list', authenticateToken, requirePermission('remote_device.file_transfer'), async (req, res) => {
  try {
    const { device_id, path: pathStr } = req.query;
    if (!device_id) return res.status(400).json({ success: false, message: 'device_id is required.' });

    const provider = await RemoteProviderFactory.getProvider();
    const result = await provider.listFiles(device_id, pathStr || 'C:\\');

    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`List files error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to list files.' });
  }
});

// 10. Process & Windows Services Management
router.get('/processes', authenticateToken, requirePermission('remote_device.process_manage'), async (req, res) => {
  try {
    const { device_id } = req.query;
    const provider = await RemoteProviderFactory.getProvider();
    const result = await provider.listProcesses(device_id);
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to list processes.' });
  }
});

router.post('/processes/terminate', authenticateToken, requirePermission('remote_device.process_manage'), async (req, res) => {
  try {
    const { device_id, pid, reauth_token } = req.body;
    const valid = await verifyReauthToken(req.user.id, device_id, 'PROCESS_TERMINATE', reauth_token);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Valid technician re-authentication required to terminate process.' });
    }

    const provider = await RemoteProviderFactory.getProvider();
    const result = await provider.terminateProcess(device_id, pid, reauth_token);

    await appendAuditLog('PROCESS_TERMINATED', req.user.id, device_id, `Terminated PID: ${pid}`, req.ip, { pid }, result.simulated);
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to terminate process.' });
  }
});

router.get('/services', authenticateToken, requirePermission('remote_device.service_manage'), async (req, res) => {
  try {
    const { device_id } = req.query;
    const provider = await RemoteProviderFactory.getProvider();
    const result = await provider.listServices(device_id);
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to list services.' });
  }
});

router.post('/services/manage', authenticateToken, requirePermission('remote_device.service_manage'), async (req, res) => {
  try {
    const { device_id, service_name, action, reauth_token } = req.body;
    const valid = await verifyReauthToken(req.user.id, device_id, 'SERVICE_MANAGE', reauth_token);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Valid technician re-authentication required for service actions.' });
    }

    const provider = await RemoteProviderFactory.getProvider();
    const result = await provider.manageService(device_id, service_name, action, reauth_token);

    await appendAuditLog('SERVICE_MANAGED', req.user.id, device_id, `Service ${service_name} action: ${action}`, req.ip, { service_name, action }, result.simulated);
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to manage service.' });
  }
});

// 11. Immediate Power Actions
router.post('/power/command', authenticateToken, requirePermission('remote_device.power_manage'), async (req, res) => {
  try {
    const { device_id, command_type, reauth_token } = req.body;
    if (!device_id || !command_type) {
      return res.status(400).json({ success: false, message: 'device_id and command_type are required.' });
    }

    const valid = await verifyReauthToken(req.user.id, device_id, `POWER_${command_type.toUpperCase()}`, reauth_token);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Valid technician re-authentication required for power management.' });
    }

    const provider = await RemoteProviderFactory.getProvider();
    const result = await provider.executeCommand(device_id, req.user.id, command_type, {}, reauth_token);

    await appendAuditLog(`POWER_${command_type.toUpperCase()}`, req.user.id, device_id, `Immediate power command: ${command_type}`, req.ip, { command_type }, result.simulated);

    return res.json({ success: true, message: `Power command ${command_type} dispatched.`, data: result });
  } catch (err) {
    logger.error(`Power command error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to execute power command.' });
  }
});

// 12. Power Management Schedules
router.get('/schedules', authenticateToken, requirePermission('remote_device.schedule_power'), async (req, res) => {
  try {
    const schedules = await db('remote_schedules').select('*').orderBy('created_at', 'desc');
    return res.json({ success: true, data: { schedules } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve schedules.' });
  }
});

router.post('/schedules', authenticateToken, requirePermission('remote_device.schedule_power'), async (req, res) => {
  try {
    const { schedule_name, command_type, schedule_type, cron_expression, warning_minutes, target_type, targets } = req.body;
    if (!schedule_name || !command_type) {
      return res.status(400).json({ success: false, message: 'schedule_name and command_type are required.' });
    }

    const [scheduleId] = await db('remote_schedules').insert({
      schedule_name,
      command_type: command_type || 'shutdown',
      schedule_type: schedule_type || 'one_time',
      cron_expression: cron_expression || null,
      next_run_at: new Date(Date.now() + 60 * 60 * 1000), // Default 1 hour from now
      warning_minutes: warning_minutes || 15,
      target_type: target_type || 'single',
      is_active: true,
      created_by: req.user.id
    });

    if (targets && Array.isArray(targets)) {
      for (const targetId of targets) {
        await db('remote_schedule_targets').insert({ schedule_id: scheduleId, target_id: targetId });
      }
    }

    await appendAuditLog('POWER_SCHEDULE_CREATED', req.user.id, null, `Created schedule: ${schedule_name}`, req.ip, { scheduleId, schedule_name }, true);

    return res.json({ success: true, message: 'Power schedule created successfully.', data: { scheduleId } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create power schedule.' });
  }
});

// 13. Protected Devices & Exclusions
router.get('/protected', authenticateToken, requirePermission('remote_device.manage_protected_devices'), async (req, res) => {
  try {
    const protectedList = await db('protected_devices as p')
      .leftJoin('managed_devices as d', 'p.device_id', 'd.device_id')
      .select('p.*', 'd.name as device_name', 'd.ip_address');

    const exclusions = await db('device_exclusions as x')
      .leftJoin('managed_devices as d', 'x.device_id', 'd.device_id')
      .select('x.*', 'd.name as device_name');

    return res.json({ success: true, data: { protectedDevices: protectedList, exclusions } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve protected devices.' });
  }
});

// 14. Agent Deployment Generator
router.get('/agent-deployment', authenticateToken, requirePermission('remote_device.manage_agents'), async (req, res) => {
  try {
    const { department_id } = req.query;
    const provider = await RemoteProviderFactory.getProvider();
    const result = await provider.generateAgentInstaller(department_id || 1, 'Windows');
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to generate agent deployment package.' });
  }
});

// 15. Audit Logs & Chain Verification
router.get('/audit-logs', authenticateToken, requirePermission('remote_device.view_audit_logs'), async (req, res) => {
  try {
    const logs = await db('remote_action_audit_logs as a')
      .leftJoin('users as u', 'a.technician_id', 'u.id')
      .select('a.*', 'u.username as technician_name')
      .orderBy('a.sequence_id', 'desc')
      .limit(100);

    const integrity = await verifyAuditChainIntegrity();

    return res.json({ success: true, data: { logs, auditIntegrity: integrity } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve audit logs.' });
  }
});

// Get Gateway Settings
router.get('/settings', authenticateToken, requirePermission('remote_device.manage_settings'), async (req, res) => {
  try {
    const settings = await db('remote_management_settings').select('*');
    const settingsObj = {};
    settings.forEach(s => { settingsObj[s.setting_key] = s.setting_value; });
    return res.json({ success: true, data: settingsObj });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve settings.' });
  }
});

// Save Gateway Settings
router.post('/settings', authenticateToken, requirePermission('remote_device.manage_settings'), async (req, res) => {
  try {
    const { meshcentral_server_url, meshcentral_api_user, meshcentral_api_token_hash } = req.body;
    
    if (meshcentral_server_url !== undefined) {
      await db('remote_management_settings')
        .where({ setting_key: 'meshcentral_server_url' })
        .update({ setting_value: meshcentral_server_url });
    }
    if (meshcentral_api_user !== undefined) {
      await db('remote_management_settings')
        .where({ setting_key: 'meshcentral_api_user' })
        .update({ setting_value: meshcentral_api_user });
    }
    if (meshcentral_api_token_hash !== undefined) {
      await db('remote_management_settings')
        .where({ setting_key: 'meshcentral_api_token_hash' })
        .update({ setting_value: meshcentral_api_token_hash });
    }

    return res.json({ success: true, message: 'Gateway settings updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update settings.' });
  }
});

// 16. Production Gate Sign-off
router.post('/settings/production-gate/signoff', authenticateToken, requirePermission('remote_device.manage_settings'), async (req, res) => {
  try {
    const { check_code } = req.body;
    if (!check_code) return res.status(400).json({ success: false, message: 'check_code is required.' });

    await db('production_activation_gates')
      .where({ check_code })
      .update({
        is_passed: true,
        passed_at: new Date(),
        signed_off_by: req.user.id
      });

    await appendAuditLog('PRODUCTION_GATE_SIGNED_OFF', req.user.id, null, `Production Gate Signed Off: ${check_code}`, req.ip, { check_code }, false);

    return res.json({ success: true, message: `Production Gate ${check_code} signed off.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to sign off Production Gate item.' });
  }
});

// 17. Remote Agent Heartbeat Endpoint
router.post('/agent/heartbeat', async (req, res) => {
  try {
    const { device_id, agent_version, logged_in_user, ip_address } = req.body;
    if (!device_id) return res.status(400).json({ success: false, message: 'device_id is required.' });

    const device = await db('managed_devices').where({ device_id }).orWhere({ name: device_id }).first();
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found in ITMS managed devices register.' });
    }

    await db('managed_devices')
      .where({ id: device.id })
      .update({
        is_online: true,
        last_heartbeat: new Date(),
        agent_version: agent_version || device.agent_version,
        logged_in_user: logged_in_user || device.logged_in_user,
        ip_address: ip_address || device.ip_address
      });

    return res.json({ success: true, message: 'Heartbeat received.', timestamp: new Date() });
  } catch (err) {
    logger.error(`Remote agent heartbeat error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to record agent heartbeat.' });
  }
});

module.exports = router;
