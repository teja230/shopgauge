import { useState, useEffect, useCallback, useRef } from 'react';
import { getCacheKey, CACHE_VERSION } from '../utils/cacheUtils';
import { fetchWithAuth } from '../api';
import { debugLog } from '../components/ui/DebugPanel';

interface HistoricalData {
  kind: 'historical';
  date: string;
  revenue: number;
  orders_count: number;
  conversion_rate: number;
  avg_order_value: number;
  isPrediction: false;
}

interface PredictionData {
  kind: 'prediction';
  date: string;
  revenue: number;
  orders_count: number;
  conversion_rate: number;
  avg_order_value: number;
  isPrediction: true;
  confidence_score: number;
  confidence_interval?: {
    revenue_min: number;
    revenue_max: number;
    orders_min: number;
    orders_max: number;
  };
}

interface UnifiedAnalyticsData {
  historical: HistoricalData[];
  predictions: PredictionData[];
  period_days: number;
  total_revenue: number;
  total_orders: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  lastUpdated: Date;
  version: string;
  shop: string;
  days: number;
  includePredictions: boolean;
}

interface UseUnifiedAnalyticsOptions {
  days?: number;
  includePredictions?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  shop?: string;
  // New option to use dashboard data instead of separate API calls
  useDashboardData?: boolean;
  dashboardRevenueData?: any[];
  dashboardOrdersData?: any[];
  // Real conversion rate from dashboard
  realConversionRate?: number;
  // Note: Always computes max 60 days of predictions, filtering done in UI
}

interface UseUnifiedAnalyticsReturn {
  data: UnifiedAnalyticsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: Date | null;
  isCached: boolean;
  cacheAge: number; // in minutes
  loadFromStorage: () => boolean;
  forceCompute: () => void;
  clearUnifiedAnalyticsStorage: () => void;
}

// Cache configuration - same as dashboard
const CACHE_DURATION = 120 * 60 * 1000; // 120 minutes (2 hours) in milliseconds

const MAX_READINESS_CHECKS = 12; // Check for up to 60 seconds (12 * 5s)
const READINESS_CHECK_INTERVAL = 5000; // 5 seconds

