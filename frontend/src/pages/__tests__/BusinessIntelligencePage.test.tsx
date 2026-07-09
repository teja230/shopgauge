import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AggregatedDashboardData } from '../../types/businessIntelligence';

const mockAggregateShopData = vi.fn();
const mockGenerateInsight = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    shop: 'test-shop.myshopify.com',
    isDemoMode: false,
  }),
}));

vi.mock('../../services/dataAggregationService', () => ({
  default: { aggregateShopData: (...args: any[]) => mockAggregateShopData(...args) },
}));

vi.mock('../../services/aiInsightsService', () => ({
  default: { generateInsight: (...args: any[]) => mockGenerateInsight(...args) },
}));

import BusinessIntelligencePage from '../BusinessIntelligencePage';

const buildData = (competitorCount = 2): AggregatedDashboardData => ({
  revenue: { total: 42500, timeseries: [{ date: '2026-07-01', revenue: 1500 }], growth: 6.2 },
  products: { total: 24, lowInventory: 0, newProducts: 3, topProducts: [] },
  orders: { total: 156, recent: [], abandonedCarts: 2, conversionRate: 3.4 },
  marketIntelligence: {
    competitors: Array.from({ length: competitorCount }, (_, i) => ({
      name: `Competitor ${i + 1}`,
      url: `https://competitor${i + 1}.com`,
      price: 20 + i,
      percentDiff: i === 0 ? -10 : 12,
      inStock: i === 0,
      lastChecked: new Date().toISOString(),
    })),
    suggestions: 3,
    costs: { daily: 2.5, monthly: 75, requests: 12, budgetUsage: 30 },
  },
  insights: { conversionRate: 3.4, topSellingProducts: [], abandonedCartCount: 2, insightText: '' },
  metadata: {
    shop: 'test-shop.myshopify.com',
    timestamp: new Date().toISOString(),
    dataPoints: 5,
    freshness: { revenue: 0, products: 0, orders: 0, competitors: 0, costs: 0 },
  },
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/business-intelligence']}>
      <BusinessIntelligencePage />
    </MemoryRouter>
  );

describe('BusinessIntelligencePage (ShopGPT)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateInsight.mockResolvedValue({
      insight: 'Generated insight text.',
      confidence: 0.85,
      cost: 0,
      fromCache: false,
      source: 'local',
      metadata: { tokens: 0, processingTime: 0, dataFreshness: 'Fresh' },
    });
  });

  it('shows the data status chip and freshness once store data loads', async () => {
    mockAggregateShopData.mockResolvedValue(buildData(2));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Live data')).toBeInTheDocument();
    });
    expect(screen.getByText(/^Updated/)).toBeInTheDocument();
  });

  it('renders competitor-aware prompt cards when competitors exist', async () => {
    mockAggregateShopData.mockResolvedValue(buildData(2));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('How do I compare to my 2 competitors?')).toBeInTheDocument();
    });
    expect(screen.getByText('Which competitors are out of stock right now?')).toBeInTheDocument();
    expect(screen.queryByTestId('start-monitoring-cta')).not.toBeInTheDocument();
  });

  it('shows a start-monitoring CTA when no competitors are monitored', async () => {
    mockAggregateShopData.mockResolvedValue(buildData(0));
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('start-monitoring-cta')).toBeInTheDocument();
    });
    expect(screen.queryByText(/compare to my/)).not.toBeInTheDocument();
  });

  it('submits chat questions as question-type requests with top-level userQuestion and detected dataTypes', async () => {
    mockAggregateShopData.mockResolvedValue(buildData(2));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Ask ShopGPT')).not.toBeDisabled();
    });

    fireEvent.change(screen.getByLabelText('Ask ShopGPT'), {
      target: { value: 'Am I overpriced compared to competitors?' },
    });
    fireEvent.click(screen.getByLabelText('Send question'));

    await waitFor(() => {
      const questionCall = mockGenerateInsight.mock.calls
        .map(([request]) => request)
        .find((request) => request.type === 'question');
      expect(questionCall).toBeTruthy();
      expect(questionCall.userQuestion).toBe('Am I overpriced compared to competitors?');
      expect(questionCall.context.intent).toBe('competitors');
      expect(questionCall.context.dataTypes).toContain('competitors');
    });
  });

  it('previews the data sources a typed question will use', async () => {
    mockAggregateShopData.mockResolvedValue(buildData(2));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Ask ShopGPT')).not.toBeDisabled();
    });

    fireEvent.change(screen.getByLabelText('Ask ShopGPT'), {
      target: { value: 'how do my competitors price this' },
    });

    const chips = await screen.findAllByTestId('composer-context-chip');
    expect(chips.map((chip) => chip.textContent)).toContain('Competitors');
  });

  it('renders the market context rail with named competitors', async () => {
    mockAggregateShopData.mockResolvedValue(buildData(2));
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('market-context')).toHaveTextContent('Competitor 1');
    });
    expect(screen.getByTestId('market-context')).toHaveTextContent('2 tracked');
  });
});
