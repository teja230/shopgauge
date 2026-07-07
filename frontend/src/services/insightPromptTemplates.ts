import type { AggregatedDashboardData } from '../types/businessIntelligence';

export interface PromptTemplate {
  type: 'summary' | 'trends' | 'costs' | 'recommendations' | 'question';
  template: string;
  maxTokens: number;
  priority: 'high' | 'medium' | 'low';
}

export type InsightDataType = 'revenue' | 'products' | 'orders' | 'competitors' | 'costs';

export type InsightIntent = InsightDataType | 'recommendations' | 'summary';

export interface InsightRequest {
  type: PromptTemplate['type'];
  data: Partial<AggregatedDashboardData>;
  userQuestion?: string;
  context?: {
    timeframe: string;
    focus: string[];
    previousInsights?: string[];
    userQuestion?: string;
    dataTypes?: InsightDataType[];
    intent?: InsightIntent;
  };
}

type CompetitorRecord = AggregatedDashboardData['marketIntelligence']['competitors'][number];

export class InsightPromptTemplates {
  /**
   * Generate executive summary with key metrics and trends
   */
  static getExecutiveSummary(): PromptTemplate {
    return {
      type: 'summary',
      maxTokens: 300,
      priority: 'high',
      template: `
Analyze the following e-commerce dashboard data and provide a concise executive summary (max 200 words).

Focus on:
- Key performance indicators and their trends
- Critical business insights
- Urgent actions needed
- Competitive positioning

Data:
{DATA}

Format as a business-focused narrative highlighting the most important trends and actionable insights. Use specific numbers and percentages.`
    };
  }

  /**
   * Analyze trends and growth patterns
   */
  static getTrendsAnalysis(): PromptTemplate {
    return {
      type: 'trends',
      maxTokens: 250,
      priority: 'medium',
      template: `
Analyze the trends in this e-commerce data and identify patterns:

Revenue trends: {REVENUE_DATA}
Product performance: {PRODUCTS_DATA}
Order patterns: {ORDERS_DATA}
Competitor changes: {COMPETITORS_DATA}

Provide insights on:
1. Growth trajectories (positive/negative trends)
2. Seasonal or cyclical patterns
3. Performance drivers
4. Potential concerns

Keep analysis under 150 words, focus on actionable insights.`
    };
  }

  /**
   * Cost optimization and budget analysis
   */
  static getCostAnalysis(): PromptTemplate {
    return {
      type: 'costs',
      maxTokens: 200,
      priority: 'high',
      template: [
        'Analyze the cost structure and provide optimization recommendations:',
        '',
        'Market Intelligence Costs:',
        '- Daily: ${{DAILY_COST}}',
        '- Monthly: ${{MONTHLY_COST}}',
        '- Budget usage: {{BUDGET_USAGE}}%',
        '- Requests: {{REQUESTS}}',
        '',
        'Revenue Context:',
        '- Total Revenue: ${{TOTAL_REVENUE}}',
        '- Revenue Growth: {{REVENUE_GROWTH}}%',
        '',
        'Competitor Analysis ROI:',
        '- Active competitors: {{COMPETITOR_COUNT}}',
        '- Price monitoring value: {{COMPETITOR_VALUE}}',
        '',
        'Provide:',
        '1. Cost efficiency assessment',
        '2. ROI evaluation',
        '3. Optimization recommendations',
        '4. Budget allocation suggestions',
        '',
        'Max 120 words, focus on actionable cost optimizations.'
      ].join('\n')
    };
  }

  /**
   * Strategic recommendations based on all data
   */
  static getStrategicRecommendations(): PromptTemplate {
    return {
      type: 'recommendations',
      maxTokens: 300,
      priority: 'medium',
      template: `
Based on comprehensive dashboard analysis, provide strategic recommendations:

Current Performance:
{PERFORMANCE_SUMMARY}

Market Position:
{MARKET_INTELLIGENCE_SUMMARY}

Operational Metrics:
{OPERATIONAL_METRICS}

Generate 3-5 prioritized recommendations focusing on:
1. Revenue growth opportunities
2. Operational efficiency improvements  
3. Competitive advantages
4. Risk mitigation
5. Resource optimization

Each recommendation should include expected impact and implementation difficulty. Max 200 words total.`
    };
  }

