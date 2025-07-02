import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';
import { setApiAuthState, setGlobalServiceErrorHandler, API_BASE_URL } from '../api';
import { invalidateCache } from '../utils/cacheUtils';

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
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [shop, setShop] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Handle authentication errors globally
  const handleAuthError = (error: any) => {
    if (error?.authenticationError || error?.status === 401) {
      console.log('AuthContext: Handling authentication error');
      setIsAuthenticated(false);
      setShop(null);
      setApiAuthState(false, null);
      
      // Only redirect if we're not already on the home page to prevent infinite loops
      if (window.location.pathname !== '/') {
        console.log('AuthContext: Redirecting to home page for re-authentication');
        // Use React Router navigation instead of window.location.href to prevent full page reload
        window.history.pushState({}, '', '/');
        // Dispatch a popstate event to trigger React Router navigation
        window.dispatchEvent(new PopStateEvent('popstate'));
      } else {
        console.log('AuthContext: Already on home page, not redirecting');
      }
      
      return true; // Indicate that the error was handled
    }
    return false; // Let other errors be handled elsewhere
  };

  // Set the global error handler
  useEffect(() => {
    setGlobalServiceErrorHandler(handleAuthError);
  }, []);

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

  useEffect(() => {
    // Only run initial auth check on mount
    if (!hasInitiallyLoaded) {
      checkAuth();
    }
  }, [hasInitiallyLoaded]);

  const checkAuth = async () => {
    console.log('AuthContext: Starting authentication check');
    
    try {
      setAuthLoading(true);
      setLoading(true); // Ensure loading state is active during auth check
      
      // Use direct fetch for initial auth check to avoid triggering global error handler
      // This prevents infinite loops when user is not authenticated
      const response = await fetch(`${API_BASE_URL}/api/auth/shopify/me`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-cache',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.shop && data.authenticated) {
          console.log('AuthContext: Authentication successful, shop:', data.shop);
          setShop(data.shop);
          setIsAuthenticated(true);
          setIsAuthReady(true);
          
          // Sync API authentication state
          setApiAuthState(true, data.shop);
          setHasInitiallyLoaded(true);
          return;
        }
      }
      
      // Handle non-authenticated state (401 or other responses)
      console.log('AuthContext: Not authenticated or no shop found, response status:', response.status);
      setShop(null);
      setIsAuthenticated(false);
      setIsAuthReady(true);
      
      // Sync API authentication state
      setApiAuthState(false, null);
      setHasInitiallyLoaded(true);
      
    } catch (error) {
      console.error('AuthContext: Error during authentication check:', error);
      setShop(null);
      setIsAuthenticated(false);
      setIsAuthReady(true);
      setHasInitiallyLoaded(true);
      
      // Sync API authentication state
      setApiAuthState(false, null);
    } finally {
      setAuthLoading(false);
      setLoading(false); // CRITICAL: Set loading to false when auth check completes
      console.log('AuthContext: Authentication check completed, loading state cleared');
    }
  };

  const logout = async () => {
    console.log(`AuthContext: Starting logout for shop: ${shop}`);
    const shopToClear = shop; // Capture shop name before it's cleared

    try {
      await axios.post(`${API_BASE_URL}/api/auth/shopify/profile/disconnect`, {}, {
        withCredentials: true
      });
      
      console.log('AuthContext: Logout API call successful');
    } catch (error) {
      console.error('AuthContext: Logout API failed:', error);
    } finally {
      // Clear dashboard cache for the specific shop on logout
      if (shopToClear) {
        invalidateCache(shopToClear);
        
        // Clear unified analytics storage on logout
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
      
      setIsAuthenticated(false);
      setShop(null);
      
      // Update API auth state
      setApiAuthState(false, null);
      
      setIsAuthReady(true); // Keep auth system ready
      
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
      hasInitiallyLoaded
    }}>
      {children}
    </AuthContext.Provider>
  );
}; 