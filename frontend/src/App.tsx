import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ServiceStatusProvider, useServiceStatus } from './context/ServiceStatusContext';
import { NotificationSettingsProvider } from './context/NotificationSettingsContext';
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
import SessionExtensionPrompt from './components/ui/SessionExtensionPrompt';
import { useNotifications } from './hooks/useNotifications';

// Simple Protected Route for shop authentication
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authLoading, hasInitiallyLoaded } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  debugLog.debug('ProtectedRoute: Auth status', { 
    isAuthenticated, 
    authLoading, 
    hasInitiallyLoaded,
    path: location.pathname
  }, 'ProtectedRoute');
  
  // Handle redirect for unauthenticated users
  useEffect(() => {
    if (!isAuthenticated && !authLoading && hasInitiallyLoaded) {
      debugLog.info('ProtectedRoute: Not authenticated, redirecting to home', {
        currentPath: location.pathname + location.search + location.hash
      }, 'ProtectedRoute');
      const currentPath = location.pathname + location.search + location.hash;
      const redirectUrl = currentPath !== '/' ? `/?redirect=${encodeURIComponent(currentPath)}` : '/';
      navigate(redirectUrl, { replace: true });
    }
  }, [isAuthenticated, authLoading, hasInitiallyLoaded, navigate, location.pathname, location.search, location.hash]);
  
  // Show loading state while auth is being checked
  if (authLoading || !hasInitiallyLoaded) {
    return <IntelligentLoadingScreen fastMode={true} message="Authenticating..." />;
  }
  
  // Show loading state for redirect
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
  const { isAuthenticated, authLoading, loading, hasInitiallyLoaded, shop } = useAuth();
  const { handleServiceError } = useServiceStatus();
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
      console.log('App: Session invalidated event received:', event.detail);
      addNotification(event.detail.message, 'error', {
        persistent: true,
        category: 'Authentication',
        action: {
          label: 'Logout',
          onClick: () => handleSessionLogout()
        }
      });
    };

    // Add event listeners
    window.addEventListener('sessionExtensionPrompt', handleSessionExtensionPrompt as EventListener);
    window.addEventListener('sessionExpired', handleSessionExpired as EventListener);
    window.addEventListener('sessionExtended', handleSessionExtended as EventListener);
    window.addEventListener('sessionExpiring', handleSessionExpiring as EventListener);
    window.addEventListener('sessionRefreshNeeded', handleSessionRefreshNeeded as EventListener);
    window.addEventListener('sessionError', handleSessionError as EventListener);
    window.addEventListener('sessionInvalidated', handleSessionInvalidated as EventListener);

    // Cleanup function
    return () => {
      window.removeEventListener('sessionExtensionPrompt', handleSessionExtensionPrompt as EventListener);
      window.removeEventListener('sessionExpired', handleSessionExpired as EventListener);
      window.removeEventListener('sessionExtended', handleSessionExtended as EventListener);
      window.removeEventListener('sessionExpiring', handleSessionExpiring as EventListener);
      window.removeEventListener('sessionRefreshNeeded', handleSessionRefreshNeeded as EventListener);
      window.removeEventListener('sessionError', handleSessionError as EventListener);
      window.removeEventListener('sessionInvalidated', handleSessionInvalidated as EventListener);
    };
  }, [handleSessionExtension, handleSessionLogout]);

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
  const currentPath = window.location.pathname;
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
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
