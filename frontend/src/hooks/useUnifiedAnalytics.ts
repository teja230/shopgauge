import { useState, useEffect, useCallback, useRef } from 'react';
import { getCacheKey, CACHE_VERSION } from '../utils/cacheUtils';
import { fetchWithAuth } from '../api';

interface HistoricalData {
  date: string;
  revenue: number;
  orders_count: number;
  conversion_rate: number;
  avg_order_value: number;
}

interface PredictionData {
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

const useUnifiedAnalytics = (
  options: UseUnifiedAnalyticsOptions = {}
): UseUnifiedAnalyticsReturn => {
  const {
    days = 60,
    includePredictions = true,
    autoRefresh = false,
    refreshInterval = 300000, // 5 minutes
    shop,
  } = options;

  const [data, setData] = useState<UnifiedAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [cacheAge, setCacheAge] = useState(0);

  // Track active fetches to prevent concurrent calls
  const activeFetchRef = useRef<Promise<UnifiedAnalyticsData> | null>(null);

  // Generate cache key for unified analytics
  const getCacheKeyForAnalytics = useCallback((shopName: string, paramDays: number, predictions: boolean) => {
    return `unified_analytics_${shopName}_${paramDays}d_${predictions ? 'with' : 'no'}_predictions`;
  }, []);

  // Load from cache
  const loadFromCache = useCallback((shopName: string): CacheEntry<UnifiedAnalyticsData> | null => {
    if (!shopName) return null;
    
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
    if (!shopName) return;

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

  const fetchData = useCallback(async (forceRefresh = false): Promise<UnifiedAnalyticsData> => {
    // Return existing promise if already fetching
    if (activeFetchRef.current && !forceRefresh) {
      return activeFetchRef.current;
    }

    const fetchPromise = (async () => {
      try {
        setLoading(true);
        setError(null);

        // Check cache first (unless forcing refresh)
        if (!forceRefresh && shop) {
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

        // Fetch fresh data
        console.log(`🔄 UNIFIED_ANALYTICS: Fetching fresh data from API`);
        setIsCached(false);
        setCacheAge(0);

        const params = new URLSearchParams({
          days: days.toString(),
          includePredictions: includePredictions.toString(),
        });

        const response = await fetchWithAuth(`/api/analytics/unified-analytics?${params}`);

        if (!response.ok) {
          if (response.status === 401) {
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
        if (shop) {
          saveToCache(shop, result);
        }

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
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics data';
        setError(errorMessage);
        console.error('Unified analytics fetch error:', err);
        
        // Don't clear existing data on error to provide a better UX
        if (!data) {
          setData(null);
        }
        
        throw err;
      } finally {
        setLoading(false);
        activeFetchRef.current = null;
      }
    })();

    activeFetchRef.current = fetchPromise;
    return fetchPromise;
  }, [days, includePredictions, data, shop, loadFromCache, saveToCache]);

  const refetch = useCallback(async () => {
    await fetchData(true); // Force refresh
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    if (shop) {
      fetchData();
    }
  }, [fetchData, shop]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0 && shop) {
      const interval = setInterval(() => {
        fetchData();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchData, shop]);

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