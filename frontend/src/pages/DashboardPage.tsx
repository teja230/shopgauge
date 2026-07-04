// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Typography, Card, CardContent, Alert, CircularProgress, Link as MuiLink, IconButton, Button, ToggleButtonGroup, ToggleButton, useMediaQuery, useTheme, Menu, MenuItem, Chip } from '@mui/material';
import { RevenueChart } from '../components/ui/RevenueChart';
import PredictionViewContainer from '../components/ui/PredictionViewContainer';
import { ListSkeleton } from '../components/ui/SkeletonLoaders';
import useUnifiedAnalytics from '../hooks/useUnifiedAnalytics';
import { MetricCard } from '../components/ui/MetricCard';
import { fetchWithAuth, retryWithBackoff, getRevenue, getInsights, getProducts, getOrders } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import {
  ExternalLink as OpenInNew,
  RefreshCw as Refresh,
  Store as Storefront,
  ClipboardList as ListAlt,
  PackageCheck as Inventory2,
  BarChart3 as Analytics,
  LineChart as ShowChart,
  ArrowUpDown as Sort,
  ArrowUp as ArrowUpward,
  ArrowDown as ArrowDownward,
  X as Close,
  ShoppingCart as ShoppingCartCheckout,
  Sparkles as AutoAwesome,
  HelpCircle as HelpOutlineIcon,
} from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import { useNotifications } from '../hooks/useNotifications';
import { useSessionNotification } from '../hooks/useSessionNotification';
import {
  getCacheKey,
  invalidateCache,
  CACHE_VERSION,
  checkRedisCacheStatus,
} from '../utils/cacheUtils'; // Import from shared utils
import IntelligentLoadingScreen from '../components/ui/IntelligentLoadingScreen';
import ErrorBoundary from '../components/ErrorBoundary';
import ChartErrorBoundary from '../components/ui/ChartErrorBoundary';
import { debugLog } from '../components/ui/DebugPanel';
import Joyride from 'react-joyride';
import type { Step, CallBackProps } from 'react-joyride';
import ThemedJoyrideTooltip from '../components/ui/ThemedJoyrideTooltip';
import { DemoModeBanner } from '../components/ui/DemoModeIndicator';




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
  borderRadius: 8,
  borderColor: theme.palette.divider,
  backgroundColor: '#ffffff',
  boxShadow: '0 22px 54px -44px rgb(16 24 32 / 0.80)',
  transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
  overflow: 'hidden',
  '&:hover': {
    boxShadow: '0 28px 64px -48px rgb(16 24 32 / 0.86)',
    transform: 'translateY(-1px)',
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
  letterSpacing: 0,
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
  color: '#101820',
  fontWeight: 700,
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  transition: 'color 0.2s ease',
  '& svg': {
    opacity: 0,
    transition: 'opacity 0.2s ease',
    color: '#2f5bea',
  },
  '&:hover': {
    color: '#2f5bea',
    '& svg': { opacity: 1 },
  },
}));

const OrderLink = styled(MuiLink)(({ theme }) => ({
  color: '#101820',
  fontWeight: 700,
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  transition: 'color 0.2s ease',
  '& svg': {
    opacity: 0,
    transition: 'opacity 0.2s ease',
    color: '#2f5bea',
  },
  '&:hover': {
    color: '#2f5bea',
    '& svg': { opacity: 1 },
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

const parseMoneyValue = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const formatDashboardMoney = (value: unknown): string => {
  const amount = parseMoneyValue(value);

  if (amount === null) {
    return 'N/A';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount >= 1000 ? 0 : 2,
  }).format(amount);
};

const getInventoryTone = (inventory?: number) => {
  if (typeof inventory !== 'number') {
    return {
      label: 'Stock unknown',
      color: '#64748b',
      background: 'rgba(100,116,139,0.10)',
      border: 'rgba(100,116,139,0.18)',
    };
  }

  if (inventory <= 10) {
    return {
      label: `${inventory} left`,
      color: '#b42318',
      background: 'rgba(244,63,94,0.10)',
      border: 'rgba(244,63,94,0.22)',
    };
  }

  if (inventory <= 30) {
    return {
      label: `${inventory} in stock`,
      color: '#a15c07',
      background: 'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.24)',
    };
  }

  return {
    label: `${inventory} in stock`,
    color: '#067647',
    background: 'rgba(21,184,122,0.11)',
    border: 'rgba(21,184,122,0.22)',
  };
};

const getOrderCustomerName = (order: Order): string =>
  order.customer
    ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || 'Customer'
    : 'Guest checkout';

const formatOrderNumber = (orderId: string | number | undefined, fallback: number): string => {
  if (!orderId) {
    return `Temporary-${fallback + 1}`;
  }

  const normalized = String(orderId).split('/').pop() || String(orderId);
  return normalized.replace(/^demo_order_/, '');
};

interface RevenueData {
  created_at: string;
  total_price: number;
}

interface DashboardInsight {
  totalRevenue: number;
  revenue?: number;
  recentRevenue?: number; // Add 7-day revenue
  recentOrders?: number; // Add 7-day orders
  recentConversionRate?: number; // Add 7-day conversion rate
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

const COLORS = ['#2f5bea', '#15b87a', '#d97706', '#dc2626', '#7c9cff'];

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
  letterSpacing: 0,
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
  gap: 0,
  overflow: 'hidden',
  borderRadius: 8,
  border: '1px solid rgba(16, 24, 32, 0.08)',
  background:
    'linear-gradient(180deg, rgba(248,250,252,0.82) 0%, rgba(255,255,255,0.96) 100%)',
}));

const ProductItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.55, 1.75),
  borderBottom: '1px solid rgba(16, 24, 32, 0.07)',
  backgroundColor: 'transparent',
  transition: 'background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(47, 91, 234, 0.055)',
    transform: 'translateY(-1px)',
    boxShadow: '0 18px 36px -34px rgb(16 24 32 / 0.72)',
  },
  '&:last-of-type': {
    borderBottom: 0,
  },
}));

const ProductInfo = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  flex: 1,
  minWidth: 0
}));

const ProductName = styled(Typography)(({ theme }) => ({
  fontWeight: 850,
  color: theme.palette.text.primary,
  fontSize: '0.92rem',
  lineHeight: 1.35,
  minWidth: 0,
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
  gap: 0,
  overflow: 'hidden',
  borderRadius: 8,
  border: '1px solid rgba(16, 24, 32, 0.08)',
  background:
    'linear-gradient(180deg, rgba(248,250,252,0.82) 0%, rgba(255,255,255,0.96) 100%)',
}));

const OrderItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.55, 1.75),
  borderBottom: '1px solid rgba(16, 24, 32, 0.07)',
  backgroundColor: 'transparent',
  transition: 'background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(47, 91, 234, 0.055)',
    transform: 'translateY(-1px)',
    boxShadow: '0 18px 36px -34px rgb(16 24 32 / 0.72)',
  },
  '&:last-of-type': {
    borderBottom: 0,
  },
}));

const OrderInfo = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  flex: 1,
  minWidth: 0
}));

const OrderTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 850,
  color: theme.palette.text.primary,
  fontSize: '0.92rem',
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
  flexDirection: 'column',
  alignItems: 'stretch',
  marginBottom: theme.spacing(2),
  padding: theme.spacing(0, 0, 1.5),
  borderBottom: `1px solid ${theme.palette.divider}`,
  gap: theme.spacing(1.25),
  position: 'sticky',
  top: 0,
  zIndex: 2,
  backgroundColor: '#ffffff',
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.25rem',
  fontWeight: 800,
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

// formatDate function moved to utils/dateUtils.ts for reusability

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

// Dashboard tutorial steps
const DASHBOARD_TUTORIAL_STEPS: Step[] = [
  {
    target: 'body',
    title: 'Welcome to Your Dashboard!',
    content: 'This is your business intelligence hub. Get a quick overview of your revenue, products, and key metrics.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '.dashboard-metrics',
    title: 'Key Metrics',
    content: 'See your total revenue, conversion rate, abandoned carts, low inventory, and new products at a glance.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '.dashboard-products',
    title: 'Top Products',
    content: 'See your best-selling products and inventory status. Click on product names to view them in Shopify.',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '.dashboard-orders',
    title: 'Recent Orders',
    content: 'Monitor your latest orders and customer activity. Click on order numbers to view them in Shopify.',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '.dashboard-chart-toggle',
    title: 'Advanced Analytics',
    content: 'Switch between Classic View and Advanced Analytics to access AI-powered revenue forecasting with 7-60 day predictions.',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '.dashboard-refresh-button',
    title: 'Data Refresh',
    content: 'Use the "Refresh Data" button to get the latest information from your Shopify store.',
    placement: 'left',
    disableBeacon: true,
  },
];

