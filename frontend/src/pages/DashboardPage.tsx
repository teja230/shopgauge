import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Grid, Card, CardContent, Alert, CircularProgress, Link as MuiLink, IconButton, Button } from '@mui/material';
import { RevenueChart } from '../components/ui/RevenueChart';
import { MetricCard } from '../components/ui/MetricCard';
import { InsightBanner } from '../components/ui/InsightBanner';
import { getInsights, fetchWithAuth } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import { OpenInNew, Refresh, Storefront, ListAlt, Inventory2 } from '@mui/icons-material';
import { format } from 'date-fns';

// Cache configuration - Enterprise-grade settings
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_KEY = 'dashboard_cache_v2'; // Version to force cache refresh if needed
const CACHE_VERSION = '1.0.0';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  lastUpdated: Date;
  version: string;
}

interface DashboardCache {
  version?: string;
  revenue?: CacheEntry<{ totalRevenue: number; timeseries: any[] }>;
  products?: CacheEntry<{ products: any[] }>;
  inventory?: CacheEntry<{ lowInventory: number }>;
  newProducts?: CacheEntry<{ newProducts: number }>;
  abandonedCarts?: CacheEntry<{ abandonedCarts: number }>;
  orders?: CacheEntry<{ orders: any[]; recentOrders: any[] }>;
  insights?: CacheEntry<{ conversionRate?: number; conversionRateDelta?: number }>;
}

// Enterprise-grade cache management with versioning and validation
const loadCacheFromStorage = (): DashboardCache => {
  try {
    const stored = sessionStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      
      // Version check - invalidate if version mismatch
      if (parsed.version !== CACHE_VERSION) {
        console.log('Cache version mismatch, clearing cache');
        sessionStorage.removeItem(CACHE_KEY);
        return { version: CACHE_VERSION };
      }
      
      // Convert date strings back to Date objects
      Object.keys(parsed).forEach(key => {
        if (parsed[key]?.lastUpdated) {
          parsed[key].lastUpdated = new Date(parsed[key].lastUpdated);
        }
      });
      
      console.log('Loaded cache from storage with', Object.keys(parsed).length - 1, 'entries');
      return parsed;
    }
  } catch (error) {
    console.warn('Failed to load cache from storage:', error);
    sessionStorage.removeItem(CACHE_KEY); // Clear corrupted cache
  }
  return { version: CACHE_VERSION };
};

const saveCacheToStorage = (cache: DashboardCache) => {
  try {
    // Ensure version is set
    cache.version = CACHE_VERSION;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    console.log('Saved cache to storage with', Object.keys(cache).length - 1, 'entries');
  } catch (error) {
    console.warn('Failed to save cache to storage:', error);
    // If storage is full, try to clear old cache and retry
    try {
      sessionStorage.clear();
      cache.version = CACHE_VERSION;
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      console.log('Cleared storage and saved cache successfully');
    } catch (retryError) {
      console.error('Failed to save cache even after clearing storage:', retryError);
    }
  }
};

// Cache invalidation helper - clears both memory and storage
const invalidateCache = () => {
  console.log('Invalidating all cache');
  sessionStorage.removeItem(CACHE_KEY);
  return { version: CACHE_VERSION };
};

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

const RefreshButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  textTransform: 'none',
  fontWeight: 500,
  gap: theme.spacing(1),
  '&:disabled': {
    backgroundColor: theme.palette.action.disabledBackground,
  }
}));

const LastUpdatedText = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
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

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed'];

// Add a modern SaaS hero section at the top of the dashboard
const HeroSection = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(90deg, #f5f7fa 0%, #c3cfe2 100%)',
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(4, 4, 4, 4),
  marginBottom: theme.spacing(5),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  boxShadow: theme.shadows[1],
  gap: theme.spacing(4),
}));

const HeroText = styled(Box)(({ theme }) => ({
  flex: 1,
}));

const HeroTitle = styled(Typography)(({ theme }) => ({
  fontSize: '2.5rem',
  fontWeight: 800,
  color: theme.palette.primary.main,
  marginBottom: theme.spacing(1),
  letterSpacing: '-1px',
}));

const HeroSubtitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.25rem',
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(2),
}));

const HeroImage = styled('img')(() => ({
  width: '100%',
  maxWidth: 400,
  height: 'auto',
  objectFit: 'contain',
  borderRadius: 24,
  boxShadow: '0 4px 24px 0 rgba(80, 112, 255, 0.10)',
}));

