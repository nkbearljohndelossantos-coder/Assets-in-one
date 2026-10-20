const crypto = require('crypto');
const db = require('../../config/db');
const logger = require('../../utils/logger');
const socketUtil = require('../../utils/socket');
const { appendAuditLog } = require('../../utils/auditChain');
const RemoteProviderFactory = require('../meshcentral/RemoteProviderFactory');

// In-memory replay prevention cache for nonces
const processedNonces = new Set();

/**
 * Register or update a Windows Endpoint Agent telemetry
 */
async function registerEndpointAgent(deviceData) {
  const { device_id, provider_node_id, hostname, logged_in_user, os_name, os_version, agent_version, ip_address, mac_address } = deviceData;

  if (!device_id) {
    throw new Error('device_id is required for agent registration');
  }

  const existing = await db('managed_devices').where({ device_id }).first();
  const now = new Date();

  if (existing) {
    await db('managed_devices').where({ device_id }).update({
      provider_node_id: provider_node_id || existing.provider_node_id,
      name: hostname || existing.name,
      logged_in_user: logged_in_user || existing.logged_in_user,
      os_name: os_name || existing.os_name,
      os_version: os_version || existing.os_version,
      agent_version: agent_version || existing.agent_version,
      ip_address: ip_address || existing.ip_address,
      mac_address: mac_address || existing.mac_address,
      is_online: true,
      last_heartbeat: now,
      updated_at: now
    });
  } else {
    await db('managed_devices').insert({
      device_id,
      provider_node_id: provider_node_id || `NODE-${Date.now()}`,
      name: hostname || `NKB-PC-${device_id}`,
      logged_in_user: logged_in_user || 'NKB\\employee',
      os_name: os_name || 'Windows 11 Pro 23H2',
      os_version: os_version || '10.0.22631',
      agent_version: agent_version || 'v1.2.4-daemon',
      ip_address: ip_address || '192.168.10.100',
      mac_address: mac_address || '00:1A:2B:3C:4D:5E',
      is_online: true,
      remote_access_enabled: true,
      protected_status: false,
      approved_access_mode: 'attended',
      is_simulated: false,
      last_heartbeat: now,
      created_at: now
    });
  }

  logger.info(`[EndpointAgent] Registered endpoint device telemetry for ${device_id} (${hostname})`);
  return { success: true, device_id };
}

/**
 * Process incoming endpoint heartbeat
 */
async function processAgentHeartbeat(deviceId, telemetry) {
  const now = new Date();
  await db('managed_devices').where({ device_id: deviceId }).update({
    is_online: true,
    last_heartbeat: now,
    logged_in_user: telemetry.logged_in_user || undefined,
    ip_address: telemetry.ip_address || undefined,
    updated_at: now
  });

  logger.debug(`[EndpointAgent] Heartbeat received from device ${deviceId}`);
  return { success: true, timestamp: now };
}

/**
 * Deliver Attended Access Request to Endpoint Agent via Socket.IO room device:{deviceId}
 */
async function deliverAccessRequestToEndpoint(requestRecord, technicianName) {
  const io = socketUtil.getIO();
  const roomName = `device:${requestRecord.device_id}`;
  
  const payload = {
    request_id: requestRecord.id,
    request_code: requestRecord.request_code,
    device_id: requestRecord.device_id,
    technician_name: technicianName,
    reason: requestRecord.reason,
    access_type: requestRecord.access_type || 'Full Control',
    timeout_seconds: 300,
    expires_at: requestRecord.expires_at
  };

  if (io) {
    // Broadcast specifically to the endpoint agent room
    io.to(roomName).emit('remote:access_request', payload);
    logger.info(`[EndpointAgent] Emitted remote:access_request to room ${roomName} for request ${requestRecord.request_code}`);
  }

  await appendAuditLog('ATTENDED_REQUEST_DELIVERED', requestRecord.technician_id, requestRecord.device_id, `Request delivered to endpoint agent room ${roomName}`, null, { requestCode: requestRecord.request_code }, true);

  // If in Simulation Mode, trigger an automated native dialog simulation response after 2.5 seconds
  const isSimulation = RemoteProviderFactory.getEffectiveMode() === 'simulation';
  if (isSimulation) {
    simulateEndpointConsentResponse(requestRecord.id, requestRecord.request_code, requestRecord.device_id, requestRecord.technician_id);
  }

  return { delivered: true, roomName };
}