  /**
   * Answer specific user questions
   */
  static getQuestionResponse(): PromptTemplate {
    return {
      type: 'question',
      maxTokens: 200,
      priority: 'high',
      template: `
Answer the following question about the e-commerce business using the provided data:

Question: "{USER_QUESTION}"

Relevant Data:
{RELEVANT_DATA}

Business Context:
- Shop: {SHOP_NAME}
- Data freshness: {DATA_FRESHNESS}
- Time period: {TIMEFRAME}

Provide a direct, data-driven answer with specific metrics and context. If the data doesn't fully answer the question, explain what's available and suggest additional analysis needed.

Max 120 words, be specific and actionable.`
    };
  }

  /**
   * Generate appropriate prompt based on request type and available data
   */
  static generatePrompt(request: InsightRequest): string {
    const template = this.getTemplateByType(request.type);
    let prompt = template.template;

    // Replace data placeholders
    prompt = this.replacePlaceholders(prompt, request);

    return prompt;
  }

  public static getTemplateByType(type: PromptTemplate['type']): PromptTemplate {
    switch (type) {
      case 'summary':
        return this.getExecutiveSummary();
      case 'trends':
        return this.getTrendsAnalysis();
      case 'costs':
        return this.getCostAnalysis();
      case 'recommendations':
        return this.getStrategicRecommendations();
      case 'question':
        return this.getQuestionResponse();
      default:
        return this.getExecutiveSummary();
    }
  }

  private static replacePlaceholders(template: string, request: InsightRequest): string {
    const { data, userQuestion, context } = request;
    let prompt = template;

    // Basic data replacements
    if (data.revenue) {
      prompt = prompt.replace('{REVENUE_DATA}', JSON.stringify({
        total: data.revenue.total,
        growth: data.revenue.growth,
        recentTrend: data.revenue.timeseries?.slice(-7) || []
      }));
      prompt = prompt.replace('{{TOTAL_REVENUE}}', data.revenue.total.toString());
      prompt = prompt.replace('{{REVENUE_GROWTH}}', (data.revenue.growth || 0).toFixed(1));
    }

    if (data.products) {
      prompt = prompt.replace('{PRODUCTS_DATA}', JSON.stringify({
        total: data.products.total,
        lowInventory: data.products.lowInventory,
        newProducts: data.products.newProducts,
        topProducts: data.products.topProducts?.slice(0, 3) || []
      }));
    }

    if (data.orders) {
      prompt = prompt.replace('{ORDERS_DATA}', JSON.stringify({
        total: data.orders.total,
        abandonedCarts: data.orders.abandonedCarts,
        conversionRate: data.orders.conversionRate,
        recentOrders: data.orders.recent?.slice(0, 3) || []
      }));
    }

    if (data.marketIntelligence) {
      const mi = data.marketIntelligence;
      prompt = prompt.replace('{COMPETITORS_DATA}', JSON.stringify(this.buildCompetitorContext(mi)));

      prompt = prompt.replace('{{DAILY_COST}}', mi.costs.daily.toFixed(2));
      prompt = prompt.replace('{{MONTHLY_COST}}', mi.costs.monthly.toFixed(2));
      prompt = prompt.replace('{{BUDGET_USAGE}}', mi.costs.budgetUsage.toFixed(1));
      prompt = prompt.replace('{{REQUESTS}}', mi.costs.requests.toString());
      prompt = prompt.replace('{{COMPETITOR_COUNT}}', mi.competitors.length.toString());
      prompt = prompt.replace('{{COMPETITOR_VALUE}}', this.estimateCompetitorValue(mi.competitors));
    }

    // Context replacements
    if (context) {
      prompt = prompt.replace('{TIMEFRAME}', context.timeframe);
    }

    if (data.metadata) {
      prompt = prompt.replace('{SHOP_NAME}', data.metadata.shop);
      prompt = prompt.replace('{DATA_FRESHNESS}', this.formatFreshness(data.metadata.freshness));
    }

    // Question replacement (top-level takes precedence over context)
    const question = userQuestion || context?.userQuestion;
    if (question) {
      prompt = prompt.replace('{USER_QUESTION}', question);
    }

    // Comprehensive data replacement for summary/recommendations
    const relevantData = this.formatRelevantData(data, request.type, context?.dataTypes);
    prompt = prompt.replace('{DATA}', relevantData);
    prompt = prompt.replace('{RELEVANT_DATA}', relevantData);
    prompt = prompt.replace('{PERFORMANCE_SUMMARY}', this.generatePerformanceSummary(data));
    prompt = prompt.replace('{MARKET_INTELLIGENCE_SUMMARY}', this.generateMarketIntelligenceSummary(data));
    prompt = prompt.replace('{OPERATIONAL_METRICS}', this.generateOperationalMetrics(data));

    return prompt;
  }

