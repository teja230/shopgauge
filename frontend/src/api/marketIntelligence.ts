import { fetchWithAuth } from './index';

// Types for Market Intelligence API
export interface CompetitorData {
  id: string;
  url: string;
  label: string;
  price: number;
  inStock: boolean;
  percentDiff: number;
  lastChecked: string;
  provider?: string;
}

export interface CompetitorSuggestion {
  id: number;
  suggestedUrl: string;
  title: string;
  price: number;
  source: string;
  discoveredAt: string;
  status: 'NEW' | 'APPROVED' | 'REJECTED';
}

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

export interface DiscoveryConfig {
  enabled: boolean;
  configured: boolean;
  intervalHours: number;
  maxResultsPerProduct: number;
  searchProvider: string;
  searchClientEnabled: boolean;
  message?: string;
}

export interface LimitCheckResult {
  canAdd: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
  tier: string;
  message?: string;
}

export interface DiscoveryLimitResult {
  canDiscover: boolean;
  productCount: number;
  competitorCount: number;
  maxProducts: number;
  maxCompetitors: number;
  message?: string;
}

export interface LimitsResponse {
  competitorLimit: LimitCheckResult;
  suggestionLimit: LimitCheckResult;
  discoveryLimit: DiscoveryLimitResult;
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

export interface SearchTestResult {
  url: string;
  title: string;
  price?: number;
  description?: string;
  provider: string;
}

// Market Intelligence API functions
export const marketIntelligenceAPI = {
  // Competitor management
  async getCompetitors(): Promise<CompetitorData[]> {
    const response = await fetchWithAuth('/api/competitors');
    return response.json();
  },

  async addCompetitor(url: string, productId?: string): Promise<CompetitorData> {
    const response = await fetchWithAuth('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, productId })
    });
    return response.json();
  },

  async deleteCompetitor(id: string): Promise<void> {
    await fetchWithAuth(`/api/competitors/${id}`, { method: 'DELETE' });
  },

  // Limits management
  async checkLimits(): Promise<LimitsResponse> {
    const response = await fetchWithAuth('/api/competitors/limits');
    return response.json();
  },

  // Discovery management
  async getDiscoveryConfig(): Promise<DiscoveryConfig> {
    const response = await fetchWithAuth('/api/competitors/discovery/config');
    return response.json();
  },

  async getDiscoveryStatus(): Promise<any> {
    const response = await fetchWithAuth('/api/competitors/discovery/status');
    return response.json();
  },

  async triggerDiscovery(): Promise<any> {
    const response = await fetchWithAuth('/api/competitors/discovery/trigger', {
      method: 'POST'
    });
    return response.json();
  },

  // Suggestions management
  async getSuggestions(page = 0, size = 10, status = 'NEW'): Promise<any> {
    const response = await fetchWithAuth(
      `/api/competitors/suggestions?page=${page}&size=${size}&status=${status}`
    );
    return response.json();
  },

  async getSuggestionCount(): Promise<{ count: number }> {
    const response = await fetchWithAuth('/api/competitors/suggestions/count');
    return response.json();
  },

  async refreshSuggestionCount(): Promise<{ count: number }> {
    const response = await fetchWithAuth('/api/competitors/suggestions/refresh-count', {
      method: 'POST'
    });
    return response.json();
  },

  async approveSuggestion(id: number): Promise<any> {
    const response = await fetchWithAuth(`/api/competitors/suggestions/${id}/approve`, {
      method: 'POST'
    });
    return response.json();
  },

  async ignoreSuggestion(id: number): Promise<any> {
    const response = await fetchWithAuth(`/api/competitors/suggestions/${id}/ignore`, {
      method: 'POST'
    });
    return response.json();
  },

  // Admin functions (for development/testing)
  async getAdminDashboard(): Promise<MarketIntelligenceDashboard> {
    const response = await fetchWithAuth('/api/admin/market-intelligence/dashboard');
    return response.json();
  },

