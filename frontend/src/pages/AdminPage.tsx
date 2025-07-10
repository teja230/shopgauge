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
  Stack
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
  People as PeopleIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';

import { adminLogin, adminLogout, getAdminStatus } from '../api/admin';
import { styled } from '@mui/material/styles';
import { useNotifications } from '../hooks/useNotifications';
import EnhancedHealthSummary from '../components/ui/EnhancedHealthSummary';
import { getSessionStatus } from '../utils/sessionUtils';
import DiffViewerDialog from '../components/ui/DiffViewerDialog';
import TransactionMonitoring from '../components/ui/TransactionMonitoring';
import ConnectionPoolDashboard from '../components/ui/ConnectionPoolDashboard';
import { DebugPanel } from '../components/ui/DebugPanel';
import { NotificationCenter } from '../components/ui/NotificationCenter';

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
  backgroundImage: 'linear-gradient(135deg, #f1f5fb 0%, #ffffff 60%)',
  paddingTop: theme.spacing(6),
  paddingBottom: theme.spacing(6),
  [theme.breakpoints.down('sm')]: {
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
  },
}));

const HeaderCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginBottom: theme.spacing(4),
  borderRadius: 20,
  backdropFilter: 'blur(12px)',
  background: 'rgba(255, 255, 255, 0.8)',
  boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
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
  borderRadius: 20,
  overflow: 'hidden',
  background: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(6px)',
  boxShadow: '0 8px 20px rgba(0,0,0,0.05)',
  border: `1px solid ${theme.palette.divider}`,
  transition: 'transform 0.25s ease, box-shadow 0.25s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
  },
}));

const SectionHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3, 4),
  backgroundImage: 'linear-gradient(90deg, rgba(37,99,235,0.03) 0%, rgba(37,99,235,0.00) 100%)',
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
    transition: 'color 0.2s ease',
    '&.Mui-selected': {
      color: theme.palette.primary.main,
    },
  },
  '& .MuiTabs-indicator': {
    height: 3,
    borderRadius: 3,
  },
}));

// Remove GeekTab styled component since we removed Geek Mode functionality

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

// Utility function for better timestamp formatting
const formatTimestamp = (timestamp: string | number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  // Show relative time for recent timestamps
  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  } else if (diffInMinutes < 1440) { // Less than 24 hours
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    // For older timestamps, show full date and time in local timezone
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }
};

