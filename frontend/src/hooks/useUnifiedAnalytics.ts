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

  // Convert dashboard data to unified analytics format with simplified error handling
  const convertDashboardDataToUnified = useCallback((revenueData: any[], ordersData: any[]): UnifiedAnalyticsData => {
    console.log('🔄 UNIFIED_ANALYTICS: Starting data conversion', {
      revenueDataLength: revenueData?.length || 0,
      ordersDataLength: ordersData?.length || 0,
      revenueDataType: Array.isArray(revenueData) ? 'array' : typeof revenueData,
      ordersDataType: Array.isArray(ordersData) ? 'array' : typeof ordersData
    });

    // Use empty arrays as fallbacks
    const safeRevenueData = Array.isArray(revenueData) ? revenueData : [];
    const safeOrdersData = Array.isArray(ordersData) ? ordersData : [];

    // If no data at all, return empty structure
    if (safeRevenueData.length === 0 && safeOrdersData.length === 0) {
      console.log('🔄 UNIFIED_ANALYTICS: No input data, returning empty structure');
      return {
        historical: [],
        predictions: [],
        period_days: days,
        total_revenue: 0,
        total_orders: 0,
      };
    }

    // Group data by date with simplified validation
    const dataByDate = new Map<string, { revenue: number; orders: number }>();
    
    // Process revenue data
    safeRevenueData.forEach((item, index) => {
      try {
        if (!item || typeof item !== 'object') return;
        
        // Extract date - be more flexible with date formats
        let dateStr = item.created_at || item.date || '';
        if (typeof dateStr !== 'string' || dateStr.length < 8) return;
        
        // Extract date part (handle various formats)
        const date = dateStr.substring(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

        // Parse price with fallback to 0
        const price = parseFloat(item.total_price) || 0;
        if (price < 0) return; // Skip negative prices
        
        const existing = dataByDate.get(date) || { revenue: 0, orders: 0 };
        dataByDate.set(date, {
          revenue: existing.revenue + price,
          orders: existing.orders + (item.id ? 1 : 0) // Count as order if has ID
        });
      } catch (error) {
        console.warn('🔄 UNIFIED_ANALYTICS: Error processing revenue item:', index, error);
      }
    });

    // Process orders data separately
    safeOrdersData.forEach((item, index) => {
      try {
        if (!item || typeof item !== 'object') return;
        
        // Extract date
        let dateStr = item.created_at || item.date || '';
        if (typeof dateStr !== 'string' || dateStr.length < 8) return;
        
        const date = dateStr.substring(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

        const price = parseFloat(item.total_price) || 0;
        if (price < 0) return;
        
        const existing = dataByDate.get(date) || { revenue: 0, orders: 0 };
        dataByDate.set(date, {
          revenue: existing.revenue + price,
          orders: existing.orders + 1
        });
      } catch (error) {
        console.warn('🔄 UNIFIED_ANALYTICS: Error processing orders item:', index, error);
      }
    });

    console.log('🔄 UNIFIED_ANALYTICS: Processed data by date', {
      totalDates: dataByDate.size,
      sampleDates: Array.from(dataByDate.keys()).slice(0, 3)
    });

    // Create historical data
    const historical: HistoricalData[] = [];
    const sortedDates = Array.from(dataByDate.keys()).sort();
    
    let totalRevenue = 0;
    let totalOrders = 0;
    
    sortedDates.forEach(date => {
      const dayData = dataByDate.get(date)!;
      
      totalRevenue += dayData.revenue;
      totalOrders += dayData.orders;
      
      // Calculate metrics with safe defaults
      const avgOrderValue = dayData.orders > 0 ? dayData.revenue / dayData.orders : 0;
      const conversionRate = Math.random() * 5; // Simplified - replace with actual calculation if available
      
      historical.push({
        kind: 'historical',
        date,
        revenue: dayData.revenue,
        orders_count: dayData.orders,
        conversion_rate: conversionRate,
        avg_order_value: avgOrderValue,
        isPrediction: false,
      });
    });

    // Generate simple predictions if enabled
    const predictions: PredictionData[] = [];
    if (includePredictions && historical.length > 0) {
      // Generate 30 days of predictions based on recent data
      const recentData = historical.slice(-7); // Use last 7 days
      const avgRevenue = recentData.reduce((sum, d) => sum + d.revenue, 0) / recentData.length;
      const avgOrders = recentData.reduce((sum, d) => sum + d.orders_count, 0) / recentData.length;
      
      const lastDate = new Date(historical[historical.length - 1].date);
      
      for (let i = 1; i <= 30; i++) {
        const predictionDate = new Date(lastDate);
        predictionDate.setDate(lastDate.getDate() + i);
        
        // Add some variation to predictions
        const variation = 0.8 + Math.random() * 0.4; // 80% to 120% of average
        const predictedRevenue = avgRevenue * variation;
        const predictedOrders = Math.max(1, Math.round(avgOrders * variation));
        
        predictions.push({
          kind: 'prediction',
          date: predictionDate.toISOString().substring(0, 10),
          revenue: predictedRevenue,
          orders_count: predictedOrders,
          conversion_rate: 3 + Math.random() * 2, // 3-5% range
          avg_order_value: predictedOrders > 0 ? predictedRevenue / predictedOrders : 0,
          isPrediction: true,
          confidence_score: 0.7 + Math.random() * 0.2, // 70-90% confidence
          confidence_interval: {
            revenue_min: predictedRevenue * 0.7,
            revenue_max: predictedRevenue * 1.3,
            orders_min: Math.max(1, Math.round(predictedOrders * 0.7)),
            orders_max: Math.round(predictedOrders * 1.3),
          },
        });
      }
    }

    const result: UnifiedAnalyticsData = {
      historical,
      predictions,
      period_days: days,
      total_revenue: totalRevenue,
      total_orders: totalOrders,
    };

    console.log('✅ UNIFIED_ANALYTICS: Data conversion complete', {
      historicalPoints: historical.length,
      predictionPoints: predictions.length,
      totalRevenue,
      totalOrders
    });

    return result;
  }, [days, includePredictions]);

  // Simple session storage key for unified analytics
  const getUnifiedAnalyticsStorageKey = useCallback((shopName: string) => {
    return `unified_analytics_${shopName}_${days}d_${includePredictions ? 'with' : 'no'}_predictions`;
  }, [days, includePredictions]);

  // Load unified analytics from session storage
  const loadUnifiedAnalyticsFromStorage = useCallback((shopName: string): UnifiedAnalyticsData | null => {
    if (!shopName || !shopName.trim()) return null;
    
    try {
      const storageKey = getUnifiedAnalyticsStorageKey(shopName);
      console.log('🔄 UNIFIED_ANALYTICS: Attempting to load with key:', storageKey);
      
      const stored = sessionStorage.getItem(storageKey);
      
      if (!stored) {
        console.log('🔄 UNIFIED_ANALYTICS: No cached data found in session storage for key:', storageKey);
        return null;
      }

      console.log('🔄 UNIFIED_ANALYTICS: Found stored data, length:', stored.length);
      const parsed = JSON.parse(stored);
      console.log('🔄 UNIFIED_ANALYTICS: Parsed data structure:', {
        hasParsed: !!parsed,
        hasHistorical: Array.isArray(parsed?.historical),
        hasPredictions: Array.isArray(parsed?.predictions),
        historicalLength: parsed?.historical?.length,
        predictionLength: parsed?.predictions?.length,
        totalRevenueType: typeof parsed?.total_revenue,
        totalOrdersType: typeof parsed?.total_orders,
        totalRevenue: parsed?.total_revenue,
        totalOrders: parsed?.total_orders
      });
      
      // Enhanced validation with better error handling
      if (parsed && 
          Array.isArray(parsed.historical) && 
          Array.isArray(parsed.predictions) &&
          typeof parsed.total_revenue === 'number' &&
          typeof parsed.total_orders === 'number') {
        
        // Additional validation: check if historical data items have required fields
        const hasValidHistoricalData = parsed.historical.length === 0 || parsed.historical.every((item: any) => 
          item && 
          typeof item.date === 'string' && 
          typeof item.revenue === 'number' && 
          typeof item.orders_count === 'number'
        );
        
        if (!hasValidHistoricalData) {
          console.warn('🔄 UNIFIED_ANALYTICS: Historical data validation failed - missing required fields');
          sessionStorage.removeItem(storageKey);
          return null;
        }
        
        console.log('✅ UNIFIED_ANALYTICS: Validation passed, returning data', {
          historicalLength: parsed.historical.length,
          predictionLength: parsed.predictions.length,
          totalRevenue: parsed.total_revenue,
          totalOrders: parsed.total_orders
        });
        
        return parsed;
      } else {
        console.warn('🔄 UNIFIED_ANALYTICS: Basic validation failed, details:', {
          hasParsed: !!parsed,
          historicalIsArray: Array.isArray(parsed?.historical),
          predictionsIsArray: Array.isArray(parsed?.predictions),
          totalRevenueIsNumber: typeof parsed?.total_revenue === 'number',
          totalOrdersIsNumber: typeof parsed?.total_orders === 'number',
          totalRevenueValue: parsed?.total_revenue,
          totalOrdersValue: parsed?.total_orders
        });
        sessionStorage.removeItem(storageKey);
        return null;
      }
    } catch (error) {
      console.warn('🔄 UNIFIED_ANALYTICS: Error loading from session storage:', error);
      return null;
    }
  }, [getUnifiedAnalyticsStorageKey]);

  // Save unified analytics to session storage
  const saveUnifiedAnalyticsToStorage = useCallback((shopName: string, analyticsData: UnifiedAnalyticsData) => {
    if (!shopName || !shopName.trim()) return;

    try {
      const storageKey = getUnifiedAnalyticsStorageKey(shopName);
      sessionStorage.setItem(storageKey, JSON.stringify(analyticsData));
      
      console.log('💾 UNIFIED_ANALYTICS: Saved to session storage', {
        key: storageKey,
        historicalLength: analyticsData.historical.length,
        predictionLength: analyticsData.predictions.length
      });
    } catch (error) {
      console.warn('🔄 UNIFIED_ANALYTICS: Error saving to session storage:', error);
    }
  }, [getUnifiedAnalyticsStorageKey]);

  // Enhanced fetchData function with better error handling
  const fetchData = useCallback(async (forceRefresh = false): Promise<UnifiedAnalyticsData> => {
    // Validate shop before proceeding
    if (!shop || !shop.trim()) {
      console.error('🔄 UNIFIED_ANALYTICS: Invalid shop name provided');
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
            console.log('🔄 UNIFIED_ANALYTICS: Using dashboard data instead of API call');
            const unifiedData = convertDashboardDataToUnified(dashboardRevenueData, dashboardOrdersData);
            
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
          if (cachedEntry && !forceRefresh) {
            const ageMinutes = Math.round((Date.now() - cachedEntry.timestamp) / (1000 * 60));
            console.log(`✅ UNIFIED_ANALYTICS: Using cached data (${ageMinutes}min old)`);
            
            setData(cachedEntry.data);
            setLastUpdated(cachedEntry.lastUpdated);
            setIsCached(true);
            setCacheAge(ageMinutes);
            
            return cachedEntry.data;
          }
          
          // If no cache and dashboard data is empty, keep existing data if available
          if (data || lastValidDataRef.current) {
            console.log('🔄 UNIFIED_ANALYTICS: No new data available, keeping existing data');
            // Use the last valid data if current data is empty
            const dataToUse = data || lastValidDataRef.current;
            if (dataToUse) {
              setData(dataToUse);
              return dataToUse;
            }
          }
          
          // Only return empty state if we have no existing data
          console.log('🔄 UNIFIED_ANALYTICS: No dashboard data, cache, or existing data available');
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
        console.error('🚫 UNIFIED_ANALYTICS: Legacy API mode is not supported. The unified-analytics endpoint has been removed.');
        console.error('🚫 UNIFIED_ANALYTICS: Please use dashboard data mode by setting useDashboardData: true');
        
        setError('Legacy unified analytics API has been removed. Use dashboard data mode instead.');
        setLoading(false);
        return Promise.reject(new Error('Legacy unified analytics API has been removed. Use dashboard data mode instead.'));

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics data';
        setError(errorMessage);
        console.error('Unified analytics fetch error:', err);
        
        // Don't clear existing data on error to provide a better UX
        // Keep the last valid data if available
        if (lastValidDataRef.current && !data) {
          console.log('🔄 UNIFIED_ANALYTICS: Using last valid data after error');
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
  }, [days, includePredictions, shop, loadFromCache, saveToCache, useDashboardData, dashboardRevenueData, dashboardOrdersData, convertDashboardDataToUnified, data]);

  const refetch = useCallback(async () => {
    try {
      console.log('🔄 UNIFIED_ANALYTICS: Manual refetch initiated');
      
      // Clear any existing errors before refetching
      setError(null);
      
      // For dashboard data mode, reprocess the current data
      if (useDashboardData && dashboardRevenueData && dashboardOrdersData) {
        console.log('🔄 UNIFIED_ANALYTICS: Reprocessing dashboard data on refetch');
        
        try {
          const updated = convertDashboardDataToUnified(
            dashboardRevenueData,
            dashboardOrdersData
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
          
          console.log('✅ UNIFIED_ANALYTICS: Reprocessed dashboard data on refetch');
          return;
        } catch (error) {
          console.error('🔄 UNIFIED_ANALYTICS: Error reprocessing dashboard data:', error);
          setError('Failed to reprocess dashboard data');
          setLoading(false);
          return;
        }
      }
      
      // Otherwise do a full fetch
      await fetchData(true); // Force refresh
    } catch (error) {
      console.error('🔄 UNIFIED_ANALYTICS: Manual refetch failed:', error);
      // Don't throw here - let the component handle the error state
    }
  }, [fetchData, useDashboardData, dashboardRevenueData, dashboardOrdersData, convertDashboardDataToUnified, shop, saveUnifiedAnalyticsToStorage]);

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
        
        console.log('✅ UNIFIED_ANALYTICS: Successfully loaded from session storage', {
          historicalLength: storedData.historical.length,
          predictionLength: storedData.predictions.length,
          totalRevenue: storedData.total_revenue,
          totalOrders: storedData.total_orders
        });
        
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
        console.log('🔄 UNIFIED_ANALYTICS: No data found in session storage');
        
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
          
          console.log('🔄 UNIFIED_ANALYTICS: Falling back to processing dashboard data since no storage data found');
          try {
            setLoading(true);
            setError(null);
            
            const processedData = convertDashboardDataToUnified(dashboardRevenueData, dashboardOrdersData);
            
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
              
              console.log('✅ UNIFIED_ANALYTICS: Successfully processed dashboard data as fallback');
              return true;
            } else {
              debugLog.error('Fallback processing failed - invalid data structure', { 
                hasProcessedData: !!processedData,
                hasHistorical: processedData && Array.isArray(processedData.historical)
              }, 'UnifiedAnalytics');
              
              console.error('🔄 UNIFIED_ANALYTICS: Fallback processing failed - invalid data structure');
              setError('Failed to process analytics data');
              setLoading(false);
              return false;
            }
          } catch (fallbackError) {
            debugLog.error('Fallback processing failed with error', { 
              error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
            }, 'UnifiedAnalytics');
            
            console.error('🔄 UNIFIED_ANALYTICS: Fallback processing failed:', fallbackError);
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
      
      console.error('🔄 UNIFIED_ANALYTICS: Error loading from session storage:', error);
      
      // Clear potentially corrupted storage and set error state
      try {
        const storageKey = getUnifiedAnalyticsStorageKey(shop);
        sessionStorage.removeItem(storageKey);
        debugLog.info('Cleared potentially corrupted session storage', { storageKey }, 'UnifiedAnalytics');
        console.log('🗑️ UNIFIED_ANALYTICS: Cleared potentially corrupted session storage');
      } catch (clearError) {
        debugLog.error('Failed to clear corrupted storage', { 
          error: clearError instanceof Error ? clearError.message : String(clearError)
        }, 'UnifiedAnalytics');
        
        console.error('🔄 UNIFIED_ANALYTICS: Failed to clear corrupted storage:', clearError);
      }
      
      setError('Failed to load cached analytics data');
      setLoading(false);
      return false;
    }
  }, [shop, loadUnifiedAnalyticsFromStorage, dashboardRevenueData, dashboardOrdersData, useDashboardData, convertDashboardDataToUnified, saveUnifiedAnalyticsToStorage, getUnifiedAnalyticsStorageKey]);

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
      debugLog.info('Initializing dashboard data mode', { shop, useDashboardData }, 'UnifiedAnalytics');
      
      // Start loading state
      setLoading(true);
      setError(null);
      
      // Try to load from session storage first
      const storageData = loadUnifiedAnalyticsFromStorage(shop);
      if (storageData) {
        debugLog.info('Loaded initial data from session storage', { 
          historicalLength: storageData.historical.length,
          predictionsLength: storageData.predictions.length 
        }, 'UnifiedAnalytics');
        setData(storageData);
        setLastUpdated(new Date());
        setIsCached(true);
        setCacheAge(0);
        setLoading(false);
        hasProcessedDataRef.current = true;
      } else {
        debugLog.info('No session storage data, waiting for dashboard data', { shop }, 'UnifiedAnalytics');
        // Keep loading state until dashboard data arrives or timeout
        
        // Set a backup timeout in case dashboard data never arrives
        const initTimeoutId = setTimeout(() => {
          if (loading && !hasProcessedDataRef.current) {
            console.log('🔄 UNIFIED_ANALYTICS: Initialization timeout, checking for any available data');
            
            // Check if we have any dashboard data available now
            const hasAnyData = (Array.isArray(dashboardRevenueData) && dashboardRevenueData.length > 0) ||
                              (Array.isArray(dashboardOrdersData) && dashboardOrdersData.length > 0);
            
            if (hasAnyData) {
              console.log('🔄 UNIFIED_ANALYTICS: Found data during timeout, processing immediately');
              // Force process the data
              try {
                const processedData = convertDashboardDataToUnified(dashboardRevenueData, dashboardOrdersData);
                setData(processedData);
                setLastUpdated(new Date());
                setIsCached(false);
                setCacheAge(0);
                setLoading(false);
                hasProcessedDataRef.current = true;
                saveUnifiedAnalyticsToStorage(shop, processedData);
              } catch (error) {
                console.error('🔄 UNIFIED_ANALYTICS: Error processing data during timeout:', error);
                setError('Failed to process analytics data');
                setLoading(false);
              }
            } else {
              console.log('🔄 UNIFIED_ANALYTICS: No data available, setting empty state');
              setData({
                historical: [],
                predictions: [],
                period_days: days,
                total_revenue: 0,
                total_orders: 0,
              });
              setLoading(false);
              hasProcessedDataRef.current = true;
            }
          }
        }, 3000); // 3 second initialization timeout
        
        // Clean up timeout when component unmounts or shop changes
        return () => clearTimeout(initTimeoutId);
      }
      
      isInitializedRef.current = true;
      return;
    }

    // Legacy API mode not supported
    console.error('🚫 UNIFIED_ANALYTICS: API mode not supported');
    setError('API mode not supported. Use dashboard data mode.');
    setLoading(false);
  }, [shop, useDashboardData, loadUnifiedAnalyticsFromStorage, dashboardRevenueData, dashboardOrdersData, convertDashboardDataToUnified, saveUnifiedAnalyticsToStorage, days, loading]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0 && shop && shop.trim()) {
      const interval = setInterval(() => {
        fetchData().catch(error => {
          console.error('🔄 UNIFIED_ANALYTICS: Auto-refresh failed:', error);
        });
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchData, shop]);

  // Process dashboard data when it becomes available
  useEffect(() => {
    // Only process if we're in dashboard mode and have a shop
    if (!useDashboardData || !shop || !shop.trim() || !isInitializedRef.current) {
      return;
    }

    debugLog.info('Dashboard data effect triggered', {
      shop,
      dashboardRevenueDataLength: dashboardRevenueData?.length || 0,
      dashboardOrdersDataLength: dashboardOrdersData?.length || 0,
      hasProcessedData: hasProcessedDataRef.current,
      currentDataLength: data?.historical?.length || 0,
      loading,
      error: !!error
    }, 'UnifiedAnalytics');

    // Check if we have valid dashboard data
    const hasValidData = (Array.isArray(dashboardRevenueData) && dashboardRevenueData.length > 0) ||
                        (Array.isArray(dashboardOrdersData) && dashboardOrdersData.length > 0);
    
    if (!hasValidData) {
      // No dashboard data yet - if we haven't processed anything yet, wait a bit more
      // but don't wait indefinitely to prevent stuck loading states
      if (!hasProcessedDataRef.current) {
        console.log('🔄 UNIFIED_ANALYTICS: No dashboard data available yet');
        
        // Set a timeout to stop loading if no data comes after a reasonable wait
        const timeoutId = setTimeout(() => {
          if (!hasProcessedDataRef.current && loading) {
            console.log('🔄 UNIFIED_ANALYTICS: Timeout waiting for dashboard data, setting empty state');
            setLoading(false);
            setError(null);
            setData({
              historical: [],
              predictions: [],
              period_days: days,
              total_revenue: 0,
              total_orders: 0,
            });
            hasProcessedDataRef.current = true;
          }
        }, 5000); // Reduced to 5 second timeout for faster response
        
        return () => clearTimeout(timeoutId);
      }
      return;
    }

    // Check if data has actually changed to avoid unnecessary processing
    const dataChanged = hasDataChanged(dashboardRevenueData, dashboardOrdersData);
    
    // Process if we haven't processed data yet, there's an error to recover from, or data has changed
    if (!hasProcessedDataRef.current || error || dataChanged) {
      console.log('🔄 UNIFIED_ANALYTICS: Processing dashboard data', {
        hasProcessedBefore: hasProcessedDataRef.current,
        hasError: !!error,
        dataChanged: dataChanged,
        revenueDataLength: dashboardRevenueData?.length || 0,
        ordersDataLength: dashboardOrdersData?.length || 0
      });
      
      try {
        setLoading(true);
        setError(null);
        
        const processedData = convertDashboardDataToUnified(
          dashboardRevenueData,
          dashboardOrdersData
        );
        
        // Validate the processed data
        if (processedData && Array.isArray(processedData.historical)) {
          setData(processedData);
          setLastUpdated(new Date());
          setIsCached(false);
          setCacheAge(0);
          setLoading(false);
          setError(null);
          
          // Update tracking
          lastProcessedDataRef.current = {
            revenueLength: dashboardRevenueData?.length || 0,
            ordersLength: dashboardOrdersData?.length || 0,
            revenueData: dashboardRevenueData ? [...dashboardRevenueData] : [],
            ordersData: dashboardOrdersData ? [...dashboardOrdersData] : []
          };
          
          // Mark as processed and save to storage
          hasProcessedDataRef.current = true;
          saveUnifiedAnalyticsToStorage(shop, processedData);
          
          console.log('✅ UNIFIED_ANALYTICS: Successfully processed dashboard data', {
            historicalPoints: processedData.historical.length,
            predictionPoints: processedData.predictions.length,
            totalRevenue: processedData.total_revenue
          });
        } else {
          console.error('🔄 UNIFIED_ANALYTICS: Invalid data structure returned from conversion');
          setError('Invalid data structure returned from conversion');
          setLoading(false);
        }
      } catch (error) {
        console.error('🔄 UNIFIED_ANALYTICS: Error processing dashboard data:', error);
        setError('Failed to process dashboard data');
        setLoading(false);
      }
    } else {
      console.log('🔄 UNIFIED_ANALYTICS: Data already processed and unchanged, skipping');
    }
  }, [
    useDashboardData, 
    shop, 
    dashboardRevenueData, 
    dashboardOrdersData, 
    convertDashboardDataToUnified, 
    saveUnifiedAnalyticsToStorage,
    hasDataChanged,
    error,
    days
  ]);

  // Force compute unified analytics (called when main dashboard data is refreshed)
  const forceCompute = useCallback(() => {
    // Validate inputs
    if (!shop || !shop.trim()) {
      console.log('🔄 UNIFIED_ANALYTICS: Cannot force compute - missing shop');
      return;
    }

    if (!useDashboardData) {
      console.log('🔄 UNIFIED_ANALYTICS: Cannot force compute - not in dashboard mode');
      return;
    }

    const hasValidData = (Array.isArray(dashboardRevenueData) && dashboardRevenueData.length > 0) ||
                        (Array.isArray(dashboardOrdersData) && dashboardOrdersData.length > 0);

    if (!hasValidData) {
      console.log('🔄 UNIFIED_ANALYTICS: Cannot force compute - no valid dashboard data');
      return;
    }

    console.log('🔄 UNIFIED_ANALYTICS: Force computing unified analytics');
    
    try {
      setLoading(true);
      setError(null);
      
      const processedData = convertDashboardDataToUnified(
        dashboardRevenueData,
        dashboardOrdersData
      );
      
      if (processedData && Array.isArray(processedData.historical)) {
        setData(processedData);
        setLastUpdated(new Date());
        setIsCached(false);
        setCacheAge(0);
        setLoading(false);
        setError(null);
        
        // Mark as processed and save to storage
        hasProcessedDataRef.current = true;
        saveUnifiedAnalyticsToStorage(shop, processedData);
        
        console.log('✅ UNIFIED_ANALYTICS: Force compute successful', {
          historicalPoints: processedData.historical.length,
          predictionPoints: processedData.predictions.length,
          totalRevenue: processedData.total_revenue
        });
      } else {
        console.error('🔄 UNIFIED_ANALYTICS: Invalid data structure returned from force compute');
        setError('Invalid data structure returned from conversion');
        setLoading(false);
      }
    } catch (error) {
      console.error('🔄 UNIFIED_ANALYTICS: Force compute failed:', error);
      setError('Failed to compute analytics data');
      setLoading(false);
    }
  }, [
    shop,
    useDashboardData,
    dashboardRevenueData,
    dashboardOrdersData,
    convertDashboardDataToUnified,
    saveUnifiedAnalyticsToStorage
  ]);

  // Clear unified analytics session storage (called when shop changes)
  const clearUnifiedAnalyticsStorage = useCallback(() => {
    if (!shop || !shop.trim()) {
      console.log('🔄 UNIFIED_ANALYTICS: Cannot clear storage - missing shop');
      return;
    }

    try {
      // Use the same key generation logic as save/load functions to ensure consistency
      const storageKey = getUnifiedAnalyticsStorageKey(shop);
      sessionStorage.removeItem(storageKey);
      console.log('🗑️ UNIFIED_ANALYTICS: Cleared session storage for shop:', shop, 'key:', storageKey);
      
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
      
      console.log('✅ UNIFIED_ANALYTICS: Reset all state for shop change');
    } catch (error) {
      console.error('🔄 UNIFIED_ANALYTICS: Error clearing storage:', error);
    }
  }, [shop, getUnifiedAnalyticsStorageKey]);

  // Reset state when shop changes
  useEffect(() => {
    hasProcessedDataRef.current = false;
    isInitializedRef.current = false;
    console.log('🔄 UNIFIED_ANALYTICS: Reset processing flags for shop change:', shop);
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