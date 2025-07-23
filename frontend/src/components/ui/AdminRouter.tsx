import React, { Suspense } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import DashboardOverview from './DashboardOverview';
import EnhancedHealthSummary from './EnhancedHealthSummary';
import ConnectionPoolDashboard from './ConnectionPoolDashboard';
import TransactionMonitoring from './TransactionMonitoring';
import SecurityDashboard from './SecurityDashboard';
import SessionSecurityManager from './SessionSecurityManager';
import RateLimitManager from './RateLimitManager';
import SuspiciousActivityMonitor from './SuspiciousActivityMonitor';
import MarketIntelligenceDashboard from './MarketIntelligenceDashboard';
import SseStatsCard from './SseStatsCard';
import ComprehensiveMonitoringDashboard from './ComprehensiveMonitoringDashboard';
import PerformanceMetricsDashboard from './PerformanceMetricsDashboard';
import AdminSessionManager from './AdminSessionManager';
import SessionManagementTools from './SessionManagementTools';
import ModernDataTable from './ModernDataTable';
import RefreshHeader from './RefreshHeader';
import MemoryOptimizationManager from './MemoryOptimizationManager';



// Loading fallback component
const LoadingFallback = ({ title }: { title: string }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
    <CircularProgress size={40} sx={{ mb: 2 }} />
    <Typography variant="h6" color="text.secondary">
      Loading {title}...
    </Typography>
  </Box>
);

interface AdminRouterProps {
  activeSection: string;
  onSectionChange?: (section: string) => void;
  // Props that might be needed by various components
  dashboardData?: {
    loading: boolean;
    metrics: any[];
    alerts: any[];
    quickActions: any[];
  };
  auditLogsData?: {
    auditLogs: any[];
    loading: boolean;
    error: string | null;
    page: number;
    rowsPerPage: number;
    totalCount: number;
    searchTerm: string;
    actionFilter: string;
    categoryFilter: string;
    logType: string;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rowsPerPage: number) => void;
    onSearchChange: (search: string) => void;
    onActionFilterChange: (filter: string) => void;
    onCategoryFilterChange: (filter: string) => void;
    onLogTypeChange: (type: string) => void;
    onRefresh: () => void;
  };
  sessionData?: {
    activeShops: any[];
    deletedShops: any[];
    sessionStatistics: any;
    loading: boolean;
    error: string | null;
    onRefresh: () => void;
    onClearStuckSession?: (sessionId: string) => Promise<void>;
    onClearStuckSessionsForShop?: (shopDomain: string) => Promise<void>;
    onGetStuckSessions?: (shopDomain?: string) => Promise<any>;
    onEmergencySessionCleanup?: () => Promise<void>;
    onCheckSessionSyncStatus?: (sessionId: string) => Promise<void>;
    onRefreshSessionSyncStatus?: () => Promise<void>;
  };
  emergencyData?: {
    status: any;
    connectionLeakStatus: any;
    loading: boolean;
    error: string | null;
    onRefresh: () => void;
    onEmergencyCleanup: () => void;
  };
}

