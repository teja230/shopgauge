import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Button,
  IconButton,
  Alert,
  AlertTitle,
  Tooltip,
  CircularProgress,
  Paper,
  Divider,
  Stack,
  Badge,
} from '@mui/material';

import {
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  BugReport as BugReportIcon,
  Healing as HealingIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { fetchWithAuth } from '../../api';

interface PoolMetrics {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  threadsAwaitingConnection: number;
  maxPoolSize: number;
  minimumIdle: number;
  activeUsagePercent: number;
  poolStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  connectionLeakRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  emergencyCleanupNeeded: boolean;
}

interface RedisMetrics {
  healthy: boolean;
  responseTimeMs: number;
  performanceStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'failed';
  consecutiveFailures: number;
  lastHealthCheck: string;
  version?: string;
  connectedClients?: number;
  usedMemory?: string;
}

interface JvmMetrics {
  usedMemory: number;
  maxMemory: number;
  usedPercentage: number;
  freeMemory: number;
  totalMemory: number;
}

interface TransactionMetrics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  successRate: number;
  readOnlyViolations: number;
  timeoutViolations: number;
  isHealthy: boolean;
}

interface SessionMetrics {
  totalActiveSessions: number;
  currentlyActiveSessions: number;
  shopsWithMultipleSessions: number;
  averageSessionsPerShop: number;
  sessionsActiveLastDay: number;
  sessionsActiveLastWeek: number;
}

interface SystemMetrics {
  poolMetrics: PoolMetrics;
  redisMetrics: RedisMetrics;
  jvmMetrics: JvmMetrics;
  transactionMetrics: TransactionMetrics;
  sessionMetrics: SessionMetrics;
  systemHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
}

interface HistoricalData {
  timestamp: string;
  activeConnections: number;
  poolUtilization: number;
  connectionTime: number;
}

interface ConnectionPoolDashboardProps {
  isEmergencyMode?: boolean;
  showActions?: boolean;
}

