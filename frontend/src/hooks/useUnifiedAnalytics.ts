import { useState, useEffect, useCallback } from 'react';

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

interface UseUnifiedAnalyticsOptions {
  days?: number;
  includePredictions?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseUnifiedAnalyticsReturn {
  data: UnifiedAnalyticsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: Date | null;
}

const useUnifiedAnalytics = (
  options: UseUnifiedAnalyticsOptions = {}
): UseUnifiedAnalyticsReturn => {
  const {
    days = 60,
    includePredictions = true,
    autoRefresh = false,
    refreshInterval = 300000, // 5 minutes
  } = options;

  const [data, setData] = useState<UnifiedAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        days: days.toString(),
        includePredictions: includePredictions.toString(),
      });

      const response = await fetch(`/api/analytics/unified-analytics?${params}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

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

      setData(result);
      setLastUpdated(new Date());
      
      console.log('Unified analytics data loaded:', {
        historicalPoints: result.historical.length,
        predictionPoints: result.predictions.length,
        totalRevenue: result.total_revenue,
        totalOrders: result.total_orders,
        periodDays: result.period_days,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics data';
      setError(errorMessage);
      console.error('Unified analytics fetch error:', err);
      
      // Don't clear existing data on error to provide a better UX
      if (!data) {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [days, includePredictions, data]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchData();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    lastUpdated,
  };
};

export default useUnifiedAnalytics; 