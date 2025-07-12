import { fetchWithAuth } from './index';

// Types for Market Intelligence API (shop/user endpoints only)
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

// Market Intelligence API functions (shop/user endpoints only)
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
};

export default marketIntelligenceAPI; 