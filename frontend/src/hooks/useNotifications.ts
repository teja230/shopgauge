import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { fetchWithAuth } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotificationSettings } from '../context/NotificationSettingsContext';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  read: boolean;
  createdAt: string;
  shop: string;
  category?: string;
  persistent?: boolean;
  duration?: number;
  scope?: 'store' | 'personal';
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
  scope?: 'store' | 'personal';
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Shared state across all hook instances
let globalNotifications: Notification[] = [];
let globalUnreadCount = 0;
let isLoadingGlobal = false;
let lastFetchTime = 0;
const RATE_LIMIT_MS = 5000; // 5 seconds minimum between API calls

// Global notification tracker for browser alerts and system notifications
let notificationId = 0;

// Local storage key for notifications
const NOTIFICATIONS_STORAGE_KEY = 'storesight_notifications';
const NOTIFICATIONS_STORAGE_VERSION = '1.0';

// Subscribers (setters from hook instances) to propagate updates in real-time
type Subscriber = (notifications: Notification[], unread: number) => void;
const subscribers: Subscriber[] = [];

const broadcast = () => {
  const snapshot = [...globalNotifications];
  const unread = globalUnreadCount;
  subscribers.forEach((cb) => cb(snapshot, unread));
};

// Notification persistence functions
const saveNotificationsToStorage = () => {
  try {
    const data = {
      version: NOTIFICATIONS_STORAGE_VERSION,
      notifications: globalNotifications.slice(0, 20), // Keep only 20 most recent
      timestamp: Date.now()
    };
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save notifications to localStorage:', error);
  }
};

const loadNotificationsFromStorage = () => {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!stored) return;

    const data = JSON.parse(stored);
    
    // Check version compatibility
    if (data.version !== NOTIFICATIONS_STORAGE_VERSION) {
      localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
      return;
    }

    // Check if data is too old (24 hours)
    const dayInMs = 24 * 60 * 60 * 1000;
    if (Date.now() - data.timestamp > dayInMs) {
      localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
      return;
    }

    if (Array.isArray(data.notifications) && data.notifications.length > 0) {
      globalNotifications = data.notifications;
      globalUnreadCount = globalNotifications.filter(n => !n.read).length;
    }
  } catch (error) {
    console.warn('Failed to load notifications from localStorage:', error);
    localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
  }
};

interface UseNotificationsOptions {
  notificationSettings?: {
    showToasts?: boolean;
    soundEnabled?: boolean;
    systemNotifications?: boolean;
    emailNotifications?: boolean;
    marketingNotifications?: boolean;
  };
}

