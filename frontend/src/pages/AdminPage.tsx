import React, { useState, useEffect } from 'react';
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
} from '@mui/icons-material';
import { fetchWithAuth } from '../api';
import { useAuth } from '../contexts/AuthContext';

interface Secret {
  key: string;
  value: string;
}

interface AuditLog {
  id: number;
  shopId: number | null;
  action: string;
  details: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
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

const AdminPage: React.FC = () => {
  const { shop } = useAuth();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sendGridStatus, setSendGridStatus] = useState<'enabled' | 'disabled' | 'unknown'>('unknown');
  const [twilioStatus, setTwilioStatus] = useState<'enabled' | 'disabled' | 'unknown'>('unknown');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(0);
  const [auditRowsPerPage, setAuditRowsPerPage] = useState(25);
  const [auditTotalCount, setAuditTotalCount] = useState(0);
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditLogType, setAuditLogType] = useState<'active' | 'deleted' | 'all'>('active');

  // Action categories for audit logs
  const actionCategories = {
    'DATA_ACCESS': { label: 'Data Access', color: 'primary', icon: <VisibilityIcon /> },
    'DATA_DELETION': { label: 'Data Deletion', color: 'error', icon: <DeleteIcon /> },
    'AUTHENTICATION': { label: 'Authentication', color: 'warning', icon: <SecurityIcon /> },
    'COMPLIANCE': { label: 'Compliance', color: 'success', icon: <CheckCircleIcon /> },
    'SHOP_OPERATIONS': { label: 'Shop Operations', color: 'info', icon: <StoreIcon /> },
    'SYSTEM': { label: 'System', color: 'default', icon: <SettingsIcon /> },
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
    return actionCategories[category as keyof typeof actionCategories]?.color || 'default';
  };

  const getActionIcon = (action: string) => {
    const category = getActionCategory(action);
    return actionCategories[category as keyof typeof actionCategories]?.icon || <InfoIcon />;
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    setAuditError(null);
    
    try {
      let endpoint = '';
      switch (auditLogType) {
        case 'active':
          endpoint = `/api/analytics/audit-logs?page=${auditPage}&size=${auditRowsPerPage}`;
          break;
        case 'deleted':
          endpoint = `/api/admin/audit-logs/deleted-shops?page=${auditPage}&size=${auditRowsPerPage}`;
          break;
        case 'all':
          endpoint = `/api/admin/audit-logs/all?page=${auditPage}&size=${auditRowsPerPage}`;
          break;
      }

      const response = await fetchWithAuth(endpoint);
      const data: AuditLogsResponse = await response.json();
      
      setAuditLogs(data.audit_logs);
      setAuditTotalCount(data.total_count);
    } catch (err) {
      setAuditError('Failed to fetch audit logs');
      console.error('Error fetching audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleAuditPageChange = (event: unknown, newPage: number) => {
    setAuditPage(newPage);
  };

  const handleAuditRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAuditRowsPerPage(parseInt(event.target.value, 10));
    setAuditPage(0);
  };

  const handleAuditTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setAuditLogType(['active', 'deleted', 'all'][newValue] as 'active' | 'deleted' | 'all');
    setAuditPage(0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getShopStatus = (shopId: number | null) => {
    if (shopId === null) {
      return { label: 'Deleted Shop', color: 'error' as const };
    }
    return { label: 'Active Shop', color: 'success' as const };
  };

  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesSearch = auditSearchTerm === '' || 
      log.action.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
      (log.ipAddress && log.ipAddress.toLowerCase().includes(auditSearchTerm.toLowerCase()));
    
    const matchesAction = auditActionFilter === 'all' || log.action === auditActionFilter;
    
    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set(auditLogs.map(log => log.action))).sort();

  const fetchSecrets = async () => {
    try {
      const response = await fetchWithAuth('/api/admin/secrets');
      const data = await response.json();
      setSecrets(data);
    } catch (err) {
      setError('Failed to fetch secrets');
    }
  };

  const fetchIntegrationStatus = async () => {
    try {
      const resp = await fetchWithAuth('/api/admin/integrations/status');
      const data = await resp.json();
      setSendGridStatus(data.sendGridEnabled ? 'enabled' : 'disabled');
      setTwilioStatus(data.twilioEnabled ? 'enabled' : 'disabled');
    } catch {
      setSendGridStatus('unknown');
      setTwilioStatus('unknown');
    }
  };

  useEffect(() => {
    if (!shop) {
      setSecrets([]);
      setNewKey('');
      setNewValue('');
      setEditingKey(null);
      setError(null);
      setSuccess(null);
      setTestEmail('');
      setTestPhone('');
      setAlert(null);
      setSendGridStatus('unknown');
      setTwilioStatus('unknown');
      setShowAddForm(false);
      setAuditLogs([]);
      setAuditLoading(false);
      setAuditError(null);
      setAuditPage(0);
      setAuditRowsPerPage(25);
      setAuditTotalCount(0);
      setAuditSearchTerm('');
      setAuditActionFilter('all');
      setAuditLogType('active');
      return;
    }
    fetchSecrets();
    fetchIntegrationStatus();
  }, [shop]);

  // Fetch audit logs when pagination or log type changes
  useEffect(() => {
    if (shop) { // Fetch audit logs when shop is available
      fetchAuditLogs();
    }
  }, [auditPage, auditRowsPerPage, auditLogType, shop]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      setSecrets([]);
      setNewKey('');
      setNewValue('');
      setEditingKey(null);
      setError(null);
      setSuccess(null);
      setTestEmail('');
      setTestPhone('');
      setAlert(null);
      setSendGridStatus('unknown');
      setTwilioStatus('unknown');
      setShowAddForm(false);
      setAuditLogs([]);
      setAuditLoading(false);
      setAuditError(null);
      setAuditPage(0);
      setAuditRowsPerPage(25);
      setAuditTotalCount(0);
      setAuditSearchTerm('');
      setAuditActionFilter('all');
      setAuditLogType('active');
    };
  }, []);

  const handleAddSecret = async () => {
    try {
      await fetchWithAuth('/api/admin/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newKey, value: newValue }),
      });
      setNewKey('');
      setNewValue('');
      setShowAddForm(false);
      setSuccess('Secret added successfully');
      fetchSecrets();
    } catch (err) {
      setError('Failed to add secret');
    }
  };

  const handleDeleteSecret = async (key: string) => {
    if (!confirm(`Are you sure you want to delete the secret "${key}"?`)) return;
    
    try {
      await fetchWithAuth(`/api/admin/secrets/${key}`, { method: 'DELETE' });
      setSuccess('Secret deleted successfully');
      fetchSecrets();
    } catch (err) {
      setError('Failed to delete secret');
    }
  };

  const handleEditSecret = async (key: string, value: string) => {
    try {
      await fetchWithAuth('/api/admin/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      setEditingKey(null);
      setSuccess('Secret updated successfully');
      fetchSecrets();
    } catch (err) {
      setError('Failed to update secret');
    }
  };

  const handleTestEmail = async () => {
    try {
      await fetchWithAuth('/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });
      setTestEmail('');
      setAlert({ type: 'success', message: 'Test email sent successfully!' });
    } catch (error) {
      setAlert({ type: 'error', message: 'Failed to send test email' });
    }
  };

  const handleTestSMS = async () => {
    try {
      await fetchWithAuth('/admin/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone }),
      });
      setTestPhone('');
      setAlert({ type: 'success', message: 'Test SMS sent successfully!' });
    } catch (error) {
      setAlert({ type: 'error', message: 'Failed to send test SMS' });
    }
  };

  // Group secrets by integration
  const integrationSecrets = Object.keys(INTEGRATION_CONFIG).map(key => ({
    key,
    ...INTEGRATION_CONFIG[key as keyof typeof INTEGRATION_CONFIG],
    value: secrets.find(s => s.key === key)?.value || '',
    exists: secrets.some(s => s.key === key)
  }));
  
  const otherSecrets = secrets.filter(s => !Object.keys(INTEGRATION_CONFIG).includes(s.key));

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Admin Dashboard
      </Typography>

      {/* Integration Secrets */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">🔑 Integration Secrets</Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setShowAddForm(!showAddForm)}
            size="small"
          >
            Add New Secret
          </Button>
        </Box>

        {showAddForm && (
          <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Add New Secret</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                <TextField
                  label="Secret Key"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="e.g., my.api.key"
                />
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                <TextField
                  label="Secret Value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  size="small"
                  fullWidth
                  type="password"
                  placeholder="Enter secret value"
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleAddSecret}
                  disabled={!newKey || !newValue}
                  size="small"
                >
                  Add
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewKey('');
                    setNewValue('');
                  }}
                  size="small"
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          </Card>
        )}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Integration</TableCell>
                <TableCell>Key</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {integrationSecrets.map((secret) => (
                <TableRow key={secret.key}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{secret.icon}</span>
                      <Typography variant="body2">{secret.label}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                      {secret.key}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {editingKey === secret.key ? (
                      <TextField
                        value={secret.value}
                        onChange={(e) => {
                          setSecrets(prev => prev.map(s => 
                            s.key === secret.key ? { ...s, value: e.target.value } : s
                          ));
                        }}
                        size="small"
                        type="password"
                        sx={{ minWidth: 200 }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {secret.exists ? '••••••••' : 'Not set'}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={secret.exists ? 'Configured' : 'Missing'} 
                      color={secret.exists ? 'success' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title={secret.help} placement="top">
                        <IconButton size="small">
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      
                      {editingKey === secret.key ? (
                        <>
                          <IconButton
                            onClick={() => handleEditSecret(secret.key, secret.value)}
                            color="primary"
                            size="small"
                          >
                            <SaveIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            onClick={() => setEditingKey(null)}
                            color="error"
                            size="small"
                          >
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </>
                      ) : (
                        <IconButton
                          onClick={() => setEditingKey(secret.key)}
                          color="primary"
                          size="small"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Integration Status Section (just chips, subtle) */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, color: 'text.secondary' }}>
          Integration Status
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Chip
            icon={<EmailIcon fontSize="small" />}
            label={`SendGrid: ${sendGridStatus === 'enabled' ? 'Enabled' : 'Disabled'}`}
            color={sendGridStatus === 'enabled' ? 'success' : 'error'}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<SmsIcon fontSize="small" />}
            label={`Twilio: ${twilioStatus === 'enabled' ? 'Enabled' : 'Disabled'}`}
            color={twilioStatus === 'enabled' ? 'success' : 'error'}
            size="small"
            variant="outlined"
          />
        </Box>
      </Box>

      {/* Other Secrets */}
      {otherSecrets.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            🔧 Other Secrets
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Key</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {otherSecrets.map((secret) => (
                  <TableRow key={secret.key}>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                        {secret.key}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {editingKey === secret.key ? (
                        <TextField
                          value={secret.value}
                          onChange={(e) => {
                            setSecrets(prev => prev.map(s => 
                              s.key === secret.key ? { ...s, value: e.target.value } : s
                            ));
                          }}
                          size="small"
                          type="password"
                          sx={{ minWidth: 200 }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          ••••••••
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {editingKey === secret.key ? (
                          <>
                            <IconButton
                              onClick={() => handleEditSecret(secret.key, secret.value)}
                              color="primary"
                              size="small"
                            >
                              <SaveIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              onClick={() => setEditingKey(null)}
                              color="error"
                              size="small"
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </>
                        ) : (
                          <>
                            <IconButton
                              onClick={() => setEditingKey(secret.key)}
                              color="primary"
                              size="small"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              onClick={() => handleDeleteSecret(secret.key)}
                              color="error"
                              size="small"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Audit Logs Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">🔍 Audit Logs</Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchAuditLogs}
            disabled={auditLoading}
            size="small"
          >
            Refresh
          </Button>
        </Box>

        {/* Log Type Tabs */}
        <Box sx={{ 
          borderBottom: 1, 
          borderColor: 'divider', 
          mb: 2,
          '& .MuiTabs-root': {
            minHeight: 'auto',
          },
          '& .MuiTab-root': {
            minHeight: 'auto',
            padding: '12px 20px',
            textTransform: 'none',
            fontWeight: 500,
            minWidth: 'auto',
          },
          '& .MuiTabs-scrollButtons': {
            width: 32,
            height: 40,
          },
          '& .MuiTabs-indicator': {
            height: 2,
          }
        }}>
          <Tabs 
            value={auditLogType === 'active' ? 0 : auditLogType === 'deleted' ? 1 : 2}
            onChange={(event, newValue) => {
              setAuditLogType(['active', 'deleted', 'all'][newValue] as 'active' | 'deleted' | 'all');
              setAuditPage(0);
            }}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 'fit-content' }}>
                  <StoreIcon fontSize="small" />
                  <Typography variant="body2">Active</Typography>
                  <Badge 
                    badgeContent={auditLogType === 'active' ? auditTotalCount : 0} 
                    color="primary" 
                    sx={{ 
                      '& .MuiBadge-badge': { 
                        fontSize: '0.7rem', 
                        height: '16px', 
                        minWidth: '16px',
                        right: -8,
                        top: 2
                      } 
                    }}
                  />
                </Box>
              } 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 'fit-content' }}>
                  <WarningIcon fontSize="small" />
                  <Typography variant="body2">Deleted</Typography>
                  <Badge 
                    badgeContent={auditLogType === 'deleted' ? auditTotalCount : 0} 
                    color="error" 
                    sx={{ 
                      '& .MuiBadge-badge': { 
                        fontSize: '0.7rem', 
                        height: '16px', 
                        minWidth: '16px',
                        right: -8,
                        top: 2
                      } 
                    }}
                  />
                </Box>
              } 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 'fit-content' }}>
                  <SecurityIcon fontSize="small" />
                  <Typography variant="body2">All</Typography>
                  <Badge 
                    badgeContent={auditLogType === 'all' ? auditTotalCount : 0} 
                    color="info" 
                    sx={{ 
                      '& .MuiBadge-badge': { 
                        fontSize: '0.7rem', 
                        height: '16px', 
                        minWidth: '16px',
                        right: -8,
                        top: 2
                      } 
                    }}
                  />
                </Box>
              } 
            />
          </Tabs>
        </Box>

        {/* Filters */}
        <Box sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: { xs: 1, sm: 2 }, 
          alignItems: 'center', 
          mb: 2,
          '& .MuiTextField-root, & .MuiFormControl-root': {
            minWidth: { xs: '100%', sm: 'auto' }
          }
        }}>
          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 400px' }, minWidth: 0 }}>
            <TextField
              fullWidth
              label="Search logs..."
              value={auditSearchTerm}
              onChange={(e) => setAuditSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              placeholder="Search by action, details, or IP address..."
              size="small"
            />
          </Box>
          <Box sx={{ flex: { xs: '1 1 100%', sm: '0 1 200px' }, minWidth: 0 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Action Filter</InputLabel>
              <Select
                value={auditActionFilter}
                label="Action Filter"
                onChange={(e) => setAuditActionFilter(e.target.value)}
              >
                <MenuItem value="all">All Actions</MenuItem>
                {uniqueActions.map(action => (
                  <MenuItem key={action} value={action}>{action}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ 
            flex: { xs: '1 1 100%', sm: '0 1 200px' }, 
            minWidth: 0,
            display: 'flex',
            justifyContent: { xs: 'center', sm: 'flex-start' }
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterIcon color="action" />
              <Typography variant="body2" color="text.secondary">
                {filteredAuditLogs.length} of {auditLogs.length} logs
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Error Alert */}
        {auditError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {auditError}
          </Alert>
        )}

        {/* Audit Logs Table */}
        <Box sx={{ 
          width: '100%', 
          overflowX: 'auto',
          border: '1px solid rgba(224, 224, 224, 1)',
          borderRadius: 1
        }}>
          <TableContainer sx={{ 
            maxHeight: 400,
            '& .MuiTable-root': {
              borderCollapse: 'collapse',
              minWidth: 1200, // Ensure table is wide enough
            },
            '& .MuiTableCell-root': {
              padding: { xs: '8px 4px', sm: '12px 8px', md: '16px' },
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              borderBottom: '1px solid rgba(224, 224, 224, 1)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            },
            '& .MuiTableHead-root .MuiTableCell-root': {
              fontWeight: 600,
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
              fontSize: { xs: '0.7rem', sm: '0.875rem' },
              padding: { xs: '6px 4px', sm: '10px 8px', md: '16px' },
              position: 'sticky',
              top: 0,
              zIndex: 1,
            },
            '& .MuiTableRow-root:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
            }
          }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: '150px' }}>Timestamp</TableCell>
                  <TableCell sx={{ minWidth: '200px' }}>Action</TableCell>
                  <TableCell sx={{ minWidth: '300px' }}>Details</TableCell>
                  <TableCell sx={{ minWidth: '150px' }}>Shop Status</TableCell>
                  <TableCell sx={{ 
                    minWidth: '150px',
                    display: { xs: 'none', md: 'table-cell' }
                  }}>IP Address</TableCell>
                  <TableCell sx={{ 
                    minWidth: '250px',
                    display: { xs: 'none', lg: 'table-cell' }
                  }}>User Agent</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <CircularProgress size={20} />
                    </TableCell>
                  </TableRow>
                ) : filteredAuditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary" variant="body2">
                        No audit logs found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAuditLogs.map((log) => {
                    const shopStatus = getShopStatus(log.shopId);
                    return (
                      <TableRow key={log.id} hover>
                        <TableCell sx={{ minWidth: '150px' }}>
                          <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}
                          >
                            {formatDate(log.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ minWidth: '200px' }}>
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: { xs: 0.5, sm: 1 },
                            minWidth: 0
                          }}>
                            <Box sx={{ display: { xs: 'none', sm: 'block' }, flexShrink: 0 }}>
                              {getActionIcon(log.action)}
                            </Box>
                            <Chip
                              label={log.action}
                              color={getActionColor(log.action) as any}
                              size="small"
                              variant="outlined"
                              sx={{ 
                                fontSize: { xs: '0.65rem', sm: '0.75rem' },
                                height: { xs: 20, sm: 24 },
                                '& .MuiChip-label': {
                                  padding: { xs: '0 6px', sm: '0 8px' },
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }
                              }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell sx={{ minWidth: '300px' }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontSize: { xs: '0.7rem', sm: '0.875rem' },
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {log.details}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ minWidth: '150px' }}>
                          <Chip
                            label={shopStatus.label}
                            color={shopStatus.color}
                            size="small"
                            icon={log.shopId === null ? <WarningIcon /> : <CheckCircleIcon />}
                            sx={{ 
                              fontSize: { xs: '0.65rem', sm: '0.75rem' },
                              height: { xs: 20, sm: 24 },
                              '& .MuiChip-label': {
                                padding: { xs: '0 6px', sm: '0 8px' }
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ 
                          minWidth: '150px',
                          display: { xs: 'none', md: 'table-cell' } 
                        }}>
                          <Typography 
                            variant="body2" 
                            fontFamily="monospace" 
                            sx={{ 
                              fontSize: { xs: '0.7rem', sm: '0.8rem' },
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {log.ipAddress || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ 
                          minWidth: '250px',
                          display: { xs: 'none', lg: 'table-cell' } 
                        }}>
                          <Tooltip title={log.userAgent || 'No user agent'}>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontSize: { xs: '0.7rem', sm: '0.875rem' }
                              }}
                            >
                              {log.userAgent || 'N/A'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
        
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={auditTotalCount}
          rowsPerPage={auditRowsPerPage}
          page={auditPage}
          onPageChange={handleAuditPageChange}
          onRowsPerPageChange={handleAuditRowsPerPageChange}
          sx={{
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
              fontSize: { xs: '0.75rem', sm: '0.875rem' }
            }
          }}
        />
      </Paper>

      {/* Snackbar for success/error */}
      <Snackbar
        open={!!error || !!success}
        autoHideDuration={4000}
        onClose={() => {
          setError(null);
          setSuccess(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {error ? (
          <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>
        ) : (
          <Alert severity="success" sx={{ width: '100%' }}>{success}</Alert>
        )}
      </Snackbar>
    </Box>
  );
};

export default AdminPage; 