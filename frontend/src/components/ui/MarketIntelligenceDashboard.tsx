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
  Grid,
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
  Search as SearchIcon,
  Assessment as AssessmentIcon,
  Storefront as StorefrontIcon,
  MonetizationOn as MonetizationOnIcon,
  Analytics as AnalyticsIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  CloudDownload as CloudDownloadIcon,
  CloudUpload as CloudUploadIcon,
  Timeline as TimelineIcon2,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  ShowChart as ShowChartIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import marketIntelligenceAPI from '../../api/marketIntelligence';
import type { MarketIntelligenceDashboard as MIDashboard, CostAnalytics, ProviderStats } from '../../api/marketIntelligence';

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

interface MarketIntelligenceMetrics {
  systemStatus: {
    discoveryEnabled: boolean;
    costOptimizationEnabled: boolean;
    providersEnabled: boolean;
    timestamp: string;
  };
  costAnalytics: CostAnalytics;
  providerStats: ProviderStats;
  databaseStats: {
    competitorUrls: number;
    suggestions: number;
    priceSnapshots: number;
    activeShops: number;
  };
  performanceMetrics: {
    avgResponseTime: string;
    cacheHitRate: string;
    errorRate: string;
    uptime: string;
  };
  discoveryStats: {
    totalDiscoveries: number;
    successfulDiscoveries: number;
    failedDiscoveries: number;
    successRate: number;
    lastDiscoveryTime: string;
    averageDiscoveryTime: number;
  };
}

interface SearchTestResult {
  url: string;
  title: string;
  price?: number;
  description?: string;
  provider: string;
}

interface HistoricalData {
  timestamp: string;
  dailyCost: number;
  monthlyCost: number;
  requests: number;
  discoveries: number;
}

interface MarketIntelligenceDashboardProps {
  showActions?: boolean;
  showTestSearch?: boolean;
}

