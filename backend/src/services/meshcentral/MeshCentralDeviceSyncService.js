const db = require('../../config/db');
const logger = require('../../utils/logger');

/**
 * Synchronizes device telemetry and online status with MeshCentral.
 */
class MeshCentralDeviceSyncService {
  constructor(wssClient) {
    this.wssClient = wssClient;
  }

  async syncTelemetry(deviceId, cpuPct, ramPct, diskPct) {
    // Record connectivity heartbeat
    await db('device_heartbeats').insert({
      device_id: deviceId,
      is_online: true,
      logged_at: new Date()
    });

    // Record sampled historical telemetry
    await db('remote_telemetry_samples').insert({
      device_id: deviceId,
      cpu_usage_pct: cpuPct,
      ram_usage_pct: ramPct,
      disk_usage_pct: diskPct,
      sampled_at: new Date()
    });

    await db('managed_devices')
      .where({ device_id: deviceId })
      .update({
        is_online: true,
        last_heartbeat: new Date()
      });

    logger.info(`[MeshCentralSync] Telemetry updated for device ${deviceId}`);
  }
}

module.exports = MeshCentralDeviceSyncService;