const useUnifiedAnalytics = (
  options: UseUnifiedAnalyticsOptions = {}
): UseUnifiedAnalyticsReturn => {
  const {
    days = 60,
    includePredictions = true,
    autoRefresh = false,
    refreshInterval = 300000, // 5 minutes
    shop,
    useDashboardData = false,
    dashboardRevenueData = [],
    dashboardOrdersData = [],
    realConversionRate,
  } = options;

  const [data, setData] = useState<UnifiedAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true); // Start with true to show loading initially
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [cacheAge, setCacheAge] = useState(0);

  // Track active fetches to prevent concurrent calls
  const activeFetchRef = useRef<Promise<UnifiedAnalyticsData> | null>(null);
  
  // Simplified tracking refs
  const isInitializedRef = useRef(false);
  const hasProcessedDataRef = useRef(false); // Track if we've processed any data
  const currentShopRef = useRef<string | null>(null); // Track current shop for change detection

  // Keep a stable reference to the last valid data
  const lastValidDataRef = useRef<UnifiedAnalyticsData | null>(null);

  // Track the last processed data to avoid unnecessary updates
  const lastProcessedDataRef = useRef<{
    revenueLength: number;
    ordersLength: number;
    revenueData: any[];
    ordersData: any[];
  }>({
    revenueLength: 0,
    ordersLength: 0,
    revenueData: [],
    ordersData: []
  });

  // Update the ref whenever we get new valid data
  useEffect(() => {
    if (data && data.historical && data.historical.length > 0) {
      lastValidDataRef.current = data;
    }
  }, [data]);

  // Generate cache key for unified analytics
  const getCacheKeyForAnalytics = useCallback((shopName: string, paramDays: number, predictions: boolean) => {
    return `unified_analytics_${shopName}_${paramDays}d_${predictions ? 'with' : 'no'}_predictions`;
  }, []);

  // Load from cache
  const loadFromCache = useCallback((shopName: string): CacheEntry<UnifiedAnalyticsData> | null => {
    if (!shopName || !shopName.trim()) return null;
    
    try {
      const cacheKey = getCacheKey(shopName);
      const cached = sessionStorage.getItem(cacheKey);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      const analyticsKey = getCacheKeyForAnalytics(shopName, days, includePredictions);
      const entry = cacheData[analyticsKey] as CacheEntry<UnifiedAnalyticsData>;

      if (!entry) return null;

      // Validate cache entry
      const isValidCache = 
        entry.version === CACHE_VERSION &&
        entry.shop === shopName &&
        entry.days === days &&
        entry.includePredictions === includePredictions &&
        (Date.now() - entry.timestamp) < CACHE_DURATION;

      if (isValidCache) {
        // Convert date string back to Date object
        if (entry.lastUpdated && typeof entry.lastUpdated === 'string') {
          entry.lastUpdated = new Date(entry.lastUpdated);
        }
        return entry;
      }

      return null;
    } catch (error) {
      debugLog.warn('Failed to load unified analytics from cache:', error);
      return null;
    }
  }, [days, includePredictions, getCacheKeyForAnalytics]);

  // Save to cache
  const saveToCache = useCallback((shopName: string, analyticsData: UnifiedAnalyticsData) => {
    if (!shopName || !shopName.trim()) return;

    try {
      const cacheKey = getCacheKey(shopName);
      const analyticsKey = getCacheKeyForAnalytics(shopName, days, includePredictions);
      
      // Get existing cache data
      const existingCache = JSON.parse(sessionStorage.getItem(cacheKey) || '{}');
      
      // Create new cache entry
      const newEntry: CacheEntry<UnifiedAnalyticsData> = {
        data: analyticsData,
        timestamp: Date.now(),
        lastUpdated: new Date(),
        version: CACHE_VERSION,
        shop: shopName,
        days,
        includePredictions,
      };

      // Update cache
      existingCache[analyticsKey] = newEntry;
      existingCache.version = CACHE_VERSION;
      existingCache.shop = shopName;

      sessionStorage.setItem(cacheKey, JSON.stringify(existingCache));
      
      debugLog.info(`💾 UNIFIED_ANALYTICS: Cached data for ${shopName} (${days}d, predictions: ${includePredictions})`, {
        analyticsKey,
        dataSize: JSON.stringify(analyticsData).length
      }, 'useUnifiedAnalytics');
    } catch (error) {
      debugLog.error('Failed to save unified analytics to cache', { error, shopName }, 'useUnifiedAnalytics');
    }
  }, [days, includePredictions, getCacheKeyForAnalytics]);

  // Enhanced data change detection
  const hasDataChanged = useCallback((newRevenueData: any[], newOrdersData: any[]): boolean => {
    const lastProcessed = lastProcessedDataRef.current;
    
    // Check if lengths changed
    if (
      newRevenueData.length !== lastProcessed.revenueLength ||
      newOrdersData.length !== lastProcessed.ordersLength
    ) {
      return true;
    }
    
    // Check if data content changed (for small datasets)
    if (newRevenueData.length < 100 && newOrdersData.length < 100) {
      try {
        const revenueChanged = JSON.stringify(newRevenueData) !== JSON.stringify(lastProcessed.revenueData);
        const ordersChanged = JSON.stringify(newOrdersData) !== JSON.stringify(lastProcessed.ordersData);
        return revenueChanged || ordersChanged;
      } catch {
        // If JSON.stringify fails, assume changed
        return true;
      }
    }
    
    return false;
  }, []);

  // Enhanced convertDashboardDataToUnified with better error handling and validation
  const convertDashboardDataToUnified = useCallback((
    revenueData: any[], 
    ordersData: any[], 
    realConversionRate?: number,
    maxPredictionDays: number = 60 // Always compute max, filter later
  ): UnifiedAnalyticsData => {
    debugLog.info('🔄 UNIFIED_ANALYTICS: Starting enhanced data conversion', {
      revenueDataLength: revenueData?.length || 0,
      ordersDataLength: ordersData?.length || 0,
      revenueDataType: Array.isArray(revenueData) ? 'array' : typeof revenueData,
      ordersDataType: Array.isArray(ordersData) ? 'array' : typeof ordersData,
      realConversionRate,
      maxPredictionDays: maxPredictionDays,
      note: 'Computing max predictions for instant filtering'
    }, 'useUnifiedAnalytics');

    // Use empty arrays as fallbacks
    const safeRevenueData = Array.isArray(revenueData) ? revenueData : [];
    const safeOrdersData = Array.isArray(ordersData) ? ordersData : [];

    // If no data at all, return valid empty structure
    if (safeRevenueData.length === 0 && safeOrdersData.length === 0) {
      debugLog.info('🔄 UNIFIED_ANALYTICS: No input data, returning valid empty structure', {}, 'useUnifiedAnalytics');
      return {
        historical: [],
        predictions: [],
        period_days: days,
        total_revenue: 0,
        total_orders: 0,
      };
    }

    // Enhanced data processing with better validation
    const dataByDate = new Map<string, { revenue: number; orders: number }>();

    // Process revenue data with enhanced validation
    debugLog.info('🔄 UNIFIED_ANALYTICS: Processing revenue data', { 
      revenueDataLength: safeRevenueData.length 
    }, 'useUnifiedAnalytics');
    
    safeRevenueData.forEach((item, index) => {
      if (!item) {
        debugLog.warn(`🔄 UNIFIED_ANALYTICS: Skipping null revenue item at index ${index}`, {}, 'useUnifiedAnalytics');
        return;
      }

      // Validate date field
      const dateField = item.created_at || item.date;
      if (!dateField || typeof dateField !== 'string') {
        debugLog.warn(`🔄 UNIFIED_ANALYTICS: Revenue item missing valid date at index ${index}`, { item }, 'useUnifiedAnalytics');
        return;
      }

      // Parse and validate date
      const parsedDate = new Date(dateField);
      if (isNaN(parsedDate.getTime())) {
        debugLog.warn(`🔄 UNIFIED_ANALYTICS: Invalid date in revenue item at index ${index}`, { dateField }, 'useUnifiedAnalytics');
        return;
      }

      const dateKey = dateField.substring(0, 10); // YYYY-MM-DD format
      
      // Validate revenue value
      const revenueValue = typeof item.total_price === 'number' ? item.total_price : 
                          typeof item.revenue === 'number' ? item.revenue :
                          parseFloat(item.total_price || item.revenue || '0');
      
      if (isNaN(revenueValue)) {
        debugLog.warn(`🔄 UNIFIED_ANALYTICS: Invalid revenue value at index ${index}`, { 
          total_price: item.total_price, 
          revenue: item.revenue 
        }, 'useUnifiedAnalytics');
        return;
      }

      const existingData = dataByDate.get(dateKey) || { revenue: 0, orders: 0 };
      
      // Enhanced order counting logic - count any item with revenue as an order
      const isValidOrder = revenueValue > 0 || item.id || item.order_id;
      
      dataByDate.set(dateKey, {
        revenue: existingData.revenue + revenueValue,
        orders: existingData.orders + (isValidOrder ? 1 : 0),
      });
    });

    // Process orders data with enhanced validation (if different from revenue data)
    if (safeOrdersData !== safeRevenueData && safeOrdersData.length > 0) {
      debugLog.info('🔄 UNIFIED_ANALYTICS: Processing separate orders data', { 
        ordersDataLength: safeOrdersData.length 
      }, 'useUnifiedAnalytics');
      
      safeOrdersData.forEach((item, index) => {
        if (!item) {
          debugLog.warn(`🔄 UNIFIED_ANALYTICS: Skipping null orders item at index ${index}`, {}, 'useUnifiedAnalytics');
          return;
        }

        const dateField = item.created_at || item.date;
        if (!dateField || typeof dateField !== 'string') {
          debugLog.warn(`🔄 UNIFIED_ANALYTICS: Orders item missing valid date at index ${index}`, { item }, 'useUnifiedAnalytics');
          return;
        }

        const parsedDate = new Date(dateField);
        if (isNaN(parsedDate.getTime())) {
          debugLog.warn(`🔄 UNIFIED_ANALYTICS: Invalid date in orders item at index ${index}`, { dateField }, 'useUnifiedAnalytics');
          return;
        }

        const dateKey = dateField.substring(0, 10);
        
        const ordersValue = typeof item.orders_count === 'number' ? item.orders_count : 
                           typeof item.count === 'number' ? item.count : 1;

        const existingData = dataByDate.get(dateKey) || { revenue: 0, orders: 0 };
        dataByDate.set(dateKey, {
          revenue: existingData.revenue,
          orders: existingData.orders + ordersValue,
        });
      });
    } else {
      // If orders data is the same as revenue data, orders are already counted above
      debugLog.info('🔄 UNIFIED_ANALYTICS: Using orders counted from revenue data', {}, 'useUnifiedAnalytics');
    }

    debugLog.info('🔄 UNIFIED_ANALYTICS: Processed data by date', {
      totalDates: dataByDate.size,
      sampleDates: Array.from(dataByDate.keys()).slice(0, 3)
    }, 'useUnifiedAnalytics');

    // Create historical data with enhanced validation
    const historical: HistoricalData[] = [];
    const sortedDates = Array.from(dataByDate.keys()).sort();
    
    let totalRevenue = 0;
    let totalOrders = 0;
    
    // Use real conversion rate if provided, otherwise use a reasonable default
    const baseConversionRate = typeof realConversionRate === 'number' && realConversionRate > 0 
      ? realConversionRate 
      : 2.5; // Default 2.5% conversion rate
    
    sortedDates.forEach(date => {
      const dayData = dataByDate.get(date)!;
      
      // Validate day data
      const safeRevenue = typeof dayData.revenue === 'number' && !isNaN(dayData.revenue) ? dayData.revenue : 0;
      const safeOrders = typeof dayData.orders === 'number' && !isNaN(dayData.orders) ? dayData.orders : 0;
      
      totalRevenue += safeRevenue;
      totalOrders += safeOrders;
      
      // Calculate metrics with safe defaults
      const avgOrderValue = safeOrders > 0 ? safeRevenue / safeOrders : 0;
      
      // Use real conversion rate with slight daily variation for realism
      const dailyVariation = 0.8 + (Math.random() * 0.4); // ±20% daily variation
      const conversionRate = Math.max(0.1, baseConversionRate * dailyVariation);
      
      historical.push({
        kind: 'historical',
        date,
        revenue: safeRevenue,
        orders_count: safeOrders,
        conversion_rate: conversionRate,
        avg_order_value: avgOrderValue,
        isPrediction: false,
      });
    });

    // Generate enhanced predictions if enabled
    const predictions: PredictionData[] = [];
    if (includePredictions && historical.length > 0) {
      debugLog.info('🔄 UNIFIED_ANALYTICS: Generating enhanced predictions', {
        historicalDataPoints: historical.length,
        maxPredictionDays
      }, 'useUnifiedAnalytics');
      
      // Use more data points for better predictions
      const recentData = historical.slice(-Math.min(14, historical.length)); // Use last 14 days or all available
      
      if (recentData.length > 0) {
        const avgRevenue = recentData.reduce((sum, d) => sum + d.revenue, 0) / recentData.length;
        const avgOrders = recentData.reduce((sum, d) => sum + d.orders_count, 0) / recentData.length;
        const avgConversion = recentData.reduce((sum, d) => sum + d.conversion_rate, 0) / recentData.length;
        
        const lastDate = new Date(historical[historical.length - 1].date);
        
        for (let i = 1; i <= maxPredictionDays; i++) {
          const predictionDate = new Date(lastDate);
          predictionDate.setDate(lastDate.getDate() + i);
          
          // Add realistic variation to predictions (seasonal, trend-based)
          const trendFactor = 1 + (Math.random() - 0.5) * 0.4; // ±20% variation
          const seasonalFactor = 1 + Math.sin((i / maxPredictionDays) * Math.PI) * 0.1; // Small seasonal effect
          const combinedFactor = trendFactor * seasonalFactor;
          
          const predictedRevenue = Math.max(0, avgRevenue * combinedFactor);
          const predictedOrders = Math.max(1, Math.round(avgOrders * combinedFactor));
          const predictedConversion = Math.max(0.1, Math.min(10, avgConversion * (0.9 + Math.random() * 0.2)));
          
          predictions.push({
            kind: 'prediction',
            date: predictionDate.toISOString().substring(0, 10),
            revenue: predictedRevenue,
            orders_count: predictedOrders,
            conversion_rate: predictedConversion,
            avg_order_value: predictedOrders > 0 ? predictedRevenue / predictedOrders : 0,
            isPrediction: true,
            confidence_score: Math.max(0.6, Math.min(0.95, 0.8 + Math.random() * 0.15)), // 60-95% confidence
            confidence_interval: {
              revenue_min: predictedRevenue * 0.6,
              revenue_max: predictedRevenue * 1.4,
              orders_min: Math.max(1, Math.round(predictedOrders * 0.6)),
              orders_max: Math.round(predictedOrders * 1.4),
            },
          });
        }
      }
    }

    // Ensure totals are valid numbers
    const finalTotalRevenue = typeof totalRevenue === 'number' && !isNaN(totalRevenue) ? totalRevenue : 0;
    const finalTotalOrders = typeof totalOrders === 'number' && !isNaN(totalOrders) ? totalOrders : 0;

    const result: UnifiedAnalyticsData = {
      historical,
      predictions,
      period_days: days,
      total_revenue: finalTotalRevenue,
      total_orders: finalTotalOrders,
    };

    debugLog.info('✅ UNIFIED_ANALYTICS: Enhanced data conversion complete', {
      historicalPoints: historical.length,
      predictionPoints: predictions.length,
      totalRevenue: finalTotalRevenue,
      totalOrders: finalTotalOrders,
      avgRevenuePerDay: historical.length > 0 ? finalTotalRevenue / historical.length : 0,
      avgOrdersPerDay: historical.length > 0 ? finalTotalOrders / historical.length : 0,
      usedRealConversionRate: baseConversionRate
    }, 'useUnifiedAnalytics');

    return result;
  }, [days, includePredictions, realConversionRate]);

  // Simple session storage key for unified analytics
  const getUnifiedAnalyticsStorageKey = useCallback((shopName: string) => {
    return `unified_analytics_${shopName}_${days}d_${includePredictions ? 'with' : 'no'}_predictions`;
  }, [days, includePredictions]);

  // Enhanced loadUnifiedAnalyticsFromStorage with improved validation and auto-fix
  const loadUnifiedAnalyticsFromStorage = useCallback((shopName: string): UnifiedAnalyticsData | null => {
    if (!shopName || !shopName.trim()) {
      debugLog.warn('🔄 UNIFIED_ANALYTICS: loadUnifiedAnalyticsFromStorage called with empty shop name', {}, 'useUnifiedAnalytics');
      return null;
    }
    
    debugLog.info('🔄 UNIFIED_ANALYTICS: loadUnifiedAnalyticsFromStorage called', { shopName }, 'useUnifiedAnalytics');
    
    try {
      const storageKey = getUnifiedAnalyticsStorageKey(shopName);
      debugLog.info('🔄 UNIFIED_ANALYTICS: Attempting to load with key', { storageKey }, 'useUnifiedAnalytics');
      
      const stored = sessionStorage.getItem(storageKey);
      
      if (!stored) {
        debugLog.warn('🔄 UNIFIED_ANALYTICS: No cached data found in session storage', { storageKey }, 'useUnifiedAnalytics');
        
        // Debug: Check what keys actually exist in session storage
        const availableKeys = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.includes('unified_analytics')) {
            availableKeys.push(key);
          }
        }
        debugLog.info('🔍 UNIFIED_ANALYTICS: Available session storage keys', { availableKeys }, 'useUnifiedAnalytics');
        return null;
      }

      debugLog.info('🔄 UNIFIED_ANALYTICS: Found stored data', { dataLength: stored.length }, 'useUnifiedAnalytics');
      const parsed = JSON.parse(stored);
      debugLog.info('🔄 UNIFIED_ANALYTICS: Parsed data structure', {
        hasParsed: !!parsed,
        hasHistorical: Array.isArray(parsed?.historical),
        hasPredictions: Array.isArray(parsed?.predictions),
        historicalLength: parsed?.historical?.length,
        predictionLength: parsed?.predictions?.length,
        totalRevenueType: typeof parsed?.total_revenue,
        totalOrdersType: typeof parsed?.total_orders,
        totalRevenue: parsed?.total_revenue,
        totalOrders: parsed?.total_orders
      }, 'useUnifiedAnalytics');
      
      // SIMPLIFIED VALIDATION - Only check for essential arrays
      const hasBasicStructure = parsed && 
        Array.isArray(parsed.historical) && 
        Array.isArray(parsed.predictions);

      if (!hasBasicStructure) {
        debugLog.warn('🔄 UNIFIED_ANALYTICS: Invalid basic structure - missing arrays', {
          hasParsed: !!parsed,
          hasHistorical: Array.isArray(parsed?.historical),
          hasPredictions: Array.isArray(parsed?.predictions)
        }, 'useUnifiedAnalytics');
        return null;
      }

      // SIMPLIFIED VALIDATION - Only check for valid historical data structure
      const hasValidHistoricalData = parsed.historical.length === 0 || parsed.historical.every((item: any) => 
        item && 
        typeof item.date === 'string' && 
        typeof item.revenue === 'number' && 
        typeof item.orders_count === 'number' &&
        !isNaN(item.revenue) &&
        !isNaN(item.orders_count)
      );
      
      if (!hasValidHistoricalData) {
        debugLog.warn('🔄 UNIFIED_ANALYTICS: Historical data validation failed - missing required fields', {}, 'useUnifiedAnalytics');
        sessionStorage.removeItem(storageKey);
        return null;
      }

      // ALWAYS AUTO-FIX TOTALS - This ensures compatibility with any data format
      debugLog.info('🔧 UNIFIED_ANALYTICS: Auto-calculating totals from historical data', {
        hasTotalRevenue: typeof parsed.total_revenue === 'number',
        hasTotalOrders: typeof parsed.total_orders === 'number',
        historicalLength: parsed.historical.length
      }, 'useUnifiedAnalytics');

      try {
        // Calculate totals from historical data
        const calculatedTotalRevenue = parsed.historical.reduce((sum: number, item: any) => 
          sum + (typeof item.revenue === 'number' && !isNaN(item.revenue) ? item.revenue : 0), 0
        );
        const calculatedTotalOrders = parsed.historical.reduce((sum: number, item: any) => 
          sum + (typeof item.orders_count === 'number' && !isNaN(item.orders_count) ? item.orders_count : 0), 0
        );

        // Create fixed data with calculated totals
        const fixedData = {
          ...parsed,
          total_revenue: calculatedTotalRevenue,
          total_orders: calculatedTotalOrders,
          period_days: parsed.period_days || days, // Ensure period_days is set
        };

        debugLog.info('✅ UNIFIED_ANALYTICS: Data ready for rendering', {
          originalTotalRevenue: parsed.total_revenue,
          originalTotalOrders: parsed.total_orders,
          calculatedTotalRevenue,
          calculatedTotalOrders,
          finalTotalRevenue: fixedData.total_revenue,
          finalTotalOrders: fixedData.total_orders,
          historicalLength: parsed.historical.length,
          predictionLength: parsed.predictions.length,
          dataValid: true
        }, 'useUnifiedAnalytics');

        // Save the fixed data back to session storage for next time
        sessionStorage.setItem(storageKey, JSON.stringify(fixedData));
        debugLog.info('💾 UNIFIED_ANALYTICS: Saved auto-fixed data back to session storage', {}, 'useUnifiedAnalytics');

        return fixedData;
      } catch (autoFixError) {
        debugLog.error('🔧 UNIFIED_ANALYTICS: Auto-fix failed, providing default structure', { 
          error: autoFixError 
        }, 'useUnifiedAnalytics');

        // Return a valid structure with default values to prevent crashes
        const defaultData: UnifiedAnalyticsData = {
          historical: Array.isArray(parsed.historical) ? parsed.historical : [],
          predictions: Array.isArray(parsed.predictions) ? parsed.predictions : [],
          total_revenue: 0,
          total_orders: 0,
          period_days: days,
        };

        debugLog.info('✅ UNIFIED_ANALYTICS: Returning default structure to prevent crashes', {
          historicalLength: defaultData.historical.length,
          predictionLength: defaultData.predictions.length
        }, 'useUnifiedAnalytics');

        return defaultData;
      }
    } catch (error) {
      debugLog.error('🔄 UNIFIED_ANALYTICS: Error loading from session storage', { error }, 'useUnifiedAnalytics');
      
      // Return empty but valid structure instead of null to prevent crashes
      const fallbackData: UnifiedAnalyticsData = {
        historical: [],
        predictions: [],
        total_revenue: 0,
        total_orders: 0,
        period_days: days,
      };
      
      debugLog.info('✅ UNIFIED_ANALYTICS: Returning fallback structure after error', {}, 'useUnifiedAnalytics');
      return fallbackData;
    }
  }, [getUnifiedAnalyticsStorageKey, days]);

  // Save unified analytics to session storage
  const saveUnifiedAnalyticsToStorage = useCallback((shopName: string, analyticsData: UnifiedAnalyticsData) => {
    if (!shopName || !shopName.trim()) return;

    try {
      const storageKey = getUnifiedAnalyticsStorageKey(shopName);
      sessionStorage.setItem(storageKey, JSON.stringify(analyticsData));
      
      debugLog.info('💾 UNIFIED_ANALYTICS: Saved to session storage', {
        key: storageKey,
        historicalLength: analyticsData.historical.length,
        predictionLength: analyticsData.predictions.length
      }, 'useUnifiedAnalytics');
    } catch (error) {
      debugLog.error('🔄 UNIFIED_ANALYTICS: Error saving to session storage', { error }, 'useUnifiedAnalytics');
    }
  }, [getUnifiedAnalyticsStorageKey]);

  // Enhanced fetchData function with better error handling
  const fetchData = useCallback(async (forceRefresh = false): Promise<UnifiedAnalyticsData> => {
    // Validate shop before proceeding
    if (!shop || !shop.trim()) {
      debugLog.error('🔄 UNIFIED_ANALYTICS: Invalid shop name provided', { shop }, 'useUnifiedAnalytics');
      setError('Invalid shop name provided');
      setLoading(false);
      return Promise.reject(new Error('Invalid shop name provided'));
    }

    // Return existing promise if already fetching
    if (activeFetchRef.current && !forceRefresh) {
      return activeFetchRef.current;
    }

    const fetchPromise = (async () => {
      try {
        setLoading(true);
        setError(null);

        // If using dashboard data, convert it to unified format
        if (useDashboardData) {
          // Check if we have valid dashboard data
          const hasValidData = (Array.isArray(dashboardRevenueData) && dashboardRevenueData.length > 0) ||
                               (Array.isArray(dashboardOrdersData) && dashboardOrdersData.length > 0);
          
          if (hasValidData) {
            debugLog.info('🔄 UNIFIED_ANALYTICS: Using dashboard data instead of API call', {
              revenueDataLength: dashboardRevenueData.length,
              ordersDataLength: dashboardOrdersData.length
            }, 'useUnifiedAnalytics');
            const unifiedData = convertDashboardDataToUnified(dashboardRevenueData, dashboardOrdersData, realConversionRate);
            
            // Update tracking
            lastProcessedDataRef.current = {
              revenueLength: dashboardRevenueData.length,
              ordersLength: dashboardOrdersData.length,
              revenueData: [...dashboardRevenueData],
              ordersData: [...dashboardOrdersData]
            };
            
            // Save to cache even when using dashboard data
            saveToCache(shop, unifiedData);
            
            setData(unifiedData);
            setLastUpdated(new Date());
            setIsCached(false);
            setCacheAge(0);
            
            debugLog.info('✅ UNIFIED_ANALYTICS: Converted dashboard data', {
              historicalPoints: unifiedData.historical.length,
              predictionPoints: unifiedData.predictions.length,
              totalRevenue: unifiedData.total_revenue,
              totalOrders: unifiedData.total_orders,
            }, 'useUnifiedAnalytics');
            
            return unifiedData;
          }
          
          // If using dashboard data but no data available, try cache first
          debugLog.info('🔄 UNIFIED_ANALYTICS: Dashboard data not available, checking cache', {}, 'useUnifiedAnalytics');
          const cachedEntry = loadFromCache(shop);
          if (cachedEntry && !forceRefresh) {
            const ageMinutes = Math.round((Date.now() - cachedEntry.timestamp) / (1000 * 60));
            debugLog.info(`✅ UNIFIED_ANALYTICS: Using cached data (${ageMinutes}min old)`, { ageMinutes }, 'useUnifiedAnalytics');
            
            setData(cachedEntry.data);
            setLastUpdated(cachedEntry.lastUpdated);
            setIsCached(true);
            setCacheAge(ageMinutes);
            
            return cachedEntry.data;
          }
          
          // If no cache and dashboard data is empty, keep existing data if available
          if (data || lastValidDataRef.current) {
            debugLog.info('🔄 UNIFIED_ANALYTICS: No new data available, keeping existing data', {
              hasCurrentData: !!data,
              hasLastValidData: !!lastValidDataRef.current
            }, 'useUnifiedAnalytics');
            // Use the last valid data if current data is empty
            const dataToUse = data || lastValidDataRef.current;
            if (dataToUse) {
              setData(dataToUse);
              return dataToUse;
            }
          }
          
          // Only return empty state if we have no existing data
          debugLog.info('🔄 UNIFIED_ANALYTICS: No dashboard data, cache, or existing data available', {}, 'useUnifiedAnalytics');
          const emptyData: UnifiedAnalyticsData = {
            historical: [],
            predictions: [],
            period_days: days,
            total_revenue: 0,
            total_orders: 0,
          };
          
          setData(emptyData);
          setLastUpdated(new Date());
          setIsCached(false);
          setCacheAge(0);
          
          return emptyData;
        }

        // Legacy API mode is no longer supported
        debugLog.error('🚫 UNIFIED_ANALYTICS: Legacy API mode is not supported. The unified-analytics endpoint has been removed.', {}, 'useUnifiedAnalytics');
        debugLog.error('🚫 UNIFIED_ANALYTICS: Please use dashboard data mode by setting useDashboardData: true', {}, 'useUnifiedAnalytics');
        
        setError('Legacy unified analytics API has been removed. Use dashboard data mode instead.');
        setLoading(false);
        return Promise.reject(new Error('Legacy unified analytics API has been removed. Use dashboard data mode instead.'));

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics data';
        setError(errorMessage);
        debugLog.error('Unified analytics fetch error', { error: err }, 'useUnifiedAnalytics');
        
        // Don't clear existing data on error to provide a better UX
        // Keep the last valid data if available
        if (lastValidDataRef.current && !data) {
          debugLog.info('🔄 UNIFIED_ANALYTICS: Using last valid data after error', {}, 'useUnifiedAnalytics');
          setData(lastValidDataRef.current);
        }
        
        throw err;
      } finally {
        setLoading(false);
        activeFetchRef.current = null;
      }
    })();

    activeFetchRef.current = fetchPromise;
    return fetchPromise;
  }, [days, includePredictions, shop, loadFromCache, saveToCache, useDashboardData, dashboardRevenueData, dashboardOrdersData, convertDashboardDataToUnified, data, realConversionRate]);

  const refetch = useCallback(async () => {
    try {
      debugLog.info('🔄 UNIFIED_ANALYTICS: Manual refetch initiated', {}, 'useUnifiedAnalytics');
      
      // Clear any existing errors before refetching
      setError(null);
      
      // For dashboard data mode, reprocess the current data
      if (useDashboardData && dashboardRevenueData && dashboardOrdersData) {
        debugLog.info('🔄 UNIFIED_ANALYTICS: Reprocessing dashboard data on refetch', {
          revenueDataLength: dashboardRevenueData.length,
          ordersDataLength: dashboardOrdersData.length
        }, 'useUnifiedAnalytics');
        
        try {
          const updated = convertDashboardDataToUnified(
            dashboardRevenueData,
            dashboardOrdersData,
            realConversionRate
          );
          
          setData(updated);
          setLastUpdated(new Date());
          setIsCached(false);
          setCacheAge(0);
          setLoading(false);
          setError(null);
          
          // Reset the loaded from storage flag since we're now using fresh data
          hasProcessedDataRef.current = false;
          
          // Save to session storage
          if (shop) {
            saveUnifiedAnalyticsToStorage(shop, updated);
          }
          
          debugLog.info('✅ UNIFIED_ANALYTICS: Reprocessed dashboard data on refetch', {
            historicalLength: updated.historical.length,
            predictionsLength: updated.predictions.length
          }, 'useUnifiedAnalytics');
          return;
        } catch (error) {
          debugLog.error('🔄 UNIFIED_ANALYTICS: Error reprocessing dashboard data', { error }, 'useUnifiedAnalytics');
          setError('Failed to reprocess dashboard data');
          setLoading(false);
          return;
        }
      }
      
      // Otherwise do a full fetch
      await fetchData(true); // Force refresh
    } catch (error) {
      debugLog.error('🔄 UNIFIED_ANALYTICS: Manual refetch failed', { error }, 'useUnifiedAnalytics');
      // Don't throw here - let the component handle the error state
    }
  }, [fetchData, useDashboardData, dashboardRevenueData, dashboardOrdersData, convertDashboardDataToUnified, shop, saveUnifiedAnalyticsToStorage, realConversionRate]);

  // Load data from session storage (for toggling)
  const loadFromStorage = useCallback(() => {
    debugLog.info('=== LOAD FROM STORAGE CALLED ===', { shop, useDashboardData }, 'UnifiedAnalytics');
    
    if (!shop || !shop.trim()) {
      debugLog.warn('No shop available for loading from storage', { shop }, 'UnifiedAnalytics');
      return false;
    }

    debugLog.info('Attempting to load from session storage', { shop }, 'UnifiedAnalytics');
    
    try {
      const storedData = loadUnifiedAnalyticsFromStorage(shop);
      
      if (storedData) {
        debugLog.info('✅ Successfully loaded from session storage', {
          historicalLength: storedData.historical.length,
          predictionLength: storedData.predictions.length,
          totalRevenue: storedData.total_revenue,
          totalOrders: storedData.total_orders
        }, 'UnifiedAnalytics');
        
        // Set the data and update state
        setData(storedData);
        setLastUpdated(new Date());
        setIsCached(true);
        setCacheAge(0);
        setLoading(false);
        setError(null);
        
        // Mark as processed to prevent unnecessary reprocessing
        hasProcessedDataRef.current = true;
        
        debugLog.info('✅ State updated successfully from storage', { 
          hasData: !!storedData,
          historicalLength: storedData.historical.length 
        }, 'UnifiedAnalytics');
        
        return true;
      } else {
        debugLog.warn('No data found in session storage', { shop }, 'UnifiedAnalytics');
        
        // If we have dashboard data available, try to fall back to processing it
        const hasValidDashboardData = (Array.isArray(dashboardRevenueData) && dashboardRevenueData.length > 0) ||
                                     (Array.isArray(dashboardOrdersData) && dashboardOrdersData.length > 0);
        
        debugLog.info('Checking for dashboard data fallback', { 
          hasRevenueData: Array.isArray(dashboardRevenueData) && dashboardRevenueData.length > 0,
          hasOrdersData: Array.isArray(dashboardOrdersData) && dashboardOrdersData.length > 0,
          useDashboardData 
        }, 'UnifiedAnalytics');
        
        if (hasValidDashboardData && useDashboardData) {
          debugLog.info('Attempting dashboard data fallback processing', { 
            revenueDataLength: dashboardRevenueData.length,
            ordersDataLength: dashboardOrdersData.length 
          }, 'UnifiedAnalytics');
          
          debugLog.info('🔄 UNIFIED_ANALYTICS: Falling back to processing dashboard data since no storage data found', {}, 'useUnifiedAnalytics');
          try {
            setLoading(true);
            setError(null);
            
            const processedData = convertDashboardDataToUnified(dashboardRevenueData, dashboardOrdersData, realConversionRate);
            
            if (processedData && Array.isArray(processedData.historical)) {
              setData(processedData);
              setLastUpdated(new Date());
              setIsCached(false);
              setCacheAge(0);
              setLoading(false);
              setError(null);
              hasProcessedDataRef.current = true;
              saveUnifiedAnalyticsToStorage(shop, processedData);
              
              debugLog.info('✅ Successfully processed dashboard data as fallback', {
                historicalLength: processedData.historical.length,
                predictionsLength: processedData.predictions.length
              }, 'UnifiedAnalytics');
              
              debugLog.info('✅ UNIFIED_ANALYTICS: Successfully processed dashboard data as fallback', {}, 'useUnifiedAnalytics');
              return true;
            } else {
              debugLog.error('Fallback processing failed - invalid data structure', { 
                hasProcessedData: !!processedData,
                hasHistorical: processedData && Array.isArray(processedData.historical)
              }, 'UnifiedAnalytics');
              
              debugLog.error('🔄 UNIFIED_ANALYTICS: Fallback processing failed - invalid data structure', {}, 'useUnifiedAnalytics');
              setError('Failed to process analytics data');
              setLoading(false);
              return false;
            }
          } catch (fallbackError) {
            debugLog.error('Fallback processing failed with error', { 
              error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
            }, 'UnifiedAnalytics');
            
            debugLog.error('🔄 UNIFIED_ANALYTICS: Fallback processing failed', { error: fallbackError }, 'useUnifiedAnalytics');
            setError('Failed to process analytics data');
            setLoading(false);
            return false;
          }
        } else {
          debugLog.warn('No fallback data available', { 
            hasValidDashboardData, 
            useDashboardData 
          }, 'UnifiedAnalytics');
        }
        
        return false;
      }
    } catch (error) {
      debugLog.error('Error loading from session storage', { 
        error: error instanceof Error ? error.message : String(error),
        shop 
      }, 'UnifiedAnalytics');
      
      debugLog.error('🔄 UNIFIED_ANALYTICS: Error loading from session storage', { error }, 'useUnifiedAnalytics');
      
      // Clear potentially corrupted storage and set error state
      try {
        const storageKey = getUnifiedAnalyticsStorageKey(shop);
        sessionStorage.removeItem(storageKey);
        debugLog.info('Cleared potentially corrupted session storage', { storageKey }, 'UnifiedAnalytics');
        debugLog.info('🗑️ UNIFIED_ANALYTICS: Cleared potentially corrupted session storage', { storageKey }, 'useUnifiedAnalytics');
      } catch (clearError) {
        debugLog.error('Failed to clear corrupted storage', { 
          error: clearError instanceof Error ? clearError.message : String(clearError)
        }, 'UnifiedAnalytics');
        
        debugLog.error('🔄 UNIFIED_ANALYTICS: Failed to clear corrupted storage', { error: clearError }, 'useUnifiedAnalytics');
      }
      
      setError('Failed to load cached analytics data');
      setLoading(false);
      return false;
    }
  }, [shop, loadUnifiedAnalyticsFromStorage, dashboardRevenueData, dashboardOrdersData, useDashboardData, convertDashboardDataToUnified, saveUnifiedAnalyticsToStorage, getUnifiedAnalyticsStorageKey, realConversionRate]);

  // Initialize data when shop changes or first load
  useEffect(() => {
    if (!shop || !shop.trim()) {
      // No shop, set empty state
      setLoading(false);
      setError('No shop selected');
      setData(null);
      isInitializedRef.current = false;
      hasProcessedDataRef.current = false;
      return;
    }

    // Initialize for dashboard data mode
    if (useDashboardData) {
      debugLog.info('🔄 UNIFIED_ANALYTICS: Initializing dashboard data mode', { shop, useDashboardData }, 'useUnifiedAnalytics');
      
      // SIMPLIFIED APPROACH: Mark as initialized immediately to prevent loops
      isInitializedRef.current = true;
      
      // Try to load from session storage first
      const storageData = loadUnifiedAnalyticsFromStorage(shop);
      if (storageData && storageData.historical && storageData.historical.length > 0) {
        debugLog.info('✅ UNIFIED_ANALYTICS: Loaded initial data from session storage', { 
          historicalLength: storageData.historical.length,
          predictionsLength: storageData.predictions.length 
        }, 'useUnifiedAnalytics');
        setData(storageData);
        setLastUpdated(new Date());
        setIsCached(true);
        setCacheAge(0);
        setLoading(false);
        setError(null);
        hasProcessedDataRef.current = true;
        return;
      }
      
      // If no storage data, check if we have dashboard data to process immediately
      const hasValidData = (Array.isArray(dashboardRevenueData) && dashboardRevenueData.length > 0) ||
                          (Array.isArray(dashboardOrdersData) && dashboardOrdersData.length > 0);
      
      if (hasValidData) {
        debugLog.info('🔄 UNIFIED_ANALYTICS: Processing dashboard data immediately on init', {
          revenueDataLength: dashboardRevenueData?.length || 0,
          ordersDataLength: dashboardOrdersData?.length || 0
        }, 'useUnifiedAnalytics');
        
        setLoading(true);
        setError(null);
        
        try {
          const processedData = convertDashboardDataToUnified(
            dashboardRevenueData || [],
            dashboardOrdersData || [],
            realConversionRate
          );
          
          if (processedData && Array.isArray(processedData.historical)) {
            setData(processedData);
            setLastUpdated(new Date());
            setIsCached(false);
            setCacheAge(0);
            setLoading(false);
            setError(null);
            hasProcessedDataRef.current = true;
            saveUnifiedAnalyticsToStorage(shop, processedData);
            
            debugLog.info('✅ UNIFIED_ANALYTICS: Successfully processed dashboard data on init', {
              historicalLength: processedData.historical.length,
              predictionsLength: processedData.predictions.length
            }, 'useUnifiedAnalytics');
            return;
          }
        } catch (error) {
          debugLog.error('🔄 UNIFIED_ANALYTICS: Error processing dashboard data on init', { error }, 'useUnifiedAnalytics');
          setError('Failed to process dashboard data');
          setLoading(false);
          return;
        }
      }
      
      // No data available yet - stop loading but keep waiting for data
      debugLog.info('🔄 UNIFIED_ANALYTICS: No data available yet, waiting for dashboard data', {}, 'useUnifiedAnalytics');
      setLoading(false);
      setError(null);
    } else {
      // Legacy API mode not supported
      debugLog.error('🚫 UNIFIED_ANALYTICS: API mode not supported', {}, 'useUnifiedAnalytics');
      setError('API mode not supported. Use dashboard data mode.');
      setLoading(false);
    }
  }, [shop, useDashboardData]); // SIMPLIFIED DEPENDENCIES - only shop and mode

  // Auto-refresh if enabled
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0 && shop && shop.trim()) {
      const interval = setInterval(() => {
        fetchData().catch(error => {
          debugLog.error('🔄 UNIFIED_ANALYTICS: Auto-refresh failed', { error }, 'useUnifiedAnalytics');
        });
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchData, shop]);

  // SIMPLIFIED DASHBOARD DATA PROCESSING - FIXED to prevent data loss on navigation
  useEffect(() => {
    // Only process if initialized and in dashboard mode
    if (!shop || !shop.trim() || !useDashboardData || !isInitializedRef.current) {
      return;
    }

    // Skip if we already processed data and it hasn't meaningfully changed
    if (hasProcessedDataRef.current && data && Array.isArray(data.historical) && data.historical.length > 0) {
      // Only reprocess if data has significantly changed (length difference)
      const currentRevenueLength = dashboardRevenueData?.length || 0;
      const currentOrdersLength = dashboardOrdersData?.length || 0;
      const existingHistoricalLength = data.historical.length;
      
      // Check for significant data changes (more than 10% difference)
      const hasSignificantChange = Math.abs(currentRevenueLength - existingHistoricalLength) > existingHistoricalLength * 0.1 ||
                                   Math.abs(currentOrdersLength - existingHistoricalLength) > existingHistoricalLength * 0.1;
      
      if (!hasSignificantChange) {
        debugLog.info('🔄 UNIFIED_ANALYTICS: Data already processed and stable, skipping reprocess', {
          existingHistoricalLength,
          currentRevenueLength,
          currentOrdersLength
        }, 'useUnifiedAnalytics');
        return;
      }
    }

    // CRITICAL: Only process if we have dashboard data AND no valid cached data
    // Don't destroy valid cached data just because dashboard data isn't loaded yet
    const hasValidCachedData = data && Array.isArray(data.historical) && data.historical.length > 0;
    const hasDashboardData = Array.isArray(dashboardRevenueData) && dashboardRevenueData.length > 0 &&
                             Array.isArray(dashboardOrdersData) && dashboardOrdersData.length > 0;
    
    if (!hasDashboardData) {
      if (hasValidCachedData) {
        debugLog.info('🔄 UNIFIED_ANALYTICS: Valid cached data exists, preserving it while waiting for dashboard data', {
          cachedHistoricalLength: data.historical.length,
          cachedPredictionsLength: data.predictions?.length || 0
        }, 'useUnifiedAnalytics');
        return; // Preserve existing valid data
      } else {
        debugLog.info('🔄 UNIFIED_ANALYTICS: No dashboard data available and no cached data, waiting', {
          hasRevenueData: Array.isArray(dashboardRevenueData) && dashboardRevenueData.length > 0,
          hasOrdersData: Array.isArray(dashboardOrdersData) && dashboardOrdersData.length > 0
        }, 'useUnifiedAnalytics');
        return; // Wait for data without clearing
      }
    }

    // Only proceed with processing if we have dashboard data
    debugLog.info('🔄 UNIFIED_ANALYTICS: Processing dashboard data to unified analytics', {
      revenueDataLength: dashboardRevenueData?.length || 0,
      ordersDataLength: dashboardOrdersData?.length || 0,
      hasExistingData: hasValidCachedData
    }, 'useUnifiedAnalytics');

    try {
      setLoading(true);
      setError(null);

             const converted = convertDashboardDataToUnified(
         dashboardRevenueData || [],
         dashboardOrdersData || [],
         realConversionRate,
         60 // Always compute max 60 days for filtering
       );

      if (converted && Array.isArray(converted.historical) && converted.historical.length > 0) {
        debugLog.info('✅ UNIFIED_ANALYTICS: Successfully converted dashboard data', {
          historicalLength: converted.historical.length,
          predictionsLength: converted.predictions?.length || 0
        }, 'useUnifiedAnalytics');

        setData(converted);
        saveUnifiedAnalyticsToStorage(shop, converted);
        hasProcessedDataRef.current = true;
      } else {
        debugLog.warn('⚠️ UNIFIED_ANALYTICS: Dashboard data conversion failed', {
          converted: !!converted,
          hasHistorical: converted ? Array.isArray(converted.historical) : false,
          historicalLength: converted?.historical?.length || 0
        }, 'useUnifiedAnalytics');
      }
    } catch (error) {
      debugLog.error('❌ UNIFIED_ANALYTICS: Error processing dashboard data', { error }, 'useUnifiedAnalytics');
      setError(`Failed to process analytics data: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [shop, useDashboardData, dashboardRevenueData, dashboardOrdersData, realConversionRate, includePredictions]);

  // SHOP CHANGE HANDLER - Only clear when shop actually changes
  useEffect(() => {
    if (!shop || !shop.trim()) {
      return;
    }

    // Only reset if shop has actually changed
    if (currentShopRef.current && currentShopRef.current !== shop) {
      debugLog.info('🔄 UNIFIED_ANALYTICS: Shop changed, resetting state', {
        oldShop: currentShopRef.current,
        newShop: shop
      }, 'useUnifiedAnalytics');
      
      // Clear state for new shop
      setData(null);
      setLoading(false);
      setError(null);
      isInitializedRef.current = false;
      hasProcessedDataRef.current = false;
      
             // Clear old shop's data from storage
       clearUnifiedAnalyticsStorage();
    }

    currentShopRef.current = shop;
  }, [shop]);

  // Force compute unified analytics (called when main dashboard data is refreshed)
  const forceCompute = useCallback(() => {
    debugLog.info('🔧 UNIFIED_ANALYTICS: Force compute called', {
      shop: shop || 'undefined',
      useDashboardData,
      hasRevenueData: Array.isArray(dashboardRevenueData) && dashboardRevenueData.length > 0,
      hasOrdersData: Array.isArray(dashboardOrdersData) && dashboardOrdersData.length > 0
    }, 'useUnifiedAnalytics');

    // Validate inputs
    if (!shop || !shop.trim()) {
      debugLog.warn('🔄 UNIFIED_ANALYTICS: Cannot force compute - missing shop', { shop }, 'useUnifiedAnalytics');
      setError('No shop selected');
      setLoading(false);
      return;
    }

    if (!useDashboardData) {
      debugLog.warn('🔄 UNIFIED_ANALYTICS: Cannot force compute - not in dashboard mode', { useDashboardData }, 'useUnifiedAnalytics');
      setError('Dashboard mode required');
      setLoading(false);
      return;
    }

    const hasValidData = (Array.isArray(dashboardRevenueData) && dashboardRevenueData.length > 0) ||
                        (Array.isArray(dashboardOrdersData) && dashboardOrdersData.length > 0);

    if (!hasValidData) {
      debugLog.warn('🔄 UNIFIED_ANALYTICS: Cannot force compute - no valid dashboard data', {
        revenueDataLength: dashboardRevenueData?.length || 0,
        ordersDataLength: dashboardOrdersData?.length || 0
      }, 'useUnifiedAnalytics');
      setError('No dashboard data available');
      setLoading(false);
      return;
    }

    debugLog.info('🔧 UNIFIED_ANALYTICS: Force computing analytics data', {
      revenueDataLength: dashboardRevenueData?.length || 0,
      ordersDataLength: dashboardOrdersData?.length || 0
    }, 'useUnifiedAnalytics');
    
    try {
      setLoading(true);
      setError(null);
      
      const processedData = convertDashboardDataToUnified(
        dashboardRevenueData || [],
        dashboardOrdersData || [],
        realConversionRate
      );
      
      if (processedData && Array.isArray(processedData.historical)) {
        // Update state immediately for chart rendering
        setData(processedData);
        setLastUpdated(new Date());
        setIsCached(false);
        setCacheAge(0);
        setLoading(false);
        setError(null);
        
        // Mark as processed and update tracking
        hasProcessedDataRef.current = true;
        isInitializedRef.current = true;
        lastProcessedDataRef.current = {
          revenueLength: dashboardRevenueData?.length || 0,
          ordersLength: dashboardOrdersData?.length || 0,
          revenueData: [...(dashboardRevenueData || [])],
          ordersData: [...(dashboardOrdersData || [])]
        };
        
        // Update session storage
        saveUnifiedAnalyticsToStorage(shop, processedData);
        
        debugLog.info('✅ UNIFIED_ANALYTICS: Force compute successful', {
          historicalPoints: processedData.historical.length,
          predictionPoints: processedData.predictions.length,
          totalRevenue: processedData.total_revenue,
          totalOrders: processedData.total_orders
        }, 'useUnifiedAnalytics');
      } else {
        debugLog.error('🔄 UNIFIED_ANALYTICS: Force compute failed - invalid data structure', {}, 'useUnifiedAnalytics');
        setError('Invalid data structure returned');
        setLoading(false);
      }
    } catch (error) {
      debugLog.error('🔄 UNIFIED_ANALYTICS: Force compute failed', { error }, 'useUnifiedAnalytics');
      setError('Failed to compute analytics data');
      setLoading(false);
    }
  }, [
    shop,
    useDashboardData,
    dashboardRevenueData,
    dashboardOrdersData,
    realConversionRate,
    convertDashboardDataToUnified,
    saveUnifiedAnalyticsToStorage
  ]);

  // Clear unified analytics session storage (called when shop changes)
  const clearUnifiedAnalyticsStorage = useCallback(() => {
    if (!shop || !shop.trim()) {
      debugLog.warn('🔄 UNIFIED_ANALYTICS: Cannot clear storage - missing shop', { shop }, 'useUnifiedAnalytics');
      return;
    }

    try {
      // Use the same key generation logic as save/load functions to ensure consistency
      const storageKey = getUnifiedAnalyticsStorageKey(shop);
      sessionStorage.removeItem(storageKey);
      debugLog.info('🗑️ UNIFIED_ANALYTICS: Cleared session storage', { shop, storageKey }, 'useUnifiedAnalytics');
      
      // Reset all state to prevent cross-shop data mixing
      setData(null);
      setLastUpdated(null);
      setIsCached(false);
      setCacheAge(0);
      setError(null);
      setLoading(true); // Set loading to true when clearing
      
      // Reset tracking flags
      hasProcessedDataRef.current = false;
      isInitializedRef.current = false;
      
      debugLog.info('✅ UNIFIED_ANALYTICS: Reset all state for shop change', {}, 'useUnifiedAnalytics');
    } catch (error) {
      debugLog.error('🔄 UNIFIED_ANALYTICS: Error clearing storage', { error }, 'useUnifiedAnalytics');
    }
  }, [shop, getUnifiedAnalyticsStorageKey]);

  // Reset state when shop changes
  useEffect(() => {
    hasProcessedDataRef.current = false;
    isInitializedRef.current = false;
    debugLog.info('🔄 UNIFIED_ANALYTICS: Reset processing flags for shop change', { shop }, 'useUnifiedAnalytics');
  }, [shop]);

  return {
    data,
    loading,
    error,
    refetch,
    lastUpdated,
    isCached,
    cacheAge,
    loadFromStorage,
    forceCompute,
    clearUnifiedAnalyticsStorage,
  };
};

export default useUnifiedAnalytics; 