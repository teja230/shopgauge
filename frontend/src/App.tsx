import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import CompetitorsPage from './pages/CompetitorsPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import NotFoundPage from './pages/NotFoundPage';
import NavBar from './components/NavBar';
import PrivacyBanner from './components/ui/PrivacyBanner';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authLoading } = useAuth();
  // Only log in development
  if (import.meta.env.DEV) {
    console.log('ProtectedRoute: Checking auth', { isAuthenticated, authLoading });
  }
  
  console.log('ProtectedRoute: Auth status', { 
    isAuthenticated, 
    authLoading, 
    path: window.location.pathname,
    search: window.location.search 
  });
  
  if (authLoading) {
    // Only log in development
    if (import.meta.env.DEV) {
      console.log('ProtectedRoute: Auth loading');
    }
    console.log('ProtectedRoute: Showing loading state');
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    // Only log in development
    if (import.meta.env.DEV) {
      console.log('ProtectedRoute: Not authenticated, redirecting to home');
    }
    console.log('ProtectedRoute: Not authenticated, redirecting to home from:', window.location.pathname);
    return <Navigate to="/" replace />;
  }
  
  // Only log in development
  if (import.meta.env.DEV) {
    console.log('ProtectedRoute: Authenticated, rendering children');
  }
  console.log('ProtectedRoute: Authenticated, rendering children for:', window.location.pathname);
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  
  // Only log in development
  if (import.meta.env.DEV) {
    console.log('AppContent: Rendering');
  }
  
  console.log('AppContent: Current location', {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    isAuthenticated
  });
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col animate-fadeIn">
      <NavBar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/debug" element={<DebugAuthState />} />
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
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
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

// Simple debug component to show auth state
const DebugAuthState: React.FC = () => {
  const { isAuthenticated, shop, authLoading, loading } = useAuth();
  
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', margin: '20px', borderRadius: '8px' }}>
      <h2>Debug Auth State</h2>
      <p><strong>isAuthenticated:</strong> {isAuthenticated ? 'true' : 'false'}</p>
      <p><strong>shop:</strong> {shop || 'null'}</p>
      <p><strong>authLoading:</strong> {authLoading ? 'true' : 'false'}</p>
      <p><strong>loading:</strong> {loading ? 'true' : 'false'}</p>
      <p><strong>Current URL:</strong> {window.location.href}</p>
      <p><strong>Current Path:</strong> {window.location.pathname}</p>
      <p><strong>Current Search:</strong> {window.location.search}</p>
      <p><strong>Cookies:</strong> {document.cookie}</p>
    </div>
  );
};

const App: React.FC = () => {
  // Only log in development
  if (import.meta.env.DEV) {
    console.log('App: Rendering');
  }
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AuthProvider>
          <Toaster position="top-right" />
          <AppContent />
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
};

export default App;
