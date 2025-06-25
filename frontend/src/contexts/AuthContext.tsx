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
  loading: boolean;
  setShop: (shop: string | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  shop: null,
  authLoading: true,
  logout: () => {},
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
    // For production (shopgaugeai.com), set domain to allow sharing between subdomains
    const isProduction = window.location.hostname.includes('shopgaugeai.com');
    const domainAttribute = isProduction ? '; domain=.shopgaugeai.com' : '';
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;secure;samesite=lax${domainAttribute}`;
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

  // Initial auth check - prevent running multiple times
  useEffect(() => {
    console.log('Auth: Initializing auth provider');
    
    let mounted = true;

    const checkAuth = async () => {
      if (!mounted) {
        console.log('Auth: Component unmounted, skipping auth check');
        return;
      }
      
      console.log('Auth: Starting initial auth check');
      
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
          
          // Set authentication state immediately
          setShop(shopFromUrl);
          setIsAuthenticated(true);
          setAuthLoading(false);
          setLoading(false);
          
          // Navigate to dashboard after setting auth state
          if (location.pathname === '/') {
            console.log('Auth: Navigating to dashboard after OAuth callback');
            navigate('/dashboard');
          }
          return;
        }
        
        // Check for shop in cookies as fallback
        const shopFromCookie = getCookie('shop');
        if (shopFromCookie) {
          console.log('Auth: Found shop in cookie:', shopFromCookie);
          setShop(shopFromCookie);
          setIsAuthenticated(true);
          setAuthLoading(false);
          setLoading(false);
          return;
        }
        
        // No shop found - user not authenticated
        console.log('Auth: No shop found, user not authenticated');
        setShop(null);
        setIsAuthenticated(false);
        setAuthLoading(false);
        setLoading(false);
        
        // Only redirect to home if we're on a protected route
        if (location.pathname !== '/' && location.pathname !== '/privacy-policy') {
          console.log('Auth: Redirecting to home from:', location.pathname);
          navigate('/');
        }
      } catch (error) {
        console.error('Auth: Initial auth check failed:', error);
        
        if (!mounted) {
          console.log('Auth: Component unmounted after error');
          return;
        }

        setShop(null);
        setIsAuthenticated(false);
        setAuthLoading(false);
        setLoading(false);
        
        // Only redirect to home if we're on a protected route
        if (location.pathname !== '/' && location.pathname !== '/privacy-policy') {
          navigate('/');
        }
      }
    };

    // Start initial auth check
    checkAuth();

    return () => {
      console.log('Auth: Cleaning up auth provider');
      mounted = false;
    };
  }, [navigate, location.pathname]);

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
      
      // Clear the shop cookie
      document.cookie = 'shop=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
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
    <AuthContext.Provider value={{ isAuthenticated, shop, authLoading, logout, loading, setShop }}>
      {children}
    </AuthContext.Provider>
  );
};

// Move non-component exports to a separate file if needed for Fast Refresh, or suppress the warning if not critical.
// For now, no code change needed unless you want to fully silence the warning.
