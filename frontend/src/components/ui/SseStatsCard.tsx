import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Alert,
  Tooltip,
  IconButton,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
  CircularProgress
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  SignalCellularAlt as SignalIcon,
  SignalCellularConnectedNoInternet0Bar as SignalOffIcon,
  SignalCellular4Bar as SignalGoodIcon,
  SignalCellular2Bar as SignalWarningIcon,
  SignalCellular0Bar as SignalCriticalIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  People as PeopleIcon,
  Store as StoreIcon,
  Speed as SpeedIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Timeline as TimelineIcon,
  Memory as MemoryIcon,
  NetworkCheck as NetworkCheckIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useNotifications } from '../../hooks/useNotifications';
import { getAdminSseStats } from '../../api/admin';
import RefreshHeader from './RefreshHeader';

interface SseStatsData {
  totalConnections: number;
  totalErrors: number;
  totalRateLimited: number;
  activeConnections: number;
  activeShops: number;
  maxGlobalConnections: number;
  maxPerShopConnections: number;
  connectionsByShop: Record<string, number>;
}

interface SseHealthData {
  connectionUtilization: string;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  recommendation: string;
}

const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: 16,
  overflow: 'hidden',
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
  border: `1px solid ${theme.palette.divider}`,
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
  },
}));

const MetricCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: 12,
  background: 'linear-gradient(135deg, rgba(37,99,235,0.05) 0%, rgba(37,99,235,0.02) 100%)',
  border: `1px solid ${theme.palette.divider}`,
  textAlign: 'center',
  transition: 'all 0.2s ease',
  '&:hover': {
    background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.04) 100%)',
    transform: 'scale(1.02)',
  },
}));