/**
 * Simulate Endpoint Agent Native Windows Dialog response (for Simulation Mode testing)
 */
function simulateEndpointConsentResponse(requestId, requestCode, deviceId, technicianId) {
  setTimeout(async () => {
    try {
      const existing = await db('remote_access_requests').where({ id: requestId }).first();
      if (existing && existing.status === 'pending') {
        const nonce = crypto.randomBytes(16).toString('hex');
        const timestamp = new Date().toISOString();
        
        // Auto-approve simulated request
        await processEndpointDecision({
          request_id: requestId,
          request_code: requestCode,
          device_id: deviceId,
          decision: 'allow',
          nonce,
          timestamp,
          signature: 'SIMULATED_HMAC_SHA256_SIGNATURE'
        });

        logger.info(`[SimulationProvider] Simulated native Windows consent dialog approved for request ${requestCode}`);
      }
    } catch (err) {
      logger.error(`[SimulationProvider] Error in simulated consent response: ${err.message}`);
    }
  }, 2500);
}

/**
 * Process signed endpoint consent decision payload
 */
async function processEndpointDecision(payload) {
  const { request_id, request_code, device_id, decision, nonce, timestamp, signature } = payload;

  if (!request_id || !device_id || !decision || !nonce || !timestamp) {
    throw new Error('Missing required fields in decision payload.');
  }

  // 1. Replay attack prevention check
  if (processedNonces.has(nonce)) {
    throw new Error('Replay attack detected. Nonce has already been processed.');
  }

  // Cache nonce for 10 minutes
  processedNonces.add(nonce);
  setTimeout(() => processedNonces.delete(nonce), 10 * 60 * 1000);

  // 2. Timestamp clock skew check (fail-closed 60 seconds)
  const reqTime = new Date(timestamp).getTime();
  if (Math.isNaN(reqTime) || Math.abs(Date.now() - reqTime) > 60000) {
    throw new Error('Request expired or excessive clock skew.');
  }

  // 3. Fetch request record
  const requestRecord = await db('remote_access_requests')
    .where({ id: request_id, device_id: device_id })
    .first();

  if (!requestRecord) {
    throw new Error('Access request not found for specified device.');
  }

  if (requestRecord.status !== 'pending') {
    throw new Error(`Access request has already been processed with status: ${requestRecord.status}`);
  }

  // Check expiration
  if (new Date() > new Date(requestRecord.expires_at)) {
    await db('remote_access_requests').where({ id: request_id }).update({ status: 'expired' });
    await appendAuditLog('ATTENDED_REQUEST_TIMEOUT', requestRecord.technician_id, device_id, 'Request timed out on endpoint dialog', null, { requestCode: requestRecord.request_code }, true);
    throw new Error('Access request has expired.');
  }

  // 4. Update request status
  const newStatus = decision === 'allow' ? 'approved' : 'denied';
  await db('remote_access_requests').where({ id: request_id }).update({
    status: newStatus,
    endpoint_signature: signature,
    updated_at: new Date()
  });

  const actionLogType = decision === 'allow' ? 'ATTENDED_REQUEST_APPROVED' : 'ATTENDED_REQUEST_DENIED';
  await appendAuditLog(actionLogType, requestRecord.technician_id, device_id, `Native Windows consent dialog decision: ${newStatus}`, null, { requestCode: requestRecord.request_code, decision }, true);

  // 5. Emit Socket.IO event to update Technician UI in real-time
  const io = socketUtil.getIO();
  if (io) {
    io.emit('remote:access_request_updated', {
      requestId: request_id,
      requestCode: requestRecord.request_code,
      deviceId: device_id,
      status: newStatus,
      decision
    });
    io.to(`device:${device_id}`).emit('remote:access_response', {
      requestId: request_id,
      status: newStatus,
      decision
    });
  }

  logger.info(`[EndpointAgent] Successfully processed decision '${newStatus}' for request ${requestRecord.request_code}`);
  return { success: true, status: newStatus };
}

module.exports = {
  registerEndpointAgent,
  processAgentHeartbeat,
  deliverAccessRequestToEndpoint,
  processEndpointDecision
};