const DashboardPage = () => {
  const { isAuthenticated, shop, authLoading, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [, setQueueVersion] = useState(0);
  const location = useLocation();
  const notifications = useNotifications();
  
  // Enhanced demo mode detection
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const demoParam = urlParams.get('demo');
    const localStorageFlag = localStorage.getItem('demo_mode_active');
    
    console.log('Dashboard: Demo mode detection', {
      demoParam,
      localStorageFlag,
      shop,
      currentUrl: window.location.href
    });
    
    // Check if demo mode should be activated
    const shouldActivateDemo = demoParam === 'true' || 
                              shop === 'demo-shopgauge.myshopify.com' ||
                              window.location.hostname.includes('demo');
    
    if (shouldActivateDemo && localStorageFlag !== 'true') {
      console.log('Dashboard: Activating demo mode');
      localStorage.setItem('demo_mode_active', 'true');
      // Force a data refresh instead of page reload to avoid blank page issues
      setDashboardDataInitialized(false);
      setLoading(true);
    }
  }, [shop]);
  
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
  const [showTutorial, setShowTutorial] = useState(false);
  // Use a separate ref for tutorial notification deduplication
  const tutorialNotificationShownRef = useRef(false);

  // Reset tutorial notification flag when tutorial is started
  useEffect(() => {
    if (showTutorial) {
      tutorialNotificationShownRef.current = false;
    }
  }, [showTutorial]);

  // Auto-trigger tutorial for demo mode users
  useEffect(() => {
    const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                      new URLSearchParams(window.location.search).get('demo') === 'true' ||
                      shop === 'demo-shopgauge.myshopify.com';
    
    if (isDemoMode && shop && !authLoading && isAuthReady && !loading) {
      const tutorialCompleted = localStorage.getItem(`dashboard_tutorial_completed_${shop}`);
      const demoTutorialShown = sessionStorage.getItem('demo_dashboard_tutorial_shown');
      
      console.log('Dashboard: Auto-tutorial check', {
        isDemoMode,
        shop,
        authLoading,
        isAuthReady,
        loading,
        tutorialCompleted,
        demoTutorialShown
      });
      
      // Auto-trigger tutorial for first-time demo users
      if (tutorialCompleted !== 'true' && demoTutorialShown !== 'true' && !showTutorial && !tutorialNotificationShownRef.current) {
        console.log('Dashboard: Auto-triggering tutorial for demo user');
        tutorialNotificationShownRef.current = true; // Prevent multiple triggers
        // Small delay to let the page fully load and data populate
        setTimeout(() => {
          setShowTutorial(true);
          sessionStorage.setItem('demo_dashboard_tutorial_shown', 'true');
          notifications.showInfo('Welcome to your demo dashboard! Let\'s take a quick tour of the key features.', {
            category: 'Tutorial',
            duration: 4000
          });
        }, 2000); // 2-second delay for better UX
      }
    }
  }, [shop, authLoading, isAuthReady, loading, showTutorial]); // Removed 'notifications' to prevent re-triggering

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

  // Track previous shop to detect actual changes and fresh logins
  const prevShopRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);
  
  // Effect to handle shop changes, cache invalidation, and fresh login detection
  useEffect(() => {
    if (shop && isAuthReady) {
      // Check if this is a new shop login (not just a page refresh)
      if (prevShopRef.current && prevShopRef.current !== shop) {
        console.log(`🔄 Shop changed from "${prevShopRef.current}" to "${shop}" - Invalidating cache`);
        const freshCache = invalidateCache(shop);
        if (freshCache) {
          setCache(freshCache);
        }
        setIsInitialLoad(true); // This will trigger a full data reload for the new shop
        hasInitializedRef.current = false; // Reset initialization flag for new shop
      } else if (!hasInitializedRef.current) {
        // This is a page refresh or re-authentication for the same shop
        console.log(`🔄 Same shop re-authentication detected: ${shop}`);
        hasInitializedRef.current = true;
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

  // Create a stable reference for orders data for Advanced Analytics
  const stableOrdersData = useMemo(() => {
    const ordersData = insights?.orders || [];
    debugLog.info('[Advanced Analytics] Orders data for unified analytics', {
      ordersLength: ordersData.length,
      sampleOrder: ordersData[0] || 'No orders',
      orderDates: ordersData.slice(0, 5).map(order => order?.created_at).filter(Boolean)
    }, 'Advanced Analytics');
    return ordersData;
  }, [insights?.orders]);

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
    days: 90,
    includePredictions: true,
    autoRefresh: false,
    shop: shop && shop.trim() ? shop : undefined,
    useDashboardData: true, // Use dashboard data instead of separate API calls
    dashboardRevenueData: stableTimeseriesData, // Use stable reference for revenue
    dashboardOrdersData: stableOrdersData, // Use stable reference for orders
    realConversionRate: insights?.conversionRate, // Pass real conversion rate from dashboard
    recentRevenue: insights?.recentRevenue, // Pass 7-day revenue from dashboard
    recentOrders: insights?.recentOrders, // Pass 7-day orders from dashboard
    recentConversionRate: insights?.recentConversionRate, // Pass 7-day conversion rate from dashboard
    // Note: Always computes 90 days max, filtering done in PredictionViewContainer
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

  // Sorting state for products and orders
  const [productsSortBy, setProductsSortBy] = useState<'name' | 'inventory' | 'price'>('name');
  const [productsSortOrder, setProductsSortOrder] = useState<'asc' | 'desc'>('asc');
  const [ordersSortBy, setOrdersSortBy] = useState<'date' | 'amount' | 'customer'>('date');
  const [ordersSortOrder, setOrdersSortOrder] = useState<'asc' | 'desc'>('desc');

  // Sorting functions
  const sortProducts = useCallback((products: Product[]) => {
    if (!products || products.length === 0) return products;
    
    return [...products].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (productsSortBy) {
        case 'name':
          aValue = a.title?.toLowerCase() || '';
          bValue = b.title?.toLowerCase() || '';
          break;
        case 'inventory':
          aValue = a.inventory || 0;
          bValue = b.inventory || 0;
          break;
        case 'price':
          aValue = parseFloat(a.price?.replace(/[^0-9.]/g, '') || '0');
          bValue = parseFloat(b.price?.replace(/[^0-9.]/g, '') || '0');
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return productsSortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return productsSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [productsSortBy, productsSortOrder]);

  const sortOrders = useCallback((orders: Order[]) => {
    if (!orders || orders.length === 0) return orders;
    
    return [...orders].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (ordersSortBy) {
        case 'date':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'amount':
          aValue = a.total_price || 0;
          bValue = b.total_price || 0;
          break;
        case 'customer':
          aValue = a.customer ? `${a.customer.first_name} ${a.customer.last_name}`.toLowerCase() : '';
          bValue = b.customer ? `${b.customer.first_name} ${b.customer.last_name}`.toLowerCase() : '';
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return ordersSortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return ordersSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [ordersSortBy, ordersSortOrder]);

  // Sort handlers
  const handleProductsSort = useCallback((sortBy: 'name' | 'inventory' | 'price') => {
    if (productsSortBy === sortBy) {
      setProductsSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setProductsSortBy(sortBy);
      setProductsSortOrder('asc');
    }
  }, [productsSortBy]);

  const handleOrdersSort = useCallback((sortBy: 'date' | 'amount' | 'customer') => {
    if (ordersSortBy === sortBy) {
      setOrdersSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setOrdersSortBy(sortBy);
      setOrdersSortOrder('desc'); // Default to desc for orders
    }
  }, [ordersSortBy]);

  // Sorted data
  const sortedProducts = useMemo(() => sortProducts(insights?.topProducts || []), [insights?.topProducts, sortProducts]);
  const sortedOrders = useMemo(() => {
    const orders = insights?.orders || [];
    debugLog.info('[Orders] sortedOrders calculation', {
      hasInsights: !!insights,
      ordersLength: orders.length,
      sampleOrder: orders[0] || 'No orders'
    }, 'Orders');
    return sortOrders(orders);
  }, [insights?.orders, sortOrders]);
  const visibleProducts = useMemo(() => sortedProducts.slice(0, 5), [sortedProducts]);
  const visibleOrders = useMemo(() => sortedOrders.slice(0, 5), [sortedOrders]);
  const getSortChipSx = useCallback((active: boolean) => ({
    height: 30,
    borderRadius: 999,
    px: 0.35,
    fontSize: '0.75rem',
    fontWeight: 800,
    bgcolor: active ? '#e8edff' : '#ffffff',
    color: active ? '#1d3db8' : '#344054',
    borderColor: active ? '#b3c4f5' : 'rgba(16, 24, 32, 0.18)',
    '& .MuiChip-icon': {
      color: active ? '#2f5bea' : '#64748b',
      fontSize: 16,
    },
    '&:hover': {
      bgcolor: active ? '#dfe7ff' : '#f6f7f9',
      borderColor: active ? '#93aaf0' : 'rgba(47, 91, 234, 0.28)',
    },
  }), []);
  
  // Helper function to check if cache entry is fresh (< 120 minutes old)
  const isCacheFresh = useCallback((cacheEntry: CacheEntry<any> | undefined, cacheKey?: string): boolean => {
    if (!cacheEntry) {
      console.log(`🔍 ${cacheKey || 'CACHE'}: No cache entry found`);
      notifications.addNotification(`${cacheKey || 'Cache'}: No cache found`, 'warning', { duration: 3000 });
      return false;
    }
    
    const age = Date.now() - cacheEntry.timestamp;
    const isFresh = age < CACHE_DURATION;
    const ageMinutes = Math.round(age / (1000 * 60));
    const maxMinutes = Math.round(CACHE_DURATION / (1000 * 60));
    
    console.log(`🔍 ${cacheKey || 'CACHE'}: ${ageMinutes}min old (max: ${maxMinutes}min) - ${isFresh ? 'FRESH ✅' : 'EXPIRED ❌'}`);
    
    if (isFresh) {
      notifications.addNotification(`${cacheKey || 'Cache'}: Using cached data (${ageMinutes}min old)`, 'success', { duration: 2000 });
    } else {
      notifications.addNotification(`${cacheKey || 'Cache'}: Cache expired (${ageMinutes}min old)`, 'info', { duration: 2000 });
    }
    
    return isFresh;
  }, [notifications]);

  // Create a cache instance that prevents concurrent fetches for the same key
  const activeFetches = useRef<Map<string, Promise<any>>>(new Map());
  
  // Track if this is a fresh login (for optimal cache strategy)
  const isFreshLoginRef = useRef(false);
  
  // Fresh login detection: handles both shop changes and new browser sessions
  useEffect(() => {
    if (shop && isAuthenticated) {
      // Check if this is a new shop login (shop change)
      if (prevShopRef.current && prevShopRef.current !== shop) {
        console.log(`🆕 Fresh login detected for shop: ${shop} (previous: ${prevShopRef.current})`);
        isFreshLoginRef.current = true;
        
        // Reset fresh login flag after initial data loading
        setTimeout(() => {
          isFreshLoginRef.current = false;
          console.log(`✅ Fresh login period ended for shop: ${shop}`);
        }, 3000); // 3 seconds should be enough for initial load
      } else if (!hasInitializedRef.current) {
        // This could be a page refresh, re-authentication, or new browser session
        // Check if we have session cache for this shop to determine if it's a fresh session
        const sessionCache = JSON.parse(sessionStorage.getItem(getCacheKey(shop)) || '{}');
        const hasSessionCache = Object.keys(sessionCache).length > 2; // More than just version and shop
        
        if (hasSessionCache) {
          // We have session cache, so this is likely a page refresh or re-authentication
          console.log(`🔄 Same shop re-authentication detected: ${shop} (with session cache)`);
          isFreshLoginRef.current = false;
        } else {
          // No session cache, check Redis cache status to make informed decision
          console.log(`🆕 New browser session detected: ${shop} (no session cache, checking Redis status)`);
          
          // Check Redis cache status asynchronously
          checkRedisCacheStatus(shop).then(redisStatus => {
            if (redisStatus) {
              const hasRedisCache = Object.values(redisStatus).some((value: any) => 
                typeof value === 'boolean' && value === true
              );
              
              if (hasRedisCache) {
                console.log(`✅ Redis cache available for ${shop}, will use Redis-first strategy`);
                isFreshLoginRef.current = false; // Use Redis cache
              } else {
                console.log(`❌ No Redis cache available for ${shop}, will make fresh API calls`);
                isFreshLoginRef.current = false; // Still don't skip Redis, but expect cache miss
              }
            } else {
              console.log(`⚠️ Could not check Redis cache status for ${shop}, proceeding with normal strategy`);
              isFreshLoginRef.current = false;
            }
          }).catch(error => {
            console.warn(`Error checking Redis cache status:`, error);
            isFreshLoginRef.current = false;
          });
        }
      }
    }
  }, [shop, isAuthenticated]);

  // Dashboard handles all data loading including products - no special competitor logic needed

  // Stable cache check function with optimal strategy
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
    
    // Check if session cache is fresh
    const isSessionFresh = cachedEntry && 
      (Date.now() - cachedEntry.timestamp) < CACHE_DURATION && 
      cachedEntry.version === CACHE_VERSION &&
      cachedEntry.shop === shop;
    
    // OPTIMAL STRATEGY: Session cache first, then Redis via backend
    const isFreshLogin = isFreshLoginRef.current;
    
    if (isFreshLogin) {
      // SHOP CHANGE STRATEGY: Skip session cache, go directly to backend (which checks Redis first)
      console.log(`🔄 ${cacheKey.toUpperCase()}: Shop change detected - checking Redis cache first via backend`);
    } else {
      // NORMAL STRATEGY: Session First, Redis Second (to prevent continuous Redis hits)
      if (!forceRefresh && isSessionFresh) {
        const ageMinutes = Math.round((Date.now() - cachedEntry.timestamp) / (1000 * 60));
        console.log(`✅ ${cacheKey.toUpperCase()}: Using session cached data (${ageMinutes}min old)`);
        setCache(prev => ({ ...prev, [cacheKey]: cachedEntry }));
        return cachedEntry.data;
      }
      
      if (!forceRefresh && !isSessionFresh && cachedEntry) {
        console.log(`🔄 ${cacheKey.toUpperCase()}: Session cache expired, checking Redis cache via backend...`);
      } else if (!forceRefresh && !cachedEntry) {
        console.log(`🔄 ${cacheKey.toUpperCase()}: No session cache, checking Redis cache via backend...`);
      }
    }
    
    // Create and track the fetch promise to prevent concurrent fetches
    const fetchPromise = (async () => {
      try {
        const context = isFreshLogin ? 'shop change' : 'normal action';
        console.log(`🔄 ${cacheKey.toUpperCase()}: Fetching data from API (${context} - backend will check Redis cache first)`);
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
    
    return fetchPromise;
  }, [shop, setCache]);

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
    
    return formatDate(lastUpdate.toISOString(), 'MMM d, h:mm a');
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
    // Check demo mode first
    const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                      new URLSearchParams(window.location.search).get('demo') === 'true' ||
                      shop === 'demo-shopgauge.myshopify.com';
    
    // Pre-flight authentication check (skip for demo mode)
    if (!isDemoMode && (!isAuthenticated || !shop)) {
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
        // Check if demo mode is active and use appropriate endpoint
        console.log('Dashboard: Fetching revenue via centralized API');
        return await getRevenue();
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
      const recentRevenue = data.recentRevenue || 0; // Use backend-calculated 7-day revenue
      const recentOrders = data.recentOrders || 0; // Use backend-calculated 7-day orders
      const recentConversionRate = data.recentConversionRate || 0; // Use backend-calculated 7-day conversion rate
      
      console.log('Revenue API response:', {
        totalRevenue,
        recentRevenue,
        recentOrders,
        recentConversionRate,
        timeseriesLength: timeseriesData.length,
        periodDays: data.period_days,
        ordersCount: data.orders_count
      });
      
      // If API didn't return timeseries but we have revenue, generate demo data for demo mode
      if (!timeseriesData.length && totalRevenue > 0) {
        const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                          new URLSearchParams(window.location.search).get('demo') === 'true';
        
        if (isDemoMode) {
          // Generate demo timeseries data
          console.log('Generating demo timeseries data...');
          const daysBack = 30;
          timeseriesData = Array.from({length: daysBack}, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (daysBack - i - 1));
            return {
              date: date.toISOString().split('T')[0],
              revenue: Math.floor(Math.random() * 2000) + 800 // Demo revenue between 800-2800
            };
          });
          console.log('Generated demo timeseries:', timeseriesData.length, 'data points');
        } else {
          try {
            console.log('Fetching timeseries data separately for real shop...');
            const tsResp = await retryWithBackoff(() => fetchWithAuth('/api/analytics/revenue/timeseries'));
            const tsJson = await tsResp.json();
            timeseriesData = tsJson.timeseries || [];
            console.log('Separate timeseries fetch result:', timeseriesData.length, 'data points');
          } catch (err) {
            console.warn('Failed to fetch revenue timeseries', err);
          }
        }
      }
      
      setInsights(mergeInsights({
        totalRevenue: data.rate_limited ? 0 : totalRevenue,
        recentRevenue: data.rate_limited ? 0 : recentRevenue,
        recentOrders: data.rate_limited ? 0 : recentOrders,
        recentConversionRate: data.rate_limited ? 0 : recentConversionRate,
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
    // Check demo mode first
    const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                      new URLSearchParams(window.location.search).get('demo') === 'true' ||
                      shop === 'demo-shopgauge.myshopify.com';
    
    // Pre-flight authentication check (skip for demo mode)
    if (!isDemoMode && (!isAuthenticated || !shop)) {
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
        console.log('🔄 Dashboard: Fetching products via centralized API');
        const apiResponse = await getProducts();
        
        // Handle both array and object responses
        const jsonData = Array.isArray(apiResponse) 
          ? { products: apiResponse } // Wrap array in expected format
          : apiResponse; // Use object as-is
        
        console.log('📊 Dashboard: Products API response:', jsonData);
        
        // Populate session storage for products data (used by dashboard and other components)
        if (jsonData.products && Array.isArray(jsonData.products) && jsonData.products.length > 0) {
          console.log('✅ Dashboard: Products data loaded -', jsonData.products.length, 'products');
          
          // Cache in session storage for other components to use
          const sessionKey = `products_cache_${shop}`;
          const cacheData = {
            products: jsonData.products,
            timestamp: Date.now()
          };
          sessionStorage.setItem(sessionKey, JSON.stringify(cacheData));
          console.log('✅ Dashboard: Products cached in session storage');
        } else {
          console.warn('⚠️ Dashboard: Products API returned no products');
        }
        
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
        console.log('Dashboard: Fetching inventory via centralized API');
        // For demo mode, return embedded data, for real mode use inventory endpoint
        const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                          new URLSearchParams(window.location.search).get('demo') === 'true';
        
        if (isDemoMode) {
          // Return demo inventory data
          return {
            low_inventory_count: 8,
            low_inventory_products: [
              { name: 'Premium Wireless Headphones', current_stock: 3, reorder_point: 10 },
              { name: 'Smart Fitness Tracker', current_stock: 2, reorder_point: 8 },
              { name: 'Portable Bluetooth Speaker', current_stock: 1, reorder_point: 5 }
            ]
          };
        } else {
          const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/inventory/low'));
          return await response.json();
        }
      }, forceRefresh);
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        throw new Error('PERMISSION_ERROR');
      }
      
      setInsights(mergeInsights({
        lowInventory: data.rate_limited ? 0 : (Array.isArray(data.lowInventory) ? data.lowInventory.length : (data.low_inventory_count || data.lowInventoryCount || 0))
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
        console.log('Dashboard: Fetching new products via centralized API');
        const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                          new URLSearchParams(window.location.search).get('demo') === 'true';
        
        if (isDemoMode) {
          // Return demo new products data
          return {
            new_products_count: 5,
            new_products: [
              { title: 'Wireless Charging Pad', created_at: new Date(Date.now() - 86400000).toISOString(), status: 'active' },
              { title: 'Smart Home Security Camera', created_at: new Date(Date.now() - 172800000).toISOString(), status: 'active' },
              { title: 'Ergonomic Office Chair', created_at: new Date(Date.now() - 259200000).toISOString(), status: 'active' }
            ]
          };
        } else {
          const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/new_products'));
          return await response.json();
        }
      }, forceRefresh);
      
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        throw new Error('PERMISSION_ERROR');
      }
      
      setInsights(mergeInsights({
        newProducts: data.rate_limited ? 0 : (data.new_products_count || data.newProducts || 0)
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
        console.log('Dashboard: Fetching insights via centralized API');
        return await getInsights();
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
        console.log('Dashboard: Fetching abandoned carts via centralized API');
        const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                          new URLSearchParams(window.location.search).get('demo') === 'true';
        
        if (isDemoMode) {
          // Return demo abandoned carts data
          return {
            abandoned_cart_count: 24,
            abandoned_cart_value: 3847.25,
            recovery_rate: 23.5
          };
        } else {
          const response = await retryWithBackoff(() => fetchWithAuth('/api/analytics/abandoned_carts'));
          return await response.json();
        }
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
        abandonedCarts: data.rate_limited ? 0 : (data.abandoned_cart_count || data.abandonedCarts || 0)
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
    // Check demo mode first
    const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                      new URLSearchParams(window.location.search).get('demo') === 'true' ||
                      shop === 'demo-shopgauge.myshopify.com';

    // Pre-flight authentication check (skip for demo mode)
    if (!isDemoMode && (!isAuthenticated || !shop)) {
      console.log('Dashboard: Skipping orders fetch - not authenticated or no shop');
      setCardErrors(prev => ({ ...prev, orders: 'Authentication required' }));
      setCardLoading(prev => ({ ...prev, orders: false }));
      return;
    }

    setCardLoading(prev => ({ ...prev, orders: true }));
    setCardErrors(prev => ({ ...prev, orders: null }));
    
    try {
      // Force refresh for demo mode to bypass stale cache
      const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                        new URLSearchParams(window.location.search).get('demo') === 'true' ||
                        shop === 'demo-shopgauge.myshopify.com';
      
      const forceRefreshForDemo = isDemoMode; // Always force refresh for demo mode
      console.log('[Orders] Cache strategy:', { isDemoMode, forceRefresh, forceRefreshForDemo });
      
      // Clear orders cache to ensure fresh data (temporary fix for caching issue)
      const ordersCacheKey = `orders_cache_${shop}`;
      sessionStorage.removeItem(ordersCacheKey);
      debugLog.info('[Orders] Cleared orders cache to force fresh data fetch', { shop, isDemoMode }, 'Orders');
      
      const data = await checkCacheAndFetch('orders', async () => {
          debugLog.info(`[Orders] Starting fetch for shop: ${shop}`, null, 'Orders');
        
        // Fetch orders sequentially to avoid overwhelming the API
        // Check if demo mode is active and use appropriate endpoint
        console.log('Dashboard: Fetching orders via centralized API');
        const apiResponse = await getOrders();
        
        // Handle both array and object responses
        const initialData = Array.isArray(apiResponse) 
          ? { orders: apiResponse, recentOrders: apiResponse.slice(0, 10) } // Wrap array
          : apiResponse; // Use object as-is
        
        console.log('[Orders] API Response Processing:', {
          isArray: Array.isArray(apiResponse),
          apiResponseLength: Array.isArray(apiResponse) ? apiResponse.length : 'not array',
          apiResponseKeys: typeof apiResponse === 'object' ? Object.keys(apiResponse) : 'not object',
          initialDataStructure: {
            hasOrders: !!initialData.orders,
            ordersLength: initialData.orders?.length || 0,
            hasRecentOrders: !!initialData.recentOrders,
            recentOrdersLength: initialData.recentOrders?.length || 0
          }
        });
        
        console.log('[Orders] Initial API response:', {
          hasOrders: !!initialData.orders,
          ordersLength: initialData.orders?.length || 0,
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
        
        let allOrders = initialData.orders || initialData.timeseries || [];
        debugLog.info('[Orders] Initial orders from API', { 
          ordersLength: allOrders.length,
          hasOrders: !!initialData.orders,
          hasTimeseries: !!initialData.timeseries,
          ordersArrayLength: initialData.orders?.length || 0,
          timeseriesArrayLength: initialData.timeseries?.length || 0,
          sampleOrder: allOrders[0] || 'No orders'
        }, 'Orders');
        
        // Only fetch additional pages if first page worked and we have more data
        if (!initialData.rate_limited && initialData.has_more) {
          try {
            console.log('[Orders] Fetching additional pages...');
            // Fetch additional pages with delays to avoid rate limiting
            for (let page = 2; page <= 5; page++) {
              await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between pages
              
              // Use demo endpoint if in demo mode, skip pagination for demo data
              if (isDemoMode) {
                break; // Demo data doesn't need pagination
              }
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
      }, forceRefreshForDemo || forceRefresh);
      
      // Handle error cases with enhanced logging
      if (data.error_code === 'INSUFFICIENT_PERMISSIONS' || 
          (data.error && data.error.includes('re-authentication'))) {
        debugLog.error('[Orders] Permission denied error', data, 'Orders');
        setCardErrors(prev => ({ ...prev, orders: 'Permission denied – please re-authenticate with Shopify' }));
        return;
      }
      
      if (data.error_code === 'AUTHENTICATION_FAILED') {
        debugLog.error('[Orders] Authentication failed', data, 'Orders');
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
        debugLog.error('[Orders] Orders API access denied - insufficient permissions', null, 'Orders');
        setCardErrors(prev => ({ ...prev, orders: 'Permission denied – please re-authenticate with Shopify' }));
        setInsights(mergeInsights({
          orders: [],
          recentOrders: []
        }));
        return;
      }
      
      // Handle generic errors with debug info
      if (data.error && data.debug_info) {
        debugLog.error('[Orders] Generic error with debug info', data, 'Orders');
        setCardErrors(prev => ({ ...prev, orders: `Failed to load orders: ${data.error}` }));
        return;
      }
      
      // Handle successful data
      debugLog.info('[Orders] Successfully processed data, updating insights', null, 'Orders');
      debugLog.info('[Orders] Raw data received', data, 'Orders');
      debugLog.info('[Orders] Data structure analysis', {
        hasOrders: !!data.orders,
        ordersLength: data.orders?.length || 0,
        hasTimeseries: !!data.timeseries,
        timeseriesLength: data.timeseries?.length || 0,
        dataKeys: Object.keys(data),
        sampleOrder: data.orders?.[0] || 'No orders'
      }, 'Orders');
      
      const ordersData = data.rate_limited ? [] : (data.orders || data.timeseries || []);
      const recentOrdersData = data.rate_limited ? [] : (data.recentOrders || (data.orders || data.timeseries || []).slice(0, 5));
      
      debugLog.info('[Orders] Processed data', {
        ordersDataLength: ordersData.length,
        recentOrdersDataLength: recentOrdersData.length,
        sampleOrder: ordersData[0] || 'No orders'
      }, 'Orders');
      
      setInsights(mergeInsights({
        orders: ordersData,
        recentOrders: recentOrdersData
      }));
      
      // Debug: Check insights state after update
      setTimeout(() => {
        debugLog.info('[Orders] Insights state after update', {
          hasInsights: !!insights,
          ordersInInsights: insights?.orders?.length || 0,
          recentOrdersInInsights: insights?.recentOrders?.length || 0,
          sampleOrder: insights?.orders?.[0] || 'No orders in insights'
        }, 'Orders');
      }, 100);
      
      debugLog.info('[Orders] Updated insights state', {
        ordersCount: (data.rate_limited ? [] : (data.orders || data.timeseries || [])).length,
        recentOrdersCount: (data.rate_limited ? [] : (data.recentOrders || (data.orders || data.timeseries || []).slice(0, 5))).length,
        rawDataStructure: {
          hasOrders: !!data.orders,
          hasTimeseries: !!data.timeseries,
          hasRecentOrders: !!data.recentOrders,
          ordersLength: data.orders?.length || 0,
          timeseriesLength: data.timeseries?.length || 0,
          recentOrdersLength: data.recentOrders?.length || 0,
          actualOrdersData: data.orders ? data.orders.slice(0, 2) : 'No orders data',
          dataKeys: Object.keys(data)
        }
      });
      
      if (data.rate_limited) {
        console.warn('[Orders] Rate limited - setting rate limit flag');
        setHasRateLimit(true);
      }
    } catch (error: any) {
      debugLog.error('[Orders] Orders data fetch error', error, 'Orders');
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
    // Check if we're in demo mode
    const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                      new URLSearchParams(window.location.search).get('demo') === 'true' ||
                      shop === 'demo-shopgauge.myshopify.com';

    // For demo mode, skip authentication requirements
    if (isDemoMode) {
      // Set demo shop if not already set
      const demoShop = shop || 'demo-shopgauge.myshopify.com';
      
      if (!isInitialLoad) {
        return;
      }
      
      if (initialLoadTriggeredRef.current) {
        console.log('🔒 Dashboard (Demo): Initial load already triggered, skipping');
        return;
      }

      console.log('🚀 DASHBOARD (DEMO): Starting initial data load for demo mode with shop:', demoShop);
      
      // Clear cache for demo mode to ensure fresh data
      console.log('🧹 DEMO: Clearing cached data for fresh demo experience');
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('cache') || key.includes('demo')) {
          sessionStorage.removeItem(key);
        }
      });
      initialLoadTriggeredRef.current = true;
    } else {
      // For live mode, require authentication
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
    }
    
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
          fetchOrdersData().catch(err => debugLog.error('❌ Orders fetch failed', err, 'Orders'));
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
  }, [isAuthReady, authLoading, isAuthenticated, shop, fetchRevenueData, fetchProductsData, fetchInventoryData, fetchNewProductsData, fetchInsightsData, fetchOrdersData, fetchAbandonedCartsData, dashboardDataInitialized]); // Added fetch functions back since they're now stable

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
    notifications.showInfo('Refreshing dashboard data...', { duration: 2000, category: 'Dashboard' });
    setLastRefreshTime(now);
    setIsRefreshing(true);
    
    try {
      // Step 1: Clear backend Redis cache ONLY for manual refresh (not shop switching)
      if (shop) {
        try {
          console.log('🗑️ Clearing backend Redis cache for manual refresh:', shop);
          const response = await fetchWithAuth('/api/analytics/cache/invalidate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('✅ Backend cache cleared successfully:', result);
          } else {
            console.warn('⚠️ Backend cache clearing failed, continuing with frontend refresh');
          }
        } catch (error) {
          console.warn('⚠️ Backend cache clearing failed:', error, 'continuing with frontend refresh');
        }
      }
      
      // Step 2: Clear frontend cache from both state and sessionStorage to force fresh data
      if (shop) {
        console.log('🗑️ Clearing frontend cache to force fresh API calls');
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
      
      console.log('Dashboard refresh initiated - all caches cleared');
      
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
      
      notifications.showSuccess('Dashboard updated successfully', { duration: 3000, category: 'Dashboard' });
      setIsRefreshing(false);
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      notifications.showError('Unable to refresh data. Please try again.', { persistent: true, category: 'Dashboard' });
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

  // Command palette: "Refresh dashboard data"
  useEffect(() => {
    const refreshHandler = () => handleRefreshAll();
    window.addEventListener('shopgauge:refresh-dashboard', refreshHandler);
    return () => window.removeEventListener('shopgauge:refresh-dashboard', refreshHandler);
  }, [handleRefreshAll]);

  // Handle URL parameters and optimize post-OAuth loading experience
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const connected = searchParams.get('connected');
    const skipLoading = searchParams.get('skip_loading');
    const reauth = searchParams.get('reauth');
    const forceRefresh = searchParams.get('force_refresh');
    const clearCache = searchParams.get('clear_cache');
    const syncProducts = searchParams.get('sync_products');

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
        
        notifications.showSuccess(`Successfully connected${shop ? ` to ${shop.replace('.myshopify.com', '')}` : ''}. Your insights are loading.`, {
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
        
        notifications.showSuccess('Re-authentication successful. Refreshing data...', {
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

    // Handle product sync request from competitors page
    if (syncProducts === 'true') {
      const notificationKey = `sync-products-${shop || 'sync'}`;
      if (!notificationShownRef.current.has(notificationKey)) {
        markNotificationShown(notificationKey);
        
        notifications.showInfo('Syncing your product catalog for competitor tracking...', {
          category: 'Product Sync',
          duration: 3000
        });
        
        // Force refresh products data
        setTimeout(() => {
          handleCardLoad('products', true);
        }, 500);
      }
      
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('sync_products');
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
      console.log('Dashboard: Authentication failed or no shop - checking for post-OAuth scenario');
      
      // Check if this might be a post-OAuth scenario (user just completed OAuth)
      const urlParams = new URLSearchParams(window.location.search);
      const isPostOAuth = urlParams.get('connected') === 'true';
      
      if (isPostOAuth) {
        console.log('Dashboard: Detected post-OAuth scenario, being patient with authentication');
        // Don't immediately redirect - let the AuthContext handle the retry logic
        setLoading(true);
        setError('Setting up your session...');
        return;
      }
      
      console.log('Dashboard: Not a post-OAuth scenario, redirecting to home');
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

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { action, index, status, type } = data;
    console.log('Dashboard Joyride callback:', { action, index, status, type });

    // Prevent duplicate notifications for tutorial
    if (tutorialNotificationShownRef.current) return;

    // Handle tutorial completion - only show one notification
    if (status === 'finished') {
      setShowTutorial(false);
      tutorialNotificationShownRef.current = true;
      // Mark tutorial as completed for this shop
      if (shop) {
        localStorage.setItem(`dashboard_tutorial_completed_${shop}`, 'true');
      }
      notifications.showSuccess('Tutorial completed! You\'re ready to explore your dashboard.', {
        category: 'Tutorial',
        duration: 4000
      });
    } else if (status === 'skipped') {
      setShowTutorial(false);
      tutorialNotificationShownRef.current = true;
      // Mark tutorial as completed for this shop (even if skipped)
      if (shop) {
        localStorage.setItem(`dashboard_tutorial_completed_${shop}`, 'true');
      }
      notifications.showInfo('Tutorial skipped. You can restart it anytime using the Tutorial button.', {
        category: 'Tutorial',
        duration: 3000
      });
    } else if (action === 'close') {
      setShowTutorial(false);
      tutorialNotificationShownRef.current = true;
      // Mark tutorial as completed for this shop (even if closed)
      if (shop) {
        localStorage.setItem(`dashboard_tutorial_completed_${shop}`, 'true');
      }
      // Don't show notification for close action to avoid duplicates
    }
    // Handle step navigation - let Joyride handle navigation internally
    else if (type === 'step:after' && typeof index === 'number') {
      // Let Joyride handle step navigation - don't interfere
    }
    // Handle previous button - properly handle the back action
    else if (action === 'prev' && typeof index === 'number' && index > 0) {
      // Handle previous button - properly handle the back action
    }
    // Handle step:back event type as well
    else if ((type as string) === 'step:back' && typeof index === 'number' && index > 0) {
      // Handle step:back event type as well
    }
  };

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
      <DemoModeBanner />
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

        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            flexDirection: { xs: 'column', md: 'row' },
            border: '1px solid rgba(255,255,255,0.10)',
            bgcolor: '#101820',
            backgroundImage: 'linear-gradient(135deg, #101820 0%, #0b1016 100%)',
            color: 'white',
            borderRadius: 1,
            p: { xs: 2.5, md: 3 },
          }}
        >
          <Box sx={{ maxWidth: 640 }}>
            <Typography variant="overline" sx={{ color: '#9db4ff', fontWeight: 900 }}>
              Operating overview
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.25, lineHeight: 1.15 }}>
              Dashboard
            </Typography>
            <Typography variant="body2" sx={{ color: '#c3ccd5', mt: 1, maxWidth: 560 }}>
              Revenue, orders, inventory risk, and forecast signals for {shop || 'your Shopify store'}.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
            {lastRefreshTime > 0 && (
              <Typography variant="caption" sx={{ color: '#8b96a2', whiteSpace: 'nowrap' }}>
                Updated {new Date(lastRefreshTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            )}
            <RefreshButton
              className="dashboard-refresh-button"
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefreshAll}
              disabled={isRefreshing || debounceCountdown > 0}
              sx={{
                color: '#ffffff',
                borderColor: 'rgba(255,255,255,0.24)',
                '&:hover': { borderColor: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              {isRefreshing ? 'Refreshing...' : debounceCountdown > 0 ? `${debounceCountdown}s` : 'Refresh'}
            </RefreshButton>
          </Box>
        </Box>

        {/* Metrics Overview */}
        <Box
          className="dashboard-metrics"
          sx={{ 
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr 1fr' },
            gap: 2,
            '@keyframes dashboardCardIn': {
              from: { opacity: 0, transform: 'translateY(14px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
            '& > *': {
              opacity: 0,
              animation: 'dashboardCardIn 220ms ease-out forwards',
            },
            '& > *:nth-of-type(1)': { animationDelay: '0ms' },
            '& > *:nth-of-type(2)': { animationDelay: '60ms' },
            '& > *:nth-of-type(3)': { animationDelay: '120ms' },
            '& > *:nth-of-type(4)': { animationDelay: '180ms' },
            '& > *:nth-of-type(5)': { animationDelay: '240ms' },
            '@media (prefers-reduced-motion: reduce)': {
              '& > *': {
                opacity: 1,
                animation: 'none',
              },
            },
          }}
        >
          <MetricCard
            key="revenue"
            label="Total Revenue"
            value={`$${insights?.totalRevenue?.toLocaleString() || '0'}`}
            icon={<ShowChart />}
            delta={
              insights?.totalRevenue && insights?.recentRevenue
                ? `${Math.min(99, (insights.recentRevenue / insights.totalRevenue) * 100).toFixed(1)}%`
                : undefined
            }
            deltaType="up"
            period="last 7d"
            loading={cardLoading.revenue}
            error={cardErrors.revenue}
            onRetry={() => handleCardLoad('revenue')}
            onLoad={() => handleCardLoad('revenue')}
            helpText={insights?.totalRevenue === 0 ? "No revenue data available. Make sure your Shopify store has sales and the app has revenue permissions." : undefined}
          />
          <MetricCard
            key="conversion-rate"
            label="Conversion Rate"
            value={`${insights?.conversionRate?.toFixed(2) || '0'}%`}
            icon={<Analytics />}
            delta={insights?.conversionRateDelta && insights.conversionRateDelta !== 0 ? insights.conversionRateDelta.toString() : undefined}
            deltaType={insights?.conversionRateDelta && insights.conversionRateDelta > 0 ? 'up' : 'down'}
            period="vs previous"
            loading={cardLoading.insights}
            error={cardErrors.insights}
            onRetry={() => handleCardLoad('insights')}
            onLoad={() => handleCardLoad('insights')}
          />
          <MetricCard
            key="abandoned-carts"
            label="Abandoned Carts"
            value={insights?.abandonedCarts?.toString() || '0'}
            icon={<ListAlt />}
            delta={typeof insights?.abandonedCarts === 'number' && insights.abandonedCarts > 0 ? '3.8%' : undefined}
            deltaType="down"
            period="attention"
            loading={cardLoading.abandonedCarts}
            error={cardErrors.abandonedCarts}
            onRetry={() => handleCardLoad('abandonedCarts')}
            onLoad={() => handleCardLoad('abandonedCarts')}
          />
          <MetricCard
            key="low-inventory"
            label="Low Inventory"
            value={typeof insights?.lowInventory === 'number' ? insights.lowInventory.toString() : '0'}
            icon={<Inventory2 />}
            delta={typeof insights?.lowInventory === 'number' && insights.lowInventory > 0 ? `${insights.lowInventory}` : undefined}
            deltaType={typeof insights?.lowInventory === 'number' && insights.lowInventory > 0 ? 'down' : 'neutral'}
            period="items"
            loading={cardLoading.inventory}
            error={cardErrors.inventory}
            onRetry={() => handleCardLoad('inventory')}
            onLoad={() => handleCardLoad('inventory')}
          />
          <MetricCard
            key="new-products"
            label="New Products"
            value={typeof insights?.newProducts === 'number' ? insights.newProducts.toString() : '0'}
            icon={<Storefront />}
            delta={typeof insights?.newProducts === 'number' && insights.newProducts > 0 ? 'New' : undefined}
            deltaType="up"
            period="catalog"
            loading={cardLoading.newProducts}
            error={cardErrors.newProducts}
            onRetry={() => handleCardLoad('newProducts')}
            onLoad={() => handleCardLoad('newProducts')}
          />
        </Box>

        {/* Action queue — deterministic, derived client-side from existing insights */}
        {(() => {
          const dismissed: string[] = JSON.parse(sessionStorage.getItem('dashboard-queue-dismissed') || '[]');
          const dismiss = (id: string) => {
            sessionStorage.setItem('dashboard-queue-dismissed', JSON.stringify([...dismissed, id]));
            setQueueVersion((v) => v + 1);
          };
          const queueItems = [
            typeof insights?.lowInventory === 'number' && insights.lowInventory > 0
              ? {
                  id: 'low-stock',
                  icon: <Inventory2 size={18} />,
                  tone: { fg: '#b45309', bg: 'rgba(245, 158, 11, 0.10)', border: 'rgba(245, 158, 11, 0.35)' },
                  title: `${insights.lowInventory} product${insights.lowInventory === 1 ? '' : 's'} low on stock`,
                  sub: 'Restock before you miss sales.',
                  cta: 'Review products',
                  onClick: () => shop && window.open(`https://${shop}/admin/products?inventory_status=low`, '_blank', 'noopener'),
                }
              : null,
            typeof insights?.abandonedCarts === 'number' && insights.abandonedCarts > 0
              ? {
                  id: 'abandoned-carts',
                  icon: <ShoppingCartCheckout size={18} />,
                  tone: { fg: '#1d3db8', bg: 'rgba(47, 91, 234, 0.08)', border: 'rgba(47, 91, 234, 0.30)' },
                  title: `${insights.abandonedCarts} abandoned checkout${insights.abandonedCarts === 1 ? '' : 's'}`,
                  sub: 'Recover potential revenue with follow-ups.',
                  cta: 'View checkouts',
                  onClick: () => shop && window.open(`https://${shop}/admin/checkouts`, '_blank', 'noopener'),
                }
              : null,
            {
              id: 'ask-shopgpt',
              icon: <AutoAwesome size={18} />,
              tone: { fg: '#0f766e', bg: 'rgba(14, 165, 166, 0.08)', border: 'rgba(14, 165, 166, 0.30)' },
              title: 'Not sure what to tackle first?',
              sub: 'Ask ShopGPT for a prioritized plan.',
              cta: 'Ask ShopGPT',
              onClick: () => navigate('/business-intelligence?ask=' + encodeURIComponent('What should I focus on today to increase revenue?')),
            },
          ].filter((item): item is NonNullable<typeof item> => Boolean(item) && !dismissed.includes(item!.id));

          if (queueItems.length === 0) return null;
          return (
            <Box
              className="dashboard-action-queue"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: `repeat(${Math.min(queueItems.length, 3)}, 1fr)` },
                gap: 2,
              }}
            >
              {queueItems.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    p: 2,
                    borderRadius: 1,
                    border: `1px solid ${item.tone.border}`,
                    bgcolor: '#ffffff',
                    boxShadow: '0 14px 34px -30px rgb(16 24 32 / 0.6)',
                    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                    '&:hover': { boxShadow: '0 20px 44px -32px rgb(16 24 32 / 0.7)', transform: 'translateY(-1px)' },
                  }}
                >
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: 1,
                      display: 'grid',
                      placeItems: 'center',
                      color: item.tone.fg,
                      bgcolor: item.tone.bg,
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#101820', lineHeight: 1.3 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#5f6b76', display: 'block', mt: 0.25 }}>
                      {item.sub}
                    </Typography>
                    <Button
                      size="small"
                      onClick={item.onClick}
                      sx={{ mt: 0.75, px: 1, minHeight: 28, fontWeight: 800, color: item.tone.fg, '&:hover': { bgcolor: item.tone.bg } }}
                    >
                      {item.cta}
                    </Button>
                  </Box>
                  <IconButton size="small" aria-label="Dismiss" onClick={() => dismiss(item.id)} sx={{ color: '#98a1ab', mt: -0.5, mr: -0.5 }}>
                    <Close size={16} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          );
        })()}

        {/* Products and Orders */}
        <Box 
          sx={{ 
            display: 'flex', 
            gap: { xs: 2, md: 3 }, 
            flexDirection: { xs: 'column', md: 'row' },
            width: '100%',
            order: 4,
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
            <StyledCard className="dashboard-products" sx={{ height: '100%' }}>
              <CardContent>
                <SectionHeader>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <SectionTitle>
                        <Inventory2 color={theme.palette.primary.main} />
                        Top Products
                      </SectionTitle>
                      <Typography variant="caption" sx={{ color: '#667085', fontWeight: 700 }}>
                        Ranked catalog snapshot with stock and price signals
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    {shop && (
                      <Button
                        size="small"
                        href={`https://${shop}/admin/products`}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ minHeight: 30, px: 1, fontWeight: 800 }}
                      >
                        View all
                      </Button>
                    )}
                    {cardErrors.products && (
                      <IconButton 
                        size="small" 
                        onClick={() => handleCardLoad('products', true)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Refresh size={16} />
                      </IconButton>
                    )}
                    </Box>
                  </Box>
                  {!cardLoading.products && !cardErrors.products && insights?.topProducts?.length > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          icon={productsSortBy === 'name' ? (productsSortOrder === 'asc' ? <ArrowUpward /> : <ArrowDownward />) : <Sort />}
                          label="Name"
                          variant={productsSortBy === 'name' ? 'filled' : 'outlined'}
                          size="small"
                          onClick={() => handleProductsSort('name')}
                          sx={getSortChipSx(productsSortBy === 'name')}
                        />
                        <Chip
                          icon={productsSortBy === 'inventory' ? (productsSortOrder === 'asc' ? <ArrowUpward /> : <ArrowDownward />) : <Sort />}
                          label="Stock"
                          variant={productsSortBy === 'inventory' ? 'filled' : 'outlined'}
                          size="small"
                          onClick={() => handleProductsSort('inventory')}
                          sx={getSortChipSx(productsSortBy === 'inventory')}
                        />
                        <Chip
                          icon={productsSortBy === 'price' ? (productsSortOrder === 'asc' ? <ArrowUpward /> : <ArrowDownward />) : <Sort />}
                          label="Price"
                          variant={productsSortBy === 'price' ? 'filled' : 'outlined'}
                          size="small"
                          onClick={() => handleProductsSort('price')}
                          sx={getSortChipSx(productsSortBy === 'price')}
                        />
                    </Box>
                  )}
                </SectionHeader>
                {cardLoading.products ? (
                  <Box sx={{ px: 1, py: 1 }}>
                    <ListSkeleton items={5} showAvatar />
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
                ) : visibleProducts?.length ? (
                  <ProductList>
                    {visibleProducts.map((product, index) => {
                      const inventoryTone = getInventoryTone(product.inventory);
                      return (
                      <ProductItem key={`product-${product.id}`}>
                        <Box
                          sx={{
                            width: 30,
                            height: 30,
                            borderRadius: '50%',
                            flexShrink: 0,
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: '#e8edff',
                            color: '#2f5bea',
                            fontWeight: 900,
                            fontSize: 12,
                            fontFeatureSettings: '"tnum"',
                          }}
                        >
                          {String(index + 1).padStart(2, '0')}
                        </Box>
                        <ProductInfo>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
                            <ProductName>
                              <ProductLink 
                                href={`https://${shop}/admin/products/${product.id}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                {product.title}
                                <OpenInNew size={16} style={{ flexShrink: 0 }} />
                              </ProductLink>
                            </ProductName>
                            <Typography
                              variant="body2"
                              sx={{
                                color: '#101820',
                                fontWeight: 900,
                                fontFeatureSettings: '"tnum"',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatDashboardMoney(product.price)}
                            </Typography>
                          </Box>
                          <ProductStats sx={{ flexWrap: 'wrap' }}>
                            <Box
                              component="span"
                              sx={{
                                px: 1,
                                py: 0.35,
                                borderRadius: 999,
                                color: inventoryTone.color,
                                bgcolor: inventoryTone.background,
                                border: `1px solid ${inventoryTone.border}`,
                                fontWeight: 850,
                              }}
                            >
                              {inventoryTone.label}
                            </Box>
                            {typeof product.quantity === 'number' && (
                              <Box component="span" sx={{ color: '#667085', fontWeight: 750 }}>
                                {product.quantity} sold
                              </Box>
                            )}
                            {typeof product.total_price === 'number' && (
                              <Box component="span" sx={{ color: '#667085', fontWeight: 750 }}>
                                {formatDashboardMoney(product.total_price)} revenue
                              </Box>
                            )}
                          </ProductStats>
                        </ProductInfo>
                      </ProductItem>
                      );
                    })}
                    {sortedProducts.length > visibleProducts.length && (
                      <Box
                        sx={{
                          px: 2,
                          py: 1.15,
                          bgcolor: 'rgba(248,250,252,0.88)',
                          color: '#667085',
                          fontSize: 12,
                          fontWeight: 800,
                          textAlign: 'center',
                        }}
                      >
                        {sortedProducts.length - visibleProducts.length} more products available in Shopify
                      </Box>
                    )}
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
            <StyledCard className="dashboard-orders" sx={{ height: '100%' }}>
              <CardContent>
                <SectionHeader>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <SectionTitle>
                        <ListAlt color={theme.palette.primary.main} />
                        Recent Orders
                      </SectionTitle>
                      <Typography variant="caption" sx={{ color: '#667085', fontWeight: 700 }}>
                        Latest revenue activity with customer context
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    {shop && (
                      <Button
                        size="small"
                        href={`https://${shop}/admin/orders`}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ minHeight: 30, px: 1, fontWeight: 800 }}
                      >
                        View all
                      </Button>
                    )}
                    {cardErrors.orders && (
                      <IconButton 
                        size="small" 
                        onClick={() => handleCardLoad('orders')}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Refresh size={16} />
                      </IconButton>
                    )}
                    </Box>
                  </Box>
                  {!cardLoading.orders && !cardErrors.orders && insights?.orders?.length > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          icon={ordersSortBy === 'date' ? (ordersSortOrder === 'asc' ? <ArrowUpward /> : <ArrowDownward />) : <Sort />}
                          label="Date"
                          variant={ordersSortBy === 'date' ? 'filled' : 'outlined'}
                          size="small"
                          onClick={() => handleOrdersSort('date')}
                          sx={getSortChipSx(ordersSortBy === 'date')}
                        />
                        <Chip
                          icon={ordersSortBy === 'amount' ? (ordersSortOrder === 'asc' ? <ArrowUpward /> : <ArrowDownward />) : <Sort />}
                          label="Amount"
                          variant={ordersSortBy === 'amount' ? 'filled' : 'outlined'}
                          size="small"
                          onClick={() => handleOrdersSort('amount')}
                          sx={getSortChipSx(ordersSortBy === 'amount')}
                        />
                        <Chip
                          icon={ordersSortBy === 'customer' ? (ordersSortOrder === 'asc' ? <ArrowUpward /> : <ArrowDownward />) : <Sort />}
                          label="Customer"
                          variant={ordersSortBy === 'customer' ? 'filled' : 'outlined'}
                          size="small"
                          onClick={() => handleOrdersSort('customer')}
                          sx={getSortChipSx(ordersSortBy === 'customer')}
                        />
                    </Box>
                  )}
                </SectionHeader>
                {cardLoading.orders ? (
                  <Box sx={{ px: 1, py: 1 }}>
                    <ListSkeleton items={5} showAvatar />
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
                ) : visibleOrders?.length ? (
                  <OrderList>
                    {visibleOrders.map((order, index) => (
                      <OrderItem key={`order-${order.id || `temp-${index}`}`}>
                        <Box
                          sx={{
                            width: 30,
                            height: 30,
                            borderRadius: '50%',
                            flexShrink: 0,
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: '#eefbf5',
                            color: '#067647',
                            fontWeight: 900,
                            fontSize: 12,
                            fontFeatureSettings: '"tnum"',
                          }}
                        >
                          {String(index + 1).padStart(2, '0')}
                        </Box>
                        <OrderInfo>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
                            <Box sx={{ minWidth: 0 }}>
                              <OrderTitle>
                                {order.id ? (
                                  <OrderLink 
                                    href={`https://${shop}/admin/orders/${order.id}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                  >
                                    Order #{formatOrderNumber(order.id, index)}
                                    <OpenInNew size={16} style={{ flexShrink: 0 }} />
                                  </OrderLink>
                                ) : (
                                  <Typography variant="body1" color="text.secondary" component="div">
                                    Order #{formatOrderNumber(order.id, index)}
                                  </Typography>
                                )}
                              </OrderTitle>
                              <OrderDetails sx={{ mt: 0.35, flexWrap: 'wrap' }}>
                                <Box component="span">{formatDate(order.created_at)}</Box>
                                <Box component="span" sx={{ color: '#cbd5e1' }}>•</Box>
                                <Box component="span">{getOrderCustomerName(order)}</Box>
                              </OrderDetails>
                            </Box>
                            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  color: '#101820',
                                  fontWeight: 900,
                                  fontFeatureSettings: '"tnum"',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {formatDashboardMoney(order.total_price)}
                              </Typography>
                              <Box
                                component="span"
                                sx={{
                                  mt: 0.5,
                                  display: 'inline-flex',
                                  px: 0.85,
                                  py: 0.25,
                                  borderRadius: 999,
                                  color: '#067647',
                                  bgcolor: 'rgba(21,184,122,0.11)',
                                  border: '1px solid rgba(21,184,122,0.22)',
                                  fontSize: 11,
                                  fontWeight: 850,
                                }}
                              >
                                Paid
                              </Box>
                            </Box>
                          </Box>
                        </OrderInfo>
                      </OrderItem>
                    ))}
                    {sortedOrders.length > visibleOrders.length && (
                      <Box
                        sx={{
                          px: 2,
                          py: 1.15,
                          bgcolor: 'rgba(248,250,252,0.88)',
                          color: '#667085',
                          fontSize: 12,
                          fontWeight: 800,
                          textAlign: 'center',
                        }}
                      >
                        {sortedOrders.length - visibleOrders.length} more orders available in Shopify
                      </Box>
                    )}
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
        <Box sx={{ width: '100%', order: 2, display: 'flex', flexDirection: 'column' }}>

          <Box
            className="dashboard-forecasting-toolbar"
            sx={{
              mb: 2,
              p: { xs: 1.25, md: 1.5 },
              bgcolor: '#ffffff',
              border: '1px solid rgba(16, 24, 32, 0.09)',
              borderRadius: 1,
              display: 'flex',
              alignItems: { xs: 'stretch', md: 'center' },
              justifyContent: 'space-between',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 1.5,
              boxShadow: '0 18px 46px -42px rgb(16 24 32 / 0.76)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '10px',
                  bgcolor: chartMode === 'unified' ? '#e8edff' : '#eef2ff',
                  color: '#2f5bea',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {chartMode === 'unified' ? <Analytics size={20} /> : <ShowChart size={20} />}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="overline" sx={{ color: '#2f5bea', fontWeight: 900, lineHeight: 1.2 }}>
                  Forecasting workspace
                </Typography>
                <Typography variant="body2" sx={{ color: '#5f6b76', fontWeight: 700 }}>
                  {chartMode === 'unified'
                    ? 'AI forecasts, confidence intervals, and export-ready analysis are active.'
                    : 'Review classic revenue trends or switch into AI-powered forecasting.'}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'space-between', md: 'flex-end' }, gap: 1, flexWrap: 'wrap' }}>
              <ToggleButtonGroup
                value={chartMode}
                exclusive
                onChange={handleChartModeChange}
                size="small"
                sx={{
                  backgroundColor: '#f6f7f9',
                  border: '1px solid #e4e7eb',
                  borderRadius: '10px',
                  p: 0.5,
                  gap: 0.5,
                  '& .MuiToggleButton-root': {
                    px: { xs: 1.25, sm: 2 },
                    py: 0.75,
                    fontSize: '0.8125rem',
                    fontWeight: 800,
                    textTransform: 'none',
                    border: 'none',
                    borderRadius: '8px !important',
                    color: '#5f6b76',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    transition: 'background-color 0.2s ease, color 0.2s ease',
                    '&:hover': { backgroundColor: 'rgba(47, 91, 234, 0.08)', color: '#2f5bea' },
                    '&.Mui-selected': {
                      backgroundColor: '#ffffff',
                      color: '#101820',
                      boxShadow: '0 1px 3px rgba(16, 24, 32, 0.12)',
                      '&:hover': { backgroundColor: '#ffffff' },
                    },
                  },
                }}
              >
                <ToggleButton value="classic">
                  <ShowChart size={17} />
                  Classic
                </ToggleButton>
                <ToggleButton value="unified">
                  <Analytics size={17} />
                  AI forecasts
                </ToggleButton>
              </ToggleButtonGroup>

              {chartMode === 'classic' && (
                <Button
                  variant="contained"
                  onClick={() => handleChartModeChange(null as any, 'unified')}
                  sx={{
                    minHeight: 38,
                    borderRadius: 1,
                    px: 2,
                    fontWeight: 850,
                    textTransform: 'none',
                    bgcolor: '#2f5bea',
                    boxShadow: '0 16px 34px -24px rgba(47,91,234,0.92)',
                    '&:hover': { bgcolor: '#244bd4' },
                  }}
                  startIcon={<Analytics />}
                >
                  Try AI
                </Button>
              )}
            </Box>
          </Box>

          {/* Chart Container with smooth transitions - SIGNIFICANTLY INCREASED for chart visibility */}
          <Box sx={{
            position: 'relative',
            minHeight: { xs: 560, md: 600 },
            transition: 'all 0.25s ease-in-out',
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
                      <StyledCard sx={{ height: isMobile ? 560 : 600 }}>
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
                      <StyledCard sx={{ height: isMobile ? 520 : 580 }}>
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
                      <StyledCard sx={{ height: isMobile ? 520 : 580 }}>
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
                        height={isMobile ? 500 : 540}
                        predictionDays={predictionDays}
                        onPredictionDaysChange={handlePredictionDaysChange}
                      />
                    </ChartErrorBoundary>
                  );

                } catch (renderError) {
                  console.error('❌ Chrome-safe: Critical render error in unified mode:', renderError);

                  // Chrome emergency fallback
                  return (
                    <StyledCard sx={{ height: isMobile ? 560 : 600 }}>
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
              <StyledCard sx={{ height: isMobile ? 560 : 600 }}>
                <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {/* Only render RevenueChart when we have initialized the dashboard */}
                  {dashboardDataInitialized || stableTimeseriesData.length > 0 ? (
                    <Box sx={{ flex: 1 }}>
                      <RevenueChart
                        data={stableTimeseriesData}
                        loading={cardLoading.revenue}
                        error={cardErrors.revenue}
                        height={isMobile ? 500 : 540}
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

        {/* Dashboard Status */}
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
            gap: 2,
            order: 5,
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
            {insights ? (
              hasRateLimit ?
                'Some data is temporarily unavailable due to API rate limits. Refreshing automatically.' :
                'Dashboard updated with latest available data'
            ) : 'Loading your store analytics...'}
          </Typography>

          <LastUpdatedText>
            Last updated: {getLastUpdatedText()}
          </LastUpdatedText>
        </Box>



        {/* Tutorial Trigger Button - Floating Action Button */}
        <Box
          sx={{
            position: 'fixed',
            bottom: { xs: 20, sm: 30 },
            right: { xs: 20, sm: 30 },
            zIndex: 1000,
          }}
        >
          <Button
            variant="contained"
            onClick={() => {
              setShowTutorial(true);
            }}
            sx={{
              borderRadius: '50%',
              width: 56,
              height: 56,
              minWidth: 'unset',
              boxShadow: '0 4px 12px -2px rgb(15 23 42 / 0.18)',
              backgroundColor: 'primary.main',
              '&:hover': {
                backgroundColor: 'primary.dark',
                boxShadow: '0 6px 16px -4px rgb(15 23 42 / 0.24)',
              },
              transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
            }}
            title="Start Dashboard Tutorial"
            aria-label="Start Dashboard Tutorial"
          >
            <HelpOutlineIcon size={24} />
          </Button>
        </Box>

        {/* Joyride Tutorial Component */}
        <Joyride
          steps={DASHBOARD_TUTORIAL_STEPS}
          run={showTutorial}
          continuous
          showSkipButton
          showProgress
          disableOverlayClose
          styles={{
            options: {
              zIndex: 9999,
              primaryColor: '#2f5bea',
              textColor: '#1e293b',
              backgroundColor: '#fff',
            },
            tooltip: {
              borderRadius: 16,
              boxShadow: '0 8px 32px 0 rgba(37,99,235,0.10)',
              padding: 0,
              fontFamily: 'Inter, sans-serif',
            },
            buttonNext: {
              backgroundColor: '#2f5bea',
              color: '#fff',
              borderRadius: 8,
              fontWeight: 500,
              fontFamily: 'Inter, sans-serif',
            },
            buttonBack: {
              color: '#2f5bea',
              background: '#e0e7ff',
              borderRadius: 8,
              fontWeight: 500,
              fontFamily: 'Inter, sans-serif',
            },
            buttonSkip: {
              color: '#64748b',
              background: 'transparent',
              fontFamily: 'Inter, sans-serif',
            },
          }}
          tooltipComponent={props => <ThemedJoyrideTooltip {...props} accentColor="#2f5bea" />}
          callback={handleJoyrideCallback}
          locale={{
            back: 'Previous',
            close: 'Close',
            last: 'Finish',
            next: 'Next',
            skip: 'Skip',
          }}
        />

      </Box>
    </DashboardContainer>
  );
};

export default DashboardPage;