const SseStatsCard: React.FC = () => {
  const { addNotification } = useNotifications();
  const [sseStats, setSseStats] = useState<SseStatsData | null>(null);
  const [sseHealth, setSseHealth] = useState<SseHealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshCooldown, setRefreshCooldown] = useState(0);

  const REFRESH_COOLDOWN = 30; // 30 seconds

  const fetchSseStats = useCallback(async (showNotification = false) => {
    if (loading || refreshCooldown > 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await getAdminSseStats();
      if (response.success) {
        setSseStats(response.data);
        setSseHealth(response.health);
        setLastUpdated(new Date());
        if (showNotification) {
          addNotification('SSE statistics updated successfully', 'success');
        }
      } else {
        throw new Error(response.error || 'Failed to fetch SSE statistics');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch SSE statistics';
      setError(errorMessage);
      if (showNotification) {
        addNotification(errorMessage, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [addNotification, loading, refreshCooldown]);

  const handleRefresh = useCallback(() => {
    if (refreshCooldown > 0) return;
    
    setRefreshCooldown(REFRESH_COOLDOWN);
    fetchSseStats(true);
  }, [fetchSseStats, refreshCooldown]);

  // Cooldown timer
  useEffect(() => {
    if (refreshCooldown > 0) {
      const timer = setTimeout(() => setRefreshCooldown(refreshCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [refreshCooldown]);

  // Initial fetch
  useEffect(() => {
    fetchSseStats();
  }, [fetchSseStats]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return <CheckCircleIcon color="success" />;
      case 'WARNING':
        return <WarningIcon color="warning" />;
      case 'CRITICAL':
        return <ErrorIcon color="error" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'success';
      case 'WARNING':
        return 'warning';
      case 'CRITICAL':
        return 'error';
      default:
        return 'info';
    }
  };

  const getConnectionUtilizationColor = (utilization: number) => {
    if (utilization >= 80) return 'error';
    if (utilization >= 60) return 'warning';
    return 'success';
  };

  const formatConnectionUtilization = (utilizationStr: string) => {
    const match = utilizationStr.match(/(\d+\.?\d*)%/);
    return match ? parseFloat(match[1]) : 0;
  };

  if (error) {
    return (
      <StyledCard>
        <CardContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <IconButton onClick={handleRefresh} disabled={loading || refreshCooldown > 0}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </CardContent>
      </StyledCard>
    );
  }

  return (
    <StyledCard>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NetworkCheckIcon color="primary" />
            Server-Sent Events (SSE) Monitor
          </Typography>
          <RefreshHeader
            lastUpdated={lastUpdated ? (() => {
              const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
              if (diff < 60) return 'Just now';
              if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
              return lastUpdated.toLocaleString();
            })() : 'Never'}
            onRefresh={handleRefresh}
            loading={loading}
            cooldown={refreshCooldown > 0}
            cooldownRemaining={refreshCooldown}
            label="Refresh SSE Stats"
            tooltip="Refresh SSE connection statistics"
          />
        </Box>

        {sseStats && (
          <>
            {/* Health Status */}
            {sseHealth && (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  {getStatusIcon(sseHealth.status)}
                  <Typography variant="h6" color={`${getStatusColor(sseHealth.status)}.main`}>
                    SSE Health Status: {sseHealth.status}
                  </Typography>
                </Box>
                <Alert severity={getStatusColor(sseHealth.status) as any} sx={{ mb: 2 }}>
                  {sseHealth.recommendation}
                </Alert>
              </Box>
            )}

            {/* Connection Utilization */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Connection Utilization
                </Typography>
                <Typography variant="h6" color={`${getConnectionUtilizationColor(formatConnectionUtilization(sseHealth?.connectionUtilization || '0%'))}.main`}>
                  {sseHealth?.connectionUtilization || '0%'}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={formatConnectionUtilization(sseHealth?.connectionUtilization || '0%')}
                color={getConnectionUtilizationColor(formatConnectionUtilization(sseHealth?.connectionUtilization || '0%')) as any}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {sseStats.activeConnections} / {sseStats.maxGlobalConnections} connections active
              </Typography>
            </Box>

            {/* Key Metrics Grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
              <MetricCard>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                  <WifiIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    {sseStats.activeConnections}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Active Connections
                </Typography>
              </MetricCard>
              
              <MetricCard>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                  <StoreIcon color="success" sx={{ mr: 1 }} />
                  <Typography variant="h4" color="success.main" fontWeight="bold">
                    {sseStats.activeShops}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Active Shops
                </Typography>
              </MetricCard>
              
              <MetricCard>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                  <ErrorIcon color="error" sx={{ mr: 1 }} />
                  <Typography variant="h4" color="error.main" fontWeight="bold">
                    {sseStats.totalErrors}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Total Errors
                </Typography>
              </MetricCard>
              
              <MetricCard>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                  <SpeedIcon color="warning" sx={{ mr: 1 }} />
                  <Typography variant="h4" color="warning.main" fontWeight="bold">
                    {sseStats.totalRateLimited}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Rate Limited
                </Typography>
              </MetricCard>
            </Box>

            {/* Connection Limits */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MemoryIcon color="info" />
                Connection Limits
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2">Global Limit</Typography>
                  <Chip label={sseStats.maxGlobalConnections} color="primary" size="small" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2">Per Shop Limit</Typography>
                  <Chip label={sseStats.maxPerShopConnections} color="secondary" size="small" />
                </Box>
              </Box>
            </Box>

            {/* Connections by Shop */}
            {Object.keys(sseStats.connectionsByShop).length > 0 && (
              <Box>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PeopleIcon color="primary" />
                  Connections by Shop ({Object.keys(sseStats.connectionsByShop).length} shops)
                </Typography>
                <List dense>
                  {Object.entries(sseStats.connectionsByShop)
                    .sort(([,a], [,b]) => b - a)
                    .map(([shop, connections]) => (
                      <ListItem key={shop} sx={{ py: 0.5 }}>
                        <ListItemIcon>
                          <Badge badgeContent={connections} color="primary">
                            <StoreIcon color="primary" />
                          </Badge>
                        </ListItemIcon>
                        <ListItemText
                          primary={shop}
                          secondary={`${connections} connection${connections !== 1 ? 's' : ''}`}
                        />
                        <Chip
                          label={connections}
                          color={connections >= sseStats.maxPerShopConnections ? 'error' : 'default'}
                          size="small"
                          variant={connections >= sseStats.maxPerShopConnections ? 'filled' : 'outlined'}
                        />
                      </ListItem>
                    ))}
                </List>
              </Box>
            )}
          </>
        )}

        {loading && !sseStats && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
      </CardContent>
    </StyledCard>
  );
};

export default SseStatsCard; 