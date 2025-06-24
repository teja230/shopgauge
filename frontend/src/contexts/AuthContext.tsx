import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAuthShop, API_BASE_URL } from '../api';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useSessionNotification } from '../hooks/useSessionNotification';

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
  const { showSessionExpired, showConnectionError } = useSessionNotification();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [shop, setShop] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Helper function to set cookies
  const setCookie = (name: string, value: string, days: number) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;secure;samesite=lax`;
  };

  // Helper function to read cookies
  const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  };

  // Debug state changes
  useEffect(() => {
    // Only log in development
    if (import.meta.env.DEV) {
      console.log('Auth: State changed', {
        isAuthenticated,
        shop,
        authLoading,
        loading,
        isLoggingOut,
        path: location.pathname
      });
    }
  }, [isAuthenticated, shop, authLoading, loading, isLoggingOut, location.pathname]);

  const refreshAuth = useCallback(async () => {
    try {
      // First, check if there's a shop parameter in the URL (for OAuth callback)
      const urlParams = new URLSearchParams(window.location.search);
      const shopFromUrl = urlParams.get('shop');
      
      if (shopFromUrl) {
        console.log('Auth: Found shop in URL parameter:', shopFromUrl);
        console.log('Auth: This appears to be a Shopify OAuth callback');
        
        // Instead of immediately setting as authenticated, check with backend first
        try {
          const response = await fetch(`${API_BASE_URL}/api/auth/shopify/me`, {
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
            },
          });
          
          if (response.ok) {
            // User is already authenticated, proceed normally
            console.log('Auth: User already authenticated, setting shop');
            const data = await response.json();
            setShop(data.shop || shopFromUrl);
            setIsAuthenticated(true);
            setAuthLoading(false);
            setLoading(false);
            
            // Clean up URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('shop');
            window.history.replaceState({}, '', newUrl.toString());
            return;
          } else {
            // User needs to go through OAuth flow
            console.log('Auth: User not authenticated, initiating OAuth flow');
            console.log('Auth: Redirecting to Shopify OAuth');
            
            // Redirect to your backend's OAuth initiation endpoint
            window.location.href = `${API_BASE_URL}/api/auth/shopify?shop=${encodeURIComponent(shopFromUrl)}`;
            return;
          }
        } catch (oauthError) {
          console.log('Auth: Error checking auth status, initiating OAuth flow');
          // If there's any error, initiate OAuth flow
          window.location.href = `${API_BASE_URL}/api/auth/shopify?shop=${encodeURIComponent(shopFromUrl)}`;
          return;
        }
      }
      
      // Check for shop in cookies as fallback
      const shopFromCookie = getCookie('shop');
      if (shopFromCookie) {
        // Only log in development
        if (import.meta.env.DEV) {
          console.log('Auth: Found shop in cookie:', shopFromCookie);
        }
        setShop(shopFromCookie);
        setIsAuthenticated(true);
        setAuthLoading(false);
        setLoading(false);
        return;
      }
      
      console.log('Auth: No shop in URL or cookie, checking backend auth');
      const shopName = await getAuthShop();
      if (shopName) {
        console.log('Auth: Backend returned shop:', shopName);
        setShop(shopName);
        setIsAuthenticated(true);
      } else {
        console.log('Auth: No shop from backend, user not authenticated');
        setShop(null);
        setIsAuthenticated(false);
        // Only redirect to home if we're not already there and not in the middle of logging out
        if (location.pathname !== '/' && !isLoggingOut) {
          console.log('Auth: Redirecting to home from:', location.pathname);
          navigate('/');
        }
      }
    } catch (error) {
      // Only log in development
      if (import.meta.env.DEV) {
        console.error('Failed to refresh auth:', error);
      }
      console.error('Auth: Error during refresh:', error);
      
      // Check if it's an authentication error vs connection error
      if (error instanceof Error && error.message.includes('Authentication required')) {
        // Show professional session expired notification
        if (location.pathname !== '/' && !isLoggingOut) {
          showSessionExpired({ redirectDelay: 1000 });
        }
      } else if (error instanceof Error && error.message.includes('Failed to fetch')) {
        // Connection error - don't redirect immediately
        showConnectionError();
      }
      
      setShop(null);
      setIsAuthenticated(false);
      // Only redirect to home if it's an auth error (not connection error) and we're not already there
      if (location.pathname !== '/' && !isLoggingOut && 
          error instanceof Error && error.message.includes('Authentication required')) {
        console.log('Auth: Redirecting to home due to auth error from:', location.pathname);
        setTimeout(() => navigate('/'), 1000); // Delay to show notification
      }
    }
  }, [location.pathname, navigate, isLoggingOut]);

  // Initial auth check
  useEffect(() => {
    // Only log in development
    if (import.meta.env.DEV) {
      console.log('Auth: Initializing auth provider');
    }
    
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const checkAuth = async () => {
      if (!mounted) {
        // Only log in development
        if (import.meta.env.DEV) {
          console.log('Auth: Component unmounted, skipping auth check');
        }
        return;
      }
      
      // Only log in development
      if (import.meta.env.DEV) {
        console.log('Auth: Starting initial auth check');
      }
      
      // First, check if there's a shop parameter in the URL (for OAuth callback)
      const urlParams = new URLSearchParams(window.location.search);
      const shopFromUrl = urlParams.get('shop');
      
      if (shopFromUrl) {
        console.log('Auth: Found shop in URL parameter:', shopFromUrl);
        // Clean up the URL by removing the shop parameter
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('shop');
        window.history.replaceState({}, '', newUrl.toString());
        
        // Set the shop cookie for 7 days
        setCookie('shop', shopFromUrl, 7);
        console.log('Auth: Set shop cookie:', shopFromUrl);
        
        // Set the shop from URL parameter
        setShop(shopFromUrl);
        setIsAuthenticated(true);
        setAuthLoading(false);
        setLoading(false);
        return;
      }
      
      // Check for shop in cookies as fallback
      const shopFromCookie = getCookie('shop');
      if (shopFromCookie) {
        // Only log in development
        if (import.meta.env.DEV) {
          console.log('Auth: Found shop in cookie:', shopFromCookie);
        }
        setShop(shopFromCookie);
        setIsAuthenticated(true);
        setAuthLoading(false);
        setLoading(false);
        return;
      }
      
      try {
        const shopName = await getAuthShop();
        
        // Only log in development
        if (import.meta.env.DEV) {
          console.log('Auth: Initial shop name:', shopName);
        }
        
        if (!mounted) {
          // Only log in development
          if (import.meta.env.DEV) {
            console.log('Auth: Component unmounted after auth check');
          }
          return;
        }

        if (shopName) {
          // Only log in development
          if (import.meta.env.DEV) {
            console.log('Auth: Setting initial authenticated state');
          }
          setShop(shopName);
          setIsAuthenticated(true);
          setAuthLoading(false);
          setLoading(false);
        } else {
          // Only log in development
          if (import.meta.env.DEV) {
            console.log('Auth: No initial shop name, redirecting to home');
          }
          setShop(null);
          setIsAuthenticated(false);
          setAuthLoading(false);
          setLoading(false);
          if (location.pathname !== '/') {
            navigate('/');
          }
        }
      } catch (error) {
        // Only log in development
        if (import.meta.env.DEV) {
          console.error('Auth: Initial auth check failed:', error);
        }
        
        if (!mounted) {
          // Only log in development
          if (import.meta.env.DEV) {
            console.log('Auth: Component unmounted after error');
          }
          return;
        }

        // Handle connection errors differently
        if (error instanceof Error && error.message.includes('Failed to fetch')) {
          // Only log in development
          if (import.meta.env.DEV) {
            console.log('Auth: Connection error, retrying...');
          }
          if (retryCount < maxRetries) {
            retryCount++;
            // Only log in development
            if (import.meta.env.DEV) {
              console.log(`Auth: Retrying auth check (${retryCount}/${maxRetries})`);
            }
            setTimeout(checkAuth, 2000); // Retry after 2 seconds
            return;
          } else {
            // Show connection error instead of session expired
            showConnectionError();
          }
        }

        if (retryCount < maxRetries) {
          retryCount++;
          // Only log in development
          if (import.meta.env.DEV) {
            console.log(`Auth: Retrying auth check (${retryCount}/${maxRetries})`);
          }
          setTimeout(checkAuth, 1000); // Retry after 1 second
        } else {
          // Only log in development
          if (import.meta.env.DEV) {
            console.log('Auth: Max retries reached, redirecting to home');
          }
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

    return () => {
      // Only log in development
      if (import.meta.env.DEV) {
        console.log('Auth: Cleaning up');
      }
      mounted = false;
    };
  }, [navigate, location.pathname]);

  // Remove the aggressive refresh effect that causes loops
  // useEffect(() => {
  //   if (!isLoggingOut) {
  //     refreshAuth();
  //   }
  // }, [isLoggingOut, refreshAuth]);

  const logout = async () => {
    try {
      // Only log in development
      if (import.meta.env.DEV) {
        console.log('Auth: Starting logout process');
      }
      setIsLoggingOut(true); // Prevent auth checks during logout
      
      // Only log in development
      if (import.meta.env.DEV) {
        console.log('Auth: Calling force-disconnect endpoint');
      }
      
      await fetch(`${API_BASE_URL}/api/auth/shopify/profile/force-disconnect`, {
        method: 'POST',
        credentials: 'include',
      });
      
      // Only log in development
      if (import.meta.env.DEV) {
        console.log('Auth: Force-disconnect API call completed');
      }
      setShop(null);
      setIsAuthenticated(false);
      
      // Reset logout state
      setIsLoggingOut(false);
      
      // Redirect to home page after successful disconnect
      // Only log in development
      if (import.meta.env.DEV) {
        console.log('Auth: Redirecting to home page after disconnect');
      }
      navigate('/');
    } catch (error) {
      // Only log in development
      if (import.meta.env.DEV) {
        console.error('Auth: Logout failed:', error);
      }
      setIsLoggingOut(false); // Reset logout state on error
      // Fallback to home page if logout fails
      navigate('/');
    }
  };

  // Log initial render only in development
  if (import.meta.env.DEV) {
    console.log('Auth: Provider rendered');
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, shop, authLoading, logout, refreshAuth, loading, setShop }}>
      {children}
    </AuthContext.Provider>
  );
};

// Move non-component exports to a separate file if needed for Fast Refresh, or suppress the warning if not critical.
// For now, no code change needed unless you want to fully silence the warning.
