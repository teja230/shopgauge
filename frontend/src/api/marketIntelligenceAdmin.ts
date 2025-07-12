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
  }
};

export default marketIntelligenceAdminAPI; 