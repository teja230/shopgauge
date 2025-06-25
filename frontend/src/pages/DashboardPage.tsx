import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Grid, Card, CardContent, Alert, CircularProgress, Link as MuiLink, IconButton, Button, Chip } from '@mui/material';
import { RevenueChart } from '../components/ui/RevenueChart';
import { MetricCard } from '../components/ui/MetricCard';
import { InsightBanner } from '../components/ui/InsightBanner';
import { getInsights, fetchWithAuth } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import { OpenInNew, Refresh, Storefront, ListAlt, Inventory2 } from '@mui/icons-material';
import { format } from 'date-fns';

// Modern, elegant, and professional dashboard UI improvements
const DashboardContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  display: 'flex',
  flexDirection: 'column'
}));

const DashboardHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    padding: theme.spacing(2)
  }
}));

const HeaderContent = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2)
}));

const HeaderIcon = styled(Storefront)(({ theme }) => ({
  fontSize: 32,
  color: theme.palette.primary.main
}));

const HeaderTitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.5rem',
  fontWeight: 600,
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(0.5)
}));

const HeaderSubtitle = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.palette.text.secondary
}));

const ShopLink = styled('a')(({ theme }) => ({
  color: theme.palette.primary.main,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  '&:hover': {
    textDecoration: 'underline'
  }
}));

const HeaderActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    width: '100%',
    justifyContent: 'space-between'
  }
}));

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: theme.shape.borderRadius,
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[8],
  },
}));

const CardTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  marginBottom: theme.spacing(2),
  color: theme.palette.text.primary,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '200px'
}));

const ErrorContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  color: theme.palette.error.main,
  textAlign: 'center'
}));

const MetricValue = styled(Typography)(({ theme }) => ({
  padding: theme.spacing(3),
  fontSize: '2.75rem',
  fontWeight: 700,
  background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  letterSpacing: '-1px',
}));

const MetricLabel = styled(Typography)(({ theme }) => ({
  padding: theme.spacing(0, 3, 3),
  color: theme.palette.text.secondary,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  fontWeight: 500,
  fontSize: '1rem',
}));

const ChartContainer = styled(Box)(({ theme }) => ({
  height: 300,
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
}));

const ProductLink = styled(MuiLink)(({ theme }) => ({
  color: theme.palette.primary.main,
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  '&:hover': {
    textDecoration: 'underline',
  },
}));

const OrderLink = styled(MuiLink)(({ theme }) => ({
  color: theme.palette.primary.main,
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  '&:hover': {
    textDecoration: 'underline',
  },
}));

interface Product {
  id: string;
  title: string;
  quantity?: number; // sales quantity (if available)
  total_price?: number; // sales revenue (if available)
  inventory?: number; // inventory level
  price?: string; // product price
}

interface Order {
  id: string;
  created_at: string;
  total_price: number;
  customer?: {
    first_name: string;
    last_name: string;
  };
}

interface RevenueData {
  created_at: string;
  total_price: number;
}

interface DashboardInsight {
  totalRevenue: number;
  revenue?: number;
  newProducts: number;
  abandonedCarts: number;
  lowInventory: number;
  topProducts: any[];
  orders: any[];
  recentOrders: any[];
  timeseries: any[];
  conversionRate?: number;
  conversionRateDelta?: number;
  abandonedCartCount?: number;
}

interface InventoryItem {
  id: string;
  title: string;
  quantity: number;
}

interface AbandonedCartsData {
  abandonedCarts: number;
}

interface LowInventoryData {
  lowInventory: InventoryItem[];
}

interface NewProductsData {
  newProducts: number;
}

interface TopProductsData {
  products: Product[];
}

interface OrdersData {
  timeseries: Order[];
  page: number;
  limit: number;
  has_more: boolean;
}

// Simple cache with timestamps
interface CacheData {
  [key: string]: {
    data: any;
    timestamp: number;
  };
}

const formatDate = (dateString: string) => {
  return format(new Date(dateString), 'MMM dd, yyyy');
};

interface CardLoadingState {
  revenue: boolean;
  products: boolean;
  inventory: boolean;
  newProducts: boolean;
  insights: boolean;
  orders: boolean;
  abandonedCarts: boolean;
}

interface CardErrorState {
  revenue: string | null;
  products: string | null;
  inventory: string | null;
  newProducts: string | null;
  insights: string | null;
  orders: string | null;
  abandonedCarts: string | null;
}

