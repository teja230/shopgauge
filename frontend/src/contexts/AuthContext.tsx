import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAuthShop } from '../api';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';

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
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Debug state changes
  useEffect(() => {
    console.log('Auth: State changed', {
      isAuthenticated,
      shop,
      authLoading,
      loading,
      isLoggingOut,
      path: location.pathname
    });
  }, [isAuthenticated, shop, authLoading, loading, isLoggingOut, location.pathname]);

  const refreshAuth = useCallback(async () => {
    try {
      const response = await api.get('/auth/status');
      if (response.data.authenticated) {
        setShop(response.data.shop);
        setIsAuthenticated(true);
      } else {
        setShop(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Failed to refresh auth:', error);
      setShop(null);
      setIsAuthenticated(false);
    }
  }, []);

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

        // Handle connection errors differently
        if (error instanceof Error && error.message.includes('Failed to fetch')) {
          console.log('Auth: Connection error, retrying...');
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Auth: Retrying auth check (${retryCount}/${maxRetries})`);
            setTimeout(checkAuth, 2000); // Retry after 2 seconds
            return;
          }
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
      if (mounted && !isLoggingOut) {
        console.log('Auth: Starting periodic auth check');
        refreshAuth();
      } else {
        console.log('Auth: Skipping periodic check - mounted:', mounted, 'isLoggingOut:', isLoggingOut);
      }
    }, 60000); // Check every minute

    return () => {
      console.log('Auth: Cleaning up');
      mounted = false;
      clearInterval(interval);
    };
  }, [navigate, location.pathname]);

  useEffect(() => {
    if (!isLoggingOut) {
      refreshAuth();
    }
  }, [isLoggingOut, refreshAuth]);

  const logout = async () => {
    try {
      console.log('Auth: Starting logout process');
      setIsLoggingOut(true); // Prevent auth checks during logout
      
      console.log('Auth: Calling force-disconnect endpoint');
      
      await fetch('/api/auth/shopify/profile/force-disconnect', {
        method: 'POST',
        credentials: 'include',
      });
      
      console.log('Auth: Force-disconnect API call completed');
      setShop(null);
      setIsAuthenticated(false);
      
      // Reset logout state
      setIsLoggingOut(false);
      
      // Redirect to home page after successful disconnect
      console.log('Auth: Redirecting to home page after disconnect');
      navigate('/');
    } catch (error) {
      console.error('Auth: Logout failed:', error);
      setIsLoggingOut(false); // Reset logout state on error
      // Fallback to home page if logout fails
      navigate('/');
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
