import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Link, Routes, Route, BrowserRouter as Router, useNavigate } from 'react-router-dom';
import { ChartBarIcon, UsersIcon, HomeIcon } from '@heroicons/react/24/outline';
import { getAuthShop, logoutShop } from './api';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import CompetitorsPage from './pages/CompetitorsPage';
import ProfilePage from './pages/ProfilePage';
import toast from 'react-hot-toast';

// Auth context
const AuthContext = createContext<{ shop: string | null, loading: boolean, refresh: () => void }>({ shop: null, loading: true, refresh: () => {} });

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [shop, setShop] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const shopName = await getAuthShop();
      setShop(shopName);
      if (!shopName) {
        navigate('/');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setShop(null);
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { 
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ shop, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }

type ProtectedRouteProps = { children: React.ReactElement };
function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { shop, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !shop) {
      navigate('/');
    }
  }, [shop, loading, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!shop) {
    return null;
  }

  return children;
}

function NavBar() {
  const { shop } = useAuth();
  const navLinks = [
    { to: '/', label: 'Home', icon: <HomeIcon className="w-5 h-5 mr-1" /> },
    { to: '/dashboard', label: 'Dashboard', icon: <ChartBarIcon className="w-5 h-5 mr-1" /> },
    { to: '/competitors', label: 'Competitors', icon: <UsersIcon className="w-5 h-5 mr-1" /> },
    { to: '/profile', label: 'Profile', icon: <UsersIcon className="w-5 h-5 mr-1" /> },
  ];

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-gray-900">StoreSight</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          {shop && (
            <div className="flex items-center">
              <span className="text-sm text-gray-500 mr-4">Shop: {shop}</span>
              <button
                onClick={() => {
                  logoutShop();
                  toast.success('Logged out successfully');
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50 flex flex-col animate-fadeIn">
          <NavBar />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/competitors" element={<ProtectedRoute><CompetitorsPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
}
