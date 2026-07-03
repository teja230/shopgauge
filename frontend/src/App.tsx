import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ServiceStatusProvider } from './context/ServiceStatusContext';
import { NotificationSettingsProvider } from './context/NotificationSettingsContext';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import BusinessIntelligencePage from './pages/BusinessIntelligencePage';
import CompetitorsPage from './pages/CompetitorsPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import NotFoundPage from './pages/NotFoundPage';
import ServiceUnavailablePage from './pages/ServiceUnavailablePage';
import NavBar from './components/NavBar';
import Footer from './components/ui/Footer';
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
import SessionExtensionPrompt from './components/ui/SessionExtensionPrompt';
import { useNotifications } from './hooks/useNotifications';
import DemoPerformanceConsole from './components/dev/DemoPerformanceConsole';
import { isAppShellPath } from './utils/routeChrome';

// Simple Protected Route for shop authentication
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authLoading, hasInitiallyLoaded, isDemoMode: contextDemoMode } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Check if this is a demo mode request from multiple sources
  const urlParams = new URLSearchParams(location.search);
  const isDemoInUrl = urlParams.get('demo') === 'true';
  const isDemoInLocalStorage = localStorage.getItem('demo_mode_active') === 'true';
  const isDemoMode = isDemoInUrl || isDemoInLocalStorage || contextDemoMode;

  debugLog.debug('ProtectedRoute: Auth status', {
    isAuthenticated,
    authLoading,
    hasInitiallyLoaded,
    path: location.pathname,
    isDemoInUrl,
    isDemoInLocalStorage,
    contextDemoMode,
    isDemoMode
  }, 'ProtectedRoute');

  // Handle redirect for unauthenticated users (but allow demo mode to proceed)
  useEffect(() => {
    if (!isAuthenticated && !authLoading && hasInitiallyLoaded && !isDemoMode) {
      debugLog.info('ProtectedRoute: Not authenticated and not demo mode, redirecting to home', {
        currentPath: location.pathname + location.search + location.hash
      }, 'ProtectedRoute');
      const currentPath = location.pathname + location.search + location.hash;
      const redirectUrl = currentPath !== '/' ? `/?redirect=${encodeURIComponent(currentPath)}` : '/';
      navigate(redirectUrl, { replace: true });
    }
  }, [isAuthenticated, authLoading, hasInitiallyLoaded, isDemoMode, navigate, location.pathname, location.search, location.hash]);

  // For demo mode, immediately render without waiting for auth checks
  if (isDemoMode) {
    debugLog.debug('ProtectedRoute: Demo mode detected, rendering immediately', { isDemoMode });
    return <>{children}</>;
  }

  // Show loading state while auth is being checked (non-demo mode)
  if (authLoading || !hasInitiallyLoaded) {
    return <IntelligentLoadingScreen fastMode={true} message="Authenticating..." />;
  }

  // Show loading state for redirect (non-demo mode)
  if (!isAuthenticated) {
    return <IntelligentLoadingScreen fastMode={true} message="Redirecting..." />;
  }

  // Render protected content
  return <>{children}</>;
};

// Admin Protected Route - Independent of shop authentication
const AdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  debugLog.debug('AdminProtectedRoute: Rendering AdminPage (admin handles own auth)', {}, 'AdminProtectedRoute');

  // Always render AdminPage - it has its own password dialog for authentication
  // This allows admin access independent of shop authentication
  return <>{children}</>;
};

