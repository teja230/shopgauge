/**
 * Demo Performance Console - Developer-Only Performance Monitoring
 * 
 * This component provides detailed performance monitoring for developers
 * without cluttering the user-facing demo interface.
 * 
 * Usage: Only visible in development mode with URL parameter ?debug=performance
 */

import React, { useState, useEffect } from 'react';

interface PerformanceConsoleProps {
  className?: string;
}

const DemoPerformanceConsole: React.FC<PerformanceConsoleProps> = ({ className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [performanceStats, setPerformanceStats] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [currentStrategy, setCurrentStrategy] = useState<string>('hybrid');
  const [isMinimized, setIsMinimized] = useState(false);

  // Only show in development mode with debug parameter
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug');
    const isDemoMode = localStorage.getItem('demo_mode_active') === 'true';
    
    setIsVisible(isDemoMode && (debugMode === 'performance' || debugMode === 'true'));
  }, []);

  // Load performance data
  useEffect(() => {
    if (!isVisible) return;

    const loadPerformanceData = async () => {
      try {
        const [
          { demoManager, getDemoPerformanceStats },
          { getDemoSystemHealth },
          { getDemoSecurityMetrics }
        ] = await Promise.all([
          import('../../services/IntelligentDemoManager'),
          import('../../services/DemoPerformanceMonitor'),
          import('../../services/DemoSecurityManager')
        ]);

        const strategy = demoManager.getStrategy();
        const stats = getDemoPerformanceStats();
        const health = await getDemoSystemHealth();

        setCurrentStrategy(strategy);
        setPerformanceStats(stats);
        setSystemHealth(health);
      } catch (error) {
        console.warn('⚠️ Performance Console: Failed to load data:', error);
      }
    };

    loadPerformanceData();
    const interval = setInterval(loadPerformanceData, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      <div className="bg-black bg-opacity-90 text-green-400 rounded-lg shadow-2xl border border-green-500/30 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-green-500/30">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <h3 className="font-mono text-sm font-semibold">Performance Console</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-green-400 hover:text-green-300 text-xs"
            >
              {isMinimized ? '📈' : '📉'}
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="text-green-400 hover:text-green-300 text-xs"
            >
              ✕
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="p-4 space-y-4 w-80">
            {/* Strategy Status */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-green-300">Current Strategy</div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  currentStrategy === 'frontend' ? 'bg-green-500' :
                  currentStrategy === 'hybrid' ? 'bg-blue-500' :
                  currentStrategy === 'backend' ? 'bg-orange-500' : 'bg-gray-500'
                }`}></div>
                <span className="font-mono text-sm capitalize">{currentStrategy}</span>
                <div className={`text-xs px-2 py-1 rounded ${
                  currentStrategy === 'frontend' ? 'bg-green-500/20 text-green-300' :
                  currentStrategy === 'hybrid' ? 'bg-blue-500/20 text-blue-300' :
                  'bg-orange-500/20 text-orange-300'
                }`}>
                  {currentStrategy === 'frontend' ? 'Ultra Fast' :
                   currentStrategy === 'hybrid' ? 'Intelligent' : 'Fallback'}
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            {performanceStats && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-green-300">Performance Metrics</div>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-gray-400">Avg Response:</span>
                    <div className={`font-semibold ${
                      performanceStats.averageResponseTime < 100 ? 'text-green-400' :
                      performanceStats.averageResponseTime < 500 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {Math.round(performanceStats.averageResponseTime)}ms
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Success Rate:</span>
                    <div className={`font-semibold ${
                      performanceStats.successRate > 95 ? 'text-green-400' :
                      performanceStats.successRate > 80 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {Math.round(performanceStats.successRate)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Total Requests:</span>
                    <div className="font-semibold text-blue-400">
                      {performanceStats.totalRequests}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Cache Hit Rate:</span>
                    <div className={`font-semibold ${
                      performanceStats.cacheHitRate > 80 ? 'text-green-400' :
                      performanceStats.cacheHitRate > 50 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {Math.round(performanceStats.cacheHitRate)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Errors:</span>
                    <div className={`font-semibold ${
                      performanceStats.errorCount === 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {performanceStats.errorCount}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Trend:</span>
                    <div className={`font-semibold capitalize ${
                      performanceStats.performanceTrend === 'improving' ? 'text-green-400' :
                      performanceStats.performanceTrend === 'degrading' ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {performanceStats.performanceTrend}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* System Health */}
            {systemHealth && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-green-300">System Health</div>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-gray-400">Overall:</span>
                    <div className={`font-semibold capitalize ${
                      systemHealth.overallHealth === 'excellent' ? 'text-green-400' :
                      systemHealth.overallHealth === 'good' ? 'text-blue-400' :
                      systemHealth.overallHealth === 'poor' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {systemHealth.overallHealth}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Memory:</span>
                    <div className={`font-semibold ${
                      systemHealth.memoryUsage < 50 ? 'text-green-400' :
                      systemHealth.memoryUsage < 80 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {systemHealth.memoryUsage}%
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Network:</span>
                    <div className={`font-semibold capitalize ${
                      systemHealth.networkConnectivity === 'online' ? 'text-green-400' :
                      systemHealth.networkConnectivity === 'slow' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {systemHealth.networkConnectivity}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Backend:</span>
                    <div className={`font-semibold capitalize ${
                      systemHealth.backendHealth === 'healthy' ? 'text-green-400' :
                      systemHealth.backendHealth === 'degraded' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {systemHealth.backendHealth}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Strategy Comparison */}
            {performanceStats?.strategyCounts && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-green-300">Strategy Usage</div>
                <div className="space-y-1">
                  {Object.entries(performanceStats.strategyCounts).map(([strategy, count]) => (
                    <div key={strategy} className="flex items-center justify-between text-xs font-mono">
                      <span className="text-gray-400 capitalize">{strategy}:</span>
                      <span className="text-blue-400">{String(count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-green-300">Quick Actions</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={async () => {
                    const { switchDemoStrategy } = await import('../../services/HybridDemoBootstrap');
                    await switchDemoStrategy('frontend');
                  }}
                  className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs font-mono hover:bg-green-500/30"
                >
                  Frontend
                </button>
                <button
                  onClick={async () => {
                    const { switchDemoStrategy } = await import('../../services/HybridDemoBootstrap');
                    await switchDemoStrategy('hybrid');
                  }}
                  className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-mono hover:bg-blue-500/30"
                >
                  Hybrid
                </button>
                <button
                  onClick={async () => {
                    const { switchDemoStrategy } = await import('../../services/HybridDemoBootstrap');
                    await switchDemoStrategy('backend');
                  }}
                  className="px-2 py-1 bg-orange-500/20 text-orange-300 rounded text-xs font-mono hover:bg-orange-500/30"
                >
                  Backend
                </button>
                <button
                  onClick={async () => {
                    const { benchmarkDemoStrategies } = await import('../../services/HybridDemoBootstrap');
                    const results = await benchmarkDemoStrategies();
                    console.table(results);
                  }}
                  className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs font-mono hover:bg-purple-500/30"
                >
                  Benchmark
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="text-xs text-gray-500 font-mono border-t border-green-500/30 pt-2">
              Dev Console • Add ?debug=performance to URL
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DemoPerformanceConsole;
