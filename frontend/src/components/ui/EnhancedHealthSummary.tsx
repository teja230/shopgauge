import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  IconButton,
  Button,
  LinearProgress,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Speed as SpeedIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useServiceStatus } from '../../context/ServiceStatusContext';
import { useNotifications } from '../../hooks/useNotifications';
import RefreshHeader from './RefreshHeader';
import { debugLog } from './DebugPanel';
import StorageIcon from '@mui/icons-material/Storage';
import DatabaseIcon from '@mui/icons-material/Storage';
import { TrendingUp as TrendingUpIcon } from '@mui/icons-material';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const fetchPublicEndpoint = async (endpoint: string, options?: RequestInit) => {
  const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  return fetch(fullUrl, {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    ...options,
  });
};

interface DatabaseMetrics {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  threadsAwaitingConnection: number;
  maxPoolSize: number;
  minimumIdle: number;
  activeUsageRatio: number;
  activeUsagePercent: number;
  consecutiveFailures: number;
  lastFailureTime: number;
  healthStatus: string;
  poolStatus: string;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  total: number;
  hitRate: number;
  evictions: number;
  timestamp: string;
}

interface HealthMetrics {
  backendStatus: string;
  redisStatus: string;
  databaseStatus: string;
  systemStatus: string;
  lastUpdated: number;
  lastDeployCommit: string;
  database?: DatabaseMetrics;
}

const formatTimestamp = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) { // Less than 1 minute
    return 'Just now';
  } else if (diff < 3600000) { // Less than 1 hour
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  } else if (diff < 86400000) { // Less than 1 day
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  } else {
    return new Date(timestamp).toLocaleString();
  }
};

const StatusChip: React.FC<{
  status: string;
  label: string;
  icon: React.ReactElement;
}> = ({ status, label, icon }) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'up':
      case 'healthy':
        return 'success';
      case 'down':
      case 'unhealthy':
        return 'error';
      case 'degraded':
      case 'warning':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Chip
      icon={icon}
      label={label}
      color={getStatusColor(status)}
      variant="filled"
      size="small"
      sx={{ fontWeight: 500 }}
    />
  );
};

