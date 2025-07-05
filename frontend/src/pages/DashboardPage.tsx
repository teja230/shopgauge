// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Typography, Card, CardContent, Alert, CircularProgress, Link as MuiLink, IconButton, Button, ToggleButtonGroup, ToggleButton, useMediaQuery, useTheme } from '@mui/material';
import { RevenueChart } from '../components/ui/RevenueChart';
import PredictionViewContainer from '../components/ui/PredictionViewContainer';
import useUnifiedAnalytics from '../hooks/useUnifiedAnalytics';
import { MetricCard } from '../components/ui/MetricCard';
import { fetchWithAuth, retryWithBackoff } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import { OpenInNew, Refresh, Storefront, ListAlt, Inventory2, Analytics, ShowChart } from '@mui/icons-material';
import { format } from 'date-fns';
import { useNotifications } from '../hooks/useNotifications';
import { useSessionNotification } from '../hooks/useSessionNotification';
import {
  getCacheKey,
  invalidateCache,
  CACHE_VERSION,
} from '../utils/cacheUtils'; // Import from shared utils
import IntelligentLoadingScreen from '../components/ui/IntelligentLoadingScreen';
import ErrorBoundary from '../components/ErrorBoundary';
import ChartErrorBoundary from '../components/ui/ChartErrorBoundary';
import { debugLog } from '../components/ui/DebugPanel';


/**
 * 🚀 DASHBOARD CACHE BEHAVIOR
 * ============================
 * 
 * ✅ Browser Refresh: Uses cached data (no API calls)
 * ✅ Page Navigation: Uses cached data (no API calls) 
 * ✅ Shop Changes: Clears cache and makes fresh API calls
 * ✅ Cache Expiry: Makes fresh API calls after 120 minutes
 * ✅ Manual Refresh: Forces fresh API calls via "Refresh Data" button
 * 
 * 🧪 How It Works:
 * - Initial Load: Checks sessionStorage for shop-specific cache
 * - If cache exists and is fresh (<120 min), uses cached data
 * - If no cache or expired, makes API calls and caches results
 * - Subsequent Loads: Always checks cache first
 * - Only makes API calls if cache is missing/expired
 * - Manual refresh button forces fresh API calls
 * - Shop Switching: Automatically clears old shop's cache
 * - Prevents data leakage between shops
 */

// Cache configuration - Enterprise-grade settings
const CACHE_DURATION = 120 * 60 * 1000; // 120 minutes (2 hours) in milliseconds
const REFRESH_DEBOUNCE_MS = 120000; // 120 seconds

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  lastUpdated: Date;
  version: string;
  shop?: string; // Add shop to cache for validation
}

interface DashboardCache {
  version?: string;
  shop?: string; // Add shop to cache for validation
  revenue?: CacheEntry<{ totalRevenue: number; timeseries: any[] }>;
  products?: CacheEntry<{ products: any[] }>;
  inventory?: CacheEntry<{ lowInventory: number }>;
  newProducts?: CacheEntry<{ newProducts: number }>;
  abandonedCarts?: CacheEntry<{ abandonedCarts: number }>;
  orders?: CacheEntry<{ orders: any[]; recentOrders: any[] }>;
  insights?: CacheEntry<{ conversionRate?: number; conversionRateDelta?: number }>;
}

// Enterprise-grade cache management with shop-specific keys and validation
const loadCacheFromStorage = (shop: string): DashboardCache => {
  try {
    const cacheKey = getCacheKey(shop);
    const stored = sessionStorage.getItem(cacheKey);
    
    if (stored) {
      const parsed = JSON.parse(stored);
      
      // Version and shop check - invalidate if version mismatch or shop mismatch
      if (parsed.version !== CACHE_VERSION || parsed.shop !== shop) {
        console.log('Cache version/shop mismatch, clearing cache');
        sessionStorage.removeItem(cacheKey);
        return { version: CACHE_VERSION, shop };
      }
      
      // Convert date strings back to Date objects
      Object.keys(parsed).forEach(key => {
        if (parsed[key]?.lastUpdated) {
          parsed[key].lastUpdated = new Date(parsed[key].lastUpdated);
        }
      });
      
      console.log('Loaded cache from storage with', Object.keys(parsed).length - 2, 'entries for shop:', shop);
      return parsed;
    }
  } catch (error) {
    console.warn('Failed to load cache from storage:', error);
    sessionStorage.removeItem(getCacheKey(shop)); // Clear corrupted cache
  }
  return { version: CACHE_VERSION, shop };
};

const saveCacheToStorage = (cache: DashboardCache, shop: string) => {
  try {
    // Ensure version and shop are set
    cache.version = CACHE_VERSION;
    cache.shop = shop;
    const cacheKey = getCacheKey(shop);
    sessionStorage.setItem(cacheKey, JSON.stringify(cache));
    console.log('Saved cache to storage with', Object.keys(cache).length - 2, 'entries for shop:', shop);
  } catch (error) {
    console.warn('Failed to save cache to storage:', error);
    // If storage is full, try to clear old cache and retry
    try {
      sessionStorage.clear();
      cache.version = CACHE_VERSION;
      cache.shop = shop;
      const cacheKey = getCacheKey(shop);
      sessionStorage.setItem(cacheKey, JSON.stringify(cache));
      console.log('Cleared storage and saved cache successfully');
    } catch (retryError) {
      console.error('Failed to save cache even after clearing storage:', retryError);
    }
  }
};

// Modern, elegant, and professional dashboard UI improvements
const DashboardContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  display: 'flex',
  flexDirection: 'column',
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
    padding: theme.spacing(2),
  },
}));

const HeaderContent = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
}));

const HeaderIcon = styled(Storefront)(({ theme }) => ({
  fontSize: 32,
  color: theme.palette.primary.main,
}));

const HeaderTitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.5rem',
  fontWeight: 600,
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(0.5),
}));

const HeaderSubtitle = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
}));

const ShopLink = styled('a')(({ theme }) => ({
  color: theme.palette.primary.main,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  '&:hover': {
    textDecoration: 'underline',
  },
}));

const HeaderActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    width: '100%',
    justifyContent: 'space-between',
  },
}));

const RefreshButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  textTransform: 'none',
  fontWeight: 500,
  gap: theme.spacing(1),
  minHeight: 'auto',
  height: 'auto',
  padding: theme.spacing(1, 2),
  '&:disabled': {
    backgroundColor: theme.palette.action.disabledBackground,
  },
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
  minHeight: '200px',
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
  overflowY: 'auto',
  // Enhanced scrollbar styles for better mobile UX
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    background: theme.palette.grey[100],
    borderRadius: '3px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.grey[400],
    borderRadius: '3px',
    '&:hover': {
      background: theme.palette.grey[500],
    },
  },
  // Firefox scrollbar
  scrollbarWidth: 'thin',
  scrollbarColor: `${theme.palette.grey[400]} ${theme.palette.grey[100]}`,
  // Ensure scrollable on mobile
  WebkitOverflowScrolling: 'touch',
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
  overflowY: 'auto',
  // Enhanced scrollbar styles for better mobile UX
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    background: theme.palette.grey[100],
    borderRadius: '3px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.grey[400],
    borderRadius: '3px',
    '&:hover': {
      background: theme.palette.grey[500],
    },
  },
  // Firefox scrollbar
  scrollbarWidth: 'thin',
  scrollbarColor: `${theme.palette.grey[400]} ${theme.palette.grey[100]}`,
  // Ensure scrollable on mobile
  WebkitOverflowScrolling: 'touch',
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

// Add legend chips for graph types
const LegendContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  marginTop: theme.spacing(2),
  padding: theme.spacing(1),
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
  [theme.breakpoints.down('sm')]: {
    justifyContent: 'center',
  },
}));

const LegendChip = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.primary.light,
  color: theme.palette.primary.dark,
  fontSize: '0.75rem',
  fontWeight: 500,
  border: `1px solid ${theme.palette.primary.main}20`,
}));

const LegendDot = styled(Box)<{ color: string }>(({ theme, color }) => ({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: color,
  flexShrink: 0,
}));

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

