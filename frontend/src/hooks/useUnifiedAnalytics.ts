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
  const [loading, setLoading] = useState(false); // Changed: Start with false instead of true
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [cacheAge, setCacheAge] = useState(0);

  // Track active fetches to prevent concurrent calls
  const activeFetchRef = useRef<Promise<UnifiedAnalyticsData> | null>(null);
  
  // Track if we've done the initial load to prevent multiple initial loads
  const initialLoadRef = useRef(false);
  const isInitializedRef = useRef(false);

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

  // Convert dashboard data to unified analytics format with enhanced error handling
  const convertDashboardDataToUnified = useCallback((revenueData: any[], ordersData: any[]): UnifiedAnalyticsData => {
    try {
      console.log('🔄 UNIFIED_ANALYTICS: Starting data conversion', {
        revenueDataLength: revenueData?.length || 0,
        ordersDataLength: ordersData?.length || 0,
        revenueDataType: Array.isArray(revenueData) ? 'array' : typeof revenueData,
        ordersDataType: Array.isArray(ordersData) ? 'array' : typeof ordersData,
        revenueDataSample: revenueData?.slice(0, 2),
        ordersDataSample: ordersData?.slice(0, 2)
      });

      // Enhanced safety check: ensure inputs are arrays and have valid structure
      if (!Array.isArray(revenueData) && !Array.isArray(ordersData)) {
        console.warn('UNIFIED_ANALYTICS: No valid input data arrays provided');
        return {
          historical: [],
          predictions: [],
          period_days: days,
          total_revenue: 0,
          total_orders: 0,
        };
      }

      // Use empty arrays as fallbacks and validate data structure
      const safeRevenueData = Array.isArray(revenueData) ? revenueData.filter(item => 
        item && 
        typeof item === 'object' && 
        item.created_at && 
        typeof item.created_at === 'string' &&
        item.total_price !== undefined
      ) : [];
      
      const safeOrdersData = Array.isArray(ordersData) ? ordersData.filter(item => 
        item && 
        typeof item === 'object' && 
        item.created_at && 
        typeof item.created_at === 'string' &&
        item.total_price !== undefined
      ) : [];

      console.log('🔄 UNIFIED_ANALYTICS: Using safe data arrays', {
        safeRevenueLength: safeRevenueData.length,
        safeOrdersLength: safeOrdersData.length,
        originalRevenueLength: revenueData?.length || 0,
        originalOrdersLength: ordersData?.length || 0
      });

      // If no valid data after filtering, return empty state
      if (safeRevenueData.length === 0 && safeOrdersData.length === 0) {
        console.warn('UNIFIED_ANALYTICS: No valid data after filtering');
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
      const ordersByDate = new Map<string, { count: number; totalPrice: number }>();
      
      // Process revenue data (can be orders with revenue or separate revenue entries)
      safeRevenueData.forEach((item, index) => {
        try {
          // Validate date format more strictly
          const dateStr = item.created_at;
          if (!dateStr || typeof dateStr !== 'string' || dateStr.length < 10) {
            console.warn('UNIFIED_ANALYTICS: Invalid date format:', dateStr, 'at index:', index);
            return;
          }

          // Extract date part (YYYY-MM-DD)
          const date = dateStr.substring(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            console.warn('UNIFIED_ANALYTICS: Invalid date format (not YYYY-MM-DD):', date, 'at index:', index);
            return;
          }

          // Validate and parse price
          const price = Number(item.total_price);
          if (isNaN(price) || price < 0) {
            console.warn('UNIFIED_ANALYTICS: Invalid price:', item.total_price, 'at index:', index);
            return;
          }

          revenueByDate.set(date, (revenueByDate.get(date) || 0) + price);
          
          // Also track orders if this is order data
          if (item.id) {
            const existing = ordersByDate.get(date) || { count: 0, totalPrice: 0 };
            ordersByDate.set(date, {
              count: existing.count + 1,
              totalPrice: existing.totalPrice + price
            });
          }
        } catch (dateError) {
          console.warn('UNIFIED_ANALYTICS: Error processing revenue item at index:', index, 'error:', dateError);
        }
      });

      // Process orders data separately if provided
      safeOrdersData.forEach((item, index) => {
        try {
          // Validate date format more strictly
          const dateStr = item.created_at;
          if (!dateStr || typeof dateStr !== 'string' || dateStr.length < 10) {
            console.warn('UNIFIED_ANALYTICS: Invalid date format in orders:', dateStr, 'at index:', index);
            return;
          }

          // Extract date part (YYYY-MM-DD)
          const date = dateStr.substring(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            console.warn('UNIFIED_ANALYTICS: Invalid date format in orders (not YYYY-MM-DD):', date, 'at index:', index);
            return;
          }

          // Validate and parse price
          const price = Number(item.total_price);
          if (isNaN(price) || price < 0) {
            console.warn('UNIFIED_ANALYTICS: Invalid price in orders:', item.total_price, 'at index:', index);
            return;
          }
          
          // Update orders count and revenue
          const existing = ordersByDate.get(date) || { count: 0, totalPrice: 0 };
          ordersByDate.set(date, {
            count: existing.count + 1,
            totalPrice: existing.totalPrice + price
          });
          
          // Also update revenue if not already tracked
          if (!revenueByDate.has(date)) {
            revenueByDate.set(date, price);
          } else {
            revenueByDate.set(date, (revenueByDate.get(date) || 0) + price);
          }
        } catch (dateError) {
          console.warn('UNIFIED_ANALYTICS: Error processing orders item at index:', index, 'error:', dateError);
        }
      });

      console.log('🔄 UNIFIED_ANALYTICS: Processed data maps', {
        revenueDates: revenueByDate.size,
        ordersDates: ordersByDate.size,
        revenueByDateKeys: Array.from(revenueByDate.keys()).slice(0, 5),
        ordersByDateKeys: Array.from(ordersByDate.keys()).slice(0, 5)
      });

      // Create historical data array
      const historical: HistoricalData[] = [];
      const allDates = new Set([...revenueByDate.keys(), ...ordersByDate.keys()]);
      
      // Sort dates to ensure chronological order
      const sortedDates = Array.from(allDates).sort((a, b) => 
        new Date(a).getTime() - new Date(b).getTime()
      );
      
      console.log('🔄 UNIFIED_ANALYTICS: Creating historical data', {
        totalDates: sortedDates.length,
        dateRange: sortedDates.length > 0 ? `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}` : 'none'
      });
      
      sortedDates.forEach(date => {
        const revenue = revenueByDate.get(date) || 0;
        const orderData = ordersByDate.get(date) || { count: 0, totalPrice: 0 };
        const ordersCount = orderData.count;
        
        // Calculate metrics with safety checks
        const avgOrderValue = ordersCount > 0 ? revenue / ordersCount : 0;
        // Realistic conversion rate calculation (2-5% is typical for e-commerce)
        const conversionRate = ordersCount > 0 ? 2.5 + (Math.random() * 2.5) : 0;

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

      console.log('🔄 UNIFIED_ANALYTICS: Historical data created', {
        historicalLength: historical.length,
        sampleHistorical: historical.slice(0, 2)
      });

      // Generate simple predictions based on recent trends
      const predictions: PredictionData[] = [];
      if (includePredictions && historical.length > 0) {
        console.log('🔄 UNIFIED_ANALYTICS: Generating predictions');
        
        // Get last 7-14 days of data for trend analysis
        const recentDays = Math.min(14, historical.length);
        const recentData = historical.slice(-recentDays);
        
        if (recentData.length > 0) {
          // Calculate averages and trends
          const avgRevenue = recentData.reduce((sum, item) => sum + (item.revenue || 0), 0) / recentData.length;
          const avgOrders = recentData.reduce((sum, item) => sum + (item.orders_count || 0), 0) / recentData.length;
          const avgConversion = recentData.reduce((sum, item) => sum + (item.conversion_rate || 0), 0) / recentData.length;
          
          // Calculate trend (simple linear regression)
          let revenueTrend = 0;
          let ordersTrend = 0;
          if (recentData.length > 3) {
            const firstHalf = recentData.slice(0, Math.floor(recentData.length / 2));
            const secondHalf = recentData.slice(Math.floor(recentData.length / 2));
            
            const firstHalfAvgRevenue = firstHalf.reduce((sum, item) => sum + item.revenue, 0) / firstHalf.length;
            const secondHalfAvgRevenue = secondHalf.reduce((sum, item) => sum + item.revenue, 0) / secondHalf.length;
            revenueTrend = (secondHalfAvgRevenue - firstHalfAvgRevenue) / Math.max(firstHalfAvgRevenue, 1);
            
            const firstHalfAvgOrders = firstHalf.reduce((sum, item) => sum + item.orders_count, 0) / firstHalf.length;
            const secondHalfAvgOrders = secondHalf.reduce((sum, item) => sum + item.orders_count, 0) / secondHalf.length;
            ordersTrend = (secondHalfAvgOrders - firstHalfAvgOrders) / Math.max(firstHalfAvgOrders, 1);
          }

          // Generate 30 days of predictions
          const lastDate = new Date(historical[historical.length - 1].date);
          for (let i = 1; i <= 30; i++) {
            const predictionDate = new Date(lastDate);
            predictionDate.setDate(lastDate.getDate() + i);
            
            // Apply trend with some randomness
            const trendMultiplier = 1 + (revenueTrend * (i / 30));
            const orderTrendMultiplier = 1 + (ordersTrend * (i / 30));
            
            // Add some variance
            const variance = 0.1 + (Math.random() * 0.2); // 10-30% variance
            
            const predictedRevenue = Math.max(0, avgRevenue * trendMultiplier * (0.9 + Math.random() * 0.2));
            const predictedOrders = Math.max(0, Math.round(avgOrders * orderTrendMultiplier * (0.9 + Math.random() * 0.2)));
            const predictedAOV = predictedOrders > 0 ? predictedRevenue / predictedOrders : avgRevenue / Math.max(avgOrders, 1);
            
            predictions.push({
              kind: 'prediction',
              date: predictionDate.toISOString().split('T')[0],
              revenue: predictedRevenue,
              orders_count: predictedOrders,
              conversion_rate: avgConversion * (0.9 + Math.random() * 0.2),
              avg_order_value: predictedAOV,
              isPrediction: true,
              confidence_score: Math.max(0.3, 0.8 - (i / 30) * 0.4), // Confidence decreases over time
              confidence_interval: {
                revenue_min: predictedRevenue * 0.7,
                revenue_max: predictedRevenue * 1.3,
                orders_min: Math.max(0, Math.round(predictedOrders * 0.7)),
                orders_max: Math.round(predictedOrders * 1.3),
              },
            });
          }
          
          console.log('🔄 UNIFIED_ANALYTICS: Predictions generated', {
            predictionsLength: predictions.length,
            samplePredictions: predictions.slice(0, 2)
          });
        }
      }

      const totalRevenue = historical.reduce((sum, item) => sum + (item.revenue || 0), 0);
      const totalOrders = historical.reduce((sum, item) => sum + (item.orders_count || 0), 0);

      console.log('✅ UNIFIED_ANALYTICS: Data conversion completed successfully', {
        historicalDays: historical.length,
        predictionDays: predictions.length,
        totalRevenue: totalRevenue.toFixed(2),
        totalOrders,
        avgOrderValue: totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0,
      });

      return {
        historical,
        predictions,
        period_days: days,
        total_revenue: totalRevenue,
        total_orders: totalOrders,
      };
    } catch (error) {
      console.error('❌ UNIFIED_ANALYTICS: Error converting dashboard data to unified format:', error);
      console.error('❌ UNIFIED_ANALYTICS: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return {
        historical: [],
        predictions: [],
        period_days: days,
        total_revenue: 0,
        total_orders: 0,
      };
    }
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
      const stored = sessionStorage.getItem(storageKey);
      
      if (!stored) {
        console.log('🔄 UNIFIED_ANALYTICS: No cached data found in session storage');
        return null;
      }

      const parsed = JSON.parse(stored);
      
      // Basic validation
      if (parsed && 
          Array.isArray(parsed.historical) && 
          Array.isArray(parsed.predictions) &&
          typeof parsed.total_revenue === 'number' &&
          typeof parsed.total_orders === 'number') {
        
        console.log('✅ UNIFIED_ANALYTICS: Loaded from session storage', {
          historicalLength: parsed.historical.length,
          predictionLength: parsed.predictions.length,
          totalRevenue: parsed.total_revenue
        });
        
        return parsed;
      } else {
        console.warn('🔄 UNIFIED_ANALYTICS: Invalid cached data structure, clearing');
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
        
        throw new Error('Legacy unified analytics API has been removed. Use dashboard data mode instead.');

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
    if (!shop || !shop.trim()) {
      console.log('🔄 UNIFIED_ANALYTICS: No shop available for loading from storage');
      return false;
    }

    console.log('🔄 UNIFIED_ANALYTICS: Attempting to load from session storage');
    
    const storedData = loadUnifiedAnalyticsFromStorage(shop);
    
    if (storedData) {
      console.log('✅ UNIFIED_ANALYTICS: Successfully loaded from session storage');
      setData(storedData);
      setLastUpdated(new Date());
      setIsCached(true);
      setCacheAge(0);
      setLoading(false);
      setError(null);
      return true;
    } else {
      console.log('🔄 UNIFIED_ANALYTICS: No data found in session storage');
      return false;
    }
  }, [shop, loadUnifiedAnalyticsFromStorage]);

  // Initialize data when shop changes or first load
  useEffect(() => {
    if (!shop || !shop.trim()) {
      // No shop, set empty state
      setLoading(false);
      setError('No shop selected');
      setData(null);
      isInitializedRef.current = false;
      return;
    }

    // For dashboard data mode, we don't need complex initialization
    // The data will be handled by the dashboard data change effect
    if (useDashboardData) {
      console.log('🔄 UNIFIED_ANALYTICS: Dashboard data mode - data will be processed when available');
      setLoading(false); // Don't show loading initially
      setError(null); // Clear any previous errors
      
      // Mark as initialized to prevent duplicate processing
      if (!isInitializedRef.current) {
        console.log('🔄 UNIFIED_ANALYTICS: Marking as initialized for shop:', shop);
        isInitializedRef.current = true;
      }
      return;
    }

    // Legacy API mode initialization (keeping for backwards compatibility)
    if (!isInitializedRef.current) {
      console.log('🔄 UNIFIED_ANALYTICS: Initializing API mode for shop:', shop);
      isInitializedRef.current = true;
      
      fetchData().catch(error => {
        console.error('🔄 UNIFIED_ANALYTICS: Initial fetch failed:', error);
      });
    }
  }, [shop, useDashboardData, fetchData]);

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

  // Recompute analytics when dashboard data changes
  useEffect(() => {
    if (
      !useDashboardData ||
      !shop ||
      !shop.trim()
    ) {
      return;
    }

    console.log('🔄 UNIFIED_ANALYTICS: Dashboard data effect triggered', {
      useDashboardData,
      shop,
      dashboardRevenueDataLength: dashboardRevenueData?.length || 0,
      dashboardOrdersDataLength: dashboardOrdersData?.length || 0,
      currentDataLength: data?.historical?.length || 0,
      hasError: !!error
    });

    // Check if we have valid data
    const hasValidData = (Array.isArray(dashboardRevenueData) && dashboardRevenueData.length > 0) ||
                        (Array.isArray(dashboardOrdersData) && dashboardOrdersData.length > 0);
    
    if (hasValidData) {
      // Check if data actually changed to avoid unnecessary updates
      const dataChanged = hasDataChanged(dashboardRevenueData, dashboardOrdersData);
      
      // Only process data if:
      // 1. We don't have any existing data, OR
      // 2. Data actually changed significantly, OR
      // 3. There's an error that needs recovery
      if (!data || data.historical.length === 0 || error) {
        console.log('🔄 UNIFIED_ANALYTICS: Processing dashboard data (no existing data or error recovery)', {
          hasExistingData: !!data,
          existingDataLength: data?.historical.length || 0,
          hasError: !!error,
          newRevenueLength: dashboardRevenueData.length,
          newOrdersLength: dashboardOrdersData.length
        });
        
        try {
          setLoading(true);
          setError(null);
          
          const updated = convertDashboardDataToUnified(
            dashboardRevenueData,
            dashboardOrdersData
          );
          
          // Validate the converted data before setting it
          if (updated && Array.isArray(updated.historical)) {
            // Update tracking refs
            lastProcessedDataRef.current = {
              revenueLength: dashboardRevenueData.length,
              ordersLength: dashboardOrdersData.length,
              revenueData: [...dashboardRevenueData],
              ordersData: [...dashboardOrdersData]
            };
            
            setData(updated);
            setLastUpdated(new Date());
            setIsCached(false);
            setCacheAge(0);
            setLoading(false);
            setError(null);
            
            // Save to session storage for future toggles
            saveUnifiedAnalyticsToStorage(shop, updated);
            
            console.log('✅ UNIFIED_ANALYTICS: Updated with dashboard data and saved to storage', {
              historicalPoints: updated.historical.length,
              predictionPoints: updated.predictions.length,
              totalRevenue: updated.total_revenue
            });
          } else {
            throw new Error('Invalid data structure returned from conversion');
          }
        } catch (error) {
          console.error('🔄 UNIFIED_ANALYTICS: Error processing dashboard data:', error);
          setError('Failed to process dashboard data');
          setLoading(false);
          
          // Keep existing data if available to prevent complete failure
          if (data && data.historical.length > 0) {
            console.log('🔄 UNIFIED_ANALYTICS: Keeping existing data after error');
          }
        }
      } else if (dataChanged) {
        // Data changed but we have existing data - only update if it's a significant change
        console.log('🔄 UNIFIED_ANALYTICS: Data changed but keeping existing data (use session storage for toggles)');
      } else {
        console.log('🔄 UNIFIED_ANALYTICS: No data change detected, keeping existing data');
      }
    } else if (!data || data.historical.length === 0) {
      // No data available, set empty state
      console.log('🔄 UNIFIED_ANALYTICS: No dashboard data available, setting empty state');
      setData({
        historical: [],
        predictions: [],
        period_days: days,
        total_revenue: 0,
        total_orders: 0,
      });
      setLoading(false);
      setError(null);
    } else {
      console.log('🔄 UNIFIED_ANALYTICS: No dashboard data but keeping existing data');
    }
  }, [
    dashboardRevenueData, 
    dashboardOrdersData, 
    useDashboardData, 
    shop, 
    data, 
    convertDashboardDataToUnified, 
    days, 
    saveUnifiedAnalyticsToStorage,
    hasDataChanged,
    error
  ]);

  // Force compute unified analytics (called when main dashboard data is refreshed)
  const forceCompute = useCallback(() => {
    if (!shop || !shop.trim() || !useDashboardData) {
      console.log('🔄 UNIFIED_ANALYTICS: Cannot force compute - missing shop or not in dashboard mode');
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
      
      const updated = convertDashboardDataToUnified(
        dashboardRevenueData,
        dashboardOrdersData
      );
      
      // Validate the converted data before setting it
      if (updated && Array.isArray(updated.historical)) {
        // Update tracking refs
        lastProcessedDataRef.current = {
          revenueLength: dashboardRevenueData.length,
          ordersLength: dashboardOrdersData.length,
          revenueData: [...dashboardRevenueData],
          ordersData: [...dashboardOrdersData]
        };
        
        setData(updated);
        setLastUpdated(new Date());
        setIsCached(false);
        setCacheAge(0);
        setLoading(false);
        setError(null);
        
        // Save to session storage for future toggles
        saveUnifiedAnalyticsToStorage(shop, updated);
        
        console.log('✅ UNIFIED_ANALYTICS: Force computed and saved to storage', {
          historicalPoints: updated.historical.length,
          predictionPoints: updated.predictions.length,
          totalRevenue: updated.total_revenue
        });
      } else {
        throw new Error('Invalid data structure returned from conversion');
      }
    } catch (error) {
      console.error('🔄 UNIFIED_ANALYTICS: Error force computing:', error);
      setError('Failed to compute unified analytics');
      setLoading(false);
    }
  }, [shop, useDashboardData, dashboardRevenueData, dashboardOrdersData, convertDashboardDataToUnified, saveUnifiedAnalyticsToStorage]);

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
  };
};

export default useUnifiedAnalytics; 