  private static calculateAvgPriceDiff(competitors: any[]): string {
    if (competitors.length === 0) return '0%';
    const avg = competitors.reduce((sum, c) => sum + (c.percentDiff || 0), 0) / competitors.length;
    return `${avg.toFixed(1)}%`;
  }

  private static readonly STALE_CHECK_MS = 24 * 60 * 60 * 1000;

  /**
   * Rich competitor snapshot for prompts: named competitors ranked by how far
   * their price sits from ours, stock split, stale checks, and monitoring spend.
   */
  static buildCompetitorContext(mi: Partial<AggregatedDashboardData>['marketIntelligence']) {
    const competitors: CompetitorRecord[] = mi?.competitors || [];
    const now = Date.now();
    const staleChecks = competitors.filter((c) => {
      const checked = new Date(c.lastChecked).getTime();
      return !Number.isFinite(checked) || now - checked > this.STALE_CHECK_MS;
    }).length;

    const topByGap = [...competitors]
      .sort((a, b) => Math.abs(b.percentDiff || 0) - Math.abs(a.percentDiff || 0))
      .slice(0, 3)
      .map((c) => ({
        name: c.name,
        price: `$${(c.price || 0).toFixed(2)}`,
        priceGap: `${(c.percentDiff || 0) > 0 ? '+' : ''}${(c.percentDiff || 0).toFixed(1)}% vs your price`,
        inStock: c.inStock,
        lastChecked: c.lastChecked
      }));

    return {
      count: competitors.length,
      topCompetitorsByPriceGap: topByGap,
      avgPriceGap: this.calculateAvgPriceDiff(competitors),
      inStockCount: competitors.filter((c) => c.inStock).length,
      outOfStockCount: competitors.filter((c) => !c.inStock).length,
      staleChecks,
      pendingSuggestions: mi?.suggestions || 0,
      monitoringCosts: mi?.costs
        ? {
            daily: `$${mi.costs.daily.toFixed(2)}`,
            monthly: `$${mi.costs.monthly.toFixed(2)}`,
            budgetUsage: `${mi.costs.budgetUsage.toFixed(1)}%`
          }
        : undefined
    };
  }

  private static estimateCompetitorValue(competitors: any[]): string {
    // Simple heuristic: number of competitors * average price monitoring value
    const value = competitors.length * 50; // $50 value per competitor monitored
    return `$${value}`;
  }

  private static formatFreshness(freshness: Record<string, number>): string {
    const entries = Object.entries(freshness);
    if (entries.length === 0) return 'Unknown';
    
    const avgFreshness = entries.reduce((sum, [_, minutes]) => sum + minutes, 0) / entries.length;
    
    if (avgFreshness < 5) return 'Very Fresh (< 5 min)';
    if (avgFreshness < 30) return 'Fresh (< 30 min)';
    if (avgFreshness < 120) return 'Recent (< 2 hours)';
    return 'Older (> 2 hours)';
  }

