import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authLoading } = useAuth();
  const location = useLocation();
  
  console.log('ProtectedRoute: Auth status', { 
    isAuthenticated, 
    authLoading, 
    path: window.location.pathname,
    search: window.location.search 
  });
  
  if (authLoading) {
    console.log('ProtectedRoute: Showing loading state');
    return <IntelligentLoadingScreen fastMode={true} message="Authenticating..." />;
  }
  
  if (!isAuthenticated) {
    console.log('ProtectedRoute: Not authenticated, redirecting to home from:', window.location.pathname);
    // Preserve the current path as a redirect parameter so user can return after login
    const currentPath = location.pathname + location.search + location.hash;
    return <Navigate to={`/?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }
  
  console.log('ProtectedRoute: Authenticated, rendering children for:', window.location.pathname);
  return <>{children}</>;
};

// Component to handle global error clearing on route changes
const RouteErrorCleaner: React.FC = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Only clear error toasts, not all toasts
    // This prevents success/info notifications from being dismissed
    console.log('RouteErrorCleaner: Route changed to:', location.pathname);
    
    // Dispatch a custom event that components can listen to for clearing their error states
    window.dispatchEvent(new CustomEvent('clearComponentErrors'));
  }, [location.pathname]);

  return null;
};

const AppContent: React.FC = () => {
  const { isAuthenticated, authLoading, loading } = useAuth();
  const { handleServiceError } = useServiceStatus();
  const [showDebugPanel, setShowDebugPanel] = React.useState(true); // Force debug panel to be visible for testing
  
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
  
  // Escalating loader: render the branded IntelligentLoadingScreen only
  // if the critical boot-up takes longer than a short threshold.
  const MIN_BRAND_LOADER_TIME = 400; // ms – tweak if needed
  const [showBrandLoader, setShowBrandLoader] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setShowBrandLoader(true), MIN_BRAND_LOADER_TIME);
    return () => clearTimeout(timer);
  }, []);
  
  console.log('AppContent: Current location', {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    isAuthenticated,
    authLoading,
    loading,
    sessionInitialized
  });

  // Set up global service error handler
  useEffect(() => {
    setGlobalServiceErrorHandler(handleServiceError);
  }, [handleServiceError]);

  // Initialize session management for authenticated users - FIXED: Only run once per authentication
  useEffect(() => {
    if (isAuthenticated && !authLoading && !sessionInitialized) {
      console.log('🔧 Initializing session management for authenticated user (one-time)');
      
      // Set up session invalidation callback
      sessionManager.setSessionInvalidatedCallback(() => {
        console.warn('🚨 Session invalidated - redirecting to home page');
        toast.error('Your session has expired. Please login again.');
        // Force re-authentication by reloading the page
        window.location.href = '/';
      });

      // Start heartbeat if not already active
      if (!sessionManager.isHeartbeatActive()) {
        sessionManager.startHeartbeat();
      }

      // Check session limit for authenticated users - ONLY ONCE on login
      checkSessionLimit().then(() => {
        console.log('📊 Initial session limit check completed');
      }).catch(error => {
        console.error('❌ Initial session limit check failed:', error);
      });

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
  }, [isAuthenticated, authLoading, sessionInitialized]); // FIXED: Removed checkSessionLimit from dependencies

  // Show global loading state during initial load or auth loading
  if (loading || authLoading) {
    return showBrandLoader ? (
      <IntelligentLoadingScreen fastMode={true} message="Loading ShopGauge..." />
    ) : null;
  }
  
  console.log('AppContent: DebugPanel state:', { showDebugPanel, isAuthenticated, loading, authLoading });
  
  const handleSessionDeleted = (sessionId: string) => {
    deleteSession(sessionId);
  };

  const handleContinueAfterSessionManagement = () => {
    closeSessionDialog();
    // Optionally refresh session data or perform other actions
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
          <Route
            path="/dashboard"
            element={
              isAuthenticated ? (
                <DashboardPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/competitors"
            element={
              isAuthenticated ? (
                <CompetitorsPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/profile"
            element={
              isAuthenticated ? (
                <ProfilePage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/admin" 
            element={
              isAuthenticated ? (
                <AdminPage />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
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
    // Normalize URLs that accidentally include /index.html (e.g., from old redirects)
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
                    background: '#10b981', // Green
                    color: '#ffffff',
                  },
                },
                error: {
                  style: {
                    background: '#ef4444', // Red
                    color: '#ffffff',
                  },
                },
              }}
              containerStyle={{
                zIndex: 9999,
                top: '20px', // Reduced from 60px to ensure visibility
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
