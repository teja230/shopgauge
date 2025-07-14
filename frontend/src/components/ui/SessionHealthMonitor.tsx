import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Alert,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Stack,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Timer as TimerIcon,
  AccessTime as AccessTimeIcon,
  Computer as ComputerIcon,
  LocationOn as LocationIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useNotifications } from '../../hooks/useNotifications';

interface SessionHealthData {
  sessionId: string;
  shop: string;
  isActive: boolean;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
  expiresInMinutes: number;
  ipAddress: string;
  userAgent: string;
  deviceType: string;
  location: string;
  isExpired: boolean;
  needsRefresh: boolean;
  healthScore: number;
  recommendations: string[];
}

interface SessionHealthMonitorProps {
  shop?: string;
  onRefresh?: () => void;
}

const SessionHealthMonitor: React.FC<SessionHealthMonitorProps> = ({ 
  shop, 
  onRefresh 
}) => {
  const [sessionData, setSessionData] = useState<SessionHealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const { addNotification } = useNotifications();

  // Listen for session events
  useEffect(() => {
    const handleSessionExpiring = (event: CustomEvent) => {
      addNotification(
        event.detail.message,
        'warning',
        {
          persistent: true,
          action: {
            label: 'Refresh Session',
            onClick: () => handleManualRefresh()
          }
        }
      );
    };

    const handleSessionRefreshNeeded = (event: CustomEvent) => {
      addNotification(
        event.detail.message,
        'info',
        {
          persistent: true,
          action: {
            label: 'Refresh Now',
            onClick: () => handleManualRefresh()
          }
        }
      );
    };

    const handleSessionError = (event: CustomEvent) => {
      addNotification(
        event.detail.message,
        'error',
        {
          persistent: true
        }
      );
    };

    const handleSessionInvalidated = (event: CustomEvent) => {
      addNotification(
        event.detail.message,
        'error',
        {
          persistent: true,
          action: {
            label: 'Logout',
            onClick: () => window.location.href = '/logout'
          }
        }
      );
    };

    window.addEventListener('sessionExpiring', handleSessionExpiring as EventListener);
    window.addEventListener('sessionRefreshNeeded', handleSessionRefreshNeeded as EventListener);
    window.addEventListener('sessionError', handleSessionError as EventListener);
    window.addEventListener('sessionInvalidated', handleSessionInvalidated as EventListener);

    return () => {
      window.removeEventListener('sessionExpiring', handleSessionExpiring as EventListener);
      window.removeEventListener('sessionRefreshNeeded', handleSessionRefreshNeeded as EventListener);
      window.removeEventListener('sessionError', handleSessionError as EventListener);
      window.removeEventListener('sessionInvalidated', handleSessionInvalidated as EventListener);
    };
  }, [addNotification]);

  const fetchSessionHealth = useCallback(async () => {
    if (!shop) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/sessions/health-check', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSessionData(data);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch session health');
    } finally {
      setLoading(false);
    }
  }, [shop]);

  const handleManualRefresh = async () => {
    if (refreshCooldown > 0) return;

    setRefreshCooldown(30); // 30 second cooldown
    setLoading(true);

    try {
      const response = await fetch('/api/sessions/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          addNotification(
            'Your session has been successfully refreshed.',
            'success',
            { duration: 5000 }
          );
          await fetchSessionHealth();
          onRefresh?.();
        } else {
          throw new Error(data.error || 'Session refresh failed');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      addNotification(
        err instanceof Error ? err.message : 'Failed to refresh session',
        'error',
        { duration: 5000 }
      );
    } finally {
      setLoading(false);
    }
  };

  // Cooldown timer
  useEffect(() => {
    if (refreshCooldown > 0) {
      const timer = setTimeout(() => setRefreshCooldown(refreshCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [refreshCooldown]);

  // Auto-refresh session health
  useEffect(() => {
    fetchSessionHealth();
    const interval = setInterval(fetchSessionHealth, 60000); // Every minute
    return () => clearInterval(interval);
  }, [fetchSessionHealth]);

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getHealthIcon = (score: number) => {
    if (score >= 80) return <CheckCircleIcon color="success" />;
    if (score >= 60) return <WarningIcon color="warning" />;
    return <ErrorIcon color="error" />;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType.toLowerCase()) {
      case 'mobile': return <ComputerIcon />;
      case 'tablet': return <ComputerIcon />;
      case 'desktop': return <ComputerIcon />;
      default: return <ComputerIcon />;
    }
  };

  if (!shop) {
    return null;
  }

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon color="primary" />
              Session Health
            </Typography>
            <Box display="flex" gap={1}>
              <Tooltip title="Refresh session health">
                <IconButton 
                  size="small" 
                  onClick={fetchSessionHealth}
                  disabled={loading}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="View details">
                <IconButton 
                  size="small" 
                  onClick={() => setShowDetails(true)}
                >
                  <InfoIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {loading && !sessionData ? (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={24} />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : sessionData ? (
            <Stack spacing={2}>
              {/* Health Score */}
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">Session Health</Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getHealthIcon(sessionData.healthScore)}
                    <Typography variant="body2" fontWeight="bold">
                      {sessionData.healthScore}%
                    </Typography>
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={sessionData.healthScore}
                  color={getHealthColor(sessionData.healthScore) as any}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              {/* Status Indicators */}
              <Box display="flex" gap={1} flexWrap="wrap">
                <Chip
                  icon={sessionData.isActive ? <CheckCircleIcon /> : <ErrorIcon />}
                  label={sessionData.isActive ? 'Active' : 'Inactive'}
                  color={sessionData.isActive ? 'success' : 'error'}
                  size="small"
                />
                {sessionData.isExpired && (
                  <Chip
                    icon={<WarningIcon />}
                    label="Expired"
                    color="warning"
                    size="small"
                  />
                )}
                {sessionData.needsRefresh && (
                  <Chip
                    icon={<RefreshIcon />}
                    label="Needs Refresh"
                    color="warning"
                    size="small"
                  />
                )}
                {sessionData.expiresInMinutes <= 10 && (
                  <Chip
                    icon={<TimerIcon />}
                    label={`Expires in ${sessionData.expiresInMinutes}m`}
                    color="warning"
                    size="small"
                  />
                )}
              </Box>

              {/* Session Info */}
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Session ID: {sessionData.sessionId.substring(0, 8)}...
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Created: {formatTime(sessionData.createdAt)}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Last Active: {formatTime(sessionData.lastAccessedAt)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Expires: {formatTime(sessionData.expiresAt)}
                </Typography>
              </Box>

              {/* Action Button */}
              <Box>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={handleManualRefresh}
                  disabled={loading || refreshCooldown > 0}
                  fullWidth
                >
                  {refreshCooldown > 0 
                    ? `Refresh (${refreshCooldown}s)` 
                    : 'Refresh Session'
                  }
                </Button>
              </Box>

              {/* Recommendations */}
              {sessionData.recommendations.length > 0 && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                    Recommendations:
                  </Typography>
                  <List dense sx={{ py: 0 }}>
                    {sessionData.recommendations.map((rec, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          <InfoIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={rec}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              )}
            </Stack>
          ) : (
            <Alert severity="info">
              No session data available
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog 
        open={showDetails} 
        onClose={() => setShowDetails(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Session Details</Typography>
            <IconButton onClick={() => setShowDetails(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {sessionData && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Session Information
                </Typography>
                <Typography variant="body2">ID: {sessionData.sessionId}</Typography>
                <Typography variant="body2">Shop: {sessionData.shop}</Typography>
                <Typography variant="body2">Status: {sessionData.isActive ? 'Active' : 'Inactive'}</Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Timing
                </Typography>
                <Typography variant="body2">Created: {formatTime(sessionData.createdAt)}</Typography>
                <Typography variant="body2">Last Active: {formatTime(sessionData.lastAccessedAt)}</Typography>
                <Typography variant="body2">Expires: {formatTime(sessionData.expiresAt)}</Typography>
                <Typography variant="body2">Time Remaining: {sessionData.expiresInMinutes} minutes</Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Device Information
                </Typography>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  {getDeviceIcon(sessionData.deviceType)}
                  <Typography variant="body2">{sessionData.deviceType}</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <LocationIcon fontSize="small" />
                  <Typography variant="body2">{sessionData.location}</Typography>
                </Box>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  IP: {sessionData.ipAddress}
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all', fontSize: '0.75rem' }}>
                  User Agent: {sessionData.userAgent}
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Health Metrics
                </Typography>
                <Typography variant="body2">Health Score: {sessionData.healthScore}%</Typography>
                <Typography variant="body2">Expired: {sessionData.isExpired ? 'Yes' : 'No'}</Typography>
                <Typography variant="body2">Needs Refresh: {sessionData.needsRefresh ? 'Yes' : 'No'}</Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetails(false)}>Close</Button>
          <Button 
            variant="contained" 
            onClick={handleManualRefresh}
            disabled={loading || refreshCooldown > 0}
          >
            Refresh Session
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SessionHealthMonitor; 