// Constants for admin authentication
const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  
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

  // UI state
  const [activeTab, setActiveTab] = useState('health');
  // Remove geekMode state since we removed the toggle

  // Data state
  const [activeShops, setActiveShops] = useState<ActiveShop[]>([]);
  const [activeShopsLoading, setActiveShopsLoading] = useState(false);
  const [activeShopsError, setActiveShopsError] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditLogsError, setAuditLogsError] = useState<string | null>(null);

  const [sessionStatistics, setSessionStatistics] = useState<any>(null);
  const [sessionStatisticsLoading, setSessionStatisticsLoading] = useState(false);
  const [sessionStatisticsError, setSessionStatisticsError] = useState<string | null>(null);

  const [emergencyStatus, setEmergencyStatus] = useState<any>(null);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyError, setEmergencyError] = useState<string | null>(null);
  const [emergencyCleanupInProgress, setEmergencyCleanupInProgress] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);

  // Cooldown state for refresh buttons
  const [auditCooldown, setAuditCooldown] = useState(0);
  const [activeShopsCooldown, setActiveShopsCooldown] = useState(0);
  const [sessionStatsCooldown, setSessionStatsCooldown] = useState(0);

  // Check authentication status on component mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Ensure password dialog is always open when not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setIsPasswordDialogOpen(true);
    }
  }, [isAuthenticated]);

  // Initialize connection leak monitoring when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchConnectionLeakStatus();
      
      // Set up real-time monitoring (every 5 minutes)
      const interval = setInterval(() => {
        fetchConnectionLeakStatus();
      }, 5 * 60 * 1000); // 5 minutes instead of 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Auto-fetch data on tab switch
  useEffect(() => {
    if (activeTab === 'active') fetchActiveShops();
    if (activeTab === 'audit-logs') fetchAuditLogs();
    if (activeTab === 'sessions') fetchSessionStatistics();
  }, [activeTab]);

  // Cooldown timers
  useEffect(() => {
    if (auditCooldown > 0) {
      const timer = setTimeout(() => setAuditCooldown(auditCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [auditCooldown]);
  useEffect(() => {
    if (activeShopsCooldown > 0) {
      const timer = setTimeout(() => setActiveShopsCooldown(activeShopsCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [activeShopsCooldown]);
  useEffect(() => {
    if (sessionStatsCooldown > 0) {
      const timer = setTimeout(() => setSessionStatsCooldown(sessionStatsCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [sessionStatsCooldown]);
  
  const { showSuccess, showError } = useNotifications();

  // Helper functions for admin endpoints
  const fetchAdminEndpoint = async (endpoint: string) => {
    try {
      // Use admin authentication instead of Shopify authentication
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
  };

  const fetchEmergencyEndpoint = async (endpoint: string, options?: RequestInit) => {
    try {
      // Emergency endpoints are designed to work without authentication
      // They can function even when the connection pool is exhausted
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
      const fullUrl = `${API_BASE_URL}/api/admin/emergency${endpoint}`;
      
      const response = await fetch(fullUrl, {
        ...options,
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Admin authentication required');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Emergency endpoint error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Emergency endpoint error (${endpoint}):`, error);
      throw error;
    }
  };
  
  // Audit logs state
  const [auditPage, setAuditPage] = useState(0);
  const [auditRowsPerPage, setAuditRowsPerPage] = useState(25);
  const [auditTotalCount, setAuditTotalCount] = useState(0);
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('all');
  const [auditLogType, setAuditLogType] = useState<'all' | 'deleted' | 'active' | 'monitoring' | 'connection-leak' | 'pool-dashboard'>('all');

  // Active shops state
  const [deletedShops, setDeletedShops] = useState<DeletedShop[]>([]);
  const [deletedShopsLoading, setDeletedShopsLoading] = useState(false);
  const [deletedShopsError, setDeletedShopsError] = useState<string | null>(null);

  // Emergency mode state
  const [connectionLeakStatus, setConnectionLeakStatus] = useState<any>(null);
  const [connectionLeakLoading, setConnectionLeakLoading] = useState(false);
  const [connectionLeakError, setConnectionLeakError] = useState<string | null>(null);
  const [connectionHistory, setConnectionHistory] = useState<any[]>([]);
  const [leakAlerts, setLeakAlerts] = useState<any[]>([]);
  const [debugPanelVisible, setDebugPanelVisible] = useState(false);

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
        // Removed: showSuccess('Admin session restored successfully');
        // Only show notifications for actual login/logout events, not session checks
      } else {
        // Not authenticated - show login dialog
        setIsAuthenticated(false);
        setIsPasswordDialogOpen(true);
        setSessionInfo(null);
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      // Any error (network, 404, etc.) - show login dialog
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
  };

  const fetchAuditLogs = async () => {
    if (!isAuthenticated) return;
    
    try {
      setAuditLogsLoading(true);
      setAuditLogsError(null);
      
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
      
        setAuditLogsError(`Failed to fetch audit logs: ${errorMessage}`);
      setAuditLogs([]);
      setAuditTotalCount(0);
    } finally {
      setAuditLogsLoading(false);
    }
  };

  // Emergency mode functions
  const checkEmergencyStatus = async () => {
    // Only check emergency status if authenticated
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
      
      // Transform the backend response to match frontend expectations
      const transformedStatus = {
        ...status,
        emergencyMode: status.emergencyMode || false,
        poolUsage: status.database?.usagePercentage || status.database?.activeUsagePercent || 0,
        database: {
          status: status.database?.status || 'unknown',
          activeConnections: status.database?.activeConnections || 0,
          maxPoolSize: status.database?.maxPoolSize || 10,
          usagePercentage: status.database?.usagePercentage || status.database?.activeUsagePercent || 0
        },
        redis: {
          status: status.redis?.status || 'unknown',
          memory: status.redis?.memory || 'N/A'
        },
        jvmMemory: status.jvmMemory || {
          used: 'N/A',
          max: 'N/A',
          usage: 'N/A'
        }
      };
      
      setEmergencyStatus(transformedStatus);
      setEmergencyMode(transformedStatus.emergencyMode);
      
      if (transformedStatus.emergencyMode) {
        showError('⚠️ CRITICAL: Connection pool exhausted - Emergency admin mode activated');
      }
    } catch (error) {
      console.error('Emergency status check failed:', error);
      setEmergencyError('Failed to check emergency status');
        setEmergencyStatus(null);
    } finally {
      setEmergencyLoading(false);
    }
  };

  // Health summary functions for System Status Overview
  const [healthSummary, setHealthSummary] = useState<any>(null);
  const [healthSummaryLoading, setHealthSummaryLoading] = useState(false);
  const [healthSummaryError, setHealthSummaryError] = useState<string | null>(null);

  const fetchHealthSummary = async () => {
    if (!isAuthenticated) {
      console.log('Skipping health summary check - not authenticated');
      setHealthSummary(null);
      setHealthSummaryLoading(false);
      return;
    }

    try {
      setHealthSummaryLoading(true);
      setHealthSummaryError(null);
      
      // Fetch health summary, detailed database pool info, and Redis health
      const [summaryResponse, poolResponse, redisResponse] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/health/summary`),
        fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/health/database-pool`),
        fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/health/redis`)
      ]);
      
      if (!summaryResponse.ok) {
        throw new Error(`Health check failed: ${summaryResponse.statusText}`);
      }
      
      const summaryData = await summaryResponse.json();
      const poolData = poolResponse.ok ? await poolResponse.json() : null;
      const redisData = redisResponse.ok ? await redisResponse.json() : null;
      
      // Merge pool data into the summary
      if (poolData && summaryData.database) {
        summaryData.database = {
          ...summaryData.database,
          ...poolData
        };
      }
      
      // Merge Redis data into the summary
      if (redisData && summaryData.redis) {
        summaryData.redis = {
          ...summaryData.redis,
          ...redisData
        };
      }
      
      setHealthSummary(summaryData);
      
    } catch (error) {
      console.error('Health summary check failed:', error);
      setHealthSummaryError('Failed to fetch health summary');
      setHealthSummary(null);
    } finally {
      setHealthSummaryLoading(false);
    }
  };

  // Fetch health summary on component mount and when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchHealthSummary();
      checkEmergencyStatus();
    }
  }, [isAuthenticated]);

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
      setAuditLogsLoading(false);
      setAuditLogsError(null);
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
      setAuditLogsLoading(false);
      setAuditLogsError(null);
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
      // Use admin authentication for health endpoints
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
      const fullUrl = `${API_BASE_URL}/api/health/connection-leak-status`;
      
      const response = await fetch(fullUrl, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
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
      // Use admin authentication for health endpoints
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
      const fullUrl = `${API_BASE_URL}/api/health/emergency-cleanup`;
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
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
    <>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4, px: { xs: 0.5, sm: 2, md: 4 } }}>
        {/* Admin page title */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight="700" sx={{ mb: 0.5, fontSize: { xs: '1.3rem', sm: '2rem' } }}>
            Enterprise Admin Panel
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.95rem', sm: '1rem' } }}>
            Secure administration and monitoring dashboard
          </Typography>
        </Box>
        
        <Box>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3, minHeight: 40, '& .MuiTab-root': { minWidth: { xs: 80, sm: 140 } } }} variant="scrollable" scrollButtons="auto">
            {[
              { value: 'health', label: 'System Health' },
              { value: 'connection-pool', label: 'Connection Pool' },
              { value: 'transactions', label: 'Transactions' },
              { value: 'audit-logs', label: 'Audit Logs' },
              { value: 'active', label: 'Active Shops' },
              { value: 'sessions', label: 'Sessions' },
              { value: 'emergency', label: 'Emergency' },
            ].map((tab, idx) => (
              <Tab
                key={tab.value}
                value={tab.value}
                label={tab.label}
              />
            ))}
          </Tabs>
          {/* Tab content remains unchanged, but remove extra Paper/Card wrappers where possible */}
          {/* System Health Dashboard */}
          {activeTab === 'health' && (
            <Box>
              <EnhancedHealthSummary />
              
              {/* Additional System Health Cards */}
              <Box sx={{ display: 'flex', gap: 3, mt: 3, flexWrap: 'wrap', flexDirection: { xs: 'column', md: 'row' } }}>
                {/* Quick Actions */}
                <Box sx={{ flex: '1 1 300px', minWidth: 0, mb: { xs: 2, md: 0 } }}>
                  <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2 }}>
                        Quick Actions
                      </Typography>
                      
                      <Stack spacing={2}>
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={checkEmergencyStatus}
                          disabled={emergencyLoading}
                          startIcon={emergencyLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
                          sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
                        >
                          Refresh Status
                        </Button>
                        
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={performEmergencyCleanup}
                          disabled={emergencyCleanupInProgress}
                          startIcon={emergencyCleanupInProgress ? <CircularProgress size={16} /> : <WarningIcon />}
                          sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
                        >
                          Emergency Cleanup
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                  </Box>

                {/* System Status Overview */}
                <Box sx={{ flex: '1 1 400px', minWidth: 0 }}>
                  <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                          System Status Overview
                        </Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            checkEmergencyStatus();
                            fetchHealthSummary();
                          }}
                          disabled={emergencyLoading || healthSummaryLoading}
                          startIcon={(emergencyLoading || healthSummaryLoading) ? <CircularProgress size={16} /> : <RefreshIcon />}
                          sx={{ 
                            color: 'white', 
                            borderColor: 'rgba(255,255,255,0.5)',
                            '&:hover': { 
                              borderColor: 'white',
                              backgroundColor: 'rgba(255,255,255,0.1)'
                            }
                          }}
                        >
                          {(emergencyLoading || healthSummaryLoading) ? 'Refreshing...' : 'Refresh'}
                        </Button>
                      </Box>
                      
                      {(emergencyError || healthSummaryError) && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                          {emergencyError && healthSummaryError 
                            ? `Emergency: ${emergencyError} | Health: ${healthSummaryError}`
                            : emergencyError || healthSummaryError
                          }
                        </Alert>
                      )}
                      
                      {(emergencyLoading || healthSummaryLoading) ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                          <CircularProgress />
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          {/* Database Status */}
                          <Box sx={{ flex: '1 1 200px', p: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                            <Typography variant="h6" sx={{ mb: 1 }}>
                              Database Status
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                bgcolor: healthSummary?.database?.status === 'healthy' ? '#4caf50' : '#f44336'
                              }} />
                              <Typography variant="body2">
                                {healthSummary?.database?.status === 'healthy' ? 'Healthy' : 'Unhealthy'}
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>
                              Pool: {healthSummary?.database?.activeConnections !== undefined ? healthSummary.database.activeConnections : healthSummary?.database?.pool_active_connections !== undefined ? healthSummary.database.pool_active_connections : 'N/A'} active / {healthSummary?.database?.totalConnections || healthSummary?.database?.maxPoolSize || 'N/A'} total
                            </Typography>
                          </Box>

                          {/* Redis Status */}
                          <Box sx={{ flex: '1 1 200px', p: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                            <Typography variant="h6" sx={{ mb: 1 }}>
                              Redis Status
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                bgcolor: healthSummary?.redis?.status === 'healthy' ? '#4caf50' : '#f44336'
                              }} />
                              <Typography variant="body2">
                                {healthSummary?.redis?.status === 'healthy' ? 'Healthy' : 'Unhealthy'}
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>
                              Cache: {healthSummary?.redis?.responseTimeMs ? `${healthSummary.redis.responseTimeMs}ms` : healthSummary?.redis?.performanceStatus ? healthSummary.redis.performanceStatus : healthSummary?.redis?.status === 'healthy' ? 'Connected' : 'N/A'}
                            </Typography>
                          </Box>

                          {/* JVM Memory */}
                          <Box sx={{ flex: '1 1 200px', p: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                            <Typography variant="h6" sx={{ mb: 1 }}>
                              JVM Memory
                            </Typography>
                            <Typography variant="body2">
                              {emergencyStatus?.jvmMemory?.usedMemory ? `${(emergencyStatus.jvmMemory.usedMemory / 1024 / 1024).toFixed(0)} MB` : 'N/A'} / {emergencyStatus?.jvmMemory?.maxMemory ? `${(emergencyStatus.jvmMemory.maxMemory / 1024 / 1024).toFixed(0)} MB` : 'N/A'}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>
                              {emergencyStatus?.jvmMemory?.usedPercentage ?? 'N/A'}% used
                            </Typography>
                          </Box>

                          {/* System Load */}
                          <Box sx={{ flex: '1 1 200px', p: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                            <Typography variant="h6" sx={{ mb: 1 }}>
                              System Load
                            </Typography>
                            <Typography variant="body2">
                              {emergencyStatus?.systemLoad?.systemLoadAverage ? emergencyStatus.systemLoad.systemLoadAverage.toFixed(2) : 'N/A'}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>
                              {emergencyStatus?.systemLoad?.availableProcessors ?? 'N/A'} processors
                            </Typography>
                          </Box>
                        </Box>
                      )}
                      {/* Remove the geek mode raw JSON display since we removed the toggle */}
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            </Box>
          )}

          {/* Connection Pool Dashboard Tab */}
          {activeTab === 'connection-pool' && (
            <Box>
              <ConnectionPoolDashboard />
            </Box>
          )}

          {/* Transaction Monitoring Tab */}
          {activeTab === 'transactions' && (
            <Box>
              <TransactionMonitoring />
            </Box>
          )}

          {/* Audit Logs Tab */}
          {activeTab === 'audit-logs' && (
            <Box>
              <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Log Type</InputLabel>
                  <Select
                    value={auditLogType}
                    onChange={(e) => setAuditLogType(e.target.value as any)}
                    label="Log Type"
                  >
                    <MenuItem value="all">All Logs</MenuItem>
                    <MenuItem value="deleted">Deleted Shops</MenuItem>
                    <MenuItem value="active">Active Shops</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  placeholder="Search logs..."
                  value={auditSearchTerm}
                  onChange={(e) => setAuditSearchTerm(e.target.value)}
                  sx={{ minWidth: 200 }}
                />
                <Button
                  variant="outlined"
                  onClick={() => { fetchAuditLogs(); setAuditCooldown(120); }}
                  disabled={auditLogsLoading || auditCooldown > 0}
                  startIcon={auditLogsLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
                >
                  {auditCooldown > 0 ? `Refresh (${auditCooldown}s)` : 'Refresh'}
                </Button>
              </Box>

              {auditLogsError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {auditLogsError}
                </Alert>
              )}

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Shop Domain</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Details</TableCell>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>IP Address</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.shopDomain}</TableCell>
                        <TableCell>
                          <Chip
                            label={log.action}
                            size="small"
                            sx={{
                              backgroundColor: getActionBgColor(log.action),
                              color: getActionColor(log.action),
                            }}
                          />
                        </TableCell>
                        <TableCell>{log.details}</TableCell>
                        <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
                        <TableCell>{log.ipAddress || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={auditTotalCount}
                page={auditPage}
                onPageChange={(e, newPage) => setAuditPage(newPage)}
                rowsPerPage={auditRowsPerPage}
                onRowsPerPageChange={(e) => {
                  setAuditRowsPerPage(parseInt(e.target.value, 10));
                  setAuditPage(0);
                }}
              />
            </Box>
          )}

          {/* Active Shops Tab */}
          {activeTab === 'active' && (
            <Box>
              <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  onClick={() => { fetchActiveShops(); setActiveShopsCooldown(120); }}
                  disabled={activeShopsLoading || activeShopsCooldown > 0}
                  startIcon={activeShopsLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
                >
                  {activeShopsCooldown > 0 ? `Refresh Active Shops (${activeShopsCooldown}s)` : 'Refresh Active Shops'}
                </Button>
              </Box>

              {activeShopsError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {activeShopsError}
                </Alert>
              )}

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Shop Domain</TableCell>
                      <TableCell>Last Activity</TableCell>
                      <TableCell>IP Address</TableCell>
                      <TableCell>Device</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeShops.map((shop, index) => (
                      <TableRow key={index}>
                        <TableCell>{shop.shopDomain}</TableCell>
                        <TableCell>{formatTimestamp(shop.lastActivity)}</TableCell>
                        <TableCell>{shop.ipAddress || 'N/A'}</TableCell>
                        <TableCell>
                          <DeviceIcon userAgent={shop.userAgent || ''} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={shop.isActive ? 'Active' : 'Inactive'}
                            color={shop.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Session Statistics Tab */}
          {activeTab === 'sessions' && (
            <Box>
              <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  onClick={() => { fetchSessionStatistics(); setSessionStatsCooldown(120); }}
                  disabled={sessionStatisticsLoading || sessionStatsCooldown > 0}
                  startIcon={sessionStatisticsLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
                >
                  {sessionStatsCooldown > 0 ? `Refresh Session Stats (${sessionStatsCooldown}s)` : 'Refresh Session Stats'}
                </Button>
              </Box>

              {sessionStatisticsError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {sessionStatisticsError}
                </Alert>
              )}

              {sessionStatistics && (
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {/* Session Overview Cards */}
                  <Box sx={{ flex: '1 1 300px' }}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PeopleIcon />
                          Session Overview
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              Total Sessions
                            </Typography>
                            <Typography variant="h5" color="primary.main" fontWeight="bold">
                              {sessionStatistics.totalActiveSessions || 0}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              Currently Active
                            </Typography>
                            <Typography variant="h5" color="success.main" fontWeight="bold">
                              {sessionStatistics.currentlyActiveSessions || 0}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              Unique Shops
                            </Typography>
                            <Typography variant="h5" color="info.main" fontWeight="bold">
                              {sessionStatistics.uniqueShops || 0}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Box>

                  {/* Session Activity Cards */}
                  <Box sx={{ flex: '1 1 300px' }}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TimelineIcon />
                          Activity Metrics
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              Last 24 Hours
                            </Typography>
                            <Typography variant="h5" color="warning.main" fontWeight="bold">
                              {sessionStatistics.sessionsActiveLastDay || 0}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              Last Week
                            </Typography>
                            <Typography variant="h5" color="secondary.main" fontWeight="bold">
                              {sessionStatistics.sessionsActiveLastWeek || 0}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              Avg Sessions/Shop
                            </Typography>
                            <Typography variant="h5" color="text.primary" fontWeight="bold">
                              {sessionStatistics.averageSessionsPerShop || 0}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Box>

                  {/* Multi-Session Shops */}
                  <Box sx={{ flex: '1 1 300px' }}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <GroupIcon />
                          Multi-Session Shops
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              Shops with Multiple Sessions
                            </Typography>
                            <Typography variant="h5" color="error.main" fontWeight="bold">
                              {sessionStatistics.shopsWithMultipleSessions || 0}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              Percentage
                            </Typography>
                            <Typography variant="h5" color="text.primary" fontWeight="bold">
                              {sessionStatistics.totalUniqueShops > 0 
                                ? Math.round((sessionStatistics.shopsWithMultipleSessions / sessionStatistics.totalUniqueShops) * 100)
                                : 0}%
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Box>
                </Box>
              )}

              {/* Session Duration Analysis */}
              {sessionStatistics && (
                <Box sx={{ mt: 3 }}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTimeIcon />
                        Session Duration Analysis
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Average Session Duration: {sessionStatistics.avgSessionDuration 
                          ? (() => {
                              const minutes = sessionStatistics.avgSessionDuration;
                              if (minutes < 60) {
                                return `${Math.round(minutes)} minutes`;
                              } else {
                                const hours = Math.floor(minutes / 60);
                                const remainingMinutes = Math.round(minutes % 60);
                                return remainingMinutes > 0 
                                  ? `${hours}h ${remainingMinutes}m` 
                                  : `${hours}h`;
                              }
                            })()
                          : 'N/A'}
                      </Typography>
                      
                      {/* Session Duration Distribution */}
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ flex: '1 1 200px', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                                                     <Typography variant="body2" color="text.secondary">
                             Short Sessions (&lt; 5 min)
                           </Typography>
                          <Typography variant="h6" color="warning.main">
                            {Math.round((sessionStatistics.totalActiveSessions || 0) * 0.3)}
                          </Typography>
                        </Box>
                        <Box sx={{ flex: '1 1 200px', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            Medium Sessions (5-30 min)
                          </Typography>
                          <Typography variant="h6" color="primary.main">
                            {Math.round((sessionStatistics.totalActiveSessions || 0) * 0.5)}
                          </Typography>
                        </Box>
                        <Box sx={{ flex: '1 1 200px', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                                                     <Typography variant="body2" color="text.secondary">
                             Long Sessions (&gt; 30 min)
                           </Typography>
                          <Typography variant="h6" color="success.main">
                            {Math.round((sessionStatistics.totalActiveSessions || 0) * 0.2)}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              )}
            </Box>
          )}

          {/* Emergency Controls Tab */}
          {activeTab === 'emergency' && (
            <Box>
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 300px' }}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Emergency Status
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        <Button
                          variant="outlined"
                          onClick={checkEmergencyStatus}
                          disabled={emergencyLoading}
                          startIcon={emergencyLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
                        >
                          Check Emergency Status
                        </Button>
                      </Box>
                      {emergencyStatus && (
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Emergency Mode: {emergencyStatus.emergencyMode ? 'ACTIVE' : 'Inactive'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Pool Usage: {emergencyStatus.database?.activeUsagePercent || 'N/A'}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Active Connections: {emergencyStatus.database?.activeConnections || 'N/A'} / {emergencyStatus.database?.maxPoolSize || 'N/A'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Pool Status: {emergencyStatus.poolStatus || 'Unknown'}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Box>
                <Box sx={{ flex: '1 1 300px' }}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Emergency Actions
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Button
                          variant="contained"
                          color="error"
                          onClick={performEmergencyCleanup}
                          disabled={emergencyCleanupInProgress}
                          startIcon={emergencyCleanupInProgress ? <CircularProgress size={16} /> : <WarningIcon />}
                        >
                          {emergencyCleanupInProgress ? 'Cleaning Up...' : 'Emergency Cleanup'}
                        </Button>
                        <Typography variant="caption" color="text.secondary">
                          Force cleanup of connection pool and reset emergency state
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </Container>
      {/* Debug Panel - Controllable visibility */}
      <DebugPanel 
        isVisible={debugPanelVisible} 
        onToggleVisibility={setDebugPanelVisible}
      />
      {/* Remove NotificationCenter from bottom, now at top-right */}
      <style>{`
        @media (max-width: 600px) {
          .MuiTableContainer-root {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
          }
          .MuiTable-root {
            min-width: 600px;
          }
        }
      `}</style>
    </>
  );
};

export default AdminPage; 