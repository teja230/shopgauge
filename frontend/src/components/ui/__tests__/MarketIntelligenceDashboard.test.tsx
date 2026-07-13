import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MarketIntelligenceDashboard from '../MarketIntelligenceDashboard';
import marketIntelligenceAdminAPI from '../../../api/marketIntelligenceAdmin';
import { NotificationSettingsProvider } from '../../../context/NotificationSettingsContext';

// Mock the API
vi.mock('../../../api/marketIntelligenceAdmin', () => ({
  default: {
    getAdminDashboard: vi.fn(),
    getCostHistory: vi.fn(),
    getCompetitorScrapingStatus: vi.fn(),
  }
}));

// Mock RefreshHeader component
vi.mock('../RefreshHeader', () => ({
  default: ({ onRefresh, loading }: any) => (
    <button onClick={onRefresh} disabled={loading}>
      {loading ? 'Loading...' : 'Refresh'}
    </button>
  )
}));

// Mock Recharts components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

const mockDashboardData = {
  systemStatus: {
    discoveryEnabled: true,
    costOptimizationEnabled: true,
    providersEnabled: true,
    timestamp: '2024-01-15T10:00:00Z'
  },
  costAnalytics: {
    todayCosts: { 'Provider1': 0.005 },
    thisMonthCosts: { 'Provider1': 0.15 },
    todayRequests: { 'Provider1': 5 },
    thisMonthRequests: { 'Provider1': 150 },
    totalDailyCost: 0.005,
    totalMonthlyCost: 0.15,
    totalDailyRequests: 5,
    totalMonthlyRequests: 150,
    dailyBudget: 5.00,
    monthlyBudget: 100.00,
    estimatedSavings: 2.50,
    dailyUsagePercentage: 10,
    monthlyUsagePercentage: 15
  },
  providerStats: {
    totalProviders: 3,
    enabledProviders: ['Scrapingdog', 'Serper'],
    providerCosts: { 'Scrapingdog': 0.005, 'Serper': 0.008 }
  },
  databaseStats: {
    competitorUrls: 10,
    suggestions: 5,
    priceSnapshots: 100,
    activeShops: 2
  },
  performanceMetrics: {
    avgResponseTime: '50ms',
    errorRate: '0.1%',
    uptime: '99.9%'
  },
  discoveryStats: {
    totalDiscoveries: 100,
    successfulDiscoveries: 95,
    failedDiscoveries: 5,
    successRate: 95.0,
    lastDiscoveryTime: '2024-01-15T10:30:00Z',
    averageDiscoveryTime: 2500
  }
};

const mockCostHistory = {
  historicalData: [
    { timestamp: '2024-01-15', dailyCost: 0.005, requests: 5, discoveries: 10 },
    { timestamp: '2024-01-16', dailyCost: 0.008, requests: 8, discoveries: 15 }
  ],
  providerData: {
    providerCosts: { 'Provider1': 0.15 },
    providerRequests: { 'Provider1': 150 },
    providerDiscoveries: { 'Provider1': 500 }
  },
  days: 30,
  shopId: 1,
  totalDays: 30
};

const renderDashboard = (props: React.ComponentProps<typeof MarketIntelligenceDashboard> = {}) =>
  render(
    <NotificationSettingsProvider>
      <MarketIntelligenceDashboard {...props} />
    </NotificationSettingsProvider>,
  );

describe('MarketIntelligenceDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (marketIntelligenceAdminAPI.getAdminDashboard as any).mockResolvedValue(mockDashboardData);
    (marketIntelligenceAdminAPI.getCostHistory as any).mockResolvedValue(mockCostHistory);
    (marketIntelligenceAdminAPI.getCompetitorScrapingStatus as any).mockResolvedValue({
      availableShops: [{ id: 1, shopify_domain: 'merchant.myshopify.com' }],
    });
  });

  it('renders dashboard title', async () => {
    renderDashboard();
    
    expect(await screen.findByText('Market Intelligence Dashboard')).toBeInTheDocument();
  });

  it('displays cost analytics correctly', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('$0.005')).toBeInTheDocument(); // Daily cost
      expect(screen.getByText('$0.15')).toBeInTheDocument(); // Monthly cost
      expect(screen.getByText('$2.50')).toBeInTheDocument(); // Estimated savings
    });
  });

  it('displays system status correctly', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    });
  });

  it('displays provider statistics', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument(); // Total providers
      expect(screen.getAllByText('2').length).toBeGreaterThan(0); // Enabled providers
      expect(screen.getByText('Scrapingdog')).toBeInTheDocument();
      expect(screen.getByText('Serper')).toBeInTheDocument();
    });
  });

  it('displays database statistics', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument(); // Competitor URLs
      expect(screen.getByText('5')).toBeInTheDocument(); // Suggestions
      expect(screen.getByText('100')).toBeInTheDocument(); // Price snapshots
      expect(screen.getAllByText('2').length).toBeGreaterThan(0); // Active shops
    });
  });

  it('displays performance metrics', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('50ms')).toBeInTheDocument(); // Avg response time
      expect(screen.getByText('0.1%')).toBeInTheDocument(); // Error rate
      expect(screen.getByText('99.9%')).toBeInTheDocument(); // Uptime
    });
  });

  it('renders cost trend chart', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Cost Trend (Last 30 Days)')).toBeInTheDocument();
      expect(screen.getByTestId('chart-container')).toBeInTheDocument();
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    (marketIntelligenceAdminAPI.getAdminDashboard as any).mockRejectedValue(
      new Error('API Error')
    );
    
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to load metrics')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    renderDashboard();
    
    // Should show loading initially
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('calls API on component mount', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(marketIntelligenceAdminAPI.getAdminDashboard).toHaveBeenCalledTimes(1);
    });
  });

  it('fetches cost history when active shops exist', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(marketIntelligenceAdminAPI.getCostHistory).toHaveBeenCalledWith(1, 30);
    });
  });

  it('displays budget usage percentages correctly', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('10.0% of budget')).toBeInTheDocument(); // Daily usage
      expect(screen.getByText('15.0% of budget')).toBeInTheDocument(); // Monthly usage
    });
  });

  it('shows system configuration details', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('System Configuration')).toBeInTheDocument();
      expect(screen.getByText('Discovery Enabled')).toBeInTheDocument();
      expect(screen.getByText('Cost Optimization')).toBeInTheDocument();
      expect(screen.getByText('Providers Active')).toBeInTheDocument();
    });
  });

  it('renders action buttons when showActions is true', async () => {
    renderDashboard({ showActions: true });
    
    await waitFor(() => {
      expect(screen.getByText('Test Search Providers')).toBeInTheDocument();
      expect(screen.getByText('Reset Cost Tracking')).toBeInTheDocument();
    });
  });

  it('hides action buttons when showActions is false', async () => {
    renderDashboard({ showActions: false });
    
    await waitFor(() => {
      expect(screen.queryByText('Test Search Providers')).not.toBeInTheDocument();
      expect(screen.queryByText('Reset Cost Tracking')).not.toBeInTheDocument();
    });
  });
});
