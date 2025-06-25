import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api';

interface AuthContextType {
  isAuthenticated: boolean;
  shop: string | null;
  authLoading: boolean;
  loading: boolean;
  logout: () => void;
  setShop: (shop: string | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  shop: null,
  authLoading: true,
  loading: true,
  logout: () => {},
  setShop: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [shop, setShop] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/shopify/me`, {
        withCredentials: true
      });
      if (response.data.shop) {
        // If shop has changed, clear the cache
        if (shop && shop !== response.data.shop) {
          sessionStorage.removeItem('dashboard_cache_v1.1');
        }
        setShop(response.data.shop);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setShop(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setShop(null);
      // Clear cache on auth failure
      sessionStorage.removeItem('dashboard_cache_v1.1');
    } finally {
      setAuthLoading(false);
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/shopify/profile/disconnect`, {}, {
        withCredentials: true
      });
      
      // Clear dashboard cache on logout
      sessionStorage.removeItem('dashboard_cache_v1.1');
      
      setIsAuthenticated(false);
      setShop(null);
    } catch (error) {
      console.error('Logout failed:', error);
      
      // Clear cache even if logout API fails
      sessionStorage.removeItem('dashboard_cache_v1.1');
      setIsAuthenticated(false);
      setShop(null);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, shop, authLoading, loading, logout, setShop }}>
      {children}
    </AuthContext.Provider>
  );
}; 