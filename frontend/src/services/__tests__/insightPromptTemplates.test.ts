import { describe, it, expect } from 'vitest';
import InsightPromptTemplates from '../insightPromptTemplates';
import type { InsightRequest } from '../insightPromptTemplates';
import type { AggregatedDashboardData } from '../../types/businessIntelligence';

const buildData = (overrides: Partial<AggregatedDashboardData> = {}): AggregatedDashboardData => ({
  revenue: { total: 42500, timeseries: [{ date: '2026-07-01', revenue: 1500 }], growth: 6.2 },
  products: { total: 24, lowInventory: 2, newProducts: 3, topProducts: [{ name: 'Widget', sales: 40, revenue: 900 }] },
  orders: {
    total: 156,
    recent: [{ id: '1', date: '2026-07-01', total: 89, status: 'fulfilled' }],
    abandonedCarts: 8,
    conversionRate: 3.4,
  },
  marketIntelligence: {
    competitors: [
      {
        name: 'Rival Store',
        url: 'https://rivalstore.com',
        price: 24.99,
        percentDiff: -12.5,
        inStock: true,
        lastChecked: new Date().toISOString(),
      },
      {
        name: 'Premium Shop',
        url: 'https://premiumshop.com',
        price: 39.99,
        percentDiff: 18.0,
        inStock: false,
        lastChecked: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    suggestions: 4,
    costs: { daily: 3.5, monthly: 105, requests: 20, budgetUsage: 42 },
  },
  insights: { conversionRate: 3.4, topSellingProducts: [], abandonedCartCount: 8, insightText: '' },
  metadata: { shop: 'test-shop.myshopify.com', timestamp: new Date().toISOString(), dataPoints: 5, freshness: { revenue: 0 } },
  ...overrides,
});

describe('InsightPromptTemplates competitor context', () => {
  it('includes named competitors, gaps, and stock status for competitor questions', () => {
    const request: InsightRequest = {
      type: 'question',
      data: buildData(),
      userQuestion: 'How do I compare to competitors?',
      context: {
        timeframe: '7d',
        focus: ['competitors'],
        intent: 'competitors',
        dataTypes: ['competitors'],
        userQuestion: 'How do I compare to competitors?',
      },
    };

    const prompt = InsightPromptTemplates.generatePrompt(request);
    expect(prompt).toContain('How do I compare to competitors?');
    expect(prompt).toContain('Rival Store');
    expect(prompt).toContain('Premium Shop');
    expect(prompt).toContain('outOfStockCount');
    expect(prompt).toContain('pendingSuggestions');
  });

  it('omits competitor detail for revenue-only questions', () => {
    const request: InsightRequest = {
      type: 'question',
      data: buildData(),
      userQuestion: 'How is my revenue trending?',
      context: {
        timeframe: '7d',
        focus: ['revenue'],
        intent: 'revenue',
        dataTypes: ['revenue', 'orders'],
        userQuestion: 'How is my revenue trending?',
      },
    };

    const prompt = InsightPromptTemplates.generatePrompt(request);
    expect(prompt).toContain('42,500');
    expect(prompt).not.toContain('Rival Store');
  });

  it('produces honest empty competitor context when nothing is monitored', () => {
    const data = buildData();
    data.marketIntelligence.competitors = [];
    data.marketIntelligence.suggestions = 0;

    const context = InsightPromptTemplates.buildCompetitorContext(data.marketIntelligence);
    expect(context.count).toBe(0);
    expect(context.topCompetitorsByPriceGap).toEqual([]);
    expect(context.avgPriceGap).toBe('0%');
  });

  it('ranks top competitors by absolute price gap and counts stale checks', () => {
    const context = InsightPromptTemplates.buildCompetitorContext(buildData().marketIntelligence);
    // Premium Shop has the larger absolute gap (18% vs -12.5%)
    expect(context.topCompetitorsByPriceGap[0].name).toBe('Premium Shop');
    expect(context.topCompetitorsByPriceGap[0].priceGap).toContain('+18.0%');
    expect(context.inStockCount).toBe(1);
    expect(context.outOfStockCount).toBe(1);
    expect(context.staleChecks).toBe(1);
    expect(context.pendingSuggestions).toBe(4);
    expect(context.monitoringCosts?.daily).toBe('$3.50');
  });

  it('reads the user question from the top level of the request', () => {
    const request: InsightRequest = {
      type: 'question',
      data: buildData(),
      userQuestion: 'Am I overpriced?',
      context: { timeframe: '7d', focus: ['competitors'] },
    };
    const prompt = InsightPromptTemplates.generatePrompt(request);
    expect(prompt).toContain('Am I overpriced?');
    expect(prompt).not.toContain('{USER_QUESTION}');
  });
});