  private static formatRelevantData(
    data: Partial<AggregatedDashboardData>,
    type: PromptTemplate['type'],
    dataTypes?: InsightDataType[]
  ): string {
    const formatted: any = {};
    const wants = (dataType: InsightDataType) => !dataTypes || dataTypes.includes(dataType);

    if (data.revenue && wants('revenue')) {
      formatted.revenue = {
        total: `$${data.revenue.total.toLocaleString()}`,
        growth: `${(data.revenue.growth || 0).toFixed(1)}%`,
        dataPoints: data.revenue.timeseries?.length || 0
      };
    }

    if (data.products && wants('products')) {
      formatted.products = {
        total: data.products.total,
        lowInventory: data.products.lowInventory,
        newProducts: data.products.newProducts,
        topProducts: data.products.topProducts?.slice(0, 3) || []
      };
    }

    if (data.orders && wants('orders')) {
      formatted.orders = {
        total: data.orders.total,
        abandoned: data.orders.abandonedCarts,
        conversion: data.orders.conversionRate ? `${data.orders.conversionRate.toFixed(1)}%` : 'N/A'
      };
    }

    if (data.marketIntelligence && wants('competitors')) {
      formatted.competition = this.buildCompetitorContext(data.marketIntelligence);
    }

    if (data.marketIntelligence && wants('costs')) {
      formatted.monitoringCosts = {
        daily: `$${data.marketIntelligence.costs.daily.toFixed(2)}`,
        monthly: `$${data.marketIntelligence.costs.monthly.toFixed(2)}`,
        budgetUsage: `${data.marketIntelligence.costs.budgetUsage.toFixed(1)}%`
      };
    }

    return JSON.stringify(formatted, null, 2);
  }

  private static generatePerformanceSummary(data: Partial<AggregatedDashboardData>): string {
    const parts = [];
    
    if (data.revenue) {
      parts.push(`Revenue: $${data.revenue.total.toLocaleString()} (${(data.revenue.growth || 0).toFixed(1)}% growth)`);
    }
    
    if (data.orders) {
      parts.push(`Orders: ${data.orders.total}, Conversion: ${data.orders.conversionRate?.toFixed(1) || 'N/A'}%`);
    }
    
    if (data.products) {
      parts.push(`Products: ${data.products.total}, Low Stock: ${data.products.lowInventory}`);
    }
    
    return parts.join(', ');
  }

  private static generateMarketIntelligenceSummary(data: Partial<AggregatedDashboardData>): string {
    if (!data.marketIntelligence) return 'No market intelligence data available';
    
    const mi = data.marketIntelligence;
    return `Monitoring ${mi.competitors.length} competitors, Avg price diff: ${this.calculateAvgPriceDiff(mi.competitors)}, Daily cost: $${mi.costs.daily.toFixed(2)}`;
  }

  private static generateOperationalMetrics(data: Partial<AggregatedDashboardData>): string {
    const metrics = [];
    
    if (data.products?.lowInventory) {
      metrics.push(`${data.products.lowInventory} low-stock items`);
    }
    
    if (data.orders?.abandonedCarts) {
      metrics.push(`${data.orders.abandonedCarts} abandoned carts`);
    }
    
    if (data.marketIntelligence?.costs.budgetUsage) {
      metrics.push(`${data.marketIntelligence.costs.budgetUsage.toFixed(1)}% budget used`);
    }
    
    return metrics.join(', ') || 'No operational concerns';
  }

  /**
   * Get token estimate for prompt
   */
  static estimateTokens(prompt: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(prompt.length / 4);
  }

  /**
   * Optimize prompt for cost by reducing detail if needed
   */
  static optimizeForCost(prompt: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokens(prompt);
    
    if (estimatedTokens <= maxTokens) {
      return prompt;
    }
    
    // Simple optimization: truncate and add ellipsis
    const targetLength = maxTokens * 4 * 0.9; // 90% of max to be safe
    
    if (prompt.length > targetLength) {
      return prompt.substring(0, targetLength - 20) + '...[truncated for cost optimization]';
    }
    
    return prompt;
  }
}

export default InsightPromptTemplates;
