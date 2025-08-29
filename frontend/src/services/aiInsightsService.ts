import InsightPromptTemplates from './insightPromptTemplates';
import type { InsightRequest, PromptTemplate } from './insightPromptTemplates';
import type { AggregatedDashboardData } from '../types/businessIntelligence';

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'local' | 'fallback';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
  costPerToken: number; // USD per token
}

export interface InsightCache {
  key: string;
  insight: string;
  timestamp: number;
  cost: number;
  promptHash: string;
  dataHash: string;
}

export interface CostMetrics {
  totalCost: number;
  requestCount: number;
  averageCost: number;
  cacheHitRate: number;
  tokensSaved: number;
}

export interface GeneratedInsight {
  insight: string;
  confidence: number;
  cost: number;
  fromCache: boolean;
  source: 'ai' | 'local' | 'fallback';
  metadata: {
    tokens: number;
    processingTime: number;
    dataFreshness: string;
  };
}

/**
 * Cost-optimized AI service for generating business insights
 * Features:
 * - Smart caching to avoid duplicate AI calls
 * - Batching for efficiency
 * - Local fallback for basic insights
 * - Cost tracking and optimization
 */
class AIInsightsService {
  private config: AIConfig;
  private cache = new Map<string, InsightCache>();
  private costMetrics: CostMetrics = {
    totalCost: 0,
    requestCount: 0,
    averageCost: 0,
    cacheHitRate: 0,
    tokensSaved: 0
  };
  private batchQueue: Array<{ request: InsightRequest; resolve: Function; reject: Function }> = [];
  private batchTimer: NodeJS.Timeout | null = null;
  
  // Cache TTL based on insight type
  private readonly CACHE_TTL = {
    summary: 30 * 60 * 1000,      // 30 minutes - executive summary
    trends: 60 * 60 * 1000,       // 1 hour - trends change slowly
    costs: 15 * 60 * 1000,        // 15 minutes - costs are time-sensitive
    recommendations: 120 * 60 * 1000, // 2 hours - recommendations are strategic
    question: 10 * 60 * 1000      // 10 minutes - user questions need freshness
  };

  constructor(config: Partial<AIConfig> = {}) {
    this.config = {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      maxTokens: 400,
      temperature: 0.3,
      costPerToken: 0.0000015, // GPT-3.5-turbo pricing
      ...config
    };
  }

  /**
   * Generate insight with cost optimization
   */
  async generateInsight(request: InsightRequest): Promise<GeneratedInsight> {
    const startTime = Date.now();
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(request);
    
    // Check cache first
    const cached = this.getCachedInsight(cacheKey, request.type);
    if (cached) {
      return {
        insight: cached.insight,
        confidence: 0.9, // High confidence for cached results
        cost: 0,
        fromCache: true,
        source: 'ai',
        metadata: {
          tokens: 0,
          processingTime: Date.now() - startTime,
          dataFreshness: this.getDataFreshness(request.data)
        }
      };
    }

    // Try local fallback for simple insights first
    const localInsight = this.tryLocalInsight(request);
    if (localInsight) {
      return {
        insight: localInsight,
        confidence: 0.7,
        cost: 0,
        fromCache: false,
        source: 'local',
        metadata: {
          tokens: 0,
          processingTime: Date.now() - startTime,
          dataFreshness: this.getDataFreshness(request.data)
        }
      };
    }

    // Use AI for complex insights
    try {
      const aiResult = await this.generateAIInsight(request);
      
      // Cache the result
      this.cacheInsight(cacheKey, aiResult.insight, aiResult.cost, request);
      
      return {
        ...aiResult,
        fromCache: false,
        source: 'ai',
        metadata: {
          ...aiResult.metadata,
          processingTime: Date.now() - startTime,
          dataFreshness: this.getDataFreshness(request.data)
        }
      };
    } catch (error) {
      console.error('AI insight generation failed:', error);
      
      // Fallback to rule-based insight
      const fallbackInsight = this.generateFallbackInsight(request);
      return {
        insight: fallbackInsight,
        confidence: 0.5,
        cost: 0,
        fromCache: false,
        source: 'fallback',
        metadata: {
          tokens: 0,
          processingTime: Date.now() - startTime,
          dataFreshness: this.getDataFreshness(request.data)
        }
      };
    }
  }

