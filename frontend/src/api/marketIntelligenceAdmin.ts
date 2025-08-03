import { fetchWithAdminAuth } from './index';

export interface CostAnalytics {
  todayCosts: Record<string, number>;
  thisMonthCosts: Record<string, number>;
  todayRequests: Record<string, number>;
  thisMonthRequests: Record<string, number>;
  totalDailyCost: number;
  totalMonthlyCost: number;
  totalDailyRequests: number;
  totalMonthlyRequests: number;
  dailyBudget: number;
  monthlyBudget: number;
  estimatedSavings: number;
  dailyUsagePercentage: number;
  monthlyUsagePercentage: number;
}

export interface CostOptimizationRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ProviderStats {
  totalProviders: number;
  enabledProviders: string[];
  providerCosts: Record<string, number>;
  costAnalytics?: {
    dailyCost: number;
    monthlyCost: number;
    dailyRequests: number;
    monthlyRequests: number;
    estimatedSavings: number;
    dailyUsagePercentage: number;
    monthlyUsagePercentage: number;
  };
}

export interface MarketIntelligenceDashboard {
  systemStatus: {
    discoveryEnabled: boolean;
    costOptimizationEnabled: boolean;
    providersEnabled: boolean;
    timestamp: string;
  };
  costAnalytics: CostAnalytics;
  costRecommendations: CostOptimizationRecommendation[];
  discoveryStats: any;
  providerStats: ProviderStats;
  databaseStats: {
    competitorUrls: number;
    suggestions: number;
    priceSnapshots: number;
    activeShops: number;
  };
  performanceMetrics: {
    avgResponseTime: string;
    cacheHitRate: string;
    errorRate: string;
    uptime: string;
  };
}

export interface HistoricalCostData {
  timestamp: string;
  dailyCost: number;
  requests: number;
  discoveries: number;
}

export interface CostHistoryResponse {
  historicalData: HistoricalCostData[];
  providerData: {
    providerCosts: Record<string, number>;
    providerRequests: Record<string, number>;
    providerDiscoveries: Record<string, number>;
  };
  days: number;
  shopId: number;
  totalDays: number;
}

// Competitor Debugging Interfaces
export interface CompetitorScrapingStatus {
  shopId?: number;
  shopDomain?: string;
  competitors: Array<{
    id: number;
    url: string;
    status: string;
    error_count: number;
    competitor_created: string;
    last_successful_check: string | null;
    latest_price_check: string | null;
    price: number | null;
    in_stock: boolean | null;
    platform: string | null;
    scraper_source: string | null;
    response_time_ms: number | null;
    scraping_status: string;
  }>;
  summary: {
    total_competitors: number;
    active_status: number;
    error_status: number;
    blocked_by_errors: number;
    due_for_scraping: number;
    recently_scraped: number;
    never_scraped: number;
    platform_stats: Record<string, number>;
    scraper_source_stats: Record<string, number>;
  };
  availableShops?: Array<{
    id: number;
    shopify_domain: string;
  }>;
  message?: string;
}

export interface CompetitorTriggerResponse {
  competitorId: string;
  shopId?: number;
  url: string;
  actualShopId: number;
  domain: string;
  recentScrapeKey: string;
  rateLimitKey: string;
  recentScrapeExists: boolean;
  rateLimitExists: boolean;
  currentStatus?: {
    status: string;
    last_successful_check: string | null;
    error_count: number;
  };
  scrapingTriggered: boolean;
  message: string;
}

export interface CacheDebugInfo {
  shopId: number;
  shopDomain: string;
  redisConnected: boolean;
  redisError?: string;
  cacheKey: string;
  cacheExists: boolean;
  cachedData?: any;
  cacheType?: string;
  databaseProductCount: number;
}

export interface TriggerScrapingDebugInfo {
  competitorId: string;
  url: string;
  shopId: number;
  domain: string;
  recentScrapeKey: string;
  rateLimitKey: string;
  recentScrapeExists: boolean;
  rateLimitExists: boolean;
  currentStatus?: {
    status: string;
    last_successful_check: string | null;
    error_count: number;
  };
  scrapingTriggered: boolean;
  message: string;
  scrapingSuccess?: boolean;
  scrapedPrice?: number;
  failureReason?: string;
  failureMessage?: string;
  scrapingDuration?: number;
  updatedStatus?: {
    status: string;
    last_successful_check: string | null;
    error_count: number;
    response_time_ms: number;
  };
  latestSnapshot?: {
    price: number;
    in_stock: boolean;
    checked_at: string;
    scraper_version: string;
    platform: string;
    scraper_source: string;
    response_time_ms: number;
  };
  priceSnapshots?: Array<{
    price: number;
    in_stock: boolean;
    checked_at: string;
    scraper_version: string;
    platform: string;
    scraper_source: string;
  }>;
}