// const GridContainer = styled(Grid)(({ theme }) => ({
//   marginTop: theme.spacing(2),
//   gap: theme.spacing(3),
// }));

const ProductList = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  maxHeight: 400,
  overflowY: 'auto'
}));

const ProductItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.default,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  }
}));

const ProductInfo = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  flex: 1,
  minWidth: 0
}));

const ProductName = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.text.primary,
  fontSize: '0.875rem',
  lineHeight: 1.4
}));

const ProductStats = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.75rem',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1)
}));

const OrderList = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  maxHeight: 400,
  overflowY: 'auto'
}));

const OrderItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.default,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  }
}));

const OrderInfo = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  flex: 1,
  minWidth: 0
}));

const OrderTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.text.primary,
  fontSize: '0.875rem',
  lineHeight: 1.4,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1)
}));

const OrderDetails = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.75rem',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1)
}));

// const ProductAvatar = styled(Avatar)(({ theme }) => ({
//   width: 48,
//   height: 48,
//   backgroundColor: theme.palette.primary.light,
//   color: theme.palette.primary.main,
//   boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
// }));

// const OrderAvatar = styled(Avatar)(({ theme }) => ({
//   width: 48,
//   height: 48,
//   backgroundColor: theme.palette.warning.light,
//   color: theme.palette.warning.dark,
//   boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
// }));

// const StatusChip = styled(Chip)(({ theme }) => ({
//   borderRadius: theme.shape.borderRadius,
//   fontWeight: 500,
//   '&.MuiChip-colorSuccess': {
//     backgroundColor: theme.palette.success.light,
//     color: theme.palette.success.dark,
//   },
//   '&.MuiChip-colorWarning': {
//     backgroundColor: theme.palette.warning.light,
//     color: theme.palette.warning.dark,
//   },
// }));

const SectionHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(3),
  paddingBottom: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.25rem',
  fontWeight: 600,
  color: theme.palette.text.primary,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const GraphContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)',
}));

const GraphHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(3),
}));

const GraphTitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.25rem',
  fontWeight: 600,
  color: theme.palette.text.primary,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const GraphLink = styled(MuiLink)(({ theme }) => ({
  color: theme.palette.primary.main,
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  fontSize: '0.875rem',
  '&:hover': {
    textDecoration: 'underline',
  },
}));

const formatDate = (dateString: string) => {
  return format(new Date(dateString), 'MMM d, yyyy');
};

