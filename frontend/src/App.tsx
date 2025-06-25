import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import CompetitorsPage from './pages/CompetitorsPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import NotFoundPage from './pages/NotFoundPage';
import NavBar from './components/NavBar';
import PrivacyBanner from './components/ui/PrivacyBanner';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-blue-900 mb-2">Authenticating...</h2>
          <p className="text-blue-700">Please wait while we verify your access.</p>
        </div>
      </div>
    );
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

// Component to handle redirects from 404.html and loading.html
const RedirectHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    // Don't process redirects while auth is loading
    if (authLoading) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const redirectPath = params.get('redirect');
    
    if (redirectPath && redirectPath !== '/index.html') {
      console.log('RedirectHandler: Processing redirect to:', redirectPath);
      
      // Define valid routes that should be redirected to
      const validRoutes = ['/dashboard', '/competitors', '/admin', '/profile', '/privacy-policy'];
      const protectedRoutes = ['/dashboard', '/competitors', '/profile'];
      
      // Check if the redirect path is a valid route
      if (validRoutes.includes(redirectPath)) {
        // For protected routes, only redirect if user is authenticated
        if (protectedRoutes.includes(redirectPath)) {
          if (isAuthenticated) {
            console.log('RedirectHandler: Authenticated user, redirecting to protected route:', redirectPath);
            navigate(redirectPath, { replace: true });
          } else {
            console.log('RedirectHandler: Not authenticated, staying on home page with redirect param');
            // Keep the redirect parameter for after login
          }
        } else {
          // Non-protected routes (admin, privacy-policy) can be accessed directly
          console.log('RedirectHandler: Redirecting to public route:', redirectPath);
          navigate(redirectPath, { replace: true });
        }
      } else {
        // Invalid route - remove redirect parameter and let the app handle it normally
        // This will cause the catch-all route (*) to show the 404 page
        console.log('RedirectHandler: Invalid route, removing redirect parameter:', redirectPath);
        navigate(location.pathname, { replace: true });
      }
    }
  }, [navigate, location, authLoading, isAuthenticated]);

  return null;
};

const AppContent: React.FC = () => {
  const { isAuthenticated, authLoading, loading } = useAuth();
  
  console.log('AppContent: Current location', {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    isAuthenticated,
    authLoading,
    loading
  });

  // Show global loading state only during initial load
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-blue-900 mb-2">Loading ShopGauge...</h2>
          <p className="text-blue-700">Please wait while we set up your dashboard.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col animate-fadeIn">
      <RedirectHandler />
      <NavBar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          {/* Handle /index.html route explicitly */}
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/competitors"
            element={
              <ProtectedRoute>
                <CompetitorsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={<AdminPage />}
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/privacy-policy"
            element={<PrivacyPolicyPage />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {/* Show privacy banner only for authenticated users */}
      {isAuthenticated && <PrivacyBanner />}
    </div>
  );
};

const App: React.FC = () => {
  // Only log in development
  if (import.meta.env.DEV) {
    console.log('App: Rendering');
  }
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <AuthProvider>
            <Toaster 
              position="top-center"
              toastOptions={{
                duration: 4000,
                style: {
                  borderRadius: '8px',
                  fontWeight: '500',
                  zIndex: 9999,
                },
              }}
              containerStyle={{
                zIndex: 9999,
              }}
            />
            <AppContent />
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
