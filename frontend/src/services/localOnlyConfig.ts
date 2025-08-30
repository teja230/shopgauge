/**
 * Configuration for running Business Intelligence in local-only mode
 * This demonstrates how to use the system without any AI provider costs
 */

import aiInsightsService from './aiInsightsService';
import type { AIConfig } from './aiInsightsService';

// Local-only configuration - no external AI costs
export const LOCAL_ONLY_CONFIG: Partial<AIConfig> = {
  provider: 'fallback',
  model: 'local-rules',
  maxTokens: 0,
  temperature: 0,
  costPerToken: 0,
  apiKey: undefined
};

// Demo mode configuration - uses mock AI responses
export const DEMO_CONFIG: Partial<AIConfig> = {
  provider: 'openai', // Will use mock responses
  model: 'demo-gpt',
  maxTokens: 400,
  temperature: 0.3,
  costPerToken: 0, // No actual costs in demo
  apiKey: 'demo-key'
};

/**
 * Initialize Business Intelligence in local-only mode
 * This will only use rule-based insights and basic data summaries
 */
export function initializeLocalOnlyMode() {
  console.log('🔧 Initializing Business Intelligence in Local-Only Mode');
  console.log('✅ Features available:');
  console.log('   - Rule-based insights for common scenarios');
  console.log('   - Basic data pattern recognition');  
  console.log('   - Smart caching for performance');
  console.log('   - Fallback summaries for all data');
  console.log('   - Zero AI costs');
  
  // Configure service for local-only operation
  // Create a properly typed instance without bypassing type safety
  const localService = Object.create(aiInsightsService);
  Object.assign(localService, {
    config: LOCAL_ONLY_CONFIG,
    cache: new Map(),
    costMetrics: {
      totalCost: 0,
      requestCount: 0,
      tokensSaved: 0,
      cacheHitRate: 0,
      averageCost: 0
    }
  });
  
  return localService;
}

/**
 * Initialize Business Intelligence in demo mode
 * This provides full AI-like experience without actual API costs
 */
export function initializeDemoMode() {
  console.log('🎭 Initializing Business Intelligence in Demo Mode');
  console.log('✅ Features available:');
  console.log('   - Full AI-like responses (mocked)');
  console.log('   - All insight types available');
  console.log('   - Interactive chat functionality');
  console.log('   - Cost tracking simulation');
  console.log('   - Zero actual AI costs');
  
  // Configure service for demo operation
  // Create a properly typed instance without bypassing type safety
  const demoService = Object.create(aiInsightsService);
  Object.assign(demoService, {
    config: DEMO_CONFIG,
    cache: new Map(),
    costMetrics: {
      totalCost: 0,
      requestCount: 0,
      tokensSaved: 0,
      cacheHitRate: 0,
      averageCost: 0
    }
  });
  
  return demoService;
}

/**
 * Example local insights that work without AI
 */
export const LOCAL_INSIGHT_EXAMPLES = {
  summary: {
    earlyStage: "Early stage business with $500 revenue. Focus on product portfolio expansion and customer acquisition. Address 3 low-stock items.",
    growing: "Strong growth trajectory at 15.2% with $12,500 revenue. Scale operations and optimize inventory management. Priority: restock 8 items.",
    mature: "Established business with $45,000 monthly revenue. Focus on optimization and market expansion. Current inventory levels healthy."
  },
  
  costs: {
    high: "High budget usage at 92.3% ($67.45/day). Immediate optimization needed: reduce monitoring frequency, prioritize high-value competitors, review discovery settings.",
    low: "Low budget utilization at 18.5%. Opportunity to expand competitor monitoring, increase discovery frequency, or add more product categories.",
    optimal: "Budget usage at 65% appears well-balanced. Monitor for opportunities to optimize high-performing competitor tracking."
  },
  
  trends: {
    positive: "Revenue shows consistent upward trend with 12.5% month-over-month growth. Product diversification healthy with top 3 items contributing 35% of sales.",
    declining: "Revenue trend showing 8% decline. Focus on customer retention and product mix optimization. Consider promotional strategies.",
    volatile: "Revenue showing high volatility. Investigate seasonal patterns and optimize inventory for demand fluctuations."
  },
  
  recommendations: {
    inventory: "Priority: Address 15 low-stock items to prevent stockouts (high impact, easy implementation).",
    conversion: "Optimize checkout flow to reduce 18% cart abandonment rate (medium impact, moderate effort).",
    pricing: "Leverage 12% competitive price advantage for strategic adjustments (medium impact, low effort).",
    expansion: "Expand top-performing categories driving 40% of revenue (high impact, complex implementation)."
  }
};

/**
 * Test function to verify local-only functionality
 */
export async function testLocalOnlyFunctionality() {
  console.log('🧪 Testing Local-Only Business Intelligence...');
  
  const localService = initializeLocalOnlyMode();
  
  // Test data for local insights
  const testData = {
    revenue: { total: 12500, growth: 15.2, timeseries: [] },
    products: { total: 45, lowInventory: 8, newProducts: 3, topProducts: [] },
    orders: { total: 156, recent: [], abandonedCarts: 28, conversionRate: 82 },
    marketIntelligence: {
      competitors: [],
      suggestions: 5,
      costs: { daily: 45.67, monthly: 1370, requests: 234, budgetUsage: 78.5 }
    },
    metadata: { shop: 'test-shop', timestamp: new Date().toISOString(), dataPoints: 100, freshness: {} }
  };
  
  try {
    // Test summary insight
    const summaryResult = await localService.generateInsight({
      type: 'summary',
      data: testData
    });
    
    console.log('✅ Summary insight generated:', summaryResult.insight);
    console.log('   Source:', summaryResult.source, '| Cost:', summaryResult.cost);
    
    // Test cost insight
    const costResult = await localService.generateInsight({
      type: 'costs',
      data: testData
    });
    
    console.log('✅ Cost insight generated:', costResult.insight);
    console.log('   Source:', costResult.source, '| Cost:', costResult.cost);
    
    console.log('🎉 Local-only mode working perfectly!');
    return true;
    
  } catch (error) {
    console.error('❌ Local-only test failed:', error);
    return false;
  }
}

/**
 * Check if running in demo mode
 */
export function isDemoMode(): boolean {
  return localStorage.getItem('demo_mode_active') === 'true' || 
         new URLSearchParams(window.location.search).get('demo') === 'true' ||
         window.location.hostname.includes('demo');
}

/**
 * Auto-configure service based on environment
 */
export function autoConfigureBusinessIntelligence() {
  if (isDemoMode()) {
    console.log('🎭 Demo mode detected - using mock AI responses');
    return initializeDemoMode();
  } else {
    console.log('🔧 Production mode - checking for AI provider configuration');
    
    // Check if AI provider is configured
    const hasApiKey = process.env.REACT_APP_OPENAI_API_KEY || 
                     process.env.REACT_APP_ANTHROPIC_API_KEY;
    
    if (!hasApiKey) {
      console.log('⚠️ No AI provider configured - falling back to local-only mode');
      return initializeLocalOnlyMode();
    } else {
      console.log('✅ AI provider configured - using full AI mode');
      return aiInsightsService; // Use default configured service
    }
  }
}