// Component to clear errors on route changes
const RouteErrorCleaner: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    debugLog.info('RouteErrorCleaner: Route changed', { pathname: location.pathname }, 'RouteErrorCleaner');

    // Clear component errors on navigation
    window.dispatchEvent(new CustomEvent('clearComponentErrors'));
  }, [location.pathname]);

  return null;
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated, authLoading, loading, hasInitiallyLoaded, isDemoMode: contextDemoMode } = useAuth();
  const { addNotification } = useNotifications();
  const [showDebugPanel, setShowDebugPanel] = React.useState(false);

  // Session limit management
  const {
    sessionLimitData,
    loading: sessionLimitLoading,
    showSessionDialog,
    checkSessionLimit,
    deleteSession,
    deleteSessions,
    closeSessionDialog,
  } = useSessionLimit();

  // Track session initialization to prevent repeated calls
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [showSessionExtensionPrompt, setShowSessionExtensionPrompt] = useState(false);
  const [sessionExtensionData, setSessionExtensionData] = useState<{
    expiresInMinutes: number;
    gracePeriodMinutes: number;
  } | null>(null);

  // Session extension handlers
  const handleSessionExtension = useCallback(async (): Promise<boolean> => {
    try {
      const success = await sessionManager.extendSession();
      if (success) {
        // Clear any existing extension prompt
        setShowSessionExtensionPrompt(false);
        setSessionExtensionData(null);
      }
      return success;
    } catch (error) {
      console.error('Session extension failed:', error);
      return false;
    }
  }, []);

  const handleSessionExtensionDismiss = useCallback(() => {
    setShowSessionExtensionPrompt(false);
    setSessionExtensionData(null);
    sessionManager.clearExtensionPrompt();
  }, []);

  const handleSessionLogout = useCallback(() => {
    // Clear session data and redirect to home
    sessionManager.clearSessionInfo();
    window.location.href = '/';
  }, []);

  // Session event listeners
  useEffect(() => {
    const handleSessionExtensionPrompt = (event: CustomEvent) => {
      console.log('Session extension prompt received:', event.detail);
      setSessionExtensionData({
        expiresInMinutes: event.detail.expiresInMinutes || 0,
        gracePeriodMinutes: 2 // Default grace period
      });
      setShowSessionExtensionPrompt(true);
    };

    const handleSessionExpired = (event: CustomEvent) => {
      console.log('Session expired event received:', event.detail);
      setSessionExtensionData({
        expiresInMinutes: 0, // Already expired
        gracePeriodMinutes: event.detail.gracePeriodMinutes || 2
      });
      setShowSessionExtensionPrompt(true);
    };

    const handleSessionExtended = (event: CustomEvent) => {
      console.log('Session extended event received:', event.detail);
      addNotification('Session extended successfully!', 'success', {
        duration: 5000,
        category: 'Authentication'
      });
    };

    const handleSessionExpiring = (event: CustomEvent) => {
      console.log('Session expiring event received:', event.detail);
      if (event.detail.canExtend && event.detail.extensionAvailable) {
        // Show extension prompt for expiring sessions
        setSessionExtensionData({
          expiresInMinutes: event.detail.expiresInMinutes || 0,
          gracePeriodMinutes: 2
        });
        setShowSessionExtensionPrompt(true);
      } else {
        // Show regular warning notification
        addNotification(event.detail.message, 'warning', {
          persistent: true,
          category: 'Authentication',
          action: {
            label: 'Extend Session',
            onClick: () => handleSessionExtension()
          }
        });
      }
    };

    const handleSessionRefreshNeeded = (event: CustomEvent) => {
      console.log('Session refresh needed event received:', event.detail);
      addNotification(event.detail.message, 'info', {
        persistent: true,
        category: 'Authentication',
        action: {
          label: 'Refresh Session',
          onClick: () => handleSessionExtension()
        }
      });
    };

    const handleSessionError = (event: CustomEvent) => {
      console.log('Session error event received:', event.detail);
      addNotification(event.detail.message, 'error', {
        persistent: true,
        category: 'Authentication'
      });
    };

    const handleSessionInvalidated = (event: CustomEvent) => {
      debugLog.warn('Session invalidated event received', {
        detail: event.detail,
        timestamp: new Date().toISOString()
      }, 'App');
      addNotification(event.detail.message, 'error', {
        persistent: true,
        category: 'Authentication',
        action: {
          label: 'Logout',
          onClick: () => handleSessionLogout()
        }
      });
    };

    // Handle session expiration from backend responses
    const handleSessionExpiration = () => {
      // Check if we were redirected due to session expiration
      const urlParams = new URLSearchParams(window.location.search);
      const sessionExpired = urlParams.get('sessionExpired');

      if (sessionExpired === 'true') {
        addNotification('Your session has expired due to inactivity. Please login again.', 'warning', {
          duration: 8000,
          category: 'Authentication',
          action: {
            label: 'Login',
            onClick: () => window.location.href = '/'
          }
        });

        // Clean up the URL parameter
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('sessionExpired');
        window.history.replaceState({}, '', newUrl.toString());
      }
    };

    // Check for session expiration on mount
    handleSessionExpiration();

    // Intercept fetch responses to check for session expiration headers
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      // Check for session expiration header
      const sessionExpired = response.headers.get('X-Session-Expired');
      if (sessionExpired === 'true') {
        addNotification('Your session has expired due to inactivity. Please login again.', 'warning', {
          duration: 8000,
          category: 'Authentication',
          action: {
            label: 'Login',
            onClick: () => window.location.href = '/'
          }
        });
      }

      return response;
    };

    // Add event listeners
    window.addEventListener('sessionExtensionPrompt', handleSessionExtensionPrompt as any);
    window.addEventListener('sessionExpired', handleSessionExpired as any);
    window.addEventListener('sessionExtended', handleSessionExtended as any);
    window.addEventListener('sessionExpiring', handleSessionExpiring as any);
    window.addEventListener('sessionRefreshNeeded', handleSessionRefreshNeeded as any);
    window.addEventListener('sessionError', handleSessionError as any);
    window.addEventListener('sessionInvalidated', handleSessionInvalidated as any);

    // Cleanup function
    return () => {
      window.removeEventListener('sessionExtensionPrompt', handleSessionExtensionPrompt as any);
      window.removeEventListener('sessionExpired', handleSessionExpired as any);
      window.removeEventListener('sessionExtended', handleSessionExtended as any);
      window.removeEventListener('sessionExpiring', handleSessionExpiring as any);
      window.removeEventListener('sessionRefreshNeeded', handleSessionRefreshNeeded as any);
      window.removeEventListener('sessionError', handleSessionError as any);
      window.removeEventListener('sessionInvalidated', handleSessionInvalidated as any);

      // Restore original fetch
      window.fetch = originalFetch;
    };
  }, [handleSessionExtension, handleSessionLogout, addNotification]);

  // Initialize session management for authenticated users
  useEffect(() => {
    if (isAuthenticated && hasInitiallyLoaded && !authLoading && !sessionInitialized) {
      debugLog.info('🔧 Initializing session management for authenticated user', {}, 'SessionManager');

      // Start heartbeat if not already active
      if (!sessionManager.isHeartbeatActive()) {
        sessionManager.startHeartbeat();
      }

      // Check session limit - with delay to prevent race conditions
      setTimeout(() => {
        checkSessionLimit().then(() => {
          debugLog.info('📊 Session limit check completed', {}, 'SessionManager');
        }).catch(error => {
          debugLog.error('❌ Session limit check failed', { error: error.message }, 'SessionManager');
        });
      }, 1000);

              // Log session status
        const sessionStatus = getSessionStatus();
        debugLog.debug('📊 Session status', sessionStatus, 'SessionManager');

      setSessionInitialized(true);

    } else if (!isAuthenticated && sessionManager.isHeartbeatActive()) {
      debugLog.info('🛑 User not authenticated - stopping session heartbeat', {}, 'SessionManager');
      sessionManager.stopHeartbeat();
      sessionManager.clearSessionInfo();
      setSessionInitialized(false);
    }
  }, [isAuthenticated, hasInitiallyLoaded, authLoading, sessionInitialized, checkSessionLimit]);

  // Show global loading state during initial load - always show something to prevent blank pages
  // Skip loading screen for admin pages - they handle their own authentication
  const currentPath = location.pathname;
  const shellHasDemoMode =
    contextDemoMode ||
    localStorage.getItem('demo_mode_active') === 'true' ||
    new URLSearchParams(location.search).get('demo') === 'true';
  const showAppShell = isAppShellPath(currentPath) && (isAuthenticated || shellHasDemoMode);
  const debugToolsEnabled =
    import.meta.env.DEV && new URLSearchParams(location.search).get('debug') === 'true';
  if ((loading || (authLoading && !hasInitiallyLoaded)) && !currentPath.startsWith('/admin')) {
    return <IntelligentLoadingScreen fastMode={true} message="Loading ShopGauge..." />;
  }

  const handleSessionDeleted = (sessionId: string) => {
    deleteSession(sessionId);
  };

  const handleContinueAfterSessionManagement = () => {
    closeSessionDialog();
  };

  return (
    <div className={`${showAppShell ? 'lg:pl-64' : ''} min-h-screen bg-[#f6f7f9] flex flex-col animate-fadeIn`}>
      <CommandPalette />
      <RouteErrorCleaner />
      {debugToolsEnabled && <DemoPerformanceConsole />}
      <NavBar />
      <PrivacyBanner />
      {debugToolsEnabled && (
        <DebugPanel
          isVisible={showDebugPanel}
          onToggleVisibility={setShowDebugPanel}
        />
      )}

      {/* Session Limit Management Dialog */}
      <SessionLimitDialog
        open={showSessionDialog}
        onClose={closeSessionDialog}
        onSessionDeleted={handleSessionDeleted}
        onSessionsDeleted={deleteSessions}
        onContinue={handleContinueAfterSessionManagement}
        sessions={sessionLimitData?.sessions || []}
        loading={sessionLimitLoading}
        maxSessions={sessionLimitData?.maxSessions || 5}
        limitReached={sessionLimitData?.limitReached || false}
      />

      {/* Session Extension Prompt */}
      {showSessionExtensionPrompt && sessionExtensionData && (
        <SessionExtensionPrompt
          expiresInMinutes={sessionExtensionData.expiresInMinutes}
          gracePeriodMinutes={sessionExtensionData.gracePeriodMinutes}
          onExtend={handleSessionExtension}
          onDismiss={handleSessionExtensionDismiss}
          onLogout={handleSessionLogout}
        />
      )}

      <main className="flex-1">
        <div key={location.pathname} className="route-transition">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/business-intelligence" element={<ProtectedRoute><BusinessIntelligencePage /></ProtectedRoute>} />
          <Route path="/competitors" element={<ProtectedRoute><CompetitorsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminProtectedRoute><AdminPage /></AdminProtectedRoute>} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/service-unavailable" element={<ServiceUnavailablePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  debugLog.debug('App: Rendering', {}, 'App');

  useEffect(() => {
    // Normalize URLs that accidentally include /index.html
    if (window.location.pathname.startsWith('/index.html')) {
      const cleanPath = window.location.pathname.replace('/index.html', '/') || '/';
      const newUrl = cleanPath + window.location.search + window.location.hash;
      debugLog.info('App: Stripping /index.html from URL', { newUrl }, 'App');
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <NotificationSettingsProvider>
            <ServiceStatusProvider>
              <AuthProvider>
                <Toaster
                  position="top-center"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      borderRadius: '10px',
                      fontWeight: '500',
                      zIndex: 9999,
                      background: '#ffffff',
                      color: '#111827',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 10px 30px -6px rgb(15 23 42 / 0.15)',
                    },
                    success: {
                      iconTheme: {
                        primary: '#16a34a',
                        secondary: '#ffffff',
                      },
                    },
                    error: {
                      iconTheme: {
                        primary: '#dc2626',
                        secondary: '#ffffff',
                      },
                    },
                  }}
                  containerStyle={{
                    zIndex: 9999,
                    top: '20px',
                  }}
                />
                <AppContent />
              </AuthProvider>
            </ServiceStatusProvider>
          </NotificationSettingsProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
