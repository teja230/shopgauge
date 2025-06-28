import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, Card, CardContent, Alert, CircularProgress, Link as MuiLink, IconButton, Button } from '@mui/material';
import { RevenueChart } from '../components/ui/RevenueChart';
import { MetricCard } from '../components/ui/MetricCard';
import { fetchWithAuth, retryWithBackoff } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import { OpenInNew, Refresh, Storefront, ListAlt, Inventory2 } from '@mui/icons-material';
import { format } from 'date-fns';
import { useNotifications } from '../hooks/useNotifications';
import { useSessionNotification } from '../hooks/useSessionNotification';
import {
  getCacheKey,
  invalidateCache,
  CACHE_VERSION,
} from '../utils/cacheUtils'; // Import from shared utils

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
const REFRESH_DEBOUNCE_MS = 30000; // 30 seconds

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
  const { isAuthenticated, shop, authLoading, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = useNotifications();
  const [insights, setInsights] = useState<DashboardInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasRateLimit, setHasRateLimit] = useState(false);
  
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

    setCardLoading(prev => ({ ...prev, products: true }));
    setCardErrors(prev => ({ ...prev, products: null }));
    
    try {
      const data = await checkCacheAndFetch('products', async () => {
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
      
      setInsights(prev => ({
        ...prev!,
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
      
      setInsights(prev => ({
        ...prev!,
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
    setCardLoading(prev => ({ ...prev, orders: true }));
    setCardErrors(prev => ({ ...prev, orders: null }));
    
    try {
      const data = await checkCacheAndFetch('orders', async () => {
        // Fetch orders sequentially to avoid overwhelming the API
        const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/orders/timeseries?page=1&limit=50'));
        const initialData = await response.json();
        
        console.log('Orders API response:', initialData);
        
        if (initialData.error_code === 'INSUFFICIENT_PERMISSIONS' || 
            (initialData.error && initialData.error.includes('re-authentication'))) {
          return initialData; // Return error data to be handled outside
        }
        
        if (initialData.error_code === 'API_ACCESS_LIMITED' || 
            initialData.error_code === 'INSUFFICIENT_PERMISSIONS') {
          return initialData; // Return error data to be handled outside
        }
        
        let allOrders = initialData.timeseries || [];
        console.log('Initial orders from API:', allOrders.length, allOrders);
        
        // Only fetch additional pages if first page worked and we have more data
        if (!initialData.rate_limited && initialData.has_more) {
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
        
        return {
          ...initialData,
          timeseries: allOrders,
          orders: allOrders,
          recentOrders: allOrders.slice(0, 5)
        };
      }, forceRefresh);
      
      // Handle error cases
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
      
      setInsights(prev => {
        const newState = {
          ...prev!,
          orders: data.rate_limited ? [] : (data.orders || data.timeseries || []),
          recentOrders: data.rate_limited ? [] : (data.recentOrders || (data.timeseries || []).slice(0, 5))
        };
        console.log('Updated insights state:', newState);
        return newState;
      });
      
      if (data.rate_limited) {
        setHasRateLimit(true);
      }
    } catch (error: any) {
      console.error('Orders data fetch error:', error);
      const errorMessage = error.message === 'PERMISSION_ERROR'
        ? 'Permission denied – please re-authenticate with Shopify'
        : 'Failed to load orders data';
      setCardErrors(prev => ({ ...prev, orders: errorMessage }));
    } finally {
      setCardLoading(prev => ({ ...prev, orders: false }));
    }
  }, [checkCacheAndFetch]);

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

  // Track if initial load has been triggered to prevent duplicate calls
  const initialLoadTriggeredRef = useRef(false);

  // Initialize dashboard with basic structure and handle authentication state
  useEffect(() => {
    // Don't proceed until authentication system is ready
    if (!isAuthReady) {
      console.log('Dashboard: Waiting for auth system to be ready');
      return;
    }

    // Handle unauthenticated state
    if (!isAuthenticated) {
      console.log('Dashboard: User not authenticated, clearing data and redirecting');
      setError('Authentication required');
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
      
      // Redirect to home page after a short delay
      setTimeout(() => {
        navigate('/');
      }, 1000);
      return;
    }

    // Handle missing shop
    if (!shop || shop.trim() === '') {
      console.log('Dashboard: No shop available');
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

    // Authentication and shop are valid - initialize dashboard
    console.log('Dashboard: Initializing for authenticated shop:', shop);
    setLoading(false);
    setError(null);
    
    // Only set initial load if this is a genuinely new shop or first load
    if (prevShopRef.current !== shop || !initialLoadTriggeredRef.current) {
      console.log('🚀 Setting isInitialLoad=true for new shop or first load');
      setIsInitialLoad(true); // Reset initial load flag for new shop
      initialLoadTriggeredRef.current = false; // Reset the ref for new shop
    } else {
      console.log('🔍 Shop unchanged, keeping current load state');
    }
    
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
  }, [isAuthReady, isAuthenticated, shop, navigate]);

  // Main data loading effect - triggers on authentication and shop changes
  useEffect(() => {
    console.log('🔄 Dashboard useEffect triggered with:', {
      isAuthReady,
      authLoading,
      isAuthenticated,
      shop,
      isInitialLoad
    });

    if (!isAuthReady || authLoading) {
      console.log('🔄 Dashboard: Waiting for authentication to complete');
      return;
    }

    // Ensure user is authenticated and has a shop before loading data
    if (!isAuthenticated || !shop || shop.trim() === '') {
      console.log('❌ Dashboard: Cannot load data - authentication or shop missing');
      return;
    }

    // Only load data on initial load to prevent unnecessary API calls
    if (!isInitialLoad) {
      console.log('⏭️ Dashboard: Skipping data load - not initial load');
      return;
    }

    // Prevent duplicate calls using ref
    if (initialLoadTriggeredRef.current) {
      console.log('🔒 Dashboard: Initial load already triggered, skipping');
      return;
    }

    console.log('🚀 DASHBOARD: Starting initial data load for shop:', shop);
    initialLoadTriggeredRef.current = true;
    
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
  const handleCardLoad = useCallback((cardType: keyof CardLoadingState) => {
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
          fetchRevenueData(false); // Use cache if available; retry handlers can pass true if needed
          break;
        case 'products':
          fetchProductsData(false);
          break;
        case 'inventory':
          fetchInventoryData(false);
          break;
        case 'newProducts':
          fetchNewProductsData(false);
          break;
        case 'insights':
          fetchInsightsData(false);
          break;
        case 'orders':
          fetchOrdersData(false);
          break;
        case 'abandonedCarts':
          fetchAbandonedCartsData(false);
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
      return;
    }
    
    console.log('🔄 MANUAL REFRESH: Forcing fresh API calls for all data');
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
      
      setIsRefreshing(false);
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      setIsRefreshing(false);
    }
  }, [isRefreshing, lastRefreshTime, fetchRevenueData, fetchProductsData, fetchInventoryData, fetchNewProductsData, fetchInsightsData, fetchOrdersData, fetchAbandonedCartsData]);

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
        
        notifications.showSuccess('🔗 Store connected successfully! Loading your analytics...', {
          category: 'Store Connection',
          duration: 3000
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
      
      // Redirect after clearing state
      setTimeout(() => {
        navigate('/');
      }, 500);
    }
  }, [isAuthReady, authLoading, isAuthenticated, shop, navigate]);

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
                      onClick={() => {
                        console.log('Load Products button clicked');
                        handleCardLoad('products');
                      }}
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
                      onClick={() => {
                        console.log('Load Products button clicked');
                        handleCardLoad('products');
                      }}
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
        
        {/* Cache Status Indicator for Testing */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" sx={{ 
            color: 'text.secondary', 
            fontSize: '0.7rem',
            opacity: 0.7 
          }}>
            🔧 Cache: {Math.round(CACHE_DURATION / (1000 * 60))}min | Console: debugCache(), clearCache(), testCacheBehavior()
          </Typography>
          <Typography variant="caption" sx={{ 
            color: Object.keys(cache).filter(k => k !== 'version' && k !== 'shop').length > 0 ? 'success.main' : 'warning.main',
            fontSize: '0.65rem',
            fontWeight: 500
          }}>
            📊 Cache Status: {Object.keys(cache).filter(k => k !== 'version' && k !== 'shop').length} entries loaded
          </Typography>
        </Box>
            <Button
              variant="text"
              size="small"
              onClick={() => {
                console.log('🔍 Current cache state:', cache);
                console.log('🔍 SessionStorage cache:', sessionStorage.getItem(getCacheKey(shop || '')));
                alert(`Cache debug:\nShop: ${shop}\nCache keys: ${Object.keys(cache).filter(k => k !== 'version' && k !== 'shop').join(', ')}\nHas products cache: ${!!cache.products}`);
              }}
              sx={{ minWidth: 'auto', px: 1 }}
            >
              Debug Cache
            </Button>
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
