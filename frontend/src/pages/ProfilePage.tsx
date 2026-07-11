import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { 
  getAuthShop, 
  getStoreStats, 
  forceDisconnectShop, 
  exportData, 
  deleteData, 
  getPrivacyReport,
  API_BASE_URL
} from '../api';
import { AlertTriangle, BarChart3, Check, CheckCircle2, Clock, DollarSign, FileBarChart, FileDown, FileText, Home, Info, Lock, LogOut, Minus, Monitor, Plus, RefreshCw, Scale, ShoppingCart, Store, Trash2, Users, X, XCircle, Zap } from 'lucide-react';
import { normalizeShopDomain } from '../utils/normalizeShopDomain';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import IntelligentLoadingScreen from '../components/ui/IntelligentLoadingScreen';
import useSessionLimit from '../hooks/useSessionLimit';
import SessionLimitDialog from '../components/ui/SessionLimitDialog';

import { getDeviceDisplay, getRelativeTime } from '../utils/deviceUtils';
import { DemoModeBanner } from '../components/ui/DemoModeIndicator';

// Cache configuration for store stats - Enhanced to match Dashboard strategy
const STORE_STATS_CACHE_DURATION = 120 * 60 * 1000; // 120 minutes (match Dashboard)
const STORE_STATS_CACHE_KEY = 'store_stats_cache_v2'; // Updated version
const REFRESH_DEBOUNCE_MS = 120000; // 120 seconds (match Dashboard)
const SESSION_REFRESH_DEBOUNCE_MS = 300000; // 5 minutes for session limit refresh

interface StoreStatsCache {
  data: any;
  timestamp: number;
  lastUpdated: Date;
  shop: string;
  version: string;
}

// Enhanced cache management functions
const loadStoreStatsFromCache = (shop: string): StoreStatsCache | null => {
  try {
    const stored = sessionStorage.getItem(STORE_STATS_CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.shop === shop && parsed.lastUpdated && parsed.version === 'v2') {
        parsed.lastUpdated = new Date(parsed.lastUpdated);
        const age = Date.now() - parsed.timestamp;
        if (age < STORE_STATS_CACHE_DURATION) {
          console.log('Loaded store stats from cache, age:', Math.round(age / 1000), 'seconds');
          return parsed;
        } else {
          console.log('Store stats cache expired, age:', Math.round(age / (1000 * 60)), 'minutes');
        }
      } else {
        console.log('Store stats cache version/shop mismatch, clearing cache');
        sessionStorage.removeItem(STORE_STATS_CACHE_KEY);
      }
    }
  } catch (error) {
    console.warn('Failed to load store stats cache:', error);
    sessionStorage.removeItem(STORE_STATS_CACHE_KEY);
  }
  return null;
};

const saveStoreStatsToCache = (data: any, shop: string) => {
  try {
    const cacheEntry: StoreStatsCache = {
      data,
      timestamp: Date.now(),
      lastUpdated: new Date(),
      shop,
      version: 'v2'
    };
    sessionStorage.setItem(STORE_STATS_CACHE_KEY, JSON.stringify(cacheEntry));
    console.log('Saved store stats to cache with version v2');
  } catch (error) {
    console.warn('Failed to save store stats to cache:', error);
  }
};

