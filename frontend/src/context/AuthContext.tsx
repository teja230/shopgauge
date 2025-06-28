import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL, setApiAuthState } from '../api';

interface AuthContextType {
  isAuthenticated: boolean;
  shop: string | null;
  authLoading: boolean;
  loading: boolean;
  logout: () => void;
  setShop: (shop: string | null) => void;
  checkAuth: () => Promise<void>;
  isAuthReady: boolean; // New flag to indicate auth system is ready
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  shop: null,
  authLoading: true,
  loading: true,
  logout: () => {},
  setShop: () => {},
  checkAuth: async () => {},
  isAuthReady: false,
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
  }, []);

  const checkAuth = async () => {
    console.log('AuthContext: Starting authentication check');
    setAuthLoading(true);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/shopify/me`, {
        withCredentials: true,
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data.shop) {
        // If shop has changed, clear the cache
        if (shop && shop !== response.data.shop) {
          console.log('AuthContext: Shop changed from', shop, 'to', response.data.shop, '- clearing cache');
          clearAllDashboardCache();
        }
        
        setShop(response.data.shop);
        setIsAuthenticated(true);
        
        // Update API auth state
        setApiAuthState(true, response.data.shop);
        
        console.log('AuthContext: Authentication successful for shop:', response.data.shop);
      } else {
        console.log('AuthContext: No shop in response, user not authenticated');
        setIsAuthenticated(false);
        setShop(null);
        
        // Update API auth state
        setApiAuthState(false, null);
      }
    } catch (error) {
      console.error('AuthContext: Auth check failed:', error);
      
      // Check if it's a 401 error that might be recoverable
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const errorData = error.response.data;
        
        // If there's a reauth URL, we might be able to recover
        if (errorData?.reauth_url && errorData?.shop) {
          console.log('AuthContext: Session expired but shop known, attempting recovery...');
          
          // Try to refresh authentication
          try {
            const refreshResponse = await axios.post(`${API_BASE_URL}/api/auth/shopify/refresh`, {}, {
              withCredentials: true,
              timeout: 5000
            });
            
            if (refreshResponse.data.success && refreshResponse.data.shop) {
              console.log('AuthContext: Successfully recovered authentication');
              setShop(refreshResponse.data.shop);
              setIsAuthenticated(true);
              
              // Update API auth state
              setApiAuthState(true, refreshResponse.data.shop);
              
              setAuthLoading(false);
              setIsAuthReady(true);
              if (!hasInitiallyLoaded) {
                setLoading(false);
                setHasInitiallyLoaded(true);
              }
              return; // Successfully recovered
            }
          } catch (refreshError) {
            console.warn('AuthContext: Failed to refresh authentication:', refreshError);
          }
        }
      }
      
      setIsAuthenticated(false);
      setShop(null);
      
      // Update API auth state
      setApiAuthState(false, null);
      
      // Clear cache on auth failure
      clearAllDashboardCache();
    } finally {
      setAuthLoading(false);
      setIsAuthReady(true);
      
      // Only set loading to false after initial load
      if (!hasInitiallyLoaded) {
        setLoading(false);
        setHasInitiallyLoaded(true);
      }
      
      console.log('AuthContext: Authentication check completed');
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
      checkAuth,
      isAuthReady
    }}>
      {children}
    </AuthContext.Provider>
  );
}; 