const logger = require('../../utils/logger');
const socketUtil = require('../../utils/socket');

/**
 * Event consumer listening to MeshCentral WebSocket events.
 */
class MeshCentralEventConsumer {
  constructor(wssClient) {
    this.wssClient = wssClient;
  }

  handleDeviceStatusChange(deviceId, isOnline, ipAddress, loggedInUser) {
    logger.info(`[MeshCentralEvent] Device ${deviceId} status changed. Online: ${isOnline}`);
    const io = socketUtil.getIO();
    if (io) {
      io.emit('remote:device_status', { deviceId, isOnline, ipAddress, loggedInUser, timestamp: new Date() });
    }
  }

  handleSessionEvent(sessionId, eventType, details) {
    logger.info(`[MeshCentralEvent] Session ${sessionId} event: ${eventType}`);
    const io = socketUtil.getIO();
    if (io) {
      io.emit('remote:session_changed', { sessionId, eventType, details, timestamp: new Date() });
    }
  }
}

module.exports = MeshCentralEventConsumer;
