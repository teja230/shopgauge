import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Stack,
  LinearProgress,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  RestartAlt as RestartAltIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
// Custom fetch function for admin endpoints that doesn't require shop authentication
const fetchAdminEndpoint = async (url: string, options: RequestInit = {}) => {
  const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'https://api.shopgaugeai.com';
  const fullUrl = `${API_BASE_URL}${url}`;
  
  const response = await fetch(fullUrl, {
    ...options,
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
};

interface TransactionHealth {
  status: string;
  readOnlyViolations: number;
  totalTransactions: number;
  successRate: number;
  failureRate: number;
  avgResponseTime: number;
  lastViolationTime?: string;
  healthScore: number;
  alerts: string[];
}

interface TransactionMetrics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  readOnlyViolations: number;
  sessionUpdateFailures: number;
  avgResponseTime: number;
  peakResponseTime: number;
  violationsByType: Record<string, number>;
  errorsByCategory: Record<string, number>;
  hourlyMetrics: Array<{
    hour: string;
    transactions: number;
    violations: number;
    avgResponseTime: number;
  }>;
}

interface TransactionAlert {
  id: string;
  type: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  timestamp: string;
  resolved: boolean;
  category: string;
}

const MonitoringCard = styled(Card)(({ theme }) => ({
  borderRadius: 12,
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  border: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.3s ease',
  '&:hover': {
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.1)',
  },
}));

const MetricCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  textAlign: 'center',
  borderRadius: 12,
  border: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.3s ease',
  '&:hover': {
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
}));

const getHealthColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'healthy': return 'success';
    case 'warning': return 'warning';
    case 'critical': return 'error';
    default: return 'info';
  }
};

const getHealthIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case 'healthy': return <CheckCircleIcon />;
    case 'warning': return <WarningIcon />;
    case 'critical': return <ErrorIcon />;
    default: return <AssessmentIcon />;
  }
};

