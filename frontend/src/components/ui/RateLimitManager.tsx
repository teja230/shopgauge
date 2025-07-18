import React, { useState, useEffect } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { fetchWithAdminAuth } from '../../api';
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
  LinearProgress,
  Stack,
  Divider
} from '@mui/material';
import {
  Speed as SpeedIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Block as BlockIcon,
  Clear as ClearIcon,
  Computer as ComputerIcon,
  Schedule as ScheduleIcon,
  Security as SecurityIcon,
  AdminPanelSettings as AdminIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import RefreshHeader from './RefreshHeader';

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

const MetricCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: 16,
  background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
  border: `1px solid ${theme.palette.divider}`,
  textAlign: 'center',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
  },
}));

interface RateLimitStats {
  ip_address: string;
  remaining_admin_requests: number;
  remaining_login_attempts: number;
  rate_limit_enabled: boolean;
  timestamp: string;
}

const RateLimitManager: React.FC = () => {
  const [currentIpStats, setCurrentIpStats] = useState<RateLimitStats | null>(null);
  const [targetIp, setTargetIp] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Dialog states
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearReason, setClearReason] = useState('');
  
  // Add notifications hook
  const { showSuccess, showError } = useNotifications();

  const fetchCurrentStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Correct endpoint from AdminAuthController
      const data = await fetchWithAdminAuth('/api/admin/rate-limit-status');
      setCurrentIpStats(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching rate limit stats:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch rate limit status';
      
      // Check if it's an authentication error
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        setError('Please ensure you are logged in to the admin panel');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (cooldown > 0) return;
    
    setCooldown(180); // 3 minutes = 180 seconds
    await fetchCurrentStats();
  };

  const handleClearRateLimit = async () => {
    if (!targetIp.trim() || !clearReason.trim()) return;
    
    try {
      // Correct endpoint from AdminAuditController
      await fetchWithAdminAuth('/api/admin/audit/clear-rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ip_address: targetIp,
          reason: clearReason 
        })
      });
      
      showSuccess(`🚫 Rate limits cleared successfully for IP: ${targetIp}`, {
        category: 'Rate Limit Management',
        duration: 5000
      });
      
      setClearDialogOpen(false);
      setClearReason('');
      setTargetIp('');
      await fetchCurrentStats();
    } catch (err) {
      console.error('Error clearing rate limit:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear rate limit';
      
      showError(`Failed to clear rate limits: ${errorMessage}`, {
        category: 'Rate Limit Management',
        duration: 6000
      });
      
      setError(errorMessage);
    }
  };

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Initial load only - no auto-refresh
  useEffect(() => {
    fetchCurrentStats();
  }, []);

  const getProgressColor = (remaining: number, total: number) => {
    const percentage = (remaining / total) * 100;
    if (percentage > 60) return 'success';
    if (percentage > 30) return 'warning';
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
          <SpeedIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
          <Typography variant="h4" component="h1">
            Rate Limit Manager
          </Typography>
        </Box>
        {lastUpdated && (
          <RefreshHeader
            lastUpdated={lastUpdated.toLocaleString()}
            onRefresh={handleRefresh}
            loading={loading}
            cooldown={cooldown > 0}
            cooldownRemaining={cooldown}
            label="Refresh Rate Limit Data"
            tooltip="Refresh rate limit status"
          />
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Current IP Rate Limit Status */}
      {currentIpStats && (
        <Box display="flex" flexWrap="wrap" gap={3} mb={4}>
          <Box flex="1" minWidth="300px">
            <MetricCard>
              <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
                <AdminIcon color="primary" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Admin Requests
                </Typography>
              </Box>
              <Typography variant="h3" color="primary.main" gutterBottom>
                {currentIpStats.remaining_admin_requests}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Remaining out of 10
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(currentIpStats.remaining_admin_requests / 10) * 100}
                color={getProgressColor(currentIpStats.remaining_admin_requests, 10) as any}
                sx={{ mt: 1, height: 8, borderRadius: 4 }}
              />
            </MetricCard>
          </Box>

          <Box flex="1" minWidth="300px">
            <MetricCard>
              <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
                <SecurityIcon color="primary" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Login Attempts
                </Typography>
              </Box>
              <Typography variant="h3" color="primary.main" gutterBottom>
                {currentIpStats.remaining_login_attempts}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Remaining out of 5
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(currentIpStats.remaining_login_attempts / 5) * 100}
                color={getProgressColor(currentIpStats.remaining_login_attempts, 5) as any}
                sx={{ mt: 1, height: 8, borderRadius: 4 }}
              />
            </MetricCard>
          </Box>

          <Box flex="1" minWidth="300px">
            <MetricCard>
              <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
                <CheckCircleIcon color={currentIpStats.rate_limit_enabled ? 'success' : 'error'} />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Rate Limiting
                </Typography>
              </Box>
              <Chip
                label={currentIpStats.rate_limit_enabled ? 'Enabled' : 'Disabled'}
                color={currentIpStats.rate_limit_enabled ? 'success' : 'error'}
                size="medium"
                sx={{ fontSize: '1.1rem', fontWeight: 600, mb: 2 }}
              />
              <Typography variant="body2" color="textSecondary">
                Your IP: {currentIpStats.ip_address}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Last updated: {formatTimestamp(currentIpStats.timestamp)}
              </Typography>
            </MetricCard>
          </Box>
        </Box>
      )}

      {/* Rate Limit Management */}
      <SecurityCard sx={{ mb: 3 }}>
        <CardHeader 
          title="Rate Limit Management" 
          avatar={<SpeedIcon color="primary" />}
        />
        <CardContent>
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Warning:</strong> Clearing rate limits should only be done in emergency situations 
              or for legitimate users who have been incorrectly rate limited. All actions are logged for audit purposes.
            </Typography>
          </Alert>

          <Box display="flex" flexWrap="wrap" gap={3}>
            <Box flex="1" minWidth="300px">
              <TextField
                fullWidth
                label="Target IP Address"
                value={targetIp}
                onChange={(e) => setTargetIp(e.target.value)}
                placeholder="192.168.1.100"
                helperText="Enter the IP address to clear rate limits for"
              />
            </Box>
            <Box flex="0 0 200px">
              <Button
                fullWidth
                variant="contained"
                color="warning"
                onClick={() => setClearDialogOpen(true)}
                disabled={!targetIp.trim()}
                startIcon={<ClearIcon />}
                sx={{ height: '56px' }}
              >
                Clear Rate Limits
              </Button>
            </Box>
          </Box>
        </CardContent>
      </SecurityCard>

      {/* Rate Limit Information */}
      <SecurityCard>
        <CardHeader 
          title="Rate Limit Configuration" 
          avatar={<SecurityIcon color="primary" />}
        />
        <CardContent>
          <Box display="flex" flexWrap="wrap" gap={3}>
            <Box flex="1" minWidth="300px">
              <Typography variant="h6" gutterBottom>Admin Endpoints</Typography>
              <Stack spacing={2}>
                <Box display="flex" justifyContent="space-between">
                  <Typography>Requests per minute:</Typography>
                  <Chip label="10" color="primary" size="small" />
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography>Login attempts per hour:</Typography>
                  <Chip label="5" color="primary" size="small" />
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography>Sensitive operations per hour:</Typography>
                  <Chip label="20" color="primary" size="small" />
                </Box>
              </Stack>
            </Box>

            <Box flex="1" minWidth="300px">
              <Typography variant="h6" gutterBottom>Security Features</Typography>
              <Stack spacing={2}>
                <Box display="flex" justifyContent="space-between">
                  <Typography>IP-based rate limiting:</Typography>
                  <Chip label="Enabled" color="success" size="small" />
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography>Automatic lockout:</Typography>
                  <Chip label="15 minutes" color="info" size="small" />
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography>Sliding window:</Typography>
                  <Chip label="Active" color="success" size="small" />
                </Box>
              </Stack>
            </Box>

            <Box width="100%">
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="textSecondary">
                Rate limits are applied per IP address and reset automatically based on sliding time windows. 
                Admin operations have stricter limits than regular API endpoints to prevent abuse. 
                Emergency endpoints may have different rate limiting rules to ensure system availability during critical situations.
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </SecurityCard>

      {/* Clear Rate Limit Dialog */}
      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
        <DialogTitle>Clear Rate Limits</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            You are about to clear all rate limits for IP address: <strong>{targetIp}</strong>
          </Typography>
          <Typography gutterBottom color="warning.main">
            This action will be logged for audit purposes and should only be used in emergency situations.
          </Typography>
          <TextField
            fullWidth
            label="Reason for clearing rate limits"
            value={clearReason}
            onChange={(e) => setClearReason(e.target.value)}
            multiline
            rows={3}
            sx={{ mt: 2 }}
            required
            helperText="Provide a detailed reason for this action"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleClearRateLimit}
            color="warning"
            variant="contained"
            disabled={!clearReason.trim()}
          >
            Clear Rate Limits
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RateLimitManager;