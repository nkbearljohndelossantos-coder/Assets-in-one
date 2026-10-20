const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('./logger');
const db = require('../config/db');
const { hashApiKey } = require('../middleware/deviceAuth');

let ioInstance = null;

/**
 * Initialize Socket.IO server
 * @param {Object} httpServer - Node HTTP server instance
 */
function init(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authenticate: admin JWT OR enrolled MDM device API key
  ioInstance.use(async (socket, next) => {
    try {
      const deviceId = socket.handshake.auth?.deviceId;
      const deviceKey = socket.handshake.auth?.deviceKey;

      if (deviceId && deviceKey) {
        const device = await db('mdm_enrolled_devices')
          .where({ device_id: deviceId, status: 'enrolled' })
          .first();

        if (!device || hashApiKey(deviceKey) !== device.api_key_hash) {
          return next(new Error('Invalid device credentials'));
        }

        socket.isMdmDevice = true;
        socket.mdmDevice = device;
        return next();
      }

      const token = socket.handshake.auth?.token || socket.handshake.headers['authorization']?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_123456_nkb_itms', (err, decoded) => {
        if (err) {
          return next(new Error('Invalid token'));
        }
        socket.user = decoded;
        next();
      });
    } catch (err) {
      logger.error(`Socket auth error: ${err.message}`);
      next(new Error('Authentication failed'));
    }
  });

  ioInstance.on('connection', (socket) => {
    if (socket.isMdmDevice) {
      const device = socket.mdmDevice;
      socket.join('mdm_devices');
      socket.join(`mdm_device_${device.device_id}`);

      db('mdm_enrolled_devices')
        .where('id', device.id)
        .update({ is_online: true, last_seen: new Date() })
        .catch(() => {});

      logger.info(`MDM device connected: ${device.device_name} (${device.device_id})`);

      socket.on('disconnect', () => {
        db('mdm_enrolled_devices')
          .where('id', device.id)
          .update({ is_online: false, updated_at: new Date() })
          .catch(() => {});
        logger.info(`MDM device disconnected: ${device.device_id}`);
      });

      return;
    }

    const userId = socket.user.id;
    const username = socket.user.username;
    const roles = socket.user.roles || [];

    logger.info(`Socket connected: User ${username} (ID: ${userId})`);

    socket.join(`user_${userId}`);

    roles.forEach(role => {
      socket.join(`role_${role}`);
      logger.debug(`User ${username} joined socket room: role_${role}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: User ${username} (ID: ${userId})`);
    });
  });

  return ioInstance;
}

/**
 * Get the initialized io instance
 */
function getIO() {
  if (!ioInstance) {
    throw new Error('Socket.IO is not initialized!');
  }
  return ioInstance;
}

/**
 * Send real-time notification to a specific user
 * @param {number} userId - Target user ID
 * @param {Object} data - Notification object
 */
function notifyUser(userId, data) {
  try {
    const io = getIO();
    io.to(`user_${userId}`).emit('notification', data);
    logger.debug(`Real-time notification emitted to user_${userId}: "${data.title}"`);
  } catch (err) {
    logger.error(`Error sending user notification: ${err.message}`);
  }
}

/**
 * Send real-time notification to a specific role
 * @param {string} roleName - Target role (e.g. 'IT Staff', 'Technician')
 * @param {Object} data - Notification object
 */
function notifyRole(roleName, data) {
  try {
    const io = getIO();
    io.to(`role_${roleName}`).emit('notification', data);
    logger.debug(`Real-time notification emitted to role_${roleName}: "${data.title}"`);
  } catch (err) {
    logger.error(`Error sending role notification: ${err.message}`);
  }
}

/**
 * Broadcast real-time notification to everyone
 * @param {Object} data - Notification object
 */
function broadcast(data) {
  try {
    const io = getIO();
    io.emit('notification', data);
    logger.debug(`Real-time notification broadcasted: "${data.title}"`);
  } catch (err) {
    logger.error(`Error broadcasting notification: ${err.message}`);
  }
}

module.exports = {
  init,
  getIO,
  notifyUser,
  notifyRole,
  broadcast
};