  /**
   * Batch multiple insights for cost efficiency
   */
  async generateBatchInsights(requests: InsightRequest[]): Promise<GeneratedInsight[]> {
    console.log(`🔄 Generating ${requests.length} insights in batch mode`);
    
    const results: GeneratedInsight[] = [];
    const aiRequests: InsightRequest[] = [];
    
    // Process cache hits and local insights first
    for (const request of requests) {
      const cacheKey = this.generateCacheKey(request);
      const cached = this.getCachedInsight(cacheKey, request.type);
      
      if (cached) {
        results.push({
          insight: cached.insight,
          confidence: 0.9,
          cost: 0,
          fromCache: true,
          source: 'ai',
          metadata: {
            tokens: 0,
            processingTime: 0,
            dataFreshness: this.getDataFreshness(request.data)
          }
        });
      } else {
        const localInsight = this.tryLocalInsight(request);
        if (localInsight) {
          results.push({
            insight: localInsight,
            confidence: 0.7,
            cost: 0,
            fromCache: false,
            source: 'local',
            metadata: {
              tokens: 0,
              processingTime: 0,
              dataFreshness: this.getDataFreshness(request.data)
            }
          });
        } else {
          aiRequests.push(request);
        }
      }
    }
    
    // Process remaining requests through AI
    if (aiRequests.length > 0) {
      const aiResults = await this.processBatchAI(aiRequests);
      results.push(...aiResults);
    }
    
    console.log(`✅ Batch complete: ${results.length - aiRequests.length} from cache/local, ${aiRequests.length} from AI`);
    return results;
  }

  /**
   * Get cost metrics
   */
  getCostMetrics(): CostMetrics {
    return { ...this.costMetrics };
  }

  /**
   * Clear cache
   */
  clearCache(type?: PromptTemplate['type']) {
    if (type) {
      Array.from(this.cache.keys())
        .filter(key => key.includes(`_${type}_`))
        .forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  private generateCacheKey(request: InsightRequest): string {
    const dataHash = this.hashData(request.data);
    const questionHash = request.userQuestion ? this.hashString(request.userQuestion) : '';
    const contextHash = request.context ? this.hashString(JSON.stringify(request.context)) : '';
    
    return `${dataHash}_${request.type}_${questionHash}_${contextHash}`;
  }

  private getCachedInsight(key: string, type: PromptTemplate['type']): InsightCache | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const ttl = this.CACHE_TTL[type];
    if (Date.now() - cached.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // Update hit rate
    this.costMetrics.cacheHitRate = this.calculateCacheHitRate();
    
    return cached;
  }

  private cacheInsight(key: string, insight: string, cost: number, request: InsightRequest): void {
    this.cache.set(key, {
      key,
      insight,
      timestamp: Date.now(),
      cost,
      promptHash: this.hashString(InsightPromptTemplates.generatePrompt(request)),
      dataHash: this.hashData(request.data)
    });
  }

  private async generateAIInsight(request: InsightRequest): Promise<Omit<GeneratedInsight, 'fromCache' | 'source' | 'metadata'> & { metadata: Omit<GeneratedInsight['metadata'], 'processingTime' | 'dataFreshness'> }> {
    const prompt = InsightPromptTemplates.generatePrompt(request);
    const template = InsightPromptTemplates['getTemplateByType'](request.type);
    const optimizedPrompt = InsightPromptTemplates.optimizeForCost(prompt, template.maxTokens);
    
    const tokens = InsightPromptTemplates.estimateTokens(optimizedPrompt);
    const estimatedCost = tokens * this.config.costPerToken;
    
    console.log(`🤖 Generating AI insight: ${request.type}, estimated cost: $${estimatedCost.toFixed(4)}`);
    
    let insight: string;
    let actualCost: number;
    
    if (this.config.provider === 'openai') {
      const result = await this.callOpenAI(optimizedPrompt, template.maxTokens, request);
      insight = result.insight;
      actualCost = result.cost;
    } else if (this.config.provider === 'anthropic') {
      const result = await this.callAnthropic(optimizedPrompt, template.maxTokens, request);
      insight = result.insight;
      actualCost = result.cost;
    } else {
      throw new Error(`Unsupported AI provider: ${this.config.provider}`);
    }
    
    // Update cost metrics
    this.updateCostMetrics(actualCost, tokens);
    
    return {
      insight,
      confidence: 0.85,
      cost: actualCost,
      metadata: {
        tokens
      }
    };
  }

  private async callOpenAI(prompt: string, maxTokens: number, request?: InsightRequest): Promise<{ insight: string; cost: number }> {
    // Simulated OpenAI call - replace with actual implementation
    console.log('📞 Calling OpenAI API...');
    
    // In real implementation, you would use:
    /*
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: this.config.temperature
      })
    });
    
    const data = await response.json();
    const insight = data.choices[0].message.content;
    const tokens = data.usage.total_tokens;
    const cost = tokens * this.config.costPerToken;
    */
    
    // Simulated response for demo
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    const insight = this.generateMockAIInsight(prompt, request);
    const tokens = InsightPromptTemplates.estimateTokens(prompt + insight);
    const cost = tokens * this.config.costPerToken;
    
    return { insight, cost };
  }

  private async callAnthropic(prompt: string, maxTokens: number, request?: InsightRequest): Promise<{ insight: string; cost: number }> {
    // Simulated Anthropic call - replace with actual implementation
    console.log('📞 Calling Anthropic API...');
    
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1500));
    
    const insight = this.generateMockAIInsight(prompt, request);
    const tokens = InsightPromptTemplates.estimateTokens(prompt + insight);
    const cost = tokens * 0.000008; // Anthropic pricing
    
    return { insight, cost };
  }