export const useNotifications = (options?: UseNotificationsOptions) => {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    // Load from localStorage on first initialization
    if (globalNotifications.length === 0) {
      loadNotificationsFromStorage();
    }
    return globalNotifications;
  });
  const [unreadCount, setUnreadCount] = useState(() => {
    return globalNotifications.filter(n => !n.read).length;
  });
  const [loading, setLoading] = useState(isLoadingGlobal);
  const [error, setError] = useState<string | null>(null);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { isAuthenticated } = useAuth();
  const { settings: contextNotificationSettings } = useNotificationSettings();
  
  // Load notification settings from context or localStorage fallback
  const notificationSettings = useMemo(() => {
    if (options?.notificationSettings) {
      return options.notificationSettings;
    }
    
    // Use context settings (which are already loaded from localStorage)
    // Ensure we always have a valid settings object
    const settings = contextNotificationSettings || {
      showToasts: true,
      soundEnabled: false,
      systemNotifications: true,
      emailNotifications: true,
      marketingNotifications: false,
    };
    
    return settings;
  }, [options?.notificationSettings, contextNotificationSettings]);
  
  // Override window.confirm to capture confirmations as notifications
  useEffect(() => {
    const originalConfirm = window.confirm;
    const originalAlert = window.alert;

    window.confirm = (message?: string): boolean => {
      const msg = message || 'Confirmation required';
      // Add confirmation request to notifications
      addNotification(
        `System confirmation: ${msg}`,
        'warning',
        {
          persistent: true,
          showToast: false,
          category: 'System',
          scope: 'personal'
        }
      );
      
      return originalConfirm(message);
    };

    window.alert = (message?: string): void => {
      const msg = message || 'Alert';
      // Add alert to notifications
      addNotification(
        `System alert: ${msg}`,
        'error',
        {
          persistent: true,
          showToast: false,
          category: 'System',
          scope: 'personal'
        }
      );
      
      originalAlert(message);
    };

    // Note: We intentionally do NOT restore the original window.alert / window.confirm on unmount.
    // Restoring them caused the notification capturing to break when components using the hook
    // were unmounted (e.g., during client-side navigation). Since this hook can be mounted
    // multiple times across the app, reverting the overrides would leave the app without the
    // desired "System" notifications once the first mounting component unmounts. Keeping the
    // overrides in place for the entire session guarantees that browser alerts and confirmations
    // are always captured and routed into the NotificationCenter.
    return () => {};
  }, []);
  
  // Simple, clean toast styling that matches user's preference
  const createToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    const toastOptions = {
      duration: type === 'error' ? 6000 : 4000,
      style: {
        borderRadius: '8px',
        background: '#333',
        color: '#fff',
        fontWeight: '500',
        padding: '16px',
      },
    };

    const icon = {
      success: '✅',
      error: '❌', 
      warning: '⚠️',
      info: 'ℹ️'
    }[type];

    let toastResult;
    switch (type) {
      case 'success':
        toastResult = toast.success(message, { 
          ...toastOptions, 
          icon, 
          style: { ...toastOptions.style, background: '#059669' }, // Use theme colors
        });
        break;
      case 'error':
        toastResult = toast.error(message, { 
          ...toastOptions, 
          icon, 
          style: { ...toastOptions.style, background: '#dc2626' }, // Use theme colors
        });
        break;
      case 'warning':
        toastResult = toast(message, { 
          ...toastOptions, 
          icon, 
          style: { ...toastOptions.style, background: '#d97706' }, // Use theme colors
        });
        break;
      case 'info':
      default:
        toastResult = toast(message, { 
          ...toastOptions, 
          icon, 
          style: { ...toastOptions.style, background: '#2563eb' }, // Use theme colors
        });
        break;
    }
    
    return toastResult;
  }, []);
  
  // Enhanced notification function with better ID generation and timezone handling
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
      scope = 'personal',
      action
    } = options;

    // Generate unique ID with timestamp
    const id = `notif_${Date.now()}_${++notificationId}_${Math.random().toString(36).substr(2, 9)}`;

    const notification: Notification = {
      id,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(), // Proper ISO 8601 format with timezone
      shop: 'current',
      category,
      persistent,
      duration,
      scope,
      action,
    };

    // Check notification settings before showing toast
    const shouldShowToast = showToast && notificationSettings.showToasts;
    
    if (shouldShowToast) {
      createToast(message, type);
      
      // Play notification sound if enabled
      if (notificationSettings.soundEnabled) {
        try {
          // Create a subtle notification sound
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          // Different tones for different notification types
          const frequencies = {
            success: 800,
            error: 300,
            warning: 600,
            info: 500
          };
          
          oscillator.frequency.setValueAtTime(
            frequencies[type] || 500, 
            audioContext.currentTime
          );
          oscillator.type = 'sine';
          
          // Gentle volume and duration
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
          console.warn('Failed to play notification sound:', error);
        }
      }
    }

    // Add to global notifications first (immediate UI update)
    globalNotifications = [notification, ...globalNotifications.slice(0, 49)]; // Keep max 50 notifications
    globalUnreadCount += 1;
    
    // Update local state immediately
    setNotifications([...globalNotifications]);
    setUnreadCount(globalUnreadCount);
    // Save to localStorage
    saveNotificationsToStorage();
    // Notify other subscribers
    broadcast();

    // Check notification category settings before storing
    const shouldStore = persistent && isAuthenticated && (() => {
      if (category === 'System' && !notificationSettings.systemNotifications) return false;
      if (category === 'Analytics' && !notificationSettings.emailNotifications) return false;
      if (category === 'Marketing' && !notificationSettings.marketingNotifications) return false;
      return true;
    })();

    // Store persistent notifications in backend
    if (shouldStore) {
      try {
        const response = await fetchWithAuth('/api/auth/shopify/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            type,
            category,
            scope,
          }),
        });

        if (response.ok) {
          const savedNotification = await response.json();
          // Update the local notification with backend data
          const index = globalNotifications.findIndex(n => n.id === id);
          if (index !== -1) {
            globalNotifications[index] = { ...savedNotification, ...notification };
            setNotifications([...globalNotifications]);
          }
        }
      } catch (error) {
        console.error('Failed to save persistent notification:', error);
        // Local notification already added, so continue
      }
    }

    return id;
  }, [createToast, isAuthenticated, notificationSettings]);

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

  // Helper functions for different scopes
  const showStoreNotification = useCallback((message: string, type: Notification['type'] = 'info', options?: NotificationOptions) => {
    return addNotification(message, type, { ...options, scope: 'store' });
  }, [addNotification]);

  const showPersonalNotification = useCallback((message: string, type: Notification['type'] = 'info', options?: NotificationOptions) => {
    return addNotification(message, type, { ...options, scope: 'personal' });
  }, [addNotification]);

  // Store-wide notification helpers
  const showStoreSuccess = useCallback((message: string, options?: NotificationOptions) => {
    return showStoreNotification(message, 'success', options);
  }, [showStoreNotification]);

  const showStoreError = useCallback((message: string, options?: NotificationOptions) => {
    return showStoreNotification(message, 'error', options);
  }, [showStoreNotification]);

  const showStoreWarning = useCallback((message: string, options?: NotificationOptions) => {
    return showStoreNotification(message, 'warning', options);
  }, [showStoreNotification]);

  const showStoreInfo = useCallback((message: string, options?: NotificationOptions) => {
    return showStoreNotification(message, 'info', options);
  }, [showStoreNotification]);

  // Session expired notification
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

    // Use addNotification instead of direct createToast to respect settings
    addNotification(message, 'error', {
      persistent: true,
      showToast: showToast, // This will be checked against notificationSettings.showToasts
      category: 'Authentication',
      scope: 'store', // Session expiry affects the entire store
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

  // Enhanced fetchNotifications with better error handling
  const fetchNotifications = useCallback(async () => {
    // Skip if not authenticated to prevent 401 errors and infinite loops
    if (!isAuthenticated) {
      console.log('useNotifications: Skipping fetch - user not authenticated');
      return;
    }
    
    const now = Date.now();
    
    // Rate limiting
    if (now - lastFetchTime < RATE_LIMIT_MS) {
      console.log('Rate limiting: skipping fetch');
      return;
    }
    
    lastFetchTime = now;
    isLoadingGlobal = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth('/api/auth/shopify/notifications');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Ensure we have an array of notifications
      const backendNotifications = Array.isArray(data) ? data : [];
      
      // Validate notification structure
      const validNotifications = backendNotifications.filter((n: any) => {
        return n && typeof n === 'object' && 
               typeof n.id === 'string' && 
               typeof n.message === 'string' &&
               typeof n.type === 'string';
      });
      
      // Merge backend notifications with local ones, avoiding duplicates
      const backendIds = new Set(validNotifications.map((n: Notification) => n.id));
      const localOnlyNotifications = globalNotifications.filter(n => !n.persistent || !backendIds.has(n.id));
      
      globalNotifications = [...localOnlyNotifications, ...validNotifications];
      globalUnreadCount = globalNotifications.filter(n => !n.read).length;
      
      setNotifications([...globalNotifications]);
      setUnreadCount(globalUnreadCount);
      broadcast();
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      
      // Don't clear existing notifications on error, just keep what we have
      setNotifications([...globalNotifications]);
      setUnreadCount(globalUnreadCount);
      broadcast();
    } finally {
      isLoadingGlobal = false;
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Load notifications only once when the first component mounts and user is authenticated
  useEffect(() => {
    // Only fetch if user is authenticated, we haven't loaded yet, and this is the first instance
    if (isAuthenticated && globalNotifications.length === 0 && !isLoadingGlobal) {
      fetchNotifications();
    } else {
      // Sync with global state
      setNotifications([...globalNotifications]);
      setUnreadCount(globalUnreadCount);
    }
  }, [isAuthenticated, fetchNotifications]);

  // Register this hook instance for broadcasts
  useEffect(() => {
    const subscriber: Subscriber = (notifs, count) => {
      setNotifications(notifs);
      setUnreadCount(count);
    };
    subscribers.push(subscriber);
    // Initial sync in case globals changed before mount
    subscriber([...globalNotifications], globalUnreadCount);
    return () => {
      const idx = subscribers.indexOf(subscriber);
      if (idx !== -1) subscribers.splice(idx, 1);
    };
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    const notification = globalNotifications.find(n => n.id === notificationId);
    
    if (notification?.persistent) {
      try {
        const response = await fetchWithAuth('/api/auth/shopify/notifications/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: notificationId })
        });
        
        if (response.ok) {
          // Update global state
          globalNotifications = globalNotifications.map(n => 
            n.id === notificationId ? { ...n, read: true } : n
          );
          if (!notification.read) {
            globalUnreadCount = Math.max(0, globalUnreadCount - 1);
          }
          
          // Update local state
          setNotifications([...globalNotifications]);
          setUnreadCount(globalUnreadCount);
          saveNotificationsToStorage();
          broadcast();
        }
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    } else {
      // Local notification - mark as read locally
      globalNotifications = globalNotifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      );
      if (!notification?.read) {
        globalUnreadCount = Math.max(0, globalUnreadCount - 1);
      }
      
      // Update local state
      setNotifications([...globalNotifications]);
      setUnreadCount(globalUnreadCount);
      saveNotificationsToStorage();
      broadcast();
    }
  }, []);

  // Mark notification as unread
  const markAsUnread = useCallback(async (notificationId: string) => {
    const notification = globalNotifications.find(n => n.id === notificationId);
    
    if (notification?.persistent) {
      try {
        // Note: Backend doesn't support marking as unread, so we'll handle locally
        // In a real implementation, you might want to add a backend endpoint for this
        
        // Update global state
        globalNotifications = globalNotifications.map(n => 
          n.id === notificationId ? { ...n, read: false } : n
        );
        if (notification.read) {
          globalUnreadCount += 1;
        }
        
        // Update local state
        setNotifications([...globalNotifications]);
        setUnreadCount(globalUnreadCount);
        saveNotificationsToStorage();
        broadcast();
      } catch (error) {
        console.error('Failed to mark notification as unread:', error);
      }
    } else {
      // Local notification - mark as unread locally
      globalNotifications = globalNotifications.map(n => 
        n.id === notificationId ? { ...n, read: false } : n
      );
      if (notification?.read) {
        globalUnreadCount += 1;
      }
      
      // Update local state
      setNotifications([...globalNotifications]);
      setUnreadCount(globalUnreadCount);
      saveNotificationsToStorage();
      broadcast();
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    const unreadNotifications = globalNotifications.filter(n => !n.read);
    
    try {
      // Mark persistent notifications as read via API
      const persistentUnread = unreadNotifications.filter(n => n.persistent);
      await Promise.all(
        persistentUnread.map(n => markAsRead(n.id))
      );
      
      // Mark local notifications as read
      const localUnread = unreadNotifications.filter(n => !n.persistent);
      if (localUnread.length > 0) {
        globalNotifications = globalNotifications.map(n => ({ ...n, read: true }));
        globalUnreadCount = 0;
        setNotifications([...globalNotifications]);
        setUnreadCount(globalUnreadCount);
        broadcast();
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, [markAsRead]);

  // Mark all as unread
  const markAllAsUnread = useCallback(async () => {
    const readNotifications = globalNotifications.filter(n => n.read);
    
    try {
      // Mark persistent notifications as unread via API (if supported by backend)
      const persistentRead = readNotifications.filter(n => n.persistent);
      // Note: Backend doesn't support marking as unread, so we'll handle locally only
      
      // Mark all notifications as unread locally
      globalNotifications = globalNotifications.map(n => ({ ...n, read: false }));
      globalUnreadCount = globalNotifications.length;
      setNotifications([...globalNotifications]);
      setUnreadCount(globalUnreadCount);
      broadcast();
      
      console.log('Marked all notifications as unread (local only)');
    } catch (error) {
      console.error('Failed to mark all notifications as unread:', error);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    const notification = globalNotifications.find(n => n.id === notificationId);
    
    if (notification?.persistent) {
      try {
        // Delete from backend
        const response = await fetchWithAuth(`/api/auth/shopify/notifications/${notificationId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          console.error('Failed to delete notification from backend:', response.status);
        }
      } catch (error) {
        console.error('Failed to delete notification from backend:', error);
      }
    }
    
    // Update global state
    globalNotifications = globalNotifications.filter(n => n.id !== notificationId);
    if (notification && !notification.read) {
      globalUnreadCount = Math.max(0, globalUnreadCount - 1);
    }
    
    // Update local state
    setNotifications([...globalNotifications]);
    setUnreadCount(globalUnreadCount);
    saveNotificationsToStorage();
    broadcast();
  }, []);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      if (isAuthenticated) {
      // Delete persistent notifications from backend
      const persistentNotifications = globalNotifications.filter(n => n.persistent);
      if (persistentNotifications.length > 0) {
        await Promise.all(
          persistentNotifications.map(n => 
            fetchWithAuth(`/api/auth/shopify/notifications/${n.id}`, {
              method: 'DELETE'
            }).catch(error => {
              console.error('Failed to delete notification from backend:', error);
            })
          )
        );
        }
      }
    } catch (error) {
      console.error('Failed to clear persistent notifications:', error);
    }
    
    // Clear all notifications from state
    globalNotifications = [];
    globalUnreadCount = 0;
    setNotifications([]);
    setUnreadCount(0);
    saveNotificationsToStorage();
    toast.dismiss(); // Clear all toasts
    broadcast();
  }, [isAuthenticated]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
  }, []);

  return useMemo(() => ({
    // State
    notifications,
    unreadCount,
    loading,
    error,

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
    markAsUnread,
    markAllAsRead,
    markAllAsUnread,
    deleteNotification,
    clearAll,
    cleanup,

    // Store-wide notification helpers
    showStoreSuccess,
    showStoreError,
    showStoreWarning,
    showStoreInfo,
  }), [
    notifications,
    unreadCount,
    loading,
    error,
    addNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showSessionExpired,
    showConnectionError,
    fetchNotifications,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    markAllAsUnread,
    deleteNotification,
    clearAll,
    cleanup,
    showStoreSuccess,
    showStoreError,
    showStoreWarning,
    showStoreInfo,
  ]);
}; 