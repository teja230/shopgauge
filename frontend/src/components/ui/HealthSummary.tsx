import React, { useEffect, useState } from 'react';
import { Paper, Typography, Box, CircularProgress, Alert } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import StorageIcon from '@mui/icons-material/Storage';
import GitCommitIcon from '@mui/icons-material/Commit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getHealthSummary } from '../../api/index';

interface HealthMetrics {
  p95LatencyMs: number;
  errorRate: number;
  queueDepth: number;
  lastDeployCommit: string;
  timestamp: number;
}

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}> = ({ label, value, icon, color }) => (
  <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'white', border: '1px solid #e0e0e0' }}>
    <Box display="flex" alignItems="center" gap={2}>
      <Box sx={{ color, display: 'flex' }}>{icon}</Box>
      <Box>
        <Typography variant="h5" fontWeight="bold">
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Box>
  </Paper>
);

const HealthSummary: React.FC = () => {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const data = await getHealthSummary();
      setMetrics(data);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60_000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

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

  return (
    <Paper sx={{ p: 3, mb: 3, borderRadius: 3, bgcolor: 'grey.50' }}>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        System Health Summary
      </Typography>
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }} gap={3}>
        <Box>
          <MetricCard
            label="p95 Latency (ms)"
            value={metrics.p95LatencyMs}
            icon={<TrendingUpIcon />}
            color="#1e40af"
          />
        </Box>
        <Box>
          <MetricCard
            label="5xx Error Rate (%)"
            value={(metrics.errorRate * 100).toFixed(2)}
            icon={<ErrorOutlineIcon />}
            color="#dc2626"
          />
        </Box>
        <Box>
          <MetricCard
            label="Queue Depth"
            value={metrics.queueDepth}
            icon={<StorageIcon />}
            color="#059669"
          />
        </Box>
        <Box>
          <MetricCard
            label="Last Deploy Commit"
            value={metrics.lastDeployCommit?.substring(0, 7) || 'unknown'}
            icon={<GitCommitIcon />}
            color="#7c3aed"
          />
        </Box>
      </Box>
    </Paper>
  );
};

export default HealthSummary; 