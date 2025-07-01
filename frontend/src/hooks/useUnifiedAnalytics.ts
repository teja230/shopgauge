import { useState, useEffect, useCallback, useRef } from 'react';
import { getCacheKey, CACHE_VERSION } from '../utils/cacheUtils';
import { fetchWithAuth } from '../api';

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
  confidence_interval: {
    revenue_min: number;
    revenue_max: number;
    orders_min: number;
    orders_max: number;
  };
  prediction_type: string;
  confidence_score: number;
  isPrediction: true;
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
}

interface UseUnifiedAnalyticsReturn {
  data: UnifiedAnalyticsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: Date | null;
  isCached: boolean;
  cacheAge: number; // in minutes
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
  } = options;

  const [data, setData] = useState<UnifiedAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [cacheAge, setCacheAge] = useState(0);

  // Track active fetches to prevent concurrent calls
  const activeFetchRef = useRef<Promise<UnifiedAnalyticsData> | null>(null);
  
  // Track if we've done the initial load
  const initialLoadRef = useRef(false);

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
      console.warn('Failed to load unified analytics from cache:', error);
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
      
      console.log(`💾 UNIFIED_ANALYTICS: Cached data for ${shopName} (${days}d, predictions: ${includePredictions})`);
    } catch (error) {
      console.warn('Failed to save unified analytics to cache:', error);
    }
  }, [days, includePredictions, getCacheKeyForAnalytics]);

  // Convert dashboard data to unified analytics format
  const convertDashboardDataToUnified = useCallback((revenueData: any[], ordersData: any[]): UnifiedAnalyticsData => {
    try {
      // Safety check: ensure inputs are arrays
      if (!Array.isArray(revenueData) || !Array.isArray(ordersData)) {
        console.warn('UNIFIED_ANALYTICS: Invalid input data - not arrays:', { revenueData, ordersData });
        return {
          historical: [],
          predictions: [],
          period_days: days,
          total_revenue: 0,
          total_orders: 0,
        };
      }

      // Group revenue data by date
      const revenueByDate = new Map<string, number>();
      revenueData.forEach(item => {
        if (item && typeof item === 'object' && item.created_at && item.total_price) {
          try {
            const date = new Date(item.created_at).toISOString().split('T')[0];
            if (date && date.length === 10) { // Valid date string should be 10 characters (YYYY-MM-DD)
              revenueByDate.set(date, (revenueByDate.get(date) || 0) + Number(item.total_price) || 0);
            }
          } catch (dateError) {
            console.warn('UNIFIED_ANALYTICS: Invalid date in revenue data:', item.created_at);
          }
        }
      });

      // Group orders data by date
      const ordersByDate = new Map<string, number>();
      ordersData.forEach(item => {
        if (item && typeof item === 'object' && item.created_at) {
          try {
            const date = new Date(item.created_at).toISOString().split('T')[0];
            if (date && date.length === 10) { // Valid date string should be 10 characters (YYYY-MM-DD)
              ordersByDate.set(date, (ordersByDate.get(date) || 0) + 1);
            }
          } catch (dateError) {
            console.warn('UNIFIED_ANALYTICS: Invalid date in orders data:', item.created_at);
          }
        }
      });

      // Create historical data array
      const historical: HistoricalData[] = [];
      const allDates = new Set([...revenueByDate.keys(), ...ordersByDate.keys()]);
      
      allDates.forEach(date => {
        const revenue = revenueByDate.get(date) || 0;
        const ordersCount = ordersByDate.get(date) || 0;
        // Fix conversion rate calculation - this should be based on visitors/sessions, but for now use a simple metric
        const conversionRate = ordersCount > 0 ? 2.5 : 0; // Default 2.5% conversion rate when there are orders
        const avgOrderValue = ordersCount > 0 ? revenue / ordersCount : 0;

        historical.push({
          kind: 'historical',
          date,
          revenue,
          orders_count: ordersCount,
          conversion_rate: conversionRate,
          avg_order_value: avgOrderValue,
          isPrediction: false,
        });
      });

      // Sort by date
      historical.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Generate simple predictions based on recent trends
      const predictions: PredictionData[] = [];
      if (includePredictions && historical.length > 0) {
        const recentData = historical.slice(-7); // Last 7 days
        const avgRevenue = recentData.reduce((sum, item) => sum + (item.revenue || 0), 0) / recentData.length;
        const avgOrders = recentData.reduce((sum, item) => sum + (item.orders_count || 0), 0) / recentData.length;

        // Generate 30 days of predictions
        for (let i = 1; i <= 30; i++) {
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + i);
          const dateStr = futureDate.toISOString().split('T')[0];

          // Simple linear trend with some randomness
          const trendFactor = 1 + (Math.random() - 0.5) * 0.2; // ±10% variation
          const predictedRevenue = avgRevenue * trendFactor;
          const predictedOrders = Math.max(0, Math.round(avgOrders * trendFactor));

          predictions.push({
            kind: 'prediction',
            date: dateStr,
            revenue: predictedRevenue,
            orders_count: predictedOrders,
            conversion_rate: 2.5 + Math.random() * 2, // 2.5-4.5% range
            avg_order_value: predictedRevenue / Math.max(predictedOrders, 1),
            confidence_interval: {
              revenue_min: predictedRevenue * 0.8,
              revenue_max: predictedRevenue * 1.2,
              orders_min: Math.max(0, predictedOrders - 2),
              orders_max: predictedOrders + 2,
            },
            prediction_type: 'trend_analysis',
            confidence_score: 0.7 + Math.random() * 0.2, // 70-90% confidence
            isPrediction: true,
          });
        }
      }

      const totalRevenue = historical.reduce((sum, item) => sum + (item.revenue || 0), 0);
      const totalOrders = historical.reduce((sum, item) => sum + (item.orders_count || 0), 0);

      return {
        historical,
        predictions,
        period_days: days,
        total_revenue: totalRevenue,
        total_orders: totalOrders,
      };
    } catch (error) {
      console.error('Error converting dashboard data to unified format:', error);
      return {
        historical: [],
        predictions: [],
        period_days: days,
        total_revenue: 0,
        total_orders: 0,
      };
    }
  }, [days, includePredictions]);

  // fetchData is stable across renders unless the key query parameters change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchData = useCallback(async (forceRefresh = false): Promise<UnifiedAnalyticsData> => {
    // Validate shop before proceeding
    if (!shop || !shop.trim()) {
      throw new Error('Invalid shop name provided');
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
          const hasValidData = Array.isArray(dashboardRevenueData) && dashboardRevenueData.length > 0;
          
          if (hasValidData) {
            console.log('🔄 UNIFIED_ANALYTICS: Using dashboard data instead of API call');
            const unifiedData = convertDashboardDataToUnified(dashboardRevenueData, dashboardOrdersData);
            
            setData(unifiedData);
            setLastUpdated(new Date());
            setIsCached(false);
            setCacheAge(0);
            
            console.log('✅ UNIFIED_ANALYTICS: Converted dashboard data:', {
              historicalPoints: unifiedData.historical.length,
              predictionPoints: unifiedData.predictions.length,
              totalRevenue: unifiedData.total_revenue,
              totalOrders: unifiedData.total_orders,
            });
            
            return unifiedData;
          }
          
          // If using dashboard data but no data available, try cache first
          console.log('🔄 UNIFIED_ANALYTICS: Dashboard data not available, checking cache');
          const cachedEntry = loadFromCache(shop);
          if (cachedEntry) {
            const ageMinutes = Math.round((Date.now() - cachedEntry.timestamp) / (1000 * 60));
            console.log(`✅ UNIFIED_ANALYTICS: Using cached data (${ageMinutes}min old)`);
            
            setData(cachedEntry.data);
            setLastUpdated(cachedEntry.lastUpdated);
            setIsCached(true);
            setCacheAge(ageMinutes);
            
            return cachedEntry.data;
          }
          
          // If no cache and dashboard data is empty, return empty state without error
          console.log('🔄 UNIFIED_ANALYTICS: No dashboard data or cache available, returning empty state');
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
          setLoading(false); // Important: Set loading to false here
          
          return emptyData;
        }

        // Only make API calls if NOT using dashboard data (legacy mode)
        console.log('🔄 UNIFIED_ANALYTICS: Using legacy API mode (not using dashboard data)');
        console.warn('⚠️ DEPRECATED: Using legacy unified analytics API. This will be removed in a future version. Use dashboard data instead.');
        
        // Check cache first (unless forcing refresh)
        if (!forceRefresh) {
          const cachedEntry = loadFromCache(shop);
          if (cachedEntry) {
            const ageMinutes = Math.round((Date.now() - cachedEntry.timestamp) / (1000 * 60));
            console.log(`✅ UNIFIED_ANALYTICS: Using cached data (${ageMinutes}min old)`);
            
            setData(cachedEntry.data);
            setLastUpdated(cachedEntry.lastUpdated);
            setIsCached(true);
            setCacheAge(ageMinutes);
            
            return cachedEntry.data;
          }
        }

        // Fetch fresh data from API
        console.log(`🔄 UNIFIED_ANALYTICS: Fetching fresh data from API`);
        setIsCached(false);
        setCacheAge(0);

        const params = new URLSearchParams({
          days: days.toString(),
          includePredictions: includePredictions.toString(),
        });

        const MAX_RETRIES = 3;
        let attempt = 0;
        
        while (attempt < MAX_RETRIES) {
          try {
            const response = await fetchWithAuth(`/api/analytics/unified-analytics?${params}`);

            if (!response.ok) {
              // For 5xx errors, we should retry
              if (response.status >= 500 && response.status < 600) {
                throw new Error(`HTTP ${response.status}: Server error, retrying...`);
              }
              // For other errors, fail immediately
              else if (response.status === 401) {
                throw new Error('Authentication required');
              } else if (response.status === 403) {
                throw new Error('Permission denied – please re-authenticate with Shopify');
              } else if (response.status === 429) {
                throw new Error('Rate limited – please try again later');
              } else {
                throw new Error(`HTTP ${response.status}: Failed to fetch analytics data`);
              }
            }
            
            const result = await response.json();
            
            if (result.error) {
              throw new Error(result.error);
            }

            // Validate the response structure
            if (!result.historical || !Array.isArray(result.historical)) {
              throw new Error('Invalid analytics data format');
            }

            // Ensure predictions is always an array
            if (!result.predictions || !Array.isArray(result.predictions)) {
              result.predictions = [];
            }

            // Save to cache
            saveToCache(shop, result);

            setData(result);
            setLastUpdated(new Date());
            
            console.log('✅ UNIFIED_ANALYTICS: Fresh data loaded and cached:', {
              historicalPoints: result.historical.length,
              predictionPoints: result.predictions.length,
              totalRevenue: result.total_revenue,
              totalOrders: result.total_orders,
              periodDays: result.period_days,
            });

            return result;

          } catch (err) {
            attempt++;
            if (attempt >= MAX_RETRIES) {
              // If all retries fail, throw the last error
              throw err;
            }
            console.warn(`Attempt ${attempt} failed. Retrying in ${attempt * 2} seconds...`);
            await new Promise(res => setTimeout(res, attempt * 2000)); // Exponential backoff
          }
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics data';
        setError(errorMessage);
        console.error('Unified analytics fetch error:', err);
        
        // Don't clear existing data on error to provide a better UX
        // Note: We don't reference 'data' here to avoid dependency issues
        
        throw err;
      } finally {
        setLoading(false);
        activeFetchRef.current = null;
      }
    })();

    activeFetchRef.current = fetchPromise;
    return fetchPromise;
  }, [days, includePredictions, shop, loadFromCache, saveToCache, useDashboardData, dashboardRevenueData, dashboardOrdersData, convertDashboardDataToUnified]);

  const refetch = useCallback(async () => {
    await fetchData(true); // Force refresh
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    if (shop && shop.trim()) {
      // If using dashboard data mode, we need to handle the initial state differently
      if (useDashboardData) {
        // Check if we have dashboard data available
        const hasData = Array.isArray(dashboardRevenueData) && dashboardRevenueData.length > 0;
        
        if (!hasData && !initialLoadRef.current) {
          // No dashboard data yet, but set loading to false after a short delay
          // to prevent indefinite loading state
          const timer = setTimeout(() => {
            if (!data) {
              console.log('🔄 UNIFIED_ANALYTICS: No dashboard data received, setting empty state');
              setData({
                historical: [],
                predictions: [],
                period_days: days,
                total_revenue: 0,
                total_orders: 0,
              });
              setLoading(false);
              setError(null);
            }
          }, 1000); // Wait 1 second for dashboard data
          
          return () => clearTimeout(timer);
        } else if (hasData && !initialLoadRef.current) {
          // We have dashboard data, process it immediately
          initialLoadRef.current = true;
          fetchData();
        }
      } else {
        // Legacy API mode
        fetchData();
      }
    } else {
      // No shop, set empty state
      setLoading(false);
      setError('No shop selected');
    }
  }, [shop, fetchData, useDashboardData, dashboardRevenueData, data, days]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0 && shop && shop.trim()) {
      const interval = setInterval(() => {
        fetchData();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchData, shop]);

  // Recompute analytics when fresh dashboard data arrives
  useEffect(() => {
    if (
      useDashboardData &&
      shop &&
      shop.trim()
    ) {
      // Only process if we have valid data and it's different from current state
      const hasValidData = Array.isArray(dashboardRevenueData) && dashboardRevenueData.length > 0;
      
      if (hasValidData) {
        // Check if we need to update based on data changes
        const needsUpdate =
          !data ||
          data.historical.length === 0 ||
          (data.historical.length > 0 && data.historical.length !== dashboardRevenueData.length);

        if (needsUpdate) {
          console.log(
            '🔄 UNIFIED_ANALYTICS: Detected updated dashboard data, regenerating unified dataset'
          );
          const updated = convertDashboardDataToUnified(
            dashboardRevenueData,
            dashboardOrdersData
          );
          setData(updated);
          setLastUpdated(new Date());
          setIsCached(false);
          setCacheAge(0);
          setLoading(false); // Ensure loading is false after data update
          setError(null); // Clear any existing errors
        }
      } else if (!loading && !data) {
        // If no valid data and not loading, ensure we're in a proper empty state
        setData({
          historical: [],
          predictions: [],
          period_days: days,
          total_revenue: 0,
          total_orders: 0,
        });
        setLoading(false);
        setError(null);
      }
    }
  }, [dashboardRevenueData, dashboardOrdersData, useDashboardData, shop, data, convertDashboardDataToUnified, loading, days]);

  return {
    data,
    loading,
    error,
    refetch,
    lastUpdated,
    isCached,
    cacheAge,
  };
};

export default useUnifiedAnalytics; 