const DashboardPage = () => {
  const { isAuthenticated, shop, authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [insights, setInsights] = useState<DashboardInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasRateLimit, setHasRateLimit] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  const [cache, setCache] = useState<CacheData>({});
  
  // Enhanced loading state for individual cards
  const [cardLoading, setCardLoading] = useState<CardLoadingState>({
    revenue: false,
    products: false,
    inventory: false,
    newProducts: false,
    insights: false,
    orders: false,
    abandonedCarts: false
  });

  const [cardErrors, setCardErrors] = useState<CardErrorState>({
    revenue: null,
    products: null,
    inventory: null,
    newProducts: null,
    insights: null,
    orders: null,
    abandonedCarts: null
  });

  // Cache management
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const STALE_DURATION = 2 * 60 * 1000; // 2 minutes (show stale data indicator)

  const isCacheValid = useCallback((cacheKey: string) => {
    const cached = cache[cacheKey];
    return cached && (Date.now() - cached.timestamp) < CACHE_DURATION;
  }, [cache]);

  const isCacheStale = useCallback((cacheKey: string) => {
    const cached = cache[cacheKey];
    return cached && (Date.now() - cached.timestamp) > STALE_DURATION;
  }, [cache]);

  const setCacheData = useCallback((cacheKey: string, data: any) => {
    setCache(prev => ({
      ...prev,
      [cacheKey]: {
        data,
        timestamp: Date.now()
      }
    }));
  }, []);

  const getCacheData = useCallback((cacheKey: string) => {
    return cache[cacheKey]?.data;
  }, [cache]);

  // Handle URL parameters from OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const shopFromUrl = urlParams.get('shop');
    if (shopFromUrl) {
      console.log('Dashboard: Setting shop from URL:', shopFromUrl);
      // Clear the URL parameter
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('shop');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [location.search, navigate]);

  // Retry logic with exponential backoff
  const retryWithBackoff = useCallback(async (apiCall: () => Promise<any>, maxRetries = 3) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error: any) {
        const isRateLimit = error.status === 429 || 
                           (error.message && error.message.includes('429')) ||
                           (error.response && error.response.status === 429);
        
        if (isRateLimit && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  }, []);

  // Enhanced fetch function with caching
  const fetchWithCache = useCallback(async (cacheKey: string, fetchFn: () => Promise<any>, forceRefresh = false) => {
    if (!forceRefresh && isCacheValid(cacheKey)) {
      console.log(`Using cached data for ${cacheKey}`);
      return getCacheData(cacheKey);
    }

    console.log(`Fetching fresh data for ${cacheKey}`);
    const data = await fetchFn();
    setCacheData(cacheKey, data);
    return data;
  }, [isCacheValid, getCacheData, setCacheData]);

  // Individual card data fetching functions with caching
  const fetchRevenueData = useCallback(async (forceRefresh = false) => {
    setCardLoading(prev => ({ ...prev, revenue: true }));
    setCardErrors(prev => ({ ...prev, revenue: null }));
    
    try {
      const data = await fetchWithCache('revenue', async () => {
        const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/revenue'));
        return await response.json();
      }, forceRefresh);
      
      if ((data.error_code === 'INSUFFICIENT_PERMISSIONS' || (data.error && data.error.includes('re-authentication')))) {
        setCardErrors(prev => ({ ...prev, revenue: 'Permission denied – please re-authenticate with Shopify' }));
        return;
      }

      if (data.error_code === 'API_ACCESS_LIMITED') {
        setInsights(prev => ({ ...prev!, totalRevenue: 0 }));
        return;
      }
      
      if (data.error_code === 'USING_TEST_DATA') {
        setInsights(prev => ({ ...prev!, totalRevenue: data.revenue || 0 }));
        return;
      }

      let timeseriesData = data.timeseries || [];
      if (!timeseriesData.length) {
        try {
          const tsResp = await retryWithBackoff(() => fetchWithAuth('/api/analytics/revenue/timeseries'));
          const tsJson = await tsResp.json();
          timeseriesData = tsJson.timeseries || [];
        } catch (err) {
          console.warn('Failed to fetch revenue timeseries', err);
        }
      }
      
      setInsights(prev => ({
        ...prev!,
        totalRevenue: data.rate_limited ? 0 : (data.totalRevenue || data.revenue || 0),
        timeseries: data.rate_limited ? [] : timeseriesData
      }));
      
      if (data.rate_limited) setHasRateLimit(true);
    } catch (error: any) {
      if (error.message === 'PERMISSION_ERROR') {
        setCardErrors(prev => ({ ...prev, revenue: 'Permission denied – please re-authenticate with Shopify' }));
        return;
      }
      setCardErrors(prev => ({ ...prev, revenue: 'Failed to load revenue data' }));
    } finally {
      setCardLoading(prev => ({ ...prev, revenue: false }));
    }
  }, [fetchWithCache, retryWithBackoff]);

  // Initialize dashboard with basic structure - FIXED LOADING ISSUE
  useEffect(() => {
    // Don't initialize if still authenticating
    if (authLoading) {
      console.log('Dashboard: Still authenticating, waiting...');
      return;
    }

    if (!shop) {
      console.log('Dashboard: No shop, clearing data');
      setError('No shop selected');
      setLoading(false);
      setInsights(null);
      setCardLoading({
        revenue: false,
        products: false,
        inventory: false,
        newProducts: false,
        insights: false,
        orders: false,
        abandonedCarts: false
      });
      setCardErrors({
        revenue: null,
        products: null,
        inventory: null,
        newProducts: null,
        insights: null,
        orders: null,
        abandonedCarts: null
      });
      setHasRateLimit(false);
      return;
    }

    if (shop && shop.trim() !== '') {
      console.log('Dashboard: Initializing for shop:', shop);
      setError(null);
      
      setInsights(prev => {
        if (prev === null) {
          console.log('Dashboard: Creating initial insights structure');
          return {
            totalRevenue: 0,
            newProducts: 0,
            abandonedCarts: 0,
            lowInventory: 0,
            topProducts: [],
            orders: [],
            recentOrders: [],
            timeseries: [],
            conversionRate: 0,
            conversionRateDelta: 0,
            abandonedCartCount: 0
          };
        }
        return prev;
      });
      
      // Set loading to false immediately after creating structure
      setTimeout(() => {
        setLoading(false);
        console.log('Dashboard: Basic structure initialized, loading set to false');
      }, 100);
    }
  }, [shop, authLoading]);

  // Auto-fetch data on initial load with caching
  useEffect(() => {
    if (shop && !authLoading && !loading) {
      console.log('Dashboard: Auto-fetching initial data');
      setTimeout(() => {
        fetchRevenueData();
      }, 200);
    }
  }, [shop, authLoading, loading, fetchRevenueData]);

  // Refresh all data
  const refreshAllData = useCallback(() => {
    if (!shop) return;
    
    console.log('Dashboard: Refreshing all data');
    setLastRefresh(Date.now());
    
    // Clear cache and force refresh
    setCache({});
    fetchRevenueData(true);
  }, [shop, fetchRevenueData]);

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh' 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <Typography variant="h6" color="text.secondary">
          {error}
        </Typography>
        {error === 'No data available yet. Check back soon!' && (
          <Typography variant="body2" color="text.secondary" component="div">
            Your dashboard will populate with data once you start making sales
          </Typography>
        )}
      </Box>
    );
  }

  const getCacheAge = (cacheKey: string) => {
    const cached = cache[cacheKey];
    if (!cached) return 0;
    return Math.floor((Date.now() - cached.timestamp) / 1000);
  };

  const hasValidCache = Object.keys(cache).some(key => isCacheValid(key));

  return (
    <DashboardContainer>
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: { xs: 2, md: 3 },
          width: '100%',
          maxWidth: '1400px',
          margin: '0 auto',
          px: { xs: 2, md: 3 },
          pt: 3
        }}
      >
        {error && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Cache Status and Refresh Controls */}
        {shop && !error && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Last updated: {lastRefresh > 0 ? new Date(lastRefresh).toLocaleTimeString() : 'Never'}
              </Typography>
              {hasValidCache && (
                <Chip 
                  size="small" 
                  color="success" 
                  variant="outlined"
                  label={`Using cached data (${Math.min(...Object.keys(cache).map(getCacheAge))}s old)`}
                />
              )}
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={refreshAllData}
              disabled={Object.values(cardLoading).some(loading => loading)}
              startIcon={<Refresh />}
            >
              Refresh Data
            </Button>
          </Box>
        )}

        {/* Metrics Overview */}
        <Box 
          sx={{ 
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr 1fr' },
            gap: 2
          }}
        >
          <MetricCard
            label="Total Revenue"
            value={`$${insights?.totalRevenue?.toLocaleString() || '0'}`}
            loading={cardLoading.revenue}
            error={cardErrors.revenue}
            onRetry={() => fetchRevenueData()}
          />
        </Box>

        {/* Revenue Chart */}
        {insights?.timeseries && insights.timeseries.length > 0 && (
          <StyledCard>
            <CardContent>
              <CardTitle>
                <Box sx={{ fontSize: '1.25rem' }}>📈</Box>
                Revenue Trend (Last 30 Days)
              </CardTitle>
              <ChartContainer>
                <RevenueChart data={insights.timeseries} />
              </ChartContainer>
            </CardContent>
          </StyledCard>
        )}
      </Box>
    </DashboardContainer>
  );
};

export default DashboardPage;
