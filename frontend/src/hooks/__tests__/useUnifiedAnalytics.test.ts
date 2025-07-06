import { renderHook, act, waitFor } from '@testing-library/react';
import useUnifiedAnalytics from '../useUnifiedAnalytics';

// Mock dependencies
const mockFetchWithAuth = jest.fn();
const mockGetCacheKey = jest.fn((shop: string) => `cache_${shop}`);
const mockDebugLog = {
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
};

jest.mock('../../api', () => ({
  fetchWithAuth: mockFetchWithAuth,
}));

jest.mock('../../utils/cacheUtils', () => ({
  getCacheKey: mockGetCacheKey,
  CACHE_VERSION: '1.0.0',
}));

jest.mock('../../components/ui/DebugPanel', () => ({
  debugLog: mockDebugLog,
}));

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});

describe('useUnifiedAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.getItem.mockReturnValue(null);
  });

  describe('Data Conversion Tests', () => {
    test('should convert dashboard data to unified analytics format', async () => {
      const mockRevenueData = [
        { date: '2025-01-01', revenue: 1000, orders_count: 10 },
        { date: '2025-01-02', revenue: 1200, orders_count: 12 },
      ];

      const mockOrdersData = [
        { date: '2025-01-01', orders_count: 10, conversion_rate: 2.5 },
        { date: '2025-01-02', orders_count: 12, conversion_rate: 3.0 },
      ];

      const { result } = renderHook(() =>
        useUnifiedAnalytics({
          useDashboardData: true,
          dashboardRevenueData: mockRevenueData,
          dashboardOrdersData: mockOrdersData,
          realConversionRate: 2.75,
        })
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
        expect(result.current.data?.historical).toHaveLength(2);
        expect(result.current.data?.historical[0].revenue).toBe(1000);
        expect(result.current.data?.historical[0].orders_count).toBe(10);
        expect(result.current.data?.historical[0].conversion_rate).toBe(2.5);
      });
    });

    test('should handle missing or invalid data gracefully', async () => {
      const { result } = renderHook(() =>
        useUnifiedAnalytics({
          useDashboardData: true,
          dashboardRevenueData: [],
          dashboardOrdersData: [],
        })
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
        expect(result.current.data?.historical).toHaveLength(0);
        expect(result.current.data?.predictions).toHaveLength(0);
      });
    });

    test('should validate and sanitize data values', async () => {
      const mockRevenueData = [
        { date: '2025-01-01', revenue: -100, orders_count: NaN },
        { date: '2025-01-02', revenue: 1200, orders_count: 12 },
      ];

      const { result } = renderHook(() =>
        useUnifiedAnalytics({
          useDashboardData: true,
          dashboardRevenueData: mockRevenueData,
          dashboardOrdersData: [],
        })
      );

      await waitFor(() => {
        expect(result.current.data?.historical[0].revenue).toBe(0); // Should be sanitized to 0
        expect(result.current.data?.historical[0].orders_count).toBe(0); // Should be sanitized to 0
        expect(result.current.data?.historical[1].revenue).toBe(1200); // Valid data preserved
      });
    });
  });

  describe('Prediction Algorithm Tests', () => {
    test('should generate predictions with confidence intervals', async () => {
      const mockRevenueData = [
        { date: '2025-01-01', revenue: 1000, orders_count: 10 },
        { date: '2025-01-02', revenue: 1200, orders_count: 12 },
        { date: '2025-01-03', revenue: 1100, orders_count: 11 },
      ];

      const { result } = renderHook(() =>
        useUnifiedAnalytics({
          useDashboardData: true,
          dashboardRevenueData: mockRevenueData,
          dashboardOrdersData: [],
          includePredictions: true,
        })
      );

      await waitFor(() => {
        expect(result.current.data?.predictions).toBeDefined();
        expect(result.current.data?.predictions.length).toBeGreaterThan(0);
        
        const prediction = result.current.data?.predictions[0];
        expect(prediction?.confidence_interval).toBeDefined();
        expect(prediction?.confidence_score).toBeDefined();
        expect(prediction?.confidence_score).toBeGreaterThan(0);
        expect(prediction?.confidence_score).toBeLessThanOrEqual(1);
      });
    });

    test('should calculate variance correctly for prediction confidence', async () => {
      const mockRevenueData = [
        { date: '2025-01-01', revenue: 1000, orders_count: 10 },
        { date: '2025-01-02', revenue: 1000, orders_count: 10 },
        { date: '2025-01-03', revenue: 1000, orders_count: 10 },
      ];

      const { result } = renderHook(() =>
        useUnifiedAnalytics({
          useDashboardData: true,
          dashboardRevenueData: mockRevenueData,
          dashboardOrdersData: [],
          includePredictions: true,
        })
      );

      await waitFor(() => {
        const prediction = result.current.data?.predictions[0];
        // Low variance data should have high confidence
        expect(prediction?.confidence_score).toBeGreaterThan(0.8);
      });
    });

    test('should handle insufficient data for predictions', async () => {
      const mockRevenueData = [
        { date: '2025-01-01', revenue: 1000, orders_count: 10 },
      ];

      const { result } = renderHook(() =>
        useUnifiedAnalytics({
          useDashboardData: true,
          dashboardRevenueData: mockRevenueData,
          dashboardOrdersData: [],
          includePredictions: true,
        })
      );

      await waitFor(() => {
        // Should still generate predictions but with lower confidence
        expect(result.current.data?.predictions).toBeDefined();
        expect(result.current.data?.predictions.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Caching Behavior Tests', () => {
    test('should load data from cache when available and valid', async () => {
      const mockCachedData = {
        data: {
          historical: [{ date: '2025-01-01', revenue: 1000, orders_count: 10, conversion_rate: 2.5, avg_order_value: 100, kind: 'historical', isPrediction: false }],
          predictions: [],
          period_days: 60,
          total_revenue: 1000,
          total_orders: 10,
        },
        timestamp: Date.now() - 1000, // 1 second ago
        lastUpdated: new Date().toISOString(),
        version: '1.0.0',
        shop: 'test-shop',
        days: 60,
        includePredictions: false,
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify({
        'unified_analytics_test-shop_60d_no_predictions': mockCachedData,
      }));

      const { result } = renderHook(() =>
        useUnifiedAnalytics({
          shop: 'test-shop',
          days: 60,
          includePredictions: false,
        })
      );

      await waitFor(() => {
        expect(result.current.isCached).toBe(true);
        expect(result.current.data).toBeDefined();
        expect(result.current.data?.historical).toHaveLength(1);
      });
    });

    test('should not use expired cache', async () => {
      const mockExpiredData = {
        data: {
          historical: [],
          predictions: [],
          period_days: 60,
          total_revenue: 0,
          total_orders: 0,
        },
        timestamp: Date.now() - (3 * 60 * 60 * 1000), // 3 hours ago (expired)
        lastUpdated: new Date().toISOString(),
        version: '1.0.0',
        shop: 'test-shop',
        days: 60,
        includePredictions: false,
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify({
        'unified_analytics_test-shop_60d_no_predictions': mockExpiredData,
      }));

      const { result } = renderHook(() =>
        useUnifiedAnalytics({
          shop: 'test-shop',
          days: 60,
          includePredictions: false,
        })
      );

      await waitFor(() => {
        expect(result.current.isCached).toBe(false);
      });
    });

    test('should save data to cache after successful fetch', async () => {
      const mockApiResponse = {
        historical: [{ date: '2025-01-01', revenue: 1000, orders_count: 10, conversion_rate: 2.5, avg_order_value: 100, kind: 'historical', isPrediction: false }],
        predictions: [],
        period_days: 60,
        total_revenue: 1000,
        total_orders: 10,
      };

      mockFetchWithAuth.mockResolvedValue(mockApiResponse);

      const { result } = renderHook(() =>
        useUnifiedAnalytics({
          shop: 'test-shop',
          days: 60,
          includePredictions: false,
        })
      );

      await waitFor(() => {
        expect(mockSessionStorage.setItem).toHaveBeenCalled();
        const setItemCall = mockSessionStorage.setItem.mock.calls[0];
        expect(setItemCall[0]).toContain('cache_test-shop');
        expect(JSON.parse(setItemCall[1])).toHaveProperty('unified_analytics_test-shop_60d_no_predictions');
      });
    });

    test('should handle cache key generation correctly', async () => {
      const { result } = renderHook(() =>
        useUnifiedAnalytics({
          shop: 'test-shop',
          days: 30,
          includePredictions: true,
        })
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      // Verify cache key was generated with correct parameters
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('cache_test-shop'),
        expect.stringContaining('unified_analytics_test-shop_30d_with_predictions')
      );
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle API errors gracefully', async () => {
      mockFetchWithAuth.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() =>
        useUnifiedAnalytics({
          shop: 'test-shop',
        })
      );

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.loading).toBe(false);
      });
    });

    test('should handle malformed cache data', async () => {
      mockSessionStorage.getItem.mockReturnValue('invalid json');

      const { result } = renderHook(() =>
        useUnifiedAnalytics({
          shop: 'test-shop',
        })
      );

      await waitFor(() => {
        expect(result.current.data).toBeNull();
        expect(result.current.error).toBeNull(); // Should not set error for cache issues
      });
    });
  });

  describe('Performance Tests', () => {
    test('should prevent concurrent fetches', async () => {
      mockFetchWithAuth.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const { result } = renderHook(() =>
        useUnifiedAnalytics({
          shop: 'test-shop',
        })
      );

      // Trigger multiple refetch calls
      act(() => {
        result.current.refetch();
        result.current.refetch();
        result.current.refetch();
      });

      await waitFor(() => {
        // Should only make one API call despite multiple refetch calls
        expect(mockFetchWithAuth).toHaveBeenCalledTimes(1);
      });
    });

    test('should update cache age correctly', async () => {
      const mockCachedData = {
        data: {
          historical: [],
          predictions: [],
          period_days: 60,
          total_revenue: 0,
          total_orders: 0,
        },
        timestamp: Date.now() - (30 * 60 * 1000), // 30 minutes ago
        lastUpdated: new Date().toISOString(),
        version: '1.0.0',
        shop: 'test-shop',
        days: 60,
        includePredictions: false,
      };

      mockSessionStorage.getItem.mockReturnValue(JSON.stringify({
        'unified_analytics_test-shop_60d_no_predictions': mockCachedData,
      }));

      const { result } = renderHook(() =>
        useUnifiedAnalytics({
          shop: 'test-shop',
        })
      );

      await waitFor(() => {
        expect(result.current.cacheAge).toBeCloseTo(30, -1); // Within 10 minutes
      });
    });
  });
});
