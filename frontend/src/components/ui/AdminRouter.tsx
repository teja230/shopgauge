import React, { Suspense, lazy, memo, useMemo, useCallback } from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Store as StoreIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { ModernDataTable } from './ModernDataTable';
import SkeletonLoaders from './SkeletonLoaders';

// Lazy load admin components for better performance
const DashboardOverview = lazy(() => import('./DashboardOverview'));
const EnhancedHealthSummary = lazy(() => import('./EnhancedHealthSummary'));
const ComprehensiveMonitoringDashboard = lazy(() => import('./ComprehensiveMonitoringDashboard'));
const ConnectionPoolDashboard = lazy(() => import('./ConnectionPoolDashboard'));
const TransactionMonitoring = lazy(() => import('./TransactionMonitoring'));
const SecurityDashboard = lazy(() => import('./SecurityDashboard'));
const MarketIntelligenceDashboard = lazy(() => import('./MarketIntelligenceDashboard'));
const AdminSessionManager = lazy(() => import('./AdminSessionManager'));
const SessionManagementTools = lazy(() => import('./SessionManagementTools'));
const DebugPanel = lazy(() => import('./DebugPanel'));
const SseStatsCard = lazy(() => import('./SseStatsCard'));
const SessionSecurityManager = lazy(() => import('./SessionSecurityManager'));
const RateLimitManager = lazy(() => import('./RateLimitManager'));
const SuspiciousActivityMonitor = lazy(() => import('./SuspiciousActivityMonitor'));

interface AdminRouterProps {
  activeSection: string;
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

const AdminRouter: React.FC<AdminRouterProps> = memo(({
  activeSection,
  dashboardData,
  auditLogsData,
  sessionData,
  emergencyData,
}) => {
  // Memoize action categories to prevent recreation on every render
  const actionCategories = useMemo(() => ({
    'DATA_ACCESS': { label: 'Data Access', color: '#1976d2', bgColor: '#e3f2fd', icon: <VisibilityIcon /> },
    'DATA_DELETION': { label: 'Data Deletion', color: '#d32f2f', bgColor: '#ffebee', icon: <DeleteIcon /> },
    'AUTHENTICATION': { label: 'Authentication', color: '#ed6c02', bgColor: '#fff3e0', icon: <SecurityIcon /> },
    'COMPLIANCE': { label: 'Compliance', color: '#2e7d32', bgColor: '#e8f5e8', icon: <CheckCircleIcon /> },
    'SHOP_OPERATIONS': { label: 'Shop Operations', color: '#0288d1', bgColor: '#e1f5fe', icon: <StoreIcon /> },
    'SYSTEM': { label: 'System', color: '#5e35b1', bgColor: '#f3e5f5', icon: <SettingsIcon /> },
  }), []);

  // Memoize action category functions to prevent recreation
  const getActionCategory = useCallback((action: string) => {
    if (action.includes('DATA_ACCESS') || action.includes('REVENUE_DATA') || action.includes('ORDER_DATA')) {
      return 'DATA_ACCESS';
    } else if (action.includes('DELETE') || action.includes('DELETION')) {
      return 'DATA_DELETION';  
    } else if (action.includes('AUTH') || action.includes('LOGIN') || action.includes('LOGOUT')) {
      return 'AUTHENTICATION';
    } else if (action.includes('COMPLIANCE') || action.includes('PRIVACY')) {
      return 'COMPLIANCE';
    } else if (action.includes('SHOP') || action.includes('TOKEN')) {
      return 'SHOP_OPERATIONS';
    } else {
      return 'SYSTEM';
    }
  }, []);

  const getActionColor = useCallback((action: string) => {
    const category = getActionCategory(action);
    return actionCategories[category as keyof typeof actionCategories]?.color || '#616161';
  }, [actionCategories, getActionCategory]);

  const getActionBgColor = useCallback((action: string) => {
    const category = getActionCategory(action);
    return actionCategories[category as keyof typeof actionCategories]?.bgColor || '#f5f5f5';
  }, [actionCategories, getActionCategory]);

  const getActionIcon = useCallback((action: string) => {
    const category = getActionCategory(action);
    return actionCategories[category as keyof typeof actionCategories]?.icon || <InfoIcon />;
  }, [actionCategories, getActionCategory]);

  // Memoize loading fallback component for lazy-loaded sections
  const LoadingFallback = memo(({ title }: { title?: string }) => (
    <Box>
      {title && (
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          {title}
        </Typography>
      )}
      <SkeletonLoaders.AdminSection />
    </Box>
  ));

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <DashboardOverview
              loading={dashboardData?.loading || false}
              metrics={dashboardData?.metrics || []}
              alerts={dashboardData?.alerts || []}
              quickActions={dashboardData?.quickActions || []}
            />
          </Suspense>
        );

      case 'health-summary':
        return (
          <Suspense fallback={<LoadingFallback title="System Health Summary" />}>
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
          <Box>
            <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
              Emergency Status
            </Typography>
            {emergencyData?.status && (
              <Alert 
                severity={emergencyData.status.status === 'healthy' ? 'success' : 'warning'}
                sx={{ mb: 2 }}
              >
                System Status: {emergencyData.status.status}
              </Alert>
            )}
            {emergencyData?.connectionLeakStatus && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Connection Leak Status
                </Typography>
                <Alert 
                  severity={emergencyData.connectionLeakStatus.status === 'healthy' ? 'success' : 'error'}
                  sx={{ mb: 2 }}
                >
                  {emergencyData.connectionLeakStatus.message || 'Connection monitoring active'}
                </Alert>
              </Box>
            )}
          </Box>
        );

