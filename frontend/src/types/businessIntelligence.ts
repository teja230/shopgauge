export interface AggregatedDashboardData {
  // Revenue & Performance
  revenue: {
    total: number;
    timeseries: Array<{ date: string; revenue: number }>;
    growth?: number;
  };
  
  // Products & Inventory
  products: {
    total: number;
    lowInventory: number;
    newProducts: number;
    topProducts?: Array<{ name: string; sales: number; revenue: number }>;
  };
  
  // Orders & Conversion
  orders: {
    total: number;
    recent: Array<{ id: string; date: string; total: number; status: string }>;
    abandonedCarts: number;
    conversionRate?: number;
  };
  
  // Market Intelligence
  marketIntelligence: {
    competitors: Array<{
      name: string;
      url: string;
      price: number;
      percentDiff: number;
      inStock: boolean;
      lastChecked: string;
    }>;
    suggestions: number;
    costs: {
      daily: number;
      monthly: number;
      requests: number;
      budgetUsage: number;
    };
  };
  
  // Insights Summary
  insights: {
    conversionRate: number;
    topSellingProducts: Array<{ title: string; sales: number }>;
    abandonedCartCount: number;
    insightText: string;
  };
  
  // Metadata
  metadata: {
    shop: string;
    timestamp: string;
    dataPoints: number;
    freshness: Record<string, number>; // How old each data point is in minutes
  };
}

export interface InsightContext {
  timeframe: '24h' | '7d' | '30d' | '60d';
  dataTypes: ('revenue' | 'products' | 'orders' | 'competitors' | 'costs')[];
  shop: string;
}
