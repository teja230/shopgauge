import React from 'react';
import { useAuth } from '../../context/AuthContext';

interface DemoModeIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

const DemoModeIndicator: React.FC<DemoModeIndicatorProps> = ({ 
  className = '', 
  showDetails = true 
}) => {
  const { isDemoMode } = useAuth();

  if (!isDemoMode) return null;

  return (
    <div className={`bg-gradient-to-r from-green-500 to-blue-500 text-white ${className}`}>
      <div className="flex items-center justify-center py-2 px-4">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="font-semibold">
            🎯 Demo Mode
          </span>
          {showDetails && (
            <span className="text-sm opacity-90 hidden sm:inline">
              • Exploring with sample data
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const DemoModeBanner: React.FC = () => {
  const { isDemoMode, logout } = useAuth();

  if (!isDemoMode) return null;

  const handleExitDemo = () => {
    // Clear demo mode flags
    localStorage.removeItem('demo_mode_active');
    sessionStorage.removeItem('demo_mode_active');
    
    // Log out the user
    logout();
    
    // Redirect to home page
    window.location.href = '/';
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg border-b border-blue-500">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="font-semibold text-base">
                🎯 Demo Mode Active
              </span>
            </div>
            <div className="hidden sm:block text-sm opacity-90">
              You're exploring ShopGauge with realistic sample data
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 text-sm">
              <span className="bg-white/20 px-2 py-1 rounded-md text-xs">📊 Live Analytics</span>
              <span className="bg-white/20 px-2 py-1 rounded-md text-xs">🏆 Competitor Tracking</span>
              <span className="bg-white/20 px-2 py-1 rounded-md text-xs">📈 AI Forecasting</span>
            </div>
            <button
              onClick={handleExitDemo}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded-lg font-medium transition-colors text-sm border border-white/20 hover:border-white/30"
            >
              Exit Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DemoModeChip: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isDemoMode } = useAuth();

  if (!isDemoMode) return null;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 ${className}`}>
      <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse"></span>
      Demo
    </span>
  );
};

export default DemoModeIndicator;