// Add loading states for individual cards
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
  const navigate = useNavigate();
  const location = useLocation();
  const { shop, setShop } = useAuth();
  const [insights, setInsights] = useState<DashboardInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasRateLimit, setHasRateLimit] = useState(false);
  
  // Cache state management using sessionStorage for persistence across navigation
  const [cache, setCache] = useState<DashboardCache>(() => loadCacheFromStorage());
  const [lastGlobalUpdate, setLastGlobalUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Save cache to sessionStorage whenever it changes
  useEffect(() => {
    saveCacheToStorage(cache);
  }, [cache]);
  
  // Individual card loading states
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

  // Helper function to check if cache entry is fresh
  const isCacheFresh = useCallback((cacheEntry: CacheEntry<any> | undefined): boolean => {
    if (!cacheEntry) return false;
    return Date.now() - cacheEntry.timestamp < CACHE_DURATION;
  }, []);

  // Helper function to get cache or fetch fresh data
  const getCachedOrFetch = useCallback(async (
    cacheKey: keyof DashboardCache,
    fetchFunction: () => Promise<any>,
    forceRefresh = false
  ): Promise<any> => {
    // Skip version key
    if (cacheKey === 'version') return null;
    
    const cachedEntry = cache[cacheKey] as CacheEntry<any> | undefined;
    
    if (!forceRefresh && isCacheFresh(cachedEntry)) {
      console.log(`Using cached data for ${cacheKey}`);
      return cachedEntry!.data;
    }
    
    console.log(`Fetching fresh data for ${cacheKey}`);
    const freshData = await fetchFunction();
    const now = new Date();
    
    setCache(prev => ({
      ...prev,
      [cacheKey]: {
        data: freshData,
        timestamp: Date.now(),
        lastUpdated: now,
        version: CACHE_VERSION
      }
    }));
    
    setLastGlobalUpdate(now);
    return freshData;
  }, [cache, isCacheFresh]);



  // Get the most recent update time across all cache entries
  const getMostRecentUpdateTime = useCallback((): Date | null => {
    const updateTimes = Object.entries(cache)
      .filter(([key, entry]) => key !== 'version' && entry?.lastUpdated)
      .map(([, entry]) => (entry as CacheEntry<any>).lastUpdated);
    
    if (updateTimes.length === 0) return null;
    
    return updateTimes.reduce((latest, current) => 
      current > latest ? current : latest
    );
  }, [cache]);

  // Format last updated text
  const getLastUpdatedText = useCallback((): string => {
    const lastUpdate = getMostRecentUpdateTime();
    if (!lastUpdate) return 'Never updated';
    
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just updated';
    if (diffMinutes === 1) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    return format(lastUpdate, 'MMM d, h:mm a');
  }, [getMostRecentUpdateTime]);

  // Handle URL parameters from OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const shopParam = urlParams.get('shop');
    const authParam = urlParams.get('auth');
    
    if (shopParam && authParam === 'success') {
      console.log('Processing OAuth callback - shop:', shopParam);
      
      // Set the shop cookie on the frontend domain
      const isProduction = window.location.hostname.includes('shopgaugeai.com');
      const domainAttribute = isProduction ? '; domain=.shopgaugeai.com' : '';
      const cookieValue = `shop=${shopParam}; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax${domainAttribute}`;
      document.cookie = cookieValue;
      
      // Update the auth context
      if (setShop) {
        setShop(shopParam);
      }
      
      // Clean up the URL parameters
      navigate('/dashboard', { replace: true });
      
      console.log('Successfully set shop cookie and updated auth context');
    }
  }, [location.search, navigate, setShop]);

  // Retry logic with exponential backoff
  const retryWithBackoff = useCallback(async (apiCall: () => Promise<any>, maxRetries = 3) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error: any) {
        // Check if it's a rate limit error (429) or network error
        const isRateLimit = error.status === 429 || 
                           (error.message && error.message.includes('429')) ||
                           (error.response && error.response.status === 429);
        
        if (isRateLimit && attempt < maxRetries) {
          // Rate limited - wait with exponential backoff
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  }, []);

  // Individual card data fetching functions
  const fetchRevenueData = useCallback(async (forceRefresh = false) => {
    setCardLoading(prev => ({ ...prev, revenue: true }));
    setCardErrors(prev => ({ ...prev, revenue: null }));
    
    try {
      const data = await getCachedOrFetch('revenue', async () => {
        const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/revenue'));
        return await response.json();
      }, forceRefresh);
      
      if ((data.error_code === 'INSUFFICIENT_PERMISSIONS' || (data.error && data.error.includes('re-authentication')))) {
        setCardErrors(prev => ({ ...prev, revenue: 'Permission denied – please re-authenticate with Shopify' }));
        return;
      }

      if (data.error_code === 'API_ACCESS_LIMITED') {
        // Silently handle limited access - show 0 data without error message
        setInsights(prev => ({
          ...prev!,
          totalRevenue: 0,
          timeseries: []
        }));
        return;
      }
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS') {
        console.log('Revenue API access denied - insufficient permissions');
        setCardErrors(prev => ({ ...prev, revenue: 'Permission denied – please re-authenticate with Shopify' }));
        setInsights(prev => ({
          ...prev!,
          totalRevenue: 0,
          timeseries: []
        }));
        return;
      }

      // Handle successful data response
      let timeseriesData = data.timeseries || [];
      const totalRevenue = data.totalRevenue || data.revenue || 0;
      
      console.log('Revenue API response:', {
        totalRevenue,
        timeseriesLength: timeseriesData.length,
        periodDays: data.period_days,
        ordersCount: data.orders_count
      });
      
      // If API didn't return timeseries but we have revenue, try to fetch timeseries separately
      if (!timeseriesData.length && totalRevenue > 0) {
        try {
          console.log('Fetching timeseries data separately...');
          const tsResp = await retryWithBackoff(() => fetchWithAuth('/api/analytics/revenue/timeseries'));
          const tsJson = await tsResp.json();
          timeseriesData = tsJson.timeseries || [];
          console.log('Separate timeseries fetch result:', timeseriesData.length, 'data points');
        } catch (err) {
          console.warn('Failed to fetch revenue timeseries', err);
        }
      }
      
      setInsights(prev => ({
        ...prev!,
        totalRevenue: data.rate_limited ? 0 : totalRevenue,
        timeseries: data.rate_limited ? [] : timeseriesData
      }));
      
      if (data.rate_limited) {
        setHasRateLimit(true);
      }
      
      console.log('Updated insights with revenue data:', {
        totalRevenue: data.rate_limited ? 0 : totalRevenue,
        timeseriesPoints: data.rate_limited ? 0 : timeseriesData.length
      });
      
    } catch (error: any) {
      console.error('Revenue data fetch error:', error);
      if (error.message === 'PERMISSION_ERROR') {
        setCardErrors(prev => ({ ...prev, revenue: 'Permission denied – please re-authenticate with Shopify' }));
        return;
      }
      setCardErrors(prev => ({ ...prev, revenue: 'Failed to load revenue data' }));
    } finally {
      setCardLoading(prev => ({ ...prev, revenue: false }));
    }
  }, [retryWithBackoff, getCachedOrFetch]);

  const fetchProductsData = useCallback(async () => {
    setCardLoading(prev => ({ ...prev, products: true }));
    setCardErrors(prev => ({ ...prev, products: null }));
    
    try {
      const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/products'));
      const data = await response.json();
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        throw new Error('PERMISSION_ERROR');
      }
      
      setInsights(prev => ({
        ...prev!,
        topProducts: data.rate_limited ? [] : (data.products || [])
      }));
      
      if (data.rate_limited) {
        setHasRateLimit(true);
      }
    } catch (error: any) {
      if (error.message === 'PERMISSION_ERROR') {
        navigate('/');
        return;
      }
      setCardErrors(prev => ({ ...prev, products: 'Failed to load products data' }));
    } finally {
      setCardLoading(prev => ({ ...prev, products: false }));
    }
  }, [retryWithBackoff, navigate]);

  const fetchInventoryData = useCallback(async () => {
    setCardLoading(prev => ({ ...prev, inventory: true }));
    setCardErrors(prev => ({ ...prev, inventory: null }));
    
    try {
      const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/inventory/low'));
      const data = await response.json();
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        throw new Error('PERMISSION_ERROR');
      }
      
      setInsights(prev => ({
        ...prev!,
        lowInventory: data.rate_limited ? 0 : (Array.isArray(data.lowInventory) ? data.lowInventory.length : (data.lowInventoryCount || 0))
      }));
      
      if (data.rate_limited) {
        setHasRateLimit(true);
      }
    } catch (error: any) {
      if (error.message === 'PERMISSION_ERROR') {
        navigate('/');
        return;
      }
      setCardErrors(prev => ({ ...prev, inventory: 'Failed to load inventory data' }));
    } finally {
      setCardLoading(prev => ({ ...prev, inventory: false }));
    }
  }, [retryWithBackoff, navigate]);

  const fetchNewProductsData = useCallback(async () => {
    setCardLoading(prev => ({ ...prev, newProducts: true }));
    setCardErrors(prev => ({ ...prev, newProducts: null }));
    
    try {
      const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/new_products'));
      const data = await response.json();
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        throw new Error('PERMISSION_ERROR');
      }
      
      setInsights(prev => ({
        ...prev!,
        newProducts: data.rate_limited ? 0 : (data.newProducts || 0)
      }));
      
      if (data.rate_limited) {
        setHasRateLimit(true);
      }
    } catch (error: any) {
      if (error.message === 'PERMISSION_ERROR') {
        navigate('/');
        return;
      }
      setCardErrors(prev => ({ ...prev, newProducts: 'Failed to load new products data' }));
    } finally {
      setCardLoading(prev => ({ ...prev, newProducts: false }));
    }
  }, [retryWithBackoff, navigate]);

  const fetchInsightsData = useCallback(async () => {
    setCardLoading(prev => ({ ...prev, insights: true }));
    setCardErrors(prev => ({ ...prev, insights: null }));
    
    try {
      // Use the new conversion endpoint that provides better data
      const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/conversion'));
      const data = await response.json();
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        throw new Error('PERMISSION_ERROR');
      }
      
      // Handle insufficient permissions for insights
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS') {
        console.log('Conversion rate API access denied - insufficient permissions');
        setCardErrors(prev => ({ ...prev, insights: 'Permission denied – please re-authenticate with Shopify' }));
        setInsights(prev => ({
          ...prev!,
          conversionRate: 0,
          conversionRateDelta: 0
        }));
        return;
      }
      
      setInsights(prev => ({
        ...prev!,
        conversionRate: data.rate_limited ? 0 : (data.conversionRate || 0),
        conversionRateDelta: 0 // No delta calculation for simplified approach
      }));
      
      if (data.rate_limited) {
        setHasRateLimit(true);
      }
    } catch (error: any) {
      if (error.message === 'PERMISSION_ERROR') {
        navigate('/');
        return;
      }
      setCardErrors(prev => ({ ...prev, insights: 'Failed to load insights data' }));
    } finally {
      setCardLoading(prev => ({ ...prev, insights: false }));
    }
  }, [retryWithBackoff, navigate]);

  const fetchAbandonedCartsData = useCallback(async () => {
    setCardLoading(prev => ({ ...prev, abandonedCarts: true }));
    setCardErrors(prev => ({ ...prev, abandonedCarts: null }));
    
    try {
      const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/abandoned_carts'));
      const data = await response.json();
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        setCardErrors(prev => ({ ...prev, abandonedCarts: 'Permission denied – please re-authenticate with Shopify' }));
        return;
      }

      if (data.error_code === 'API_ACCESS_LIMITED') {
        // Silently handle limited access - show 0 data without error message
        setInsights(prev => ({
          ...prev!,
          abandonedCarts: 0
        }));
        return;
      }
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS') {
        console.log('Abandoned carts API access denied - insufficient permissions');
        setCardErrors(prev => ({ ...prev, abandonedCarts: 'Permission denied – please re-authenticate with Shopify' }));
        setInsights(prev => ({
          ...prev!,
          abandonedCarts: 0
        }));
        return;
      }
      
      setInsights(prev => ({
        ...prev!,
        abandonedCarts: data.rate_limited ? 0 : (data.abandonedCarts || 0)
      }));
      
      if (data.rate_limited) {
        setHasRateLimit(true);
      }
    } catch (error: any) {
      if (error.message === 'PERMISSION_ERROR') {
        setCardErrors(prev => ({ ...prev, abandonedCarts: 'Permission denied – please re-authenticate with Shopify' }));
        return;
      }
      setCardErrors(prev => ({ ...prev, abandonedCarts: 'Failed to load abandoned carts data' }));
    } finally {
      setCardLoading(prev => ({ ...prev, abandonedCarts: false }));
    }
  }, [retryWithBackoff]);

  const fetchOrdersData = useCallback(async () => {
    setCardLoading(prev => ({ ...prev, orders: true }));
    setCardErrors(prev => ({ ...prev, orders: null }));
    
    try {
      // Fetch orders sequentially to avoid overwhelming the API
      const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/orders/timeseries?page=1&limit=50'));
      const data = await response.json();
      
      console.log('Orders API response:', data);
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        setCardErrors(prev => ({ ...prev, orders: 'Permission denied – please re-authenticate with Shopify' }));
        return;
      }
      
      if (data.error_code === 'API_ACCESS_LIMITED') {
        // Silently handle limited access - show empty data without error message
        setInsights(prev => ({
          ...prev!,
          orders: [],
          recentOrders: []
        }));
        return;
      }
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS') {
        console.log('Orders API access denied - insufficient permissions');
        setCardErrors(prev => ({ ...prev, orders: 'Permission denied – please re-authenticate with Shopify' }));
        setInsights(prev => ({
          ...prev!,
          orders: [],
          recentOrders: []
        }));
        return;
      }
      
      let allOrders = data.timeseries || [];
      console.log('Initial orders from API:', allOrders.length, allOrders);
      
      // Only fetch additional pages if first page worked and we have more data
      if (!data.rate_limited && data.has_more) {
        try {
          // Fetch additional pages with delays to avoid rate limiting
          for (let page = 2; page <= 5; page++) {
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between pages
            const additionalResponse = await fetchWithAuth(`/api/analytics/orders/timeseries?page=${page}&limit=50`);
            const additionalData = await additionalResponse.json();
            
            if (additionalData.timeseries) {
              allOrders = [...allOrders, ...additionalData.timeseries];
              console.log(`Page ${page} orders:`, additionalData.timeseries.length);
            }
            
            if (!additionalData.has_more) break;
          }
        } catch (err) {
          console.warn('Error fetching additional order pages:', err);
        }
      }
      
      // Sort orders by date
      allOrders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      console.log('Final processed orders:', allOrders.length, allOrders.slice(0, 3));
      
      setInsights(prev => {
        const newState = {
          ...prev!,
          orders: data.rate_limited ? [] : allOrders,
          recentOrders: data.rate_limited ? [] : allOrders.slice(0, 5)
        };
        console.log('Updated insights state:', newState);
        return newState;
      });
      
      if (data.rate_limited) {
        setHasRateLimit(true);
      }
    } catch (error: any) {
      if (error.message === 'PERMISSION_ERROR') {
        // Surface permission error in UI instead of redirecting
        setCardErrors(prev => ({ ...prev, orders: 'Permission denied – please re-authenticate with Shopify' }));
        return;
      }
      setCardErrors(prev => ({ ...prev, orders: 'Failed to load orders data' }));
    } finally {
      setCardLoading(prev => ({ ...prev, orders: false }));
    }
  }, [retryWithBackoff]);

  // Initialize dashboard with basic structure
  useEffect(() => {
    if (!shop) {
      setError('No shop selected');
      setLoading(false);
      // Clear all dashboard data when shop is null (logout/disconnect)
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
      setLoading(true);
      setError(null);
      
      // Initialize insights with default data to prevent "failed to load" states
      setInsights({
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
      });
      
      // Set initial loading states for all cards to show proper loading experience
      setCardLoading({
        revenue: true,
        products: true,
        inventory: true,
        newProducts: true,
        insights: true,
        orders: true,
        abandonedCarts: true
      });
      
      // Clear any previous errors
      setCardErrors({
        revenue: null,
        products: null,
        inventory: null,
        newProducts: null,
        insights: null,
        orders: null,
        abandonedCarts: null
      });
      
      setLoading(false);
    }
  }, [shop]);

  // Auto-fetch all dashboard data on initial load
  useEffect(() => {
    if (shop && shop.trim() !== '') {
      // Trigger data fetches for all cards
      fetchRevenueData();
      fetchProductsData();
      fetchInventoryData();
      fetchNewProductsData();
      fetchInsightsData();
      fetchOrdersData();
      fetchAbandonedCartsData();
    }
  }, [shop, fetchRevenueData, fetchProductsData, fetchInventoryData, fetchNewProductsData, fetchInsightsData, fetchOrdersData, fetchAbandonedCartsData]);

  // Lazy load data for individual cards
  const handleCardLoad = useCallback((cardType: keyof CardLoadingState) => {
    // Add a small delay to prevent overwhelming the API
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
    }, 100); // 100ms delay
  }, [fetchRevenueData, fetchProductsData, fetchInventoryData, fetchNewProductsData, fetchInsightsData, fetchOrdersData, fetchAbandonedCartsData]);

  // Manual refresh function
  const handleRefreshAll = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Clear cache from both state and sessionStorage to force fresh data
      const freshCache = invalidateCache();
      setCache(freshCache);
      
      // Set all cards to loading state
      setCardLoading({
        revenue: true,
        products: true,
        inventory: true,
        newProducts: true,
        insights: true,
        orders: true,
        abandonedCarts: true
      });
      
      // Clear any previous errors
      setCardErrors({
        revenue: null,
        products: null,
        inventory: null,
        newProducts: null,
        insights: null,
        orders: null,
        abandonedCarts: null
      });
      
      console.log('Dashboard refresh initiated - cache cleared');
      
      // Trigger fresh data fetches for all cards
      await Promise.all([
        fetchRevenueData(true),
        fetchProductsData(),
        fetchInventoryData(),
        fetchNewProductsData(),
        fetchInsightsData(),
        fetchOrdersData(),
        fetchAbandonedCartsData()
      ]);
      
      setIsRefreshing(false);
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      setIsRefreshing(false);
    }
  }, [isRefreshing, fetchRevenueData, fetchProductsData, fetchInventoryData, fetchNewProductsData, fetchInsightsData, fetchOrdersData, fetchAbandonedCartsData]);

  // Debug logging for orders
  useEffect(() => {
    if (insights?.orders) {
      console.log('Orders data changed:', insights.orders.length, insights.orders.slice(0, 2));
    }
  }, [insights?.orders]);

  // Cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      // Clear all data when component unmounts
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
    };
  }, []);

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

  // Check if this is a permission error that should show the dashboard with alerts
  console.log('Dashboard error state:', { error });
  
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
        {/* Regular error alert for non-permission errors */}
        {error && (
          <Alert 
            severity="info" 
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
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
            key="revenue"
            label="Total Revenue"
            value={`$${insights?.totalRevenue?.toLocaleString() || '0'}`}
            loading={cardLoading.revenue}
            error={cardErrors.revenue}
            onRetry={() => handleCardLoad('revenue')}
            onLoad={() => handleCardLoad('revenue')}
          />
          <MetricCard
            key="conversion-rate"
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
            key="abandoned-carts"
            label="Abandoned Carts"
            value={insights?.abandonedCarts?.toString() || '0'}
            loading={cardLoading.abandonedCarts}
            error={cardErrors.abandonedCarts}
            onRetry={() => handleCardLoad('abandonedCarts')}
            onLoad={() => handleCardLoad('abandonedCarts')}
          />
          <MetricCard
            key="low-inventory"
            label="Low Inventory"
            value={typeof insights?.lowInventory === 'number' ? insights.lowInventory.toString() : '0'}
            loading={cardLoading.inventory}
            error={cardErrors.inventory}
            onRetry={() => handleCardLoad('inventory')}
            onLoad={() => handleCardLoad('inventory')}
          />
          <MetricCard
            key="new-products"
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
                <SectionHeader>
                  <SectionTitle>
                    <Inventory2 color="primary" />
                    Top Products
                  </SectionTitle>
                  {cardErrors.products && (
                    <IconButton 
                      size="small" 
                      onClick={() => handleCardLoad('products')}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Refresh fontSize="small" />
                    </IconButton>
                  )}
                </SectionHeader>
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
                  <ProductList>
                    {insights.topProducts.map((product) => (
                      <ProductItem key={`product-${product.id}`}>
                        <ProductInfo>
                          <ProductName>
                            <ProductLink 
                              href={`https://${shop}/admin/products/${product.id}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              {product.title}
                              <OpenInNew fontSize="small" />
                            </ProductLink>
                          </ProductName>
                          <ProductStats>
                            {typeof product.inventory !== 'undefined' ? `${product.inventory} in stock` : 'N/A'} • {product.price || 'N/A'}
                          </ProductStats>
                        </ProductInfo>
                      </ProductItem>
                    ))}
                  </ProductList>
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
                <SectionHeader>
                  <SectionTitle>
                    <ListAlt color="primary" />
                    Recent Orders
                  </SectionTitle>
                  {cardErrors.orders && (
                    <IconButton 
                      size="small" 
                      onClick={() => handleCardLoad('orders')}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Refresh fontSize="small" />
                    </IconButton>
                  )}
                </SectionHeader>
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
                  <OrderList>
                    {insights.orders.map((order, index) => (
                      <OrderItem key={`order-${order.id || `temp-${index}`}`}>
                        <OrderInfo>
                          <OrderTitle>
                            {order.id ? (
                              <OrderLink 
                                href={`https://${shop}/admin/orders/${order.id}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                Order #{order.id}
                                <OpenInNew fontSize="small" />
                              </OrderLink>
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
                          </OrderTitle>
                          <OrderDetails>
                            {formatDate(order.created_at)} • ${order.total_price}
                          </OrderDetails>
                        </OrderInfo>
                      </OrderItem>
                    ))}
                  </OrderList>
                ) : (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No orders data available yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" component="div">
                      {error 
                        ? 'Please log in again to restore access'
                        : 'Order data will appear here once you start receiving orders'
                      }
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

        {/* Revenue Graph */}
        <Box sx={{ width: '100%' }}>
          <RevenueChart
            data={insights?.timeseries || []}
            loading={cardLoading.revenue}
            error={cardErrors.revenue}
            height={450}
          />
        </Box>

        {/* Dashboard Status and Refresh Controls */}
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'center', sm: 'center' },
            mt: 3,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            gap: 2
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
            {insights ? (
              hasRateLimit ? 
                '⚠️ Some data temporarily unavailable due to API rate limits. Refreshing automatically...' : 
                '✅ Dashboard updated with latest available data'
            ) : 'Loading your store analytics...'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <LastUpdatedText>
              Last updated: {getLastUpdatedText()}
            </LastUpdatedText>
            <RefreshButton
              variant="outlined"
              size="small"
              disabled={isRefreshing}
              onClick={handleRefreshAll}
              startIcon={isRefreshing ? <CircularProgress size={16} /> : <Refresh />}
            >
              {isRefreshing ? 'Updating...' : 'Refresh Data'}
            </RefreshButton>
          </Box>
        </Box>


      </Box>
    </DashboardContainer>
  );
};

export default DashboardPage;