const DatabaseConnectionsCard: React.FC<{ metrics: DatabaseMetrics }> = ({ metrics }) => {
  const getProgressColor = (percentage: number) => {
    if (percentage > 85) return 'error';
    if (percentage > 70) return 'warning';
    return 'success';
  };

  const activeUsagePercent = metrics.activeUsagePercent || 0;
  const progressColor = getProgressColor(activeUsagePercent);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DatabaseIcon color="primary" />
          Database Connections
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Active Connections
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {metrics.activeConnections} / {metrics.maxPoolSize}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={activeUsagePercent}
            color={progressColor}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {activeUsagePercent.toFixed(1)}% utilization
          </Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid xs={6}>
            <Box>
              <Typography variant="caption" color="text.secondary">Idle</Typography>
              <Typography variant="body2" fontWeight="bold">{metrics.idleConnections}</Typography>
            </Box>
          </Grid>
          <Grid xs={6}>
            <Box>
              <Typography variant="caption" color="text.secondary">Awaiting</Typography>
              <Typography variant="body2" fontWeight="bold">{metrics.threadsAwaitingConnection}</Typography>
            </Box>
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <StatusChip
            status={metrics.healthStatus}
            label={metrics.healthStatus === 'healthy' ? 'Healthy' : 'Issues Detected'}
            icon={metrics.healthStatus === 'healthy' ? <CheckCircleIcon /> : <WarningIcon />}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

const PerformanceMetricsCard: React.FC<{ metrics: DatabaseMetrics }> = ({ metrics }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SpeedIcon color="primary" />
        Performance Metrics
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Pool Status
          </Typography>
          <Typography variant="body2" fontWeight="bold" sx={{ textTransform: 'capitalize' }}>
            {metrics.poolStatus}
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={2}>
        <Grid xs={6}>
          <Box>
            <Typography variant="caption" color="text.secondary">Min Idle</Typography>
            <Typography variant="body2" fontWeight="bold">{metrics.minimumIdle}</Typography>
          </Box>
        </Grid>
        <Grid xs={6}>
          <Box>
            <Typography variant="caption" color="text.secondary">Max Pool</Typography>
            <Typography variant="body2" fontWeight="bold">{metrics.maxPoolSize}</Typography>
          </Box>
        </Grid>
      </Grid>

      {metrics.consecutiveFailures > 0 && (
        <Alert severity="warning" sx={{ mt: 2, py: 0 }}>
          <Typography variant="caption">
            {metrics.consecutiveFailures} consecutive failures
          </Typography>
        </Alert>
      )}
    </CardContent>
  </Card>
);

const CacheStatisticsCard: React.FC<{ metrics: CacheMetrics }> = ({ metrics }) => {
  const hitRatePercent = metrics.hitRate || 0;
  const getHitRateColor = (rate: number) => {
    if (rate > 80) return 'success';
    if (rate > 60) return 'warning';
    return 'error';
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StorageIcon color="primary" />
          Cache Performance
        </Typography>
        
        <Grid container spacing={3}>
          <Grid xs={12} sm={6}>
            <Box>
              <Typography variant="h4" fontWeight="bold" color={getHitRateColor(hitRatePercent)}>
                {hitRatePercent.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">Hit Rate</Typography>
              <LinearProgress
                variant="determinate"
                value={hitRatePercent}
                color={getHitRateColor(hitRatePercent)}
                sx={{ mt: 1, height: 6, borderRadius: 3 }}
              />
            </Box>
          </Grid>
          
          <Grid xs={12} sm={6}>
            <Box>
              <Typography variant="h4" fontWeight="bold">
                {metrics.total.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">Total Requests</Typography>
            </Box>
          </Grid>
          
          <Grid xs={6}>
            <Box>
              <Typography variant="h6" color="success.main" fontWeight="bold">
                {metrics.hits.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">Cache Hits</Typography>
            </Box>
          </Grid>
          
          <Grid xs={6}>
            <Box>
              <Typography variant="h6" color="error.main" fontWeight="bold">
                {metrics.misses.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">Cache Misses</Typography>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

const EnhancedHealthSummary: React.FC = () => {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [databaseDetails, setDatabaseDetails] = useState<DatabaseMetrics | null>(null);
  const [cacheMetrics, setCacheMetrics] = useState<CacheMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const [isServiceAvailable, setIsServiceAvailable] = useState(true);
  const isMountedRef = useRef(true);
  const { addNotification } = useNotifications();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Unified fetch function
  const fetchAllMetrics = React.useCallback(async () => {
    if (!isServiceAvailable) {
      debugLog.info('HealthSummary: Skipping health check - service not available', {}, 'EnhancedHealthSummary');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use public endpoints
      const [healthData, dbDetailsData, cacheData] = await Promise.all([
        fetchPublicEndpoint('/api/health/summary'),
        fetchPublicEndpoint('/api/health/database-pool'),
        fetchPublicEndpoint('/api/health/cache-statistics').catch(() => ({ hits: 0, misses: 0, total: 0, hitRate: 0, evictions: 0 }))
      ]);
      
      // Transform the data to match expected format
      const transformedHealthData = {
        backendStatus: healthData.status === 'healthy' ? 'UP' : 'DOWN',
        redisStatus: healthData.redis?.status === 'healthy' ? 'UP' : 'DOWN',
        databaseStatus: healthData.database?.status === 'healthy' ? 'UP' : 'DOWN',
        systemStatus: healthData.status === 'healthy' ? 'UP' : 'DEGRADED',
        lastUpdated: Date.now(),
        lastDeployCommit: healthData.version || 'unknown'
      };
      
      const transformedDbData = {
        activeConnections: dbDetailsData.pool_active_connections || 0,
        idleConnections: dbDetailsData.pool_idle_connections || 0,
        totalConnections: dbDetailsData.pool_total_connections || 0,
        threadsAwaitingConnection: dbDetailsData.threadsAwaitingConnection || 0,
        maxPoolSize: dbDetailsData.maxPoolSize || 10,
        minimumIdle: dbDetailsData.minimumIdle || 2,
        activeUsageRatio: dbDetailsData.activeUsageRatio || 0,
        activeUsagePercent: dbDetailsData.activeUsagePercent || dbDetailsData.usagePercentage || 0,
        consecutiveFailures: dbDetailsData.consecutiveFailures || 0,
        lastFailureTime: dbDetailsData.lastFailureTime || 0,
        healthStatus: dbDetailsData.status || 'healthy',
        poolStatus: dbDetailsData.poolStatus || 'healthy'
      };
      
      // Transform cache data
      const transformedCacheData: CacheMetrics = {
        hits: cacheData.hits || 0,
        misses: cacheData.misses || 0,
        total: cacheData.total || 0,
        hitRate: cacheData.hitRate || 0,
        evictions: cacheData.evictions || 0,
        timestamp: new Date().toISOString()
      };
      
      setMetrics(transformedHealthData);
      setDatabaseDetails(transformedDbData);
      setCacheMetrics(transformedCacheData);
      
    } catch (e: any) {
      console.error('Failed to fetch enhanced health metrics:', e);
      setError('Failed to load system health. Please try again.');
      setMetrics(null);
      setDatabaseDetails(null);
    } finally {
      setLoading(false);
    }
  }, [isServiceAvailable]);

  useEffect(() => {
    // Only fetch data if we don't have any data yet
    if (!metrics && !databaseDetails && !cacheMetrics) {
      fetchAllMetrics();
    }
  }, [fetchAllMetrics]);

  // Cooldown timer for Refresh
  useEffect(() => {
    if (refreshCooldown > 0) {
      const timer = setTimeout(() => setRefreshCooldown(refreshCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [refreshCooldown]);

  const fetchAllMetricsWithCooldown = async () => {
    if (refreshCooldown > 0) return;
    setRefreshCooldown(120); // 2 minutes (increased from 5 seconds)
    await fetchAllMetrics();
  };

  if (!isServiceAvailable) {
    return (
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3, bgcolor: 'grey.50' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            System Health Status
          </Typography>
        </Box>
        <Alert severity="warning">
          Service temporarily unavailable - health metrics not available
        </Alert>
      </Paper>
    );
  }

  if (loading && !metrics) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={
        <IconButton color="inherit" size="small" onClick={fetchAllMetrics}>
          <RefreshIcon />
        </IconButton>
      }>
        {error}
      </Alert>
    );
  }

  if (!metrics) return null;

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const handleClearCache = async () => {
    try {
      // Use the public endpoint for this action if available, else skip
      // await fetchPublicEndpoint('/api/health/cache/invalidate', { method: 'POST' });
      addNotification('Cache clear not available on public endpoint', 'info');
      await fetchAllMetrics(); // Refresh health data
    } catch (e: any) {
      debugLog.warn('Failed to clear cache:', e.message, 'EnhancedHealthSummary');
      addNotification('Failed to clear cache', 'error');
    }
  };

  const handleForceRedisCheck = async () => {
    try {
      // Use the public endpoint for this action if available, else skip
      // await fetchPublicEndpoint('/api/health/redis/check', { method: 'POST' });
      addNotification('Redis health check not available on public endpoint', 'info');
      await fetchAllMetrics(); // Refresh health data
    } catch (e: any) {
      debugLog.warn('Failed to force Redis check:', e.message, 'EnhancedHealthSummary');
      addNotification('Failed to force Redis check', 'error');
    }
  };

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 3 }, mb: 3, borderRadius: 3, bgcolor: 'grey.50' }}>
      <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3} gap={2}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
          <SpeedIcon color="primary" />
          System Health & Performance
        </Typography>
        <RefreshHeader
          lastUpdated={formatTimestamp(metrics.lastUpdated)}
          onRefresh={fetchAllMetricsWithCooldown}
          loading={loading}
          cooldown={refreshCooldown > 0}
          cooldownRemaining={refreshCooldown}
          label="Refresh health metrics"
          tooltip="Refresh health metrics"
        />
      </Box>
      {/* Enhanced Database Monitoring */}
      {databaseDetails && (
        <Box display="flex" gap={3} sx={{ flexDirection: { xs: 'column', md: 'row' } }}>
          <Box flex={1} minWidth={0} mb={{ xs: 2, md: 0 }}>
            {databaseDetails && <DatabaseConnectionsCard metrics={databaseDetails} />}
          </Box>
          <Box flex={1} minWidth={0}>
            {databaseDetails && <PerformanceMetricsCard metrics={databaseDetails} />}
          </Box>
        </Box>
      )}
      
      {/* Cache Statistics */}
      {cacheMetrics && (
        <Box mt={3}>
          {cacheMetrics && <CacheStatisticsCard metrics={cacheMetrics} />}
        </Box>
      )}
      <Box display="flex" alignItems="center" gap={1} mt={2} flexWrap="wrap">
        <Typography variant="caption" color="text.secondary">
          Monitoring: Real-time database pool status
        </Typography>
      </Box>
      <Box display="flex" justifyContent="flex-end" gap={2} mt={2} flexDirection={{ xs: 'column', sm: 'row' }}>
        <Button
          variant="outlined"
          color="error"
          startIcon={<ClearIcon />}
          onClick={handleClearCache}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Clear Cache
        </Button>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<HealthAndSafetyIcon />}
          onClick={handleForceRedisCheck}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Force Redis Check
        </Button>
      </Box>
    </Paper>
  );
};

export default EnhancedHealthSummary;
