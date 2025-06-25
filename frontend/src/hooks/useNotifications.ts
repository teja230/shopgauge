import { useCallback, useRef, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { fetchWithAuth } from '../api';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  read: boolean;
  createdAt: string;
  shop: string;
  category?: string;
  persistent?: boolean; // Whether it should be stored in database
  duration?: number; // Custom duration for toast
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface NotificationOptions {
  persistent?: boolean;
  showToast?: boolean;
  duration?: number;
  category?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced toast configurations
  const toastConfig = {
    success: {
      duration: 4000,
      style: {
        background: '#10b981',
        color: '#ffffff',
        fontWeight: '500',
        borderRadius: '8px',
      },
    },
    error: {
      duration: 6000,
      style: {
        background: '#ef4444',
        color: '#ffffff',
        fontWeight: '500',
        borderRadius: '8px',
      },
    },
    warning: {
      duration: 5000,
      style: {
        background: '#f59e0b',
        color: '#ffffff',
        fontWeight: '500',
        borderRadius: '8px',
      },
    },
    info: {
      duration: 4000,
      style: {
        background: '#3b82f6',
        color: '#ffffff',
        fontWeight: '500',
        borderRadius: '8px',
      },
    },
  };

  // Get appropriate icon for notification type
  const getToastIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  // Unified notification function
  const addNotification = useCallback(async (
    message: string,
    type: Notification['type'] = 'info',
    options: NotificationOptions = {}
  ) => {
    const {
      persistent = false,
      showToast = true,
      duration,
      category,
      action
    } = options;

    const notification: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
      shop: 'current', // This will be set by backend
      category,
      persistent,
      duration: duration || toastConfig[type].duration,
      action,
    };

    // Show toast notification
    if (showToast) {
      const config = {
        ...toastConfig[type],
        duration: duration || toastConfig[type].duration,
        icon: getToastIcon(type),
        id: notification.id, // Prevent duplicates
      };

      switch (type) {
        case 'success':
          toast.success(message, config);
          break;
        case 'error':
          toast.error(message, config);
          break;
        case 'warning':
          toast(message, { ...config, icon: '⚠️' });
          break;
        case 'info':
        default:
          toast(message, { ...config, icon: 'ℹ️' });
          break;
      }
    }

    // Store persistent notifications
    if (persistent) {
      try {
        const response = await fetchWithAuth('/api/auth/shopify/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            type,
            category,
          }),
        });

        if (response.ok) {
          const savedNotification = await response.json();
          setNotifications(prev => [savedNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      } catch (error) {
        console.error('Failed to save persistent notification:', error);
      }
    } else {
      // Add to local state for non-persistent notifications
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    }

    return notification.id;
  }, []);

  // Specific notification functions
  const showSuccess = useCallback((message: string, options?: NotificationOptions) => {
    return addNotification(message, 'success', options);
  }, [addNotification]);

  const showError = useCallback((message: string, options?: NotificationOptions) => {
    return addNotification(message, 'error', options);
  }, [addNotification]);

  const showWarning = useCallback((message: string, options?: NotificationOptions) => {
    return addNotification(message, 'warning', options);
  }, [addNotification]);

  const showInfo = useCallback((message: string, options?: NotificationOptions) => {
    return addNotification(message, 'info', options);
  }, [addNotification]);

  // Enhanced session notification
  const showSessionExpired = useCallback((options: {
    redirect?: boolean;
    redirectDelay?: number;
    showToast?: boolean;
  } = {}) => {
    const {
      redirect = false,
      redirectDelay = 5000,
      showToast = true
    } = options;

    const message = 'Your session has expired. Please sign in again.';

    if (showToast) {
      toast.error(message, {
        duration: 6000,
        position: 'top-center',
        style: {
          background: '#ef4444',
          color: '#ffffff',
          fontWeight: '500',
          borderRadius: '8px',
        },
        icon: '🔒',
      });
    }

    // Add as persistent notification
    addNotification(message, 'error', {
      persistent: true,
      showToast: false,
      category: 'Authentication',
    });

    if (redirect && window.location.pathname !== '/') {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      
      redirectTimeoutRef.current = setTimeout(() => {
        window.location.href = '/';
      }, redirectDelay);
    }
  }, [addNotification]);

  // Connection error notification
  const showConnectionError = useCallback(() => {
    return addNotification(
      'Connection lost. Please check your internet connection.',
      'warning',
      {
        showToast: true,
        persistent: false,
        category: 'Connection',
        duration: 5000,
      }
    );
  }, [addNotification]);

  // Fetch persistent notifications from backend
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    
    try {
      const response = await fetchWithAuth('/api/auth/shopify/notifications');
      if (response.ok) {
        const data = await response.json();
        const persistentNotifications = data.notifications || [];
        setNotifications(prev => {
          // Merge persistent notifications with local ones, avoiding duplicates
          const localNotifications = prev.filter(n => !n.persistent);
          return [...persistentNotifications, ...localNotifications];
        });
        
        const unread = persistentNotifications.filter((n: Notification) => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    
    if (notification?.persistent) {
      try {
        const response = await fetchWithAuth('/api/auth/shopify/notifications/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: notificationId })
        });
        
        if (response.ok) {
          setNotifications(prev => 
            prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
          );
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    } else {
      // Local notification
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, [notifications]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    
    try {
      // Mark persistent notifications as read
      const persistentUnread = unreadNotifications.filter(n => n.persistent);
      await Promise.all(
        persistentUnread.map(n => markAsRead(n.id))
      );

      // Mark local notifications as read
      const localUnread = unreadNotifications.filter(n => !n.persistent);
      if (localUnread.length > 0) {
        setNotifications(prev => 
          prev.map(n => ({ ...n, read: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, [notifications, markAsRead]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    
    if (notification?.persistent) {
      try {
        // TODO: Implement delete API endpoint
        // For now, just remove from local state
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        if (!notification.read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      } catch (error) {
        console.error('Failed to delete notification:', error);
      }
    } else {
      // Local notification
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (!notification?.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
  }, [notifications]);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    toast.dismiss(); // Clear all toasts
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
  }, []);

  // Load notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    // State
    notifications,
    unreadCount,
    loading,

    // Generic notification functions
    addNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,

    // Specific notification functions
    showSessionExpired,
    showConnectionError,

    // Management functions
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    cleanup,
  };
}; 