import { fetchWithAuth } from '../api';
import { marketIntelligenceAPI } from '../api/marketIntelligence';
import marketIntelligenceAdminAPI from '../api/marketIntelligenceAdmin';
import type { AggregatedDashboardData, InsightContext } from '../types/businessIntelligence';
import { DEMO_DATA_BUNDLE } from '../data/demoDataBundle';

class DataAggregationService {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  /**
   * Aggregate all dashboard and market intelligence data
   */
  async aggregateShopData(shop: string, forceRefresh = false): Promise<AggregatedDashboardData> {
    // Check if demo mode is active
    const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                      new URLSearchParams(window.location.search).get('demo') === 'true' ||
                      shop === 'demo-shopgauge.myshopify.com';
    
    const cacheKey = `aggregated_${shop}_${isDemoMode ? 'demo' : 'live'}`;
    
    if (!forceRefresh && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < cached.ttl) {
        return cached.data;
      }
    }

    console.log('🔄 Aggregating shop data for insights generation:', shop, isDemoMode ? '(Demo Mode)' : '(Live Mode)');
    
    // If in demo mode, use the unified demo data bundle
    if (isDemoMode) {
      return this.aggregateDemoData(shop);
    }
    
    const startTime = Date.now();
    const freshness: Record<string, number> = {};
    
    // Parallel data fetching for performance
    const [
      revenueData,
      productsData,
      inventoryData,
      ordersData,
      competitorsData,
      costAnalytics,
      insightsData
    ] = await Promise.allSettled([
      this.fetchRevenueData(shop),
      this.fetchProductsData(shop),
      this.fetchInventoryData(shop),
      this.fetchOrdersData(shop),
      this.fetchCompetitorsData(),
      this.fetchCostAnalytics(),
      this.fetchInsightsData(shop)
    ]);

    // Process results and track freshness
    const processedRevenue = this.processRevenueData(revenueData, freshness);
    const processedProducts = this.processProductsData(productsData, inventoryData, freshness);
    const processedOrders = this.processOrdersData(ordersData, insightsData, freshness);
    const processedMarketIntelligence = this.processMarketIntelligenceData(competitorsData, costAnalytics, freshness);
    
    const aggregatedData: AggregatedDashboardData = {
      revenue: processedRevenue,
      products: processedProducts,
      orders: processedOrders,
      marketIntelligence: processedMarketIntelligence,
      metadata: {
        shop,
        timestamp: new Date().toISOString(),
        dataPoints: 0, // Will be calculated after
        freshness
      }
    };
    
    // Calculate data points after creating the object
    aggregatedData.metadata.dataPoints = this.calculateDataPoints(aggregatedData);

    // Cache the aggregated data
    this.cache.set(cacheKey, {
      data: aggregatedData,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    });