const TransactionMonitoring: React.FC = () => {
  const [health, setHealth] = useState<TransactionHealth | null>(null);
  const [metrics, setMetrics] = useState<TransactionMetrics | null>(null);
  const [alerts, setAlerts] = useState<TransactionAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchTransactionHealth = async () => {
    try {
      const response = await fetchAdminEndpoint('/api/health/transactions');
      setHealth(response as unknown as TransactionHealth);
    } catch (err) {
      console.error('Failed to fetch transaction health:', err);
      setError('Failed to fetch transaction health');
    }
  };

  const fetchTransactionMetrics = async () => {
    try {
      const response = await fetchAdminEndpoint('/api/metrics/transactions');
      setMetrics(response as unknown as TransactionMetrics);
    } catch (err) {
      console.error('Failed to fetch transaction metrics:', err);
      setError('Failed to fetch transaction metrics');
    }
  };

  const fetchTransactionAlerts = async () => {
    try {
      const response = await fetchAdminEndpoint('/api/alerts/transactions') as any;
      setAlerts(response.alerts || []);
    } catch (err) {
      console.error('Failed to fetch transaction alerts:', err);
      setError('Failed to fetch transaction alerts');
    }
  };

  const resetMetrics = async () => {
    try {
      await fetchAdminEndpoint('/api/metrics/transactions/reset', {
        method: 'POST',
      });
      await refreshAll();
    } catch (err) {
      console.error('Failed to reset metrics:', err);
      setError('Failed to reset metrics');
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchTransactionHealth(),
        fetchTransactionMetrics(),
        fetchTransactionAlerts(),
      ]);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to refresh monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshAll, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !health) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon sx={{ color: 'primary.main' }} />
            Transaction Monitoring
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time monitoring of database transactions and violations
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<RestartAltIcon />}
            onClick={resetMetrics}
            size="small"
            sx={{ borderRadius: 2 }}
          >
            Reset Metrics
          </Button>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={refreshAll}
            disabled={loading}
            size="small"
            sx={{ borderRadius: 2 }}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Health Status */}
      {health && (
        <MonitoringCard sx={{ mb: 3 }}>
          <CardHeader
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getHealthIcon(health.status)}
                <Typography variant="h6">System Health</Typography>
                <Chip
                  label={health.status.toUpperCase()}
                  color={getHealthColor(health.status)}
                  size="small"
                />
              </Box>
            }
            subheader={`Last updated: ${lastRefresh.toLocaleTimeString()}`}
          />
          <CardContent>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 3 }}>
              <MetricCard>
                <Typography variant="h4" color="primary.main" fontWeight="bold">
                  {health.healthScore}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Health Score
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={health.healthScore}
                  sx={{ mt: 1, borderRadius: 1 }}
                  color={health.healthScore > 90 ? 'success' : health.healthScore > 70 ? 'warning' : 'error'}
                />
              </MetricCard>
              
              <MetricCard>
                <Typography variant="h4" color="error.main" fontWeight="bold">
                  {health.readOnlyViolations}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Read-Only Violations
                </Typography>
                {health.readOnlyViolations > 0 && (
                  <Chip label="CRITICAL" color="error" size="small" sx={{ mt: 1 }} />
                )}
              </MetricCard>
              
              <MetricCard>
                <Typography variant="h4" color="success.main" fontWeight="bold">
                  {health.successRate.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Success Rate
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
                  {health.successRate > 95 ? (
                    <TrendingUpIcon color="success" fontSize="small" />
                  ) : (
                    <TrendingDownIcon color="error" fontSize="small" />
                  )}
                </Box>
              </MetricCard>
              
              <MetricCard>
                <Typography variant="h4" color="info.main" fontWeight="bold">
                  {health.avgResponseTime}ms
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg Response Time
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
                  <SpeedIcon color="info" fontSize="small" />
                </Box>
              </MetricCard>
            </Box>

            {health.alerts && health.alerts.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Active Alerts</Typography>
                {health.alerts.map((alert, index) => (
                  <Alert key={index} severity="warning" sx={{ mb: 1, borderRadius: 2 }}>
                    {alert}
                  </Alert>
                ))}
              </Box>
            )}
          </CardContent>
        </MonitoringCard>
      )}

      {/* Detailed Metrics */}
      {metrics && (
        <MonitoringCard sx={{ mb: 3 }}>
          <CardHeader
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssessmentIcon />
                <Typography variant="h6">Detailed Metrics</Typography>
              </Box>
            }
          />
          <CardContent>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>Transaction Statistics</Typography>
                <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Metric</strong></TableCell>
                        <TableCell align="right"><strong>Value</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>Total Transactions</TableCell>
                        <TableCell align="right">{metrics.totalTransactions.toLocaleString()}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Successful</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main' }}>
                          {metrics.successfulTransactions.toLocaleString()}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Failed</TableCell>
                        <TableCell align="right" sx={{ color: 'error.main' }}>
                          {metrics.failedTransactions.toLocaleString()}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Read-Only Violations</TableCell>
                        <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                          {metrics.readOnlyViolations.toLocaleString()}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Session Update Failures</TableCell>
                        <TableCell align="right" sx={{ color: 'warning.main' }}>
                          {metrics.sessionUpdateFailures.toLocaleString()}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Peak Response Time</TableCell>
                        <TableCell align="right">{metrics.peakResponseTime}ms</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>Violation Breakdown</Typography>
                <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Violation Type</strong></TableCell>
                        <TableCell align="right"><strong>Count</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(metrics.violationsByType || {}).map(([type, count]) => (
                        <TableRow key={type}>
                          <TableCell>{type}</TableCell>
                          <TableCell align="right" sx={{ color: 'error.main' }}>
                            {count.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      {Object.keys(metrics.violationsByType || {}).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} align="center" sx={{ color: 'success.main' }}>
                            No violations detected
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Box>

            {/* Hourly Metrics Chart */}
            {metrics.hourlyMetrics && metrics.hourlyMetrics.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Hourly Transaction Metrics</Typography>
                <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Hour</strong></TableCell>
                        <TableCell align="right"><strong>Transactions</strong></TableCell>
                        <TableCell align="right"><strong>Violations</strong></TableCell>
                        <TableCell align="right"><strong>Avg Response (ms)</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {metrics.hourlyMetrics.slice(-12).map((metric, index) => (
                        <TableRow key={index}>
                          <TableCell>{metric.hour}</TableCell>
                          <TableCell align="right">{metric.transactions.toLocaleString()}</TableCell>
                          <TableCell align="right" sx={{ color: metric.violations > 0 ? 'error.main' : 'success.main' }}>
                            {metric.violations.toLocaleString()}
                          </TableCell>
                          <TableCell align="right">{metric.avgResponseTime}ms</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </CardContent>
        </MonitoringCard>
      )}

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <MonitoringCard>
          <CardHeader
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon />
                <Typography variant="h6">Transaction Alerts</Typography>
                <Chip label={alerts.length} color="warning" size="small" />
              </Box>
            }
          />
          <CardContent>
            <Stack spacing={2}>
              {alerts.map((alert) => (
                <Alert
                  key={alert.id}
                  severity={alert.type.toLowerCase() as 'error' | 'warning' | 'info'}
                  sx={{ borderRadius: 2 }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight="600">
                      {alert.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {alert.category} • {new Date(alert.timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                </Alert>
              ))}
            </Stack>
          </CardContent>
        </MonitoringCard>
      )}
    </Box>
  );
};

export default TransactionMonitoring;