  private generateMockAIInsight(prompt: string, request?: InsightRequest): string {
    const data = request?.data;
    
    // Extract actual data values with fallbacks
    const revenue = data?.revenue?.total || 0;
    const growth = data?.revenue?.growth || 0;
    const productCount = data?.products?.total || 0;
    const lowStock = data?.products?.lowInventory || 0;
    const orderCount = data?.orders?.total || 0;
    const abandonedCarts = data?.orders?.abandonedCarts || 0;
    const competitorCount = data?.marketIntelligence?.competitors?.length || 0;
    const dailyCost = data?.marketIntelligence?.costs?.daily || 0;
    const budgetUsage = data?.marketIntelligence?.costs?.budgetUsage || 0;
    const shopName = data?.metadata?.shop || 'your business';
    
    // Calculate derived metrics
    const conversionRate = orderCount > 0 && abandonedCarts > 0 
      ? ((orderCount / (orderCount + abandonedCarts)) * 100).toFixed(1)
      : '85'; // fallback
    
    const costPerCompetitor = competitorCount > 0 && dailyCost > 0 
      ? (dailyCost / competitorCount).toFixed(2)
      : '0.50';

    const monthlyROI = dailyCost > 0 
      ? Math.max(250, dailyCost * 30 * 3).toFixed(0) // 3x ROI estimate
      : '750';
    
    // Generate appropriate mock response based on prompt type
    if (prompt.includes('executive summary')) {
      const performanceDesc = growth > 5 ? 'strong performance' : growth > 0 ? 'steady progress' : 'stable operations';
      const growthDesc = growth !== 0 ? `revenue ${growth > 0 ? 'growing' : 'declining'} ${Math.abs(growth).toFixed(1)}%` : 'maintaining consistent revenue';
      const inventoryAlert = lowStock > 0 ? ` Immediate attention needed for ${lowStock} low-stock items.` : ' Inventory levels are well maintained.';
      const competitorInsight = competitorCount > 0 ? ` Currently monitoring ${competitorCount} competitors with daily costs of $${dailyCost.toFixed(2)}.` : '';
      
      return `${shopName} shows ${performanceDesc} with ${growthDesc} this period. Key metrics: ${productCount} total products, ${orderCount} orders processed, ${conversionRate}% conversion rate.${inventoryAlert}${competitorInsight} Market position provides opportunities for strategic expansion and optimization.`;
    }
    
    if (prompt.includes('trends')) {
      const trendDirection = growth > 0 ? 'positive upward' : growth < 0 ? 'declining' : 'stable';
      const abandonmentInsight = abandonedCarts > 0 ? ` Order patterns show ${abandonedCarts} abandoned carts (${(100 - parseFloat(conversionRate)).toFixed(1)}% abandonment rate), indicating checkout optimization opportunities.` : ' Strong checkout completion rates observed.';
      const productInsight = productCount > 0 ? ` Product portfolio of ${productCount} items shows ${lowStock > 0 ? 'some inventory challenges' : 'healthy inventory management'}.` : '';
      
      return `Revenue trajectory shows ${trendDirection} momentum with ${growth !== 0 ? `${growth.toFixed(1)}% growth` : 'consistent performance'}.${productInsight}${abandonmentInsight} ${competitorCount > 0 ? `Competitive monitoring of ${competitorCount} rivals provides strategic pricing insights.` : ''}`;
    }
    
    if (prompt.includes('cost')) {
      if (competitorCount === 0) {
        return "No active competitor monitoring detected. Consider implementing market intelligence to gain pricing insights, track competitor stock levels, and identify market opportunities. Starting with 3-5 key competitors can provide valuable strategic advantages.";
      }
      
      const efficiencyDesc = budgetUsage > 80 ? 'high usage requiring optimization' : budgetUsage < 30 ? 'conservative usage with expansion opportunities' : 'balanced usage';
      const costEfficiency = competitorCount > 0 ? `$${costPerCompetitor} per competitor monitored` : 'undefined';
      const roiEstimate = `~$${monthlyROI}/month value`;
      
      return `Market intelligence costs $${dailyCost.toFixed(2)} daily (${budgetUsage.toFixed(1)}% of budget) with ${efficiencyDesc}. Monitoring ${competitorCount} competitors at ${costEfficiency} provides ${roiEstimate} in strategic insights. ${budgetUsage > 75 ? 'Optimize monitoring frequency for stable competitors to reduce costs.' : budgetUsage < 25 ? 'Consider expanding monitoring to more competitors or increasing check frequency.' : 'Current monitoring level appears well-balanced.'}`;
    }
    
    if (prompt.includes('recommendations')) {
      const recommendations = [];
      let priority = 1;
      
      if (lowStock > 0) {
        recommendations.push(`${priority++}) Address ${lowStock} low-stock items immediately to prevent stockouts (high impact, immediate action needed)`);
      }
      
      if (abandonedCarts > 5) {
        recommendations.push(`${priority++}) Optimize checkout flow to reduce ${abandonedCarts} abandoned carts and improve ${conversionRate}% conversion rate (medium impact, moderate effort)`);
      }
      
      if (growth < 5 && productCount > 0) {
        recommendations.push(`${priority++}) Focus on growth strategies for your ${productCount}-product portfolio to accelerate revenue expansion (high impact, strategic effort)`);
      }
      
      if (competitorCount === 0) {
        recommendations.push(`${priority++}) Implement competitor monitoring to gain market intelligence and pricing advantages (medium impact, easy setup)`);
      } else if (budgetUsage > 80) {
        recommendations.push(`${priority++}) Optimize competitor monitoring costs - currently at ${budgetUsage.toFixed(1)}% of budget with ${competitorCount} competitors (low impact, easy)`);
      }
      
      if (revenue > 10000 && growth > 0) {
        recommendations.push(`${priority++}) Scale operations and implement automation to support ${growth.toFixed(1)}% growth trajectory (high impact, complex)`);
      }
      
      return recommendations.length > 0 
        ? `Priority recommendations: ${recommendations.slice(0, 5).join('. ')}.`
        : `${shopName} demonstrates solid operational performance. Continue monitoring key metrics and consider gradual expansion of product offerings and market intelligence capabilities.`;
    }
    
    // Default response for questions using actual data
    const dataInsights = [];
    if (revenue > 0) dataInsights.push(`$${revenue.toLocaleString()} revenue`);
    if (growth !== 0) dataInsights.push(`${growth > 0 ? '+' : ''}${growth.toFixed(1)}% growth`);
    if (productCount > 0) dataInsights.push(`${productCount} products`);
    if (competitorCount > 0) dataInsights.push(`monitoring ${competitorCount} competitors`);
    
    return `Based on ${shopName}'s current data: ${dataInsights.join(', ')}. ${lowStock > 0 ? `Immediate attention needed for ${lowStock} low-stock items. ` : ''}${growth > 5 ? 'Strong growth trajectory suggests scaling opportunities.' : growth > 0 ? 'Positive momentum indicates healthy business direction.' : 'Focus on growth strategies and market expansion opportunities.'}`;
  }

