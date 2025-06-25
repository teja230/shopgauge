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

  const fetchProductsData = useCallback(async (forceRefresh = false) => {
    setCardLoading(prev => ({ ...prev, products: true }));
    setCardErrors(prev => ({ ...prev, products: null }));
    
    try {
      const data = await fetchWithCache('products', async () => {
        const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/products'));
        return await response.json();
      }, forceRefresh);
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        throw new Error('PERMISSION_ERROR');
      }
      
      setInsights(prev => ({
        ...prev!,
        topProducts: data.rate_limited ? [] : (data.products || [])
      }));
      
      if (data.rate_limited) setHasRateLimit(true);
    } catch (error: any) {
      if (error.message === 'PERMISSION_ERROR') {
        navigate('/');
        return;
      }
      setCardErrors(prev => ({ ...prev, products: 'Failed to load products data' }));
    } finally {
      setCardLoading(prev => ({ ...prev, products: false }));
    }
  }, [fetchWithCache, retryWithBackoff, navigate]);

  const fetchInventoryData = useCallback(async (forceRefresh = false) => {
    setCardLoading(prev => ({ ...prev, inventory: true }));
    setCardErrors(prev => ({ ...prev, inventory: null }));
    
    try {
      const data = await fetchWithCache('inventory', async () => {
        const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/inventory/low'));
        return await response.json();
      }, forceRefresh);
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        throw new Error('PERMISSION_ERROR');
      }
      
      setInsights(prev => ({
        ...prev!,
        lowInventory: data.rate_limited ? 0 : (Array.isArray(data.lowInventory) ? data.lowInventory.length : (data.lowInventoryCount || 0))
      }));
      
      if (data.rate_limited) setHasRateLimit(true);
    } catch (error: any) {
      if (error.message === 'PERMISSION_ERROR') {
        navigate('/');
        return;
      }
      setCardErrors(prev => ({ ...prev, inventory: 'Failed to load inventory data' }));
    } finally {
      setCardLoading(prev => ({ ...prev, inventory: false }));
    }
  }, [fetchWithCache, retryWithBackoff, navigate]);

  const fetchNewProductsData = useCallback(async (forceRefresh = false) => {
    setCardLoading(prev => ({ ...prev, newProducts: true }));
    setCardErrors(prev => ({ ...prev, newProducts: null }));
    
    try {
      const data = await fetchWithCache('newProducts', async () => {
        const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/new_products'));
        return await response.json();
      }, forceRefresh);
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        throw new Error('PERMISSION_ERROR');
      }
      
      setInsights(prev => ({
        ...prev!,
        newProducts: data.rate_limited ? 0 : (data.newProducts || 0)
      }));
      
      if (data.rate_limited) setHasRateLimit(true);
    } catch (error: any) {
      if (error.message === 'PERMISSION_ERROR') {
        navigate('/');
        return;
      }
      setCardErrors(prev => ({ ...prev, newProducts: 'Failed to load new products data' }));
    } finally {
      setCardLoading(prev => ({ ...prev, newProducts: false }));
    }
  }, [fetchWithCache, retryWithBackoff, navigate]);

  const fetchInsightsData = useCallback(async (forceRefresh = false) => {
    setCardLoading(prev => ({ ...prev, insights: true }));
    setCardErrors(prev => ({ ...prev, insights: null }));
    
    try {
      const data = await fetchWithCache('insights', async () => {
        const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/conversion'));
        return await response.json();
      }, forceRefresh);
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        throw new Error('PERMISSION_ERROR');
      }
      
      if (data.error_code === 'USING_TEST_DATA') {
        setInsights(prev => ({
          ...prev!,
          conversionRate: data.conversionRate || 2.5,
          conversionRateDelta: data.conversionRateDelta || 0
        }));
        return;
      }
      
      setInsights(prev => ({
        ...prev!,
        conversionRate: data.rate_limited ? 0 : (data.conversionRate || 0),
        conversionRateDelta: 0
      }));
      
      if (data.rate_limited) setHasRateLimit(true);
    } catch (error: any) {
      if (error.message === 'PERMISSION_ERROR') {
        navigate('/');
        return;
      }
      setCardErrors(prev => ({ ...prev, insights: 'Failed to load insights data' }));
    } finally {
      setCardLoading(prev => ({ ...prev, insights: false }));
    }
  }, [fetchWithCache, retryWithBackoff, navigate]);

  const fetchAbandonedCartsData = useCallback(async (forceRefresh = false) => {
    setCardLoading(prev => ({ ...prev, abandonedCarts: true }));
    setCardErrors(prev => ({ ...prev, abandonedCarts: null }));
    
    try {
      const data = await fetchWithCache('abandonedCarts', async () => {
        const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/abandoned_carts'));
        return await response.json();
      }, forceRefresh);
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        setCardErrors(prev => ({ ...prev, abandonedCarts: 'Permission denied – please re-authenticate with Shopify' }));
        return;
      }

      if (data.error_code === 'API_ACCESS_LIMITED') {
        setInsights(prev => ({ ...prev!, abandonedCarts: 0 }));
        return;
      }
      
      if (data.error_code === 'USING_TEST_DATA') {
        setInsights(prev => ({ ...prev!, abandonedCarts: data.abandonedCarts || 0 }));
        return;
      }
      
      setInsights(prev => ({
        ...prev!,
        abandonedCarts: data.rate_limited ? 0 : (data.abandonedCarts || 0)
      }));
      
      if (data.rate_limited) setHasRateLimit(true);
    } catch (error: any) {
      if (error.message === 'PERMISSION_ERROR') {
        setCardErrors(prev => ({ ...prev, abandonedCarts: 'Permission denied – please re-authenticate with Shopify' }));
        return;
      }
      setCardErrors(prev => ({ ...prev, abandonedCarts: 'Failed to load abandoned carts data' }));
    } finally {
      setCardLoading(prev => ({ ...prev, abandonedCarts: false }));
    }
  }, [fetchWithCache, retryWithBackoff]);

  const fetchOrdersData = useCallback(async (forceRefresh = false) => {
    setCardLoading(prev => ({ ...prev, orders: true }));
    setCardErrors(prev => ({ ...prev, orders: null }));
    
    try {
      const data = await fetchWithCache('orders', async () => {
        const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/orders/timeseries?page=1&limit=50'));
        const firstPageData = await response.json();
        
        console.log('Orders API response:', firstPageData);
        
        if (firstPageData.error_code === 'INSUFFICIENT_PERMISSIONS' || 
            (firstPageData.error && firstPageData.error.includes('re-authentication'))) {
          throw new Error('PERMISSION_ERROR');
        }
        
        if (firstPageData.error_code === 'API_ACCESS_LIMITED') {
          return { timeseries: [], rate_limited: false };
        }
        
        if (firstPageData.error_code === 'USING_TEST_DATA') {
          return { timeseries: firstPageData.timeseries || [], rate_limited: false };
        }
        
        let allOrders = firstPageData.timeseries || [];
        
        // Only fetch additional pages if first page worked and we have more data
        if (!firstPageData.rate_limited && firstPageData.has_more) {
          try {
            for (let page = 2; page <= 5; page++) {
              await new Promise(resolve => setTimeout(resolve, 500));
              const additionalResponse = await fetchWithAuth(`/api/analytics/orders/timeseries?page=${page}&limit=50`);
              const additionalData = await additionalResponse.json();
              
              if (additionalData.timeseries) {
                allOrders = [...allOrders, ...additionalData.timeseries];
              }
              
              if (!additionalData.has_more) break;
            }
          } catch (err) {
            console.warn('Error fetching additional order pages:', err);
          }
        }
        
        allOrders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        return { timeseries: allOrders, rate_limited: firstPageData.rate_limited };
      }, forceRefresh); // Cache orders
      
      setInsights(prev => ({
        ...prev!,
        orders: data.rate_limited ? [] : data.timeseries,
        recentOrders: data.rate_limited ? [] : data.timeseries.slice(0, 5)
      }));
      
      if (data.rate_limited) setHasRateLimit(true);
    } catch (error: any) {
      if (error.message === 'PERMISSION_ERROR') {
        setCardErrors(prev => ({ ...prev, orders: 'Permission denied – please re-authenticate with Shopify' }));
        return;
      }
      setCardErrors(prev => ({ ...prev, orders: 'Failed to load orders data' }));
    } finally {
      setCardLoading(prev => ({ ...prev, orders: false }));
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
        fetchProductsData();
        fetchOrdersData();
      }, 200);
    }
  }, [shop, authLoading, loading, fetchRevenueData, fetchProductsData, fetchOrdersData]);

  // Lazy load data for individual cards
  const handleCardLoad = useCallback((cardType: keyof CardLoadingState) => {
    setTimeout(() => {
      switch (cardType) {
        case 'revenue':
          fetchRevenueData();
          break;
        case 'products':
          fetchProductsData();
          break;
        case 'inventory':
          fetchInventoryData();
          break;
        case 'newProducts':
          fetchNewProductsData();
          break;
        case 'insights':
          fetchInsightsData();
          break;
        case 'orders':
          fetchOrdersData();
          break;
        case 'abandonedCarts':
          fetchAbandonedCartsData();
          break;
      }
    }, 100);
  }, [fetchRevenueData, fetchProductsData, fetchInventoryData, fetchNewProductsData, fetchInsightsData, fetchOrdersData, fetchAbandonedCartsData]);

  // Refresh all data
  const refreshAllData = useCallback(() => {
    if (!shop) return;
    
    console.log('Dashboard: Refreshing all data');
    setLastRefresh(Date.now());
    
    // Clear cache and force refresh
    setCache({});
    fetchRevenueData(true);
    fetchProductsData(true);
    fetchInventoryData(true);
    fetchNewProductsData(true);
    fetchInsightsData(true);
    fetchOrdersData(true);
    fetchAbandonedCartsData(true);
  }, [shop, fetchRevenueData, fetchProductsData, fetchInventoryData, fetchNewProductsData, fetchInsightsData, fetchOrdersData, fetchAbandonedCartsData]);

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
            onRetry={() => handleCardLoad('revenue')}
            onLoad={() => handleCardLoad('revenue')}
          />
          <MetricCard
            label="Conversion Rate"
            value={`${insights?.conversionRate?.toFixed(2) || '0'}%`}
            delta={insights?.conversionRateDelta && insights.conversionRateDelta !== 0 ? insights.conversionRateDelta.toString() : undefined}
            deltaType={insights?.conversionRateDelta && insights.conversionRateDelta > 0 ? 'up' : 'down'}
            loading={cardLoading.insights}
            error={cardErrors.insights}
            onRetry={() => handleCardLoad('insights')}
            onLoad={() => handleCardLoad('insights')}
          />
          <MetricCard
            label="Abandoned Carts"
            value={insights?.abandonedCarts?.toString() || '0'}
            loading={cardLoading.abandonedCarts}
            error={cardErrors.abandonedCarts}
            onRetry={() => handleCardLoad('abandonedCarts')}
            onLoad={() => handleCardLoad('abandonedCarts')}
          />
          <MetricCard
            label="Low Inventory"
            value={typeof insights?.lowInventory === 'number' ? insights.lowInventory.toString() : '0'}
            loading={cardLoading.inventory}
            error={cardErrors.inventory}
            onRetry={() => handleCardLoad('inventory')}
            onLoad={() => handleCardLoad('inventory')}
          />
          <MetricCard
            label="New Products"
            value={typeof insights?.newProducts === 'number' ? insights.newProducts.toString() : '0'}
            loading={cardLoading.newProducts}
            error={cardErrors.newProducts}
            onRetry={() => handleCardLoad('newProducts')}
            onLoad={() => handleCardLoad('newProducts')}
          />
        </Box>

        {/* Products and Orders */}
        <Box 
          sx={{ 
            display: 'flex', 
            gap: { xs: 2, md: 3 }, 
            flexDirection: { xs: 'column', md: 'row' },
            width: '100%'
          }}
        >
          <Box 
            sx={{ 
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <StyledCard sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ fontSize: '1.25rem' }}>📦</Box>
                    Top Products
                  </Typography>
                  {cardErrors.products && (
                    <Button 
                      size="small" 
                      onClick={() => handleCardLoad('products')}
                      startIcon={<Refresh />}
                    >
                      Retry
                    </Button>
                  )}
                </Box>
                {cardLoading.products ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Loading products...
                    </Typography>
                  </Box>
                ) : cardErrors.products ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="h6" color="error" gutterBottom>
                      Failed to load products
                    </Typography>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={() => handleCardLoad('products')}
                      startIcon={<Refresh />}
                    >
                      Retry
                    </Button>
                  </Box>
                ) : insights?.topProducts?.length ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 400, overflowY: 'auto' }}>
                    {insights.topProducts.map((product) => (
                      <Box key={`product-${product.id}`} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: 1, backgroundColor: 'background.default', '&:hover': { backgroundColor: 'action.hover' } }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.875rem', lineHeight: 1.4 }}>
                            <MuiLink 
                              href={`https://${shop}/admin/products/${product.id}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              sx={{ color: 'primary.main', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 1, '&:hover': { textDecoration: 'underline' } }}
                            >
                              {product.title}
                              <OpenInNew fontSize="small" />
                            </MuiLink>
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                            {typeof product.inventory !== 'undefined' ? `${product.inventory} in stock` : 'N/A'} • {product.price || 'N/A'}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No products data available yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" component="div">
                      Product performance data will appear here once you start making sales
                    </Typography>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={() => handleCardLoad('products')}
                      sx={{ mt: 1 }}
                    >
                      Load Products
                    </Button>
                  </Box>
                )}
              </CardContent>
            </StyledCard>
          </Box>

          <Box 
            sx={{ 
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <StyledCard sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ fontSize: '1.25rem' }}>📋</Box>
                    Recent Orders
                  </Typography>
                  {cardErrors.orders && (
                    <Button 
                      size="small" 
                      onClick={() => handleCardLoad('orders')}
                      startIcon={<Refresh />}
                    >
                      Retry
                    </Button>
                  )}
                </Box>
                {cardLoading.orders ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Loading orders...
                    </Typography>
                  </Box>
                ) : cardErrors.orders ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="h6" color="error" gutterBottom>
                      Failed to load orders
                    </Typography>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={() => handleCardLoad('orders')}
                      startIcon={<Refresh />}
                    >
                      Retry
                    </Button>
                  </Box>
                ) : insights?.orders?.length ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 400, overflowY: 'auto' }}>
                    {insights.orders.slice(0, 5).map((order, index) => (
                      <Box key={`order-${order.id || `temp-${index}`}`} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: 1, backgroundColor: 'background.default', '&:hover': { backgroundColor: 'action.hover' } }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.875rem', lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 1 }}>
                            {order.id ? (
                              <MuiLink 
                                href={`https://${shop}/admin/orders/${order.id}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                sx={{ color: 'primary.main', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 1, '&:hover': { textDecoration: 'underline' } }}
                              >
                                Order #{order.id}
                                <OpenInNew fontSize="small" />
                              </MuiLink>
                            ) : (
                              <Typography variant="body1" color="text.secondary" component="div">
                                Order #{`Temporary-${index + 1}`}
                              </Typography>
                            )}
                            {order.customer && (
                              <Typography 
                                component="span" 
                                variant="body2" 
                                color="text.secondary" 
                                sx={{ 
                                  ml: 1,
                                  display: { xs: 'none', sm: 'inline' }
                                }}
                              >
                                • {order.customer.first_name} {order.customer.last_name}
                              </Typography>
                            )}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                            {format(new Date(order.created_at), 'MMM dd, yyyy')} • ${order.total_price}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No orders data available yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" component="div">
                      Order data will appear here once you start receiving orders
                    </Typography>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={() => handleCardLoad('orders')}
                      sx={{ mt: 1 }}
                    >
                      Load Orders
                    </Button>
                  </Box>
                )}
              </CardContent>
            </StyledCard>
          </Box>
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
