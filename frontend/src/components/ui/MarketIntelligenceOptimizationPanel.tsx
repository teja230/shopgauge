import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  LinearProgress,
  Alert,
  AlertTitle,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Clear as ClearIcon,
  Settings as SettingsIcon,
  Memory as MemoryIcon,
  Queue as QueueIcon,
  Cached as CacheIcon,
  TrendingUp as WarmUpIcon,
} from '@mui/icons-material';
import marketIntelligenceAdminAPI from '../../api/marketIntelligenceAdmin';
import { useNotifications } from '../../hooks/useNotifications';

interface OptimizationStats {
  cache?: {
    hitRate: number;
    missRate: number;
    totalRequests: number;
    cacheSize: number;
    lastReset: string;
  };
  batch?: {
    queueSize: number;
    processedItems: number;
    failedItems: number;
    averageProcessingTime: number;
    lastProcessed: string;
  };
  write?: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageLatency: number;
    lastOperation: string;
  };
  warming?: {
    totalWarmingOperations: number;
    successfulWarmups: number;
    failedWarmups: number;
    currentWarmingTasks: number;
    lastWarmingCycle: string;
  };
  events?: {
    totalEvents: number;
    processedEvents: number;
    failedEvents: number;
    averageProcessingTime: number;
    lastEvent: string;
  };
  overall?: {
    status: string;
    memoryUsage: number;
    cacheHitRate: number;
    averageResponseTime: number;
    uptime: string;
  };
}

