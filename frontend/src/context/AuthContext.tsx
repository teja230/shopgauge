import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';
import { setApiAuthState, setGlobalServiceErrorHandler, API_BASE_URL } from '../api';
import { invalidateCache } from '../utils/cacheUtils';
import { clearAllSessionCookies } from '../utils/sessionUtils';
import { useEnterpriseSse } from '../hooks/useEnterpriseSse';
import { debugLog } from '../components/ui/DebugPanel';

// Types
interface Shop {
  name: string;
  url: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  shop: string | null;
  setShop: (shop: string | null) => void;
  authLoading: boolean;
  isAuthReady: boolean;
  loading: boolean;
  hasInitiallyLoaded: boolean;
  isDemoMode: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  shop: null,
  authLoading: true,
  loading: true,
  logout: () => {},
  setShop: () => {},
  isAuthReady: false,
  hasInitiallyLoaded: false,
  isDemoMode: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [shop, setShop] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);



  // Enhanced authentication error handling
  const handleAuthError = (error: any) => {
    console.log('AuthContext: Handling potential auth error', error);
    
    if (error?.authenticationError || error?.status === 401) {
      console.log('AuthContext: Confirmed authentication error, clearing auth state');
      
      // Clear authentication state
      setIsAuthenticated(false);
      setShop(null);
      setIsDemoMode(false);
      setApiAuthState(false, null);
      
      // Mark auth as ready even when not authenticated
      setIsAuthReady(true);
      
      // Don't redirect here - let the route guards handle navigation
      // This prevents competing navigation logic
      console.log('AuthContext: Auth state cleared, route guards will handle navigation');
      
      return true; // Indicate that the error was handled
    }
    
    // Handle other types of errors that might indicate auth issues
    if (error?.response?.status === 403 || error?.code === 'UNAUTHORIZED') {
      console.log('AuthContext: Handling 403/UNAUTHORIZED error');
      
              // Clear auth state but don't redirect
        setIsAuthenticated(false);
        setShop(null);
        setIsDemoMode(false);
        setApiAuthState(false, null);
        setIsAuthReady(true);
      
      return true;
    }
    
    return false; // Let other errors be handled elsewhere
  };

  // Set the global error handler
  useEffect(() => {
    setGlobalServiceErrorHandler(handleAuthError);
  }, [handleAuthError]);

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
    
    console.log('AuthContext: Cleared all dashboard and unified analytics cache keys');
  };

  // Use enterprise SSE hook
  const { isConnected, isReconnecting, isPolling, isRateLimited } = useEnterpriseSse({
    autoConnect: true,
    enableNotifications: false, // We handle notifications manually
    enableDebug: import.meta.env.DEV
  });

  useEffect(() => {
    // Set demo mode flag immediately if URL contains demo=true
    const urlParams = new URLSearchParams(window.location.search);
    const isDemoModeInUrl = urlParams.get('demo') === 'true';
    
    if (isDemoModeInUrl) {
      console.log('AuthContext: Setting demo mode flag from URL parameter');
      localStorage.setItem('demo_mode_active', 'true');
      setIsDemoMode(true);
    }
    
    // Only run initial auth check on mount
    if (!hasInitiallyLoaded) {
      checkAuth();
    }
  }, [hasInitiallyLoaded]);

  const checkAuth = async () => {
    console.log('AuthContext: Starting authentication check');
    console.log('AuthContext: Current URL:', window.location.href);
    console.log('AuthContext: URL search params:', window.location.search);
    
    // Skip Shopify authentication on admin pages
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/admin')) {
      console.log('AuthContext: Skipping Shopify auth check on admin page');
      setShop(null);
      setIsAuthenticated(false);
      setIsDemoMode(false);
      setIsAuthReady(true);
      setHasInitiallyLoaded(true);
      setApiAuthState(false, null);
      return;
    }
    
    // Check if this is a demo mode request
    const urlParams = new URLSearchParams(window.location.search);
    const isDemoMode = urlParams.get('demo') === 'true';
    
    console.log('AuthContext: Demo mode check - URL params:', Object.fromEntries(urlParams.entries()));
    console.log('AuthContext: Demo mode detected:', isDemoMode);
    
    if (isDemoMode) {
      console.log('AuthContext: Detected demo mode request, setting up demo session directly');
      
      // Set up demo mode directly without backend validation
      const demoShop = 'demo-shopgauge.myshopify.com';
      console.log('AuthContext: Setting up demo session for shop:', demoShop);
      
      setShop(demoShop);
      setIsAuthenticated(true);
      setIsAuthReady(true);
      setIsDemoMode(true);
      setApiAuthState(true, demoShop);
      setHasInitiallyLoaded(true);
      
      // Set a global demo mode flag for the API layer
      window.localStorage.setItem('demo_mode_active', 'true');
      
      console.log('AuthContext: Demo mode setup complete');
      return;
    }
    
    // Check if this is a post-OAuth redirect (user just completed OAuth)
    const isPostOAuth = urlParams.get('connected') === 'true';
    
    if (isPostOAuth) {
      console.log('AuthContext: Detected post-OAuth redirect, adding delay for session establishment');
      // Add a delay to allow session establishment after OAuth
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Clean up the URL parameters
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('connected');
      newUrl.searchParams.delete('skip_loading');
      window.history.replaceState({}, '', newUrl.toString());
    }
    
    // Retry mechanism for authentication
    const maxRetries = isPostOAuth ? 3 : 1;
    let lastError = null;
    
    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`AuthContext: Authentication attempt ${attempt}/${maxRetries}`);
          
          setAuthLoading(true);
          setLoading(true);
          
          // Use direct fetch for initial auth check to avoid triggering global error handler
          const response = await fetch(`${API_BASE_URL}/api/auth/shopify/me`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-Correlation-ID': `auth-check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            },
            credentials: 'include',
            cache: 'no-cache',
          });

          console.log('AuthContext: Auth check response status:', response.status);

          if (response.ok) {
            const data = await response.json();
            if (data.shop && data.authenticated) {
              console.log('AuthContext: Authentication successful, shop:', data.shop);
              const isDemo = data.shop === 'demo-shopgauge.myshopify.com';
              
              setShop(data.shop);
              setIsAuthenticated(true);
              setIsAuthReady(true);
              setIsDemoMode(isDemo);
              
              // Sync API authentication state
              setApiAuthState(true, data.shop);
              setHasInitiallyLoaded(true);
              return;
            }
          }
          
          // If this is not the last attempt, wait before retrying
          if (attempt < maxRetries) {
            console.log(`AuthContext: Authentication failed, retrying in ${attempt * 1000}ms...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          }
          
        } catch (error) {
          console.error(`AuthContext: Error during authentication check (attempt ${attempt}):`, error);
          lastError = error;
          
          // If this is not the last attempt, wait before retrying
          if (attempt < maxRetries) {
            console.log(`AuthContext: Authentication error, retrying in ${attempt * 1000}ms...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          }
        }
      }
      
      // All attempts failed
      console.log('AuthContext: All authentication attempts failed');
      setShop(null);
      setIsAuthenticated(false);
      setIsDemoMode(false);
      setIsAuthReady(true);
      setHasInitiallyLoaded(true);
      
      // Sync API authentication state
      setApiAuthState(false, null);
      
    } catch (error) {
      console.error('AuthContext: Unexpected error during authentication check:', error);
      setShop(null);
      setIsAuthenticated(false);
      setIsDemoMode(false);
      setIsAuthReady(true);
      setHasInitiallyLoaded(true);
      setApiAuthState(false, null);
    } finally {
      setAuthLoading(false);
      setLoading(false);
      console.log('AuthContext: Authentication check completed');
    }
  };

  const logout = async () => {
    console.log(`AuthContext: Starting logout for shop: ${shop}`);
    const shopToClear = shop; // Capture shop name before it's cleared

    try {
      // Use session-aware cache invalidation instead of clearing all cache
      if (shopToClear) {
        try {
          console.log('AuthContext: Using session-aware cache invalidation for logout');
          const response = await fetch(`${API_BASE_URL}/api/analytics/cache/invalidate-session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include'
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('AuthContext: Session-aware cache invalidation result:', result);
            if (result.cleared) {
              console.log('AuthContext: Cache cleared - this was the last session for this shop');
            } else {
              console.log('AuthContext: Cache preserved - other sessions are still active for this shop');
            }
          } else {
            console.warn('AuthContext: Session-aware cache invalidation failed, falling back to manual clear');
            invalidateCache(shopToClear);
          }
        } catch (error) {
          console.warn('AuthContext: Session-aware cache invalidation failed:', error, 'falling back to manual clear');
          invalidateCache(shopToClear);
        }
      }

      await axios.post(`${API_BASE_URL}/api/auth/shopify/profile/disconnect`, {}, {
        withCredentials: true
      });
      console.log('AuthContext: Logout API call successful');
    } catch (error) {
      console.error('AuthContext: Logout API failed:', error);
    } finally {
      clearAllSessionCookies();
      
      // Clear unified analytics storage on logout
      if (shopToClear) {
        try {
          const unifiedAnalyticsKeys = [
            `unified_analytics_${shopToClear}_60d_with_predictions`,
            `unified_analytics_${shopToClear}_60d_no_predictions`,
            `unified_analytics_${shopToClear}_30d_with_predictions`,
            `unified_analytics_${shopToClear}_30d_no_predictions`,
            `unified_analytics_${shopToClear}_90d_with_predictions`,
            `unified_analytics_${shopToClear}_90d_no_predictions`,
          ];
          unifiedAnalyticsKeys.forEach(key => {
            sessionStorage.removeItem(key);
          });
          console.log('AuthContext: Cleared unified analytics storage on logout');
        } catch (error) {
          console.warn('AuthContext: Error clearing unified analytics storage:', error);
        }
      }
      
      // Clear auth state
      setIsAuthenticated(false);
      setShop(null);
      setIsDemoMode(false);
      setApiAuthState(false, null);
      
      // Clear demo mode flag
      localStorage.removeItem('demo_mode_active');
      sessionStorage.removeItem('demo_mode_active');
      setIsAuthReady(true);
      console.log('AuthContext: Logout completed');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      shop, 
      authLoading, 
      loading, 
      logout, 
      setShop,
      isAuthReady,
      hasInitiallyLoaded,
      isDemoMode,
    }}>
      {children}
    </AuthContext.Provider>
  );
}; 