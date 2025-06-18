import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuthShop } from '../api';
import { useNavigate, useLocation } from 'react-router-dom';

interface AuthContextType {
  isAuthenticated: boolean;
  shop: string | null;
  authLoading: boolean;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  loading: boolean;
  setShop: (shop: string | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  shop: null,
  authLoading: true,
  logout: () => {},
  refreshAuth: async () => {},
  loading: true,
  setShop: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [shop, setShop] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  // Debug state changes
  useEffect(() => {
    console.log('Auth: State changed', {
      isAuthenticated,
      shop,
      authLoading,
      loading,
      path: location.pathname
    });
  }, [isAuthenticated, shop, authLoading, loading, location.pathname]);

  const refreshAuth = async () => {
    console.log('Auth: Starting refreshAuth');
    try {
      console.log('Auth: Checking authentication status');
      const shopName = await getAuthShop();
      console.log('Auth: Got shop name:', shopName);
      if (shopName) {
        console.log('Auth: Setting authenticated state');
        setShop(shopName);
        setIsAuthenticated(true);
      } else {
        console.log('Auth: No shop name, redirecting to home');
        setShop(null);
        setIsAuthenticated(false);
        if (location.pathname !== '/') {
          navigate('/');
        }
      }
    } catch (error) {
      console.error('Auth: Auth check failed:', error);
      setShop(null);
      setIsAuthenticated(false);
      if (location.pathname !== '/') {
        navigate('/');
      }
    } finally {
      console.log('Auth: Setting loading states to false');
      setAuthLoading(false);
      setLoading(false);
    }
  };

  // Initial auth check
  useEffect(() => {
    console.log('Auth: Initializing auth provider');
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const checkAuth = async () => {
      if (!mounted) {
        console.log('Auth: Component unmounted, skipping auth check');
        return;
      }
      
      console.log('Auth: Starting initial auth check');
      try {
        const shopName = await getAuthShop();
        console.log('Auth: Initial shop name:', shopName);
        
        if (!mounted) {
          console.log('Auth: Component unmounted after auth check');
          return;
        }

        if (shopName) {
          console.log('Auth: Setting initial authenticated state');
          setShop(shopName);
          setIsAuthenticated(true);
          setAuthLoading(false);
          setLoading(false);
        } else {
          console.log('Auth: No initial shop name, redirecting to home');
          setShop(null);
          setIsAuthenticated(false);
          setAuthLoading(false);
          setLoading(false);
          if (location.pathname !== '/') {
            navigate('/');
          }
        }
      } catch (error) {
        console.error('Auth: Initial auth check failed:', error);
        
        if (!mounted) {
          console.log('Auth: Component unmounted after error');
          return;
        }

        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Auth: Retrying auth check (${retryCount}/${maxRetries})`);
          setTimeout(checkAuth, 1000); // Retry after 1 second
        } else {
          console.log('Auth: Max retries reached, redirecting to home');
          setShop(null);
          setIsAuthenticated(false);
          setAuthLoading(false);
          setLoading(false);
          if (location.pathname !== '/') {
            navigate('/');
          }
        }
      }
    };

    // Start initial auth check
    checkAuth();

    // Set up periodic auth check
    const interval = setInterval(() => {
      if (mounted) {
        console.log('Auth: Starting periodic auth check');
        refreshAuth();
      } else {
        console.log('Auth: Component unmounted, skipping periodic check');
      }
    }, 60000); // Check every minute

    return () => {
      console.log('Auth: Cleaning up');
      mounted = false;
      clearInterval(interval);
    };
  }, [navigate, location.pathname]);

  const logout = async () => {
    try {
      console.log('Auth: Logging out');
      await fetch('/api/auth/shopify/profile/disconnect', {
        method: 'POST',
        credentials: 'include',
      });
      setShop(null);
      setIsAuthenticated(false);
      navigate('/');
    } catch (error) {
      console.error('Auth: Logout failed:', error);
    }
  };

  // Log initial render
  console.log('Auth: Provider rendered');

  return (
    <AuthContext.Provider value={{ isAuthenticated, shop, authLoading, logout, refreshAuth, loading, setShop }}>
      {children}
    </AuthContext.Provider>
  );
};

// Move non-component exports to a separate file if needed for Fast Refresh, or suppress the warning if not critical.
// For now, no code change needed unless you want to fully silence the warning.