  private tryLocalInsight(request: InsightRequest): string | null {
    const data = request.data;
    
    // Simple rule-based insights for basic scenarios
    if (request.type === 'summary' && data.revenue && data.products) {
      const revenue = data.revenue.total;
      const growth = data.revenue.growth || 0;
      const lowStock = data.products.lowInventory || 0;
      
      if (revenue < 1000) {
        return `Early stage business with $${revenue.toLocaleString()} revenue. Focus on product portfolio expansion and customer acquisition. ${lowStock > 0 ? `Address ${lowStock} low-stock items.` : ''}`;
      } else if (growth > 10) {
        return `Strong growth trajectory at ${growth.toFixed(1)}% with $${revenue.toLocaleString()} revenue. Scale operations and optimize inventory management. ${lowStock > 0 ? `Priority: restock ${lowStock} items.` : ''}`;
      }
    }
    
    if (request.type === 'costs' && data.marketIntelligence) {
      const costs = data.marketIntelligence.costs;
      if (costs.budgetUsage > 90) {
        return `High budget usage at ${costs.budgetUsage.toFixed(1)}% ($${costs.daily.toFixed(2)}/day). Immediate optimization needed: reduce monitoring frequency, prioritize high-value competitors, review discovery settings.`;
      } else if (costs.budgetUsage < 20) {
        return `Low budget utilization at ${costs.budgetUsage.toFixed(1)}%. Opportunity to expand competitor monitoring, increase discovery frequency, or add more product categories for better market intelligence.`;
      }
    }
    
    return null; // Fall back to AI for complex insights
  }

