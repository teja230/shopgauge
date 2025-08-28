import React, { useState, useEffect } from 'react';
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
  const [isPanelHovered, setIsPanelHovered] = useState(false);
  const [performanceStats, setPerformanceStats] = useState<any>(null);
  const [currentStrategy, setCurrentStrategy] = useState<string>('hybrid');
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [isAdvancedView, setIsAdvancedView] = useState(false);

  // Load performance monitoring data
  useEffect(() => {
    if (!isDemoMode) return;

    const loadPerformanceData = async () => {
      try {
        // Dynamically import services to avoid bundle size impact
        const [
          { demoManager, getDemoPerformanceStats },
          { performanceMonitor, getDemoSystemHealth },
          { demoSecurity, getDemoSecurityMetrics }
        ] = await Promise.all([
          import('../../services/IntelligentDemoManager'),
          import('../../services/DemoPerformanceMonitor'),
          import('../../services/DemoSecurityManager')
        ]);

        // Get current strategy and performance stats
        const strategy = demoManager.getStrategy();
        const stats = getDemoPerformanceStats(5 * 60 * 1000); // Last 5 minutes
        const health = await getDemoSystemHealth();

        setCurrentStrategy(strategy);
        setPerformanceStats(stats);
        setSystemHealth(health);
      } catch (error) {
        console.warn('⚠️ Demo Indicator: Failed to load performance data:', error);
      }
    };

    loadPerformanceData();

    // Update performance data every 30 seconds
    const interval = setInterval(loadPerformanceData, 30000);
    return () => clearInterval(interval);
  }, [isDemoMode]);

  // Early return after all hooks
  if (!isDemoMode) return null;

  // Keep overlay open if either button or panel is hovered
  const shouldShowOverlay = isHovered || isPanelHovered;

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
        onMouseLeave={() => {
          // Use a small delay to prevent flicker when moving between button and panel
          setTimeout(() => setIsHovered(false), 100);
        }}
      >
        {/* Main Demo Button - Clean and User-Friendly */}
        <button className="group flex items-center space-x-1.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-1.5 rounded-full shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 backdrop-blur-sm">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
          <span className="font-medium text-xs">Demo</span>
          {/* Only show performance info in development */}
          {import.meta.env.DEV && performanceStats?.averageResponseTime > 0 && (
            <span className="text-xs opacity-75">
              {Math.round(performanceStats.averageResponseTime)}ms
            </span>
          )}
          <svg 
            className={`w-3 h-3 transition-transform duration-200 ${shouldShowOverlay ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        <div 
          className={`absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300 transform origin-bottom-left ${
            shouldShowOverlay ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
          }`}
          onMouseEnter={() => setIsPanelHovered(true)}
          onMouseLeave={() => {
            // Small delay to allow smooth transitions
            setTimeout(() => setIsPanelHovered(false), 100);
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <h3 className="font-semibold text-gray-900 text-sm">Demo Mode Active</h3>
              </div>
              {/* Only show technical info in development */}
              {import.meta.env.DEV && (
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-gray-600 capitalize">{currentStrategy}</span>
                  {systemHealth?.overallHealth && (
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      systemHealth.overallHealth === 'excellent' ? 'bg-green-500' :
                      systemHealth.overallHealth === 'good' ? 'bg-blue-500' :
                      systemHealth.overallHealth === 'poor' ? 'bg-orange-500' : 'bg-red-500'
                    }`}></div>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {import.meta.env.DEV 
                ? `Intelligent demo with ${(performanceStats?.averageResponseTime > 0) ? `${Math.round(performanceStats.averageResponseTime)}ms` : '<50ms'} response times`
                : 'Exploring with realistic sample data'
              }
            </p>
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

            {/* Demo Data Overview */}
            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-gray-700">Demo Data</div>
                {/* Only show debug mode for developers */}
                {import.meta.env.DEV && (
                  <button
                    onClick={() => setIsAdvancedView(!isAdvancedView)}
                    className="text-xs text-gray-500 hover:text-blue-600 font-medium"
                    title="Developer Debug View"
                  >
                    {isAdvancedView ? '👁️' : '🔧'}
                  </button>
                )}
              </div>
              
              {!isAdvancedView || !import.meta.env.DEV ? (
                // User-friendly view - Focus on demo content
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">Products:</span>
                    <span className="font-semibold text-gray-900 ml-1">24</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Revenue:</span>
                    <span className="font-semibold text-gray-900 ml-1">$26.9K</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Orders:</span>
                    <span className="font-semibold text-gray-900 ml-1">187</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Period:</span>
                    <span className="font-semibold text-gray-900 ml-1">30 days</span>
                  </div>
                </div>
              ) : (
                // Developer debug view - Performance metrics (DEV only)
                <div className="space-y-2">
                  <div className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded">
                    🔧 Developer Debug Mode
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500">Strategy:</span>
                      <div className="flex items-center mt-1">
                        <span className="font-semibold text-gray-900 capitalize">{currentStrategy}</span>
                        <div className={`w-2 h-2 rounded-full ml-2 ${
                          currentStrategy === 'frontend' ? 'bg-green-500' :
                          currentStrategy === 'hybrid' ? 'bg-blue-500' :
                          currentStrategy === 'backend' ? 'bg-orange-500' : 'bg-gray-500'
                        }`}></div>
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Health:</span>
                      <div className="flex items-center mt-1">
                        <span className={`font-semibold capitalize ${
                          systemHealth?.overallHealth === 'excellent' ? 'text-green-600' :
                          systemHealth?.overallHealth === 'good' ? 'text-blue-600' :
                          systemHealth?.overallHealth === 'poor' ? 'text-orange-600' : 'text-red-600'
                        }`}>
                          {systemHealth?.overallHealth || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {performanceStats && (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500">Avg Response:</span>
                        <span className="font-semibold text-green-600 ml-1">
                          {(performanceStats?.averageResponseTime > 0) ? Math.round(performanceStats.averageResponseTime) : '0'}ms
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Success Rate:</span>
                        <span className="font-semibold text-green-600 ml-1">
                          {Math.round(performanceStats.successRate)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Requests:</span>
                        <span className="font-semibold text-gray-900 ml-1">
                          {performanceStats.totalRequests}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Cache Hit:</span>
                        <span className="font-semibold text-blue-600 ml-1">
                          {Math.round(performanceStats.cacheHitRate)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 space-y-2">
            <button
              onClick={() => {
                console.log('DemoModeIndicator: Restarting tutorial');
                
                // Clear tutorial completion flags to allow restart
                const demoShop = 'demo-shopgauge.myshopify.com';
                localStorage.removeItem(`dashboard_tutorial_completed_${demoShop}`);
                localStorage.removeItem(`tutorialCompleted_${demoShop}`);
                sessionStorage.removeItem('demo_dashboard_tutorial_shown');
                sessionStorage.removeItem('demo_competitors_tutorial_shown');
                
                // Ensure demo mode flags are maintained
                localStorage.setItem('demo_mode_active', 'true');
                sessionStorage.setItem('demo_session_started', new Date().toISOString());
                
                // Instead of refreshing, redirect to dashboard with demo=true to ensure proper demo mode setup
                // The URL will be cleaned by AuthContext after demo mode is detected
                const currentPath = window.location.pathname;
                if (currentPath === '/dashboard' || currentPath === '/') {
                  // For dashboard, redirect with demo parameter to ensure proper setup
                  window.location.href = '/dashboard?demo=true';
                } else if (currentPath === '/competitors') {
                  // For competitors page, first go to dashboard, then navigate to competitors
                  // This ensures the tutorial flow works properly (dashboard first, then competitors)
                  window.location.href = '/dashboard?demo=true';
                } else {
                  // For any other page, go to dashboard first
                  window.location.href = '/dashboard?demo=true';
                }
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
