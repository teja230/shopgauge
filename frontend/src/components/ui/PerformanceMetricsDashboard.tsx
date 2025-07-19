import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  AlertTitle,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Button,
  CircularProgress
} from '@mui/material';
import { fetchWithAdminAuth } from '../../api';
import {
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface PerformanceMetrics {
  apiEndpoints: {
    responseTimes: Record<string, {
      totalRequests: number;
      averageResponseTimeMs: number;
      minResponseTimeMs: number;
      maxResponseTimeMs: number;
    }>;
    errorRates: Record<string, {
      totalRequests: number;
      totalErrors: number;
      errorRate: number;
      errorTypes: Record<string, number>;
    }>;
  };
  throughput: Record<string, {
    totalOperations: number;
    totalItems: number;
    averageItemsPerOperation: number;
    operationsPerMinute: number;
    itemsPerMinute: number;
  }>;
  cache: {
    cacheTypes: Record<string, {
      hits: number;
      misses: number;
      hitRate: number;
    }>;
    overallHitRate: number;
    dashboardCache?: any;
    alert?: string;
  };
  discovery: {
    totalOperations: number;
    successfulOperations: number;
    successRate: number;
    averageDurationMs: number;
    totalItemsProcessed: number;
    averageItemsPerOperation: number;
  };
  scraping: {
    totalOperations: number;
    successfulOperations: number;
    successRate: number;
    averageDurationMs: number;
    totalItemsProcessed: number;
    averageItemsPerOperation: number;
  };
  database: {
    statistics: any;
    connectionPool: any;
    marketIntelligence: any;
  };
  alerts: Record<string, any>;
  timestamp: string;
}

interface PerformanceMetricsDashboardProps {
  refreshInterval?: number;
}

const PerformanceMetricsDashboard: React.FC<PerformanceMetricsDashboardProps> = ({
  refreshInterval = 30000 // 30 seconds default
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    try {
      setError(null);
      const data = await fetchWithAdminAuth('/api/admin/performance/dashboard');
      setMetrics(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching performance metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch performance metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const handleRefresh = () => {
    setLoading(true);
    fetchMetrics();
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getStatusColor = (value: number, thresholds: { warning: number; critical: number }): 'error' | 'warning' | 'success' => {
    if (value >= thresholds.critical) return 'error';
    if (value >= thresholds.warning) return 'warning';
    return 'success';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircleIcon color="success" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'error': return <ErrorIcon color="error" />;
      default: return <CheckCircleIcon />;
    }
  };

  if (loading && !metrics) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading performance metrics...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        <AlertTitle>Error Loading Performance Metrics</AlertTitle>
        {error}
        <Button onClick={handleRefresh} sx={{ mt: 1 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (!metrics) {
    return (
      <Alert severity="info">
        <AlertTitle>No Performance Data</AlertTitle>
        No performance metrics available.
      </Alert>
    );
  }

  // Prepare chart data for API response times
  const responseTimeData = Object.entries(metrics.apiEndpoints.responseTimes).map(([endpoint, data]) => ({
    endpoint: endpoint.replace('/api/', ''),
    avgResponseTime: data.averageResponseTimeMs,
    minResponseTime: data.minResponseTimeMs,
    maxResponseTime: data.maxResponseTimeMs,
    requests: data.totalRequests
  }));

  // Prepare chart data for error rates
  const errorRateData = Object.entries(metrics.apiEndpoints.errorRates).map(([endpoint, data]) => ({
    endpoint: endpoint.replace('/api/', ''),
    errorRate: data.errorRate,
    totalErrors: data.totalErrors,
    totalRequests: data.totalRequests
  }));

  // Prepare cache performance data
  const cacheData = Object.entries(metrics.cache.cacheTypes).map(([type, data]) => ({
    type,
    hitRate: data.hitRate,
    hits: data.hits,
    misses: data.misses
  }));

  const hasAlerts = metrics.alerts && Object.keys(metrics.alerts).length > 0;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Performance Metrics Dashboard
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          {lastUpdated && (
            <Typography variant="body2" color="text.secondary">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </Typography>
          )}
          <Tooltip title="Refresh metrics">
            <IconButton onClick={handleRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Alerts Section */}
      {hasAlerts && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Performance Alerts</AlertTitle>
          <Box sx={{ mt: 1 }}>
            {Object.entries(metrics.alerts).map(([alertType, alertData]) => (
              <Chip
                key={alertType}
                label={`${alertType}: ${Array.isArray(alertData) ? alertData.join(', ') : alertData}`}
                color="warning"
                size="small"
                sx={{ mr: 1, mb: 1 }}
              />
            ))}
          </Box>
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Top Row - API Performance */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {/* API Endpoint Performance */}
          <Box sx={{ flex: '1 1 45%', minWidth: '400px' }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <SpeedIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">API Response Times</Typography>
                </Box>
                
                {responseTimeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={responseTimeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="endpoint" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <RechartsTooltip 
                        formatter={(value, name) => [
                          `${value}ms`,
                          name === 'avgResponseTime' ? 'Average' : 
                          name === 'minResponseTime' ? 'Minimum' : 'Maximum'
                        ]}
                      />
                      <Bar dataKey="avgResponseTime" fill="#8884d8" name="avgResponseTime" />
                      <Bar dataKey="maxResponseTime" fill="#82ca9d" name="maxResponseTime" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="text.secondary">No response time data available</Typography>
                )}
              </CardContent>
            </Card>
          </Box>

          {/* Error Rates */}
          <Box sx={{ flex: '1 1 45%', minWidth: '400px' }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <ErrorIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Error Rates</Typography>
                </Box>
                
                {errorRateData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={errorRateData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="endpoint" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <RechartsTooltip 
                        formatter={(value) => [`${value}%`, 'Error Rate']}
                      />
                      <Bar 
                        dataKey="errorRate" 
                        fill="#8884d8"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="text.secondary">No error rate data available</Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Second Row - Cache and Operations */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {/* Cache Performance */}
          <Box sx={{ flex: '1 1 45%', minWidth: '400px' }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <StorageIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Cache Performance</Typography>
                </Box>
                
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary">
                    Overall Hit Rate
                  </Typography>
                  <Box display="flex" alignItems="center">
                    <LinearProgress
                      variant="determinate"
                      value={metrics.cache.overallHitRate}
                      sx={{ flexGrow: 1, mr: 2 }}
                    />
                    <Typography variant="body2">
                      {metrics.cache.overallHitRate.toFixed(1)}%
                    </Typography>
                  </Box>
                </Box>

                {cacheData.length > 0 && (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Cache Type</TableCell>
                          <TableCell align="right">Hit Rate</TableCell>
                          <TableCell align="right">Hits</TableCell>
                          <TableCell align="right">Misses</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {cacheData.map((cache) => (
                          <TableRow key={cache.type}>
                            <TableCell>{cache.type}</TableCell>
                            <TableCell align="right">
                              <Chip
                                label={`${cache.hitRate.toFixed(1)}%`}
                                size="small"
                                color={getStatusColor(cache.hitRate, { warning: 70, critical: 50 })}
                              />
                            </TableCell>
                            <TableCell align="right">{formatNumber(cache.hits)}</TableCell>
                            <TableCell align="right">{formatNumber(cache.misses)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Box>

          {/* Discovery & Scraping Operations */}
          <Box sx={{ flex: '1 1 45%', minWidth: '400px' }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <TimelineIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Operations Performance</Typography>
                </Box>
                
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box textAlign="center" p={2} bgcolor="background.paper" borderRadius={1}>
                    <Typography variant="h4" color="primary">
                      {metrics.discovery.successRate.toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Discovery Success Rate
                    </Typography>
                    <Typography variant="caption" display="block">
                      {metrics.discovery.totalOperations} operations
                    </Typography>
                  </Box>
                  
                  <Box textAlign="center" p={2} bgcolor="background.paper" borderRadius={1}>
                    <Typography variant="h4" color="primary">
                      {metrics.scraping.successRate.toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Scraping Success Rate
                    </Typography>
                    <Typography variant="caption" display="block">
                      {metrics.scraping.totalOperations} operations
                    </Typography>
                  </Box>
                  
                  <Box textAlign="center" p={2} bgcolor="background.paper" borderRadius={1}>
                    <Typography variant="h4" color="secondary">
                      {formatDuration(metrics.discovery.averageDurationMs)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg Discovery Time
                    </Typography>
                  </Box>
                  
                  <Box textAlign="center" p={2} bgcolor="background.paper" borderRadius={1}>
                    <Typography variant="h4" color="secondary">
                      {formatDuration(metrics.scraping.averageDurationMs)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg Scraping Time
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Throughput Metrics */}
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <AssessmentIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Throughput Metrics</Typography>
            </Box>
            
            {Object.keys(metrics.throughput).length > 0 ? (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Operation</TableCell>
                      <TableCell align="right">Total Operations</TableCell>
                      <TableCell align="right">Total Items</TableCell>
                      <TableCell align="right">Avg Items/Operation</TableCell>
                      <TableCell align="right">Operations/Min</TableCell>
                      <TableCell align="right">Items/Min</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(metrics.throughput).map(([operation, data]) => (
                      <TableRow key={operation}>
                        <TableCell component="th" scope="row">
                          {operation}
                        </TableCell>
                        <TableCell align="right">{formatNumber(data.totalOperations)}</TableCell>
                        <TableCell align="right">{formatNumber(data.totalItems)}</TableCell>
                        <TableCell align="right">{data.averageItemsPerOperation.toFixed(1)}</TableCell>
                        <TableCell align="right">{data.operationsPerMinute?.toFixed(1) || 'N/A'}</TableCell>
                        <TableCell align="right">{data.itemsPerMinute?.toFixed(1) || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary">No throughput data available</Typography>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default PerformanceMetricsDashboard;