const MarketIntelligenceDashboard: React.FC<MarketIntelligenceDashboardProps> = ({
  showActions = true,
  showTestSearch = true,
}) => {
  const [metrics, setMetrics] = useState<MarketIntelligenceMetrics | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const [testSearchDialog, setTestSearchDialog] = useState(false);
  const [testKeywords, setTestKeywords] = useState('');
  const [testResults, setTestResults] = useState<SearchTestResult[]>([]);
  const [testLoading, setTestLoading] = useState(false);
  const [resetCostsDialog, setResetCostsDialog] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const dashboardResponse = await marketIntelligenceAPI.getAdminDashboard();
      
      const metrics: MarketIntelligenceMetrics = {
        systemStatus: dashboardResponse.systemStatus || {
          discoveryEnabled: false,
          costOptimizationEnabled: false,
          providersEnabled: false,
          timestamp: new Date().toISOString(),
        },
        costAnalytics: dashboardResponse.costAnalytics || {
          todayCosts: {},
          thisMonthCosts: {},
          todayRequests: {},
          thisMonthRequests: {},
          totalDailyCost: 0,
          totalMonthlyCost: 0,
          totalDailyRequests: 0,
          totalMonthlyRequests: 0,
          dailyBudget: 0,
          monthlyBudget: 0,
          estimatedSavings: 0,
          dailyUsagePercentage: 0,
          monthlyUsagePercentage: 0,
        },
        providerStats: dashboardResponse.providerStats || {
          totalProviders: 0,
          enabledProviders: [],
          providerCosts: {},
        },
        databaseStats: dashboardResponse.databaseStats || {
          competitorUrls: 0,
          suggestions: 0,
          priceSnapshots: 0,
          activeShops: 0,
        },
        performanceMetrics: dashboardResponse.performanceMetrics || {
          avgResponseTime: '0ms',
          cacheHitRate: '0%',
          errorRate: '0%',
          uptime: '0%',
        },
        discoveryStats: dashboardResponse.discoveryStats || {
          totalDiscoveries: 0,
          successfulDiscoveries: 0,
          failedDiscoveries: 0,
          successRate: 0,
          lastDiscoveryTime: 'Never',
          averageDiscoveryTime: 0,
        },
      };

      setMetrics(metrics);
      setLastUpdated(new Date());

      // Generate sample historical data
      const sampleHistoricalData: HistoricalData[] = Array.from({ length: 30 }, (_, i) => ({
        timestamp: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString(),
        dailyCost: Math.random() * 10 + 2,
        monthlyCost: Math.random() * 300 + 100,
        requests: Math.floor(Math.random() * 1000) + 100,
        discoveries: Math.floor(Math.random() * 50) + 10,
      }));
      setHistoricalData(sampleHistoricalData);

    } catch (error) {
      console.error('Error fetching market intelligence metrics:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleTestSearch = async () => {
    if (!testKeywords.trim()) return;
    
    try {
      setTestLoading(true);
      const results = await marketIntelligenceAPI.testSearch(testKeywords);
      setTestResults(results.results || []);
    } catch (error) {
      console.error('Error testing search:', error);
      setError('Search test failed');
    } finally {
      setTestLoading(false);
    }
  };

  const handleResetCosts = async () => {
    try {
      setResetLoading(true);
      await marketIntelligenceAPI.resetCosts();
      await fetchMetrics(); // Refresh metrics after reset
      setResetCostsDialog(false);
    } catch (error) {
      console.error('Error resetting costs:', error);
      setError('Failed to reset cost tracking');
    } finally {
      setResetLoading(false);
    }
  };

  const handleManualRefresh = () => {
    if (refreshCooldown > 0) return;
    
    setRefreshCooldown(30);
    fetchMetrics();
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    if (refreshCooldown > 0) {
      cooldownRef.current = setTimeout(() => {
        setRefreshCooldown(refreshCooldown - 1);
      }, 1000);
    }
    return () => {
      if (cooldownRef.current) {
        clearTimeout(cooldownRef.current);
      }
    };
  }, [refreshCooldown]);

  const getStatusColor = (status: boolean) => {
    return status ? 'success.main' : 'error.main';
  };

  const getStatusIcon = (status: boolean) => {
    return status ? 
      <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main', opacity: 0.7 }} /> :
      <ErrorIcon sx={{ fontSize: 40, color: 'error.main', opacity: 0.7 }} />;
  };

  const getCostColor = (cost: number, budget: number) => {
    const percentage = budget > 0 ? (cost / budget) * 100 : 0;
    if (percentage > 90) return 'error.main';
    if (percentage > 70) return 'warning.main';
    return 'success.main';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value / 100);
  };

  if (loading && !metrics) {
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
          Market Intelligence Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {lastUpdated && (
            <Typography variant="body2" color="text.secondary">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </Typography>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleManualRefresh}
            disabled={refreshCooldown > 0}
          >
            {refreshCooldown > 0 ? `${refreshCooldown}s` : 'Refresh'}
          </Button>
        </Box>
      </Box>

      {/* System Status Alert */}
      {metrics && (!metrics.systemStatus.discoveryEnabled || !metrics.systemStatus.costOptimizationEnabled) && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>System Configuration</AlertTitle>
          Some Market Intelligence features are disabled. Check system configuration for optimal performance.
        </Alert>
      )}

      {/* Metrics Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 3, mb: 3 }}>
        {/* System Status */}
        <Box>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold" 
                    color={metrics?.systemStatus.discoveryEnabled && metrics?.systemStatus.costOptimizationEnabled ? 'success.main' : 'warning.main'}>
                    {metrics?.systemStatus.discoveryEnabled && metrics?.systemStatus.costOptimizationEnabled ? 'ACTIVE' : 'CONFIGURED'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    System Status
                  </Typography>
                </Box>
                <AnalyticsIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Daily Cost */}
        <Box>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold" 
                    color={getCostColor(metrics?.costAnalytics.totalDailyCost || 0, metrics?.costAnalytics.dailyBudget || 1)}>
                    {formatCurrency(metrics?.costAnalytics.totalDailyCost || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Daily Cost
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatPercentage(metrics?.costAnalytics.dailyUsagePercentage || 0)} of budget
                  </Typography>
                </Box>
                <MonetizationOnIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.7 }} />
              </Box>
              <LinearProgress
                variant="determinate"
                value={metrics?.costAnalytics.dailyUsagePercentage || 0}
                color={getCostColor(metrics?.costAnalytics.totalDailyCost || 0, metrics?.costAnalytics.dailyBudget || 1) === 'error.main' ? 'error' : 
                       getCostColor(metrics?.costAnalytics.totalDailyCost || 0, metrics?.costAnalytics.dailyBudget || 1) === 'warning.main' ? 'warning' : 'success'}
                sx={{ mt: 1, height: 6, borderRadius: 3 }}
              />
            </CardContent>
          </Card>
        </Box>

        {/* Monthly Cost */}
        <Box>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold" 
                    color={getCostColor(metrics?.costAnalytics.totalMonthlyCost || 0, metrics?.costAnalytics.monthlyBudget || 1)}>
                    {formatCurrency(metrics?.costAnalytics.totalMonthlyCost || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Monthly Cost
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatPercentage(metrics?.costAnalytics.monthlyUsagePercentage || 0)} of budget
                  </Typography>
                </Box>
                <TimelineIcon sx={{ fontSize: 40, color: 'secondary.main', opacity: 0.7 }} />
              </Box>
              <LinearProgress
                variant="determinate"
                value={metrics?.costAnalytics.monthlyUsagePercentage || 0}
                color={getCostColor(metrics?.costAnalytics.totalMonthlyCost || 0, metrics?.costAnalytics.monthlyBudget || 1) === 'error.main' ? 'error' : 
                       getCostColor(metrics?.costAnalytics.totalMonthlyCost || 0, metrics?.costAnalytics.monthlyBudget || 1) === 'warning.main' ? 'warning' : 'success'}
                sx={{ mt: 1, height: 6, borderRadius: 3 }}
              />
            </CardContent>
          </Card>
        </Box>

        {/* Estimated Savings */}
        <Box>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {formatCurrency(metrics?.costAnalytics.estimatedSavings || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Estimated Savings
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    This month
                  </Typography>
                </Box>
                <TrendingUpIcon sx={{ fontSize: 40, color: 'success.main', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Detailed Metrics Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3, mb: 3 }}>
        {/* System Configuration */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon />
                System Configuration
              </Typography>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Discovery Enabled</Typography>
                  <Chip
                    label={metrics?.systemStatus.discoveryEnabled ? 'Yes' : 'No'}
                    color={metrics?.systemStatus.discoveryEnabled ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Cost Optimization</Typography>
                  <Chip
                    label={metrics?.systemStatus.costOptimizationEnabled ? 'Enabled' : 'Disabled'}
                    color={metrics?.systemStatus.costOptimizationEnabled ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Providers Active</Typography>
                  <Chip
                    label={metrics?.systemStatus.providersEnabled ? 'Yes' : 'No'}
                    color={metrics?.systemStatus.providersEnabled ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Provider Statistics */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StorefrontIcon />
                Provider Statistics
              </Typography>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Total Providers</Typography>
                  <Typography variant="h6" color="primary.main" fontWeight="bold">
                    {metrics?.providerStats.totalProviders || 0}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Enabled Providers</Typography>
                  <Typography variant="h6" color="success.main" fontWeight="bold">
                    {metrics?.providerStats.enabledProviders?.length || 0}
                  </Typography>
                </Box>
                {metrics?.providerStats.enabledProviders && metrics.providerStats.enabledProviders.length > 0 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Active Providers:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {metrics.providerStats.enabledProviders.map((provider, index) => (
                        <Chip
                          key={index}
                          label={provider}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Database Statistics */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StorageIcon />
                Database Statistics
              </Typography>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Competitor URLs</Typography>
                  <Typography variant="h6" color="primary.main" fontWeight="bold">
                    {metrics?.databaseStats.competitorUrls || 0}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Suggestions</Typography>
                  <Typography variant="h6" color="info.main" fontWeight="bold">
                    {metrics?.databaseStats.suggestions || 0}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Price Snapshots</Typography>
                  <Typography variant="h6" color="warning.main" fontWeight="bold">
                    {metrics?.databaseStats.priceSnapshots || 0}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Active Shops</Typography>
                  <Typography variant="h6" color="success.main" fontWeight="bold">
                    {metrics?.databaseStats.activeShops || 0}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Performance Metrics */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SpeedIcon />
                Performance Metrics
              </Typography>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Avg Response Time</Typography>
                  <Typography variant="h6" color="primary.main" fontWeight="bold">
                    {metrics?.performanceMetrics.avgResponseTime || '0ms'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Cache Hit Rate</Typography>
                  <Typography variant="h6" color="success.main" fontWeight="bold">
                    {metrics?.performanceMetrics.cacheHitRate || '0%'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Error Rate</Typography>
                  <Typography variant="h6" color="error.main" fontWeight="bold">
                    {metrics?.performanceMetrics.errorRate || '0%'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Uptime</Typography>
                  <Typography variant="h6" color="success.main" fontWeight="bold">
                    {metrics?.performanceMetrics.uptime || '0%'}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Cost Trend Chart */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShowChartIcon />
            Cost Trend (Last 30 Days)
          </Typography>
          <Box sx={{ height: 300, mt: 2 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis />
                <RechartsTooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Cost']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Area 
                  type="monotone" 
                  dataKey="dailyCost" 
                  stroke="#2196f3" 
                  fill="#2196f3" 
                  fillOpacity={0.3}
                  name="Daily Cost"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      {/* Actions */}
      {showActions && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={() => setTestSearchDialog(true)}
          >
            Test Search Providers
          </Button>
          <Button
            variant="outlined"
            color="warning"
            startIcon={<RefreshIcon />}
            onClick={() => setResetCostsDialog(true)}
          >
            Reset Cost Tracking
          </Button>
        </Box>
      )}

      {/* Test Search Dialog */}
      <Dialog 
        open={testSearchDialog} 
        onClose={() => setTestSearchDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Test Search Providers</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
            <TextField
              label="Keywords"
              value={testKeywords}
              onChange={(e) => setTestKeywords(e.target.value)}
              placeholder="Enter keywords to test search providers..."
              fullWidth
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleTestSearch();
                }
              }}
            />
            <Button
              variant="contained"
              onClick={handleTestSearch}
              disabled={testLoading || !testKeywords.trim()}
              startIcon={testLoading ? <CircularProgress size={16} /> : <SearchIcon />}
            >
              {testLoading ? 'Testing...' : 'Test'}
            </Button>
          </Box>

          {testResults.length > 0 && (
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Search Results ({testResults.length} found)
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Title</TableCell>
                      <TableCell>URL</TableCell>
                      <TableCell>Provider</TableCell>
                      <TableCell>Price</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {testResults.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell>{result.title}</TableCell>
                        <TableCell>
                          <a href={result.url} target="_blank" rel="noopener noreferrer">
                            {result.url}
                          </a>
                        </TableCell>
                        <TableCell>
                          <Chip label={result.provider} size="small" />
                        </TableCell>
                        <TableCell>
                          {result.price ? `$${result.price}` : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestSearchDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Reset Costs Dialog */}
      <Dialog 
        open={resetCostsDialog} 
        onClose={() => setResetCostsDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reset Cost Tracking</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This will reset all cost tracking data for Market Intelligence. This action cannot be undone.
          </Typography>
          <Alert severity="warning">
            <AlertTitle>Warning</AlertTitle>
            Resetting cost tracking will clear all historical cost data and start fresh tracking.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetCostsDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleResetCosts}
            disabled={resetLoading}
            startIcon={resetLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
          >
            {resetLoading ? 'Resetting...' : 'Reset Cost Tracking'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MarketIntelligenceDashboard; 