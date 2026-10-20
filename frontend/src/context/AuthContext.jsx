import React, { createContext, useState, useEffect, useContext } from 'react';
import api, { logoutUser as apiLogout } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [toasts, setToasts] = useState([]);

  // Toast notification helper
  const showToast = (title, message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Check login status on reload
  useEffect(() => {
    const checkLogin = async () => {
      const token = localStorage.getItem('accessToken');
      const savedUser = localStorage.getItem('user');

      if (token && savedUser) {
        try {
          setUser(JSON.parse(savedUser));
          
          // Re-fetch profile to sync permissions
          const response = await api.get('/auth/me');
          if (response.data && response.data.success) {
            const updatedUser = response.data.data;
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            // Connect to real-time notification socket
            const activeToken = localStorage.getItem('accessToken');
            if (activeToken) {
              initSocket(activeToken);
            }
          }
        } catch (err) {
          console.error('Failed to restore user session:', err.message);
          logout();
        }
      }
      setLoading(false);
    };

    checkLogin();
    return () => disconnectSocket();
  }, []);

  // Initialize WebSockets
  const initSocket = (token) => {
    connectSocket(token, (newNotify) => {
      // In-app notification received
      setNotifications(prev => [newNotify, ...prev]);
      setUnreadNotificationsCount(c => c + 1);
      showToast(newNotify.title, newNotify.message, newNotify.type.toLowerCase());
    });

    // Fetch notifications list
    fetchNotifications();
  };

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      if (response.data && response.data.success) {
        setNotifications(response.data.data.notifications);
        setUnreadNotificationsCount(response.data.data.unreadCount);
      }
    } catch (err) {
      console.warn('Failed to load notifications history:', err.message);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      if (response.data && response.data.success) {
        const { accessToken, refreshToken, user: loggedUser } = response.data.data;
        
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(loggedUser));
        
        setUser(loggedUser);
        initSocket(accessToken);
        return { success: true, user: loggedUser };
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please try again.';
      return { success: false, message: msg };
    }
  };

  const logout = () => {
    const refreshToken = localStorage.getItem('refreshToken');
    api.post('/auth/logout', { refreshToken }).catch(() => {});
    
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    setUser(null);
    setNotifications([]);
    setUnreadNotificationsCount(0);
    disconnectSocket();
  };

  const hasPermission = (permissionCode) => {
    if (!user) return false;
    if (user.roles && user.roles.includes('Super Admin')) return true;
    return user.permissions && user.permissions.includes(permissionCode);
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadNotificationsCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const markNotificationAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadNotificationsCount(c => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      hasPermission,
      notifications,
      unreadNotificationsCount,
      fetchNotifications,
      markAllNotificationsAsRead,
      markNotificationAsRead,
      toasts,
      showToast
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