  async getCostAnalytics(): Promise<{
    analytics: CostAnalytics;
    recommendations: CostOptimizationRecommendation[];
    savings: any;
  }> {
    const response = await fetchWithAuth('/api/admin/market-intelligence/cost-analytics');
    return response.json();
  },

  async getProviderComparison(): Promise<{
    providerStats: ProviderStats;
    costEfficiency: any;
    recommendations: string[];
  }> {
    const response = await fetchWithAuth('/api/admin/market-intelligence/provider-comparison');
    return response.json();
  },

  async testSearch(keywords: string): Promise<{
    results: SearchTestResult[];
    totalResults: number;
    keywords: string;
    providers: string[];
  }> {
    const response = await fetchWithAuth('/api/admin/market-intelligence/test-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords })
    });
    return response.json();
  },

  async resetCosts(): Promise<{ message: string; timestamp: string }> {
    const response = await fetchWithAuth('/api/admin/market-intelligence/reset-costs', {
      method: 'POST'
    });
    return response.json();
  },

  async getSystemConfig(): Promise<any> {
    const response = await fetchWithAuth('/api/admin/market-intelligence/config');
    return response.json();
  },

  async updateSystemConfig(config: any): Promise<any> {
    const response = await fetchWithAuth('/api/admin/market-intelligence/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return response.json();
  },

  async getSystemHealth(): Promise<any> {
    const response = await fetchWithAuth('/api/admin/market-intelligence/health');
    return response.json();
  },

  async getLogs(limit = 100, level = 'INFO'): Promise<any> {
    const response = await fetchWithAuth(
      `/api/admin/market-intelligence/logs?limit=${limit}&level=${level}`
    );
    return response.json();
  }
};

// Helper functions for Market Intelligence
export const marketIntelligenceHelpers = {
  formatCurrency: (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  },

  formatPercentage: (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value);
  },

  calculateSavings: (analytics: CostAnalytics): {
    monthlySavings: number;
    yearlyProjection: number;
    roiPercentage: number;
  } => {
    const monthlySavings = analytics.estimatedSavings;
    const yearlyProjection = monthlySavings * 12;
    const roiPercentage = analytics.totalMonthlyCost > 0 ? 
      (monthlySavings / analytics.totalMonthlyCost) * 100 : 0;

    return {
      monthlySavings,
      yearlyProjection,
      roiPercentage
    };
  },

  getPriorityColor: (priority: CostOptimizationRecommendation['priority']): string => {
    switch (priority) {
      case 'HIGH': return 'text-red-600 bg-red-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  },

  getStatusColor: (status: CompetitorSuggestion['status']): string => {
    switch (status) {
      case 'NEW': return 'text-blue-600 bg-blue-100';
      case 'APPROVED': return 'text-green-600 bg-green-100';
      case 'REJECTED': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  },

  extractDomain: (url: string): string => {
    try {
      const domain = new URL(url).hostname;
      return domain.startsWith('www.') ? domain.substring(4) : domain;
    } catch {
      return url;
    }
  },

  validateUrl: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  isEcommerceUrl: (url: string): boolean => {
    const ecommerceDomains = [
      'amazon.com', 'shopify.com', 'etsy.com', 'ebay.com', 'walmart.com',
      'target.com', 'bestbuy.com', 'homedepot.com', 'lowes.com'
    ];
    
    try {
      const domain = new URL(url).hostname.toLowerCase();
      return ecommerceDomains.some(ecommerce => 
        domain.includes(ecommerce) || domain.endsWith('.myshopify.com')
      );
    } catch {
      return false;
    }
  },

  generateKeywords: (productTitle: string): string[] => {
    if (!productTitle) return [];
    
    // Remove common stop words and extract meaningful keywords
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'
    ]);
    
    return productTitle
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10);
  }
};

export default marketIntelligenceAPI; 