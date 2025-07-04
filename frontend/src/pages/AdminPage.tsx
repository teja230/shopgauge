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
import { useAuth } from '../context/AuthContext';
import { styled } from '@mui/material/styles';
import { useNotifications } from '../hooks/useNotifications';
import EnhancedHealthSummary from '../components/ui/EnhancedHealthSummary';
import DiffViewerDialog from '../components/ui/DiffViewerDialog';
import TransactionMonitoring from '../components/ui/TransactionMonitoring';

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
  const ua = userAgent?.toLowerCase() || '';
  
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return <PhoneIcon fontSize="small" sx={{ color: 'primary.main' }} />;
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    return <TabletIcon fontSize="small" sx={{ color: 'secondary.main' }} />;
  } else if (ua.includes('mac')) {
    return <DesktopIcon fontSize="small" sx={{ color: 'warning.main' }} />;
  } else {
    return <ComputerIcon fontSize="small" sx={{ color: 'info.main' }} />;
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
  
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'Tablet';
  } else {
    return 'Desktop';
  }
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

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(true);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  
  const { showSuccess, showError } = useNotifications();
  
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
  const [auditLogType, setAuditLogType] = useState<'all' | 'deleted' | 'active' | 'monitoring'>('all');

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

  // Diff viewer state (must be at top level for React rules-of-hooks)
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffBefore, setDiffBefore] = useState('');
  const [diffAfter, setDiffAfter] = useState('');

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

  // Production-ready admin authentication
  const [attemptCount, setAttemptCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutEnd, setLockoutEnd] = useState(0);
  const [sessionExpiry, setSessionExpiry] = useState(0);
  const sessionExpiredShownRef = useRef(false);

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours

  // Custom fetch function for admin endpoints that doesn't require shop authentication
  const fetchAdminEndpoint = async (url: string, options: RequestInit = {}) => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.shopgaugeai.com';
    const fullUrl = `${API_BASE_URL}${url}`;
    
    const response = await fetch(fullUrl, {
      ...options,
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  };

  // Check for existing session on mount
  useEffect(() => {
    const storedSession = localStorage.getItem('admin_session_expiry');
    const storedAttempts = localStorage.getItem('admin_attempt_count');
    const storedLockout = localStorage.getItem('admin_lockout_end');

    if (storedSession) {
      const expiry = parseInt(storedSession);
      if (Date.now() < expiry) {
        setIsAuthenticated(true);
        setIsPasswordDialogOpen(false);
        setSessionExpiry(expiry);
      } else {
        localStorage.removeItem('admin_session_expiry');
      }
    }

    if (storedAttempts) {
      setAttemptCount(parseInt(storedAttempts));
    }

    if (storedLockout) {
      const lockout = parseInt(storedLockout);
      if (Date.now() < lockout) {
        setIsLocked(true);
        setLockoutEnd(lockout);
      } else {
        localStorage.removeItem('admin_lockout_end');
        localStorage.removeItem('admin_attempt_count');
        setAttemptCount(0);
      }
    }

    // Session timer
    const interval = setInterval(() => {
      const now = Date.now();
      
      if (sessionExpiry > 0 && now >= sessionExpiry) {
        if (!sessionExpiredShownRef.current) {
          sessionExpiredShownRef.current = true;
          showError('Admin session expired. Please login again.');
        setIsAuthenticated(false);
        setIsPasswordDialogOpen(true);
        }
        setSessionExpiry(0);
        localStorage.removeItem('admin_session_expiry');
      }
      
      if (lockoutEnd && now >= lockoutEnd) {
        setIsLocked(false);
        setLockoutEnd(0);
        setAttemptCount(0);
        localStorage.removeItem('admin_lockout_end');
        localStorage.removeItem('admin_attempt_count');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionExpiry, lockoutEnd]);

  // Reset session expired flag when successfully authenticated
  useEffect(() => {
    if (isAuthenticated) {
      sessionExpiredShownRef.current = false;
    }
  }, [isAuthenticated]);

  // Hash password with salt for security
  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'admin_salt_key_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handlePasswordSubmit = async () => {
    if (isLocked) return;
    
    try {
      const hashedInput = await hashPassword(password);
      const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;
      const hashedAdmin = await hashPassword(adminPassword);
      
      if (hashedInput === hashedAdmin) {
        // Successful login
        setIsAuthenticated(true);
        setIsPasswordDialogOpen(false);
        setPasswordError('');
        setAttemptCount(0);
        localStorage.removeItem('admin_attempt_count');
        
        // Set session expiry
        const expiry = Date.now() + SESSION_DURATION;
        setSessionExpiry(expiry);
        localStorage.setItem('admin_session_expiry', expiry.toString());
        
        showSuccess('Admin access granted. Session valid for 2 hours.');
      } else {
        // Failed login
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        localStorage.setItem('admin_attempt_count', newAttemptCount.toString());
        
        if (newAttemptCount >= MAX_ATTEMPTS) {
          const lockout = Date.now() + LOCKOUT_DURATION;
          setIsLocked(true);
          setLockoutEnd(lockout);
          localStorage.setItem('admin_lockout_end', lockout.toString());
          setPasswordError('Account locked for 15 minutes due to too many failed attempts.');
        } else {
          const remaining = MAX_ATTEMPTS - newAttemptCount;
          setPasswordError(`Invalid password. ${remaining} attempts remaining.`);
        }
      }
    } catch (error) {
      console.error('Password verification error:', error);
      setPasswordError('Authentication error. Please try again.');
    }
  };

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
      setAuditError(`Failed to fetch audit logs: ${errorMessage}`);
      setAuditLogs([]);
      setAuditTotalCount(0);
    } finally {
      setAuditLoading(false);
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

  // Show password dialog if not authenticated
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
                Admin Access Required
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Secure access to administration panel
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
            This is the admin panel for ShopGauge. Please enter the admin password to continue.
      </Typography>

          {isLocked && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              <Typography variant="body2" fontWeight="500" sx={{ mb: 0.5 }}>
                Account Temporarily Locked
        </Typography>
              <Typography variant="body2">
                Too many failed attempts. Try again in {Math.ceil((lockoutEnd - Date.now()) / 1000 / 60)} minutes.
              </Typography>
            </Alert>
          )}
          
          <TextField
            fullWidth
            type="password"
            label="Admin Password"
            placeholder="Enter admin password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={!!passwordError}
            helperText={passwordError || (attemptCount > 0 && !isLocked ? `${MAX_ATTEMPTS - attemptCount} attempts remaining` : 'Password must be at least 8 characters')}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isLocked) {
                handlePasswordSubmit();
              }
            }}
            disabled={isLocked}
            autoFocus={!isLocked}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              }
            }}
          />
          
          <Paper sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 500, mb: 1 }}>
              🔒 Security Information
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div">
              • Sessions expire after 2 hours of inactivity<br/>
              • Account locks after 5 failed attempts for 15 minutes<br/>
              • All admin actions are logged for security audit
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={handlePasswordSubmit}
            variant="contained"
            disabled={!password || isLocked || password.length < 8}
            fullWidth
            size="large"
            sx={{ 
              borderRadius: 2,
              py: 1.5,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {isLocked ? 'Account Locked' : 'Access Admin Panel'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <>
    <AdminContainer>
      {/* Main Content */}
      <SectionCard elevation={0}>
        {/* Section Header */}
        <SectionHeader>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={2}>
              <AssessmentIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              <Box>
                <Typography variant="h5" fontWeight="600">
                  Admin Dashboard - Audit Logs & Compliance
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Monitor system access and compliance activities
                </Typography>
        </Box>
            </Box>
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  fetchAuditLogs();
                  if (auditLogType === 'active') {
                    fetchActiveShops();
                  } else if (auditLogType === 'deleted') {
                    fetchDeletedShops();
                  }
                }}
                disabled={auditLoading || activeShopsLoading || deletedShopsLoading}
                sx={{ borderRadius: 2 }}
              >
                {auditLoading || activeShopsLoading || deletedShopsLoading ? 'Loading...' : 'Refresh'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<LogoutIcon />}
                onClick={() => {
                  setIsAuthenticated(false);
                  setIsPasswordDialogOpen(true);
                  setPassword('');
                  setSessionExpiry(0);
                  localStorage.removeItem('admin_session_expiry');
                  showSuccess('Admin session ended securely');
                  
                  // Always redirect to home page when logging out of admin
                  navigate('/');
                }}
                sx={{ borderRadius: 2 }}
              >
                Logout Admin
              </Button>
            </Stack>
          </Stack>
        </SectionHeader>

        <Box sx={{ p: 3 }}>
          {/* Tabs */}
          <TabsContainer>
            <Tabs 
              value={auditLogType} 
              onChange={(_, newValue) => setAuditLogType(newValue)}
              sx={{ 
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '0.95rem',
                }
              }}
            >
              <Tab 
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <DashboardIcon fontSize="small" />
                    All Logs
                    <Chip label={auditTotalCount} size="small" color="primary" />
                  </Box>
                } 
                value="all" 
              />
              <Tab 
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <DeleteIcon fontSize="small" />
                    Deleted Shops
                    <Chip label={deletedShops.length} size="small" color="error" />
                  </Box>
                } 
                value="deleted" 
              />
              <Tab 
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <StorefrontIcon fontSize="small" />
                    Active Shops
                    <Chip label={activeShops.length} size="small" color="success" />
                  </Box>
                } 
                value="active" 
              />
              <Tab 
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <MonitorHeartIcon fontSize="small" />
                    Transaction Monitoring
                  </Box>
                } 
                value="monitoring" 
              />
            </Tabs>
          </TabsContainer>

          {/* Enhanced Health Summary - Only show for non-monitoring tabs */}
          {auditLogType !== 'monitoring' && <EnhancedHealthSummary />}

          {/* Session Statistics Card */}
          {sessionStats && auditLogType === 'active' && (
            <Paper sx={{ p: 3, mb: 3, borderRadius: 3, bgcolor: 'grey.50' }}>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssessmentIcon color="primary" />
                Multi-Session Statistics
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 3 }}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'white', borderRadius: 2 }}>
                  <Typography variant="h4" color="primary.main" fontWeight="bold">
                    {sessionStats.currentlyActiveSessions || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Sessions
                  </Typography>
      </Paper>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'white', borderRadius: 2 }}>
                  <Typography variant="h4" color="secondary.main" fontWeight="bold">
                    {sessionStats.shopsWithMultipleSessions || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Multi-Session Shops
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'white', borderRadius: 2 }}>
                  <Typography variant="h4" color="success.main" fontWeight="bold">
                    {sessionStats.averageSessionsPerShop || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg Sessions/Shop
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'white', borderRadius: 2 }}>
                  <Typography variant="h4" color="info.main" fontWeight="bold">
                    {sessionStats.sessionsActiveLastDay || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Last 24h
                  </Typography>
                </Paper>
              </Box>
            </Paper>
          )}

          {/* Search and Filter Controls */}
          {auditLogType !== 'active' && auditLogType !== 'monitoring' && (
            <FilterContainer elevation={0}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Filter by Category</InputLabel>
                  <Select
                    value={auditCategoryFilter}
                    onChange={(e) => setAuditCategoryFilter(e.target.value)}
                    label="Filter by Category"
                    sx={{ 
                      borderRadius: 2,
                      bgcolor: 'white'
                    }}
                  >
                    <MenuItem value="all">
                      <Box display="flex" alignItems="center" gap={1}>
                        <FilterIcon fontSize="small" />
                        All Categories
                      </Box>
                    </MenuItem>
                    {uniqueCategories.map(category => (
                      <MenuItem key={category} value={category}>
                        <Box display="flex" alignItems="center" gap={1}>
                          {actionCategories[category as keyof typeof actionCategories]?.icon}
                          {actionCategories[category as keyof typeof actionCategories]?.label || category}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <TextField
                  label="Search logs..."
                  placeholder="Search by action, details, shop, or IP address"
                  value={auditSearchTerm}
                  onChange={(e) => setAuditSearchTerm(e.target.value)}
                  size="small"
                  sx={{ 
                    flex: 1,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: 'white'
                    }
                  }}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                  }}
                />
                
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Filter by Action</InputLabel>
                  <Select
                    value={auditActionFilter}
                    onChange={(e) => setAuditActionFilter(e.target.value)}
                    label="Filter by Action"
                    sx={{ 
                      borderRadius: 2,
                      bgcolor: 'white'
                    }}
                  >
                    <MenuItem value="all">
                      <Box display="flex" alignItems="center" gap={1}>
                        <FilterIcon fontSize="small" />
                        All Actions
                      </Box>
                    </MenuItem>
                    {uniqueActions.map(action => (
                      <MenuItem key={action} value={action}>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getActionIcon(action)}
                          {action}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </FilterContainer>
          )}

          {/* Results Summary */}
          {!auditLoading && !auditError && auditLogType !== 'active' && auditLogType !== 'monitoring' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Showing {filteredAuditLogs.length} of {auditTotalCount} total audit logs
                {auditSearchTerm && ` (filtered by "${auditSearchTerm}")`}
                {auditCategoryFilter !== 'all' && ` (category: ${actionCategories[auditCategoryFilter as keyof typeof actionCategories]?.label || auditCategoryFilter})`}
                {auditActionFilter !== 'all' && ` (action: ${auditActionFilter})`}
              </Typography>
            </Box>
          )}

          {/* Active Shops Table - Following All Logs Style */}
          {auditLogType === 'active' && (
            <>
              {activeShopsLoading ? (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  py: 8 
                }}>
                  <CircularProgress size={48} />
                  <Typography variant="body1" sx={{ mt: 2, color: 'text.secondary' }}>
                    Loading active shops...
                  </Typography>
                </Box>
              ) : activeShopsError ? (
                <Alert 
                  severity="error" 
                  sx={{ 
                    mb: 2, 
                    borderRadius: 2,
                    '& .MuiAlert-message': {
                      fontSize: '0.95rem'
                    }
                  }}
                  action={
                    <Button color="inherit" size="small" onClick={fetchActiveShops}>
                      Try Again
                    </Button>
                  }
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Unable to Load Active Shops
                  </Typography>
                  {activeShopsError}
                </Alert>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Showing {activeShops.length} active shops
                  </Typography>
                  
                  <TableContainer sx={{ borderRadius: 2, border: '1px solid #e0e0e0' }}>
                    <StyledTable size="small">
          <TableHead>
            <TableRow>
                          <TableCell>Timestamp</TableCell>
                          <TableCell>Shop Domain</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell>Details</TableCell>
                          <TableCell>IP Address</TableCell>
                          <TableCell>Device Info</TableCell>
                          <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
                        {activeShops.map((shop, index) => (
                          <TableRow 
                            key={`${shop.shopDomain}-${index}`}
                            hover
                            sx={{ 
                              '&:hover': { bgcolor: 'grey.50' },
                              borderLeft: `4px solid #16a34a20`
                            }}
                          >
                <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                <Typography variant="body2" sx={{ 
                                  fontFamily: 'monospace', 
                                  fontSize: '0.8rem',
                                  color: 'text.secondary'
                                }}>
                                  {shop.lastActivity ? new Date(shop.lastActivity).toLocaleString('en-US', {
                                    month: 'short',
                                    day: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                  }) : 'Unknown'}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <StoreIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {shop.shopDomain}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label="Shop Operations"
                                size="small"
                                sx={{
                                  bgcolor: '#e1f5fe',
                                  color: '#0288d1',
                                  border: `1px solid #0288d130`,
                                  fontWeight: 500,
                                  '& .MuiChip-icon': {
                                    color: '#0288d1'
                                  }
                                }}
                                icon={<StoreIcon />}
                              />
                            </TableCell>
                            <TableCell sx={{ maxWidth: 350 }}>
                              <Tooltip title={`Active session for ${shop.shopDomain} - Last activity: ${shop.lastActivity}${shop.activeSessionCount ? ` - ${shop.activeSessionCount} active sessions` : ''}`} arrow>
                                <Typography variant="body2" sx={{ 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: 300
                                }}>
                                  {shop.activeSessionCount && shop.activeSessionCount > 1 
                                    ? `${shop.activeSessionCount} Active Sessions` 
                                    : `Active session`} - {shop.sessionId || 'N/A'}
                                  {shop.source && (
                                    <Chip 
                                      label={shop.source === 'database_sessions' ? 'DB' : shop.source === 'audit_and_sessions' ? 'AUD+DB' : 'AUD'}
                                      size="small" 
                                      sx={{ 
                                        ml: 1, 
                                        height: 16, 
                                        fontSize: '0.7rem',
                                        bgcolor: shop.source === 'database_sessions' ? '#e8f5e8' : shop.source === 'audit_and_sessions' ? '#fff3e0' : '#e3f2fd',
                                        color: shop.source === 'database_sessions' ? '#2e7d32' : shop.source === 'audit_and_sessions' ? '#f57c00' : '#1976d2'
                                      }}
                                    />
                                  )}
                                </Typography>
                              </Tooltip>
                </TableCell>
                <TableCell>
                              <Typography variant="body2" sx={{ 
                                fontFamily: 'monospace', 
                                fontSize: '0.8rem',
                                color: 'text.secondary'
                              }}>
                                {shop.ipAddress || 'N/A'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <DeviceIcon userAgent={shop.userAgent || ''} />
                                <Box>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                    {getDeviceType(shop.userAgent || '')}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {getBrowserInfo(shop.userAgent || '')}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 1,
                                p: 1,
                                borderRadius: 1,
                                bgcolor: '#e8f5e8',
                                border: `1px solid #2e7d3230`
                              }}>
                                <CheckCircleIcon fontSize="small" sx={{ color: '#2e7d32' }} />
                                <Typography variant="body2" sx={{ 
                                  fontFamily: 'monospace', 
                                  fontSize: '0.8rem',
                                  fontWeight: 500,
                                  color: '#2e7d32'
                                }}>
                                  ACTIVE
                                </Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                        {activeShops.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} sx={{ textAlign: 'center', py: 8 }}>
                              <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                                <GroupIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                                <Typography variant="h6" color="text.secondary">
                                  No active shops found
                                </Typography>
                                <Typography variant="body2" color="text.disabled">
                                  No shops are currently active or connected
                                </Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </StyledTable>
                  </TableContainer>
                </>
              )}
            </>
          )}

          {/* Deleted Shops Table - Following All Logs Style */}
          {auditLogType === 'deleted' && (
            <>
              {deletedShopsLoading ? (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  py: 8 
                }}>
                  <CircularProgress size={48} />
                  <Typography variant="body1" sx={{ mt: 2, color: 'text.secondary' }}>
                    Loading deleted shops...
                  </Typography>
                </Box>
              ) : deletedShopsError ? (
                <Alert 
                  severity="error" 
                  sx={{ 
                    mb: 2, 
                    borderRadius: 2,
                    '& .MuiAlert-message': {
                      fontSize: '0.95rem'
                    }
                  }}
                  action={
                    <Button color="inherit" size="small" onClick={fetchDeletedShops}>
                      Try Again
                    </Button>
                  }
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Unable to Load Deleted Shops
                  </Typography>
                  {deletedShopsError}
                </Alert>
                  ) : (
                    <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Showing {deletedShops.length} deleted shops
                  </Typography>
                  
                  <TableContainer sx={{ borderRadius: 2, border: '1px solid #e0e0e0' }}>
                    <StyledTable size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Timestamp</TableCell>
                          <TableCell>Shop Domain</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell>Details</TableCell>
                          <TableCell>IP Address</TableCell>
                          <TableCell>Device Info</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {deletedShops.map((shop, index) => (
                          <TableRow 
                            key={`${shop.shopDomain}-${index}`}
                            hover
                            sx={{ 
                              '&:hover': { bgcolor: 'grey.50' },
                              borderLeft: `4px solid #d32f2f20`
                            }}
                          >
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                <Typography variant="body2" sx={{ 
                                  fontFamily: 'monospace', 
                                  fontSize: '0.8rem',
                                  color: 'text.secondary'
                                }}>
                                  {shop.lastActivity ? new Date(shop.lastActivity).toLocaleString('en-US', {
                                    month: 'short',
                                    day: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                  }) : 'Unknown'}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <StoreIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {shop.shopDomain || 'Unknown Domain'}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label="Data Deletion"
                                size="small"
                                sx={{
                                  bgcolor: '#ffebee',
                                  color: '#d32f2f',
                                  border: `1px solid #d32f2f30`,
                                  fontWeight: 500,
                                  '& .MuiChip-icon': {
                                    color: '#d32f2f'
                                  }
                                }}
                                icon={<DeleteIcon />}
                              />
                            </TableCell>
                            <TableCell sx={{ maxWidth: 350 }}>
                              <Tooltip title={shop.details || `Shop ${shop.shopDomain} has been deleted`} arrow>
                                <Typography variant="body2" sx={{ 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: 300
                                }}>
                                  {shop.details || `Shop deletion - ${shop.sessionId}`}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ 
                                fontFamily: 'monospace', 
                                fontSize: '0.8rem',
                                color: 'text.secondary'
                              }}>
                                {shop.ipAddress || 'N/A'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <DeviceIcon userAgent={shop.userAgent || ''} />
                                <Box>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                    {getDeviceType(shop.userAgent || '')}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {getBrowserInfo(shop.userAgent || '')}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 1,
                                p: 1,
                                borderRadius: 1,
                                bgcolor: '#ffebee',
                                border: `1px solid #d32f2f30`
                              }}>
                                <DeleteIcon fontSize="small" sx={{ color: '#d32f2f' }} />
                                <Typography variant="body2" sx={{ 
                                  fontFamily: 'monospace', 
                                  fontSize: '0.8rem',
                                  fontWeight: 500,
                                  color: '#d32f2f'
                                }}>
                                  {shop.action || 'DELETED'}
                                </Typography>
                              </Box>
                </TableCell>
              </TableRow>
            ))}
                        {deletedShops.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} sx={{ textAlign: 'center', py: 8 }}>
                              <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                                <DeleteIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                                <Typography variant="h6" color="text.secondary">
                                  No deleted shops found
                                </Typography>
                                <Typography variant="body2" color="text.disabled">
                                  No shops have been deleted or domain extraction failed
                                </Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
          </TableBody>
                    </StyledTable>
      </TableContainer>
                </>
              )}
            </>
          )}

          {/* Audit Logs Table - Only shown for 'all' type */}
          {auditLogType === 'all' && (
            <>
              {auditLoading ? (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  py: 8 
                }}>
                  <CircularProgress size={48} />
                  <Typography variant="body1" sx={{ mt: 2, color: 'text.secondary' }}>
                    Loading audit logs...
                  </Typography>
                </Box>
              ) : auditError ? (
                <Alert 
                  severity="error" 
                  sx={{ 
                    mb: 2, 
                    borderRadius: 2,
                    '& .MuiAlert-message': {
                      fontSize: '0.95rem'
                    }
                  }}
                  action={
                    <Button color="inherit" size="small" onClick={fetchAuditLogs}>
                      Try Again
                    </Button>
                  }
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Unable to Load Audit Logs
                  </Typography>
                  {auditError}
        </Alert>
              ) : (
                <>
                  <TableContainer sx={{ borderRadius: 2, border: '1px solid #e0e0e0' }}>
                    <StyledTable size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Timestamp</TableCell>
                          <TableCell>Shop Domain</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell>Details</TableCell>
                          <TableCell>IP Address</TableCell>
                          <TableCell>Device Info</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredAuditLogs.map((log, index) => (
                          <TableRow 
                            key={log.id} 
                            hover
                            onDoubleClick={() => {
                              if (log.details && log.details.includes('->')) {
                                const [before, after] = log.details.split('->');
                                setDiffBefore(before.trim());
                                setDiffAfter(after.trim());
                                setDiffOpen(true);
                              }
                            }}
                            sx={{ 
                              '&:hover': { bgcolor: 'grey.50' },
                              borderLeft: `4px solid ${getActionColor(log.action)}20`
                            }}
                          >
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                <Typography variant="body2" sx={{ 
                                  fontFamily: 'monospace', 
                                  fontSize: '0.8rem',
                                  color: 'text.secondary'
                                }}>
                                  {new Date(log.timestamp).toLocaleString('en-US', {
                                    month: 'short',
                                    day: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                  })}
                                </Typography>
    </Box>
                            </TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <StoreIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {log.shopDomain || 'System'}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={actionCategories[getActionCategory(log.action) as keyof typeof actionCategories]?.label || 'Other'}
                                size="small"
                                sx={{
                                  bgcolor: getActionBgColor(log.action),
                                  color: getActionColor(log.action),
                                  border: `1px solid ${getActionColor(log.action)}30`,
                                  fontWeight: 500,
                                  '& .MuiChip-icon': {
                                    color: getActionColor(log.action)
                                  }
                                }}
                                icon={getActionIcon(log.action)}
                              />
                            </TableCell>
                            <TableCell sx={{ maxWidth: 350 }}>
                              <Tooltip title={log.details} arrow>
                                <Typography variant="body2" sx={{ 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: 300
                                }}>
                                  {log.details}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ 
                                fontFamily: 'monospace', 
                                fontSize: '0.8rem',
                                color: 'text.secondary'
                              }}>
                                {log.ipAddress || 'N/A'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <DeviceIcon userAgent={log.userAgent || ''} />
                                <Box>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                    {getDeviceType(log.userAgent || '')}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {getBrowserInfo(log.userAgent || '')}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 1,
                                p: 1,
                                borderRadius: 1,
                                bgcolor: getActionBgColor(log.action),
                                border: `1px solid ${getActionColor(log.action)}30`
                              }}>
                                {getActionIcon(log.action)}
                                <Typography variant="body2" sx={{ 
                                  fontFamily: 'monospace', 
                                  fontSize: '0.8rem',
                                  fontWeight: 500,
                                  color: getActionColor(log.action)
                                }}>
                                  {log.action}
                                </Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredAuditLogs.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} sx={{ textAlign: 'center', py: 8 }}>
                              <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                                <InfoIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                                <Typography variant="h6" color="text.secondary">
                                  No audit logs found
                                </Typography>
                                <Typography variant="body2" color="text.disabled">
                                  {auditSearchTerm || auditActionFilter !== 'all' 
                                    ? 'Try adjusting your search or filter criteria'
                                    : 'No audit logs are available for the selected view'
                                  }
                                </Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </StyledTable>
                  </TableContainer>

                  {filteredAuditLogs.length > 0 && (
                    <TablePagination
                      component="div"
                      count={auditTotalCount}
                      page={auditPage}
                      onPageChange={(_, newPage) => setAuditPage(newPage)}
                      rowsPerPage={auditRowsPerPage}
                      onRowsPerPageChange={(e) => {
                        setAuditRowsPerPage(parseInt(e.target.value, 10));
                        setAuditPage(0);
                      }}
                      rowsPerPageOptions={[10, 25, 50, 100]}
                      sx={{
                        mt: 2,
                        borderTop: '1px solid #e0e0e0',
                        '& .MuiTablePagination-toolbar': {
                          px: 2
                        }
                      }}
                    />
                  )}
                </>
              )}
            </>
          )}

          {/* Transaction Monitoring Tab */}
          {auditLogType === 'monitoring' && (
            <TransactionMonitoring />
          )}
        </Box>
      </SectionCard>
    </AdminContainer>
    <DiffViewerDialog open={diffOpen} onClose={() => setDiffOpen(false)} before={diffBefore} after={diffAfter} />
    </>
  );
};

export default AdminPage; 