// Enterprise-grade default insights object to prevent null state issues
const defaultInsights: DashboardInsight = {
  totalRevenue: 0,
  revenue: 0,
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

// Safe merge function for insights updates
const mergeInsights = (patch: Partial<DashboardInsight>) => (prev: DashboardInsight) => ({ ...prev, ...patch });

const DashboardPage = () => {
  const { isAuthenticated, shop, authLoading, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = useNotifications();
  
  // Mobile detection
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [insights, setInsights] = useState<DashboardInsight>(defaultInsights);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasRateLimit, setHasRateLimit] = useState(false);
  
  // Add a new state to track if dashboard data has been initialized
  const [dashboardDataInitialized, setDashboardDataInitialized] = useState(false);
  
  // Cache state management using sessionStorage for persistence across navigation
  const [cache, setCache] = useState<DashboardCache>(() => {
    if (!shop) return { version: CACHE_VERSION, shop: '' };
    const loadedCache = loadCacheFromStorage(shop);
    console.log(`🔄 Dashboard initialization: Loading cache for shop ${shop}`);
    return loadedCache;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0); // Track last refresh time for debouncing
  const [debounceCountdown, setDebounceCountdown] = useState<number>(0); // Real-time countdown for debounce

  // =====================================
  // Polling management refs (typed)
  // =====================================
  const pollingTimersRef = useRef<NodeJS.Timeout[]>([]);
  const rateLimitRef = useRef<boolean>(hasRateLimit);

  // Keep ref in sync with state
  useEffect(() => {
    rateLimitRef.current = hasRateLimit;
  }, [hasRateLimit]);

  // Save cache to sessionStorage whenever it changes
  useEffect(() => {
    if (shop && Object.keys(cache).length > 2) { // Only save if cache is not empty
      console.log(`💾 Saving cache to sessionStorage for shop: ${shop}`);
      saveCacheToStorage(cache, shop);
    }
  }, [cache, shop]);

  // Track previous shop to detect actual changes
  const prevShopRef = useRef<string | null>(null);
  
  // Effect to handle shop changes and cache invalidation
  useEffect(() => {
    if (shop && isAuthReady) {
      // Only invalidate cache if shop actually changed from one valid shop to another
      if (prevShopRef.current && prevShopRef.current !== shop) {
        console.log(`🔄 Shop changed from "${prevShopRef.current}" to "${shop}" - Invalidating cache`);
        const freshCache = invalidateCache(shop);
        if (freshCache) {
          setCache(freshCache);
        }
        setIsInitialLoad(true); // This will trigger a full data reload for the new shop
      }
      // Update the ref for the next render
      prevShopRef.current = shop;
    }
  }, [shop, isAuthReady]);
  
  // =====================================
  // ENHANCED CHART TOGGLE STATE MANAGEMENT
  // =====================================
  const [chartMode, setChartMode] = useState<'unified' | 'classic'>('classic');
  
  // Add error boundary reset key to force remount when needed
  const [errorBoundaryKey, setErrorBoundaryKey] = useState(0);
  
  // Prediction days state for Advanced Analytics
  const [predictionDays, setPredictionDays] = useState(30);

  // Create a stable reference for timeseries data to prevent unnecessary re-renders
  const stableTimeseriesData = useMemo(() => {
    return insights?.timeseries || [];
  }, [insights?.timeseries]);

  // Use the new unified analytics hook with stabilized data
  const {
    data: unifiedAnalyticsData,
    loading: unifiedAnalyticsLoading,
    error: unifiedAnalyticsError,
    refetch: refetchUnifiedAnalytics,
    loadFromStorage: loadUnifiedAnalyticsFromStorage,
    forceCompute: forceComputeUnifiedAnalytics,
    clearUnifiedAnalyticsStorage: clearUnifiedAnalyticsStorage,
    isCached: unifiedAnalyticsIsCached,
    cacheAge: unifiedAnalyticsCacheAge,
  } = useUnifiedAnalytics({
    days: 60,
    includePredictions: true,
    autoRefresh: false,
    shop: shop && shop.trim() ? shop : undefined,
    useDashboardData: true, // Use dashboard data instead of separate API calls
    dashboardRevenueData: stableTimeseriesData, // Use stable reference
    dashboardOrdersData: stableTimeseriesData, // Use stable reference
    realConversionRate: insights?.conversionRate, // Pass real conversion rate from dashboard
    // Note: Always computes 60 days max, filtering done in PredictionViewContainer
  });

  // Clear unified analytics storage when shop changes (following dashboard pattern)
  useEffect(() => {
    if (shop && shop.trim()) {
      console.log('🔄 Dashboard: Shop changed, clearing unified analytics storage');
      clearUnifiedAnalyticsStorage();
    }
  }, [shop, clearUnifiedAnalyticsStorage]);

  // Handler for prediction days changes
  const handlePredictionDaysChange = useCallback((newDays: number) => {
    console.log(`🔄 Prediction days changing from ${predictionDays} to ${newDays} (instant filtering)`);
    setPredictionDays(newDays);
    
    // No recomputation needed - PredictionViewContainer will filter the pre-computed data instantly
  }, [predictionDays]);

  // Enhanced chart mode toggle handler with proper data initialization
  const handleChartModeChange = useCallback((event: React.MouseEvent<HTMLElement>, newMode: 'unified' | 'classic' | null) => {
    if (!newMode || newMode === chartMode) return;
    
    console.log(`🔄 Chart mode changing from ${chartMode} to ${newMode}`);
    
    // Chrome-specific: Add error boundary reset
    try {
      // Reset error boundary on mode change
      setErrorBoundaryKey(prev => prev + 1);
      
      // Set the new chart mode
      setChartMode(newMode);
      
      // If switching to unified mode, ensure data is properly initialized
      if (newMode === 'unified') {
        console.log('🔄 Switching to unified mode - Chrome-safe initialization');
        
        // Chrome-safe: Add timeout to prevent immediate re-render issues
        setTimeout(() => {
          try {
            // Try to load from session storage first
            const loadedFromStorage = loadUnifiedAnalyticsFromStorage();
            
            if (!loadedFromStorage) {
              console.log('🔄 No session storage data, checking dashboard data availability');
              
              // Check if we have dashboard data available for processing
              const hasDashboardData = (Array.isArray(stableTimeseriesData) && stableTimeseriesData.length > 0);
              
              if (hasDashboardData) {
                console.log('🔄 Dashboard data available, forcing computation');
                // Chrome-safe: Additional timeout for data processing
                setTimeout(() => {
                  try {
                    forceComputeUnifiedAnalytics();
                  } catch (computeError) {
                    console.error('❌ Error in forceComputeUnifiedAnalytics:', computeError);
                    // Fallback to classic mode if unified mode fails
                    setChartMode('classic');
                    setError('Advanced Analytics temporarily unavailable. Using Classic View.');
                  }
                }, 200);
              } else {
                console.log('⚠️ No dashboard data available yet for unified mode');
              }
            } else {
              console.log('✅ Loaded unified analytics from session storage');
            }
          } catch (loadError) {
            console.error('❌ Error in chart mode initialization:', loadError);
            // Fallback to classic mode
            setChartMode('classic');
            setError('Advanced Analytics failed to load. Using Classic View.');
          }
        }, 100);
      }
      
      console.log(`✅ Chart mode changed to ${newMode}`);
    } catch (modeChangeError) {
      console.error('❌ Critical error in chart mode change:', modeChangeError);
      // Emergency fallback
      setChartMode('classic');
      setError('Chart mode change failed. Reverting to Classic View.');
    }
  }, [chartMode, loadUnifiedAnalyticsFromStorage, forceComputeUnifiedAnalytics, stableTimeseriesData]);

  // Simplified retry handler for error boundaries
  const handleUnifiedAnalyticsRetry = useCallback(() => {
    console.log('🔄 Manual retry for unified analytics');
    
    try {
      // Reset error boundary
      setErrorBoundaryKey(prev => prev + 1);
      
      // Clear any existing errors
      setError(null);
      
      // Chrome-safe: Add timeout before retry
      setTimeout(() => {
        try {
          forceComputeUnifiedAnalytics();
        } catch (retryError) {
          console.error('❌ Retry failed:', retryError);
          setError('Retry failed. Please refresh the page.');
        }
      }, 300);
    } catch (handlerError) {
      console.error('❌ Error in retry handler:', handlerError);
      setError('Retry handler failed. Please refresh the page.');
    }
  }, [forceComputeUnifiedAnalytics]);

  // Debug logging for unified analytics data
  useEffect(() => {
    console.log('Dashboard: Unified Analytics Debug Info:', {
      hasInsights: !!insights,
      timeseriesLength: insights?.timeseries?.length || 0,
      ordersLength: insights?.timeseries?.length || 0,
      shop: shop,
      hasStableData: stableTimeseriesData.length > 0,
      stableTimeseriesDataLength: stableTimeseriesData.length,
      unifiedAnalyticsData: !!unifiedAnalyticsData,
      unifiedAnalyticsLoading,
      unifiedAnalyticsError,
      chartMode
    });
  }, [insights, shop, stableTimeseriesData, unifiedAnalyticsData, unifiedAnalyticsLoading, unifiedAnalyticsError, chartMode]);

  // Chrome-specific: Add data availability check
  const hasValidData = useMemo(() => {
    const hasBasicData = insights && (
      insights.totalRevenue > 0 || 
      (insights.timeseries && insights.timeseries.length > 0) ||
      (insights.orders && insights.orders.length > 0)
    );
    
    console.log('Chrome Debug - Data Availability:', {
      hasBasicData,
      totalRevenue: insights?.totalRevenue || 0,
      timeseriesLength: insights?.timeseries?.length || 0,
      ordersLength: insights?.orders?.length || 0,
      chartMode,
      browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other'
    });
    
    return hasBasicData;
  }, [insights, chartMode]);

  // Chrome-specific logging for mode changes
  useEffect(() => {
    console.log('Chrome Debug - Chart Mode Change:', {
      chartMode,
      hasValidData,
      unifiedAnalyticsData: !!unifiedAnalyticsData,
      stableDataLength: stableTimeseriesData.length,
      browser: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
  }, [chartMode, hasValidData, unifiedAnalyticsData, stableTimeseriesData]);

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
  
  // Helper function to check if cache entry is fresh (< 120 minutes old)
  const isCacheFresh = useCallback((cacheEntry: CacheEntry<any> | undefined, cacheKey?: string): boolean => {
    if (!cacheEntry) {
      console.log(`🔍 ${cacheKey || 'CACHE'}: No cache entry found`);
      notifications.addNotification(`❌ ${cacheKey || 'Cache'}: No cache found`, 'warning', { duration: 3000 });
      return false;
    }
    
    const age = Date.now() - cacheEntry.timestamp;
    const isFresh = age < CACHE_DURATION;
    const ageMinutes = Math.round(age / (1000 * 60));
    const maxMinutes = Math.round(CACHE_DURATION / (1000 * 60));
    
    console.log(`🔍 ${cacheKey || 'CACHE'}: ${ageMinutes}min old (max: ${maxMinutes}min) - ${isFresh ? 'FRESH ✅' : 'EXPIRED ❌'}`);
    
    if (isFresh) {
      notifications.addNotification(`✅ ${cacheKey || 'Cache'}: Using cached data (${ageMinutes}min old)`, 'success', { duration: 2000 });
    } else {
      notifications.addNotification(`⏰ ${cacheKey || 'Cache'}: Cache expired (${ageMinutes}min old)`, 'info', { duration: 2000 });
    }
    
    return isFresh;
  }, [notifications]);

  // Create a cache instance that prevents concurrent fetches for the same key
  const activeFetches = useRef<Map<string, Promise<any>>>(new Map());
  
  // Stable cache check function that doesn't cause fetch function recreation
  const checkCacheAndFetch = useCallback(async (
    cacheKey: keyof DashboardCache,
    fetchFunction: () => Promise<any>,
    forceRefresh = false
  ): Promise<any> => {
    // Skip version and shop keys
    if (cacheKey === 'version' || cacheKey === 'shop') return null;
    
    const fetchKey = `${shop}_${cacheKey}`;
    
    // If there's already an active fetch for this key, wait for it
    if (activeFetches.current.has(fetchKey)) {
      return await activeFetches.current.get(fetchKey);
    }
    
    // Get current cache state from sessionStorage
    const sessionCache = JSON.parse(sessionStorage.getItem(getCacheKey(shop || '')) || '{}');
    const cachedEntry = sessionCache[cacheKey] as CacheEntry<any> | undefined;
    
    // Check if cache is fresh
    const isFresh = cachedEntry && 
      (Date.now() - cachedEntry.timestamp) < CACHE_DURATION && 
      cachedEntry.version === CACHE_VERSION &&
      cachedEntry.shop === shop;
    
    // Use cached data if available, fresh, and not forcing refresh
    if (!forceRefresh && isFresh) {
      const ageMinutes = Math.round((Date.now() - cachedEntry.timestamp) / (1000 * 60));
      console.log(`✅ ${cacheKey.toUpperCase()}: Using cached data (${ageMinutes}min old)`);
      // Update React state with cached data without triggering a full re-render of everything
      setCache(prev => ({ ...prev, [cacheKey]: cachedEntry }));
      return cachedEntry.data;
    }
    
    // Create and track the fetch promise to prevent concurrent fetches
    const fetchPromise = (async () => {
      try {
        console.log(`🔄 ${cacheKey.toUpperCase()}: Fetching fresh data from API`);
        const freshData = await fetchFunction();
        const now = new Date();
        const newCacheEntry = {
          data: freshData,
          timestamp: Date.now(),
          lastUpdated: now,
          version: CACHE_VERSION,
          shop: shop || ''
        };
        
        // Update React state, which will trigger the useEffect to save to sessionStorage
        setCache((prev: DashboardCache) => ({
          ...prev,
          [cacheKey]: newCacheEntry
        }));
        
        console.log(`💾 ${cacheKey.toUpperCase()}: Cached fresh data`);
        return freshData;
      } finally {
        // Clean up the active fetch tracking
        activeFetches.current.delete(fetchKey);
      }
    })();
    
    // Track this fetch to prevent concurrent calls
    activeFetches.current.set(fetchKey, fetchPromise);
    
    return await fetchPromise;
  }, [shop, cache]); // Only depends on shop and cache now

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
    
    // Ensure lastUpdate is a valid Date instance
    const lastDate = (lastUpdate instanceof Date)
      ? lastUpdate
      : new Date(lastUpdate as any);

    if (isNaN(lastDate.getTime())) {
      return 'Never updated';
    }

    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just updated';
    if (diffMinutes === 1) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    return format(lastUpdate, 'MMM d, h:mm a');
  }, [getMostRecentUpdateTime]);

  // Handle URL parameters from OAuth callback and Profile page redirects
  // Track if we've already shown the notification for this session
  const notificationShownRef = useRef<Set<string>>(new Set());
  
  // Cleanup notification tracking when component unmounts or shop changes
  useEffect(() => {
    return () => {
      notificationShownRef.current.clear();
    };
  }, []);

  // Clear notification tracking when shop changes to prevent cross-shop notifications
  useEffect(() => {
    if (shop) {
      notificationShownRef.current.clear();
      console.log('Dashboard: Cleared notification tracking for new shop:', shop);
    }
  }, [shop]);

  // Helper function to mark notification as shown and manage memory
  const markNotificationShown = useCallback((key: string) => {
    notificationShownRef.current.add(key);
    
    // Limit the size of tracking set to prevent memory issues
    if (notificationShownRef.current.size > 20) {
      const entries = Array.from(notificationShownRef.current);
      notificationShownRef.current.clear();
      // Keep only the most recent 10 entries
      entries.slice(-10).forEach(entry => notificationShownRef.current.add(entry));
      console.log('Dashboard: Cleaned up notification tracking to prevent memory leaks');
    }
  }, []);

  // Using enhanced retryWithBackoff from API utilities

  // Individual card data fetching functions with enhanced authentication checks
  const fetchRevenueData = useCallback(async (forceRefresh = false) => {
    // Pre-flight authentication check
    if (!isAuthenticated || !shop) {
      console.log('Dashboard: Skipping revenue fetch - not authenticated or no shop');
      setCardErrors(prev => ({ ...prev, revenue: 'Authentication required' }));
      setCardLoading(prev => ({ ...prev, revenue: false }));
      return;
    }

    console.log('Dashboard: Fetching revenue data for shop:', shop, 'authenticated:', isAuthenticated);

    setCardLoading(prev => ({ ...prev, revenue: true }));
    setCardErrors(prev => ({ ...prev, revenue: null }));
    
    try {
      const data = await checkCacheAndFetch('revenue', async () => {
        const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/revenue'));
        return await response.json();
      }, forceRefresh);
      
      if ((data.error_code === 'INSUFFICIENT_PERMISSIONS' || (data.error && data.error.includes('re-authentication')))) {
        setCardErrors(prev => ({ ...prev, revenue: 'Permission denied – please re-authenticate with Shopify' }));
        return;
      }

      if (data.error_code === 'API_ACCESS_LIMITED') {
        // Silently handle limited access - show 0 data without error message
        setInsights(mergeInsights({
          totalRevenue: 0,
          timeseries: []
        }));
        return;
      }
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS') {
        console.log('Revenue API access denied - insufficient permissions');
        setCardErrors(prev => ({ ...prev, revenue: 'Permission denied – please re-authenticate with Shopify' }));
        setInsights(mergeInsights({
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
      
      setInsights(mergeInsights({
        totalRevenue: data.rate_limited ? 0 : totalRevenue,
        timeseries: data.rate_limited ? [] : timeseriesData
      }));
      
      // Mark dashboard as initialized once we have revenue data
      setDashboardDataInitialized(true);
      
      if (data.rate_limited) {
        setHasRateLimit(true);
      }
      
      console.log('Updated insights with revenue data:', {
        totalRevenue: data.rate_limited ? 0 : totalRevenue,
        timeseriesPoints: data.rate_limited ? 0 : timeseriesData.length
      });
      
    } catch (error: any) {
      console.error('Revenue data fetch error:', error);
      const errorMessage = error.message === 'PERMISSION_ERROR' 
        ? 'Permission denied – please re-authenticate with Shopify'
        : 'Failed to load revenue data';
      setCardErrors(prev => ({ ...prev, revenue: errorMessage }));
    } finally {
      setCardLoading(prev => ({ ...prev, revenue: false }));
    }
  }, [isAuthenticated, shop, checkCacheAndFetch]);

  const fetchProductsData = useCallback(async (forceRefresh = false) => {
    // Pre-flight authentication check
    if (!isAuthenticated || !shop) {
      console.log('Dashboard: Skipping products fetch - not authenticated or no shop');
      setCardErrors(prev => ({ ...prev, products: 'Authentication required' }));
      setCardLoading(prev => ({ ...prev, products: false }));
      return;
    }

    console.log('🔄 Dashboard: Starting products fetch, forceRefresh:', forceRefresh);
    setCardLoading(prev => ({ ...prev, products: true }));
    setCardErrors(prev => ({ ...prev, products: null }));
    
    try {
      const data = await checkCacheAndFetch('products', async () => {
        console.log('🔄 Dashboard: Making API call to /api/analytics/products');
        const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/products'));
        const jsonData = await response.json();
        console.log('📊 Dashboard: Products API response:', jsonData);
        return jsonData;
      }, forceRefresh);
      
      console.log('📊 Dashboard: Processed products data:', data);
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        throw new Error('PERMISSION_ERROR');
      }
      
      setInsights(mergeInsights({
        topProducts: data.rate_limited ? [] : (data.products || [])
      }));
      
      if (data.rate_limited) {
        setHasRateLimit(true);
      }
    } catch (error: any) {
      console.error('Products data fetch error:', error);
      const errorMessage = error.message === 'PERMISSION_ERROR' 
        ? 'Permission denied – please re-authenticate with Shopify'
        : 'Failed to load products data';
      setCardErrors(prev => ({ ...prev, products: errorMessage }));
    } finally {
      setCardLoading(prev => ({ ...prev, products: false }));
    }
  }, [isAuthenticated, shop, checkCacheAndFetch]);

  const fetchInventoryData = useCallback(async (forceRefresh = false) => {
    // Pre-flight authentication check
    if (!isAuthenticated || !shop) {
      console.log('Dashboard: Skipping inventory fetch - not authenticated or no shop');
      setCardErrors(prev => ({ ...prev, inventory: 'Authentication required' }));
      setCardLoading(prev => ({ ...prev, inventory: false }));
      return;
    }

    setCardLoading(prev => ({ ...prev, inventory: true }));
    setCardErrors(prev => ({ ...prev, inventory: null }));
    
    try {
      const data = await checkCacheAndFetch('inventory', async () => {
        const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/inventory/low'));
        return await response.json();
      }, forceRefresh);
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        throw new Error('PERMISSION_ERROR');
      }
      
      setInsights(mergeInsights({
        lowInventory: data.rate_limited ? 0 : (Array.isArray(data.lowInventory) ? data.lowInventory.length : (data.lowInventoryCount || 0))
      }));
      
      if (data.rate_limited) {
        setHasRateLimit(true);
      }
    } catch (error: any) {
      console.error('Inventory data fetch error:', error);
      const errorMessage = error.message === 'PERMISSION_ERROR'
        ? 'Permission denied – please re-authenticate with Shopify'
        : 'Failed to load inventory data';
      setCardErrors(prev => ({ ...prev, inventory: errorMessage }));
    } finally {
      setCardLoading(prev => ({ ...prev, inventory: false }));
    }
  }, [isAuthenticated, shop, checkCacheAndFetch]);

  const fetchNewProductsData = useCallback(async (forceRefresh = false) => {
    // Pre-flight authentication check
    if (!isAuthenticated || !shop) {
      console.log('Dashboard: Skipping new products fetch - not authenticated or no shop');
      setCardErrors(prev => ({ ...prev, newProducts: 'Authentication required' }));
      setCardLoading(prev => ({ ...prev, newProducts: false }));
      return;
    }

    setCardLoading(prev => ({ ...prev, newProducts: true }));
    setCardErrors(prev => ({ ...prev, newProducts: null }));
    
    try {
      const data = await checkCacheAndFetch('newProducts', async () => {
        const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/new_products'));
        return await response.json();
      }, forceRefresh);
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        throw new Error('PERMISSION_ERROR');
      }
      
      setInsights(mergeInsights({
        newProducts: data.rate_limited ? 0 : (data.newProducts || 0)
      }));
      
      if (data.rate_limited) {
        setHasRateLimit(true);
      }
    } catch (error: any) {
      console.error('New products data fetch error:', error);
      const errorMessage = error.message === 'PERMISSION_ERROR'
        ? 'Permission denied – please re-authenticate with Shopify'
        : 'Failed to load new products data';
      setCardErrors(prev => ({ ...prev, newProducts: errorMessage }));
    } finally {
      setCardLoading(prev => ({ ...prev, newProducts: false }));
    }
  }, [isAuthenticated, shop, checkCacheAndFetch]);

  const fetchInsightsData = useCallback(async (forceRefresh = false) => {
    // Pre-flight authentication check
    if (!isAuthenticated || !shop) {
      console.log('Dashboard: Skipping insights fetch - not authenticated or no shop');
      setCardErrors(prev => ({ ...prev, insights: 'Authentication required' }));
      setCardLoading(prev => ({ ...prev, insights: false }));
      return;
    }

    setCardLoading(prev => ({ ...prev, insights: true }));
    setCardErrors(prev => ({ ...prev, insights: null }));
    
    try {
      const data = await checkCacheAndFetch('insights', async () => {
        const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/conversion'));
        return await response.json();
      }, forceRefresh);
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        throw new Error('PERMISSION_ERROR');
      }
      
      // Handle insufficient permissions for insights
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS') {
        console.log('Conversion rate API access denied - insufficient permissions');
        setCardErrors(prev => ({ ...prev, insights: 'Permission denied – please re-authenticate with Shopify' }));
        setInsights(mergeInsights({
          conversionRate: 0,
          conversionRateDelta: 0
        }));
        return;
      }
      
      setInsights(mergeInsights({
        conversionRate: data.rate_limited ? 0 : (data.conversionRate || 0),
        conversionRateDelta: 0 // No delta calculation for simplified approach
      }));
      
      if (data.rate_limited) {
        setHasRateLimit(true);
      }
    } catch (error: any) {
      console.error('Insights data fetch error:', error);
      if (error.message === 'PERMISSION_ERROR') {
        navigate('/'); // Redirect on critical insight failure
        return;
      }
      setCardErrors(prev => ({ ...prev, insights: 'Failed to load insights data' }));
    } finally {
      setCardLoading(prev => ({ ...prev, insights: false }));
    }
  }, [isAuthenticated, shop, navigate, checkCacheAndFetch]);

  const fetchAbandonedCartsData = useCallback(async (forceRefresh = false) => {
    // Pre-flight authentication check
    if (!isAuthenticated || !shop) {
      console.log('Dashboard: Skipping abandoned carts fetch - not authenticated or no shop');
      setCardErrors(prev => ({ ...prev, abandonedCarts: 'Authentication required' }));
      setCardLoading(prev => ({ ...prev, abandonedCarts: false }));
      return;
    }

    console.log('Dashboard: Fetching abandoned carts data for shop:', shop, 'authenticated:', isAuthenticated);

    setCardLoading(prev => ({ ...prev, abandonedCarts: true }));
    setCardErrors(prev => ({ ...prev, abandonedCarts: null }));
    
    try {
      const data = await checkCacheAndFetch('abandonedCarts', async () => {
        const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/abandoned_carts'));
        return await response.json();
      }, forceRefresh);
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        setCardErrors(prev => ({ ...prev, abandonedCarts: 'Permission denied – please re-authenticate with Shopify' }));
        return;
      }

      if (data.error_code === 'API_ACCESS_LIMITED') {
        // Silently handle limited access - show 0 data without error message
        setInsights(mergeInsights({
          abandonedCarts: 0
        }));
        return;
      }
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS') {
        console.log('Abandoned carts API access denied - insufficient permissions');
        setCardErrors(prev => ({ ...prev, abandonedCarts: 'Permission denied – please re-authenticate with Shopify' }));
        setInsights(mergeInsights({
          abandonedCarts: 0
        }));
        return;
      }
      
      setInsights(mergeInsights({
        abandonedCarts: data.rate_limited ? 0 : (data.abandonedCarts || 0)
      }));
      
      if (data.rate_limited) {
        setHasRateLimit(true);
      }
    } catch (error: any) {
      console.error('Abandoned carts data fetch error:', error);
      const errorMessage = error.message === 'PERMISSION_ERROR'
        ? 'Permission denied – please re-authenticate with Shopify'
        : 'Failed to load abandoned carts data';
      setCardErrors(prev => ({ ...prev, abandonedCarts: errorMessage }));
    } finally {
      setCardLoading(prev => ({ ...prev, abandonedCarts: false }));
    }
  }, [checkCacheAndFetch]);

  const fetchOrdersData = useCallback(async (forceRefresh = false) => {

    // Pre-flight authentication check
    if (!isAuthenticated || !shop) {
      console.log('Dashboard: Skipping orders fetch - not authenticated or no shop');
      setCardErrors(prev => ({ ...prev, orders: 'Authentication required' }));
      setCardLoading(prev => ({ ...prev, orders: false }));
      return;
    }

    setCardLoading(prev => ({ ...prev, orders: true }));
    setCardErrors(prev => ({ ...prev, orders: null }));
    
    try {
      const data = await checkCacheAndFetch('orders', async () => {
        console.log(`[Orders] Starting fetch for shop: ${shop}`);
        
        // Fetch orders sequentially to avoid overwhelming the API
        const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/orders/timeseries?page=1&limit=50&days=60'));
        const initialData = await response.json();
        
        console.log('[Orders] Initial API response:', {
          status: response.status,
          hasTimeseries: !!initialData.timeseries,
          timeseriesLength: initialData.timeseries?.length || 0,
          hasMore: initialData.has_more,
          errorCode: initialData.error_code,
          error: initialData.error,
          apiVersion: initialData.api_version,
          paginationMethod: initialData.pagination_method,
          daysRequested: initialData.days_requested,
          debugInfo: initialData.debug_info
        });
        
        if (initialData.error_code === 'INSUFFICIENT_PERMISSIONS' || 
            (initialData.error && initialData.error.includes('re-authentication'))) {
          console.warn('[Orders] Permission error detected:', initialData.error);
          return initialData; // Return error data to be handled outside
        }
        
        if (initialData.error_code === 'AUTHENTICATION_FAILED') {
          console.warn('[Orders] Authentication failed:', initialData.error);
          return initialData; // Return error data to be handled outside
        }
        
        if (initialData.error_code === 'API_ACCESS_LIMITED' || 
            initialData.error_code === 'INSUFFICIENT_PERMISSIONS') {
          console.warn('[Orders] API access limited:', initialData.error_code);
          return initialData; // Return error data to be handled outside
        }
        
        let allOrders = initialData.timeseries || [];
        console.log('[Orders] Initial orders from API:', allOrders.length, 'orders');
        
        // Only fetch additional pages if first page worked and we have more data
        if (!initialData.rate_limited && initialData.has_more) {
          try {
            console.log('[Orders] Fetching additional pages...');
            // Fetch additional pages with delays to avoid rate limiting
            for (let page = 2; page <= 5; page++) {
              await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between pages
              
              const additionalResponse = await fetchWithAuth(`/api/analytics/orders/timeseries?page=${page}&limit=50&days=60`);
              const additionalData = await additionalResponse.json();
              
              console.log(`[Orders] Page ${page} response:`, {
                status: additionalResponse.status,
                timeseriesLength: additionalData.timeseries?.length || 0,
                hasMore: additionalData.has_more,
                errorCode: additionalData.error_code
              });
              
              if (additionalData.timeseries) {
                allOrders = [...allOrders, ...additionalData.timeseries];
                console.log(`[Orders] Page ${page} added ${additionalData.timeseries.length} orders, total: ${allOrders.length}`);
              }
              
              if (!additionalData.has_more) {
                console.log(`[Orders] No more pages after page ${page}`);
                break;
              }
            }
          } catch (err) {
            console.warn('[Orders] Error fetching additional order pages:', err);
          }
        } else if (initialData.rate_limited) {
          console.warn('[Orders] Rate limited on first page');
        } else {
          console.log('[Orders] No additional pages to fetch');
        }
        
        // Sort orders by date
        allOrders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        console.log('[Orders] Final processed orders:', {
          totalCount: allOrders.length,
                     sampleOrders: allOrders.slice(0, 3).map((o: any) => ({
             id: o.id,
             name: o.name,
             created_at: o.created_at,
             total_price: o.total_price
           }))
        });
        
        return {
          ...initialData,
          timeseries: allOrders,
          orders: allOrders,
          recentOrders: allOrders.slice(0, 5)
        };
      }, forceRefresh);
      
      // Handle error cases with enhanced logging
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        console.error('[Orders] Permission denied error:', data);
        setCardErrors(prev => ({ ...prev, orders: 'Permission denied – please re-authenticate with Shopify' }));
        return;
      }
      
      if (data.error_code === 'AUTHENTICATION_FAILED') {
        console.error('[Orders] Authentication failed:', data);
        setCardErrors(prev => ({ ...prev, orders: 'Authentication failed – please re-authenticate with Shopify' }));
        return;
      }
      
      if (data.error_code === 'API_ACCESS_LIMITED') {
        console.warn('[Orders] API access limited - showing empty data');
        // Silently handle limited access - show empty data without error message
        setInsights(mergeInsights({
          orders: [],
          recentOrders: []
        }));
        return;
      }
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS') {
        console.error('[Orders] Orders API access denied - insufficient permissions');
        setCardErrors(prev => ({ ...prev, orders: 'Permission denied – please re-authenticate with Shopify' }));
        setInsights(mergeInsights({
          orders: [],
          recentOrders: []
        }));
        return;
      }
      
      // Handle generic errors with debug info
      if (data.error && data.debug_info) {
        console.error('[Orders] Generic error with debug info:', data);
        setCardErrors(prev => ({ ...prev, orders: `Failed to load orders: ${data.error}` }));
        return;
      }
      
      // Handle successful data
      console.log('[Orders] Successfully processed data, updating insights');
      setInsights(mergeInsights({
        orders: data.rate_limited ? [] : (data.orders || data.timeseries || []),
        recentOrders: data.rate_limited ? [] : (data.recentOrders || (data.timeseries || []).slice(0, 5))
      }));
      
      console.log('[Orders] Updated insights state:', {
        ordersCount: (data.rate_limited ? [] : (data.orders || data.timeseries || [])).length,
        recentOrdersCount: (data.rate_limited ? [] : (data.recentOrders || (data.timeseries || []).slice(0, 5))).length
      });
      
      if (data.rate_limited) {
        console.warn('[Orders] Rate limited - setting rate limit flag');
        setHasRateLimit(true);
      }
    } catch (error: any) {
      console.error('[Orders] Orders data fetch error:', error);
      const errorMessage = error.message === 'PERMISSION_ERROR'
        ? 'Permission denied – please re-authenticate with Shopify'
        : 'Failed to load orders data';
      setCardErrors(prev => ({ ...prev, orders: errorMessage }));
    } finally {
      setCardLoading(prev => ({ ...prev, orders: false }));
    }
  }, [isAuthenticated, shop, checkCacheAndFetch]);

  // Clear error states on component mount and route changes
  useEffect(() => {
    const clearErrors = () => {
      // Clear all error states
      setError(null);
      setCardErrors({
        revenue: null,
        products: null,
        inventory: null,
        newProducts: null,
        insights: null,
        orders: null,
        abandonedCarts: null
      });
      
      console.log('DashboardPage: Cleared error states');
    };

    // Clear errors on mount
    clearErrors();

    // Listen for global error clearing events
    const handleClearErrors = () => {
      clearErrors();
    };

    window.addEventListener('clearComponentErrors', handleClearErrors);

    // Cleanup event listener
    return () => {
      window.removeEventListener('clearComponentErrors', handleClearErrors);
    };
  }, []); // Empty dependency array - only run on mount

  // Initial data loading when auth is ready and we have a shop
  const initialLoadTriggeredRef = useRef(false);

  useEffect(() => {
    if (!isAuthReady || authLoading || !isAuthenticated || !shop || !isInitialLoad) {
      return;
    }

    // Prevent multiple triggers
    if (initialLoadTriggeredRef.current) {
      console.log('🔒 Dashboard: Initial load already triggered, skipping');
      return;
    }

    console.log('🚀 DASHBOARD: Starting initial data load for shop:', shop);
    initialLoadTriggeredRef.current = true;
    
    // Initialize insights with empty structure to prevent null issues
    if (!insights) {
      setInsights(defaultInsights);
    }
    
    // Set initial load to false in next tick to prevent infinite loop
    setTimeout(() => setIsInitialLoad(false), 0);
    
    // Parallel loading for dramatically better performance
    const loadAllData = async () => {
      console.log('🔄 LOAD ALL DATA: Starting parallel data loading');
      console.log('🧪 CACHE DEBUG: Current cache keys:', Object.keys(cache).filter(k => k !== 'version' && k !== 'shop'));
      
      try {
        // Start all API calls in parallel instead of sequential
        const promises = [
          fetchRevenueData().catch(err => {
            console.error('❌ Revenue fetch failed:', err);
            return null; // Don't fail the entire load for one error
          }),
          fetchProductsData().catch(err => {
            console.error('❌ Products fetch failed:', err);
            return null;
          }),
          fetchInventoryData().catch(err => {
            console.error('❌ Inventory fetch failed:', err);
            return null;
          }),
          fetchNewProductsData().catch(err => {
            console.error('❌ New products fetch failed:', err);
            return null;
          }),
          fetchInsightsData().catch(err => {
            console.error('❌ Insights fetch failed:', err);
            return null;
          }),
          fetchAbandonedCartsData().catch(err => {
            console.error('❌ Abandoned carts fetch failed:', err);
            return null;
          })
        ];
        
        // Wait for critical data to load in parallel
        const results = await Promise.allSettled(promises);
        
        // Log results for debugging
        results.forEach((result, index) => {
          const dataTypes = ['revenue', 'products', 'inventory', 'newProducts', 'insights', 'abandonedCarts'];
          if (result.status === 'rejected') {
            console.error(`❌ Dashboard: ${dataTypes[index]} loading failed:`, result.reason);
          } else {
            console.log(`✅ Dashboard: ${dataTypes[index]} loading completed successfully`);
          }
        });
        
        // Orders data can be loaded slightly delayed to reduce initial load
        setTimeout(() => {
          fetchOrdersData().catch(err => console.error('❌ Orders fetch failed:', err));
        }, 100);
        
        console.log('✅ Dashboard: Parallel data loading completed');
      } catch (error) {
        console.error('❌ Dashboard: Error in parallel data loading:', error);
        // Don't show error to user for individual API failures
      }
    };
    
    // Wrap the entire data loading in error handling
    try {
      console.log('🚀 Starting dashboard data loading process...');
      loadAllData().catch((error: unknown) => {
        console.error('🚨 CRITICAL ERROR in dashboard data loading:', error);
        if (error instanceof Error) {
          console.error('🚨 Error stack:', error.stack);
          console.error('🚨 Error message:', error.message);
        }
        
        // Log to localStorage for persistence
        try {
          const errorLog = {
            timestamp: new Date().toISOString(),
            location: 'Dashboard useEffect - loadAllData',
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            shop,
            isAuthenticated,
            isAuthReady
          };
          localStorage.setItem('dashboard-critical-error', JSON.stringify(errorLog));
        } catch (e) {
          console.error('Failed to save critical error to localStorage:', e);
        }
      });
    } catch (error: unknown) {
      console.error('🚨 CRITICAL ERROR in dashboard useEffect:', error);
      if (error instanceof Error) {
        console.error('🚨 Error stack:', error.stack);
        console.error('🚨 Error message:', error.message);
      }
      
      // Log to localStorage for persistence
      try {
        const errorLog = {
          timestamp: new Date().toISOString(),
          location: 'Dashboard useEffect - main',
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          shop,
          isAuthenticated,
          isAuthReady
        };
        localStorage.setItem('dashboard-critical-error', JSON.stringify(errorLog));
      } catch (e) {
        console.error('Failed to save critical error to localStorage:', e);
      }
    }
  }, [isAuthReady, authLoading, isAuthenticated, shop, fetchRevenueData, fetchProductsData, fetchInventoryData, fetchNewProductsData, fetchInsightsData, fetchOrdersData, fetchAbandonedCartsData]); // Added fetch functions back since they're now stable

  // Lazy load data for individual cards
  const handleCardLoad = useCallback((cardType: keyof CardLoadingState, force: boolean = false) => {
    // Allow individual card loads even during full refresh
    // Only prevent if we're actively loading this specific card
    if (cardLoading[cardType]) {
      console.log(`Card ${cardType} is already loading, skipping request`);
      return;
    }
    
    console.log(`Loading individual card: ${cardType} (forcing refresh)`);
    
    // Add a small delay to prevent overwhelming the API
    setTimeout(() => {
      switch (cardType) {
        case 'revenue':
          fetchRevenueData(force); // Use cache if available; retry handlers can pass true if needed
          break;
        case 'products':
          fetchProductsData(force);
          break;
        case 'inventory':
          fetchInventoryData(force);
          break;
        case 'newProducts':
          fetchNewProductsData(force);
          break;
        case 'insights':
          fetchInsightsData(force);
          break;
        case 'orders':
          fetchOrdersData(force);
          break;
        case 'abandonedCarts':
          fetchAbandonedCartsData(force);
          break;
      }
    }, 100); // 100ms delay
  }, [cardLoading, fetchRevenueData, fetchProductsData, fetchInventoryData, fetchNewProductsData, fetchInsightsData, fetchOrdersData, fetchAbandonedCartsData]);

  // Manual refresh function with debounce protection
  // This forces fresh API calls for all dashboard data
  const handleRefreshAll = useCallback(async () => {
    const now = Date.now();
    
    // Check if we're already refreshing or if debounce period hasn't passed
    if (isRefreshing || (now - lastRefreshTime) < REFRESH_DEBOUNCE_MS) {
      console.log('🔄 Refresh blocked - already refreshing or debounce period active');
      const remaining = REFRESH_DEBOUNCE_MS - (now - lastRefreshTime);
      notifications.showInfo(`Please wait ${Math.ceil(remaining / 1000)}s before refreshing again.`, { duration: 3000 });
      return;
    }
    
    console.log('🔄 MANUAL REFRESH: Forcing fresh API calls for all data');
    notifications.showInfo('🔄 Refreshing dashboard data...', { duration: 2000, category: 'Dashboard' });
    setLastRefreshTime(now);
    setIsRefreshing(true);
    
    try {
      // Clear cache from both state and sessionStorage to force fresh data
      if (shop) {
        console.log('🗑️ Clearing cache to force fresh API calls');
        const freshCache = invalidateCache(shop);
        if (freshCache) {
          setCache(freshCache);
        }
        
        // Clear unified analytics storage to prevent stale data (following dashboard pattern)
        console.log('🗑️ Clearing unified analytics storage for fresh data');
        clearUnifiedAnalyticsStorage();
      }
      
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
        fetchProductsData(true),
        fetchInventoryData(true),
        fetchNewProductsData(true),
        fetchInsightsData(true),
        fetchOrdersData(true),
        fetchAbandonedCartsData(true)
      ]);
      
      // Force compute unified analytics after main dashboard data is refreshed
      console.log('🔄 Force computing unified analytics after dashboard refresh');
      forceComputeUnifiedAnalytics();
      
      notifications.showSuccess('✅ Dashboard data has been updated.', { duration: 3000, category: 'Dashboard' });
      setIsRefreshing(false);
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      notifications.showError('❌ Failed to refresh dashboard data.', { persistent: true, category: 'Dashboard' });
      setIsRefreshing(false);
    }
  }, [
    shop, 
    isRefreshing, 
    lastRefreshTime, 
    fetchRevenueData, 
    fetchProductsData, 
    fetchInventoryData, 
    fetchNewProductsData, 
    fetchInsightsData, 
    fetchOrdersData,
    fetchAbandonedCartsData,
    forceComputeUnifiedAnalytics,
    clearUnifiedAnalyticsStorage,
    notifications
  ]);

  // Handle URL parameters and optimize post-OAuth loading experience
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const connected = searchParams.get('connected');
    const skipLoading = searchParams.get('skip_loading');
    const reauth = searchParams.get('reauth');
    const forceRefresh = searchParams.get('force_refresh');
    const clearCache = searchParams.get('clear_cache');

    // Optimized: Skip heavy loading animations if coming from OAuth
    if (skipLoading === 'true') {
      console.log('Dashboard: Skipping loading animations for faster post-OAuth experience');
      setIsInitialLoad(false);
    }

    // Handle OAuth success callback
    if (connected === 'true') {
      const notificationKey = `connected-${shop || 'oauth'}`;
      if (!notificationShownRef.current.has(notificationKey)) {
        markNotificationShown(notificationKey);
        
        notifications.showSuccess(`✨ Successfully connected${shop ? ` to ${shop.replace('.myshopify.com', '')}` : ''}! Your insights are loading.`, {
          category: 'Store Connection',
          duration: 4000
        });
      }
      
      // Clean up URL parameters
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('connected');
      newUrl.searchParams.delete('skip_loading');
      window.history.replaceState({}, document.title, newUrl.toString());
    }

    // Handle re-authentication success
    if (reauth === 'success') {
      const notificationKey = `reauth-${shop || 'reauth'}`;
      if (!notificationShownRef.current.has(notificationKey)) {
        markNotificationShown(notificationKey);
        
        notifications.showSuccess('🔐 Re-authentication successful! Refreshing data...', {
          category: 'Authentication',
          duration: 3000
        });
        
        // Force refresh all data after re-authentication
        setTimeout(() => {
          handleRefreshAll();
        }, 500);
      }
      
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('reauth');
      window.history.replaceState({}, document.title, newUrl.toString());
    }

    // Handle cache clearing request
    if (clearCache === 'true') {
      const notificationKey = `cache-cleared-${shop || 'cache'}`;
      if (!notificationShownRef.current.has(notificationKey)) {
        markNotificationShown(notificationKey);
        
        console.log('Dashboard: Cache clearing requested via URL parameter');
        if (shop) {
          const freshCache = invalidateCache(shop);
          if (freshCache) {
            setCache(freshCache);
          }
        }
        
        notifications.showInfo('Cache cleared! Loading fresh data...', {
          category: 'Cache Management',
          duration: 2000
        });
        
        // Trigger fresh data load
        setTimeout(() => {
          handleRefreshAll();
        }, 500);
      }
      
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('clear_cache');
      window.history.replaceState({}, document.title, newUrl.toString());
    }

    // Handle force refresh request
    if (forceRefresh === 'true') {
      const notificationKey = `force-refresh-${shop || 'refresh'}`;
      if (!notificationShownRef.current.has(notificationKey)) {
        markNotificationShown(notificationKey);
        
        console.log('Dashboard: Force refresh requested via URL parameter');
        
        // Trigger immediate refresh
        setTimeout(() => {
          handleRefreshAll();
        }, 500);
      }
      
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('force_refresh');
      window.history.replaceState({}, document.title, newUrl.toString());
    }
  }, [location.search, notifications, markNotificationShown, handleRefreshAll]);

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
      setInsights(defaultInsights);
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

  // Real-time countdown for debounce timer
  useEffect(() => {
    if (lastRefreshTime === 0) return;

    const interval = setInterval(() => {
      const timeSinceRefresh = Date.now() - lastRefreshTime;
      const remainingTime = Math.max(0, REFRESH_DEBOUNCE_MS - timeSinceRefresh);
      
      if (remainingTime <= 0) {
        setDebounceCountdown(0);
        clearInterval(interval);
      } else {
        setDebounceCountdown(remainingTime);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [lastRefreshTime]);

  // ErrorBoundary retry mechanism and automatic recovery
  useEffect(() => {
    const handleDashboardRetry = () => {
      console.log('🔄 Dashboard retry event received - refreshing all data');
      handleRefreshAll();
    };

    /**
     * Starts an exponential-backoff timer that attempts to refresh the dashboard
     * while the Shopify API is rate-limited.  Polling intervals grow 1 → 2 → 4 → 5 minutes
     * (max) to minimise cost.  Returns a cleanup function to clear all timers.
     */
    const handleRateLimitPolling = (): (() => void) | undefined => {
      if (!hasRateLimit) return undefined;

      let attempt = 0;
      const MAX_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

      const scheduleNext = (): void => {
        const delay = Math.min(60_000 * Math.pow(2, attempt), MAX_INTERVAL_MS);
        console.log(`⏰ Rate-limit polling (attempt ${attempt + 1}) in ${Math.round(delay / 1000)}s`);

        const timerId: NodeJS.Timeout = setTimeout(async () => {
          try {
            await handleRefreshAll();
          } finally {
            // schedule another round only if rate-limit still active
            if (rateLimitRef.current) {
              attempt++;
              scheduleNext();
            }
          }
        }, delay);

        pollingTimersRef.current.push(timerId);
      };

      scheduleNext();

      // Return cleanup function
      return (): void => {
        pollingTimersRef.current.forEach(clearTimeout);
        pollingTimersRef.current = [];
      };
    };

    // Start / restart rate-limit polling whenever rate-limit state flips to true.
    const stopPolling = handleRateLimitPolling();
 
    // Listen for dashboard retry events from ErrorBoundary
    window.addEventListener('dashboardRetry', handleDashboardRetry);
 
    return () => {
      window.removeEventListener('dashboardRetry', handleDashboardRetry);
      if (stopPolling) stopPolling();
    };
  }, [hasRateLimit, handleRefreshAll]);

  // Enhanced authentication state handling with proper loading management
  useEffect(() => {
    // Don't process until auth system is ready
    if (!isAuthReady) {
      console.log('Dashboard: Auth system not ready yet');
      return;
    }

    // Show loading state while auth is being determined
    if (authLoading) {
      console.log('Dashboard: Authentication in progress');
      setLoading(true);
      return;
    }

    // Handle successful authentication
    if (isAuthenticated && shop) {
      console.log('Dashboard: Authentication confirmed, shop:', shop);
      setLoading(false);
      setError(null);
      return;
    }

    // Handle authentication failure or missing shop
    if (!isAuthenticated || !shop) {
      console.log('Dashboard: Authentication failed or no shop - redirecting to home');
      setError('Authentication required');
      setLoading(false);
      
      // Clear any existing dashboard data
      setInsights(defaultInsights);
      setCardLoading({
        revenue: false,
        products: false,
        inventory: false,
        newProducts: false,
        insights: false,
        orders: false,
        abandonedCarts: false
      });
      
      // Redirect after clearing state
      setTimeout(() => {
        navigate('/');
      }, 500);
    }
  }, [isAuthReady, authLoading, isAuthenticated, shop, navigate]);

  if (loading) {
    return <IntelligentLoadingScreen fastMode={true} message="Loading your dashboard..." />;
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
                      onClick={() => handleCardLoad('products', true)}
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
                      onClick={() => handleCardLoad('products', true)}
                      sx={{ mt: 1 }}
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
                      onClick={() => handleCardLoad('products', true)}
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

        {/* Analytics Charts with Toggle */}
        <Box sx={{ width: '100%' }}>

          {/* Discovery Banner for Advanced Analytics - Moved Above Charts */}
          {chartMode === 'classic' && (
            <Box sx={{
              mb: 3,
              p: 2,
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',
              borderRadius: 2,
              border: '1px solid rgba(37, 99, 235, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 2,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2563eb 0%, #9333ea 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'float 3s ease-in-out infinite',
                  '@keyframes float': {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-5px)' },
                  },
                }}>
                  <Analytics sx={{ color: 'white', fontSize: '1.25rem' }} />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={600} color="primary.main">
                    🔮 Unlock AI-Powered Forecasting
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Predict revenue trends 7-60 days ahead with 7 chart types, confidence intervals, and professional exports
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="contained"
                onClick={() => handleChartModeChange(null as any, 'unified')}
                sx={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #9333ea 100%)',
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  fontWeight: 600,
                  textTransform: 'none',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 6px 16px rgba(37, 99, 235, 0.4)',
                  },
                  minWidth: isMobile ? '100%' : 'auto',
                }}
                startIcon={<Analytics />}
              >
                Try Advanced Analytics
              </Button>
            </Box>
          )}



          {/* Chart Container with smooth transitions */}
          <Box sx={{ 
            position: 'relative',
            minHeight: { xs: 450, sm: 540 }, // Consistent height for smooth transitions
            transition: 'all 0.3s ease-in-out',
            '& > *': {
              transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
            }
          }}>
          {chartMode === 'unified' ? (
            // Chrome-safe Advanced Analytics with multiple fallback layers
            <React.Fragment>
              {(() => {
                try {
                  // Chrome-specific: Pre-render validation
                  if (!hasValidData || !unifiedAnalyticsData) {
                    console.log('⚠️ Chrome-safe: No unified analytics data available yet');
                    return (
                      <StyledCard sx={{ height: isMobile ? 450 : 540 }}>
                        <CardContent sx={{ 
                          height: '100%', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          flexDirection: 'column',
                          gap: 2,
                        }}>
                          <CircularProgress />
                          <Typography variant="body2" color="text.secondary">
                            Loading Advanced Analytics...
                          </Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setChartMode('classic')}
                            sx={{ mt: 2 }}
                          >
                            Use Classic View
                          </Button>
                        </CardContent>
                      </StyledCard>
                    );
                  }

                  // Chrome-specific: Error state handling
                  if (unifiedAnalyticsError) {
                    console.log('⚠️ Chrome-safe: Unified analytics error detected:', unifiedAnalyticsError);
                    return (
                      <StyledCard sx={{ height: isMobile ? 450 : 540 }}>
                        <CardContent sx={{ 
                          height: '100%', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          flexDirection: 'column',
                          gap: 2,
                        }}>
                          <Typography variant="h6" color="error" gutterBottom>
                            Advanced Analytics Error
                          </Typography>
                          <Typography variant="body2" color="text.secondary" textAlign="center">
                            {unifiedAnalyticsError}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={handleUnifiedAnalyticsRetry}
                            >
                              Retry
                            </Button>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => setChartMode('classic')}
                            >
                              Use Classic View
                            </Button>
                          </Box>
                        </CardContent>
                      </StyledCard>
                    );
                  }

                  // Chrome-specific: Loading state
                  if (unifiedAnalyticsLoading) {
                    console.log('⏳ Chrome-safe: Unified analytics loading');
                    return (
                      <StyledCard sx={{ height: isMobile ? 450 : 540 }}>
                        <CardContent sx={{ 
                          height: '100%', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          flexDirection: 'column',
                          gap: 2,
                        }}>
                          <CircularProgress size={48} />
                          <Typography variant="body1" color="text.secondary">
                            Computing AI Analytics...
                          </Typography>
                          <Typography variant="body2" color="text.secondary" textAlign="center">
                            This may take a moment
                          </Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setChartMode('classic')}
                            sx={{ mt: 2 }}
                          >
                            Use Classic View Instead
                          </Button>
                        </CardContent>
                      </StyledCard>
                    );
                  }

                  // Chrome-safe: Main Advanced Analytics rendering
                  console.log('✅ Chrome-safe: Rendering Advanced Analytics');
                  return (
                    <ChartErrorBoundary 
                      key={`unified-${errorBoundaryKey}`}
                      fallbackHeight={280}
                      onRetry={handleUnifiedAnalyticsRetry}
                    >
                      <PredictionViewContainer
                        data={unifiedAnalyticsData}
                        loading={unifiedAnalyticsLoading}
                        error={unifiedAnalyticsError}
                        height={isMobile ? 400 : 480}
                        predictionDays={predictionDays}
                        onPredictionDaysChange={handlePredictionDaysChange}
                      />
                    </ChartErrorBoundary>
                  );

                } catch (renderError) {
                  console.error('❌ Chrome-safe: Critical render error in unified mode:', renderError);
                  
                  // Chrome emergency fallback
                  return (
                    <StyledCard sx={{ height: isMobile ? 450 : 540 }}>
                      <CardContent sx={{ 
                        height: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: 2,
                      }}>
                        <Typography variant="h6" color="error" gutterBottom>
                          Rendering Error
                        </Typography>
                        <Typography variant="body2" color="text.secondary" textAlign="center">
                          Advanced Analytics failed to render. This might be a browser compatibility issue.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => window.location.reload()}
                          >
                            Refresh Page
                          </Button>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => {
                              setChartMode('classic');
                              setError(null);
                            }}
                          >
                            Use Classic View
                          </Button>
                        </Box>
                      </CardContent>
                    </StyledCard>
                  );
                }
              })()}
            </React.Fragment>
          ) : (
            <ErrorBoundary 
              key={`classic-${errorBoundaryKey}`}
              fallbackMessage="The Revenue chart failed to load. Please try refreshing."
              onRetry={() => {
                setErrorBoundaryKey(prev => prev + 1);
                setTimeout(() => fetchRevenueData(true), 100);
              }}
            >
              {/* Revenue Chart Section - Consistent sizing with Advanced Analytics */}
              <StyledCard sx={{ height: isMobile ? 450 : 540 }}>
                <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {/* Only render RevenueChart when we have initialized the dashboard */}
                  {dashboardDataInitialized || stableTimeseriesData.length > 0 ? (
                    <Box sx={{ flex: 1 }}>
                      <RevenueChart
                        data={stableTimeseriesData}
                        loading={cardLoading.revenue}
                        error={cardErrors.revenue}
                        height={isMobile ? 400 : 480} // Consistent height with PredictionViewContainer
                      />
                    </Box>
                  ) : (
                    <Box sx={{ 
                      flex: 1,
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: 2
                    }}>
                      <CircularProgress size={48} />
                      <Typography variant="body2" color="text.secondary">
                        Loading revenue data...
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </StyledCard>
            </ErrorBoundary>
          )}
          </Box>
        </Box>

        {/* Chart Mode Toggle - Positioned Below Charts */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          mt: 3,
          mb: 2,
          px: isMobile ? 2 : 0,
        }}>
          <ToggleButtonGroup
            value={chartMode}
            exclusive
            onChange={handleChartModeChange}
            size={isMobile ? "medium" : "large"}
            orientation="horizontal"
            sx={{
              backgroundColor: 'white',
              border: '2px solid rgba(37, 99, 235, 0.2)',
              borderRadius: 1.5,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              width: isMobile ? '100%' : 'auto',
              '& .MuiToggleButton-root': {
                px: isMobile ? 2 : 4,
                py: isMobile ? 1.5 : 2,
                fontSize: isMobile ? '0.875rem' : '1rem',
                fontWeight: 600,
                textTransform: 'none',
                border: 'none',
                borderRadius: 1.5,
                margin: 0.5,
                minWidth: isMobile ? 'auto' : 200,
                color: 'text.secondary',
                backgroundColor: 'transparent',
                transition: 'all 0.3s ease',
                position: 'relative',
                '&:hover': {
                  backgroundColor: 'rgba(37, 99, 235, 0.08)',
                  color: 'primary.main',
                  transform: isMobile ? 'none' : 'translateY(-1px)',
                },
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                    transform: isMobile ? 'none' : 'translateY(-1px)',
                  },
                },
              },
            }}
          >
            <ToggleButton
              value="classic"
              sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}
            >
              <ShowChart sx={{ fontSize: '1.5rem' }} />
              <Box>
                <Typography variant="body1" fontWeight="inherit">
                  Classic View
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.7rem' }}>
                  Traditional Revenue Charts
                </Typography>
              </Box>
            </ToggleButton>
            <ToggleButton
              value="unified"
              sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: 0.5,
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  width: 20,
                  height: 20,
                  background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'white',
                  animation: 'pulse 2s infinite',
                  zIndex: 1,
                },
                '&::after': {
                  content: '"NEW"',
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '8px',
                  fontWeight: 700,
                  color: 'white',
                  zIndex: 2,
                },
                '@keyframes pulse': {
                  '0%': {
                    transform: 'scale(1)',
                    opacity: 1,
                  },
                  '50%': {
                    transform: 'scale(1.1)',
                    opacity: 0.8,
                  },
                  '100%': {
                    transform: 'scale(1)',
                    opacity: 1,
                  },
                },
              }}
            >
              <Analytics sx={{ fontSize: '1.5rem' }} />
              <Box>
                <Typography variant="body1" fontWeight="inherit">
                  Advanced Analytics
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.7rem', color: '#ff6b6b' }}>
                  🚀 AI-Powered Forecasts
                </Typography>
              </Box>
            </ToggleButton>
          </ToggleButtonGroup>
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
              disabled={isRefreshing || debounceCountdown > 0}
              onClick={handleRefreshAll}
              startIcon={isRefreshing ? <CircularProgress size={16} /> : <Refresh />}
              title={
                isRefreshing 
                  ? 'Updating dashboard data...' 
                  : debounceCountdown > 0
                    ? `Please wait ${Math.ceil(debounceCountdown / 1000)}s before refreshing again`
                    : 'Refresh all dashboard data'
              }
            >
              {isRefreshing 
                ? 'Updating...' 
                : debounceCountdown > 0
                  ? `Wait ${Math.ceil(debounceCountdown / 1000)}s`
                  : 'Refresh Data'
              }
            </RefreshButton>
          </Box>
        </Box>


      </Box>
    </DashboardContainer>
  );
};

export default DashboardPage;
