import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  shop: string | null;
  loading: boolean;
  refresh: () => void;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  shop: null,
  loading: true,
  refresh: () => {},
  isAuthenticated: false,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shop, setShop] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refresh = async () => {
    try {
      const response = await fetch('/api/auth/shopify/status');
      if (response.ok) {
        const data = await response.json();
        setShop(data.shop);
      } else {
        setShop(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setShop(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/shopify/logout', { method: 'POST' });
      setShop(null);
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const value = {
    shop,
    loading,
    refresh,
    isAuthenticated: !!shop,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Move non-component exports to a separate file if needed for Fast Refresh, or suppress the warning if not critical.
// For now, no code change needed unless you want to fully silence the warning.