      case 'active-sessions':
        return (
          <Box>
            <Typography variant="h5" gutterBottom>
              Active Sessions
            </Typography>
            {sessionData ? (
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
                    minWidth: 180,
                    sortable: true,
                    format: (value) => new Date(value).toLocaleString(),
                  },
                  {
                    id: 'sessionId',
                    label: 'Session ID',
                    minWidth: 150,
                    render: (value) => value ? value.substring(0, 8) + '...' : 'N/A',
                  },
                  {
                    id: 'ipAddress',
                    label: 'IP Address',
                    minWidth: 120,
                    filterable: true,
                  },
                  {
                    id: 'userAgent',
                    label: 'User Agent',
                    minWidth: 200,
                    render: (value) => value ? value.substring(0, 50) + '...' : 'N/A',
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
                maxHeight={600}
              />
            ) : (
              <Typography variant="body1" color="text.secondary">
                Active sessions data will be displayed here.
              </Typography>
            )}
          </Box>
        );

      case 'session-statistics':
        return (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
              Session Statistics
            </Typography>
            {sessionData?.loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box>
                {sessionData?.sessionStatistics && (
                  <Box sx={{ mt: 3 }}>
                    <Suspense fallback={<SkeletonLoaders.AdminSection />}>
                      <AdminSessionManager />
                    </Suspense>
                  </Box>
                )}
                <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                  Session management tools will be integrated here.
                </Typography>
              </Box>
            )}
          </Box>
        );

      case 'deleted-shops':
        return (
          <Box>
            <Typography variant="h5" gutterBottom>
              Deleted Shops
            </Typography>
            {sessionData ? (
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
                    minWidth: 180,
                    sortable: true,
                    format: (value) => new Date(value).toLocaleString(),
                  },
                  {
                    id: 'action',
                    label: 'Action',
                    minWidth: 150,
                    sortable: true,
                    filterable: true,
                  },
                  {
                    id: 'details',
                    label: 'Details',
                    minWidth: 300,
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
                striped={true}
                maxHeight={600}
              />
            ) : (
              <Typography variant="body1" color="text.secondary">
                Deleted shops data will be displayed here.
              </Typography>
            )}
          </Box>
        );

      case 'audit-logs':
        return (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
              Audit Logs
            </Typography>
            {auditLogsData ? (
              <ModernDataTable
                data={auditLogsData.auditLogs}
                columns={[
                  {
                    id: 'timestamp',
                    label: 'Time',
                    minWidth: 180,
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

      case 'debug-panel':
        return (
          <Suspense fallback={<LoadingFallback title="Debug Panel" />}>
            <DebugPanel 
              isVisible={true}
              onToggleVisibility={() => {}}
            />
          </Suspense>
        );

      case 'system-configuration':
        return (
          <Box>
            <Typography variant="h5" gutterBottom>
              System Configuration
            </Typography>
            {/* Add system configuration components here */}
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