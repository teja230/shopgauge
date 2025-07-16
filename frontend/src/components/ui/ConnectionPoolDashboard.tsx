import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Button,
  Alert,
  AlertTitle,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  TrendingUp as TrendingUpIcon,
  BugReport as BugReportIcon,
  Healing as HealingIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import RefreshHeader from './RefreshHeader';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const fetchAdminEndpoint = async (endpoint: string, options?: RequestInit) => {
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
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (cooldownRef.current) {
        clearTimeout(cooldownRef.current);
      }
    };
  }, []);

  const fetchMetrics = async () => {
    if (!isMountedRef.current) return;
    
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      // Use enhanced connection pool dashboard endpoint for comprehensive data
      const [poolResponse, redisResponse, systemResponse, transactionResponse, sessionResponse] = await Promise.all([
        fetchAdminEndpoint('/api/admin/connection-pool/dashboard').catch(() => 
          fetchAdminEndpoint('/api/health/connection-leak-status') // Fallback to old endpoint
        ),
        fetchAdminEndpoint('/api/health/redis'),
        fetchAdminEndpoint('/api/health/system'),
        fetchAdminEndpoint('/api/health/transactions'),
        fetchAdminEndpoint('/api/admin/session-statistics').catch(() => ({ ok: false }))
      ]);

      if (!poolResponse.ok) {
        throw new Error(`Connection pool fetch failed: HTTP ${poolResponse.status}`);
      }

      const poolData = await poolResponse.json();
      const redisData = redisResponse.ok ? await redisResponse.json() : null;
      const systemData = systemResponse.ok ? await systemResponse.json() : null;
      const transactionData = transactionResponse.ok ? await transactionResponse.json() : null;
      const sessionData = sessionResponse.ok ? await (sessionResponse as Response).json() : null;

      // Handle both new enhanced endpoint format and legacy format
      const isEnhancedFormat = poolData.connection_pool && poolData.query_cache;
      
      const poolMetrics: PoolMetrics = isEnhancedFormat ? {
        // New enhanced endpoint format
        activeConnections: poolData.connection_pool?.active_connections || 0,
        idleConnections: poolData.connection_pool?.idle_connections || 0,
        totalConnections: poolData.connection_pool?.total_connections || 0,
        threadsAwaitingConnection: poolData.connection_pool?.threads_waiting || 0,
        maxPoolSize: poolData.connection_pool?.total_connections || 20,
        minimumIdle: 5, // Not provided in new format, use default
        activeUsagePercent: (poolData.connection_pool?.utilization_ratio || 0) * 100,
        poolStatus: poolData.connection_pool?.healthy ? 'HEALTHY' : 'CRITICAL',
        connectionLeakRisk: poolData.connection_pool?.leak_count > 5 ? 'HIGH' : 
                           poolData.connection_pool?.leak_count > 2 ? 'MEDIUM' : 'LOW',
        emergencyCleanupNeeded: poolData.connection_pool?.threads_waiting > 0 || 
                               (poolData.connection_pool?.utilization_ratio || 0) > 0.9,
      } : {
        // Legacy endpoint format
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

      const jvmMetrics: JvmMetrics = {
        usedMemory: systemData?.jvmMemory?.usedMemory || 0,
        maxMemory: systemData?.jvmMemory?.maxMemory || 0,
        usedPercentage: systemData?.jvmMemory?.usedPercentage || 0,
        freeMemory: systemData?.jvmMemory?.freeMemory || 0,
        totalMemory: systemData?.jvmMemory?.totalMemory || 0,
      };

      const transactionMetrics: TransactionMetrics = {
        totalTransactions: transactionData?.total_transactions || 0,
        successfulTransactions: transactionData?.successful_transactions || 0,
        failedTransactions: transactionData?.failed_transactions || 0,
        successRate: transactionData?.success_rate || 0,
        readOnlyViolations: transactionData?.read_only_violations || 0,
        timeoutViolations: transactionData?.timeout_violations || 0,
        isHealthy: transactionData?.isHealthy || true,
      };

      const sessionMetrics: SessionMetrics = {
        totalActiveSessions: sessionData?.totalActiveSessions || 0,
        currentlyActiveSessions: sessionData?.currentlyActiveSessions || 0,
        shopsWithMultipleSessions: sessionData?.shopsWithMultipleSessions || 0,
        averageSessionsPerShop: sessionData?.averageSessionsPerShop || 0,
        sessionsActiveLastDay: sessionData?.sessionsActiveLastDay || 0,
        sessionsActiveLastWeek: sessionData?.sessionsActiveLastWeek || 0,
      };

      const combinedMetrics: SystemMetrics = {
        poolMetrics,
        redisMetrics,
        jvmMetrics,
        transactionMetrics,
        sessionMetrics,
        systemHealth: poolMetrics.poolStatus === 'HEALTHY' && redisMetrics.healthy ? 'HEALTHY' : 
                     poolMetrics.poolStatus === 'CRITICAL' || !redisMetrics.healthy ? 'CRITICAL' : 'DEGRADED'
      };

      if (isMountedRef.current) {
        setSystemMetrics(combinedMetrics);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch connection pool metrics:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const performEmergencyCleanup = async () => {
    try {
      const response = await fetchAdminEndpoint('/api/health/emergency-cleanup', {
        method: 'POST',
      });
      
      if (response.ok) {
        await fetchMetrics();
      } else {
        throw new Error('Emergency cleanup failed');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Emergency cleanup failed');
    }
  };

  const performComprehensiveCleanup = async () => {
    try {
      const response = await fetchAdminEndpoint('/api/health/comprehensive-cleanup', {
        method: 'POST',
      });
      
      if (response.ok) {
        await fetchMetrics();
      } else {
        throw new Error('Comprehensive cleanup failed');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Comprehensive cleanup failed');
    }
  };

  // New enhanced recovery actions using the new endpoints
  const performConnectionPoolRecovery = async () => {
    try {
      const response = await fetchAdminEndpoint('/api/admin/connection-pool/recover', {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.recovered) {
          await fetchMetrics();
        } else {
          throw new Error(result.message || 'Connection pool recovery failed');
        }
      } else {
        throw new Error('Connection pool recovery failed');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Connection pool recovery failed');
    }
  };

  const performIdleConnectionCleanup = async () => {
    try {
      const response = await fetchAdminEndpoint('/api/admin/connection-pool/close-idle', {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await fetchMetrics();
        } else {
          throw new Error(result.message || 'Idle connection cleanup failed');
        }
      } else {
        throw new Error('Idle connection cleanup failed');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Idle connection cleanup failed');
    }
  };

  const testConnectionHealth = async () => {
    try {
      const response = await fetchAdminEndpoint('/api/admin/connection-pool/test-connection');
      
      if (response.ok) {
        const result = await response.json();
        if (result.healthy) {
          setError(null);
          await fetchMetrics();
        } else {
          setError('Connection test failed: Database is not responding properly');
        }
      } else {
        throw new Error('Connection test failed');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Connection test failed');
    }
  };

  const handleManualRefresh = () => {
    if (refreshCooldown > 0) return;
    
    setRefreshCooldown(30); // 30 second cooldown
    fetchMetrics();
  };

  useEffect(() => {
    if (isMountedRef.current) {
      fetchMetrics();
    }
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (refreshCooldown > 0) {
      const timer = setTimeout(() => setRefreshCooldown(refreshCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [refreshCooldown]);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
      }
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY': return 'success.main';
      case 'WARNING': return 'warning.main';
      case 'CRITICAL': return 'error.main';
      default: return 'text.secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY': return <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main', opacity: 0.7 }} />;
      case 'WARNING': return <WarningIcon sx={{ fontSize: 40, color: 'warning.main', opacity: 0.7 }} />;
      case 'CRITICAL': return <ErrorIcon sx={{ fontSize: 40, color: 'error.main', opacity: 0.7 }} />;
      default: return <InfoIcon sx={{ fontSize: 40, color: 'text.secondary', opacity: 0.7 }} />;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'success.main';
      case 'MEDIUM': return 'warning.main';
      case 'HIGH': return 'error.main';
      default: return 'text.secondary';
    }
  };

  const pieData = [
    { name: 'Active', value: systemMetrics?.poolMetrics.activeConnections || 0, color: '#2196f3' },
    { name: 'Idle', value: systemMetrics?.poolMetrics.idleConnections || 0, color: '#4caf50' },
    { name: 'Available', value: (systemMetrics?.poolMetrics.maxPoolSize || 0) - (systemMetrics?.poolMetrics.activeConnections || 0) - (systemMetrics?.poolMetrics.idleConnections || 0), color: '#ff9800' },
  ];

  if (loading && !systemMetrics) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        <AlertTitle>Error</AlertTitle>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Connection Pool Dashboard
        </Typography>
        <RefreshHeader
          lastUpdated={lastUpdated ? (() => {
            const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
            if (diff < 60) return 'Just now';
            if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
            return lastUpdated.toLocaleString();
          })() : 'Never'}
          onRefresh={handleManualRefresh}
          loading={loading}
          cooldown={refreshCooldown > 0}
          cooldownRemaining={refreshCooldown}
          label="Refresh Metrics"
          tooltip="Refresh connection pool metrics"
        />
      </Box>

      {/* Emergency Actions */}
      {showActions && systemMetrics?.poolMetrics.emergencyCleanupNeeded && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Emergency Cleanup Required</AlertTitle>
          Connection pool is experiencing issues. Consider performing emergency cleanup.
          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              color="warning"
              startIcon={<HealingIcon />}
              onClick={performEmergencyCleanup}
              sx={{ mr: 1 }}
            >
              Emergency Cleanup
            </Button>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<StorageIcon />}
              onClick={performComprehensiveCleanup}
              sx={{ mr: 1 }}
            >
              Comprehensive Cleanup
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<HealingIcon />}
              onClick={performConnectionPoolRecovery}
              sx={{ mr: 1 }}
            >
              Auto Recovery
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<StorageIcon />}
              onClick={performIdleConnectionCleanup}
            >
              Close Idle
            </Button>
          </Box>
        </Alert>
      )}

      {/* Enhanced Actions Panel - Always visible for admins */}
      {showActions && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HealingIcon />
              Connection Pool Management
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enhanced connection pool monitoring and recovery tools
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<CheckCircleIcon />}
                onClick={testConnectionHealth}
                size="small"
              >
                Test Connection
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<HealingIcon />}
                onClick={performConnectionPoolRecovery}
                size="small"
              >
                Auto Recovery
              </Button>
              <Button
                variant="outlined"
                color="info"
                startIcon={<StorageIcon />}
                onClick={performIdleConnectionCleanup}
                size="small"
              >
                Close Idle Connections
              </Button>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<HealingIcon />}
                onClick={performEmergencyCleanup}
                size="small"
              >
                Emergency Cleanup
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Metrics Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 3, mb: 3 }}>
        {/* Pool Status */}
        <Box>
          <Card sx={{ height: '100%' }}>
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
        </Box>

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
                    <XAxis
                      dataKey="timestamp"
                      stroke="#666"
                      fontSize={12}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                      }}
                    />
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
        </Box>

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
        </Box>
      </Box>

      {/* Detailed Metrics */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Detailed Metrics
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
              <Typography variant="h5" color="primary.main" fontWeight="bold">
                {systemMetrics?.poolMetrics.totalConnections || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Connections
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
              <Typography variant="h5" color="success.main" fontWeight="bold">
                {systemMetrics?.poolMetrics.idleConnections || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Idle Connections
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
              <Typography variant="h5" color="warning.main" fontWeight="bold">
                {systemMetrics?.poolMetrics.threadsAwaitingConnection || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Waiting Threads
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
              <Typography variant="h5" color="info.main" fontWeight="bold">
                {systemMetrics?.poolMetrics.minimumIdle || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Minimum Idle
              </Typography>
            </Paper>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ConnectionPoolDashboard; 