    console.log(`✅ Data aggregation completed in ${Date.now() - startTime}ms`);
    return aggregatedData;
  }

  private async fetchRevenueData(shop: string) {
    try {
      const [totalResponse, timeseriesResponse] = await Promise.all([
        fetchWithAuth('/api/analytics/revenue'),
        fetchWithAuth('/api/analytics/revenue/timeseries')
      ]);
      
      const totalData = await totalResponse.json();
      const timeseriesData = await timeseriesResponse.json();
      
      return {
        total: totalData.total_revenue || 0,
        timeseries: timeseriesData.timeseries || [],
        growth: this.calculateGrowth(timeseriesData.timeseries || [])
      };
    } catch (error) {
      console.warn('Revenue data fetch failed:', error);
      return { total: 0, timeseries: [], growth: 0 };
    }
  }

  private async fetchProductsData(shop: string) {
    try {
      const [productsResponse, newProductsResponse] = await Promise.all([
        fetchWithAuth('/api/analytics/products'),
        fetchWithAuth('/api/analytics/new_products')
      ]);
      
      const productsData = await productsResponse.json();
      const newProductsData = await newProductsResponse.json();
      
      return {
        products: productsData.products || [],
        newProducts: newProductsData.new_products_count || 0
      };
    } catch (error) {
      console.warn('Products data fetch failed:', error);
      return { products: [], newProducts: 0 };
    }
  }

  private async fetchInventoryData(shop: string) {
    try {
      const response = await fetchWithAuth('/api/analytics/inventory/low');
      const data = await response.json();
      return {
        lowInventory: data.low_inventory_count || 0,
        lowInventoryProducts: data.low_inventory_products || []
      };
    } catch (error) {
      console.warn('Inventory data fetch failed:', error);
      return { lowInventory: 0, lowInventoryProducts: [] };
    }
  }

  private async fetchOrdersData(shop: string) {
    try {
      const [ordersResponse, cartsResponse] = await Promise.all([
        fetchWithAuth('/api/analytics/orders/timeseries?limit=10'),
        fetchWithAuth('/api/analytics/abandoned_carts')
      ]);
      
      const ordersData = await ordersResponse.json();
      const cartsData = await cartsResponse.json();
      
      return {
        orders: ordersData.orders || [],
        recentOrders: ordersData.recent_orders || [],
        abandonedCarts: cartsData.abandoned_carts || 0
      };
    } catch (error) {
      console.warn('Orders data fetch failed:', error);
      return { orders: [], recentOrders: [], abandonedCarts: 0 };
    }
  }

  private async fetchCompetitorsData() {
    try {
      const competitors = await marketIntelligenceAPI.getCompetitors();
      return competitors || [];
    } catch (error) {
      console.warn('Competitors data fetch failed:', error);
      return [];
    }
  }

  private async fetchCostAnalytics() {
    try {
      const dashboard = await marketIntelligenceAdminAPI.getAdminDashboard();
      return dashboard.costAnalytics;
    } catch (error) {
      console.warn('Cost analytics fetch failed:', error);
      return null;
    }
  }

  private async fetchInsightsData(shop: string) {
    try {
      const response = await fetchWithAuth('/api/analytics/insights');
      return await response.json();
    } catch (error) {
      console.warn('Insights data fetch failed:', error);
      return {};
    }
  }

  private processRevenueData(revenueResult: PromiseSettledResult<any>, freshness: Record<string, number>) {
    if (revenueResult.status === 'fulfilled') {
      freshness.revenue = 0; // Fresh data
      return revenueResult.value;
    }
    freshness.revenue = 999; // Error/stale data
    // Provide realistic demo data when APIs fail
    return this.generateDemoRevenueData();
  }

  /**
   * Aggregate demo data from the unified DEMO_DATA_BUNDLE
   * This ensures consistency with Dashboard and Market Intelligence
   */
  private async aggregateDemoData(shop: string): Promise<AggregatedDashboardData> {
    console.log('📦 Using unified DEMO_DATA_BUNDLE for ShopGPT');
    
    const demoData = DEMO_DATA_BUNDLE;
    const analytics = demoData.analytics;
    const products = demoData.products;
    const competitors = demoData.competitors;
    
    // Calculate top products from the demo products
    const topProducts = products
      .slice(0, 5)
      .map(p => ({
        name: p.title,
        revenue: p.price * Math.floor(Math.random() * 50 + 10), // Simulated sales
        quantity: p.inventory_quantity
      }));
    
    // Build aggregated data structure from DEMO_DATA_BUNDLE
    const aggregatedData: AggregatedDashboardData = {
      revenue: {
        total: analytics.revenue.total_revenue,
        timeseries: analytics.revenue.daily_revenue.map(d => ({
          date: d.date,
          revenue: d.revenue
        })),
        growth: analytics.revenue.revenue_growth
      },
      products: {
        total: analytics.inventory.total_products,
        lowInventory: analytics.inventory.low_stock_count,
        newProducts: analytics.inventory.new_products_this_month,
        topProducts
      },
      inventory: {
        totalProducts: analytics.inventory.total_products,
        lowStockCount: analytics.inventory.low_stock_count,
        outOfStockCount: analytics.inventory.out_of_stock_count
      },
      orders: {
        total: analytics.orders.total_orders,
        abandonedCarts: analytics.inventory.abandoned_cart_count,
        conversionRate: analytics.orders.conversion_rate,
        recentOrders: analytics.orders.daily_orders.slice(0, 5).map(o => ({
          id: o.order_id,
          amount: o.total_price,
          date: o.created_at
        }))
      },
      marketIntelligence: {
        competitors: competitors.map(c => ({
          name: c.name,
          url: c.url,
          price: c.current_price,
          percentDiff: Math.round((c.price_difference / c.our_price) * 100),
          inStock: c.status === 'active',
          lastChecked: c.last_checked
        })),
        costs: {
          daily: 15.75, // Realistic demo cost
          monthly: 15.75 * 30,
          budgetUsage: 68.5
        },
        suggestions: competitors.length // Number of suggestions based on competitors
      },
      insights: {
        conversionRate: analytics.orders.conversion_rate,
        topSellingProducts: topProducts.slice(0, 3).map(p => ({
          title: p.name,
          sales: Math.floor(p.revenue / 100) // Approximate sales count
        })),
        abandonedCartCount: analytics.inventory.abandoned_cart_count,
        insightText: `Your store has generated ${analytics.revenue.total_revenue.toLocaleString('en-US', { 
          style: 'currency', 
          currency: 'USD', 
          minimumFractionDigits: 0 
        })} in revenue with ${analytics.orders.total_orders} orders and a ${analytics.orders.conversion_rate}% conversion rate.`
      },
      metadata: {
        shop: shop || 'demo-shopgauge.myshopify.com',
        timestamp: new Date().toISOString(),
        dataFreshness: {
          revenue: 1,
          products: 1,
          orders: 1,
          marketIntelligence: 1
        }
      }
    };
    
    // Cache the demo data
    this.cache.set(`aggregated_${shop}_demo`, {
      data: aggregatedData,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    });
    
    console.log('✅ ShopGPT using unified demo data:', {
      revenue: aggregatedData.revenue.total,
      products: aggregatedData.products.total,
      orders: aggregatedData.orders.total,
      competitors: aggregatedData.marketIntelligence.competitors.length
    });
    
    return aggregatedData;
  }

  // Demo data constants for consistent experience (DEPRECATED - kept for backward compatibility)
  private readonly DEMO_CONFIG = {
    revenue: {
      base: 42750,
      growth: 8.3,
      dailyValues: [1420, 1380, 1520, 1450, 1490, 1610, 1530]
    },
    products: {
      total: 24,
      lowInventory: 3,
      topProducts: [
        { name: 'Premium Widget', revenue: 8500, quantity: 120 },
        { name: 'Standard Gadget', revenue: 6200, quantity: 200 },
        { name: 'Basic Tool', revenue: 4100, quantity: 350 }
      ]
    },
    orders: {
      total: 156,
      abandonedCarts: 12,
      conversionRate: 92.8
    },
    competitors: {
      count: 5,
      monitored: ['ShopA', 'ShopB', 'ShopC', 'ShopD', 'ShopE']
    },
    costs: {
      daily: 12.45,
      budgetUsage: 62.3
    }
  };

  private generateDemoRevenueData() {
    // Use unified DEMO_DATA_BUNDLE for consistency
    const analytics = DEMO_DATA_BUNDLE.analytics;
    return {
      total: analytics.revenue.total_revenue,
      timeseries: analytics.revenue.daily_revenue.slice(0, 7).map(d => ({
        date: d.date,
        revenue: d.revenue
      })),
      growth: analytics.revenue.revenue_growth
    };
  }

  private processProductsData(
    productsResult: PromiseSettledResult<any>,
    inventoryResult: PromiseSettledResult<any>,
    freshness: Record<string, number>
  ) {
    const products = productsResult.status === 'fulfilled' ? productsResult.value : null;
    const inventory = inventoryResult.status === 'fulfilled' ? inventoryResult.value : null;
    
    freshness.products = productsResult.status === 'fulfilled' ? 0 : 999;
    freshness.inventory = inventoryResult.status === 'fulfilled' ? 0 : 999;
    
    if (products && inventory) {
      return {
        total: products.products?.length || 0,
        lowInventory: inventory.lowInventory || 0,
        newProducts: products.newProducts || 0,
        topProducts: products.products?.slice(0, 5)?.map((p: any) => ({
          name: p.title || p.name,
          sales: p.total_sales || 0,
          revenue: p.revenue || 0
        })) || []
      };
    }
    
    // Generate realistic demo data when APIs fail
    return this.generateDemoProductsData();
  }

  private generateDemoProductsData() {
    // Use unified DEMO_DATA_BUNDLE for consistency
    const analytics = DEMO_DATA_BUNDLE.analytics;
    const products = DEMO_DATA_BUNDLE.products;
    
    // Get top 5 products with simulated sales data
    const topProducts = products.slice(0, 5).map(p => ({
      name: p.title,
      sales: Math.floor(Math.random() * 200 + 50),
      revenue: p.price * Math.floor(Math.random() * 100 + 20)
    }));
    
    return {
      total: analytics.inventory.total_products,
      lowInventory: analytics.inventory.low_stock_count,
      newProducts: analytics.inventory.new_products_this_month,
      topProducts
    };
  }

  private processOrdersData(
    ordersResult: PromiseSettledResult<any>,
    insightsResult: PromiseSettledResult<any>,
    freshness: Record<string, number>
  ) {
    const orders = ordersResult.status === 'fulfilled' ? ordersResult.value : null;
    const insights = insightsResult.status === 'fulfilled' ? insightsResult.value : null;
    
    freshness.orders = ordersResult.status === 'fulfilled' ? 0 : 999;
    
    if (orders && insights) {
      return {
        total: orders.orders?.length || 0,
        recent: orders.recentOrders?.slice(0, 5)?.map((o: any) => ({
          id: o.id || o.order_id,
          date: o.created_at || o.date,
          total: o.total_price || o.total,
          status: o.fulfillment_status || o.status || 'pending'
        })) || [],
        abandonedCarts: orders.abandonedCarts || 0,
        conversionRate: insights.conversion_rate || undefined
      };
    }
    
    // Generate realistic demo data when APIs fail
    return this.generateDemoOrdersData();
  }

  private generateDemoOrdersData() {
    // Use unified DEMO_DATA_BUNDLE for consistency
    const analytics = DEMO_DATA_BUNDLE.analytics;
    
    const recentOrders = analytics.orders.daily_orders.slice(0, 5).map(o => ({
      id: o.order_id,
      date: o.created_at,
      total: o.total_price,
      status: 'fulfilled'
    }));
    
    return {
      total: analytics.orders.total_orders,
      recent: recentOrders,
      abandonedCarts: analytics.inventory.abandoned_cart_count,
      conversionRate: analytics.orders.conversion_rate
    };
  }

  private processMarketIntelligenceData(
    competitorsResult: PromiseSettledResult<any>,
    costResult: PromiseSettledResult<any>,
    freshness: Record<string, number>
  ) {
    const competitors = competitorsResult.status === 'fulfilled' ? competitorsResult.value : null;
    const costs = costResult.status === 'fulfilled' ? costResult.value : null;
    
    freshness.competitors = competitorsResult.status === 'fulfilled' ? 0 : 999;
    freshness.costs = costResult.status === 'fulfilled' ? 0 : 999;
    
    if (competitors && costs) {
      return {
        competitors: competitors.map((c: any) => ({
          url: c.url,
          price: c.price || 0,
          percentDiff: c.percentDiff || 0,
          inStock: c.inStock || false,
          lastChecked: c.lastChecked || new Date().toISOString()
        })),
        suggestions: 0, // Would need to fetch separately
        costs: {
          daily: costs?.totalDailyCost || 0,
          monthly: costs?.totalMonthlyCost || 0,
          requests: costs?.totalDailyRequests || 0,
          budgetUsage: costs?.dailyUsagePercentage || 0
        }
      };
    }
    
    // Generate realistic demo data when APIs fail
    return this.generateDemoMarketIntelligenceData();
  }

  private generateDemoMarketIntelligenceData() {
    // Use unified DEMO_DATA_BUNDLE for consistency
    const competitors = DEMO_DATA_BUNDLE.competitors;
    
    const competitorData = competitors.map(c => ({
      url: c.url,
      price: c.current_price,
      percentDiff: Math.round((c.price_difference / c.our_price) * 100),
      inStock: c.status === 'active',
      lastChecked: c.last_checked
    }));
    
    return {
      competitors: competitorData,
      suggestions: competitors.length,
      costs: {
        daily: 15.75,
        monthly: 15.75 * 30,
        requests: 124, // Estimate requests based on cost
        budgetUsage: 68.5
      }
    };
  }

  private calculateGrowth(timeseries: Array<{ date: string; revenue: number }>): number {
    if (timeseries.length < 2) return 0;
    
    const sorted = [...timeseries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latest = sorted[sorted.length - 1]?.revenue || 0;
    const previous = sorted[sorted.length - 2]?.revenue || 0;
    
    if (previous === 0) return 0;
    return ((latest - previous) / previous) * 100;
  }

  private calculateDataPoints(data: Partial<AggregatedDashboardData>): number {
    let count = 0;
    if (data.revenue?.timeseries) count += data.revenue.timeseries.length;
    if (data.products?.topProducts) count += data.products.topProducts.length;
    if (data.orders?.recent) count += data.orders.recent.length;
    if (data.marketIntelligence?.competitors) count += data.marketIntelligence.competitors.length;
    return count;
  }

  /**
   * Get specific data subset for focused analysis
   */
  async getDataSubset(shop: string, types: string[], timeframe: string = '7d'): Promise<Partial<AggregatedDashboardData>> {
    const fullData = await this.aggregateShopData(shop);
    const subset: Partial<AggregatedDashboardData> = { metadata: fullData.metadata };
    
    if (types.includes('revenue')) subset.revenue = fullData.revenue;
    if (types.includes('products')) subset.products = fullData.products;
    if (types.includes('orders')) subset.orders = fullData.orders;
    if (types.includes('competitors')) subset.marketIntelligence = fullData.marketIntelligence;
    
    return subset;
  }

  /**
   * Clear cache for a specific shop
   */
  clearCache(shop?: string) {
    if (shop) {
      this.cache.delete(`aggregated_${shop}`);
    } else {
      this.cache.clear();
    }
  }
}

export const dataAggregationService = new DataAggregationService();
export default dataAggregationService;