export interface ProductsDebugInfo {
  shopId: number;
  shopDomain: string;
  redisConnected: boolean;
  redisError?: string;
  cacheKey: string;
  cacheExists: boolean;
  cacheTtl?: string;
  hasRawCacheData: boolean;
  rawCacheDataLength: number;
  parsedDataKeys?: string[];
  parsedDataType?: string;
  dataType?: string;
  dataKeys?: string[];
  productsType?: string;
  productsListSize?: number;
  parseError?: string;
  dbProductsCount: number;
  dbError?: string;
  // New unified products approach fields
  unifiedProductsApproach?: boolean;
  productsEndpoint?: string;
  analyticsEndpoint?: string;
  demoModeSupported?: boolean;
  liveModeUsesAnalytics?: boolean;
}

export interface SearchTestResult {
  url: string;
  title: string;
  price?: number;
  description?: string;
  provider: string;
}

export const marketIntelligenceAdminAPI = {
  async getAdminDashboard(): Promise<MarketIntelligenceDashboard> {
    return await fetchWithAdminAuth('/api/admin/market-intelligence/dashboard');
  },

  async getCostAnalytics(): Promise<{
    analytics: CostAnalytics;
    recommendations: CostOptimizationRecommendation[];
    savings: any;
  }> {
    return await fetchWithAdminAuth('/api/admin/market-intelligence/cost-analytics');
  },

  async getProviderComparison(): Promise<{
    providerStats: ProviderStats;
    costEfficiency: any;
    recommendations: string[];
  }> {
    return await fetchWithAdminAuth('/api/admin/market-intelligence/provider-comparison');
  },

  async testSearch(keywords: string): Promise<{
    results: SearchTestResult[];
    totalResults: number;
    keywords: string;
    providers: string[];
  }> {
    return await fetchWithAdminAuth('/api/admin/market-intelligence/test-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords })
    });
  },

  async resetCosts(): Promise<{ message: string; timestamp: string }> {
    return await fetchWithAdminAuth('/api/admin/market-intelligence/reset-costs', {
      method: 'POST'
    });
  },

  async getSystemConfig(): Promise<any> {
    return await fetchWithAdminAuth('/api/admin/market-intelligence/config');
  },

  async updateSystemConfig(config: any): Promise<any> {
    return await fetchWithAdminAuth('/api/admin/market-intelligence/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  },

  async getSystemHealth(): Promise<any> {
    return await fetchWithAdminAuth('/api/admin/market-intelligence/health');
  },

  async getLogs(limit = 100, level = 'INFO'): Promise<any> {
    return await fetchWithAdminAuth(
      `/api/admin/market-intelligence/logs?limit=${limit}&level=${level}`
    );
  },

  async getCostHistory(shopId: number, days = 30): Promise<CostHistoryResponse> {
    return await fetchWithAdminAuth(
      `/api/admin/market-intelligence/cost-history?shopId=${shopId}&days=${days}`
    );
  },

  // Competitor Debugging API Functions
  async getCompetitorScrapingStatus(shopId?: number): Promise<CompetitorScrapingStatus> {
    const url = shopId 
      ? `/api/admin/market-intelligence/scraping-status?shopId=${shopId}`
      : '/api/admin/market-intelligence/scraping-status';
    return await fetchWithAdminAuth(url);
  },

  async triggerCompetitorScraping(competitorId: string, shopId?: number): Promise<CompetitorTriggerResponse> {
    const url = shopId 
      ? `/api/admin/market-intelligence/${competitorId}/trigger-scraping?shopId=${shopId}`
      : `/api/admin/market-intelligence/${competitorId}/trigger-scraping`;
    return await fetchWithAdminAuth(url, { method: 'POST' });
  },

  async getCacheDebugInfo(shopId: number): Promise<CacheDebugInfo> {
    return await fetchWithAdminAuth(`/api/admin/market-intelligence/cache-debug?shopId=${shopId}`);
  },

  async triggerScrapingDebug(competitorId: string, shopId: number): Promise<TriggerScrapingDebugInfo> {
    return await fetchWithAdminAuth(`/api/admin/market-intelligence/${competitorId}/trigger-scraping-debug?shopId=${shopId}`, { method: 'POST' });
  },

  async getCompetitorDebugInfo(competitorId: string, shopId: number): Promise<any> {
    return await fetchWithAdminAuth(`/api/admin/market-intelligence/${competitorId}/debug-info?shopId=${shopId}`);
  },

  async getProductsDebug(shopId: number): Promise<ProductsDebugInfo> {
    return await fetchWithAdminAuth(`/api/admin/market-intelligence/products-debug?shopId=${shopId}`);
  },

  async getAvailableShops(): Promise<Array<{ id: number; shopify_domain: string }>> {
    return await fetchWithAdminAuth('/api/admin/market-intelligence/shops');
  },
};

export default marketIntelligenceAdminAPI; 