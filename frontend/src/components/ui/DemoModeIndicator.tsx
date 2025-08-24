import React, { useState } from 'react';
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
  const [isHovered, setIsHovered] = useState(false);

  if (!isDemoMode) return null;

  const handleExitDemo = async () => {
    console.log('DemoModeIndicator: Starting demo exit process');
    
    try {
      // Clear demo mode flags first
      localStorage.removeItem('demo_mode_active');
      sessionStorage.removeItem('demo_mode_active');
      
      // Try to logout (this might fail in demo mode, which is fine)
      try {
        await logout();
        console.log('DemoModeIndicator: Logout successful');
      } catch (error) {
        console.log('DemoModeIndicator: Logout failed (expected in demo mode):', error);
        // This is expected in demo mode, continue with redirect
      }
      
      // Always redirect to home page
      console.log('DemoModeIndicator: Redirecting to home page');
      window.location.href = '/';
      
    } catch (error) {
      console.error('DemoModeIndicator: Error during demo exit:', error);
      // Fallback: just redirect to home
      window.location.href = '/';
    }
  };

  return (
    <div className="fixed bottom-8 left-4 z-30">
      <div 
        className="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Main Demo Button - Compact Version */}
        <button className="group flex items-center space-x-1.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-1.5 rounded-full shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 backdrop-blur-sm">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
          <span className="font-medium text-xs">Demo</span>
          <svg 
            className={`w-3 h-3 transition-transform duration-200 ${isHovered ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        <div className={`absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300 transform origin-bottom-left ${
          isHovered ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
        }`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <h3 className="font-semibold text-gray-900 text-sm">Demo Mode Active</h3>
            </div>
            <p className="text-xs text-gray-600 mt-1">Exploring with realistic sample data</p>
          </div>

          {/* Features */}
          <div className="p-3">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="flex flex-col items-center p-2 rounded-lg bg-green-50 border border-green-100">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mb-1">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-gray-700">Analytics</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg bg-purple-50 border border-purple-100">
                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center mb-1">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-gray-700">Tracking</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg bg-orange-50 border border-orange-100">
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center mb-1">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-gray-700">AI</span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <div className="text-xs font-medium text-gray-700 mb-2">Demo Data</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-500">Products:</span>
                  <span className="font-semibold text-gray-900 ml-1">3</span>
                </div>
                <div>
                  <span className="text-gray-500">Revenue:</span>
                  <span className="font-semibold text-gray-900 ml-1">$26.9K</span>
                </div>
                <div>
                  <span className="text-gray-500">Orders:</span>
                  <span className="font-semibold text-gray-900 ml-1">16</span>
                </div>
                <div>
                  <span className="text-gray-500">Period:</span>
                  <span className="font-semibold text-gray-900 ml-1">60 days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 space-y-2">
            <button
              onClick={() => {
                // Clear tutorial completion flags to allow restart
                const demoShop = 'demo-shopgauge.myshopify.com';
                localStorage.removeItem(`dashboard_tutorial_completed_${demoShop}`);
                localStorage.removeItem(`tutorialCompleted_${demoShop}`);
                sessionStorage.removeItem('demo_dashboard_tutorial_shown');
                sessionStorage.removeItem('demo_competitors_tutorial_shown');
                
                // Refresh the current page to trigger tutorial
                window.location.reload();
              }}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg"
            >
              🎯 Restart Tutorial
            </button>
            <button
              onClick={handleExitDemo}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg"
            >
              Exit Demo Mode
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
