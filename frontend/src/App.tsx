import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ServiceStatusProvider, useServiceStatus } from './context/ServiceStatusContext';
import { NotificationSettingsProvider } from './context/NotificationSettingsContext';
import { setGlobalServiceErrorHandler } from './api';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import CompetitorsPage from './pages/CompetitorsPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import NotFoundPage from './pages/NotFoundPage';
import ServiceUnavailablePage from './pages/ServiceUnavailablePage';
import NavBar from './components/NavBar';
import PrivacyBanner from './components/ui/PrivacyBanner';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import theme from './theme';
import IntelligentLoadingScreen from './components/ui/IntelligentLoadingScreen';
import CommandPalette from './components/CommandPalette';
import { DebugPanel, debugLog } from './components/ui/DebugPanel';
import { sessionManager, getSessionStatus } from './utils/sessionUtils';
import SessionLimitDialog from './components/ui/SessionLimitDialog';
import useSessionLimit from './hooks/useSessionLimit';
import { navigationDebugger, createNavigationEvent } from './utils/navigationDebugger';

// Navigation context to prevent competing navigation logic
interface NavigationContextType {
  isNavigating: boolean;
  setNavigating: (value: boolean) => void;
  lastNavigationTime: number;
  setLastNavigationTime: (value: number) => void;
}

const NavigationContext = React.createContext<NavigationContextType>({
  isNavigating: false,
  setNavigating: () => {},
  lastNavigationTime: 0,
  setLastNavigationTime: () => {},
});

const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isNavigating, setNavigating] = useState(false);
  const [lastNavigationTime, setLastNavigationTime] = useState(0);

  return (
    <NavigationContext.Provider value={{ isNavigating, setNavigating, lastNavigationTime, setLastNavigationTime }}>
      {children}
    </NavigationContext.Provider>
  );
};

const useNavigation = () => React.useContext(NavigationContext);

// Enhanced Protected Route with proper error handling
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authLoading, hasInitiallyLoaded } = useAuth();
  const { isNavigating, setNavigating, lastNavigationTime, setLastNavigationTime } = useNavigation();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Prevent rapid navigation calls
  const NAVIGATION_THROTTLE_MS = 1000;
  const now = Date.now();
  
  // Create auth state for debugging
  const authState = { isAuthenticated, authLoading, hasInitiallyLoaded };
  
  console.log('ProtectedRoute: Auth status', { 
    isAuthenticated, 
    authLoading, 
    hasInitiallyLoaded,
    isNavigating,
    path: location.pathname,
    search: location.search,
    timeSinceLastNavigation: now - lastNavigationTime
  });
  
  // Show loading state while auth is being checked
  if (authLoading || !hasInitiallyLoaded) {
    console.log('ProtectedRoute: Showing loading state - auth not ready');
    return <IntelligentLoadingScreen fastMode={true} message="Authenticating..." />;
  }
  
  // If not authenticated, redirect to home (but only if not already navigating)
  if (!isAuthenticated && !isNavigating && (now - lastNavigationTime) > NAVIGATION_THROTTLE_MS) {
    console.log('ProtectedRoute: Not authenticated, redirecting to home from:', location.pathname);
    
    // Check if navigation should be throttled
    const shouldThrottle = navigationDebugger.shouldThrottleNavigation('ProtectedRoute', '/');
    if (shouldThrottle) {
      console.warn('ProtectedRoute: Navigation throttled to prevent loops');
      return <IntelligentLoadingScreen fastMode={true} message="Loading..." />;
    }
    
    // Log navigation event
    const currentPath = location.pathname + location.search + location.hash;
    const redirectUrl = currentPath !== '/' ? `/?redirect=${encodeURIComponent(currentPath)}` : '/';
    
    navigationDebugger.logNavigation(createNavigationEvent(
      'ProtectedRoute',
      'redirect',
      location.pathname,
      '/',
      'User not authenticated',
      authState,
      { redirectUrl }
    ));
    
    // Mark that we're navigating to prevent multiple redirects
    setNavigating(true);
    setLastNavigationTime(now);
    
    // Use setTimeout to prevent immediate re-renders
    setTimeout(() => {
      navigate(redirectUrl, { replace: true });
      setTimeout(() => setNavigating(false), 500);
    }, 0);
    
    return <IntelligentLoadingScreen fastMode={true} message="Redirecting..." />;
  }
  
  // If authenticated, render the protected content
  if (isAuthenticated) {
    console.log('ProtectedRoute: Authenticated, rendering children for:', location.pathname);
    return <>{children}</>;
  }
  
  // Fallback - show loading
  return <IntelligentLoadingScreen fastMode={true} message="Loading..." />;
};

