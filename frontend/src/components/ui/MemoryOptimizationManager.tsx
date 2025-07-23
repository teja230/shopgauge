import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Switch,
  FormControlLabel,
  Alert,
  AlertTitle,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  LinearProgress,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Storage as StorageIcon,
  NetworkCheck as NetworkCheckIcon,
  Schedule as ScheduleIcon,
  Notifications as NotificationsIcon,
  CleanHands as CleanHandsIcon,
  People as PeopleIcon,
  Wifi as WifiIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useNotifications } from '../../hooks/useNotifications';
import { fetchWithAdminAuth } from '../../api';

const OptimizationCard = styled(Card)(({ theme }) => ({
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

interface MemoryOptimizationFeatures {
  sseEnabled: boolean;
  scheduledSystemResourceMonitoring: boolean;
  scheduledDashboardCollection: boolean;
  scheduledPerformanceMetrics: boolean;
  scheduledDatabaseMonitoring: boolean;
  scheduledRedisMonitoring: boolean;
  scheduledAlerting: boolean;
  scheduledCacheCleanup: boolean;
  scheduledSessionCleanup: boolean;
  scheduledSseCleanup: boolean;
  memoryImpact: {
    estimatedMemorySavings: string;
    cpuUsageReduction: string;
    recommendedFor: string;
    tradeoffs: string;
  };
  timestamp: string;
}

interface SystemRecommendations {
  systemStatus: {
    memoryUsagePercent: number;
    memoryAlert: string;
    cpuUsagePercent: number;
    cpuAlert: string;
  };
  recommendations: string[];
  plan: string;
  timestamp: string;
}

interface FeatureFlagUpdate {
  [key: string]: boolean;
}

const MemoryOptimizationManager: React.FC = () => {
  const { addNotification } = useNotifications();
  const [features, setFeatures] = useState<MemoryOptimizationFeatures | null>(null);
  const [recommendations, setRecommendations] = useState<SystemRecommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<FeatureFlagUpdate>({});

  const fetchFeatures = async () => {
    try {
      setError(null);
      const data = await fetchWithAdminAuth('/api/admin/features/memory-optimization');
      setFeatures(data);
      setLastUpdated(new Date().toLocaleString());
    } catch (err) {
      console.error('Error fetching memory optimization features:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch memory optimization features');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const data = await fetchWithAdminAuth('/api/admin/features/memory-optimization/recommendations');
      setRecommendations(data);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      // Don't set error for recommendations as it's not critical
    }
  };

  const refreshData = async () => {
    if (refreshCooldown > 0) return;
    setRefreshCooldown(60); // 1 minute cooldown
    setLoading(true);
    await Promise.all([fetchFeatures(), fetchRecommendations()]);
  };

  const handleFeatureToggle = (featureName: string, enabled: boolean) => {
    setPendingChanges(prev => ({
      ...prev,
      [featureName]: enabled
    }));
    setShowConfirmDialog(true);
  };

  const applyChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) return;

    try {
      setUpdating(true);
      const response = await fetchWithAdminAuth('/api/admin/features/memory-optimization', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pendingChanges),
      });

      if (response.success) {
        addNotification('Memory optimization features updated successfully', 'success');
        
        // Show warnings if any
        if (response.warnings) {
          Object.entries(response.warnings).forEach(([feature, warning]) => {
            addNotification(`${feature}: ${warning}`, 'warning');
          });
        }

        // Refresh data to get updated state
        await fetchFeatures();
        setPendingChanges({});
      } else {
        addNotification('Failed to update memory optimization features', 'error');
      }
    } catch (err) {
      console.error('Error updating memory optimization features:', err);
      addNotification('Failed to update memory optimization features', 'error');
    } finally {
      setUpdating(false);
      setShowConfirmDialog(false);
    }
  };

  const cancelChanges = () => {
    setPendingChanges({});
    setShowConfirmDialog(false);
  };

  const getFeatureIcon = (featureName: string) => {
    const iconMap: { [key: string]: React.ReactElement } = {
      sseEnabled: <WifiIcon />,
      scheduledSystemResourceMonitoring: <MemoryIcon />,
      scheduledDashboardCollection: <SpeedIcon />,
      scheduledPerformanceMetrics: <TrendingUpIcon />,
      scheduledDatabaseMonitoring: <StorageIcon />,
      scheduledRedisMonitoring: <NetworkCheckIcon />,
      scheduledAlerting: <NotificationsIcon />,
      scheduledCacheCleanup: <CleanHandsIcon />,
      scheduledSessionCleanup: <PeopleIcon />,
      scheduledSseCleanup: <WifiIcon />
    };
    return iconMap[featureName] || <SettingsIcon />;
  };

  const getFeatureDescription = (featureName: string) => {
    const descriptions: { [key: string]: string } = {
      sseEnabled: 'Server-Sent Events for real-time notifications',
      scheduledSystemResourceMonitoring: 'Automatic system resource monitoring',
      scheduledDashboardCollection: 'Scheduled dashboard metrics collection',
      scheduledPerformanceMetrics: 'Automatic performance metrics collection',
      scheduledDatabaseMonitoring: 'Scheduled database health monitoring',
      scheduledRedisMonitoring: 'Scheduled Redis cache monitoring',
      scheduledAlerting: 'Automatic alert generation and notification',
      scheduledCacheCleanup: 'Scheduled cache cleanup operations',
      scheduledSessionCleanup: 'Automatic session cleanup and management',
      scheduledSseCleanup: 'Scheduled SSE connection cleanup'
    };
    return descriptions[featureName] || 'Feature flag control';
  };

  const getStatusColor = (alert: string) => {
    switch (alert?.toUpperCase()) {
      case 'CRITICAL': return 'error';
      case 'WARNING': return 'warning';
      case 'NORMAL':
      case 'HEALTHY': return 'success';
      default: return 'info';
    }
  };

  // Cooldown timer for refresh
  useEffect(() => {
    if (refreshCooldown > 0) {
      const timer = setTimeout(() => setRefreshCooldown(refreshCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [refreshCooldown]);

  // Load data on component mount
  useEffect(() => {
    if (!features) {
      fetchFeatures();
      fetchRecommendations();
    }
  }, []);

  if (loading && !features) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !features) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        <AlertTitle>Error</AlertTitle>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1">
            Memory Optimization Manager
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Control memory-intensive features for 512MB Render starter plan
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastUpdated || 'Never'}
          </Typography>
          <Tooltip
            title={
              loading
                ? 'Refreshing...'
                : refreshCooldown > 0
                ? `Please wait ${refreshCooldown}s before refreshing again`
                : 'Refresh data'
            }
          >
            <span>
              <IconButton
                onClick={refreshData}
                disabled={loading || refreshCooldown > 0}
                size="small"
                sx={{ ml: 1 }}
              >
                {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Box display="flex" flexWrap="wrap" gap={3}>
        {/* System Status */}
        {recommendations && (
          <Box flex="1" minWidth="300px">
            <OptimizationCard>
              <CardHeader
                title="System Status"
                avatar={<MemoryIcon color="primary" />}
                action={
                  <Chip
                    label={recommendations.plan}
                    color="primary"
                    size="small"
                    variant="outlined"
                  />
                }
              />
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Memory Usage
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <LinearProgress
                        variant="determinate"
                        value={recommendations.systemStatus.memoryUsagePercent || 0}
                        color={getStatusColor(recommendations.systemStatus.memoryAlert)}
                        sx={{ flexGrow: 1 }}
                      />
                      <Typography variant="body2">
                        {Math.round(recommendations.systemStatus.memoryUsagePercent || 0)}%
                      </Typography>
                    </Box>
                    <Chip
                      label={recommendations.systemStatus.memoryAlert || 'UNKNOWN'}
                      color={getStatusColor(recommendations.systemStatus.memoryAlert)}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      CPU Usage
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <LinearProgress
                        variant="determinate"
                        value={recommendations.systemStatus.cpuUsagePercent || 0}
                        color={getStatusColor(recommendations.systemStatus.cpuAlert)}
                        sx={{ flexGrow: 1 }}
                      />
                      <Typography variant="body2">
                        {Math.round(recommendations.systemStatus.cpuUsagePercent || 0)}%
                      </Typography>
                    </Box>
                    <Chip
                      label={recommendations.systemStatus.cpuAlert || 'UNKNOWN'}
                      color={getStatusColor(recommendations.systemStatus.cpuAlert)}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                </Stack>
              </CardContent>
            </OptimizationCard>
          </Box>
        )}

        {/* Memory Impact */}
        {features && (
          <Box flex="1" minWidth="300px">
            <OptimizationCard>
              <CardHeader
                title="Memory Impact"
                avatar={<TrendingDownIcon color="success" />}
              />
              <CardContent>
                <Stack spacing={2}>
                  <MetricCard>
                    <Typography variant="h6" color="success.main">
                      {features.memoryImpact.estimatedMemorySavings}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Memory Savings
                    </Typography>
                  </MetricCard>

                  <MetricCard>
                    <Typography variant="h6" color="info.main">
                      {features.memoryImpact.cpuUsageReduction}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      CPU Usage Reduction
                    </Typography>
                  </MetricCard>

                  <Alert severity="info" sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      {features.memoryImpact.tradeoffs}
                    </Typography>
                  </Alert>
                </Stack>
              </CardContent>
            </OptimizationCard>
          </Box>
        )}
      </Box>

      {/* Feature Flags */}
      {features && (
        <Box mt={3}>
          <OptimizationCard>
            <CardHeader
              title="Memory Optimization Features"
              subtitle="Toggle memory-intensive features on/off"
              avatar={<SettingsIcon color="primary" />}
            />
            <CardContent>
              <Box display="flex" flexWrap="wrap" gap={2}>
                {Object.entries(features).map(([key, value]) => {
                  if (key === 'memoryImpact' || key === 'timestamp') return null;
                  
                  return (
                    <Box key={key} flex="1" minWidth="300px">
                      <Paper
                        sx={{
                          p: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            borderColor: 'primary.main',
                            boxShadow: 1,
                          },
                        }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box display="flex" alignItems="center" gap={1}>
                            {getFeatureIcon(key)}
                            <Box>
                              <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {getFeatureDescription(key)}
                              </Typography>
                            </Box>
                          </Box>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={value as boolean}
                                onChange={(e) => handleFeatureToggle(key, e.target.checked)}
                                disabled={updating}
                                color="primary"
                              />
                            }
                            label=""
                          />
                        </Box>
                      </Paper>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </OptimizationCard>
        </Box>
      )}

      {/* Recommendations */}
      {recommendations && (
        <Box mt={3}>
          <OptimizationCard>
            <CardHeader
              title="System Recommendations"
              avatar={<InfoIcon color="info" />}
            />
            <CardContent>
              <List>
                {recommendations.recommendations.map((recommendation, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemIcon>
                      <InfoIcon color="info" />
                    </ListItemIcon>
                    <ListItemText primary={recommendation} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </OptimizationCard>
        </Box>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onClose={cancelChanges} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Feature Changes</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            You are about to update the following memory optimization features:
          </Typography>
          <List dense>
            {Object.entries(pendingChanges).map(([feature, enabled]) => (
              <ListItem key={feature} sx={{ px: 0 }}>
                <ListItemIcon>
                  {enabled ? <CheckCircleIcon color="success" /> : <ErrorIcon color="error" />}
                </ListItemIcon>
                <ListItemText
                  primary={feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  secondary={`${enabled ? 'Enable' : 'Disable'} ${getFeatureDescription(feature)}`}
                />
              </ListItem>
            ))}
          </List>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <AlertTitle>Warning</AlertTitle>
            Some changes may require an application restart to take effect.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelChanges} disabled={updating}>
            Cancel
          </Button>
          <Button
            onClick={applyChanges}
            variant="contained"
            disabled={updating}
            startIcon={updating ? <CircularProgress size={16} /> : null}
          >
            {updating ? 'Updating...' : 'Apply Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MemoryOptimizationManager; 