const AdminRouter = React.memo<AdminRouterProps>(({
  activeSection,
  onSectionChange,
  dashboardData,
  auditLogsData,
  sessionData,
  emergencyData,
}) => {
  // Helper functions for audit logs
  const getActionBgColor = (action: string) => {
    const actionColors: Record<string, string> = {
      'shop_deleted': '#ffebee',
      'shop_created': '#e8f5e8',
      'session_started': '#e3f2fd',
      'session_ended': '#fff3e0',
      'login_attempt': '#f3e5f5',
      'logout': '#fce4ec',
      'data_export': '#e0f2f1',
      'settings_changed': '#fff8e1',
      'emergency_cleanup': '#ffebee',
      'connection_leak_detected': '#ffebee',
      'rate_limit_exceeded': '#fff3e0',
      'security_alert': '#ffebee',
    };
    return actionColors[action] || '#f5f5f5';
  };

  const getActionColor = (action: string) => {
    const actionColors: Record<string, string> = {
      'shop_deleted': '#d32f2f',
      'shop_created': '#2e7d32',
      'session_started': '#1976d2',
      'session_ended': '#ed6c02',
      'login_attempt': '#7b1fa2',
      'logout': '#c2185b',
      'data_export': '#00695c',
      'settings_changed': '#f57c00',
      'emergency_cleanup': '#d32f2f',
      'connection_leak_detected': '#d32f2f',
      'rate_limit_exceeded': '#ed6c02',
      'security_alert': '#d32f2f',
    };
    return actionColors[action] || '#616161';
  };

  const getActionIcon = (action: string) => {
    const actionIcons: Record<string, string> = {
      'shop_deleted': '🗑️',
      'shop_created': '➕',
      'session_started': '🔗',
      'session_ended': '🔌',
      'login_attempt': '🔐',
      'logout': '🚪',
      'data_export': '📊',
      'settings_changed': '⚙️',
      'emergency_cleanup': '🚨',
      'connection_leak_detected': '💧',
      'rate_limit_exceeded': '⏱️',
      'security_alert': '🛡️',
    };
    return actionIcons[action] || '📝';
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
              Dashboard Overview
            </Typography>
            <DashboardOverview 
              loading={dashboardData?.loading || false}
              metrics={dashboardData?.metrics || []}
              alerts={dashboardData?.alerts || []}
              quickActions={dashboardData?.quickActions || []}
              onSectionChange={onSectionChange}
            />
          </Box>
        );

      case 'health-summary':
        return (
          <Suspense fallback={<LoadingFallback title="System Health" />}>
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                System Health Summary
              </Typography>
              <EnhancedHealthSummary />
            </Box>
          </Suspense>
        );

      case 'connection-pool':
        return (
          <Suspense fallback={<LoadingFallback title="Connection Pool Dashboard" />}>
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                Connection Pool Dashboard
              </Typography>
              <ConnectionPoolDashboard />
            </Box>
          </Suspense>
        );

      case 'emergency-status':
        return (
          <Suspense fallback={<LoadingFallback title="Emergency Status" />}>
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                Emergency Status
              </Typography>
              {emergencyData ? (
                <Box>
                  <Box sx={{ mb: 3 }}>
                                         <RefreshHeader
                       lastUpdated={emergencyData.status?.lastUpdated || 'Never'}
                       onRefresh={emergencyData.onRefresh}
                       loading={emergencyData.loading}
                       label="Refresh Emergency Status"
                       tooltip="Refresh emergency status"
                       cooldown={false}
                       cooldownRemaining={0}
                     />
                  </Box>
                  {emergencyData.error && (
                    <Typography color="error" sx={{ mb: 2 }}>
                      {emergencyData.error}
                    </Typography>
                  )}
                  {emergencyData.status && (
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Box sx={{ flex: '1 1 300px' }}>
                        <Typography variant="h6" gutterBottom>
                          Emergency Mode: {emergencyData.status.emergencyMode ? 'ACTIVE' : 'Inactive'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Pool Usage: {emergencyData.status.database?.activeUsagePercent ?? 0}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Active Connections: {emergencyData.status.database?.activeConnections ?? 0} / {emergencyData.status.database?.maxPoolSize ?? 20}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  Emergency status data will be displayed here.
                </Typography>
              )}
            </Box>
          </Suspense>
        );

      case 'active-sessions':
        return (
          <Suspense fallback={<LoadingFallback title="Active Sessions" />}>
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                Active Sessions
              </Typography>
              {sessionData ? (
                <Box>
                  <Box sx={{ mb: 3 }}>
                                         <RefreshHeader
                       lastUpdated={sessionData.activeShops?.length ? 'Just now' : 'Never'}
                       onRefresh={sessionData.onRefresh}
                       loading={sessionData.loading}
                       label="Refresh Active Sessions"
                       tooltip="Refresh active sessions"
                       cooldown={false}
                       cooldownRemaining={0}
                     />
                  </Box>
                  {sessionData.error && (
                    <Typography color="error" sx={{ mb: 2 }}>
                      {sessionData.error}
                    </Typography>
                  )}
                  {sessionData.activeShops && sessionData.activeShops.length > 0 ? (
                    <ModernDataTable
                      data={sessionData.activeShops}
                      columns={[
                        {
                          id: 'shopDomain',
                          label: 'Shop Domain',
                          minWidth: 200,
                          sortable: true,
                          filterable: true,
                        },
                        {
                          id: 'lastActivity',
                          label: 'Last Activity',
                          minWidth: 150,
                          sortable: true,
                          render: (value) => new Date(value).toLocaleString(),
                        },
                        {
                          id: 'ipAddress',
                          label: 'IP Address',
                          minWidth: 120,
                          filterable: true,
                        },
                        {
                          id: 'activeSessionCount',
                          label: 'Session Count',
                          minWidth: 100,
                          sortable: true,
                          render: (value) => value || 1,
                        },
                        {
                          id: 'isActive',
                          label: 'Status',
                          minWidth: 100,
                          render: (value) => (
                            <Box
                              sx={{
                                px: 1.5,
                                py: 0.5,
                                borderRadius: 1,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: value ? '#e8f5e8' : '#f5f5f5',
                                color: value ? '#2e7d32' : '#616161',
                              }}
                            >
                              {value ? 'Active' : 'Inactive'}
                            </Box>
                          ),
                        },
                      ]}
                      loading={sessionData.loading}
                      error={sessionData.error}
                      searchable={true}
                      filterable={true}
                      searchPlaceholder="Search active sessions..."
                      emptyMessage="No active sessions found"
                      stickyHeader={true}
                      hoverable={true}
                      dense={true}
                    />
                  ) : (
                    <Typography variant="body1" color="text.secondary">
                      No active sessions found.
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  Active sessions data will be displayed here.
                </Typography>
              )}
            </Box>
          </Suspense>
        );

      case 'deleted-shops':
        return (
          <Suspense fallback={<LoadingFallback title="Deleted Shops" />}>
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                Deleted Shops
              </Typography>
              {sessionData ? (
                <Box>
                  {sessionData.error && (
                    <Typography color="error" sx={{ mb: 2 }}>
                      {sessionData.error}
                    </Typography>
                  )}
                  {sessionData.deletedShops && sessionData.deletedShops.length > 0 ? (
                    <ModernDataTable
                      data={sessionData.deletedShops}
                      columns={[
                        {
                          id: 'shopDomain',
                          label: 'Shop Domain',
                          minWidth: 200,
                          sortable: true,
                          filterable: true,
                        },
                        {
                          id: 'lastActivity',
                          label: 'Last Activity',
                          minWidth: 150,
                          sortable: true,
                          render: (value) => new Date(value).toLocaleString(),
                        },
                        {
                          id: 'ipAddress',
                          label: 'IP Address',
                          minWidth: 120,
                          filterable: true,
                        },
                      ]}
                      loading={sessionData.loading}
                      error={sessionData.error}
                      searchable={true}
                      filterable={true}
                      searchPlaceholder="Search deleted shops..."
                      emptyMessage="No deleted shops found"
                      stickyHeader={true}
                      hoverable={true}
                      dense={true}
                    />
                  ) : (
                    <Typography variant="body1" color="text.secondary">
                      No deleted shops found.
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  Deleted shops data will be displayed here.
                </Typography>
              )}
            </Box>
          </Suspense>
        );

      case 'audit-logs':
        return (
          <Suspense fallback={<LoadingFallback title="Audit Logs" />}>
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                Audit Logs
              </Typography>
              {auditLogsData ? (
                <Box>
                  <Box sx={{ mb: 3 }}>
                                         <RefreshHeader
                       lastUpdated={auditLogsData.auditLogs?.length ? 'Just now' : 'Never'}
                       onRefresh={auditLogsData.onRefresh}
                       loading={auditLogsData.loading}
                       label="Refresh Audit Logs"
                       tooltip="Refresh audit logs"
                       cooldown={false}
                       cooldownRemaining={0}
                     />
                  </Box>
                  {auditLogsData.error && (
                    <Typography color="error" sx={{ mb: 2 }}>
                      {auditLogsData.error}
                    </Typography>
                  )}
                  {auditLogsData.auditLogs && auditLogsData.auditLogs.length > 0 ? (
                    <ModernDataTable
                      data={auditLogsData.auditLogs}
                      columns={[
                        {
                          id: 'timestamp',
                          label: 'Timestamp',
                          minWidth: 150,
                          sortable: true,
                          format: (value) => new Date(value).toLocaleString(),
                        },
                        {
                          id: 'action',
                          label: 'Action',
                          minWidth: 200,
                          sortable: true,
                          filterable: true,
                          render: (value) => (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  px: 1.5,
                                  py: 0.5,
                                  borderRadius: 1,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  backgroundColor: getActionBgColor(value),
                                  color: getActionColor(value),
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                }}
                              >
                                {getActionIcon(value)}
                                {value}
                              </Box>
                            </Box>
                          ),
                        },
                        {
                          id: 'shopDomain',
                          label: 'Shop',
                          minWidth: 200,
                          sortable: true,
                          filterable: true,
                        },
                        {
                          id: 'details',
                          label: 'Details',
                          minWidth: 300,
                          filterable: true,
                          render: (value) => (
                            <Box sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {value}
                            </Box>
                          ),
                        },
                        {
                          id: 'ipAddress',
                          label: 'IP Address',
                          minWidth: 120,
                          filterable: true,
                        },
                      ]}
                      loading={auditLogsData.loading}
                      error={auditLogsData.error}
                      searchable={true}
                      filterable={true}
                      pagination={{
                        page: auditLogsData.page,
                        rowsPerPage: auditLogsData.rowsPerPage,
                        totalCount: auditLogsData.totalCount,
                        onPageChange: auditLogsData.onPageChange,
                        onRowsPerPageChange: auditLogsData.onRowsPerPageChange,
                      }}
                      searchPlaceholder="Search audit logs..."
                      emptyMessage="No audit logs found"
                      stickyHeader={true}
                      hoverable={true}
                      dense={true}
                    />
                  ) : (
                    <Typography variant="body1" color="text.secondary">
                      Audit logs data will be displayed here.
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  Audit logs data will be displayed here.
                </Typography>
              )}
            </Box>
          </Suspense>
        );

      case 'security-dashboard':
        return (
          <Suspense fallback={<LoadingFallback title="Security Dashboard" />}>
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                Security Dashboard
              </Typography>
              <SecurityDashboard />
              <Box sx={{ mt: 3 }}>
                <SessionSecurityManager />
              </Box>
              <Box sx={{ mt: 3 }}>
                <SuspiciousActivityMonitor />
              </Box>
            </Box>
          </Suspense>
        );

      case 'rate-limiting':
        return (
          <Suspense fallback={<LoadingFallback title="Rate Limiting Management" />}>
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                Rate Limiting Management
              </Typography>
              <RateLimitManager />
            </Box>
          </Suspense>
        );

      case 'transaction-monitoring':
        return (
          <Suspense fallback={<LoadingFallback title="Transaction Monitoring" />}>
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                Transaction Monitoring
              </Typography>
              <TransactionMonitoring />
            </Box>
          </Suspense>
        );

      case 'performance-metrics':
        return (
          <Suspense fallback={<LoadingFallback title="Performance Metrics" />}>
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                Performance Metrics Dashboard
              </Typography>
              <PerformanceMetricsDashboard />
            </Box>
          </Suspense>
        );

      case 'sse-statistics':
        return (
          <Suspense fallback={<LoadingFallback title="SSE Statistics" />}>
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                SSE Statistics
              </Typography>
              <SseStatsCard />
            </Box>
          </Suspense>
        );

      case 'comprehensive-monitoring':
        return (
          <Suspense fallback={<LoadingFallback title="Comprehensive Monitoring Dashboard" />}>
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                Comprehensive Monitoring Dashboard
              </Typography>
              <ComprehensiveMonitoringDashboard />
            </Box>
          </Suspense>
        );

      case 'market-intelligence':
        return (
          <Suspense fallback={<LoadingFallback title="Market Intelligence Dashboard" />}>
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                Market Intelligence Dashboard
              </Typography>
              <MarketIntelligenceDashboard />
            </Box>
          </Suspense>
        );

      case 'memory-optimization':
        return (
          <Suspense fallback={<LoadingFallback title="Memory Optimization" />}>
            <MemoryOptimizationManager />
          </Suspense>
        );

      case 'session-management':
        return (
          <Suspense fallback={<LoadingFallback title="Session Management" />}>
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                Session Management
              </Typography>
              
              {/* Session Management Tools */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                  Session Management Tools
                </Typography>
                <AdminSessionManager />
                <Box sx={{ mt: 3 }}>
                  <SessionManagementTools
                    onClearStuckSession={sessionData?.onClearStuckSession || (async (sessionId: string) => {
                      console.log('Clear stuck session:', sessionId);
                    })}
                    onClearStuckSessionsForShop={sessionData?.onClearStuckSessionsForShop || (async (shopDomain: string) => {
                      console.log('Clear stuck sessions for shop:', shopDomain);
                    })}
                    onGetStuckSessions={sessionData?.onGetStuckSessions || (async (shopDomain?: string) => {
                      console.log('Get stuck sessions:', shopDomain);
                    })}
                    onEmergencySessionCleanup={sessionData?.onEmergencySessionCleanup || (async () => {
                      console.log('Emergency session cleanup');
                    })}
                    onCheckSessionSyncStatus={sessionData?.onCheckSessionSyncStatus || (async (sessionId: string) => {
                      console.log('Check session sync status:', sessionId);
                    })}
                    onRefreshSessionSyncStatus={sessionData?.onRefreshSessionSyncStatus || (async () => {
                      console.log('Refresh session sync status');
                    })}
                  />
                </Box>
              </Box>

              {/* Active Sessions Table */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                  Active Sessions
                </Typography>
                {sessionData ? (
                  <Box>
                    <Box sx={{ mb: 3 }}>
                      <RefreshHeader
                        lastUpdated={sessionData.activeShops?.length ? 'Just now' : 'Never'}
                        onRefresh={sessionData.onRefresh}
                        loading={sessionData.loading}
                        label="Refresh Active Sessions"
                        tooltip="Refresh active sessions"
                        cooldown={false}
                        cooldownRemaining={0}
                      />
                    </Box>
                    {sessionData.error && (
                      <Typography color="error" sx={{ mb: 2 }}>
                        {sessionData.error}
                      </Typography>
                    )}
                    {sessionData.activeShops && sessionData.activeShops.length > 0 ? (
                      <ModernDataTable
                        data={sessionData.activeShops}
                        columns={[
                          {
                            id: 'shopDomain',
                            label: 'Shop Domain',
                            minWidth: 200,
                            sortable: true,
                            filterable: true,
                          },
                          {
                            id: 'lastActivity',
                            label: 'Last Activity',
                            minWidth: 150,
                            sortable: true,
                            render: (value) => new Date(value).toLocaleString(),
                          },
                          {
                            id: 'ipAddress',
                            label: 'IP Address',
                            minWidth: 120,
                            filterable: true,
                          },
                          {
                            id: 'activeSessionCount',
                            label: 'Session Count',
                            minWidth: 100,
                            sortable: true,
                            render: (value) => value || 1,
                          },
                          {
                            id: 'isActive',
                            label: 'Status',
                            minWidth: 100,
                            render: (value) => (
                              <Box
                                sx={{
                                  px: 1.5,
                                  py: 0.5,
                                  borderRadius: 1,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  backgroundColor: value ? '#e8f5e8' : '#f5f5f5',
                                  color: value ? '#2e7d32' : '#616161',
                                }}
                              >
                                {value ? 'Active' : 'Inactive'}
                              </Box>
                            ),
                          },
                        ]}
                        loading={sessionData.loading}
                        error={sessionData.error}
                        searchable={true}
                        filterable={true}
                        searchPlaceholder="Search active sessions..."
                        emptyMessage="No active sessions found"
                        stickyHeader={true}
                        hoverable={true}
                        dense={true}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No active sessions found.
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Active sessions data will be displayed here.
                  </Typography>
                )}
              </Box>

              {/* Deleted Shops Table */}
              <Box>
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                  Deleted Shops
                </Typography>
                {sessionData ? (
                  <Box>
                    {sessionData.error && (
                      <Typography color="error" sx={{ mb: 2 }}>
                        {sessionData.error}
                      </Typography>
                    )}
                    {sessionData.deletedShops && sessionData.deletedShops.length > 0 ? (
                      <ModernDataTable
                        data={sessionData.deletedShops}
                        columns={[
                          {
                            id: 'shopDomain',
                            label: 'Shop Domain',
                            minWidth: 200,
                            sortable: true,
                            filterable: true,
                          },
                          {
                            id: 'lastActivity',
                            label: 'Last Activity',
                            minWidth: 150,
                            sortable: true,
                            render: (value) => new Date(value).toLocaleString(),
                          },
                          {
                            id: 'ipAddress',
                            label: 'IP Address',
                            minWidth: 120,
                            filterable: true,
                          },
                        ]}
                        loading={sessionData.loading}
                        error={sessionData.error}
                        searchable={true}
                        filterable={true}
                        searchPlaceholder="Search deleted shops..."
                        emptyMessage="No deleted shops found"
                        stickyHeader={true}
                        hoverable={true}
                        dense={true}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No deleted shops found.
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Deleted shops data will be displayed here.
                  </Typography>
                )}
              </Box>
            </Box>
          </Suspense>
        );

      case 'debug-panel':
        return (
          <Box sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
            <Typography variant="h5" gutterBottom>
              Debug Panel
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Debug panel is available globally through the main application interface.
              Use the debug panel toggle in the main navigation to access debugging features.
            </Typography>
          </Box>
        );

      case 'system-configuration':
        return (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
              System Configuration
            </Typography>
            <Box sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
              <Typography variant="h6" gutterBottom>
                Environment Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                System configuration options will be displayed here.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 300px', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    API Configuration
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Configure API endpoints and authentication settings.
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 300px', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Database Configuration
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Configure database connection settings and pool parameters.
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 300px', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Security Settings
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Configure security policies and access controls.
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        );

      default:
        return (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h5" color="text.secondary" gutterBottom>
              Section Not Found
            </Typography>
            <Typography variant="body1" color="text.secondary">
              The requested admin section "{activeSection}" could not be found.
            </Typography>
          </Box>
        );
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {renderContent()}
    </Box>
  );
});

export default AdminRouter;