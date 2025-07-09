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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningIcon from '@mui/icons-material/Warning';
import StorageIcon from '@mui/icons-material/Storage';
import DatabaseIcon from '@mui/icons-material/Storage';
import RefreshIcon from '@mui/icons-material/Refresh';
import SpeedIcon from '@mui/icons-material/Speed';
import TimerIcon from '@mui/icons-material/Timer';
import ClearIcon from '@mui/icons-material/Clear';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import { useServiceStatus } from '../../context/ServiceStatusContext';
import { debugLog } from './DebugPanel';
import { useNotifications } from '../../hooks/useNotifications';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Centralized admin fetcher
const fetchAdminEndpoint = async (endpoint: string, options?: RequestInit) => {
  const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const response = await fetch(fullUrl, {
    credentials: 'include', // Important for sending the admin_token cookie
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Admin endpoint ${endpoint} failed with status ${response.status}:`, errorBody);
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
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <TimerIcon color="primary" />
        Performance Metrics
      </Typography>
      
      <Box display="flex" gap={2} mb={2}>
        <Box flex={1} textAlign="center" sx={{ p: 2, bgcolor: 'rgba(46, 125, 50, 0.1)', borderRadius: 2 }}>
          <Typography variant="h5" color="success.main" fontWeight="bold">
            {metrics.totalConnections}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Total Connections
          </Typography>
        </Box>
        <Box flex={1} textAlign="center" sx={{ p: 2, bgcolor: 'rgba(2, 136, 209, 0.1)', borderRadius: 2 }}>
          <Typography variant="h5" color="info.main" fontWeight="bold">
            {metrics.minimumIdle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Min Idle
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" sx={{ mb: 1 }}>Health Status</Typography>
        <Chip 
          label={metrics.healthStatus}
          color={metrics.healthStatus === 'HEALTHY' ? 'success' : 'error'}
          sx={{ width: '100%', fontWeight: 'bold' }}
        />
      </Box>

      {metrics.lastFailureTime > 0 && (
        <Alert severity="warning" sx={{ mt: 2, py: 0.5 }}>
          <Typography variant="body2">
            Last failure: {new Date(metrics.lastFailureTime).toLocaleString()}
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
      const [healthData, dbDetailsData] = await Promise.all([
        fetchAdminEndpoint('/api/health/summary'),
        fetchAdminEndpoint('/api/health/database-pool') 
      ]);
      
      setMetrics(healthData);
      setDatabaseDetails(dbDetailsData);
      
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
      // Use the admin endpoint for this action
      await fetchAdminEndpoint('/api/admin/cache/invalidate', { method: 'POST' });
      addNotification('Cache cleared successfully', 'success');
      await fetchAllMetrics(); // Refresh health data
    } catch (e: any) {
      debugLog.warn('Failed to clear cache:', e.message, 'EnhancedHealthSummary');
      addNotification('Failed to clear cache', 'error');
    }
  };

  const handleForceRedisCheck = async () => {
    try {
      // Use the admin endpoint for this action
      await fetchAdminEndpoint('/api/admin/health/redis-check', { method: 'POST' });
      addNotification('Redis health check completed', 'success');
      await fetchAllMetrics(); // Refresh health data
    } catch (e: any) {
      debugLog.warn('Failed to force Redis check:', e.message, 'EnhancedHealthSummary');
      addNotification('Failed to force Redis check', 'error');
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3, borderRadius: 3, bgcolor: 'grey.50' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SpeedIcon color="primary" />
          System Health & Performance
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="caption" color="text.secondary">
            Last updated: {formatTime(metrics.lastUpdated)}
          </Typography>
          <Tooltip title="Refresh health metrics">
            <IconButton size="small" onClick={fetchAllMetrics} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* Overall Status Chips */}
      <Box display="flex" flexWrap="wrap" gap={2} mb={3}>
        <StatusChip
          status={metrics.systemStatus}
          label="System"
          icon={metrics.systemStatus === 'UP' ? <CheckCircleIcon /> : 
                metrics.systemStatus === 'DEGRADED' ? <WarningIcon /> : <ErrorOutlineIcon />}
        />
        <StatusChip
          status={metrics.backendStatus}
          label="Backend"
          icon={metrics.backendStatus === 'UP' ? <CheckCircleIcon /> : <ErrorOutlineIcon />}
        />
        <StatusChip
          status={metrics.redisStatus}
          label="Redis"
          icon={<StorageIcon />}
        />
        <StatusChip
          status={metrics.databaseStatus}
          label="Database"
          icon={<DatabaseIcon />}
        />
      </Box>

      {/* Enhanced Database Monitoring */}
      {databaseDetails && (
        <Box display="flex" gap={3} sx={{ flexDirection: { xs: 'column', md: 'row' } }}>
          <Box flex={1}>
            <DatabaseConnectionsCard metrics={databaseDetails} />
          </Box>
          <Box flex={1}>
            <PerformanceMetricsCard metrics={databaseDetails} />
          </Box>
        </Box>
      )}
      
      <Box display="flex" alignItems="center" gap={1} mt={2}>
        <Typography variant="caption" color="text.secondary">
          Deploy: {metrics.lastDeployCommit?.substring(0, 7) || 'unknown'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          •
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Monitoring: Real-time database pool status
        </Typography>
      </Box>

             <Box display="flex" justifyContent="flex-end" gap={2} mt={2}>
         <Button
           variant="outlined"
           color="error"
           startIcon={<ClearIcon />}
           onClick={handleClearCache}
         >
           Clear Cache
         </Button>
         <Button
           variant="outlined"
           color="primary"
           startIcon={<HealthAndSafetyIcon />}
           onClick={handleForceRedisCheck}
         >
           Force Redis Check
         </Button>
      </Box>
    </Paper>
  );
};

export default EnhancedHealthSummary;
