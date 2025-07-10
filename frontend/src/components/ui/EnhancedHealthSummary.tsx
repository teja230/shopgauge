import React, { useEffect, useState } from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  CircularProgress, 
  Alert, 
  Chip, 
  Card,
  CardContent,
  LinearProgress,
  Tooltip,
  IconButton,
  Button,
  Stack
} from '@mui/material';
import {
  Speed as SpeedIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Timer as TimerIcon,
  RestartAlt as RestartAltIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  TrendingUp as TrendingUpIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import StorageIcon from '@mui/icons-material/Storage';
import DatabaseIcon from '@mui/icons-material/Storage';
import { useServiceStatus } from '../../context/ServiceStatusContext';
import { debugLog } from './DebugPanel';
import { useNotifications } from '../../hooks/useNotifications';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Centralized public fetcher
const fetchPublicEndpoint = async (endpoint: string, options?: RequestInit) => {
  const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const response = await fetch(fullUrl, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Public endpoint ${endpoint} failed with status ${response.status}:`, errorBody);
    throw new Error(`Request failed: ${response.statusText}`);
  }
  return response.json();
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

interface HealthMetrics {
  backendStatus: string;
  redisStatus: string;
  databaseStatus: string;
  systemStatus: string;
  lastUpdated: number;
  lastDeployCommit: string;
  database?: DatabaseMetrics;
}

// Utility function for better timestamp formatting
const formatTimestamp = (timestamp: number) => {
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

const StatusChip: React.FC<{
  status: string;
  label: string;
  icon: React.ReactElement;
}> = ({ status, label, icon }) => {
  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'UP':
      case 'HEALTHY':
        return 'success';
      case 'DOWN':
      case 'CRITICAL':
        return 'error';
      case 'DEGRADED':
      case 'WARNING':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Chip
      icon={icon}
      label={`${label}: ${status}`}
      color={getStatusColor(status) as any}
      variant="outlined"
      sx={{ minWidth: 120 }}
    />
  );
};

const DatabaseConnectionsCard: React.FC<{ metrics: DatabaseMetrics }> = ({ metrics }) => {
  const getProgressColor = (percentage: number) => {
    if (percentage >= 95) return 'error';
    if (percentage >= 80) return 'warning';
    return 'success';
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DatabaseIcon color="primary" />
            Connection Pool
          </Typography>
          <Chip 
            label={metrics.poolStatus} 
            color={getProgressColor(metrics.activeUsagePercent) as any}
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
        </Box>
        
        <Box display="flex" gap={2} mb={2}>
          <Box flex={1} textAlign="center">
            <Typography variant="h4" color="primary.main" fontWeight="bold">
              {metrics.activeConnections}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active
            </Typography>
          </Box>
          <Box flex={1} textAlign="center">
            <Typography variant="h4" color="info.main" fontWeight="bold">
              {metrics.idleConnections}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Idle
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2">Pool Usage</Typography>
            <Typography variant="body2" fontWeight="bold">
              {metrics.activeUsagePercent}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={metrics.activeUsagePercent} 
            color={getProgressColor(metrics.activeUsagePercent) as any}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {metrics.activeConnections} / {metrics.maxPoolSize} connections in use
          </Typography>
        </Box>

        {metrics.threadsAwaitingConnection > 0 && (
          <Alert severity="warning" sx={{ mt: 2, py: 0.5 }}>
            <Typography variant="body2">
              {metrics.threadsAwaitingConnection} threads waiting for connections
            </Typography>
          </Alert>
        )}

        {metrics.consecutiveFailures > 0 && (
          <Alert severity="error" sx={{ mt: 2, py: 0.5 }}>
            <Typography variant="body2">
              {metrics.consecutiveFailures} consecutive connection failures
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

const PerformanceMetricsCard: React.FC<{ metrics: DatabaseMetrics }> = ({ metrics }) => (
  <Card sx={{ height: '100%', bgcolor: 'background.paper', borderRadius: 2 }}>
    <CardContent>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <TrendingUpIcon color="primary" />
        Performance Metrics
      </Typography>
      
      <Box display="flex" gap={2} mb={2}>
        <Box flex={1} textAlign="center">
          <Typography variant="h5" color="info.main" fontWeight="bold">
            {metrics.activeUsagePercent.toFixed(1)}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Pool Usage
          </Typography>
        </Box>
        <Box flex={1} textAlign="center">
          <Typography variant="h5" color="warning.main" fontWeight="bold">
            {metrics.consecutiveFailures}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Failures
          </Typography>
        </Box>
      </Box>

      <Box display="flex" gap={2}>
        <Box flex={1} textAlign="center">
          <Typography variant="h5" color="success.main" fontWeight="bold">
            {metrics.maxPoolSize}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Max Pool
          </Typography>
        </Box>
        <Box flex={1} textAlign="center">
          <Typography variant="h5" color="info.main" fontWeight="bold">
            {metrics.minimumIdle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Min Idle
          </Typography>
        </Box>
      </Box>

      {metrics.lastFailureTime > 0 && (
        <Alert severity="warning" sx={{ mt: 2, py: 0.5 }}>
          <Typography variant="body2">
            Last failure: {formatTimestamp(metrics.lastFailureTime)}
          </Typography>
        </Alert>
      )}
    </CardContent>
  </Card>
);

const EnhancedHealthSummary: React.FC = () => {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [databaseDetails, setDatabaseDetails] = useState<DatabaseMetrics | null>(null);
  const [loading, setLoading] = useState(true); // Start loading initially
  const [error, setError] = useState<string | null>(null);
  const { isServiceAvailable } = useServiceStatus();
  const { addNotification } = useNotifications();

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
      const [healthData, dbDetailsData] = await Promise.all([
        fetchPublicEndpoint('/api/health/summary'),
        fetchPublicEndpoint('/api/health/database-pool')
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
      
      setMetrics(transformedHealthData);
      setDatabaseDetails(transformedDbData);
      
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
    fetchAllMetrics();
    
    // Set up an interval for subsequent refreshes
    const interval = setInterval(fetchAllMetrics, 60000); // 1 minute
    return () => clearInterval(interval);
  }, [fetchAllMetrics]);


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
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="caption" color="text.secondary">
            Last updated: {formatTimestamp(metrics.lastUpdated)}
          </Typography>
          <Tooltip title="Refresh health metrics">
            <IconButton size="small" onClick={fetchAllMetrics} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      {/* Enhanced Database Monitoring */}
      {databaseDetails && (
        <Box display="flex" gap={3} sx={{ flexDirection: { xs: 'column', md: 'row' } }}>
          <Box flex={1} minWidth={0} mb={{ xs: 2, md: 0 }}>
            <DatabaseConnectionsCard metrics={databaseDetails} />
          </Box>
          <Box flex={1} minWidth={0}>
            <PerformanceMetricsCard metrics={databaseDetails} />
          </Box>
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
