import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../api', () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock('../../api/marketIntelligence', () => ({
  marketIntelligenceAPI: {
    getCompetitors: vi.fn(),
    getSuggestionCount: vi.fn(),
  },
}));

vi.mock('../../api/marketIntelligenceAdmin', () => ({
  default: {
    getAdminDashboard: vi.fn(),
  },
}));

import { DataAggregationService } from '../dataAggregationService';
import { fetchWithAuth } from '../../api';
import { marketIntelligenceAPI } from '../../api/marketIntelligence';
import marketIntelligenceAdminAPI from '../../api/marketIntelligenceAdmin';
import { DEMO_DATA_BUNDLE } from '../../data/demoDataBundle';

const fulfilled = <T,>(value: T): PromiseFulfilledResult<T> => ({ status: 'fulfilled', value });
const rejected = (reason = new Error('boom')): PromiseRejectedResult => ({ status: 'rejected', reason });

const liveCompetitors = [
  {
    id: '1',
    url: 'https://www.rivalstore.com/widget',
    label: 'Rival Store',
    price: 24.99,
    inStock: true,
    percentDiff: -8.5,
    lastChecked: new Date().toISOString(),
  },
  {
    id: '2',
    url: 'https://cheapgoods.io/widget',
    label: '',
    price: 19.99,
    inStock: false,
    percentDiff: -21.2,
    lastChecked: new Date().toISOString(),
  },
];

describe('DataAggregationService market intelligence processing', () => {
  let service: DataAggregationService;

  beforeEach(() => {
    service = new DataAggregationService();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('preserves live competitors when cost analytics fails', () => {
    const freshness: Record<string, number> = {};
    const result = service.processMarketIntelligenceData(
      fulfilled(liveCompetitors),
      rejected(),
      fulfilled(3),
      freshness
    );

    expect(result.competitors).toHaveLength(2);
    expect(result.competitors[0].name).toBe('Rival Store');
    expect(result.costs.daily).toBe(0);
    expect(freshness.competitors).toBe(0);
    expect(freshness.costs).toBe(999);
  });

  it('maps competitor label to name and falls back to hostname when label is empty', () => {
    const result = service.normalizeCompetitors(liveCompetitors);
    expect(result[0].name).toBe('Rival Store');
    expect(result[1].name).toBe('cheapgoods.io');
  });

  it('includes the fetched suggestion count', () => {
    const result = service.processMarketIntelligenceData(
      fulfilled(liveCompetitors),
      fulfilled({ totalDailyCost: 4.2, totalMonthlyCost: 126, totalDailyRequests: 42, dailyUsagePercentage: 31 }),
      fulfilled(7),
      {}
    );

    expect(result.suggestions).toBe(7);
    expect(result.costs.daily).toBe(4.2);
  });

  it('returns an empty competitor list (not demo data) when the competitors fetch fails in live mode', () => {
    const result = service.processMarketIntelligenceData(rejected(), rejected(), rejected(), {});
    expect(result.competitors).toEqual([]);
    const demoNames = DEMO_DATA_BUNDLE.competitors.map((c) => c.name);
    expect(result.competitors.map((c: any) => c.name)).not.toEqual(expect.arrayContaining(demoNames));
  });

  it('uses demo competitors only in demo mode', async () => {
    localStorage.setItem('demo_mode_active', 'true');
    const data = await service.aggregateShopData('demo-shopgauge.myshopify.com');

    expect(data.marketIntelligence.competitors.length).toBe(DEMO_DATA_BUNDLE.competitors.length);
    expect(data.marketIntelligence.competitors[0].name).toBe(DEMO_DATA_BUNDLE.competitors[0].name);
    // No live APIs should be hit in demo mode
    expect(marketIntelligenceAPI.getCompetitors).not.toHaveBeenCalled();
    expect(marketIntelligenceAdminAPI.getAdminDashboard).not.toHaveBeenCalled();
    expect(fetchWithAuth).not.toHaveBeenCalled();
  });

  it('normalizes malformed competitor entries without crashing', () => {
    const result = service.normalizeCompetitors([{ url: 'not a url' }]);
    expect(result[0]).toMatchObject({
      name: 'Unnamed competitor',
      price: 0,
      percentDiff: 0,
      inStock: false,
    });
    expect(result[0].lastChecked).toBeTruthy();
  });
});
