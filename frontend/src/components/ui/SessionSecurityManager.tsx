import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Alert,
  Chip,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider,
  Badge
} from '@mui/material';
import RefreshHeader from './RefreshHeader';
import {
  Security as SecurityIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Block as BlockIcon,
  VpnKey as VpnKeyIcon,
  Visibility as VisibilityIcon,
  RotateRight as RotateRightIcon,
  Delete as DeleteIcon,
  Computer as ComputerIcon,
  Schedule as ScheduleIcon,
  Shield as ShieldIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const SecurityCard = styled(Card)(({ theme }) => ({
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

interface SessionSecurityStatus {
  session_found: boolean;
  session_id: string;
  shop_domain: string;
  is_valid: boolean;
  violations: Record<string, string>;
  warnings: Record<string, string>;
  requires_reauthentication: boolean;
  requires_token_rotation: boolean;
  session_metadata: {
    created_at: string;
    last_activity: string;
    expires_at: string;
    ip_address: string;
    is_active: boolean;
    is_expired: boolean;
  };
}

interface ShopSecurityOverview {
  shop_domain: string;
  total_active_sessions: number;
  valid_sessions: number;
  sessions_with_violations: number;
  sessions_with_warnings: number;
  sessions_needing_rotation: number;
  security_score: number;
}

const SessionSecurityManager: React.FC = () => {
  const [selectedShop, setSelectedShop] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [sessionStatus, setSessionStatus] = useState<SessionSecurityStatus | null>(null);
  const [shopOverview, setShopOverview] = useState<ShopSecurityOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog states
  const [invalidateDialogOpen, setInvalidateDialogOpen] = useState(false);
  const [suspiciousDialogOpen, setSuspiciousDialogOpen] = useState(false);
  const [invalidateReason, setInvalidateReason] = useState('');
  const [suspiciousReason, setSuspiciousReason] = useState('');

  const fetchSessionStatus = async () => {
    if (!selectedShop || !selectedSession) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/admin/session-security/session/${selectedShop}/${selectedSession}/status`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch session status');
      }
      
      const data = await response.json();
      setSessionStatus(data);
    } catch (err) {
      console.error('Error fetching session status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch session status');
    } finally {
      setLoading(false);
    }
  };

  const fetchShopOverview = async () => {
    if (!selectedShop) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/admin/session-security/shop/${selectedShop}/overview`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch shop overview');
      }
      
      const data = await response.json();
      setShopOverview(data);
    } catch (err) {
      console.error('Error fetching shop overview:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch shop overview');
    } finally {
      setLoading(false);
    }
  };

  const handleForceInvalidate = async () => {
    if (!selectedShop || !selectedSession || !invalidateReason.trim()) return;
    
    try {
      const response = await fetch(
        `/api/admin/session-security/session/${selectedShop}/${selectedSession}/force-invalidate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: invalidateReason })
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to invalidate session');
      }
      
      setInvalidateDialogOpen(false);
      setInvalidateReason('');
      await fetchSessionStatus();
    } catch (err) {
      console.error('Error invalidating session:', err);
      setError(err instanceof Error ? err.message : 'Failed to invalidate session');
    }
  };

  const handleMarkSuspicious = async () => {
    if (!selectedShop || !selectedSession || !suspiciousReason.trim()) return;
    
    try {
      const response = await fetch(
        `/api/admin/session-security/session/${selectedShop}/${selectedSession}/mark-suspicious`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: suspiciousReason })
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to mark session as suspicious');
      }
      
      setSuspiciousDialogOpen(false);
      setSuspiciousReason('');
      await fetchSessionStatus();
    } catch (err) {
      console.error('Error marking session as suspicious:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark session as suspicious');
    }
  };

  const handleRotateToken = async () => {
    if (!selectedShop || !selectedSession) return;
    
    try {
      const response = await fetch(
        `/api/admin/session-security/session/${selectedShop}/${selectedSession}/rotate-token`,
        { method: 'POST' }
      );
      
      if (!response.ok) {
        throw new Error('Failed to rotate token');
      }
      
      await fetchSessionStatus();
    } catch (err) {
      console.error('Error rotating token:', err);
      setError(err instanceof Error ? err.message : 'Failed to rotate token');
    }
  };

  const getSecurityScoreColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 75) return 'info';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center">
          <ShieldIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
          <Typography variant="h4" component="h1">
            Session Security Manager
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Shop and Session Selection */}
      <SecurityCard sx={{ mb: 3 }}>
        <CardHeader title="Session Selection" />
        <CardContent>
          <Box display="flex" flexWrap="wrap" gap={3}>
            <Box flex="1" minWidth="300px">
              <TextField
                fullWidth
                label="Shop Domain"
                value={selectedShop}
                onChange={(e) => setSelectedShop(e.target.value)}
                placeholder="example.myshopify.com"
                helperText="Enter the shop domain to analyze"
              />
            </Box>
            <Box flex="1" minWidth="300px">
              <TextField
                fullWidth
                label="Session ID"
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                placeholder="session-id-here"
                helperText="Enter specific session ID (optional)"
              />
            </Box>
            <Box flex="1" minWidth="300px">
              <Stack spacing={2} direction="row">
                <Button
                  variant="contained"
                  onClick={fetchSessionStatus}
                  disabled={!selectedShop || !selectedSession || loading}
                  startIcon={loading ? <CircularProgress size={16} /> : <VisibilityIcon />}
                >
                  Check Session
                </Button>
                <Button
                  variant="outlined"
                  onClick={fetchShopOverview}
                  disabled={!selectedShop || loading}
                  startIcon={loading ? <CircularProgress size={16} /> : <SecurityIcon />}
                >
                  Shop Overview
                </Button>
              </Stack>
            </Box>
          </Box>
        </CardContent>
      </SecurityCard>

      {/* Shop Security Overview */}
      {shopOverview && (
        <SecurityCard sx={{ mb: 3 }}>
          <CardHeader 
            title={`Security Overview - ${shopOverview.shop_domain}`}
            avatar={<SecurityIcon color="primary" />}
          />
          <CardContent>
            <Box display="flex" flexWrap="wrap" gap={3}>
              <Box flex="1" minWidth="150px" textAlign="center">
                <Typography variant="h4" color="primary.main">
                  {shopOverview.total_active_sessions}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Sessions
                </Typography>
              </Box>
              <Box flex="1" minWidth="150px" textAlign="center">
                <Typography variant="h4" color="success.main">
                  {shopOverview.valid_sessions}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Valid Sessions
                </Typography>
              </Box>
              <Box flex="1" minWidth="150px" textAlign="center">
                <Typography variant="h4" color="error.main">
                  {shopOverview.sessions_with_violations}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  With Violations
                </Typography>
              </Box>
              <Box flex="1" minWidth="150px" textAlign="center">
                <Typography variant="h4" color="warning.main">
                  {shopOverview.sessions_with_warnings}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  With Warnings
                </Typography>
              </Box>
              <Box flex="1" minWidth="150px" textAlign="center">
                <Typography variant="h4" color="info.main">
                  {shopOverview.sessions_needing_rotation}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Need Rotation
                </Typography>
              </Box>
              <Box flex="1" minWidth="150px" textAlign="center">
                <Chip
                  label={`${Math.round(shopOverview.security_score)}%`}
                  color={getSecurityScoreColor(shopOverview.security_score) as any}
                  size="medium"
                  sx={{ fontSize: '1.2rem', fontWeight: 600 }}
                />
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  Security Score
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </SecurityCard>
      )}

      {/* Session Security Status */}
      {sessionStatus && (
        <SecurityCard>
          <CardHeader 
            title={`Session Security Status - ${sessionStatus.session_id}`}
            avatar={
              <Badge 
                badgeContent={Object.keys(sessionStatus.violations).length + Object.keys(sessionStatus.warnings).length}
                color="error"
              >
                <SecurityIcon color="primary" />
              </Badge>
            }
            action={
              <Stack direction="row" spacing={1}>
                <Tooltip title="Rotate Token">
                  <IconButton 
                    onClick={handleRotateToken}
                    disabled={!sessionStatus.session_found}
                  >
                    <RotateRightIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Mark Suspicious">
                  <IconButton 
                    onClick={() => setSuspiciousDialogOpen(true)}
                    disabled={!sessionStatus.session_found}
                  >
                    <WarningIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Force Invalidate">
                  <IconButton 
                    onClick={() => setInvalidateDialogOpen(true)}
                    disabled={!sessionStatus.session_found}
                    color="error"
                  >
                    <BlockIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            }
          />
          <CardContent>
            {!sessionStatus.session_found ? (
              <Alert severity="warning">
                Session not found or has been invalidated
              </Alert>
            ) : (
              <Box display="flex" flexWrap="wrap" gap={3}>
                {/* Session Status */}
                <Box flex="1" minWidth="400px">
                  <Typography variant="h6" gutterBottom>Session Status</Typography>
                  <Stack spacing={2}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography>Valid:</Typography>
                      <Chip 
                        label={sessionStatus.is_valid ? 'Yes' : 'No'}
                        color={sessionStatus.is_valid ? 'success' : 'error'}
                        size="small"
                      />
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography>Active:</Typography>
                      <Chip 
                        label={sessionStatus.session_metadata.is_active ? 'Yes' : 'No'}
                        color={sessionStatus.session_metadata.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography>Expired:</Typography>
                      <Chip 
                        label={sessionStatus.session_metadata.is_expired ? 'Yes' : 'No'}
                        color={sessionStatus.session_metadata.is_expired ? 'error' : 'success'}
                        size="small"
                      />
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography>Needs Reauthentication:</Typography>
                      <Chip 
                        label={sessionStatus.requires_reauthentication ? 'Yes' : 'No'}
                        color={sessionStatus.requires_reauthentication ? 'warning' : 'success'}
                        size="small"
                      />
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography>Needs Token Rotation:</Typography>
                      <Chip 
                        label={sessionStatus.requires_token_rotation ? 'Yes' : 'No'}
                        color={sessionStatus.requires_token_rotation ? 'warning' : 'success'}
                        size="small"
                      />
                    </Box>
                  </Stack>
                </Box>

                {/* Session Metadata */}
                <Box flex="1" minWidth="400px">
                  <Typography variant="h6" gutterBottom>Session Metadata</Typography>
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="body2" color="textSecondary">IP Address:</Typography>
                      <Typography>{sessionStatus.session_metadata.ip_address}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="textSecondary">Created:</Typography>
                      <Typography>{formatTimestamp(sessionStatus.session_metadata.created_at)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="textSecondary">Last Activity:</Typography>
                      <Typography>{formatTimestamp(sessionStatus.session_metadata.last_activity)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="textSecondary">Expires:</Typography>
                      <Typography>{formatTimestamp(sessionStatus.session_metadata.expires_at)}</Typography>
                    </Box>
                  </Stack>
                </Box>

                {/* Violations */}
                {Object.keys(sessionStatus.violations).length > 0 && (
                  <Box width="100%">
                    <Typography variant="h6" gutterBottom color="error.main">
                      Security Violations
                    </Typography>
                    <Stack spacing={1}>
                      {Object.entries(sessionStatus.violations).map(([code, message]) => (
                        <Alert key={code} severity="error" variant="outlined">
                          <Typography variant="body2">
                            <strong>{code}:</strong> {message}
                          </Typography>
                        </Alert>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Warnings */}
                {Object.keys(sessionStatus.warnings).length > 0 && (
                  <Box width="100%">
                    <Typography variant="h6" gutterBottom color="warning.main">
                      Security Warnings
                    </Typography>
                    <Stack spacing={1}>
                      {Object.entries(sessionStatus.warnings).map(([code, message]) => (
                        <Alert key={code} severity="warning" variant="outlined">
                          <Typography variant="body2">
                            <strong>{code}:</strong> {message}
                          </Typography>
                        </Alert>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Box>
            )}
          </CardContent>
        </SecurityCard>
      )}

      {/* Force Invalidate Dialog */}
      <Dialog open={invalidateDialogOpen} onClose={() => setInvalidateDialogOpen(false)}>
        <DialogTitle>Force Invalidate Session</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            This will immediately invalidate the session and force the user to re-authenticate.
          </Typography>
          <TextField
            fullWidth
            label="Reason for invalidation"
            value={invalidateReason}
            onChange={(e) => setInvalidateReason(e.target.value)}
            multiline
            rows={3}
            sx={{ mt: 2 }}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInvalidateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleForceInvalidate}
            color="error"
            variant="contained"
            disabled={!invalidateReason.trim()}
          >
            Force Invalidate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark Suspicious Dialog */}
      <Dialog open={suspiciousDialogOpen} onClose={() => setSuspiciousDialogOpen(false)}>
        <DialogTitle>Mark Session as Suspicious</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            This will mark the session as suspicious for monitoring purposes.
          </Typography>
          <TextField
            fullWidth
            label="Reason for marking suspicious"
            value={suspiciousReason}
            onChange={(e) => setSuspiciousReason(e.target.value)}
            multiline
            rows={3}
            sx={{ mt: 2 }}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuspiciousDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleMarkSuspicious}
            color="warning"
            variant="contained"
            disabled={!suspiciousReason.trim()}
          >
            Mark Suspicious
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SessionSecurityManager;