import React, { useEffect, useState } from 'react';
import { Paper, Typography, Box, CircularProgress, Alert, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningIcon from '@mui/icons-material/Warning';
import StorageIcon from '@mui/icons-material/Storage';
import DatabaseIcon from '@mui/icons-material/Storage';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getHealthSummary } from '../../api/index';
import { useServiceStatus } from '../../context/ServiceStatusContext';

interface HealthMetrics {
  backendStatus: string;
  redisStatus: string;
  databaseStatus: string;
  systemStatus: string;
  lastUpdated: number;
  lastDeployCommit: string;
}

const StatusChip: React.FC<{
  status: string;
  label: string;
  icon: React.ReactElement;
}> = ({ status, label, icon }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UP':
        return 'success';
      case 'DOWN':
        return 'error';
      case 'DEGRADED':
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

const HealthSummary: React.FC = () => {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isServiceAvailable } = useServiceStatus();

  const fetchMetrics = async () => {
    // Don't fetch if service is not available
    if (!isServiceAvailable) {
      console.log('HealthSummary: Skipping health check - service not available');
      return;
    }

    setLoading(true);
    try {
      const data = await getHealthSummary();
      setMetrics(data);
      setError(null);
    } catch (e: any) {
      console.warn('Health metrics not available:', e.message);
      // Don't show error, just use default values
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
    // Only fetch if service is available
    if (isServiceAvailable) {
      fetchMetrics();
    }
  }, [isServiceAvailable]);

  useEffect(() => {
    // Only set up interval if service is available
    if (!isServiceAvailable) {
      return;
    }

    const interval = setInterval(fetchMetrics, 60_000); // refresh every 60 seconds instead of 30
    return () => clearInterval(interval);
  }, [isServiceAvailable]);

  // Don't show loading state if service is not available
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
      <Alert severity="error" action={<RefreshIcon onClick={fetchMetrics} />}>{error}</Alert>
    );
  }

  if (!metrics) return null;

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Paper sx={{ p: 3, mb: 3, borderRadius: 3, bgcolor: 'grey.50' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          System Health Status
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Last updated: {formatTime(metrics.lastUpdated)}
        </Typography>
      </Box>
      
      <Box display="flex" flexDirection="column" gap={2}>
        <Box display="flex" flexWrap="wrap" gap={2}>
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
        
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="caption" color="text.secondary">
            Deploy: {metrics.lastDeployCommit?.substring(0, 7) || 'unknown'}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default HealthSummary; 