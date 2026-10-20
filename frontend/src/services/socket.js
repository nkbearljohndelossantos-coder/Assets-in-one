import { io } from 'socket.io-client';

let socket = null;

/**
 * Connect to Socket.IO server
 * @param {string} token - JWT Access Token
 * @param {Function} onNotificationReceived - Callback when a notification is pushed
 */
export const connectSocket = (token, onNotificationReceived) => {
  if (socket) {
    socket.disconnect();
  }

  // Socket connection (uses Vite dev proxy or current domain)
  socket = io('/', {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true
  });

  socket.on('connect', () => {
    console.log('Socket.IO connection established.');
  });

  socket.on('notification', (data) => {
    if (onNotificationReceived) {
      onNotificationReceived(data);
    }
  });

  socket.on('connect_error', (err) => {
    if (err.message === 'Invalid token' || err.message === 'Authentication token required' || err.message.includes('timeout')) {
      console.warn('Socket authentication token expired or invalid. Disconnecting socket until re-login.');
      if (socket) socket.disconnect();
    } else {
      console.warn('Socket connection retry:', err.message);
    }
  });

  return socket;
};

/**
 * Disconnect active Socket.IO connection
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('Socket.IO connection terminated.');
  }
};

export const getSocket = () => socket;