// Admin Protected Route - Independent of shop authentication
const AdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [isCheckingAdminAuth, setIsCheckingAdminAuth] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  
  useEffect(() => {
    // Check admin authentication (independent of shop auth)
    const checkAdminAuth = () => {
      console.log('AdminProtectedRoute: Checking admin authentication');
      
      // Check if admin session is valid
      const sessionExpiry = localStorage.getItem('admin_session_expiry');
      const currentTime = Date.now();
      
      if (sessionExpiry && parseInt(sessionExpiry) > currentTime) {
        console.log('AdminProtectedRoute: Valid admin session found');
        setIsAdminAuthenticated(true);
      } else {
        console.log('AdminProtectedRoute: No valid admin session');
        setIsAdminAuthenticated(false);
      }
      
      setIsCheckingAdminAuth(false);
    };
    
    checkAdminAuth();
    
    // Set up interval to check session expiry
    const interval = setInterval(checkAdminAuth, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);
  
  // Log navigation event for admin access
  useEffect(() => {
    navigationDebugger.logNavigation(createNavigationEvent(
      'AdminProtectedRoute',
      'access_attempt',
      'unknown',
      '/admin',
      'Admin access attempt',
      { isAuthenticated: isAdminAuthenticated, authLoading: isCheckingAdminAuth, hasInitiallyLoaded: true },
      { path: location.pathname }
    ));
  }, [location.pathname, isAdminAuthenticated, isCheckingAdminAuth]);
  
  console.log('AdminProtectedRoute: Admin auth status', { 
    isCheckingAdminAuth,
    isAdminAuthenticated,
    path: location.pathname,
    sessionExpiry: localStorage.getItem('admin_session_expiry'),
    currentTime: Date.now()
  });
  
  // Show loading state while checking admin auth
  if (isCheckingAdminAuth) {
    console.log('AdminProtectedRoute: Checking admin authentication...');
    return <IntelligentLoadingScreen fastMode={true} message="Checking admin access..." />;
  }
  
  // Always render AdminPage - it has its own password dialog for authentication
  // This allows the admin to enter the password if not authenticated
  console.log('AdminProtectedRoute: Rendering AdminPage');
  return <>{children}</>;
};

// Component to handle global error clearing on route changes
const RouteErrorCleaner: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated, authLoading, hasInitiallyLoaded } = useAuth();
  
  useEffect(() => {
    console.log('RouteErrorCleaner: Route changed to:', location.pathname);
    
    // Log navigation event
    navigationDebugger.logNavigation(createNavigationEvent(
      'RouteErrorCleaner',
      'navigate',
      'previous',
      location.pathname,
      'Route changed',
      { isAuthenticated, authLoading, hasInitiallyLoaded }
    ));
    
    // Dispatch a custom event that components can listen to for clearing their error states
    window.dispatchEvent(new CustomEvent('clearComponentErrors'));
  }, [location.pathname, isAuthenticated, authLoading, hasInitiallyLoaded]);

  return null;
};