const ConnectionPoolDashboard: React.FC<ConnectionPoolDashboardProps> = ({
  isEmergencyMode = false,
  showActions = true,
}) => {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch comprehensive system health metrics
      const [poolResponse, redisResponse, systemResponse, transactionResponse, sessionResponse] = await Promise.all([
        fetchWithAuth('/api/health/connection-leak-status'),
        fetchWithAuth('/api/health/redis'),
        fetchWithAuth('/api/health/system'),
        fetchWithAuth('/api/health/transactions'),
        fetchWithAuth('/api/admin/session-statistics').catch(() => ({ ok: false })) // May not be available
      ]);

      if (!poolResponse.ok) {
        throw new Error(`Connection pool fetch failed: HTTP ${poolResponse.status}`);
      }

      const poolData = await poolResponse.json();
      const redisData = redisResponse.ok ? await redisResponse.json() : null;
      const systemData = systemResponse.ok ? await systemResponse.json() : null;
      const transactionData = transactionResponse.ok ? await transactionResponse.json() : null;
      const sessionData = sessionResponse.ok ? await (sessionResponse as Response).json() : null;

      // Extract pool metrics
      const poolMetrics: PoolMetrics = {
        activeConnections: poolData.hikariMetrics?.activeConnections || 0,
        idleConnections: poolData.hikariMetrics?.idleConnections || 0,
        totalConnections: poolData.hikariMetrics?.totalConnections || 0,
        threadsAwaitingConnection: poolData.hikariMetrics?.threadsAwaitingConnection || 0,
        maxPoolSize: poolData.hikariMetrics?.maxPoolSize || 20,
        minimumIdle: poolData.hikariMetrics?.minimumIdle || 5,
        activeUsagePercent: poolData.hikariMetrics?.usagePercentage || 0,
        poolStatus: poolData.poolStatus || 'UNKNOWN',
        connectionLeakRisk: poolData.connectionLeakRisk || 'LOW',
        emergencyCleanupNeeded: poolData.emergencyCleanupNeeded || false,
      };

      // Extract Redis metrics
      const redisMetrics: RedisMetrics = {
        healthy: redisData?.healthy || false,
        responseTimeMs: redisData?.responseTimeMs || -1,
        performanceStatus: redisData?.performanceStatus || 'failed',
        consecutiveFailures: redisData?.consecutiveFailures || 0,
        lastHealthCheck: redisData?.lastHealthCheck || 'Unknown',
        version: redisData?.version,
        connectedClients: redisData?.connectedClients,
        usedMemory: redisData?.usedMemory,
      };

      // Extract JVM metrics
      const jvmMetrics: JvmMetrics = {
        usedMemory: systemData?.jvmMemory?.usedMemory || 0,
        maxMemory: systemData?.jvmMemory?.maxMemory || 0,
        usedPercentage: systemData?.jvmMemory?.usedPercentage || 0,
        freeMemory: systemData?.jvmMemory?.freeMemory || 0,
        totalMemory: systemData?.jvmMemory?.totalMemory || 0,
      };

      // Extract transaction metrics
      const transactionMetrics: TransactionMetrics = {
        totalTransactions: transactionData?.total_transactions || 0,
        successfulTransactions: transactionData?.successful_transactions || 0,
        failedTransactions: transactionData?.failed_transactions || 0,
        successRate: transactionData?.success_rate || 0,
        readOnlyViolations: transactionData?.read_only_violations || 0,
        timeoutViolations: transactionData?.timeout_violations || 0,
        isHealthy: transactionData?.isHealthy || true,
      };

      // Extract session metrics
      const sessionMetrics: SessionMetrics = {
        totalActiveSessions: sessionData?.totalActiveSessions || 0,
        currentlyActiveSessions: sessionData?.currentlyActiveSessions || 0,
        shopsWithMultipleSessions: sessionData?.shopsWithMultipleSessions || 0,
        averageSessionsPerShop: sessionData?.averageSessionsPerShop || 0,
        sessionsActiveLastDay: sessionData?.sessionsActiveLastDay || 0,
        sessionsActiveLastWeek: sessionData?.sessionsActiveLastWeek || 0,
      };

      // Determine overall system health
      let systemHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
      if (poolMetrics.poolStatus === 'CRITICAL' || !redisMetrics.healthy || !transactionMetrics.isHealthy) {
        systemHealth = 'CRITICAL';
      } else if (poolMetrics.poolStatus === 'WARNING' || redisMetrics.performanceStatus === 'poor') {
        systemHealth = 'DEGRADED';
      }

      const metrics: SystemMetrics = {
        poolMetrics,
        redisMetrics,
        jvmMetrics,
        transactionMetrics,
        sessionMetrics,
        systemHealth,
      };

      setSystemMetrics(metrics);
      setLastUpdated(new Date());

      // Add to historical data
      const historicalPoint: HistoricalData = {
        timestamp: new Date().toLocaleTimeString(),
        activeConnections: poolMetrics.activeConnections,
        poolUtilization: poolMetrics.activeUsagePercent,
        connectionTime: redisMetrics.responseTimeMs > 0 ? redisMetrics.responseTimeMs : Math.random() * 100 + 50,
      };

      setHistoricalData(prev => [...prev.slice(-19), historicalPoint]);

    } catch (err) {
      console.error('Failed to fetch system metrics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const performEmergencyCleanup = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth('/api/health/emergency-cleanup', { method: 'POST' });
      
      if (!response.ok) {
        throw new Error(`Cleanup failed: HTTP ${response.status}`);
      }

      // Refresh metrics after cleanup
      setTimeout(fetchMetrics, 2000);
    } catch (err) {
      console.error('Emergency cleanup failed:', err);
      setError(err instanceof Error ? err.message : 'Cleanup failed');
    } finally {
      setLoading(false);
    }
  };

  const performComprehensiveCleanup = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth('/api/admin/emergency/comprehensive-cleanup', { method: 'POST' });
      
      if (!response.ok) {
        throw new Error(`Comprehensive cleanup failed: HTTP ${response.status}`);
      }

      // Refresh metrics after cleanup
      setTimeout(fetchMetrics, 3000);
    } catch (err) {
      console.error('Comprehensive cleanup failed:', err);
      setError(err instanceof Error ? err.message : 'Comprehensive cleanup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = () => {
    if (refreshCooldown > 0) return;
    
    fetchMetrics();
    setRefreshCooldown(180); // 3 minutes in seconds
    
    cooldownRef.current = setInterval(() => {
      setRefreshCooldown(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) {
            clearInterval(cooldownRef.current);
            cooldownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    fetchMetrics();
    
    return () => {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
      }
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY': return '#4caf50';
      case 'WARNING': return '#ff9800';
      case 'CRITICAL': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY': return <CheckCircleIcon sx={{ color: '#4caf50' }} />;
      case 'WARNING': return <WarningIcon sx={{ color: '#ff9800' }} />;
      case 'CRITICAL': return <ErrorIcon sx={{ color: '#f44336' }} />;
      default: return <InfoIcon sx={{ color: '#9e9e9e' }} />;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW': return '#4caf50';
      case 'MEDIUM': return '#ff9800';
      case 'HIGH': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const pieData = systemMetrics ? [
    { name: 'Active', value: systemMetrics.poolMetrics.activeConnections, color: '#2196f3' },
    { name: 'Idle', value: systemMetrics.poolMetrics.idleConnections, color: '#4caf50' },
    { name: 'Available', value: systemMetrics.poolMetrics.maxPoolSize - systemMetrics.poolMetrics.totalConnections, color: '#e0e0e0' },
  ] : [];

  if (error && !systemMetrics) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        <AlertTitle>Connection Pool Dashboard Error</AlertTitle>
        {error}
        <Button onClick={fetchMetrics} startIcon={<RefreshIcon />} sx={{ mt: 1 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <StorageIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" fontWeight="600">
              Connection Pool Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Real-time monitoring and health metrics
              {lastUpdated && ` • Last updated: ${lastUpdated.toLocaleTimeString()}`}
            </Typography>
          </Box>
        </Box>
        
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={handleManualRefresh}
            disabled={loading || refreshCooldown > 0}
          >
            {refreshCooldown > 0 ? `Refresh (${Math.floor(refreshCooldown / 60)}:${String(refreshCooldown % 60).padStart(2, '0')})` : 'Refresh'}
          </Button>
          
          {showActions && systemMetrics?.poolMetrics.emergencyCleanupNeeded && (
            <>
              <Button
                variant="contained"
                color="error"
                startIcon={<HealingIcon />}
                onClick={performEmergencyCleanup}
                disabled={loading}
              >
                Emergency Cleanup
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<WarningIcon />}
                onClick={performComprehensiveCleanup}
                disabled={loading}
                sx={{ fontWeight: 'bold' }}
              >
                Comprehensive Cleanup
              </Button>
            </>
          )}
        </Stack>
      </Box>

      {/* Emergency Alert */}
      {systemMetrics?.poolMetrics.emergencyCleanupNeeded && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>🚨 Emergency Action Required</AlertTitle>
          Connection pool usage is critically high. Emergency cleanup is recommended.
        </Alert>
      )}

      {/* Key Metrics Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 3, mb: 3 }}>
        {/* Pool Status */}
        <Box>
          <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${getStatusColor(systemMetrics?.poolMetrics.poolStatus || 'UNKNOWN')}15, ${getStatusColor(systemMetrics?.poolMetrics.poolStatus || 'UNKNOWN')}05)` }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold" color={getStatusColor(systemMetrics?.poolMetrics.poolStatus || 'UNKNOWN')}>
                    {systemMetrics?.poolMetrics.poolStatus || 'UNKNOWN'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pool Status
                  </Typography>
                </Box>
                {getStatusIcon(systemMetrics?.poolMetrics.poolStatus || 'UNKNOWN')}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Active Connections */}
        <Box>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="primary.main">
                    {systemMetrics?.poolMetrics.activeConnections || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Connections
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    of {systemMetrics?.poolMetrics.maxPoolSize || 0} max
                  </Typography>
                </Box>
                <TimelineIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.7 }} />
              </Box>
              <LinearProgress
                variant="determinate"
                value={systemMetrics ? (systemMetrics.poolMetrics.activeConnections / systemMetrics.poolMetrics.maxPoolSize) * 100 : 0}
                sx={{ mt: 1, height: 6, borderRadius: 3 }}
              />
            </CardContent>
          </Card>
        </Box>

        {/* Pool Utilization */}
        <Box>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold" 
                    color={systemMetrics && systemMetrics.poolMetrics.activeUsagePercent > 85 ? 'error.main' : 
                           systemMetrics && systemMetrics.poolMetrics.activeUsagePercent > 70 ? 'warning.main' : 'success.main'}>
                    {systemMetrics?.poolMetrics.activeUsagePercent || 0}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pool Utilization
                  </Typography>
                </Box>
                <SpeedIcon sx={{ fontSize: 40, color: 'secondary.main', opacity: 0.7 }} />
              </Box>
              <LinearProgress
                variant="determinate"
                value={systemMetrics?.poolMetrics.activeUsagePercent || 0}
                color={systemMetrics && systemMetrics.poolMetrics.activeUsagePercent > 85 ? 'error' : 
                       systemMetrics && systemMetrics.poolMetrics.activeUsagePercent > 70 ? 'warning' : 'success'}
                sx={{ mt: 1, height: 6, borderRadius: 3 }}
              />
            </CardContent>
          </Card>
        </Box>

        {/* Leak Risk */}
        <Box>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Chip
                    label={systemMetrics?.poolMetrics.connectionLeakRisk || 'UNKNOWN'}
                    color={systemMetrics?.poolMetrics.connectionLeakRisk === 'LOW' ? 'success' : 
                           systemMetrics?.poolMetrics.connectionLeakRisk === 'MEDIUM' ? 'warning' : 'error'}
                    variant="filled"
                    sx={{ fontWeight: 'bold' }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Leak Risk Level
                  </Typography>
                </Box>
                <BugReportIcon sx={{ fontSize: 40, color: getRiskColor(systemMetrics?.poolMetrics.connectionLeakRisk || 'LOW'), opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Charts Section */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3, mb: 3 }}>
        {/* Historical Trend */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon />
                Connection Pool Trends
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="timestamp" stroke="#666" fontSize={12} />
                    <YAxis stroke="#666" fontSize={12} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="activeConnections"
                      stroke="#2196f3"
                      strokeWidth={2}
                      dot={false}
                      name="Active Connections"
                    />
                    <Line
                      type="monotone"
                      dataKey="poolUtilization"
                      stroke="#ff9800"
                      strokeWidth={2}
                      dot={false}
                      name="Pool Utilization %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Connection Distribution */}
        <Box>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MemoryIcon />
                Connection Distribution
              </Typography>
              <Box sx={{ height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value, name) => [`${value} connections`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1 }}>
                  {pieData.map((entry, index) => (
                    <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: entry.color,
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {entry.name}: {entry.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Metrics */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Detailed Metrics
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                <Typography variant="h5" color="primary.main" fontWeight="bold">
                  {systemMetrics?.poolMetrics.totalConnections || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Connections
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                <Typography variant="h5" color="success.main" fontWeight="bold">
                  {systemMetrics?.poolMetrics.idleConnections || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Idle Connections
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                <Typography variant="h5" color="warning.main" fontWeight="bold">
                  {systemMetrics?.poolMetrics.threadsAwaitingConnection || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Waiting Threads
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                <Typography variant="h5" color="info.main" fontWeight="bold">
                  {systemMetrics?.poolMetrics.minimumIdle || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Minimum Idle
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ConnectionPoolDashboard; 