  private generateFallbackInsight(request: InsightRequest): string {
    const data = request.data;
    
    // Basic fallback based on available data
    const parts = [];
    
    if (data.revenue) {
      parts.push(`Revenue: $${data.revenue.total.toLocaleString()}`);
      if (data.revenue.growth !== undefined) {
        parts.push(`(${data.revenue.growth > 0 ? '+' : ''}${data.revenue.growth.toFixed(1)}% growth)`);
      }
    }
    
    if (data.products) {
      parts.push(`${data.products.total} products`);
      if (data.products.lowInventory > 0) {
        parts.push(`${data.products.lowInventory} low-stock items need attention`);
      }
    }
    
    if (data.orders) {
      parts.push(`${data.orders.total} orders`);
      if (data.orders.abandonedCarts > 0) {
        parts.push(`${data.orders.abandonedCarts} abandoned carts`);
      }
    }
    
    if (data.marketIntelligence) {
      parts.push(`monitoring ${data.marketIntelligence.competitors.length} competitors`);
      parts.push(`daily cost: $${data.marketIntelligence.costs.daily.toFixed(2)}`);
    }
    
    const fallback = parts.length > 0 
      ? `Business overview: ${parts.join(', ')}. For detailed insights, please check your internet connection and try again.`
      : 'Unable to generate insights at this time. Please check your data and connection.';
    
    return fallback;
  }

  private async processBatchAI(requests: InsightRequest[]): Promise<GeneratedInsight[]> {
    // For simplicity, process sequentially
    // In production, you might batch prompts in a single API call
    const results: GeneratedInsight[] = [];
    
    for (const request of requests) {
      try {
        const result = await this.generateAIInsight(request);
        results.push({
          ...result,
          fromCache: false,
          source: 'ai',
          metadata: {
            ...result.metadata,
            processingTime: 0,
            dataFreshness: this.getDataFreshness(request.data)
          }
        });
        
        // Cache the result
        const cacheKey = this.generateCacheKey(request);
        this.cacheInsight(cacheKey, result.insight, result.cost, request);
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error('Batch AI request failed:', error);
        results.push({
          insight: this.generateFallbackInsight(request),
          confidence: 0.5,
          cost: 0,
          fromCache: false,
          source: 'fallback',
          metadata: {
            tokens: 0,
            processingTime: 0,
            dataFreshness: this.getDataFreshness(request.data)
          }
        });
      }
    }
    
    return results;
  }

  private updateCostMetrics(cost: number, tokens: number): void {
    this.costMetrics.totalCost += cost;
    this.costMetrics.requestCount += 1;
    this.costMetrics.averageCost = this.costMetrics.totalCost / this.costMetrics.requestCount;
    this.costMetrics.cacheHitRate = this.calculateCacheHitRate();
  }

  private calculateCacheHitRate(): number {
    if (this.costMetrics.requestCount === 0) return 0;
    
    const totalAccesses = this.costMetrics.requestCount + this.cache.size;
    return totalAccesses > 0 ? (this.cache.size / totalAccesses) * 100 : 0;
  }

  private getDataFreshness(data: Partial<AggregatedDashboardData>): string {
    if (!data.metadata?.freshness) return 'Unknown';
    
    const avgFreshness = Object.values(data.metadata.freshness)
      .reduce((sum, minutes) => sum + minutes, 0) / Object.values(data.metadata.freshness).length;
    
    if (avgFreshness < 5) return 'Very Fresh';
    if (avgFreshness < 30) return 'Fresh';
    if (avgFreshness < 120) return 'Recent';
    return 'Stale';
  }

  private hashData(data: any): string {
    const str = JSON.stringify(data, Object.keys(data).sort());
    return this.hashString(str);
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}

export const aiInsightsService = new AIInsightsService();
export default aiInsightsService;
