import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Box,
} from '@mui/material';
import { adminLogin, adminLogout, getAdminStatus } from '../api/admin';
import { useNotifications } from '../hooks/useNotifications';
import AdminLayout from '../components/ui/AdminLayout';
import AdminRouter from '../components/ui/AdminRouter';
import '../styles/admin-design-system.css';

interface AuditLog {
  id: number;
  shopDomain: string;
  action: string;
  details: string;
  timestamp: string;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
}

interface ActiveShop {
  shopDomain: string;
  lastActivity: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  isActive: boolean;
  action?: string;
  details?: string;
  category?: string;
  activeSessionCount?: number;
  sessionCreatedAt?: string;
  source?: string;
  databaseSessionId?: string;
}

interface DeletedShop {
  shopDomain: string;
  lastActivity: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  isActive: boolean;
  action?: string;
  details?: string;
  category?: string;
}

// Constants for admin authentication
const MAX_ATTEMPTS = 5;

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [username, setUsername] = useState('admin');
  const [authError, setAuthError] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);

  // Navigation state
  const [activeSection, setActiveSection] = useState('dashboard');

  // Data state
  const [activeShops, setActiveShops] = useState<ActiveShop[]>([]);
  const [activeShopsLoading, setActiveShopsLoading] = useState(false);
  const [activeShopsError, setActiveShopsError] = useState<string | null>(null);

  const [deletedShops, setDeletedShops] = useState<DeletedShop[]>([]);
  const [deletedShopsLoading, setDeletedShopsLoading] = useState(false);
  const [deletedShopsError, setDeletedShopsError] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditLogsError, setAuditLogsError] = useState<string | null>(null);

  const [sessionStatistics, setSessionStatistics] = useState<any>(null);
  const [sessionStatisticsLoading, setSessionStatisticsLoading] = useState(false);
  const [sessionStatisticsError, setSessionStatisticsError] = useState<string | null>(null);

  const [emergencyStatus, setEmergencyStatus] = useState<any>(null);
  const [connectionLeakStatus, setConnectionLeakStatus] = useState<any>(null);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyError, setEmergencyError] = useState<string | null>(null);

  // Audit logs pagination state
  const [auditPage, setAuditPage] = useState(0);
  const [auditRowsPerPage, setAuditRowsPerPage] = useState(25);
  const [auditTotalCount, setAuditTotalCount] = useState(0);
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('all');
  const [auditLogType, setAuditLogType] = useState<'all' | 'deleted' | 'active' | 'monitoring' | 'connection-leak' | 'pool-dashboard'>('all');

  // Dashboard state
  const [dashboardMetrics, setDashboardMetrics] = useState<any[]>([]);
  const [dashboardAlerts, setDashboardAlerts] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Helper function to handle session expiration
  const handleSessionExpired = useCallback(() => {
    setIsAuthenticated(false);
    setIsPasswordDialogOpen(true);
    setSessionInfo(null);
    setPassword('');
    setAuthError('');
    setAttemptCount(0);
    setIsLocked(false);
    
    // Clear cached data
    sessionStorage.removeItem('admin_session_info');
    sessionStorage.removeItem('admin_auth_status');
    
    showError('Admin session expired. Please log in again.', {
      category: 'Admin Authentication',
      persistent: true
    });
  }, [showError]);

  // Check authentication status on component mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Periodic authentication check when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const authCheckInterval = setInterval(async () => {
        try {
          const status = await getAdminStatus();
          if (!status.authenticated) {
            console.log('Admin session expired, logging out');
            handleSessionExpired();
          }
        } catch (error) {
          console.error('Periodic auth check failed:', error);
          // Don't logout on network errors, only on auth failures
        }
      }, 5 * 60 * 1000); // Check every 5 minutes
      
      return () => clearInterval(authCheckInterval);
    }
  }, [isAuthenticated, handleSessionExpired]);

  // Ensure password dialog is always open when not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setIsPasswordDialogOpen(true);
    }
  }, [isAuthenticated]);

  // Helper function for admin endpoints
  const fetchAdminEndpoint = useCallback(async (endpoint: string) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
      const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
      
      const response = await fetch(fullUrl, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Admin authentication required');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Admin endpoint error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Admin endpoint error (${endpoint}):`, error);
      throw error;
    }
  }, []);

  // Authentication functions
  const checkAuthStatus = async () => {
    try {
      const status = await getAdminStatus();
      if (status.authenticated) {
        setIsAuthenticated(true);
        setIsPasswordDialogOpen(false);
        setSessionInfo(status);
        setAuthError('');
        setAttemptCount(0);
        setIsLocked(false);
      } else {
        setIsAuthenticated(false);
        setIsPasswordDialogOpen(true);
        setSessionInfo(null);
        setPassword('');
        setAuthError('');
        setAttemptCount(0);
        setIsLocked(false);
        
        // Clear any cached admin data
        sessionStorage.removeItem('admin_session_info');
        sessionStorage.removeItem('admin_auth_status');
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      setIsAuthenticated(false);
      setIsPasswordDialogOpen(true);
      setSessionInfo(null);
      setPassword('');
      setAuthError('');
      setAttemptCount(0);
      setIsLocked(false);
      
      // Clear cached data
      sessionStorage.removeItem('admin_session_info');
      sessionStorage.removeItem('admin_auth_status');
    }
  };

  const handleAdminLogin = async () => {
    if (isLoading || isLocked) return;
    
    setIsLoading(true);
    setAuthError('');
    
    try {
      const result = await adminLogin(username, password);
      
      if (result.success) {
        setIsAuthenticated(true);
        setIsPasswordDialogOpen(false);
        setSessionInfo(result);
        setAttemptCount(0);
        setPassword('');
        
        showSuccess(`Welcome ${result.username}! Admin access granted.`, {
          category: 'Admin Authentication',
          duration: 4000
        });
        
        // Fetch initial data
        await Promise.all([
          fetchDashboardData(),
          fetchAuditLogs(),
          fetchActiveShops(),
          fetchSessionStatistics(),
          checkEmergencyStatus()
        ]);
        
      } else {
        setAuthError(result.error || 'Login failed');
        setAttemptCount(prev => prev + 1);
        
        if (result.locked) {
          setIsLocked(true);
          showError('Account locked due to too many failed attempts', {
            category: 'Admin Authentication',
            persistent: true
          });
          
          // Auto-unlock after lockout period (15 minutes)
          setTimeout(() => {
            setIsLocked(false);
            setAttemptCount(0);
          }, 15 * 60 * 1000);
        }
      }
    } catch (error) {
      console.error('Admin login error:', error);
      setAuthError('Authentication service unavailable. Please try again.');
      showError('Unable to connect to authentication service', {
        category: 'Admin Authentication',
        persistent: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      const logoutResult = await adminLogout();
      
      if (logoutResult.success) {
        showSuccess('Admin session ended securely', {
          category: 'Admin Authentication',
          duration: 3000
        });
      } else {
        console.warn('Backend logout failed, but proceeding with frontend cleanup:', logoutResult.error);
        showError('Backend logout failed, but session has been cleared locally', {
          category: 'Admin Authentication',
          duration: 4000
        });
      }
      
      // Clear all admin-related state regardless of backend response
      setIsAuthenticated(false);
      setIsPasswordDialogOpen(true);
      setSessionInfo(null);
      setPassword('');
      setAuthError('');
      setAttemptCount(0);
      setIsLocked(false);
      
      // Clear any cached admin data
      sessionStorage.removeItem('admin_session_info');
      sessionStorage.removeItem('admin_auth_status');
      
      // Force clear admin token cookie on frontend as well
      document.cookie = 'admin_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; HttpOnly; Secure; SameSite=Strict';
      
      // Navigate away from admin page
      navigate('/');
      
      // Force page reload to ensure complete cleanup
      setTimeout(() => { 
        window.location.href = '/'; 
      }, 100);
      
    } catch (error) {
      console.error('Logout error:', error);
      
      // Even if API call fails, force logout and cleanup
      setIsAuthenticated(false);
      setIsPasswordDialogOpen(true);
      setSessionInfo(null);
      setPassword('');
      setAuthError('');
      setAttemptCount(0);
      setIsLocked(false);
      
      // Clear cached data
      sessionStorage.removeItem('admin_session_info');
      sessionStorage.removeItem('admin_auth_status');
      
      // Force clear admin token cookie
      document.cookie = 'admin_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; HttpOnly; Secure; SameSite=Strict';
      
      showError('Logout completed locally (backend unavailable)', {
        category: 'Admin Authentication',
        duration: 4000
      });
      navigate('/');
      setTimeout(() => { 
        window.location.href = '/'; 
      }, 100);
    }
  };

  // Data fetching functions
  const fetchDashboardData = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setDashboardLoading(true);
      
      // Fetch dashboard metrics and alerts
      const healthData = await fetchAdminEndpoint('/api/admin/health-summary');
      const sessionData = await fetchAdminEndpoint('/api/admin/session-statistics');
      
      // Transform data into dashboard format
      const metrics = [
        {
          title: 'System Health',
          value: healthData?.status || 'Unknown',
          status: healthData?.status === 'healthy' ? 'healthy' : 'warning',
          description: 'Overall system status'
        },
        {
          title: 'Active Sessions',
          value: sessionData?.statistics?.activeSessions || 0,
          status: 'healthy',
          description: 'Currently active user sessions'
        },
        {
          title: 'Connection Pool',
          value: healthData?.connectionPool?.usage || 'N/A',
          status: healthData?.connectionPool?.status || 'unknown',
          description: 'Database connection pool status'
        }
      ];
      
      setDashboardMetrics(metrics);
      setDashboardAlerts(healthData?.alerts || []);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setDashboardLoading(false);
    }
  }, [isAuthenticated, fetchAdminEndpoint]);

  const fetchActiveShops = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setActiveShopsLoading(true);
      setActiveShopsError(null);
      
      const data = await fetchAdminEndpoint('/api/admin/active-shops');
      
      if (data.active_shops) {
        setActiveShops(data.active_shops);
      } else if (Array.isArray(data)) {
        setActiveShops(data);
      } else {
        setActiveShops([]);
      }
    } catch (err) {
      console.error('Error fetching active shops:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setActiveShopsError(`Failed to fetch active shops: ${errorMessage}`);
      setActiveShops([]);
    } finally {
      setActiveShopsLoading(false);
    }
  }, [isAuthenticated, fetchAdminEndpoint]);

  const fetchDeletedShops = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setDeletedShopsLoading(true);
      setDeletedShopsError(null);
      
      const data = await fetchAdminEndpoint('/api/admin/deleted-shops');
      
      if (data.deleted_shops) {
        setDeletedShops(data.deleted_shops);
      } else if (Array.isArray(data)) {
        setDeletedShops(data);
      } else {
        setDeletedShops([]);
      }
    } catch (err) {
      console.error('Error fetching deleted shops:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setDeletedShopsError(`Failed to fetch deleted shops: ${errorMessage}`);
      setDeletedShops([]);
    } finally {
      setDeletedShopsLoading(false);
    }
  }, [isAuthenticated, fetchAdminEndpoint]);

  const fetchSessionStatistics = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setSessionStatisticsLoading(true);
      setSessionStatisticsError(null);
      
      const data = await fetchAdminEndpoint('/api/admin/session-statistics');
      
      if (data.statistics) {
        setSessionStatistics(data.statistics);
      } else {
        setSessionStatistics(null);
      }
    } catch (err) {
      console.error('Error fetching session statistics:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setSessionStatisticsError(`Failed to fetch session statistics: ${errorMessage}`);
      setSessionStatistics(null);
    } finally {
      setSessionStatisticsLoading(false);
    }
  }, [isAuthenticated, fetchAdminEndpoint]);

  const fetchAuditLogs = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setAuditLogsLoading(true);
      setAuditLogsError(null);
      
      let endpoint = `/api/admin/audit-logs/all?page=${auditPage}&size=${auditRowsPerPage}`;
      
      if (auditLogType === 'deleted') {
        endpoint = `/api/admin/audit-logs/deleted-shops?page=${auditPage}&size=${auditRowsPerPage}`;
      } else if (auditLogType === 'active') {
        endpoint = `/api/admin/audit-logs/active-shops?page=${auditPage}&size=${auditRowsPerPage}`;
      }
      
      const data = await fetchAdminEndpoint(endpoint);
      
      if (data.audit_logs) {
        const mappedLogs = data.audit_logs.map((log: any) => ({
          ...log,
          timestamp: log.createdAt || log.timestamp,
          shopDomain: log.shopDomain || 'System'
        }));
        setAuditLogs(mappedLogs);
        setAuditTotalCount(data.total_count || mappedLogs.length);
      } else if (Array.isArray(data)) {
        const mappedLogs = data.map((log: any) => ({
          ...log,
          timestamp: log.createdAt || log.timestamp,
          shopDomain: log.shopDomain || 'System'
        }));
        setAuditLogs(mappedLogs);
        setAuditTotalCount(mappedLogs.length);
      } else {
        setAuditLogs([]);
        setAuditTotalCount(0);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setAuditLogsError(`Failed to fetch audit logs: ${errorMessage}`);
      setAuditLogs([]);
      setAuditTotalCount(0);
    } finally {
      setAuditLogsLoading(false);
    }
  }, [isAuthenticated, fetchAdminEndpoint, auditPage, auditRowsPerPage, auditLogType]);

  const checkEmergencyStatus = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setEmergencyLoading(true);
      setEmergencyError(null);
      
      const [statusData, leakData] = await Promise.all([
        fetchAdminEndpoint('/api/admin/emergency/status'),
        fetchAdminEndpoint('/api/admin/emergency/connection-leak-status')
      ]);
      
      setEmergencyStatus(statusData);
      setConnectionLeakStatus(leakData);
      
    } catch (err) {
      console.error('Error fetching emergency status:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setEmergencyError(`Failed to fetch emergency status: ${errorMessage}`);
    } finally {
      setEmergencyLoading(false);
    }
  }, [isAuthenticated, fetchAdminEndpoint]);

  // Event handlers
  const handleSectionChange = useCallback((section: string) => {
    setActiveSection(section);
    
    // Fetch data for the new section if needed
    switch (section) {
      case 'active-sessions':
        if (activeShops.length === 0) {
          fetchActiveShops();
        }
        break;
      case 'deleted-shops':
        if (deletedShops.length === 0) {
          fetchDeletedShops();
        }
        break;
      case 'audit-logs':
        if (auditLogs.length === 0) {
          fetchAuditLogs();
        }
        break;
      case 'session-statistics':
        if (!sessionStatistics) {
          fetchSessionStatistics();
        }
        break;
      case 'emergency-status':
        checkEmergencyStatus();
        break;
    }
  }, [activeShops.length, deletedShops.length, auditLogs.length, sessionStatistics, fetchActiveShops, fetchDeletedShops, fetchAuditLogs, fetchSessionStatistics, checkEmergencyStatus]);

  const handleRefresh = useCallback(async () => {
    switch (activeSection) {
      case 'dashboard':
        await fetchDashboardData();
        break;
      case 'active-sessions':
        await fetchActiveShops();
        break;
      case 'deleted-shops':
        await fetchDeletedShops();
        break;
      case 'audit-logs':
        await fetchAuditLogs();
        break;
      case 'session-statistics':
        await fetchSessionStatistics();
        break;
      case 'emergency-status':
        await checkEmergencyStatus();
        break;
      default:
        // Refresh all data
        await Promise.all([
          fetchDashboardData(),
          fetchActiveShops(),
          fetchAuditLogs(),
          fetchSessionStatistics(),
          checkEmergencyStatus()
        ]);
    }
  }, [activeSection, fetchDashboardData, fetchActiveShops, fetchDeletedShops, fetchAuditLogs, fetchSessionStatistics, checkEmergencyStatus]);

  // Memoized data objects for AdminRouter
  const dashboardData = useMemo(() => ({
    loading: dashboardLoading,
    metrics: dashboardMetrics,
    alerts: dashboardAlerts,
    quickActions: [
      { label: 'Refresh All Data', action: () => handleRefresh() },
      { label: 'View System Health', action: () => setActiveSection('health-summary') },
      { label: 'Check Active Sessions', action: () => setActiveSection('active-sessions') },
    ]
  }), [dashboardLoading, dashboardMetrics, dashboardAlerts, handleRefresh]);

  const auditLogsData = useMemo(() => ({
    auditLogs,
    loading: auditLogsLoading,
    error: auditLogsError,
    page: auditPage,
    rowsPerPage: auditRowsPerPage,
    totalCount: auditTotalCount,
    searchTerm: auditSearchTerm,
    actionFilter: auditActionFilter,
    categoryFilter: auditCategoryFilter,
    logType: auditLogType,
    onPageChange: setAuditPage,
    onRowsPerPageChange: setAuditRowsPerPage,
    onSearchChange: setAuditSearchTerm,
    onActionFilterChange: setAuditActionFilter,
    onCategoryFilterChange: setAuditCategoryFilter,
    onLogTypeChange: (type: string) => setAuditLogType(type as 'all' | 'deleted' | 'active' | 'monitoring' | 'connection-leak' | 'pool-dashboard'),
    onRefresh: fetchAuditLogs,
  }), [auditLogs, auditLogsLoading, auditLogsError, auditPage, auditRowsPerPage, auditTotalCount, auditSearchTerm, auditActionFilter, auditCategoryFilter, auditLogType, fetchAuditLogs]);

  const sessionData = useMemo(() => ({
    activeShops,
    deletedShops,
    sessionStatistics,
    loading: activeShopsLoading || deletedShopsLoading || sessionStatisticsLoading,
    error: activeShopsError || deletedShopsError || sessionStatisticsError,
    onRefresh: () => {
      fetchActiveShops();
      fetchDeletedShops();
      fetchSessionStatistics();
    },
  }), [activeShops, deletedShops, sessionStatistics, activeShopsLoading, deletedShopsLoading, sessionStatisticsLoading, activeShopsError, deletedShopsError, sessionStatisticsError, fetchActiveShops, fetchDeletedShops, fetchSessionStatistics]);

  const emergencyData = useMemo(() => ({
    status: emergencyStatus,
    connectionLeakStatus,
    loading: emergencyLoading,
    error: emergencyError,
    onRefresh: checkEmergencyStatus,
    onEmergencyCleanup: () => {
      // Implement emergency cleanup if needed
      console.log('Emergency cleanup requested');
    },
  }), [emergencyStatus, connectionLeakStatus, emergencyLoading, emergencyError, checkEmergencyStatus]);

  const breadcrumbs = useMemo(() => {
    const sectionTitles: Record<string, string> = {
      'dashboard': 'Dashboard',
      'health-summary': 'System Health',
      'connection-pool': 'Connection Pool',
      'emergency-status': 'Emergency Status',
      'active-sessions': 'Active Sessions',
      'session-statistics': 'Session Statistics',
      'deleted-shops': 'Deleted Shops',
      'audit-logs': 'Audit Logs',
      'security-dashboard': 'Security Dashboard',
      'rate-limiting': 'Rate Limiting',
      'transaction-monitoring': 'Transaction Monitoring',
      'sse-statistics': 'SSE Statistics',
      'comprehensive-monitoring': 'Monitoring',
      'market-intelligence': 'Market Intelligence',
      'debug-panel': 'Debug Panel',
      'system-configuration': 'System Configuration',
    };

    return [
      { label: 'Admin', icon: null },
      { label: sectionTitles[activeSection] || activeSection, icon: null }
    ];
  }, [activeSection]);

  // Show login dialog if not authenticated
  if (!isAuthenticated) {
    return (
      <Dialog 
        open={isPasswordDialogOpen} 
        onClose={() => {}} 
        disableEscapeKeyDown
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Admin Authentication
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Please enter your admin credentials to access the admin panel.
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              autoFocus
              margin="dense"
              label="Username"
              type="text"
              fullWidth
              variant="outlined"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading || isLocked}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="Password"
              type="password"
              fullWidth
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isLoading && !isLocked) {
                  handleAdminLogin();
                }
              }}
              disabled={isLoading || isLocked}
              sx={{ mb: 2 }}
            />
            
            {authError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {authError}
              </Alert>
            )}
            
            {isLocked && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Account locked due to too many failed attempts. Please wait 15 minutes.
              </Alert>
            )}
            
            {attemptCount > 0 && attemptCount < MAX_ATTEMPTS && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {MAX_ATTEMPTS - attemptCount} attempts remaining before account lockout.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={handleAdminLogin}
            variant="contained"
            disabled={isLoading || isLocked || !username || !password}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
            fullWidth
            size="large"
          >
            {isLoading ? 'Authenticating...' : 'Login'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Main admin interface with new layout
  return (
    <AdminLayout
      currentSection={activeSection}
      onSectionChange={handleSectionChange}
      breadcrumbs={breadcrumbs}
      onRefresh={handleRefresh}
      refreshing={dashboardLoading || auditLogsLoading || activeShopsLoading || sessionStatisticsLoading || emergencyLoading}
      user={{
        username: sessionInfo?.username || 'admin',
        role: 'Administrator',
        lastLogin: sessionInfo?.lastLogin ? new Date(sessionInfo.lastLogin) : undefined,
      }}
      onLogout={handleAdminLogout}
    >
      <AdminRouter
        activeSection={activeSection}
        dashboardData={dashboardData}
        auditLogsData={auditLogsData}
        sessionData={sessionData}
        emergencyData={emergencyData}
      />
    </AdminLayout>
  );
};

export default AdminPage;