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
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  TrendingUp as TrendingUpIcon,
  Search as SearchIcon,
  Storefront as StorefrontIcon,
  MonetizationOn as MonetizationOnIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  ShowChart as ShowChartIcon,
  BugReport as DebugIcon,
  Archive as ArchiveIcon,
} from '@mui/icons-material';
import { XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import marketIntelligenceAdminAPI from '../../api/marketIntelligenceAdmin';
import type { CostAnalytics, ProviderStats } from '../../api/marketIntelligenceAdmin';
import RefreshHeader from './RefreshHeader';
import { useNotifications } from '../../hooks/useNotifications';
import CompetitorAdminPanel from './CompetitorAdminPanel';
import { ArchivedCompetitorsPanel } from './ArchivedCompetitorsPanel';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const fetchAdminEndpoint = async (endpoint: string, options?: RequestInit) => {
  const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  return fetch(fullUrl, {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Correlation-ID': `market-intel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
    errorRate: string;
    uptime: string;
    totalTransactions?: number;
    failedTransactions?: number;
    databaseStatus?: string;
    redisStatus?: string;
    transactionStatus?: string;
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
  const [shopId, setShopId] = useState<number | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<number | ''>('');
  const [availableShops, setAvailableShops] = useState<Array<{ id: number; shopify_domain: string }>>([]);
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'competitor-admin' | 'deleted-competitors'>('dashboard');
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
  const { addNotification } = useNotifications();

  // Load available shops on component mount
  useEffect(() => {
    loadAvailableShops();
  }, []);

  // Update shopId when selectedShopId changes
  useEffect(() => {
    if (selectedShopId && typeof selectedShopId === 'number') {
      setShopId(selectedShopId);
    }
  }, [selectedShopId]);

  // Fetch metrics when shopId changes
  useEffect(() => {
    if (shopId) {
      fetchMetrics();
    }
  }, [shopId]);

  const loadAvailableShops = async () => {
    try {
      const response = await marketIntelligenceAdminAPI.getAvailableShops();
      if (response && Array.isArray(response)) {
        setAvailableShops(response);
        // Auto-select first shop if available
        if (response.length > 0 && !selectedShopId) {
          setSelectedShopId(response[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load available shops:', error);
      addNotification('Failed to load available shops', 'error');
    }
  };

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const dashboardResponse = await marketIntelligenceAdminAPI.getAdminDashboard();
      
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

      // Fetch historical cost data only if a shop is selected
      if (shopId) {
        try {
          const costHistory = await marketIntelligenceAdminAPI.getCostHistory(shopId, 30);
          let historicalData: HistoricalData[] = [];
          if (Array.isArray(costHistory?.historicalData)) {
            historicalData = costHistory.historicalData.map(item => ({
              timestamp: item.timestamp,
              dailyCost: item.dailyCost,
              requests: item.requests,
              discoveries: item.discoveries,
            }));
          }
          setHistoricalData(historicalData);
        } catch (error) {
          console.error('Failed to fetch cost history:', error);
          setHistoricalData([]);
        }
      } else {
        setHistoricalData([]);
      }
    } catch (err) {
      setError('Failed to load metrics');
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSearch = async () => {
    if (!testKeywords.trim()) return;
    
    try {
      setTestLoading(true);
      const results = await marketIntelligenceAdminAPI.testSearch(testKeywords);
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
      await marketIntelligenceAdminAPI.resetCosts();
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
            Market Intelligence Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor and manage Market Intelligence system performance, costs, and configurations
          </Typography>
        </Box>
        <RefreshHeader
          lastUpdated={lastUpdated ? (() => {
            const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
            if (diff < 5) return 'Just now';
            if (diff < 60) return `${diff}s ago`;
            if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
            return lastUpdated.toLocaleString();
          })() : 'Never'}
          onRefresh={handleManualRefresh}
          loading={loading}
          cooldown={refreshCooldown > 0}
          cooldownRemaining={refreshCooldown}
          label="Refresh Market Intelligence"
          tooltip="Refresh market intelligence metrics"
        />
      </Box>

      {/* Store Selector */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            Shop Selection
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Shop</InputLabel>
            <Select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value as number)}
              label="Select Shop"
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="">
                <em>Select a shop to manage</em>
              </MenuItem>
              {availableShops.map((shop) => (
                <MenuItem key={shop.id} value={shop.id}>
                  {shop.shopify_domain} (ID: {shop.id})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedShopId && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Managing data for shop ID: {selectedShopId}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={activeTab === 'dashboard' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('dashboard')}
            startIcon={<AnalyticsIcon />}
          >
            Dashboard
          </Button>
          <Button
            variant={activeTab === 'competitor-admin' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('competitor-admin')}
            startIcon={<DebugIcon />}
          >
            Competitor Admin
          </Button>
          <Button
            variant={activeTab === 'deleted-competitors' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('deleted-competitors')}
            startIcon={<ArchiveIcon />}
          >
            Deleted Competitors
          </Button>
        </Box>
      </Box>

      {/* Tab Content */}
      {activeTab === 'competitor-admin' ? (
        <CompetitorAdminPanel showActions={showActions} />
      ) : activeTab === 'deleted-competitors' ? (
        selectedShopId ? (
          <ArchivedCompetitorsPanel shopId={selectedShopId.toString()} />
        ) : (
          <Card sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Select a Shop
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please select a shop from the dropdown above to view archived competitors.
            </Typography>
          </Card>
        )
      ) : (
        <>
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
                

                
                {metrics?.performanceMetrics.totalTransactions !== undefined && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Transaction Statistics
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Total: {metrics.performanceMetrics.totalTransactions}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Failed: {metrics.performanceMetrics.failedTransactions}
                      </Typography>
                    </Box>
                  </Box>
                )}
                
                {/* System Status Indicators */}
                {/* Removed empty System Status section from Performance Metrics */}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Cost Trend Chart */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShowChartIcon />
              Cost Trend (Last 30 Days)
            </Typography>
            {shopId && (
              <Chip 
                label={`Shop ID: ${shopId}`} 
                color="primary" 
                size="small"
                variant="outlined"
              />
            )}
          </Box>
          <Box sx={{ height: 300, mt: 2 }}>
            {historicalData.length === 0 ? (
              <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No cost data available for the selected period.
                </Typography>
              </Box>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    }}
                    interval={4} // Show every 5th tick (0-based)
                    angle={30}
                    textAnchor="start"
                    height={50}
                />
                <YAxis />
                <RechartsTooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Cost']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
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
            )}
          </Box>
          {shopId ? (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Showing real cost data for shop {shopId}. Data includes API costs from Market Intelligence features.
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Please select a shop to view real cost trends.
            </Typography>
          )}
        </CardContent>
      </Card>
        </>
      )}

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