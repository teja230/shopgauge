import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';
import { getAuthShop, setApiAuthState, API_BASE_URL } from '../api';

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

  // Comprehensive cache clearing function
  const clearAllDashboardCache = () => {
    // Clear all known dashboard cache keys
    sessionStorage.removeItem('dashboard_cache_v1.1');
    sessionStorage.removeItem('dashboard_cache_v2');
    
    // Also clear any other potential cache keys
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.includes('dashboard_cache')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    
    console.log('AuthContext: Cleared all dashboard cache keys');
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
      
      // Use enhanced auth check that handles race conditions
      const authResult = await getAuthShop();
      
      if (authResult.authenticated && authResult.shop) {
        console.log('AuthContext: Authentication successful, shop:', authResult.shop);
        setShop(authResult.shop);
        setIsAuthenticated(true);
        setIsAuthReady(true);
        
        // Sync API authentication state
        setApiAuthState(true, authResult.shop);
      } else {
        console.log('AuthContext: Not authenticated or no shop found');
        setShop(null);
        setIsAuthenticated(false);
        setIsAuthReady(true);
        
        // Sync API authentication state
        setApiAuthState(false, null);
      }
      
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
    }
  };

  const logout = async () => {
    console.log('AuthContext: Starting logout');
    try {
      await axios.post(`${API_BASE_URL}/api/auth/shopify/profile/disconnect`, {}, {
        withCredentials: true
      });
      
      console.log('AuthContext: Logout API call successful');
    } catch (error) {
      console.error('AuthContext: Logout API failed:', error);
    } finally {
      // Clear dashboard cache on logout regardless of API result
      clearAllDashboardCache();
      
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