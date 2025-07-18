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
  Fade,
  Slide,
  Zoom,
  Grow,
} from '@mui/material';
import {
  Lock as LockIcon,
  Security as SecurityIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  AccountCircle as AccountIcon,
  Key as KeyIcon,
} from '@mui/icons-material';
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

// Enhanced constants for admin authentication
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useNotifications();

  // Enhanced authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [username, setUsername] = useState('admin');
  const [authError, setAuthError] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null);

  // Navigation state
  const [activeSection, setActiveSection] = useState('dashboard');

  // Enhanced data state with better error handling
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

  // Enhanced audit logs pagination state
  const [auditPage, setAuditPage] = useState(0);
  const [auditRowsPerPage, setAuditRowsPerPage] = useState(25);
  const [auditTotalCount, setAuditTotalCount] = useState(0);
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('all');
  const [auditLogType, setAuditLogType] = useState<'all' | 'deleted' | 'active' | 'monitoring' | 'connection-leak' | 'pool-dashboard'>('all');

  // Enhanced dashboard state
  const [dashboardMetrics, setDashboardMetrics] = useState<any[]>([]);
  const [dashboardAlerts, setDashboardAlerts] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Enhanced session expiration handler
  const handleSessionExpired = useCallback(() => {
    setIsAuthenticated(false);
    setIsPasswordDialogOpen(true);
    setSessionInfo(null);
    setPassword('');
    setAuthError('');
    setAttemptCount(0);
    setIsLocked(false);
    setLockoutEndTime(null);
    
    // Clear cached data
    sessionStorage.removeItem('admin_session_info');
    sessionStorage.removeItem('admin_auth_status');
    
    showError('Admin session expired. Please log in again.', {
      category: 'Admin Authentication',
      persistent: true,
      action: {
        label: 'Login Again',
        onClick: () => setIsPasswordDialogOpen(true)
      }
    });
  }, [showError]);

  // Enhanced authentication check with lockout handling
  const checkAuthStatus = async () => {
    try {
      const status = await getAdminStatus();
      if (status.authenticated) {
        setIsAuthenticated(true);
        setSessionInfo(status.sessionInfo);
        setIsPasswordDialogOpen(false);
        setAuthError('');
        setAttemptCount(0);
        setIsLocked(false);
        setLockoutEndTime(null);
        
        // Cache session info
        sessionStorage.setItem('admin_session_info', JSON.stringify(status.sessionInfo));
        sessionStorage.setItem('admin_auth_status', 'authenticated');
        
        showSuccess('Admin session restored successfully', {
          category: 'Admin Authentication',
          duration: 3000
        });
      } else {
        setIsAuthenticated(false);
        setIsPasswordDialogOpen(true);
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      setIsAuthenticated(false);
      setIsPasswordDialogOpen(true);
    }
  };

  // Enhanced login handler with better security
  const handleAdminLogin = async () => {
    if (isLocked) {
      const remainingTime = lockoutEndTime ? Math.max(0, lockoutEndTime - Date.now()) : 0;
      if (remainingTime > 0) {
        const minutes = Math.ceil(remainingTime / 60000);
        setAuthError(`Account is locked. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before trying again.`);
        return;
      } else {
        // Lockout expired
        setIsLocked(false);
        setAttemptCount(0);
        setLockoutEndTime(null);
      }
    }

    if (!username.trim() || !password.trim()) {
      setAuthError('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setAuthError('');

    try {
      const result = await adminLogin(username.trim(), password);
      
      if (result.success) {
        setIsAuthenticated(true);
        setSessionInfo(result.sessionInfo);
        setIsPasswordDialogOpen(false);
        setPassword('');
        setAuthError('');
        setAttemptCount(0);
        setIsLocked(false);
        setLockoutEndTime(null);
        
        // Cache session info
        sessionStorage.setItem('admin_session_info', JSON.stringify(result.sessionInfo));
        sessionStorage.setItem('admin_auth_status', 'authenticated');
        
        showSuccess('Admin login successful', {
          category: 'Admin Authentication',
          duration: 3000
        });
        
        // Load initial data
        handleRefresh();
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (error: any) {
      console.error('Admin login failed:', error);
      
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);
      
      if (newAttemptCount >= MAX_ATTEMPTS) {
        setIsLocked(true);
        setLockoutEndTime(Date.now() + LOCKOUT_DURATION);
        setAuthError(`Too many failed attempts. Account locked for 15 minutes.`);
        showWarning('Admin account locked due to multiple failed login attempts', {
          category: 'Admin Security',
          persistent: true
        });
      } else {
        const remainingAttempts = MAX_ATTEMPTS - newAttemptCount;
        setAuthError(`Login failed. ${remainingAttempts} attempt${remainingAttempts > 1 ? 's' : ''} remaining.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced logout handler
  const handleAdminLogout = async () => {
    try {
      await adminLogout();
      showSuccess('Admin logout successful', {
        category: 'Admin Authentication',
        duration: 3000
      });
    } catch (error) {
      console.error('Admin logout failed:', error);
      showError('Logout failed, but session has been cleared locally', {
        category: 'Admin Authentication'
      });
    } finally {
      handleSessionExpired();
    }
  };

  // Enhanced section change handler
  const handleSectionChange = useCallback((section: string) => {
    setActiveSection(section);
    
    // Show section-specific notifications
    const sectionNotifications: Record<string, string> = {
      'dashboard': 'Dashboard loaded',
      'health-summary': 'System health overview',
      'active-sessions': 'Active sessions monitoring',
      'audit-logs': 'Audit logs viewer',
      'security-dashboard': 'Security monitoring',
      'comprehensive-monitoring': 'Comprehensive monitoring'
    };
    
    if (sectionNotifications[section]) {
      showSuccess(sectionNotifications[section], {
        category: 'Navigation',
        duration: 2000
      });
    }
  }, [showSuccess]);

  // Enhanced refresh handler with better error handling
  const handleRefresh = useCallback(async () => {
    try {
      await Promise.all([
        fetchDashboardData(),
        fetchActiveShops(),
        fetchDeletedShops(),
        fetchAuditLogs(),
        fetchSessionStatistics(),
        checkEmergencyStatus()
      ]);
      
      showSuccess('All data refreshed successfully', {
        category: 'Data Refresh',
        duration: 3000
      });
    } catch (error) {
      console.error('Refresh failed:', error);
      showError('Some data failed to refresh. Please try again.', {
        category: 'Data Refresh'
      });
    }
  }, [showSuccess, showError]);

  // Enhanced data fetching functions with better error handling
  const fetchDashboardData = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const data = await fetchAdminEndpoint('/admin/dashboard');
      setDashboardMetrics(data.metrics || []);
      setDashboardAlerts(data.alerts || []);
    } catch (error) {
      console.error('Dashboard data fetch failed:', error);
      setDashboardMetrics([]);
      setDashboardAlerts([]);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const fetchActiveShops = useCallback(async () => {
    setActiveShopsLoading(true);
    setActiveShopsError(null);
    try {
      const data = await fetchAdminEndpoint('/admin/active-shops');
      setActiveShops(data.shops || []);
    } catch (error: any) {
      console.error('Active shops fetch failed:', error);
      setActiveShopsError(error.message || 'Failed to load active shops');
      setActiveShops([]);
    } finally {
      setActiveShopsLoading(false);
    }
  }, []);

  const fetchDeletedShops = useCallback(async () => {
    setDeletedShopsLoading(true);
    setDeletedShopsError(null);
    try {
      const data = await fetchAdminEndpoint('/admin/deleted-shops');
      setDeletedShops(data.shops || []);
    } catch (error: any) {
      console.error('Deleted shops fetch failed:', error);
      setDeletedShopsError(error.message || 'Failed to load deleted shops');
      setDeletedShops([]);
    } finally {
      setDeletedShopsLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setAuditLogsLoading(true);
    setAuditLogsError(null);
    try {
      const params = new URLSearchParams({
        page: auditPage.toString(),
        size: auditRowsPerPage.toString(),
        search: auditSearchTerm,
        actionFilter: auditActionFilter,
        categoryFilter: auditCategoryFilter,
        logType: auditLogType
      });
      
      const data = await fetchAdminEndpoint(`/admin/audit-logs?${params}`);
      setAuditLogs(data.logs || []);
      setAuditTotalCount(data.totalCount || 0);
    } catch (error: any) {
      console.error('Audit logs fetch failed:', error);
      setAuditLogsError(error.message || 'Failed to load audit logs');
      setAuditLogs([]);
    } finally {
      setAuditLogsLoading(false);
    }
  }, [auditPage, auditRowsPerPage, auditSearchTerm, auditActionFilter, auditCategoryFilter, auditLogType]);

  const fetchSessionStatistics = useCallback(async () => {
    setSessionStatisticsLoading(true);
    setSessionStatisticsError(null);
    try {
      const data = await fetchAdminEndpoint('/admin/session-statistics');
      setSessionStatistics(data);
    } catch (error: any) {
      console.error('Session statistics fetch failed:', error);
      setSessionStatisticsError(error.message || 'Failed to load session statistics');
      setSessionStatistics(null);
    } finally {
      setSessionStatisticsLoading(false);
    }
  }, []);

  const checkEmergencyStatus = useCallback(async () => {
    setEmergencyLoading(true);
    setEmergencyError(null);
    try {
      const [statusData, leakData] = await Promise.all([
        fetchAdminEndpoint('/admin/emergency-status'),
        fetchAdminEndpoint('/admin/connection-leak-status')
      ]);
      setEmergencyStatus(statusData);
      setConnectionLeakStatus(leakData);
    } catch (error: any) {
      console.error('Emergency status check failed:', error);
      setEmergencyError(error.message || 'Failed to check emergency status');
      setEmergencyStatus(null);
      setConnectionLeakStatus(null);
    } finally {
      setEmergencyLoading(false);
    }
  }, []);

  // Enhanced admin endpoint helper
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

  // Enhanced effects
  useEffect(() => {
    checkAuthStatus();
  }, []);

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
      }, SESSION_CHECK_INTERVAL);
      
      return () => clearInterval(authCheckInterval);
    }
  }, [isAuthenticated, handleSessionExpired]);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsPasswordDialogOpen(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      Promise.all([
        fetchDashboardData(),
        fetchActiveShops(),
        fetchDeletedShops(),
        fetchAuditLogs(),
        fetchSessionStatistics(),
        checkEmergencyStatus()
      ]);
    }
  }, [activeSection, fetchDashboardData, fetchActiveShops, fetchDeletedShops, fetchAuditLogs, fetchSessionStatistics, checkEmergencyStatus]);

  // Enhanced memoized data objects for AdminRouter
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

  // Enhanced login dialog with modern design
  if (!isAuthenticated) {
    return (
      <Dialog 
        open={isPasswordDialogOpen} 
        onClose={() => {}} 
        disableEscapeKeyDown
        maxWidth="sm"
        fullWidth
        TransitionComponent={Zoom}
        transitionDuration={300}
      >
        <DialogTitle sx={{ 
          textAlign: 'center', 
          pb: 1,
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          color: 'white',
          borderRadius: '12px 12px 0 0'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
            <SecurityIcon sx={{ fontSize: 32, mr: 1 }} />
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Admin Authentication
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Enter your credentials to access the admin panel
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          <Box sx={{ pt: 1 }}>
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
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: <AccountIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
            <TextField
              margin="dense"
              label="Password"
              type={showPassword ? 'text' : 'password'}
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
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: <KeyIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                endAdornment: (
                  <Button
                    onClick={() => setShowPassword(!showPassword)}
                    sx={{ minWidth: 'auto', p: 0.5 }}
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </Button>
                )
              }}
            />
            
            {authError && (
              <Fade in={!!authError}>
                <Alert severity="error" sx={{ mb: 2 }}>
                  {authError}
                </Alert>
              </Fade>
            )}
            
            {isLocked && (
              <Fade in={isLocked}>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Account locked due to too many failed attempts. Please wait 15 minutes.
                </Alert>
              </Fade>
            )}
            
            {attemptCount > 0 && attemptCount < MAX_ATTEMPTS && !isLocked && (
              <Fade in={attemptCount > 0}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  {MAX_ATTEMPTS - attemptCount} attempts remaining before account lockout.
                </Alert>
              </Fade>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={handleAdminLogin}
            variant="contained"
            disabled={isLoading || isLocked || !username || !password}
            startIcon={isLoading ? <CircularProgress size={20} /> : <LockIcon />}
            fullWidth
            size="large"
            sx={{
              background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
              }
            }}
          >
            {isLoading ? 'Authenticating...' : 'Login'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Enhanced main admin interface with modern layout
  return (
    <Grow in={isAuthenticated} timeout={500}>
      <div>
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
      </div>
    </Grow>
  );
};

export default AdminPage;