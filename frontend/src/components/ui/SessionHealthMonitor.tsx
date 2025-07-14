import React, { useState, useEffect, useCallback } from 'react';
import { useNotifications } from '../../hooks/useNotifications';

interface SessionHealthData {
  sessionId: string;
  shop: string;
  isActive: boolean;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
  expiresInMinutes: number;
  ipAddress: string;
  userAgent: string;
  deviceType: string;
  location: string;
  isExpired: boolean;
  needsRefresh: boolean;
  healthScore: number;
  recommendations: string[];
}

interface SessionHealthMonitorProps {
  shop?: string;
  onRefresh?: () => void;
}

const SessionHealthMonitor: React.FC<SessionHealthMonitorProps> = ({ 
  shop, 
  onRefresh 
}) => {
  const [sessionData, setSessionData] = useState<SessionHealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const { addNotification } = useNotifications();

  // Listen for session events
  useEffect(() => {
    const handleSessionExpiring = (event: CustomEvent) => {
      addNotification(
        event.detail.message,
        'warning',
        {
          persistent: true,
          action: {
            label: 'Refresh Session',
            onClick: () => handleManualRefresh()
          }
        }
      );
    };

    const handleSessionRefreshNeeded = (event: CustomEvent) => {
      addNotification(
        event.detail.message,
        'info',
        {
          persistent: true,
          action: {
            label: 'Refresh Now',
            onClick: () => handleManualRefresh()
          }
        }
      );
    };

    const handleSessionError = (event: CustomEvent) => {
      addNotification(
        event.detail.message,
        'error',
        {
          persistent: true
        }
      );
    };

    const handleSessionInvalidated = (event: CustomEvent) => {
      addNotification(
        event.detail.message,
        'error',
        {
          persistent: true,
          action: {
            label: 'Logout',
            onClick: () => window.location.href = '/logout'
          }
        }
      );
    };

    window.addEventListener('sessionExpiring', handleSessionExpiring as EventListener);
    window.addEventListener('sessionRefreshNeeded', handleSessionRefreshNeeded as EventListener);
    window.addEventListener('sessionError', handleSessionError as EventListener);
    window.addEventListener('sessionInvalidated', handleSessionInvalidated as EventListener);

    return () => {
      window.removeEventListener('sessionExpiring', handleSessionExpiring as EventListener);
      window.removeEventListener('sessionRefreshNeeded', handleSessionRefreshNeeded as EventListener);
      window.removeEventListener('sessionError', handleSessionError as EventListener);
      window.removeEventListener('sessionInvalidated', handleSessionInvalidated as EventListener);
    };
  }, [addNotification]);

  const fetchSessionHealth = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // For admin users, use admin endpoint; for shop users, use shop-specific endpoint
      const endpoint = shop ? '/api/sessions/health-check' : '/api/sessions/admin/health';
      const response = await fetch(endpoint, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        
        // Transform admin data to match expected format
        if (!shop && data.success) {
          // Admin session health data
          const adminData = {
            sessionId: 'admin-system',
            shop: 'System-wide',
            isActive: data.activeSessions > 0,
            createdAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
            expiresInMinutes: 24 * 60,
            ipAddress: 'System',
            userAgent: 'Admin System',
            deviceType: 'System',
            location: 'System',
            isExpired: false,
            needsRefresh: data.healthScore < 80,
            healthScore: data.healthScore || 100,
            recommendations: data.recommendations || []
          };
          setSessionData(adminData);
        } else {
          setSessionData(data);
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch session health');
    } finally {
      setLoading(false);
    }
  }, [shop]);

  const handleManualRefresh = async () => {
    if (refreshCooldown > 0) return;

    setRefreshCooldown(30); // 30 second cooldown
    setLoading(true);

    try {
      // For admin users, use admin endpoint; for shop users, use shop-specific endpoint
      const endpoint = shop ? '/api/sessions/refresh' : '/api/sessions/admin/health';
      const response = await fetch(endpoint, {
        method: 'GET', // Admin refresh is just a health check refresh
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          addNotification(
            'Session health has been successfully refreshed.',
            'success',
            { duration: 5000 }
          );
          await fetchSessionHealth();
          onRefresh?.();
        } else {
          throw new Error(data.error || 'Session refresh failed');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      addNotification(
        err instanceof Error ? err.message : 'Failed to refresh session health',
        'error',
        { duration: 5000 }
      );
    } finally {
      setLoading(false);
    }
  };

  // Cooldown timer
  useEffect(() => {
    if (refreshCooldown > 0) {
      const timer = setTimeout(() => setRefreshCooldown(refreshCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [refreshCooldown]);

  // Auto-refresh session health
  useEffect(() => {
    fetchSessionHealth();
    const interval = setInterval(fetchSessionHealth, 60000); // Every minute
    return () => clearInterval(interval);
  }, [fetchSessionHealth]);

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getHealthIcon = (score: number) => {
    if (score >= 80) return '✅';
    if (score >= 60) return '⚠️';
    return '❌';
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType.toLowerCase()) {
      case 'mobile': return '📱';
      case 'tablet': return '📱';
      case 'desktop': return '💻';
      default: return '💻';
    }
  };

  // For admin users, we don't need a shop to show the component
  // For shop users, we need a shop to proceed
  if (!shop && window.location.pathname.startsWith('/admin')) {
    // Admin user - show component
  } else if (!shop) {
    return null;
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center">
            <span className="mr-2">🔒</span>
            Session Health
          </h3>
          <div className="flex gap-2">
            <button
              onClick={fetchSessionHealth}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
              title="Refresh session health"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => setShowDetails(true)}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              title="View details"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>

        {loading && !sessionData ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800 text-sm">{error}</div>
          </div>
        ) : sessionData ? (
          <div className="space-y-4">
            {/* Health Score */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Session Health</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getHealthIcon(sessionData.healthScore)}</span>
                  <span className={`text-sm font-bold ${getHealthColor(sessionData.healthScore)}`}>
                    {sessionData.healthScore}%
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    sessionData.healthScore >= 80 ? 'bg-green-500' : 
                    sessionData.healthScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${sessionData.healthScore}%` }}
                ></div>
              </div>
            </div>

            {/* Status Indicators */}
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                sessionData.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {sessionData.isActive ? '✅ Active' : '❌ Inactive'}
              </span>
              {sessionData.isExpired && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  ⚠️ Expired
                </span>
              )}
              {sessionData.needsRefresh && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  🔄 Needs Refresh
                </span>
              )}
              {sessionData.expiresInMinutes <= 10 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  ⏰ Expires in {sessionData.expiresInMinutes}m
                </span>
              )}
            </div>

            {/* Session Info */}
            <div className="space-y-2 text-sm">
              <div className="text-gray-600">
                <span className="font-medium">Session ID:</span> {sessionData.sessionId.substring(0, 8)}...
              </div>
              <div className="text-gray-600">
                <span className="font-medium">Created:</span> {formatTime(sessionData.createdAt)}
              </div>
              <div className="text-gray-600">
                <span className="font-medium">Last Active:</span> {formatTime(sessionData.lastAccessedAt)}
              </div>
              <div className="text-gray-600">
                <span className="font-medium">Expires:</span> {formatTime(sessionData.expiresAt)}
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleManualRefresh}
              disabled={loading || refreshCooldown > 0}
              className="w-full inline-flex items-center justify-center px-4 py-3 border border-blue-300 text-sm font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              {refreshCooldown > 0 
                ? `Refresh (${refreshCooldown}s)` 
                : 'Refresh Session'
              }
            </button>

            {/* Recommendations */}
            {sessionData.recommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-800 mb-2">Recommendations:</div>
                <ul className="space-y-1 text-sm text-blue-700">
                  {sessionData.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-2 text-blue-600">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            No session data available
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Session Details</h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {sessionData && (
                <div className="space-y-6">
                  {/* Session Information */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-3">Session Information</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">ID:</span> {sessionData.sessionId}</div>
                      <div><span className="font-medium">Shop:</span> {sessionData.shop}</div>
                      <div><span className="font-medium">Status:</span> {sessionData.isActive ? 'Active' : 'Inactive'}</div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200"></div>

                  {/* Timing */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-3">Timing</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Created:</span> {formatTime(sessionData.createdAt)}</div>
                      <div><span className="font-medium">Last Active:</span> {formatTime(sessionData.lastAccessedAt)}</div>
                      <div><span className="font-medium">Expires:</span> {formatTime(sessionData.expiresAt)}</div>
                      <div><span className="font-medium">Time Remaining:</span> {sessionData.expiresInMinutes} minutes</div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200"></div>

                  {/* Device Information */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-3">Device Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span>{getDeviceIcon(sessionData.deviceType)}</span>
                        <span>{sessionData.deviceType}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>📍</span>
                        <span>{sessionData.location}</span>
                      </div>
                      <div><span className="font-medium">IP:</span> {sessionData.ipAddress}</div>
                      <div className="text-xs text-gray-500 break-all">
                        <span className="font-medium">User Agent:</span> {sessionData.userAgent}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200"></div>

                  {/* Health Metrics */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-3">Health Metrics</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Health Score:</span> {sessionData.healthScore}%</div>
                      <div><span className="font-medium">Expired:</span> {sessionData.isExpired ? 'Yes' : 'No'}</div>
                      <div><span className="font-medium">Needs Refresh:</span> {sessionData.needsRefresh ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowDetails(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={handleManualRefresh}
                  disabled={loading || refreshCooldown > 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  Refresh Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SessionHealthMonitor; 