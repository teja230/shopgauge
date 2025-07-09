import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Alert,
  Snackbar,
  Tooltip,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  CardHeader,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tabs,
  Tab,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Container,
  Stack,
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Edit as EditIcon, 
  Info as InfoIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Store as StoreIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
  Visibility as VisibilityIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  Assessment as AssessmentIcon,
  Dashboard as DashboardIcon,
  AdminPanelSettings as AdminIcon,
  Computer as ComputerIcon,
  PhoneAndroid as PhoneIcon,
  Tablet as TabletIcon,
  DesktopMac as DesktopIcon,
  AccessTime as AccessTimeIcon,
  Language as LanguageIcon,
  Public as PublicIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Storefront as StorefrontIcon,
  MonitorHeart as MonitorHeartIcon,
} from '@mui/icons-material';
import { fetchWithAuth } from '../api';
import { adminLogin, adminLogout, getAdminStatus } from '../api/admin';
import { useAuth } from '../context/AuthContext';
import { styled } from '@mui/material/styles';
import { useNotifications } from '../hooks/useNotifications';
import EnhancedHealthSummary from '../components/ui/EnhancedHealthSummary';
import { getSessionStatus } from '../utils/sessionUtils';
import DiffViewerDialog from '../components/ui/DiffViewerDialog';
import TransactionMonitoring from '../components/ui/TransactionMonitoring';
import ConnectionPoolDashboard from '../components/ui/ConnectionPoolDashboard';

interface Secret {
  key: string;
  value: string;
}

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

interface AuditLogsResponse {
  audit_logs: AuditLog[];
  page: number;
  size: number;
  total_count: number;
  note?: string;
}

const INTEGRATION_CONFIG = {
  'shopify.api.key': { label: 'Shopify API Key', help: 'Used for Shopify integration', icon: '🛍️' },
  'shopify.api.secret': { label: 'Shopify API Secret', help: 'Used for Shopify integration', icon: '🔐' },
  'serpapi.api.key': { label: 'SerpAPI Key', help: 'Used for competitor discovery', icon: '🔍' },
  'sendgrid.api.key': { label: 'SendGrid API Key', help: 'Used for sending email notifications', icon: '📧' },
  'twilio.account.sid': { label: 'Twilio Account SID', help: 'Used for sending SMS notifications', icon: '📱' },
  'twilio.auth.token': { label: 'Twilio Auth Token', help: 'Used for sending SMS notifications', icon: '🔑' },
};

// Styled components matching the rest of the website
const AdminContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
}));

const HeaderCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  borderRadius: 12,
  backgroundColor: theme.palette.background.paper,
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  border: `1px solid ${theme.palette.divider}`,
}));

const AdminHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  [theme.breakpoints.down('md')]: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
  },
}));

const SectionCard = styled(Paper)(({ theme }) => ({
  borderRadius: 12,
  overflow: 'hidden',
  backgroundColor: theme.palette.background.paper,
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  border: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.3s ease',
  '&:hover': {
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.1)',
  },
}));

const SectionHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const TabsContainer = styled(Box)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  '& .MuiTabs-root': {
    minHeight: 56,
  },
  '& .MuiTab-root': {
    textTransform: 'none',
    fontWeight: 600,
    fontSize: '0.95rem',
    minHeight: 56,
    '&.Mui-selected': {
      color: theme.palette.primary.main,
    },
  },
}));

const FilterContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
}));

