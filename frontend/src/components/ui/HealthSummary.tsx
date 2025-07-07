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
  IconButton
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningIcon from '@mui/icons-material/Warning';
import StorageIcon from '@mui/icons-material/Storage';
import DatabaseIcon from '@mui/icons-material/Storage';
import RefreshIcon from '@mui/icons-material/Refresh';
import SpeedIcon from '@mui/icons-material/Speed';
import TimerIcon from '@mui/icons-material/Timer';
import { getHealthSummary } from '../../api/index';
import { useServiceStatus } from '../../context/ServiceStatusContext';

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
        <Box flex={1} textAlign="center" sx={{ p: 2, bgcolor: 'success.50', borderRadius: 2 }}>
          <Typography variant="h5" color="success.main" fontWeight="bold">
            {metrics.totalConnections}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Total Connections
          </Typography>
        </Box>
        <Box flex={1} textAlign="center" sx={{ p: 2, bgcolor: 'info.50', borderRadius: 2 }}>
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

const HealthSummary: React.FC = () => {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [databaseDetails, setDatabaseDetails] = useState<DatabaseMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isServiceAvailable } = useServiceStatus();

  const fetchDatabaseDetails = async () => {
    try {
      const response = await fetch('/api/health/database-pool', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setDatabaseDetails(data);
      }
    } catch (e: any) {
      console.warn('Database details not available:', e.message);
    }
  };

  const fetchMetrics = async () => {
    if (!isServiceAvailable) {
      console.log('HealthSummary: Skipping health check - service not available');
      return;
    }

    setLoading(true);
    try {
      const data = await getHealthSummary();
      setMetrics(data);
      setError(null);
      
      // Also fetch detailed database metrics
      await fetchDatabaseDetails();
    } catch (e: any) {
      console.warn('Health metrics not available:', e.message);
      setMetrics({
        backendStatus: 'UNKNOWN',
        redisStatus: 'UNKNOWN',
        databaseStatus: 'UNKNOWN',
        systemStatus: 'UNKNOWN',
        lastUpdated: Date.now(),
        lastDeployCommit: 'unknown'
      });
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isServiceAvailable) {
      fetchMetrics();
    }
  }, [isServiceAvailable]);

  useEffect(() => {
    if (!isServiceAvailable || !metrics) {
      return;
    }

    // Refresh every 1 minute for real-time monitoring
    const interval = setInterval(fetchMetrics, 60_000);
    return () => clearInterval(interval);
  }, [isServiceAvailable, metrics]);

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
        <IconButton color="inherit" size="small" onClick={fetchMetrics}>
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
            <IconButton size="small" onClick={fetchMetrics} disabled={loading}>
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
    </Paper>
  );
};

export default HealthSummary; 