import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  Snackbar,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Container,
  Fade,
  Zoom,
  Grow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  AdminPanelSettings as AdminIcon,
  Lock as LockIcon,
  Security as SecurityIcon,
  HealthAndSafety as HealthIcon,
  People as PeopleIcon,
  Speed as SpeedIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';

import { adminLogin, adminLogout, getAdminStatus } from '../api/admin';
import { styled } from '@mui/material/styles';
import { useNotifications } from '../hooks/useNotifications';
import { fetchWithAdminAuth } from '../api';
import AdminLayout from '../components/ui/AdminLayout';
import AdminRouter from '../components/ui/AdminRouter';
import { getSessionStatus } from '../utils/sessionUtils';

// Styled components for modern UI
const AdminContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  backgroundImage: 'linear-gradient(135deg, #f1f5fb 0%, #ffffff 60%)',
  paddingTop: theme.spacing(6),
  paddingBottom: theme.spacing(6),
  [theme.breakpoints.down('sm')]: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
}));

const LoginCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  borderRadius: 20,
  backdropFilter: 'blur(12px)',
  background: 'rgba(255, 255, 255, 0.9)',
  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
  border: `1px solid ${theme.palette.divider}`,
  maxWidth: 400,
  width: '100%',
}));

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  
  // Login form state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState<Date | null>(null);
  
  // Admin interface state
  const [currentSection, setCurrentSection] = useState('dashboard');
  const [refreshing, setRefreshing] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState([{ label: 'Dashboard' }]);

  // Data state
  const [dashboardData, setDashboardData] = useState({
    loading: false,
    metrics: [] as any[],
    alerts: [] as any[],
    quickActions: [] as any[]
  });
  const [auditLogsData, setAuditLogsData] = useState({
    auditLogs: [] as any[],
    loading: false,
    error: null as string | null,
    page: 0,
    rowsPerPage: 10,
    totalCount: 0,
    searchTerm: '',
    actionFilter: '',
    categoryFilter: '',
    logType: 'all'
  });
  const [sessionData, setSessionData] = useState({
    activeShops: [],
    deletedShops: [],
    sessionStatistics: null,
    loading: false,
    error: null as string | null
  });
  const [emergencyData, setEmergencyData] = useState({
    status: null,
    connectionLeakStatus: null,
    loading: false,
    error: null as string | null
  });

  // Refs
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const lockoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Handle lockout timer
  useEffect(() => {
    if (isLocked && lockoutTime) {
      const now = new Date();
      const timeRemaining = lockoutTime.getTime() - now.getTime();
      
      if (timeRemaining > 0) {
        lockoutTimeoutRef.current = setTimeout(() => {
          setIsLocked(false);
          setLockoutTime(null);
          setLoginAttempts(0);
        }, timeRemaining);
      } else {
        setIsLocked(false);
        setLockoutTime(null);
        setLoginAttempts(0);
      }
    }

    return () => {
      if (lockoutTimeoutRef.current) {
        clearTimeout(lockoutTimeoutRef.current);
      }
    };
  }, [isLocked, lockoutTime]);

  // Check authentication status
  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      const status = await getAdminStatus();
      setIsAuthenticated(status.authenticated);
      
      if (status.authenticated) {
        addNotification('Admin authentication verified', 'success');
        // Load initial data
        await Promise.all([
          loadDashboardData(),
          loadAuditLogs(),
          loadSessionData(),
          loadEmergencyData()
        ]);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Load dashboard data
  const loadDashboardData = async () => {
    try {
      setDashboardData(prev => ({ ...prev, loading: true }));
      
      // Create quick actions with proper navigation
      const quickActions = [
        {
          id: 'health-summary',
          title: 'Health Summary',
          description: 'View system health status',
          icon: <HealthIcon />,
          action: () => handleSectionChange('health-summary'),
          category: 'System Health',
          color: '#2e7d32'
        },
        {
          id: 'active-sessions',
          title: 'Active Sessions',
          description: 'Manage user sessions',
          icon: <PeopleIcon />,
          action: () => handleSectionChange('active-sessions'),
          category: 'User Management',
          color: '#1976d2'
        },
        {
          id: 'audit-logs',
          title: 'Audit Logs',
          description: 'Review system logs',
          icon: <SecurityIcon />,
          action: () => handleSectionChange('audit-logs'),
          category: 'Security & Audit',
          color: '#ed6c02'
        },
        {
          id: 'emergency-status',
          title: 'Emergency Status',
          description: 'Check emergency mode',
          icon: <WarningIcon />,
          action: () => handleSectionChange('emergency-status'),
          category: 'System Health',
          color: '#d32f2f'
        },
        {
          id: 'rate-limiting',
          title: 'Rate Limiting',
          description: 'Manage rate limits',
          icon: <SpeedIcon />,
          action: () => handleSectionChange('rate-limiting'),
          category: 'Security & Audit',
          color: '#7b1fa2'
        },
        {
          id: 'market-intelligence',
          title: 'Market Intelligence',
          description: 'View market insights',
          icon: <AssessmentIcon />,
          action: () => handleSectionChange('market-intelligence'),
          category: 'Analytics',
          color: '#0288d1'
        }
      ];

      setDashboardData({
        loading: false,
        metrics: [],
        alerts: [],
        quickActions
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setDashboardData(prev => ({ ...prev, loading: false, error: 'Failed to load dashboard data' }));
    }
  };

  // Load audit logs
  const loadAuditLogs = async () => {
    try {
      setAuditLogsData(prev => ({ ...prev, loading: true }));
      
      // Fix: Use the correct endpoints available in the backend
      let endpoint = `/api/admin/audit-logs/all?page=${auditLogsData.page}&size=${auditLogsData.rowsPerPage}`;
      
      if (auditLogsData.logType === 'deleted') {
        endpoint = `/api/admin/audit-logs/deleted-shops?page=${auditLogsData.page}&size=${auditLogsData.rowsPerPage}`;
      } else if (auditLogsData.logType === 'active') {
        endpoint = `/api/admin/audit-logs/active-shops?page=${auditLogsData.page}&size=${auditLogsData.rowsPerPage}`;
      }
      
      const response = await fetchWithAdminAuth(endpoint);
      const data = await response.json();

      if (data.audit_logs) {
        // Map backend fields to frontend expected fields
        const mappedLogs = data.audit_logs.map((log: any) => ({
          ...log,
          timestamp: log.createdAt || log.timestamp,
          shopDomain: log.shopDomain || 'System'
        }));
        setAuditLogsData(prev => ({
          ...prev,
          loading: false,
          auditLogs: mappedLogs,
          totalCount: data.total_count || mappedLogs.length
        }));
      } else if (Array.isArray(data)) {
        const mappedLogs = data.map((log: any) => ({
          ...log,
          timestamp: log.createdAt || log.timestamp,
          shopDomain: log.shopDomain || 'System'
        }));
        setAuditLogsData(prev => ({
          ...prev,
          loading: false,
          auditLogs: mappedLogs,
          totalCount: mappedLogs.length
        }));
      } else {
        setAuditLogsData(prev => ({
          ...prev,
          loading: false,
          auditLogs: [],
          totalCount: 0
        }));
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      setAuditLogsData(prev => ({ ...prev, loading: false, error: 'Failed to load audit logs' }));
    }
  };

  // Load session data
  const loadSessionData = async () => {
    try {
      setSessionData(prev => ({ ...prev, loading: true }));
      
      const [activeResponse, deletedResponse, statsResponse] = await Promise.all([
        fetchWithAdminAuth('/api/admin/active-shops'),
        fetchWithAdminAuth('/api/admin/deleted-shops'),
        fetchWithAdminAuth('/api/admin/session-statistics')
      ]);

      const activeShops = await activeResponse.json();
      const deletedShops = await deletedResponse.json();
      const sessionStatistics = await statsResponse.json();

      setSessionData({
        loading: false,
        activeShops: activeShops.active_shops || activeShops.shops || [],
        deletedShops: deletedShops.deleted_shops || deletedShops.shops || [],
        sessionStatistics: sessionStatistics.statistics || null,
        error: null
      });
    } catch (error) {
      console.error('Failed to load session data:', error);
      setSessionData(prev => ({ ...prev, loading: false, error: 'Failed to load session data' }));
    }
  };

  // Load emergency data
  const loadEmergencyData = async () => {
    try {
      setEmergencyData(prev => ({ ...prev, loading: true }));
      
      const response = await fetchWithAdminAuth('/api/admin/emergency/status');
      const data = await response.json();

      // Transform the backend response to match frontend expectations
      const transformedStatus = {
        ...data,
        emergencyMode: data.emergencyMode || false,
        poolUsage: data.database?.usagePercentage || data.database?.activeUsagePercent || 0,
        database: {
          status: data.database?.status || 'unknown',
          activeConnections: data.database?.activeConnections || 0,
          maxPoolSize: data.database?.maxPoolSize || 10,
          usagePercentage: data.database?.usagePercentage || data.database?.activeUsagePercent || 0
        },
        redis: {
          status: data.redis?.status || 'unknown',
          memory: data.redis?.memory || 'N/A'
        },
        jvmMemory: data.jvmMemory || {
          used: 'N/A',
          total: 'N/A',
          percentage: 0
        }
      };

      setEmergencyData({
        loading: false,
        status: transformedStatus,
        connectionLeakStatus: data.connectionLeakStatus || null,
        error: null
      });
    } catch (error) {
      console.error('Failed to load emergency data:', error);
      setEmergencyData(prev => ({ ...prev, loading: false, error: 'Failed to load emergency data' }));
    }
  };

  // Handle admin login
  const handleAdminLogin = async () => {
    if (isLocked) {
      const remainingTime = lockoutTime ? Math.ceil((lockoutTime.getTime() - new Date().getTime()) / 1000) : 0;
      addNotification(`Account is locked. Please wait ${remainingTime} seconds.`, 'error');
      return;
    }

    if (!username.trim()) {
      setLoginError('Username is required');
      return;
    }

    if (!password.trim()) {
      setLoginError('Password is required');
      return;
    }

    try {
      setLoginError(null);
      setIsLoading(true);
      
      const response = await adminLogin(username, password);
      
      if (response.success) {
        setIsAuthenticated(true);
        setLoginAttempts(0);
        setPassword('');
        addNotification('Admin login successful', 'success');
        
        // Load initial data
        await Promise.all([
          loadDashboardData(),
          loadAuditLogs(),
          loadSessionData(),
          loadEmergencyData()
        ]);
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
        
      if (newAttempts >= 5) {
          setIsLocked(true);
        const lockoutEnd = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        setLockoutTime(lockoutEnd);
        addNotification('Account locked for 15 minutes due to multiple failed attempts', 'error');
      } else {
        setLoginError(error.message || 'Login failed. Please try again.');
        addNotification(`Login failed. ${5 - newAttempts} attempts remaining.`, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle admin logout
  const handleAdminLogout = async () => {
    try {
      setLogoutError(null);
      const response = await adminLogout();
      
      if (response.success) {
        setIsAuthenticated(false);
        setPassword('');
        setLoginAttempts(0);
        setIsLocked(false);
        setLockoutTime(null);
        addNotification('Admin logout successful', 'success');
        navigate('/');
      } else {
        throw new Error(response.message || 'Logout failed');
      }
    } catch (error: any) {
      console.error('Logout error:', error);
      setLogoutError(error.message || 'Logout failed');
      addNotification('Logout failed', 'error');
    }
  };
      
  // Handle section change
  const handleSectionChange = (section: string) => {
    setCurrentSection(section);
      
    // Update breadcrumbs based on section
    const sectionBreadcrumbs: Record<string, { label: string }[]> = {
      'dashboard': [{ label: 'Dashboard' }],
      'health-summary': [{ label: 'System Health' }, { label: 'Health Summary' }],
      'connection-pool': [{ label: 'System Health' }, { label: 'Connection Pool' }],
      'emergency-status': [{ label: 'System Health' }, { label: 'Emergency Status' }],
      'active-sessions': [{ label: 'User Management' }, { label: 'Active Sessions' }],
      'session-statistics': [{ label: 'User Management' }, { label: 'Session Statistics' }],
      'deleted-shops': [{ label: 'User Management' }, { label: 'Deleted Shops' }],
      'session-management': [{ label: 'User Management' }, { label: 'Session Management' }],
      'security-dashboard': [{ label: 'Security & Audit' }, { label: 'Security Dashboard' }],
      'rate-limiting': [{ label: 'Security & Audit' }, { label: 'Rate Limiting' }],
      'audit-logs': [{ label: 'Security & Audit' }, { label: 'Audit Logs' }],
      'comprehensive-monitoring': [{ label: 'Monitoring' }, { label: 'Comprehensive Monitoring' }],
      'transaction-monitoring': [{ label: 'Monitoring' }, { label: 'Transaction Monitoring' }],
      'sse-statistics': [{ label: 'Monitoring' }, { label: 'SSE Statistics' }],
      'market-intelligence': [{ label: 'Market Intelligence' }],
      'system-configuration': [{ label: 'Settings' }, { label: 'System Configuration' }],
    };
    
    setBreadcrumbs(sectionBreadcrumbs[section] || [{ label: 'Dashboard' }]);
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadDashboardData(),
        loadAuditLogs(),
        loadSessionData(),
        loadEmergencyData()
      ]);
      addNotification('Data refreshed successfully', 'success');
    } catch (error) {
      addNotification('Failed to refresh data', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // Session management functions from main branch
  const handleGetStuckSessions = async (shopDomain?: string) => {
    try {
      const endpoint = shopDomain 
        ? `/api/admin/sessions/stuck-sessions/${shopDomain}`
        : '/api/admin/sessions/stuck-sessions';
      
      const response = await fetchWithAdminAuth(endpoint);
      const data = await response.json();
      
      addNotification(`Found ${data.stuckSessions?.length || 0} stuck sessions`, 'info');
      return data;
    } catch (error) {
      addNotification('Error getting stuck sessions', 'error');
      throw error;
    }
  };

  const handleClearStuckSessionsForShop = async (shopDomain: string) => {
    if (!shopDomain.trim()) return;
    
    try {
      const response = await fetchWithAdminAuth(`/api/admin/sessions/clear-stuck-sessions/${shopDomain}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        addNotification(`Cleared ${result.clearedCount || 0} stuck sessions for ${shopDomain}`, 'success');
        await loadSessionData(); // Refresh session data
      } else {
        throw new Error('Failed to clear stuck sessions');
      }
    } catch (error) {
      addNotification('Error clearing stuck sessions', 'error');
      throw error;
    }
  };

  const handleClearStuckSession = async (sessionId: string) => {
    // Extract shop domain from session ID or use a default
    const shopDomain = (sessionData.activeShops as any[]).find((shop: any) => 
      shop.sessionId === sessionId
    )?.shopDomain || 'unknown';
    
    return handleClearStuckSessionsForShop(shopDomain);
  };

  const handleCheckSessionSyncStatus = async (sessionId: string) => {
    addNotification('Session sync status endpoint not implemented yet', 'warning');
    throw new Error('Session sync status endpoint not implemented yet');
  };

  const handleEmergencySessionCleanup = async () => {
    try {
      const response = await fetchWithAdminAuth('/api/admin/sessions/emergency-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        addNotification('Emergency session cleanup completed', 'success');
        await loadSessionData(); // Refresh session data
        return result;
      } else {
        throw new Error('Emergency session cleanup failed');
    }
    } catch (error) {
      addNotification('Error performing emergency session cleanup', 'error');
      throw error;
    }
  };

  const handleRefreshSessionSyncStatus = async () => {
    console.log('Session sync status refresh requested from SessionManagementTools');
    addNotification('Session sync status refreshed', 'info');
  };

  // Handle keyboard events
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !isLocked) {
      handleAdminLogin();
    }
  };

  // Show loading screen
  if (isLoading) {
    return (
      <AdminContainer>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '60vh' 
        }}>
          <CircularProgress size={60} sx={{ mb: 3 }} />
          <Typography variant="h5" color="text.secondary" gutterBottom>
            Loading Admin Panel...
          </Typography>
          <LinearProgress sx={{ width: '100%', maxWidth: 400, mt: 2 }} />
        </Box>
      </AdminContainer>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <AdminContainer>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '80vh' 
        }}>
          <Fade in timeout={800}>
            <LoginCard elevation={8}>
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <AdminIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Admin Panel
          </Typography>
                <Typography variant="body1" color="text.secondary">
                  Enter your admin password to continue
          </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  label="Username"
                  placeholder="Enter admin username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLocked}
                  sx={{ mb: 2 }}
                />
                
                <TextField
                  ref={passwordInputRef}
                  fullWidth
                  type={showPassword ? 'text' : 'password'}
                  label="Admin Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLocked}
                  error={!!loginError}
                  helperText={loginError}
                  InputProps={{
                    endAdornment: (
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        disabled={isLocked}
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                />
              </Box>

              {isLocked && lockoutTime && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                  Account locked until {lockoutTime.toLocaleTimeString()}
              </Alert>
            )}
            
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleAdminLogin}
            disabled={!username || !password || isLocked || isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : <LoginIcon />}
            sx={{
              borderRadius: 2,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
              },
            }}
          >
            {isLoading ? 'Authenticating...' : 'Access Admin Panel'}
          </Button>

              {loginAttempts > 0 && !isLocked && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
                  Failed attempts: {loginAttempts}/5
                </Typography>
              )}
            </LoginCard>
          </Fade>
        </Box>
      </AdminContainer>
    );
  }

  // Show admin interface
  return (
    <AdminLayout
      currentSection={currentSection}
      onSectionChange={handleSectionChange}
      breadcrumbs={breadcrumbs}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      user={{ username: 'Admin', role: 'Administrator' }}
      onLogout={handleAdminLogout}
    >
      <AdminRouter
        activeSection={currentSection}
        dashboardData={dashboardData}
        auditLogsData={{
          ...auditLogsData,
          onPageChange: (page: number) => setAuditLogsData(prev => ({ ...prev, page })),
          onRowsPerPageChange: (rowsPerPage: number) => setAuditLogsData(prev => ({ ...prev, rowsPerPage })),
          onSearchChange: (search: string) => setAuditLogsData(prev => ({ ...prev, searchTerm: search })),
          onActionFilterChange: (filter: string) => setAuditLogsData(prev => ({ ...prev, actionFilter: filter })),
          onCategoryFilterChange: (filter: string) => setAuditLogsData(prev => ({ ...prev, categoryFilter: filter })),
          onLogTypeChange: (type: string) => setAuditLogsData(prev => ({ ...prev, logType: type })),
          onRefresh: loadAuditLogs
        }}
        sessionData={{
          ...sessionData,
          onRefresh: loadSessionData,
          onClearStuckSession: handleClearStuckSession,
          onClearStuckSessionsForShop: handleClearStuckSessionsForShop,
          onGetStuckSessions: handleGetStuckSessions,
          onEmergencySessionCleanup: handleEmergencySessionCleanup,
          onCheckSessionSyncStatus: handleCheckSessionSyncStatus,
          onRefreshSessionSyncStatus: handleRefreshSessionSyncStatus
        }}
        emergencyData={{
          ...emergencyData,
          onRefresh: loadEmergencyData,
          onEmergencyCleanup: async () => {
            try {
              await fetchWithAdminAuth('/api/admin/emergency-cleanup', { method: 'POST' });
              addNotification('Emergency cleanup completed', 'success');
              await loadEmergencyData();
            } catch (error) {
              addNotification('Emergency cleanup failed', 'error');
            }
          }
        }}
      />
    </AdminLayout>
  );
};

export default AdminPage;