const StyledTable = styled(Table)(({ theme }) => ({
  '& .MuiTableHead-root': {
    backgroundColor: theme.palette.grey[50],
  },
  '& .MuiTableCell-head': {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
  },
  '& .MuiTableRow-root:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const DeviceIcon = ({ userAgent }: { userAgent: string }) => {
  const deviceType = getDeviceType(userAgent);
  
  switch (deviceType) {
    case 'iPhone':
    return <PhoneIcon fontSize="small" sx={{ color: 'primary.main' }} />;
    case 'iPad':
    return <TabletIcon fontSize="small" sx={{ color: 'secondary.main' }} />;
    case 'Android Phone':
      return <PhoneIcon fontSize="small" sx={{ color: 'success.main' }} />;
    case 'Android Tablet':
      return <TabletIcon fontSize="small" sx={{ color: 'success.main' }} />;
    case 'Mobile':
      return <PhoneIcon fontSize="small" sx={{ color: 'primary.main' }} />;
    case 'Tablet':
      return <TabletIcon fontSize="small" sx={{ color: 'secondary.main' }} />;
    case 'Desktop': {
      const ua = userAgent?.toLowerCase() || '';
      if (ua.includes('mac')) {
    return <DesktopIcon fontSize="small" sx={{ color: 'warning.main' }} />;
  } else {
    return <ComputerIcon fontSize="small" sx={{ color: 'info.main' }} />;
      }
    }
    default:
      return <ComputerIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
  }
};

const getBrowserInfo = (userAgent: string) => {
  if (!userAgent) return 'Unknown';
  
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
  if (ua.includes('edge')) return 'Edge';
  if (ua.includes('opera')) return 'Opera';
  
  return 'Other';
};

const getDeviceType = (userAgent: string) => {
  if (!userAgent) return 'Unknown';
  
  const ua = userAgent.toLowerCase();
  
  // Enhanced iPad detection - iPads often don't include 'mobile' in user agent
  if (ua.includes('ipad') || 
      (ua.includes('macintosh') && ua.includes('safari') && typeof document !== 'undefined' && 'ontouchend' in document)) {
    return 'iPad';
  }
  
  // iPhone detection
  if (ua.includes('iphone')) {
    return 'iPhone';
  }
  
  // Android tablet detection
  if (ua.includes('android') && !ua.includes('mobile')) {
    return 'Android Tablet';
  }
  
  // Android phone detection
  if (ua.includes('android') && ua.includes('mobile')) {
    return 'Android Phone';
  }
  
  // Generic mobile detection
  if (ua.includes('mobile') || ua.includes('phone')) {
    return 'Mobile';
  }
  
  // Generic tablet detection
  if (ua.includes('tablet')) {
    return 'Tablet';
  }
  
  // Desktop detection
  return 'Desktop';
};

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
  // Enhanced multi-session fields
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

// Utility function to extract shop domain from audit log details
const extractShopDomainFromDetails = (details: string): string | null => {
  try {
    // Look for patterns like "shop: domain.myshopify.com" or similar
    const shopMatch = details.match(/shop[:\s]+([a-zA-Z0-9.-]+\.myshopify\.com)/i);
    if (shopMatch) {
      return shopMatch[1];
    }
    
    // Look for domain patterns in the details
    const domainMatch = details.match(/([a-zA-Z0-9.-]+\.myshopify\.com)/i);
    if (domainMatch) {
      return domainMatch[1];
    }
    
    return null;
  } catch {
    return null;
  }
};

// Constants for admin authentication
const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(true);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [passwordError, setPasswordError] = useState('');
  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);
  const [lockoutEnd, setLockoutEnd] = useState<number | null>(null);
  
  const { showSuccess, showError } = useNotifications();

  // Helper functions for admin endpoints
  const fetchAdminEndpoint = async (endpoint: string) => {
    try {
      const response = await fetchWithAuth(endpoint);
      return await response.json();
    } catch (error) {
      console.error(`Admin endpoint error (${endpoint}):`, error);
      throw error;
    }
  };

  const fetchEmergencyEndpoint = async (endpoint: string, options?: RequestInit) => {
    try {
      const response = await fetchWithAuth(`/api/emergency${endpoint}`, options);
      return await response.json();
    } catch (error) {
      console.error(`Emergency endpoint error (${endpoint}):`, error);
      throw error;
    }
  };
  
  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(0);
  const [auditRowsPerPage, setAuditRowsPerPage] = useState(25);
  const [auditTotalCount, setAuditTotalCount] = useState(0);
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('all');
  const [auditLogType, setAuditLogType] = useState<'all' | 'deleted' | 'active' | 'monitoring' | 'connection-leak' | 'pool-dashboard'>('all');

  // Active shops state
  const [activeShops, setActiveShops] = useState<ActiveShop[]>([]);
  const [activeShopsLoading, setActiveShopsLoading] = useState(false);
  const [activeShopsError, setActiveShopsError] = useState<string | null>(null);
  
  // Session statistics state
  const [sessionStats, setSessionStats] = useState<any>(null);
  const [sessionStatsLoading, setSessionStatsLoading] = useState(false);
  const [sessionStatsError, setSessionStatsError] = useState<string | null>(null);
  
  const [deletedShops, setDeletedShops] = useState<DeletedShop[]>([]);
  const [deletedShopsLoading, setDeletedShopsLoading] = useState(false);
  const [deletedShopsError, setDeletedShopsError] = useState<string | null>(null);

  // Emergency mode state
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [emergencyStatus, setEmergencyStatus] = useState<any>(null);
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  // Diff viewer state (must be at top level for React rules-of-hooks)
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffBefore, setDiffBefore] = useState('');
  const [diffAfter, setDiffAfter] = useState('');

  // Connection Leak Monitoring State
  const [connectionLeakStatus, setConnectionLeakStatus] = useState<any>(null);
  const [connectionLeakLoading, setConnectionLeakLoading] = useState(false);
  const [connectionLeakError, setConnectionLeakError] = useState<string | null>(null);
  const [emergencyCleanupInProgress, setEmergencyCleanupInProgress] = useState(false);
  const [connectionHistory, setConnectionHistory] = useState<any[]>([]);
  const [leakAlerts, setLeakAlerts] = useState<any[]>([]);

  // Action categories for audit logs with improved colors and icons
  const actionCategories = {
    'DATA_ACCESS': { label: 'Data Access', color: '#1976d2', bgColor: '#e3f2fd', icon: <VisibilityIcon /> },
    'DATA_DELETION': { label: 'Data Deletion', color: '#d32f2f', bgColor: '#ffebee', icon: <DeleteIcon /> },
    'AUTHENTICATION': { label: 'Authentication', color: '#ed6c02', bgColor: '#fff3e0', icon: <SecurityIcon /> },
    'COMPLIANCE': { label: 'Compliance', color: '#2e7d32', bgColor: '#e8f5e8', icon: <CheckCircleIcon /> },
    'SHOP_OPERATIONS': { label: 'Shop Operations', color: '#0288d1', bgColor: '#e1f5fe', icon: <StoreIcon /> },
    'SYSTEM': { label: 'System', color: '#5e35b1', bgColor: '#f3e5f5', icon: <SettingsIcon /> },
  };

  const getActionCategory = (action: string) => {
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
  };

  const getActionColor = (action: string) => {
    const category = getActionCategory(action);
    return actionCategories[category as keyof typeof actionCategories]?.color || '#616161';
  };

  const getActionBgColor = (action: string) => {
    const category = getActionCategory(action);
    return actionCategories[category as keyof typeof actionCategories]?.bgColor || '#f5f5f5';
  };

  const getActionIcon = (action: string) => {
    const category = getActionCategory(action);
    return actionCategories[category as keyof typeof actionCategories]?.icon || <InfoIcon />;
  };

  // Enterprise-grade admin authentication using backend JWT
  const checkAuthStatus = async () => {
    try {
      const status = await getAdminStatus();
      if (status.authenticated) {
        setIsAuthenticated(true);
        setIsPasswordDialogOpen(false);
        setSessionInfo(status);
        showSuccess('Admin session restored successfully');
      } else {
        setIsAuthenticated(false);
        setIsPasswordDialogOpen(true);
        setSessionInfo(null);
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      setIsAuthenticated(false);
      setIsPasswordDialogOpen(true);
      setSessionInfo(null);
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
        
        showSuccess(`Welcome ${result.username}! Admin access granted.`);
        
        // Fetch initial data
        await Promise.all([
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
          showError('Account locked due to too many failed attempts');
          
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
      showError('Unable to connect to authentication service');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await adminLogout();
      setIsAuthenticated(false);
      setIsPasswordDialogOpen(true);
      setSessionInfo(null);
      setPassword('');
      setAuthError('');
      
      showSuccess('Admin session ended securely');
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
        setIsAuthenticated(false);
        setIsPasswordDialogOpen(true);
      setSessionInfo(null);
      navigate('/');
    }
  };

  // Check authentication status on component mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Auto-refresh session status every 5 minutes
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(checkAuthStatus, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Initialize connection leak monitoring when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchConnectionLeakStatus();
      
      // Set up real-time monitoring (every 30 seconds)
      const interval = setInterval(() => {
        fetchConnectionLeakStatus();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // REMOVED: Frontend-only authentication (insecure)
  // Admin authentication should only use backend JWT system

  const fetchActiveShops = async () => {
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
  };

  const fetchDeletedShops = async () => {
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
  };

  const fetchSessionStatistics = async () => {
    if (!isAuthenticated) return;
    
    try {
      setSessionStatsLoading(true);
      setSessionStatsError(null);
      
      const data = await fetchAdminEndpoint('/api/admin/session-statistics');
      
      if (data.statistics) {
        setSessionStats(data.statistics);
      } else {
        setSessionStats(null);
      }
    } catch (err) {
      console.error('Error fetching session statistics:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setSessionStatsError(`Failed to fetch session statistics: ${errorMessage}`);
      setSessionStats(null);
    } finally {
      setSessionStatsLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    if (!isAuthenticated) return;
    
    try {
      setAuditLoading(true);
      setAuditError(null);
      
      // Fix: Use the correct endpoints available in the backend
      let endpoint = `/api/admin/audit-logs/all?page=${auditPage}&size=${auditRowsPerPage}`;
      
      if (auditLogType === 'deleted') {
        endpoint = `/api/admin/audit-logs/deleted-shops?page=${auditPage}&size=${auditRowsPerPage}`;
      } else if (auditLogType === 'active') {
        endpoint = `/api/admin/audit-logs/active-shops?page=${auditPage}&size=${auditRowsPerPage}`;
      }
      
      const data = await fetchAdminEndpoint(endpoint);
      
      if (data.audit_logs) {
        // Map backend fields to frontend expected fields
        const mappedLogs = data.audit_logs.map((log: any) => ({
          ...log,
          timestamp: log.createdAt || log.timestamp,
          shopDomain: log.shopDomain || extractShopDomainFromDetails(log.details) || 'System'
        }));
        setAuditLogs(mappedLogs);
        setAuditTotalCount(data.total_count || mappedLogs.length);
      } else if (Array.isArray(data)) {
        const mappedLogs = data.map((log: any) => ({
          ...log,
          timestamp: log.createdAt || log.timestamp,
          shopDomain: log.shopDomain || extractShopDomainFromDetails(log.details) || 'System'
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
      
      // Check if this might be a connection pool issue
      if (errorMessage.includes('HTTP 503') || errorMessage.includes('HTTP 500') || 
          errorMessage.includes('Connection is not available') || errorMessage.includes('timeout')) {
        showError('🚨 Database connection issue detected! Redirecting to emergency admin...');
        
        // Redirect to emergency admin after 2 seconds
        setTimeout(() => {
          window.location.href = '/emergency-admin.html';
        }, 2000);
        
        return;
      }
      
        setAuditError(`Failed to fetch audit logs: ${errorMessage}`);
      setAuditLogs([]);
      setAuditTotalCount(0);
    } finally {
      setAuditLoading(false);
    }
  };

  // Emergency mode functions
  const checkEmergencyStatus = async () => {
    // FIXED: Only check emergency status if authenticated
    if (!isAuthenticated) {
      console.log('Skipping emergency status check - not authenticated');
      setEmergencyMode(false);
      setEmergencyStatus(null);
      setEmergencyLoading(false);
      return;
    }

    try {
      setEmergencyLoading(true);
      const status = await fetchEmergencyEndpoint('/status');
      setEmergencyStatus(status);
      setEmergencyMode(status.emergencyMode || false);
      
      if (status.emergencyMode) {
        showError('⚠️ CRITICAL: Connection pool exhausted - Emergency admin mode activated');
      }
    } catch (error) {
      console.error('Emergency status check failed:', error);
      // FIXED: Don't assume emergency mode on auth failure
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        console.log('Emergency status check failed due to authentication - will retry after login');
        setEmergencyMode(false);
        setEmergencyStatus(null);
      } else {
        setEmergencyMode(true); // Assume emergency mode only for non-auth errors
        showError('Unable to check system status - assuming emergency mode');
      }
    } finally {
      setEmergencyLoading(false);
    }
  };

  const performEmergencyCleanup = async () => {
    try {
      setEmergencyLoading(true);
      const result = await fetchEmergencyEndpoint('/cleanup-connections', { method: 'POST' });
      
      if (result.cleanupPerformed) {
        showSuccess('✅ Emergency connection cleanup completed');
        // Re-check status after cleanup
        setTimeout(() => {
          checkEmergencyStatus();
        }, 3000);
      } else {
        showError('❌ Emergency cleanup failed: ' + result.message);
      }
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
      showError('❌ Emergency cleanup failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setEmergencyLoading(false);
    }
  };

  const getSystemResources = async () => {
    try {
      const resources = await fetchEmergencyEndpoint('/system-resources');
      return resources;
    } catch (error) {
      console.error('System resources check failed:', error);
      throw error;
    }
  };

  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesSearch = auditSearchTerm === '' || 
      log.action.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
      (log.shopDomain && log.shopDomain.toLowerCase().includes(auditSearchTerm.toLowerCase())) ||
      (log.ipAddress && log.ipAddress.toLowerCase().includes(auditSearchTerm.toLowerCase()));
    
    const matchesAction = auditActionFilter === 'all' || log.action === auditActionFilter;
    const matchesCategory = auditCategoryFilter === 'all' || getActionCategory(log.action) === auditCategoryFilter;
    
    return matchesSearch && matchesAction && matchesCategory;
  });

  const uniqueActions = Array.from(new Set(auditLogs.map(log => log.action))).sort();
  const uniqueCategories = Array.from(new Set(auditLogs.map(log => getActionCategory(log.action)))).sort();

  useEffect(() => {
    if (!isAuthenticated) {
      setAuditLogs([]);
      setAuditLoading(false);
      setAuditError(null);
      setAuditPage(0);
      setAuditRowsPerPage(25);
      setAuditTotalCount(0);
      setAuditSearchTerm('');
      setAuditActionFilter('all');
      setAuditCategoryFilter('all');
      setAuditLogType('all');
      return;
    }
  }, [isAuthenticated]);

  // Fetch audit logs when pagination or log type changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchAuditLogs();
      fetchSessionStatistics(); // Always fetch session stats
      if (auditLogType === 'active') {
        fetchActiveShops();
      } else if (auditLogType === 'deleted') {
        fetchDeletedShops();
      }
      
      // FIXED: Only check emergency mode after authentication
      checkEmergencyStatus();
    }
  }, [auditPage, auditRowsPerPage, auditLogType, isAuthenticated]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      setAuditLogs([]);
      setAuditLoading(false);
      setAuditError(null);
      setAuditPage(0);
      setAuditRowsPerPage(25);
      setAuditTotalCount(0);
      setAuditSearchTerm('');
      setAuditActionFilter('all');
      setAuditCategoryFilter('all');
      setAuditLogType('all');
    };
  }, []);

  // Connection Leak Monitoring Functions
  const fetchConnectionLeakStatus = async () => {
    setConnectionLeakLoading(true);
    setConnectionLeakError(null);
    
    try {
      const response = await fetchWithAuth('/api/health/connection-leak-status');
      if (response.ok) {
        const data = await response.json();
        setConnectionLeakStatus(data);
        
        // Add to history for trending
        setConnectionHistory(prev => [
          ...prev.slice(-19), // Keep last 20 entries
          {
            timestamp: new Date().toISOString(),
            ...data.hikariMetrics,
            status: data.poolStatus,
            risk: data.connectionLeakRisk
          }
        ]);

        // Check for high risk and create alerts
        if (data.connectionLeakRisk === 'HIGH' || data.emergencyCleanupNeeded) {
          const alert = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            type: 'CONNECTION_LEAK_WARNING',
            message: `Connection leak risk: ${data.connectionLeakRisk}. Pool usage: ${data.hikariMetrics?.usagePercentage}%`,
            severity: data.emergencyCleanupNeeded ? 'error' : 'warning',
            data: data
          };
          
          setLeakAlerts(prev => [alert, ...prev.slice(0, 9)]); // Keep last 10 alerts
          
          if (data.emergencyCleanupNeeded) {
            showError(`🚨 CRITICAL: Emergency cleanup needed! Pool usage: ${data.hikariMetrics?.usagePercentage}%`);
          }
        }
      } else {
        const errorData = await response.json();
        setConnectionLeakError(errorData.message || 'Failed to fetch connection leak status');
      }
    } catch (error) {
      console.error('Connection leak status fetch failed:', error);
      setConnectionLeakError('Network error while fetching connection leak status');
    } finally {
      setConnectionLeakLoading(false);
    }
  };

  const performEmergencyConnectionCleanup = async () => {
    setEmergencyCleanupInProgress(true);
    
    try {
      const response = await fetchWithAuth('/api/health/emergency-cleanup', {
        method: 'POST'
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Show cleanup results
        const beforeUsage = Math.round(
          (data.beforeCleanup?.activeConnections / data.beforeCleanup?.maxPoolSize) * 100
        );
        const afterUsage = Math.round(
          (data.afterCleanup?.activeConnections / data.afterCleanup?.maxPoolSize) * 100
        );
        
        showSuccess(`✅ Emergency cleanup completed! Pool usage: ${beforeUsage}% → ${afterUsage}%`);
        
        // Add cleanup event to alerts
        const cleanupAlert = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          type: 'EMERGENCY_CLEANUP',
          message: `Emergency cleanup performed. Pool usage reduced from ${beforeUsage}% to ${afterUsage}%`,
          severity: 'info',
          data: data
        };
        
        setLeakAlerts(prev => [cleanupAlert, ...prev.slice(0, 9)]);
        
        // Refresh connection status
        setTimeout(() => {
          fetchConnectionLeakStatus();
        }, 2000);
        
      } else {
        const errorData = await response.json();
        showError(`Emergency cleanup failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
      showError('Network error during emergency cleanup');
    } finally {
      setEmergencyCleanupInProgress(false);
    }
  };

  // Enhanced admin authentication dialog
  if (!isAuthenticated) {
  return (
      <Dialog 
        open={isPasswordDialogOpen} 
        onClose={() => {}} 
        disableEscapeKeyDown
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <AdminIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box>
              <Typography variant="h5" fontWeight="600">
                Enterprise Admin Access
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Secure authentication to administration panel
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
            This is the enterprise admin panel for ShopGauge. Please enter your admin credentials to continue.
      </Typography>

          {isLocked && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              <Typography variant="body2" fontWeight="500" sx={{ mb: 0.5 }}>
                Account Temporarily Locked
        </Typography>
              <Typography variant="body2">
                Too many failed attempts. Account will be unlocked automatically in 15 minutes.
              </Typography>
            </Alert>
          )}

          {authError && !isLocked && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {authError}
            </Alert>
          )}
          
          <TextField
            fullWidth
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLocked || isLoading}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            type="password"
            label="Password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isLocked && !isLoading) {
                handleAdminLogin();
              }
            }}
            disabled={isLocked || isLoading}
            autoFocus={!isLocked}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              }
            }}
          />
          
          <Paper sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 500, mb: 1 }}>
              🔒 Security Features
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div">
              • JWT-based authentication with secure token management<br/>
              • BCrypt password hashing with salt<br/>
              • Rate limiting with automatic account lockout<br/>
              • Session monitoring and audit logging<br/>
              • Redis-based token blacklisting<br/>
              • HTTPS enforcement in production
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={handleAdminLogin}
            variant="contained"
            disabled={!username || !password || isLocked || isLoading}
            fullWidth
            size="large"
            startIcon={isLoading ? <CircularProgress size={20} /> : <LoginIcon />}
            sx={{ 
              borderRadius: 2,
              py: 1.5,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {isLoading ? 'Authenticating...' : isLocked ? 'Account Locked' : 'Access Admin Panel'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <AdminContainer maxWidth="xl">
      <HeaderCard>
        <SectionHeader>
          <AdminHeader>
            <Stack direction="row" alignItems="center" spacing={2}>
              <AdminIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              <Box>
                <Typography variant="h4" fontWeight="700" sx={{ mb: 0.5 }}>
                  Enterprise Admin Panel
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Secure administration and monitoring dashboard
                </Typography>
                {sessionInfo && (
                  <Typography variant="body2" color="success.main" sx={{ mt: 0.5 }}>
                    Authenticated as: {sessionInfo.username} | Session expires: {new Date(sessionInfo.expiresAt).toLocaleString()}
                  </Typography>
                )}
        </Box>
            </Stack>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={checkAuthStatus}
                sx={{ borderRadius: 2 }}
              >
                Refresh Session
              </Button>
              <Button
                variant="outlined"
                startIcon={<LogoutIcon />}
                onClick={handleAdminLogout}
                sx={{ borderRadius: 2 }}
              >
                Logout Admin
              </Button>
            </Stack>
          </AdminHeader>
        </SectionHeader>

        <Box sx={{ p: 3 }}>
          {/* Rest of the admin panel content */}
          {/* ... existing tabs and content ... */}
                  </Box>
      </HeaderCard>
    </AdminContainer>
  );
};

export default AdminPage; 