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
    // Prevent duplicate calls
    if (authLoading) {
      console.log('Auth: Refresh already in progress, skipping duplicate call');
      return;
    }

    console.log('Auth: Starting refresh auth');
    setAuthLoading(true);
    setLoading(true);

    try {
      // First, check if there's a shop parameter in the URL (for OAuth callback)
      const urlParams = new URLSearchParams(window.location.search);
      const shopFromUrl = urlParams.get('shop');
      
      if (shopFromUrl) {
        console.log('Auth: Found shop in URL parameter:', shopFromUrl);
        console.log('Auth: This appears to be a Shopify OAuth callback');
        
        // Show loading state to user
        setAuthLoading(true);
        setLoading(true);
        
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
            
            // Clean up URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('shop');
            window.history.replaceState({}, '', newUrl.toString());
          } else {
            // User needs to go through OAuth flow
            console.log('Auth: User not authenticated, initiating OAuth flow');
            console.log('Auth: Redirecting to Shopify OAuth');
            
            // Show loading message before redirect
            setAuthLoading(true);
            setLoading(true);
            
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
      } else {
        // Check for shop in cookies as fallback
        const shopFromCookie = getCookie('shop');
        if (shopFromCookie) {
          // Only log in development
          if (import.meta.env.DEV) {
            console.log('Auth: Found shop in cookie:', shopFromCookie);
          }
          setShop(shopFromCookie);
          setIsAuthenticated(true);
        } else {
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
        }
      }
    } catch (error) {
      console.error('Auth: Error during refresh:', error);
      
      // Check if it's an authentication error vs connection error
      if (error instanceof Error && error.message.includes('Authentication required')) {
        // Show professional session expired notification
        if (location.pathname !== '/' && !isLoggingOut) {
          showSessionExpired({ redirectDelay: 2000 });
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
        setTimeout(() => navigate('/'), 2000); // Delay to show notification
      }
    } finally {
      setAuthLoading(false);
      setLoading(false);
    }
  }, [location.pathname, navigate, isLoggingOut, authLoading]);

  // Initial auth check - prevent running multiple times
  useEffect(() => {
    console.log('Auth: Initializing auth provider');
    
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    let isAuthInProgress = false;

    const checkAuth = async () => {
      if (!mounted || isAuthInProgress) {
        console.log('Auth: Skipping auth check - component unmounted or already in progress');
        return;
      }
      
      isAuthInProgress = true;
      console.log('Auth: Starting initial auth check');
      
      // Set loading states at the beginning
      setAuthLoading(true);
      setLoading(true);
      
      try {
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
          return;
        }
        
        // Check for shop in cookies as fallback
        const shopFromCookie = getCookie('shop');
        if (shopFromCookie) {
          console.log('Auth: Found shop in cookie:', shopFromCookie);
          setShop(shopFromCookie);
          setIsAuthenticated(true);
          return;
        }
        
        // Check backend auth as last resort
        console.log('Auth: No shop in URL/cookie, checking backend auth');
        const shopName = await getAuthShop();
        
        if (!mounted) {
          console.log('Auth: Component unmounted after auth check');
          return;
        }

        if (shopName) {
          console.log('Auth: Backend returned shop:', shopName);
          setShop(shopName);
          setIsAuthenticated(true);
        } else {
          console.log('Auth: No shop from backend, user not authenticated');
          setShop(null);
          setIsAuthenticated(false);
          if (location.pathname !== '/') {
            console.log('Auth: Redirecting to home from:', location.pathname);
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
          console.log('Auth: Connection error during initial auth check');
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Auth: Retrying auth check (${retryCount}/${maxRetries})`);
            setTimeout(() => {
              isAuthInProgress = false;
              checkAuth();
            }, 2000); // Retry after 2 seconds
            return;
          } else {
            // Show connection error instead of session expired
            showConnectionError();
          }
        } else if (error instanceof Error && error.message.includes('Authentication required')) {
          // Show session expired notification for auth errors
          if (location.pathname !== '/') {
            showSessionExpired({ redirectDelay: 2000 });
            setTimeout(() => navigate('/'), 2000);
          }
        }

        if (retryCount < maxRetries && !(error instanceof Error && error.message.includes('Authentication required'))) {
          retryCount++;
          console.log(`Auth: Retrying auth check (${retryCount}/${maxRetries})`);
          setTimeout(() => {
            isAuthInProgress = false;
            checkAuth();
          }, 1000); // Retry after 1 second
        } else {
          console.log('Auth: Max retries reached or auth error, setting unauthenticated state');
          setShop(null);
          setIsAuthenticated(false);
          if (location.pathname !== '/' && !(error instanceof Error && error.message.includes('Authentication required'))) {
            navigate('/');
          }
        }
      } finally {
        setAuthLoading(false);
        setLoading(false);
        isAuthInProgress = false;
      }
    };

    // Start initial auth check
    checkAuth();

    return () => {
      console.log('Auth: Cleaning up auth provider');
      mounted = false;
    };
  }, [navigate, location.pathname, showSessionExpired, showConnectionError]);

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
