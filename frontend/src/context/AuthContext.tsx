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

  // Enhanced authentication error handling
  const handleAuthError = (error: any) => {
    console.log('AuthContext: Handling potential auth error', error);
    
    if (error?.authenticationError || error?.status === 401) {
      console.log('AuthContext: Confirmed authentication error, clearing auth state');
      
      // Clear authentication state
      setIsAuthenticated(false);
      setShop(null);
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
      setApiAuthState(false, null);
      setIsAuthReady(true);
      
      return true;
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
      setLoading(true);
      
      // Use direct fetch for initial auth check to avoid triggering global error handler
      const response = await fetch(`${API_BASE_URL}/api/auth/shopify/me`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-cache',
      });

      console.log('AuthContext: Auth check response status:', response.status);

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
      
      // Handle non-authenticated state
      console.log('AuthContext: Not authenticated, response status:', response.status);
      setShop(null);
      setIsAuthenticated(false);
      setIsAuthReady(true);
      
      // Sync API authentication state
      setApiAuthState(false, null);
      setHasInitiallyLoaded(true);
      
    } catch (error) {
      console.error('AuthContext: Error during authentication check:', error);
      
      // Handle network errors gracefully
      setShop(null);
      setIsAuthenticated(false);
      setIsAuthReady(true);
      setHasInitiallyLoaded(true);
      
      // Sync API authentication state
      setApiAuthState(false, null);
      
      // Don't throw error to prevent breaking the app
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
      
      // Clear auth state
      setIsAuthenticated(false);
      setShop(null);
      setApiAuthState(false, null);
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
      hasInitiallyLoaded
    }}>
      {children}
    </AuthContext.Provider>
  );
}; 