const AppContent: React.FC = () => {
  const { isAuthenticated, authLoading, loading, hasInitiallyLoaded } = useAuth();
  const { handleServiceError } = useServiceStatus();
  const [showDebugPanel, setShowDebugPanel] = React.useState(false);
  
  // Session limit management
  const {
    sessionLimitData,
    loading: sessionLimitLoading,
    showSessionDialog,
    checkSessionLimit,
    deleteSession,
    closeSessionDialog,
    canProceedWithLogin,
  } = useSessionLimit();
  
  // Track session initialization to prevent repeated calls
  const [sessionInitialized, setSessionInitialized] = useState(false);
  
  // Enhanced loading state management
  const MIN_BRAND_LOADER_TIME = 400; // ms
  const [showBrandLoader, setShowBrandLoader] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setShowBrandLoader(true), MIN_BRAND_LOADER_TIME);
    return () => clearTimeout(timer);
  }, []);
  
  console.log('AppContent: Current state', {
    pathname: window.location.pathname,
    search: window.location.search,
    isAuthenticated,
    authLoading,
    loading,
    hasInitiallyLoaded,
    sessionInitialized
  });

  // Set up global service error handler
  useEffect(() => {
    const wrappedErrorHandler = (error: any) => {
      console.log('AppContent: Global error handler called', error);
      
      // Don't handle navigation errors during transitions
      if (error?.code === 'NAVIGATION_IN_PROGRESS') {
        return false;
      }
      
      // Log navigation-related errors
      if (error?.authenticationError || error?.status === 401) {
        navigationDebugger.logNavigation(createNavigationEvent(
          'GlobalErrorHandler',
          'error',
          window.location.pathname,
          'unknown',
          'Authentication error',
          { isAuthenticated, authLoading, hasInitiallyLoaded },
          { error: error.message || 'Unknown error' }
        ));
      }
      
      return handleServiceError(error);
    };
    
    setGlobalServiceErrorHandler(wrappedErrorHandler);
  }, [handleServiceError, isAuthenticated, authLoading, hasInitiallyLoaded]);

  // Initialize session management for authenticated users - FIXED: Only run once per authentication
  useEffect(() => {
    if (isAuthenticated && hasInitiallyLoaded && !authLoading && !sessionInitialized) {
      console.log('🔧 Initializing session management for authenticated user (one-time)');
      
      // Set up session invalidation callback
      sessionManager.setSessionInvalidatedCallback(() => {
        console.warn('🚨 Session invalidated - will handle in auth context');
        
        // Log session invalidation
        navigationDebugger.logNavigation(createNavigationEvent(
          'SessionManager',
          'session_invalidated',
          window.location.pathname,
          '/',
          'Session invalidated',
          { isAuthenticated, authLoading, hasInitiallyLoaded }
        ));
        
        // Let the auth context handle session invalidation
        // Don't redirect here to avoid competing navigation
      });

      // Start heartbeat if not already active
      if (!sessionManager.isHeartbeatActive()) {
        sessionManager.startHeartbeat();
      }

      // Check session limit for authenticated users - ONLY ONCE on login
      // Add delay to prevent race conditions with auth
      setTimeout(() => {
        checkSessionLimit().then(() => {
          console.log('📊 Initial session limit check completed');
        }).catch(error => {
          console.error('❌ Initial session limit check failed:', error);
          // Don't throw error to prevent breaking the app
        });
      }, 1000);

      // Log session status for debugging
      const sessionStatus = getSessionStatus();
      console.log('📊 Session status:', sessionStatus);
      
      // Mark session as initialized
      setSessionInitialized(true);
      
    } else if (!isAuthenticated && sessionManager.isHeartbeatActive()) {
      console.log('🛑 User not authenticated - stopping session heartbeat');
      sessionManager.stopHeartbeat();
      sessionManager.clearSessionInfo();
      // Reset session initialization flag
      setSessionInitialized(false);
    }
  }, [isAuthenticated, hasInitiallyLoaded, authLoading, sessionInitialized]);

  // Show global loading state during initial load
  if (loading || (authLoading && !hasInitiallyLoaded)) {
    return showBrandLoader ? (
      <IntelligentLoadingScreen fastMode={true} message="Loading ShopGauge..." />
    ) : null;
  }
  
  console.log('AppContent: Rendering main content', { 
    showDebugPanel, 
    isAuthenticated, 
    loading, 
    authLoading, 
    hasInitiallyLoaded 
  });
  
  const handleSessionDeleted = (sessionId: string) => {
    deleteSession(sessionId);
  };

  const handleContinueAfterSessionManagement = () => {
    closeSessionDialog();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col animate-fadeIn">
      <CommandPalette />
      <RouteErrorCleaner />
      <NavBar />
      <PrivacyBanner />
      <DebugPanel 
        isVisible={showDebugPanel} 
        onToggleVisibility={setShowDebugPanel} 
      />
      
      {/* Session Limit Management Dialog */}
      <SessionLimitDialog
        open={showSessionDialog}
        onClose={closeSessionDialog}
        onSessionDeleted={handleSessionDeleted}
        onContinue={handleContinueAfterSessionManagement}
        sessions={sessionLimitData?.sessions || []}
        loading={sessionLimitLoading}
        maxSessions={sessionLimitData?.maxSessions || 5}
      />
      
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/competitors" element={<ProtectedRoute><CompetitorsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminProtectedRoute><AdminPage /></AdminProtectedRoute>} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/service-unavailable" element={<ServiceUnavailablePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  // Only log in development
  if (import.meta.env.DEV) {
    console.log('App: Rendering');
  }

  React.useEffect(() => {
    // Check for loop detection parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('loop_detected') === 'true') {
      console.warn('🚨 Navigation loop was detected and broken');
      // Clean up the URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('loop_detected');
      window.history.replaceState({}, '', newUrl.toString());
      
      // Show toast notification
      toast.error('Navigation loop detected and resolved. Please try again.');
    }
    
    // Normalize URLs that accidentally include /index.html
    if (window.location.pathname.startsWith('/index.html')) {
      const cleanPath = window.location.pathname.replace('/index.html', '/') || '/';
      const newUrl = cleanPath + window.location.search + window.location.hash;
      console.log('App: Stripping /index.html from URL →', newUrl);
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <NavigationProvider>
            <AuthProvider>
              <ServiceStatusProvider>
                <NotificationSettingsProvider>
                  <Toaster 
                    position="top-center"
                    toastOptions={{
                      duration: 4000,
                      style: {
                        borderRadius: '8px',
                        fontWeight: '500',
                        zIndex: 9999,
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      },
                      success: {
                        style: {
                          background: '#10b981',
                          color: '#ffffff',
                        },
                      },
                      error: {
                        style: {
                          background: '#ef4444',
                          color: '#ffffff',
                        },
                      },
                    }}
                    containerStyle={{
                      zIndex: 9999,
                      top: '20px',
                    }}
                  />
                  <AppContent />
                </NotificationSettingsProvider>
              </ServiceStatusProvider>
            </AuthProvider>
          </NavigationProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