const MarketIntelligenceOptimizationPanel: React.FC = () => {
  const [stats, setStats] = useState<OptimizationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cacheWarmingDialog, setCacheWarmingDialog] = useState(false);
  const [selectedShop, setSelectedShop] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('CRITICAL');
  const [availableShops, setAvailableShops] = useState<Array<{ id: number; shopify_domain: string }>>([]);
  const { addNotification } = useNotifications();

  const fetchOptimizationStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const [optimizationStatus, cacheStats, batchStats, writeStats, warmingStats] = await Promise.all([
        marketIntelligenceAdminAPI.getOptimizationStatus(),
        marketIntelligenceAdminAPI.getCacheStats(),
        marketIntelligenceAdminAPI.getBatchStats(),
        marketIntelligenceAdminAPI.getWriteStats(),
        marketIntelligenceAdminAPI.getCacheWarmingStats(),
      ]);

      setStats({
        overall: optimizationStatus,
        cache: cacheStats,
        batch: batchStats,
        write: writeStats,
        warming: warmingStats,
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching optimization stats:', err);
      setError('Failed to load optimization statistics');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableShops = async () => {
    try {
      const shops = await marketIntelligenceAdminAPI.getAvailableShops();
      setAvailableShops(shops);
      if (shops.length > 0 && !selectedShop) {
        setSelectedShop(shops[0].shopify_domain);
      }
    } catch (err) {
      console.error('Error loading available shops:', err);
    }
  };

  useEffect(() => {
    fetchOptimizationStats();
    loadAvailableShops();
  }, []);

  const handleResetCacheStats = async () => {
    try {
      await marketIntelligenceAdminAPI.resetCacheStats();
      addNotification('Cache statistics reset successfully', 'success');
      fetchOptimizationStats();
    } catch (err) {
      addNotification('Failed to reset cache statistics', 'error');
    }
  };

  const handleResetBatchStats = async () => {
    try {
      await marketIntelligenceAdminAPI.resetBatchStats();
      addNotification('Batch statistics reset successfully', 'success');
      fetchOptimizationStats();
    } catch (err) {
      addNotification('Failed to reset batch statistics', 'error');
    }
  };

  const handleResetWriteStats = async () => {
    try {
      await marketIntelligenceAdminAPI.resetWriteStats();
      addNotification('Write statistics reset successfully', 'success');
      fetchOptimizationStats();
    } catch (err) {
      addNotification('Failed to reset write statistics', 'error');
    }
  };

  const handleClearBatchQueues = async () => {
    try {
      await marketIntelligenceAdminAPI.clearBatchQueues();
      addNotification('Batch queues cleared successfully', 'success');
      fetchOptimizationStats();
    } catch (err) {
      addNotification('Failed to clear batch queues', 'error');
    }
  };

  const handleInvalidateCache = async (shopDomain?: string) => {
    try {
      await marketIntelligenceAdminAPI.invalidateCache(shopDomain);
      addNotification(`Cache invalidated successfully${shopDomain ? ` for ${shopDomain}` : ''}`, 'success');
      fetchOptimizationStats();
    } catch (err) {
      addNotification('Failed to invalidate cache', 'error');
    }
  };

  const handleTriggerCacheWarming = async () => {
    try {
      await marketIntelligenceAdminAPI.triggerCacheWarming(selectedShop, selectedPriority);
      addNotification(`Cache warming triggered for ${selectedShop} with priority ${selectedPriority}`, 'success');
      setCacheWarmingDialog(false);
      fetchOptimizationStats();
    } catch (err) {
      addNotification('Failed to trigger cache warming', 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'success':
        return 'success';
      case 'warning':
      case 'degraded':
        return 'warning';
      case 'error':
      case 'failed':
        return 'error';
      default:
        return 'info';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'success':
        return <CheckCircleIcon color="success" />;
      case 'warning':
      case 'degraded':
        return <WarningIcon color="warning" />;
      case 'error':
      case 'failed':
        return <ErrorIcon color="error" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (loading && !stats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Alert severity="error">
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Market Intelligence Optimization
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor and manage cache, batch processing, write operations, and cache warming
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchOptimizationStats}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Overall Status */}
      {stats?.overall && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              {getStatusIcon(stats.overall.status)}
              <Typography variant="h6" sx={{ ml: 1 }}>
                Overall System Status: {stats.overall.status}
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Memory Usage
                </Typography>
                <Typography variant="h6">
                  {formatPercentage(stats.overall.memoryUsage || 0)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Cache Hit Rate
                </Typography>
                <Typography variant="h6">
                  {formatPercentage(stats.overall.cacheHitRate || 0)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Avg Response Time
                </Typography>
                <Typography variant="h6">
                  {formatDuration(stats.overall.averageResponseTime || 0)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Uptime
                </Typography>
                <Typography variant="h6">
                  {stats.overall.uptime || 'N/A'}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Optimization Sections */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
        {/* Cache Management */}
        <Box>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <CacheIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Cache Management</Typography>
                {stats?.cache && (
                  <Chip
                    label={`${formatPercentage(stats.cache.hitRate || 0)} hit rate`}
                    color={getStatusColor(stats.cache.hitRate > 0.8 ? 'success' : 'warning')}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {stats?.cache ? (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Hit Rate: {formatPercentage(stats.cache.hitRate || 0)}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(stats.cache.hitRate || 0) * 100}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                  <Typography variant="body2">
                    Total Requests: {stats.cache.totalRequests?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="body2">
                    Cache Size: {stats.cache.cacheSize?.toLocaleString() || 0} entries
                  </Typography>
                  <Typography variant="body2">
                    Last Reset: {stats.cache.lastReset || 'Never'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleResetCacheStats}
                    >
                      Reset Stats
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleInvalidateCache()}
                    >
                      Invalidate All
                    </Button>
                  </Box>
                </Stack>
              ) : (
                <Typography color="text.secondary">No cache statistics available</Typography>
              )}
            </AccordionDetails>
          </Accordion>
        </Box>

        {/* Batch Processing */}
        <Box>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <QueueIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Batch Processing</Typography>
                {stats?.batch && (
                  <Chip
                    label={`${stats.batch.queueSize || 0} queued`}
                    color={getStatusColor(stats.batch.queueSize > 50 ? 'warning' : 'success')}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {stats?.batch ? (
                <Stack spacing={2}>
                  <Typography variant="body2">
                    Queue Size: {stats.batch.queueSize || 0}
                  </Typography>
                  <Typography variant="body2">
                    Processed Items: {stats.batch.processedItems?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="body2">
                    Failed Items: {stats.batch.failedItems || 0}
                  </Typography>
                  <Typography variant="body2">
                    Avg Processing Time: {formatDuration(stats.batch.averageProcessingTime || 0)}
                  </Typography>
                  <Typography variant="body2">
                    Last Processed: {stats.batch.lastProcessed || 'Never'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleResetBatchStats}
                    >
                      Reset Stats
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      onClick={handleClearBatchQueues}
                    >
                      Clear Queues
                    </Button>
                  </Box>
                </Stack>
              ) : (
                <Typography color="text.secondary">No batch statistics available</Typography>
              )}
            </AccordionDetails>
          </Accordion>
        </Box>

        {/* Write Operations */}
        <Box>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <SpeedIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Write Operations</Typography>
                {stats?.write && (
                  <Chip
                    label={`${stats.write.totalOperations || 0} ops`}
                    color={getStatusColor(stats.write.failedOperations > 0 ? 'warning' : 'success')}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {stats?.write ? (
                <Stack spacing={2}>
                  <Typography variant="body2">
                    Total Operations: {stats.write.totalOperations?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="body2">
                    Successful: {stats.write.successfulOperations?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="body2">
                    Failed: {stats.write.failedOperations || 0}
                  </Typography>
                  <Typography variant="body2">
                    Avg Latency: {formatDuration(stats.write.averageLatency || 0)}
                  </Typography>
                  <Typography variant="body2">
                    Last Operation: {stats.write.lastOperation || 'Never'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleResetWriteStats}
                    >
                      Reset Stats
                    </Button>
                  </Box>
                </Stack>
              ) : (
                <Typography color="text.secondary">No write statistics available</Typography>
              )}
            </AccordionDetails>
          </Accordion>
        </Box>

        {/* Cache Warming */}
        <Box>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <WarmUpIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Cache Warming</Typography>
                {stats?.warming && (
                  <Chip
                    label={`${stats.warming.currentWarmingTasks || 0} active`}
                    color={getStatusColor(stats.warming.currentWarmingTasks > 0 ? 'info' : 'default')}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {stats?.warming ? (
                <Stack spacing={2}>
                  <Typography variant="body2">
                    Total Operations: {stats.warming.totalWarmingOperations?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="body2">
                    Successful Warmups: {stats.warming.successfulWarmups?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="body2">
                    Failed Warmups: {stats.warming.failedWarmups || 0}
                  </Typography>
                  <Typography variant="body2">
                    Current Tasks: {stats.warming.currentWarmingTasks || 0}
                  </Typography>
                  <Typography variant="body2">
                    Last Cycle: {stats.warming.lastWarmingCycle || 'Never'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setCacheWarmingDialog(true)}
                    >
                      Trigger Warming
                    </Button>
                  </Box>
                </Stack>
              ) : (
                <Typography color="text.secondary">No warming statistics available</Typography>
              )}
            </AccordionDetails>
          </Accordion>
        </Box>
      </Box>

      {/* Cache Warming Dialog */}
      <Dialog open={cacheWarmingDialog} onClose={() => setCacheWarmingDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Trigger Cache Warming</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Shop Domain</InputLabel>
              <Select
                value={selectedShop}
                onChange={(e) => setSelectedShop(e.target.value)}
                label="Shop Domain"
              >
                {availableShops.map((shop) => (
                  <MenuItem key={shop.id} value={shop.shopify_domain}>
                    {shop.shopify_domain}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                label="Priority"
              >
                <MenuItem value="CRITICAL">Critical</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="LOW">Low</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCacheWarmingDialog(false)}>Cancel</Button>
          <Button onClick={handleTriggerCacheWarming} variant="contained">
            Trigger Warming
          </Button>
        </DialogActions>
      </Dialog>

      {/* Last Updated */}
      {lastUpdated && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastUpdated.toLocaleString()}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default MarketIntelligenceOptimizationPanel; 