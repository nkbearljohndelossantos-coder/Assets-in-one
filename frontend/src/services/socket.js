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
    auth: (cb) => {
      const activeToken = localStorage.getItem('accessToken') || localStorage.getItem('token') || token;
      cb({ token: activeToken });
    },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000
  });

  socket.on('connect', () => {
    console.log('Socket.IO connection established.');
  });

  socket.on('notification', (data) => {
    if (onNotificationReceived) {
      onNotificationReceived(data);
    }
  });

  socket.on('connect_error', async (err) => {
    if (err.message === 'Invalid token' || err.message === 'Authentication token required') {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });
          const data = await res.json();
          if (data && data.success && data.data?.accessToken) {
            localStorage.setItem('accessToken', data.data.accessToken);
            socket.auth = { token: data.data.accessToken };
            socket.connect();
            return;
          }
        } catch {
          // Token refresh failed
        }
      }
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
