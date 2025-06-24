import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api';

interface AuthContextType {
  isAuthenticated: boolean;
  shop: string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  shop: null,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [shop, setShop] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/shopify/me`, {
        withCredentials: true
      });
      if (response.data.shop) {
        setShop(response.data.shop);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setShop(null);
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/shopify/profile/disconnect`, {}, {
        withCredentials: true
      });
      setIsAuthenticated(false);
      setShop(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, shop, logout }}>
      {children}
    </AuthContext.Provider>
  );
}; 