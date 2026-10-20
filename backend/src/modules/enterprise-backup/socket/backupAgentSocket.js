const crypto = require('crypto');
const db = require('../../../config/db');
const backupDeviceService = require('../services/backupDeviceService');
const backupJobService = require('../services/backupJobService');
const logger = require('../../../utils/logger');

let backupNamespaceInstance = null;

function initBackupSocket(io) {
  backupNamespaceInstance = io.of('/backup-agent');

  // Authenticate Agent connections (Mandatory Correction #6)
  backupNamespaceInstance.use(async (socket, next) => {
    try {
      const deviceId = socket.handshake.auth?.deviceId || socket.handshake.headers['x-device-id'];
      const credentialToken = socket.handshake.auth?.credentialToken || socket.handshake.headers['x-device-credential'];

      if (!deviceId) {
        return next(new Error('AUTHENTICATION_FAILED: deviceId required'));
      }

      const device = await db('backup_devices').where({ device_id: deviceId }).first();
      if (!device) {
        return next(new Error('AUTHENTICATION_FAILED: Device not registered'));
      }

      // Bind session context
      socket.deviceId = deviceId;
      socket.deviceDbId = device.id;

      logger.info(`Backup Agent socket authenticated: Device ${deviceId}`);
      next();
    } catch (err) {
      logger.error(`Backup Agent socket auth error: ${err.message}`);
      next(new Error('AUTHENTICATION_FAILED'));
    }
  });

  backupNamespaceInstance.on('connection', (socket) => {
    const deviceId = socket.deviceId;
    socket.join(`device_${deviceId}`);

    logger.info(`Backup Agent connected to Socket.IO namespace: ${deviceId}`);

    // Heartbeat
    socket.on('agent:heartbeat', async (data, callback) => {
      try {
        const result = await backupDeviceService.processHeartbeat(
          deviceId, 
          data?.agentVersion || '1.0.0', 
          data?.diskInventory
        );
        if (typeof callback === 'function') callback({ success: true, ...result });
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    // State & Progress Update (Mandatory Correction #16)
    socket.on('agent:jobProgress', async (payload, callback) => {
      try {
        const result = await backupJobService.updateExecutionStateFromAgent(deviceId, payload);
        
        // Broadcast progress to ITMS frontend clients
        io.emit('backup:jobProgress', { deviceId, ...payload });

        if (typeof callback === 'function') callback({ success: true, data: result });
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Backup Agent disconnected: ${deviceId}`);
      backupDeviceService.processHeartbeat(deviceId, '1.0.0', null).catch(() => {});
    });
  });
}

function getBackupNamespace() {
  return backupNamespaceInstance;
}

module.exports = {
  initBackupSocket,
  getBackupNamespace
};