export default function ProfilePage() {
  const { shop, logout, setShop, isDemoMode } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isForceDisconnecting, setIsForceDisconnecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [showPrivacyReport, setShowPrivacyReport] = useState(false);
  const [privacyReport, setPrivacyReport] = useState<any>(null);
  const [showStoreSwitcher, setShowStoreSwitcher] = useState(false);
  const [newStoreDomain, setNewStoreDomain] = useState('');
  const [isConnectingStore, setIsConnectingStore] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error' | 'idle'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [storeStats, setStoreStats] = useState<any>(null);
  const [storeStatsLoading, setStoreStatsLoading] = useState(false);
  const [storeStatsLastUpdated, setStoreStatsLastUpdated] = useState<Date | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [refreshDebounce, setRefreshDebounce] = useState(false);
  const [sessionRefreshDebounce, setSessionRefreshDebounce] = useState(false);
  const [sessionRefreshCountdown, setSessionRefreshCountdown] = useState(0);
  const [refreshCountdown, setRefreshCountdown] = useState(0);
  const [pastStores, setPastStores] = useState<string[]>([]);
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
    type: 'info' as 'danger' | 'warning' | 'info',
    size: 'md' as 'sm' | 'md' | 'lg'
  });
  
  const navigate = useNavigate();
  const notifications = useNotifications();
  
  // Session limit management
  const {
    sessionLimitData,
    loading: sessionLimitLoading,
    error: sessionLimitError,
    showSessionDialog,
    lastChecked,
    checkSessionLimit,
    deleteSession,
    deleteSessions,
    closeSessionDialog,
    openSessionDialog,
    refreshSessionData,
  } = useSessionLimit();

  // Session limit manual refresh handler
  const handleRefreshSessionData = async () => {
    if (sessionRefreshDebounce) return;
    
    setSessionRefreshDebounce(true);
    setSessionRefreshCountdown(Math.ceil(SESSION_REFRESH_DEBOUNCE_MS / 1000)); // Convert to seconds
    
    setTimeout(() => {
      setSessionRefreshDebounce(false);
      setSessionRefreshCountdown(0);
    }, SESSION_REFRESH_DEBOUNCE_MS);
    
    await refreshSessionData();
  };

  // Countdown timer for session refresh cooldown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (sessionRefreshCountdown > 0) {
      interval = setInterval(() => {
        setSessionRefreshCountdown(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionRefreshCountdown]);

  // Save current store to past stores when shop changes
  useEffect(() => {
    if (shop) {
      const stored = localStorage.getItem('storesight_past_stores');
      let pastStoresList: string[] = [];
      
      if (stored) {
        try {
          pastStoresList = JSON.parse(stored);
        } catch (error) {
          console.error('Failed to parse past stores:', error);
        }
      }

      // Add current shop to past stores if not already there
      if (!pastStoresList.includes(shop)) {
        pastStoresList.unshift(shop); // Add to beginning
        // Keep only last 5 stores
        pastStoresList = pastStoresList.slice(0, 5);
        localStorage.setItem('storesight_past_stores', JSON.stringify(pastStoresList));
      }
      
      // Update past stores state (excluding current shop)
      setPastStores(pastStoresList.filter(store => store !== shop));
    }
  }, [shop]);

  // Handle success callback from OAuth - FIXED: Direct Dashboard redirect without nested params
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const connected = searchParams.get('connected');
    const reauth = searchParams.get('reauth');

    if (connected === 'true') {
      notifications.showSuccess('🔗 Store connected successfully!', {
        persistent: true,
        category: 'Store Connection',
        action: {
          label: 'View Dashboard',
          onClick: () => navigate('/dashboard')
        }
      });
      
      // Clean up URL
      window.history.replaceState({}, document.title, '/profile');
    }

    if (reauth === 'success') {
      notifications.showSuccess('Re-authentication successful.', {
        persistent: true,
        category: 'Authentication',
        action: {
          label: 'View Dashboard',
          onClick: () => navigate('/dashboard')
        }
      });
      
      // Clean up URL
      window.history.replaceState({}, document.title, '/profile');
    }
  }, [location.search, navigate, notifications]);

  // Check connection status and load store stats
  useEffect(() => {
    if (shop) {
      checkConnectionStatus();
      loadStoreStats();
    }
  }, [shop]);

  // Auto-load session data when user visits Profile page (optional: can be disabled)
  // This provides immediate session information without requiring manual refresh
  // Benefits: Users see their sessions immediately, better UX
  // Alternative: Remove this effect to require manual "Refresh Sessions" click
  useEffect(() => {
    if (shop && !sessionLimitData && !sessionLimitLoading) {
      console.log('ProfilePage: Auto-loading session data on page load for better UX');
      checkSessionLimit();
    }
  }, [shop, sessionLimitData, sessionLimitLoading, checkSessionLimit]);

  const checkConnectionStatus = async () => {
    try {
      setConnectionStatus('checking');
      const shopData = await getAuthShop();
      
      if (shopData) {
        setConnectionStatus('connected');
        setLastSyncTime(new Date());
        return { connected: true, error: null };
      } else {
        setConnectionStatus('error');
        return { connected: false, error: 'Connection check failed' };
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      setConnectionStatus('error');
      return { connected: false, error: 'Network error' };
    }
  };

  const loadStoreStats = async (forceRefresh = false) => {
    if (!shop) return;
    
    try {
      setStoreStatsLoading(true);
      
      // Check cache first unless force refresh
      if (!forceRefresh) {
        const cache = loadStoreStatsFromCache(shop);
        if (cache) {
          setStoreStats(cache.data);
          setStoreStatsLastUpdated(cache.lastUpdated);
          setStoreStatsLoading(false);
          return;
        }
      }
      
      const stats = await getStoreStats();
      setStoreStats(stats);
      const now = new Date();
      setStoreStatsLastUpdated(now);
      saveStoreStatsToCache(stats, shop);
    } catch (error) {
      console.error('Failed to load store stats:', error);
    } finally {
      setStoreStatsLoading(false);
    }
  };

  const handleRefreshStoreStats = async () => {
    if (refreshDebounce) return;
    
    setRefreshDebounce(true);
    setRefreshCountdown(Math.ceil(REFRESH_DEBOUNCE_MS / 1000));
    
    // Start countdown timer
    const countdownInterval = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setRefreshDebounce(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    try {
      // Clear backend Redis cache first (if available) - skip for demo mode
      const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                        new URLSearchParams(window.location.search).get('demo') === 'true';
      
      if (shop && !isDemoMode) {
        try {
          console.log('🗑️ Clearing backend cache for store stats:', shop);
          const response = await fetch('/api/analytics/cache/invalidate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include'
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('✅ Backend cache cleared for store stats:', result);
            // Remove technical notification - users don't need backend details
          } else {
            console.warn('⚠️ Backend cache clearing failed, continuing with frontend refresh');
          }
        } catch (error) {
          console.warn('⚠️ Backend cache clearing failed:', error, 'continuing with frontend refresh');
        }
      } else if (isDemoMode) {
        console.log('🔄 Demo mode: Skipping backend cache invalidation');
      }
      
      // Clear frontend cache and load fresh data
      sessionStorage.removeItem(STORE_STATS_CACHE_KEY);
    await loadStoreStats(true);
      
      notifications.showSuccess('Store statistics updated', { duration: 3000 });
    } catch (error) {
      console.error('Failed to refresh store stats:', error);
      notifications.showError('Unable to update statistics. Please try again.', { duration: 3000 });
    }
  };

  // FIXED: Use simple return URL format to avoid Chrome phishing warnings
  const handleReAuthenticate = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Re-authenticate Session',
      message: 'You will be redirected to the Dashboard to re-authenticate your Shopify connection. This will ensure your data is up-to-date. Do you want to proceed?',
      type: 'info',
      size: 'md',
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        notifications.showInfo('Redirecting to dashboard for re-authentication...', {
          category: 'Store Connection',
      });
        window.location.href = '/dashboard?re-auth=true';
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }
    });
  };

  const handleShopDisconnect = async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Disconnect Store',
      message: 'Are you sure you want to disconnect your store? You will need to re-authenticate to see your data again.',
      type: 'warning',
      size: 'md',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        
        try {
          notifications.showInfo('Disconnecting store...', {
            category: 'Store Connection',
            duration: 3000
          });
          
      // Use the AuthContext logout function which properly handles state clearing
      await logout();
          
          notifications.showSuccess('Store disconnected successfully!', {
            persistent: true,
            category: 'Store Connection'
          });
          
          // Redirect to home page after disconnect
          setTimeout(() => {
            navigate('/');
          }, 1500);
    } catch (error) {
      console.error('Error disconnecting shop:', error);
      notifications.showError('Unable to disconnect store at this time. Please try again later.', {
        persistent: true,
        category: 'Store Connection'
      });
    }
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleForceDisconnect = async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Force Disconnect',
      message: 'FORCE DISCONNECT - Use only if normal disconnect fails\n\nThis will:\n• Clear ALL authentication tokens and cookies\n• Force logout from all sessions\n• Remove all cached data\n• Require fresh authentication\n\nUse this only if you\'re experiencing authentication issues.\n\nProceed with force disconnect?',
      type: 'danger',
      size: 'lg',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        
    setIsForceDisconnecting(true);
    console.log('Force disconnect: Starting with shop:', shop);
    
    if (!shop) {
      notifications.showError('No store information available for disconnection.', {
        category: 'Store Connection'
      });
      setIsForceDisconnecting(false);
      return;
    }
    
    try {
          notifications.showInfo('Force disconnecting...', {
            category: 'Store Connection',
            duration: 5000
          });
          
      console.log('Force disconnect: Calling API with shop:', shop);
      const data = await forceDisconnectShop(shop);
      
      console.log('Force disconnect: Response data:', data);
      
      // Clear all caches
      sessionStorage.clear();
      localStorage.clear();
      
      notifications.showSuccess('Force disconnect successful! All tokens and cookies cleared.', {
        persistent: true,
        category: 'Store Connection',
        duration: 8000
      });
      console.log('Force disconnect: Success, redirecting to home');
      
      // Redirect after a delay
      setTimeout(() => {
        navigate('/');
        window.location.reload(); // Force full page reload to clear any remaining state
      }, 2000);
    } catch (error: any) {
      console.error('Force disconnect: Network error:', error);
      // Show the actual server error message if available
      const errorMessage = error?.response?.data?.message || error?.message || 'Network error';
      notifications.showError('Unable to complete force disconnect. Please try again or contact support if the issue persists.', {
        persistent: true,
        category: 'Store Connection'
      });
    } finally {
      setIsForceDisconnecting(false);
    }
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDataExport = async () => {
    setIsExporting(true);
    notifications.showInfo('Preparing data export...', {
      category: 'Data Privacy',
      duration: 5000
    });
    
    try {
      const response = await exportData();
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `storesight-data-export-${shop}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        notifications.showSuccess('📥 Data export completed successfully!', {
          persistent: true,
          category: 'Data Privacy',
          action: {
            label: 'Download Again',
            onClick: () => handleDataExport()
          }
        });
      } else {
        const error = await response.json();
        notifications.showError('Unable to export data at this time. Please try again later.', {
          persistent: true,
          category: 'Data Privacy'
        });
      }
    } catch (error: any) {
      console.error('Data export failed:', error);
      // Show the actual server error message if available
      const errorMessage = error?.response?.data?.message || error?.message || 'Network error';
      notifications.showError('Unable to export data at this time. Please try again later.', {
        persistent: true,
        category: 'Data Privacy'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDataDeletion = async () => {
    // First confirmation
    setConfirmDialog({
      isOpen: true,
      title: 'Permanent Data Deletion',
      message: 'PERMANENT DATA DELETION\n\nThis will permanently delete ALL your data from our systems including:\n• Order history and analytics\n• Revenue data and metrics\n• Store configuration and settings\n• Audit logs and access history\n\nThis action CANNOT be undone.\n\nAre you absolutely sure you want to proceed?',
      type: 'danger',
      size: 'lg',
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        
        // Second confirmation
        setTimeout(() => {
          setConfirmDialog({
            isOpen: true,
            title: 'Final Confirmation',
            message: `FINAL CONFIRMATION\n\nYou are about to PERMANENTLY DELETE all your data.\n\nStore domain: ${shop}\n\nThis is your LAST CHANCE to cancel.\n\nProceed with permanent deletion?`,
            type: 'danger',
            size: 'lg',
            onConfirm: async () => {
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
              await performDataDeletion();
            },
            onCancel: () => {
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            }
          });
        }, 100);
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const performDataDeletion = async () => {

    setIsDeletingData(true);
    notifications.showInfo('Permanently deleting all data...', {
      category: 'Data Privacy',
      duration: 10000
    });
    
    try {
      const result = await deleteData('ALL_SHOP_DATA');
      notifications.showSuccess('🗑️ All data has been permanently deleted from our systems!', {
        persistent: true,
        category: 'Data Privacy',
        duration: 8000
      });
      console.log('Data deletion completed:', result);
      
      // Clear all local data and logout
      sessionStorage.clear();
      localStorage.clear();
      
      // Logout after successful deletion
      setTimeout(() => {
        logout();
      }, 3000);
    } catch (error: any) {
      console.error('Data deletion failed:', error);
      // Show the actual server error message if available
      const errorMessage = error?.response?.data?.message || error?.message || 'Network error';
      notifications.showError('Unable to delete data at this time. Please try again later.', {
        persistent: true,
        category: 'Data Privacy'
      });
    } finally {
      setIsDeletingData(false);
    }
  };

  const handlePrivacyReport = async () => {
    try {
      const report = await getPrivacyReport();
      setPrivacyReport(report);
      setShowPrivacyReport(true);
      notifications.showSuccess('Privacy report generated successfully!', {
        category: 'Data Privacy'
      });
    } catch (error: any) {
      console.error('Privacy report failed:', error);
      // Show the actual server error message if available
      const errorMessage = error?.response?.data?.message || error?.message || 'Network error';
      notifications.showError('Unable to generate privacy report at this time. Please try again later.', {
        persistent: true,
        category: 'Data Privacy'
      });
    }
  };

  // Comprehensive cache clearing function
  const clearAllDashboardCache = () => {
    // Clear all known dashboard cache keys
    sessionStorage.removeItem('dashboard_cache_v1.1');
    sessionStorage.removeItem('dashboard_cache_v2');
    
    // Also clear any other potential cache keys
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('dashboard_cache') || key.includes('unified_analytics_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    
    console.log('Cleared all dashboard and unified analytics cache keys');
  };

  // Enhanced cache clearing function with backend integration
  const clearCacheAndRefresh = async () => {
    try {
      // Step 1: Clear backend Redis cache
      if (shop) {
        try {
          console.log('🗑️ Clearing backend Redis cache for comprehensive refresh');
          const response = await fetch('/api/analytics/cache/invalidate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include'
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('✅ Backend cache cleared successfully:', result);
            // Remove technical notification
          } else {
            console.warn('⚠️ Backend cache clearing failed');
          }
        } catch (error) {
          console.warn('⚠️ Backend cache clearing failed:', error);
        }
      }
      
      // Step 2: Clear all frontend dashboard caches
      clearAllDashboardCache();
      
      // Step 3: Clear Profile page cache
      sessionStorage.removeItem(STORE_STATS_CACHE_KEY);
      
      notifications.showSuccess('Data refreshed successfully', {
        category: 'Cache Management',
        duration: 3000
      });
      
      // Refresh store stats to show updated data
      await loadStoreStats(true);
      
    } catch (error) {
      console.error('Failed to clear cache and refresh:', error);
      notifications.showError('Unable to refresh data. Please try again.', { duration: 3000 });
    }
  };

  // FIXED: Connect new store with Dashboard redirect  
  const handleConnectNewStore = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDomain = normalizeShopDomain(newStoreDomain);
    if (!cleanDomain) {
      notifications.showError('Please enter a valid Shopify store domain or URL.', {
        category: 'Validation'
      });
      return;
    }

    setIsConnectingStore(true);
    notifications.showInfo('Connecting to new store...', {
      category: 'Store Connection',
      duration: 5000
    });
    
    try {
      // Clear all dashboard caches before switching stores
      clearAllDashboardCache();
      notifications.showInfo('Preparing fresh data from new store...', {
        category: 'Store Connection',
        duration: 3000
      });
      
      // FIXED: Use dashboard redirect for new store connection 
      const baseUrl = `${window.location.origin}/dashboard`;
      const returnUrl = encodeURIComponent(`${baseUrl}?connected=true`);

      // Redirect to the login endpoint with the normalized shop parameter
      window.location.href = `${API_BASE_URL}/api/auth/shopify/login?shop=${encodeURIComponent(cleanDomain)}&return_url=${returnUrl}`;
    } catch (error) {
      console.error('Failed to connect new store:', error);
      notifications.showError('Unable to connect store at this time. Please try again later.', {
        persistent: true,
        category: 'Store Connection'
      });
    } finally {
      setIsConnectingStore(false);
    }
  };

  // FIXED: Reconnect past store with Dashboard redirect
  const handleReconnectPastStore = (pastStore: string) => {
    notifications.showInfo(`Reconnecting to ${pastStore}...`, {
      category: 'Store Connection',
      duration: 5000
    });
    
    // Clear all dashboard caches before switching stores
    clearAllDashboardCache();
    notifications.showInfo('Preparing fresh data from reconnected store...', {
      category: 'Store Connection',
      duration: 3000
    });
    
    // FIXED: Use dashboard redirect for past store reconnection
    const baseUrl = `${window.location.origin}/dashboard`;
    const returnUrl = encodeURIComponent(`${baseUrl}?reconnected=true`);
    
    window.location.href = `${API_BASE_URL}/api/auth/shopify/login?shop=${encodeURIComponent(pastStore)}&return_url=${returnUrl}`;
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-[#059669]';
      case 'error': return 'text-red-600';
      default: return 'text-[#f59e0b]';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <CheckCircle2 className="h-5 w-5 text-[#059669]" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-600" />;
      default: return <Clock className="h-5 w-5 text-[#f59e0b]" />;
    }
  };

  const handleCheckConnection = async () => {
    setIsCheckingConnection(true);
    notifications.showInfo('Checking store connection...', { category: 'Store Connection' });
    const status = await checkConnectionStatus();
    setIsCheckingConnection(false);
    
    if (status.connected) {
      notifications.showSuccess('Connection successful!', {
        category: 'Store Connection',
        duration: 3000
      });
    } else {
      notifications.showError(`Connection failed: ${status.error}`, {
        category: 'Store Connection',
        persistent: true
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7f9] px-4 py-6 sm:px-6">
      <DemoModeBanner />
      <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 overflow-hidden rounded-lg border border-white/10 bg-[#101820] p-6 text-white md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-black uppercase text-[#9db4ff]">Account</p>
          <h1 className="mt-1 text-2xl font-black leading-tight text-white">Profile & Settings</h1>
          <p className="mt-1.5 text-sm leading-6 text-[#c3ccd5]">Manage your store connection, data privacy, and account settings.</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5 self-start rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#c3ccd5] md:self-auto">
          <span className={`h-2 w-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-[#15b87a]' :
            connectionStatus === 'error' ? 'bg-red-400' : 'bg-[#f59e0b]'
          }`} />
          {shop}
        </div>
      </div>

      {/* Store Information - Enhanced */}
      <div className="animate-slideUp motion-reduce:animate-none rounded-lg border border-[#e4e7eb] bg-white p-6 shadow-[0_18px_42px_-36px_rgba(16,24,32,0.75)]" style={{ animationDelay: '0ms', animationFillMode: 'both' }}>
        <h2 className="text-xl font-black text-[#101820] mb-6 flex items-center">
          <Store className="w-5 h-5 mr-3 text-[#2f5bea]" />
          Store Information
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Store Details */}
        <div className="space-y-6">
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Store</label>
              <div className="flex items-center space-x-3">
                <div className="flex-1 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200">
                    <span className="text-gray-900 font-mono text-sm">{shop}</span>
                  </div>
                <div className={`flex items-center ${getConnectionStatusColor()}`}>
                  <span className="mr-2 inline-flex">{getConnectionStatusIcon()}</span>
                  <span className="text-sm font-medium capitalize">{connectionStatus}</span>
          </div>
        </div>
      </div>

              <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Connection Status</label>
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-[#059669]' :
                  connectionStatus === 'error' ? 'bg-red-500' : 'bg-[#f59e0b]'
                }`}></div>
                <span className="text-sm text-gray-600">
                  {connectionStatus === 'connected' ? 'Active Shopify Integration' :
                   connectionStatus === 'error' ? 'Connection Issue Detected' :
                   'Checking Connection...'}
                </span>
              </div>
            </div>
            
            {storeStats && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Store Statistics</label>
                  <button
                    onClick={handleRefreshStoreStats}
                    disabled={storeStatsLoading || refreshDebounce}
                    className="text-xs text-[#2f5bea] hover:text-[#1539a6] disabled:text-gray-400 flex items-center gap-1"
                  >
                    {storeStatsLoading ? (
                      <>
                        <div className="w-3 h-3 border border-[#2f5bea] border-t-transparent rounded-full animate-spin"></div>
                        Updating...
                      </>
                    ) : refreshDebounce ? (
                      <>
                        <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                        Wait {refreshCountdown}s
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3" />
                        Update Stats
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="group relative overflow-hidden rounded-lg border border-[#e4e7eb] bg-white p-3 shadow-[0_18px_42px_-36px_rgba(16,24,32,0.75)] transition-all duration-200 hover:-translate-y-px hover:border-[#2f5bea]/40">
                    <div className="pointer-events-none absolute -right-6 -top-8 h-16 w-16 rounded-full bg-[#2f5bea] opacity-10 blur-2xl" />
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-[#2f5bea]/20 bg-[#2f5bea]/10">
                      <ShoppingCart className="h-4 w-4 text-[#2f5bea]" />
                    </div>
                    <div className="text-2xl font-black text-[#101820]" style={{ fontFeatureSettings: '"tnum"' }}>{storeStats.totalOrders || 0}</div>
                    <div className="text-xs font-black uppercase tracking-[0.08em] text-[#5f6b76]">Orders</div>
                  </div>
                  <div className="group relative overflow-hidden rounded-lg border border-[#e4e7eb] bg-white p-3 shadow-[0_18px_42px_-36px_rgba(16,24,32,0.75)] transition-all duration-200 hover:-translate-y-px hover:border-[#059669]/40">
                    <div className="pointer-events-none absolute -right-6 -top-8 h-16 w-16 rounded-full bg-[#059669] opacity-10 blur-2xl" />
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-[#059669]/20 bg-[#059669]/10">
                      <DollarSign className="h-4 w-4 text-[#059669]" />
                    </div>
                    <div className="text-2xl font-black text-[#101820]" style={{ fontFeatureSettings: '"tnum"' }}>${Number(storeStats.totalRevenue || 0).toLocaleString()}</div>
                    <div className="text-xs font-black uppercase tracking-[0.08em] text-[#5f6b76]">Revenue</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2 space-y-1">
                  <div className="flex items-center justify-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Data reflects the last 60 days of activity
                  </div>
                  {storeStatsLastUpdated && (
                    <div className="text-center">
                      Last updated: {storeStatsLastUpdated.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Right Column - Sync & Actions */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Data Sync</label>
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                {lastSyncTime?.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
              
              <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Data Collection</label>
              <div className="flex items-center space-x-2 bg-gray-50 p-3 rounded-lg">
                  <div className="w-2 h-2 bg-[#2f5bea] rounded-full"></div>
                <span className="text-sm text-gray-600">Orders, Analytics, Revenue & Metrics</span>
                </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleCheckConnection}
                disabled={connectionStatus === 'checking'}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2f5bea] disabled:opacity-50"
              >
                {connectionStatus === 'checking' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-500 border-t-transparent -ml-1 mr-2"></div>
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Check Connection
                  </>
                )}
              </button>

              <button
                onClick={clearCacheAndRefresh}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-[#2f5bea]/32 text-sm font-medium rounded-lg text-[#1d3db8] bg-[#2f5bea]/6 hover:bg-[#2f5bea]/12 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2f5bea]"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Clear All Caches & Refresh
              </button>
              </div>
            </div>
          </div>
          
        {/* Re-authenticate Section */}
        <div className="border-t pt-6 mt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
              <span className="font-medium">Having connection issues?</span>
              <p className="text-xs text-gray-500 mt-1">Re-authenticate with Shopify to refresh your connection</p>
              </div>
              <button
                onClick={handleReAuthenticate}
                disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2f5bea] disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-500 border-t-transparent -ml-1 mr-2"></div>
                    Re-authenticating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Re-authenticate
                  </>
                )}
              </button>
          </div>
        </div>
      </div>

      {/* Store Management Section - Enhanced */}
      <div className="animate-slideUp motion-reduce:animate-none rounded-lg border border-[#e4e7eb] bg-white p-6 shadow-[0_18px_42px_-36px_rgba(16,24,32,0.75)]" style={{ animationDelay: '60ms', animationFillMode: 'both' }}>
        <h2 className="text-xl font-black text-[#101820] mb-6 flex items-center">
          <RefreshCw className="w-5 h-5 mr-3 text-[#2f5bea]" />
          Store Management
        </h2>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Switch or Add Store</h3>
              <p className="text-sm text-gray-600">Connect additional stores or switch between connected stores</p>
            </div>
            <button
              onClick={() => setShowStoreSwitcher(!showStoreSwitcher)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2f5bea] transition-colors"
            >
              {showStoreSwitcher ? (
                <Minus className="w-4 h-4 mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {showStoreSwitcher ? 'Hide Store Manager' : 'Manage Stores'}
            </button>
          </div>
          
          {showStoreSwitcher && (
            <div className="border-t pt-6 space-y-6">
              {/* Current Store - Enhanced */}
              <div className="bg-[#f9fafb] p-5 rounded-lg border border-[#e4e7eb]">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-[#101820] mb-1">Current Store</h4>
                    <p className="text-[#1d3db8] font-mono text-sm">{shop}</p>
                    <p className="text-xs text-[#2f5bea] mt-1">
                      Connected • Last sync: {lastSyncTime?.toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center text-[#2f5bea]">
                    <Store className="w-6 h-6 mr-2" />
                    <div className="text-right">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-[#059669] rounded-full mr-2"></div>
                    <span className="text-sm font-medium">Active</span>
                      </div>
                      {storeStats && (
                        <div className="text-xs text-[#2f5bea] mt-1">
                          {Number(storeStats.totalOrders).toLocaleString()} orders • ${Number(storeStats.totalRevenue).toLocaleString()} revenue (60d)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Past Stores - New Section */}
              {pastStores.length > 0 && (
                <div className="bg-[#f9fafb] p-5 rounded-lg border border-[#e4e7eb]">
                  <h4 className="font-black text-[#101820] mb-3 flex items-center">
                    <span className="mr-2">🕒</span>
                    Recent Stores
                  </h4>
                  <div className="space-y-2">
                    {pastStores.slice(0, 3).map((pastStore, index) => (
                      <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-[#7c9cff] rounded-full mr-3"></div>
                          <span className="text-sm font-mono text-gray-700">{pastStore}</span>
                        </div>
                        <button
                          onClick={() => handleReconnectPastStore(pastStore)}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded-md text-[#1d3db8] bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2f5bea] transition-colors"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Reconnect
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connect New Store - Enhanced */}
              <div className="bg-[#f9fafb] p-5 rounded-lg border border-[#e4e7eb]">
                <h4 className="font-black text-[#101820] mb-3 flex items-center">
                  <span className="mr-2">➕</span>
                  Connect New Store
                </h4>
                <form onSubmit={handleConnectNewStore} className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                  <input
                    type="text"
                    value={newStoreDomain}
                    onChange={(e) => setNewStoreDomain(e.target.value)}
                    placeholder="Enter store name or full URL"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2f5bea] focus:border-[#2f5bea] text-sm"
                    disabled={isConnectingStore}
                  />
                    </div>
                  <button
                    type="submit"
                      disabled={isConnectingStore || !normalizeShopDomain(newStoreDomain)}
                      className="inline-flex items-center px-5 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-[#2f5bea] hover:bg-[#1d3db8] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2f5bea] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isConnectingStore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent -ml-1 mr-2"></div>
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Connect Store
                      </>
                    )}
                  </button>
                  </div>
                  <div className="text-xs text-gray-500 bg-[#2f5bea]/6 p-3 rounded-lg border border-[#2f5bea]/18">
                    <div className="flex items-start">
                      <Info className="w-4 h-4 mr-2 mt-0.5 text-[#2f5bea] flex-shrink-0" />
                      <div>
                        <p className="font-medium text-[#1539a6] mb-1">Quick Connect Process:</p>
                        <p className="text-[#1d3db8]">• Enter store name or .myshopify.com URL</p>
                        <p className="text-[#1d3db8]">• Authorize via Shopify (secure OAuth)</p>
                        <p className="text-[#1d3db8]">• Automatically redirected to Dashboard</p>
                        <p className="text-[#2f5bea] mt-2 text-xs italic">
                          Same-account stores connect instantly with success notification.
                        </p>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
              
              {/* Quick Actions - Enhanced */}
              <div className="bg-[#f9fafb] p-5 rounded-lg border border-[#e4e7eb]">
                <h4 className="font-black text-[#101820] mb-4 flex items-center">
                  <span className="mr-2">⚡</span>
                  Quick Actions
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => navigate('/')}
                    className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2f5bea] transition-colors"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Home
                  </button>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="inline-flex items-center justify-center px-3 py-2 border border-[#2f5bea]/32 text-sm font-medium rounded-lg text-[#1d3db8] bg-[#2f5bea]/6 hover:bg-[#2f5bea]/12 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2f5bea] transition-colors"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Dashboard
                  </button>
                  <button
                    onClick={() => navigate('/competitors')}
                    className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2f5bea] transition-colors"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Market Intelligence
                  </button>
                  <button
                    onClick={clearCacheAndRefresh}
                    className="inline-flex items-center justify-center px-3 py-2 border border-[#15b87a]/30 text-sm font-medium rounded-lg text-[#047857] bg-[#15b87a]/10 hover:bg-[#15b87a]/14 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#059669] transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Privacy & Data Rights Section - Enhanced */}
      <div className="animate-slideUp motion-reduce:animate-none rounded-lg border border-[#e4e7eb] bg-white p-6 shadow-[0_18px_42px_-36px_rgba(16,24,32,0.75)]" style={{ animationDelay: '120ms', animationFillMode: 'both' }}>
        <h2 className="text-xl font-black text-[#101820] mb-4 flex items-center">
          <Lock className="w-5 h-5 mr-3 text-[#2f5bea]" />
          Privacy & Data Rights
        </h2>
        <p className="text-sm text-[#5f6b76] mb-6">
          ShopGauge respects your privacy and provides full transparency about data processing. 
          Exercise export, deletion, and anonymization requests using the controls below. These controls support privacy-request handling but are not a legal certification.
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Data Access & Export */}
          <div className="bg-[#f9fafb] p-5 rounded-lg border border-[#e4e7eb]">
            <h3 className="font-black text-[#101820] mb-3 flex items-center">
              <FileText className="mr-2 h-5 w-5 text-[#2f5bea]" />
              Data Access & Export
            </h3>
          <div className="space-y-3">
            <button
              onClick={handlePrivacyReport}
                className="w-full inline-flex items-center justify-center px-4 py-3 border border-[#2f5bea]/32 text-sm font-medium rounded-lg text-[#1d3db8] bg-[#2f5bea]/6 hover:bg-[#2f5bea]/12 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2f5bea] transition-colors"
            >
                <FileBarChart className="w-4 h-4 mr-2" />
                View Privacy Report
            </button>
            
            <button
              onClick={handleDataExport}
              disabled={isExporting}
                className="w-full inline-flex items-center justify-center px-4 py-3 border border-[#15b87a]/30 text-sm font-medium rounded-lg text-[#047857] bg-[#15b87a]/10 hover:bg-[#15b87a]/14 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#059669] disabled:opacity-50 transition-colors"
            >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#059669] border-t-transparent -ml-1 mr-2"></div>
                    Exporting Data...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4 mr-2" />
                    Export My Data
                  </>
                )}
            </button>
            </div>
          </div>
          
          {/* Legal & Compliance */}
          <div className="bg-[#f9fafb] p-5 rounded-lg border border-[#e4e7eb]">
            <h3 className="font-black text-[#101820] mb-3 flex items-center">
              <Scale className="mr-2 h-5 w-5 text-gray-600" />
              Legal & Compliance
            </h3>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/privacy-policy')}
                className="w-full inline-flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
                <FileText className="w-4 h-4 mr-2" />
                Privacy Policy
            </button>
            
            <button
              onClick={handleDataDeletion}
              disabled={isDeletingData}
                className="w-full inline-flex items-center justify-center px-4 py-3 border border-red-300 text-sm font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
            >
                {isDeletingData ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent -ml-1 mr-2"></div>
                    Deleting Data...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All My Data
                  </>
                )}
            </button>
            </div>
          </div>
        </div>
        
        {/* Compliance Info */}
        <div className="mt-6 bg-[#f9fafb] p-4 rounded-lg border border-[#e4e7eb]">
          <h4 className="font-black text-[#101820] mb-3 flex items-center">
            <CheckCircle2 className="mr-2 h-5 w-5 text-[#059669]" />
            Your Data Rights & Our Commitments
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
            <div>
              <p className="font-medium text-gray-700 mb-1">Data Retention Policy:</p>
              <ul className="space-y-1">
                <li>• Order data: 60 days (business analytics)</li>
                <li>• Analytics data: 90 days (aggregated insights)</li>
                <li>• Audit logs: 365 days (compliance & security)</li>
                <li>• Cookies: 7 days (session management)</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-1">Your Rights (GDPR/CCPA):</p>
              <ul className="space-y-1">
                <li>• Right to Access (view privacy report)</li>
                <li>• Right to Portability (export data)</li>
                <li>• Right to Erasure (delete data)</li>
                <li>• Right to Rectification (contact support)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Report Modal - Enhanced */}
      {showPrivacyReport && privacyReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-[1300] flex items-center justify-center p-4">
          <div className="relative mx-auto border w-full max-w-4xl shadow-2xl rounded-xl bg-white max-h-[90vh] overflow-hidden">
            <div className="sticky top-0 bg-white border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-[#101820] flex items-center">
                  <BarChart3 className="w-5 h-5 mr-3 text-[#2f5bea]" />
                  Privacy Compliance Report
                </h3>
                <button
                  onClick={() => setShowPrivacyReport(false)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              </div>
              
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-6">
                {/* Compliance Status - Enhanced */}
                <div className="relative bg-[#15b87a]/10 p-6 rounded-xl border border-[#15b87a]/20 overflow-hidden">
                  {/* Decorative background pattern */}
                  <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                    <svg viewBox="0 0 100 100" className="w-full h-full text-[#059669]">
                      <circle cx="50" cy="50" r="40" fill="currentColor" />
                      <path d="M30 50l10 10 30-30" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
                
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xl font-bold text-[#08734c] flex items-center">
                        <div className="mr-3 p-2 bg-[#15b87a]/14 rounded-full">
                          <CheckCircle2 className="w-6 h-6 text-[#059669]" />
                        </div>
                        Overall Compliance Status
                      </h4>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-[#059669] rounded-full animate-pulse"></div>
                        <span className="text-xs font-medium text-[#047857] bg-[#15b87a]/14 px-2 py-1 rounded-full">LIVE</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-[#15b87a]/14 shadow-sm">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-[#059669] rounded-full">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="text-lg font-bold text-[#08734c]">{privacyReport.compliance_status}</div>
                            <div className="text-sm text-[#059669]">Application privacy controls report</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-[#059669]">Active</div>
                          <div className="text-xs text-[#059669] font-medium">Control status</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex items-center space-x-2 p-3 bg-white/60 rounded-lg">
                          <div className="w-2 h-2 bg-[#15b87a] rounded-full"></div>
                          <span className="text-sm font-medium text-[#047857]">Export and deletion controls</span>
                        </div>
                        <div className="flex items-center space-x-2 p-3 bg-white/60 rounded-lg">
                          <div className="w-2 h-2 bg-[#15b87a] rounded-full"></div>
                          <span className="text-sm font-medium text-[#047857]">Access-request workflow</span>
                        </div>
                        <div className="flex items-center space-x-2 p-3 bg-white/60 rounded-lg">
                          <div className="w-2 h-2 bg-[#15b87a] rounded-full"></div>
                          <span className="text-sm font-medium text-[#047857]">Auditable privacy events</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-center mt-4 p-3 bg-[#15b87a]/14/80 rounded-lg">
                        <Lock className="w-4 h-4 text-[#059669] mr-2" />
                        <span className="text-sm font-medium text-[#047857]">Privacy controls are available for this store</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Data Processing Practices */}
                <div>
                  <h4 className="font-black text-[#101820] mb-4 flex items-center">
                    <span className="mr-2">🛡️</span>
                    Data Processing Practices
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <h5 className="font-medium text-gray-800 mb-2">Data Minimization</h5>
                    <p className="text-sm text-gray-600">{privacyReport.data_minimization}</p>
                  </div>
                  
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <h5 className="font-medium text-gray-800 mb-2">Purpose Limitation</h5>
                    <p className="text-sm text-gray-600">{privacyReport.purpose_limitation}</p>
                  </div>
                  
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <h5 className="font-medium text-gray-800 mb-2">Retention Policy</h5>
                    <p className="text-sm text-gray-600">{privacyReport.retention_policy}</p>
                  </div>
                  
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <h5 className="font-medium text-gray-800 mb-2">Data Encryption</h5>
                    <p className="text-sm text-gray-600">{privacyReport.encryption}</p>
                  </div>
                </div>
                </div>
                
                {/* Access Statistics */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <h4 className="font-semibold text-[#1539a6] mb-3 flex items-center">
                    <BarChart3 className="mr-2 h-5 w-5 text-[#2f5bea]" />
                    Data Access Activity Summary
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-[#2f5bea]">{privacyReport.audit_logs_today || 0}</div>
                      <div className="text-sm text-[#2f5bea]">Today's Events</div>
                      <div className="text-xs text-[#7c9cff] mt-1">Data access logs</div>
                </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-indigo-600">{privacyReport.total_weekly_access_events || 0}</div>
                      <div className="text-sm text-indigo-500">7-Day Total</div>
                      <div className="text-xs text-indigo-400 mt-1">Weekly activity</div>
              </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-[#2f5bea]">{privacyReport.recent_audit_activity || 0}</div>
                      <div className="text-sm text-[#2f5bea]">30-Day Total</div>
                      <div className="text-xs text-[#7c9cff] mt-1">Monthly activity</div>
            </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-[#059669]">Active</div>
                      <div className="text-sm text-[#059669]">Privacy controls</div>
                      <div className="text-xs text-[#15b87a] mt-1">Export, deletion, and audit workflows</div>
                    </div>
                  </div>
                  
                  {/* Weekly Activity Breakdown */}
                  {privacyReport.weekly_action_breakdown && Object.keys(privacyReport.weekly_action_breakdown).length > 0 && (
                    <div className="mt-4 bg-white p-3 rounded-lg border border-[#2f5bea]/18">
                      <h5 className="font-medium text-[#1539a6] mb-2">Weekly Activity Breakdown</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                                 {Object.entries(privacyReport.weekly_action_breakdown).map(([action, count]: [string, any]) => (
                          <div key={action} className="flex justify-between items-center p-2 bg-[#2f5bea]/6 rounded">
                            <span className="text-[#1d3db8] font-medium">{action.replace(/_/g, ' ')}</span>
                            <span className="text-[#2f5bea] font-bold">{count}</span>
                          </div>
                        ))}
          </div>
        </div>
      )}

                  <div className="mt-3 text-xs text-[#2f5bea]">
                    <strong>Note:</strong> Access events include revenue queries, order data requests, exports, and analytics operations. 
                    All data access is automatically logged for transparency and compliance monitoring.
                  </div>
                </div>
                
                {/* Additional Privacy Info */}
                <div className="bg-gray-50 p-4 rounded-xl">
                  <h4 className="font-black text-[#101820] mb-3 flex items-center">
                    <span className="mr-2">ℹ️</span>
                    Additional Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
                      <p className="font-medium text-gray-700 mb-2">Data Categories Processed:</p>
                      <ul className="text-gray-600 space-y-1">
                        <li>• Order and transaction data</li>
                        <li>• Product and inventory metrics</li>
                        <li>• Revenue and analytics data</li>
                        <li>• Store configuration settings</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 mb-2">Privacy Safeguards:</p>
                      <ul className="text-gray-600 space-y-1">
                        <li>• AES-256 encryption at rest</li>
                        <li>• TLS 1.3 encryption in transit</li>
                        <li>• Automated data retention cleanup</li>
                        <li>• Comprehensive audit logging</li>
                      </ul>
          </div>
        </div>
      </div>

                <div className="border-t pt-4">
                  <div className="text-xs text-gray-500 flex justify-between items-center">
                    <span>Report generated: {new Date(privacyReport.last_updated).toLocaleString()}</span>
                    <span>Store: {shop}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session Management Section */}
      <div className="animate-slideUp motion-reduce:animate-none rounded-lg border border-[#e4e7eb] bg-white p-6 shadow-[0_18px_42px_-36px_rgba(16,24,32,0.75)]" style={{ animationDelay: '180ms', animationFillMode: 'both' }}>
        <h2 className="text-xl font-black text-[#101820] mb-4 flex items-center">
          <Monitor className="mr-3 h-6 w-6 text-[#2f5bea]" />
          Active Sessions
        </h2>
        <p className="text-sm text-[#5f6b76] mb-6">
          Manage your active sessions across different devices and browsers.{' '}
          {isDemoMode ? 'Demo mode does not enforce a session limit.' : 'You can have up to 5 active sessions at once.'}
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Session Status */}
          <div className="bg-[#f9fafb] p-4 lg:p-5 rounded-lg border border-[#e4e7eb]">
            <h3 className="font-black text-[#101820] mb-3 flex items-center">
              <BarChart3 className="mr-2 h-5 w-5 text-[#2f5bea]" />
              Session Status
            </h3>
            <div className="space-y-4">
              {sessionLimitData ? (
                <>
                  <div className="flex items-center justify-between p-4 bg-[#2f5bea]/6 rounded-lg border border-[#2f5bea]/18">
                    <div>
                      <div className="text-lg font-bold text-[#1539a6]">
                        {sessionLimitData.currentSessionCount} / {sessionLimitData.maxSessions >= 999 ? '∞' : sessionLimitData.maxSessions}
                      </div>
                      <div className="text-sm text-[#2f5bea]">Active Sessions</div>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        sessionLimitData.limitReached
                          ? 'bg-[#dc2626]/14 text-[#b91c1c]'
                          : 'bg-[#15b87a]/14 text-[#08734c]'
                      }`}>
                        {sessionLimitData.limitReached ? 'Limit Reached' : 'Available'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Last checked info */}
                  {lastChecked && (
                    <div className="text-xs text-gray-500 mb-2">
                      Last updated: {lastChecked.toLocaleString()}
                    </div>
                  )}
                  
                  {/* Current sessions preview */}
                  <div className="space-y-2">
                    {sessionLimitData.sessions.slice(0, 3).map((session, index) => {
                      const device = getDeviceDisplay(session.userAgent);
                      return (
                        <div key={session.sessionId} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                          session.isCurrentSession 
                            ? 'bg-[#15b87a]/10 border-[#15b87a]/30 shadow-sm'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}>
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="text-lg">{device.icon}</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {device.name}
                                </span>
                                {session.isCurrentSession && (
                                  <span className="inline-flex items-center gap-1 text-xs bg-[#15b87a]/14 text-[#08734c] px-2 py-1 rounded-full font-medium">
                                    <span className="w-2 h-2 bg-[#059669] rounded-full animate-pulse"></span>
                                    This Device
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mb-1">
                                {device.subtitle}
                              </div>
                              <div className={`text-xs font-medium ${
                                session.isCurrentSession ? 'text-[#047857]' : 'text-gray-600'
                              }`}>
                                Last used: {session.lastUsedFormatted || getRelativeTime(session.lastAccessedAt)}
                              </div>
                            </div>
                          </div>
                          {session.isCurrentSession && (
                            <div className="text-right">
                              <div className="text-xs text-[#059669] font-medium">Active Now</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {sessionLimitData.sessions.length > 3 && (
                      <div className="text-center text-sm text-gray-500">
                        +{sessionLimitData.sessions.length - 3} more sessions
                      </div>
                    )}
                  </div>
                </>
              ) : sessionLimitLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2f5bea]"></div>
                </div>
              ) : sessionLimitError ? (
                <div className="text-center py-4">
                  <div className="text-red-600 mb-2">Failed to load session data</div>
                  <button
                    onClick={checkSessionLimit}
                    className="text-sm text-[#2f5bea] hover:text-[#1539a6]"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No session data available
                </div>
              )}
            </div>
          </div>
          
          {/* Session Actions */}
          <div className="bg-[#f9fafb] p-4 lg:p-5 rounded-lg border border-[#e4e7eb]">
            <h3 className="font-black text-[#101820] mb-3 flex items-center">
              <span className="mr-2">🔧</span>
              Session Management
            </h3>
            <div className="space-y-3">
              <button
                onClick={handleRefreshSessionData}
                disabled={sessionLimitLoading || sessionRefreshDebounce}
                className="w-full inline-flex items-center justify-center px-4 py-3 border border-[#2f5bea]/32 text-sm font-medium rounded-lg text-[#1d3db8] bg-[#2f5bea]/6 hover:bg-[#2f5bea]/12 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2f5bea] disabled:opacity-50 transition-colors"
              >
                {sessionLimitLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#2f5bea] border-t-transparent -ml-1 mr-2"></div>
                    Checking Sessions...
                  </>
                ) : sessionRefreshDebounce ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 text-gray-400" />
                    {sessionRefreshCountdown > 0 ? (
                      <>Wait {Math.floor(sessionRefreshCountdown / 60)}:{(sessionRefreshCountdown % 60).toString().padStart(2, '0')}</>
                    ) : (
                      <>Wait 5min...</>
                    )}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Sessions
                  </>
                )}
              </button>
              
              <button
                onClick={openSessionDialog}
                disabled={(!sessionLimitData || sessionLimitData.sessions.length === 0) && !sessionLimitError}
                className="w-full inline-flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-[#1d3db8] bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2f5bea] disabled:opacity-50 transition-colors"
              >
                <Users className="w-4 h-4 mr-2" />
                Manage All Sessions
              </button>
              
              <div className="text-xs text-gray-600">
                <p className="font-medium mb-1">Session Features:</p>
                <ul className="space-y-1">
                  <li>• {isDemoMode ? 'No session limit in demo mode' : 'Maximum 5 concurrent sessions'}</li>
                  <li>• Automatic cleanup of old sessions</li>
                  <li>• Device and browser identification</li>
                  <li>• Real-time session monitoring</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session Limit Dialog */}
      <SessionLimitDialog
        open={showSessionDialog}
        onClose={closeSessionDialog}
        onSessionDeleted={(sessionId) => deleteSession(sessionId)}
        onSessionsDeleted={deleteSessions}
        onContinue={closeSessionDialog}
        sessions={sessionLimitData?.sessions || []}
        loading={sessionLimitLoading}
        maxSessions={sessionLimitData?.maxSessions || 5}
      />

      {/* Danger Zone - Enhanced with Better Explanations */}
      <div className="animate-slideUp motion-reduce:animate-none rounded-lg border border-red-200 bg-white p-6 shadow-[0_18px_42px_-36px_rgba(16,24,32,0.75)]" style={{ animationDelay: '240ms', animationFillMode: 'both' }}>
        <h2 className="text-xl font-black text-[#101820] mb-6 flex items-center">
          <AlertTriangle className="mr-3 h-6 w-6 text-red-600" />
          Danger Zone
        </h2>
        <div className="space-y-6">
          {/* Normal Disconnect */}
          <div className="bg-[#f59e0b]/8 p-5 rounded-xl border border-red-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-2">Disconnect Store</h3>
                <p className="text-sm text-red-700 mb-3">
                  Safely disconnect your store from ShopGauge. This will log you out and require re-authentication 
                  to access your data again. Your data will be preserved.
                </p>
                <div className="text-xs text-red-600">
                  <p className="font-medium mb-1">What happens:</p>
                  <ul className="space-y-1">
                    <li>• Logs out of current session</li>
                    <li>• Clears authentication cookies</li>
                    <li>• Preserves all your data for future access</li>
                    <li>• Redirects to home page</li>
                  </ul>
                </div>
              </div>
            <button
              onClick={handleShopDisconnect}
                className="ml-4 inline-flex items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-[#f59e0b] hover:bg-[#b45309] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#f59e0b] transition-colors"
            >
                <LogOut className="w-4 h-4 mr-2" />
              Disconnect Store
            </button>
          </div>
          </div>

          {/* Force Disconnect */}
          <div className="bg-red-50 p-5 rounded-xl border border-[#f59e0b]/35">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-[#92400e] mb-2 flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5 text-[#b45309]" />
                  Force Disconnect (Troubleshooting)
                </h3>
                <p className="text-sm text-[#b45309] mb-3">
                  Use this only if the normal disconnect doesn't work or you're experiencing authentication issues. 
                  This will forcefully clear all tokens, cookies, and cached data.
                </p>
                <div className="text-xs text-[#b45309]">
                  <p className="font-medium mb-1">What happens:</p>
                  <ul className="space-y-1">
                    <li>• Forcefully invalidates all authentication tokens</li>
                    <li>• Clears all cookies and cached data</li>
                    <li>• Removes all local/session storage</li>
                    <li>• Forces complete page reload</li>
                  </ul>
                  <p className="font-medium mt-3 mb-1">Use when:</p>
                  <ul className="space-y-1">
                    <li>• Normal disconnect fails</li>
                    <li>• Stuck in authentication loops</li>
                    <li>• Seeing outdated data after switching stores</li>
                    <li>• Experiencing session-related issues</li>
                  </ul>
                </div>
              </div>
            <button
              onClick={handleForceDisconnect}
              disabled={isForceDisconnecting}
                className="ml-4 inline-flex items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
            >
                {isForceDisconnecting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent -ml-1 mr-2"></div>
                    Force Disconnecting...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Force Disconnect
                  </>
                )}
            </button>
          </div>
        </div>


      </div>
      </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        size={confirmDialog.size}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
        confirmText="Confirm"
        cancelText="Cancel"
      />
    </div>
  );
}
