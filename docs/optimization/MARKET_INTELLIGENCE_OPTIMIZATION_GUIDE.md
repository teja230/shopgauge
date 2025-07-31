# Market Intelligence Optimization Guide

## Executive Summary

This guide provides a comprehensive strategy for optimizing Market Intelligence performance by leveraging proven patterns from the existing Dashboard and Profile optimizations. The strategy focuses on reducing Redis and database calls while maintaining write operation capabilities, specifically designed for the 512MB Render instance constraints.

## Current State Analysis

### Existing Optimizations (Already Implemented)

#### 1. Dashboard Cache Service ✅
- **Multi-tier caching**: Session storage (2 hours) + Redis backend cache
- **Shop-specific caching**: Cache keys include shop domain to prevent data leakage
- **Circuit breaker pattern**: Graceful degradation when Redis unavailable
- **Persistent statistics**: Cache hit/miss rates stored in Redis
- **No in-memory caching**: All caching external to JVM heap (512MB optimized)

#### 2. Cost Optimization Service ✅
- **Budget-based request limiting**: Daily/monthly budget enforcement
- **Aggressive caching**: 24-hour TTL for search results
- **Provider-specific cost tracking**: Detailed cost analytics per API provider
- **Cache integration**: Redis-based caching for expensive API calls

#### 3. Query Result Cache Service ✅
- **Two-tier caching**: Memory cache (L1) + Database cache (L2)
- **Circuit breaker pattern**: Database availability monitoring
- **Configurable TTL**: Cleanup scheduling and statistics logging

#### 4. Memory Profile Optimizations ✅
- **512MB profile**: Ultra-conservative intervals and resource limits
- **Request throttling**: Queue-based processing instead of rejection
- **Database pool optimization**: 3 connections max for 512MB instance

### Market Intelligence Current Implementation

#### Performance Bottlenecks Identified
1. **Real-time data fetching**: Every dashboard request hits database/external APIs
2. **No caching layer**: Market intelligence data fetched fresh each time
3. **Write-heavy operations**: Competitor discovery, price scraping, cost tracking
4. **Complex queries**: Multi-table joins for analytics and reporting
5. **External API dependencies**: SerpAPI, scraping services with rate limits

#### Current Architecture Issues
```java
// Current pattern - no caching
@GetMapping("/dashboard")
public ResponseEntity<Map<String, Object>> getDashboard() {
    // Direct database/API calls every time
    Map<String, Object> dashboard = new HashMap<>();
    dashboard.put("costAnalytics", costOptimizationService.getCostAnalytics()); // DB query
    dashboard.put("discoveryStats", discoveryService.getDiscoveryStats()); // DB query
    dashboard.put("providerStats", multiSourceSearchClient.getProviderStats()); // API call
    dashboard.put("databaseStats", getDatabaseStats()); // Multiple DB queries
    return ResponseEntity.ok(dashboard);
}
```

## Recommended Optimization Strategy

### Phase 1: Implement Market Intelligence Cache Service (Week 1-2)

#### 1.1 Leverage Existing Dashboard Cache Pattern

**Reference Implementation**: `DashboardCacheService` with proven 512MB optimization

```java
@Service
public class MarketIntelligenceCacheService {
    
    // Cache prefixes for different data types (shop-specific)
    private static final String DASHBOARD_CACHE_PREFIX = "mi:dashboard:";
    private static final String COST_ANALYTICS_PREFIX = "mi:cost_analytics:";
    private static final String DISCOVERY_STATS_PREFIX = "mi:discovery_stats:";
    private static final String PROVIDER_STATS_PREFIX = "mi:provider_stats:";
    private static final String COMPETITOR_DATA_PREFIX = "mi:competitor_data:";
    private static final String PRICE_HISTORY_PREFIX = "mi:price_history:";
    
    // TTL Configuration (512MB optimized)
    private static final Duration DASHBOARD_TTL = Duration.ofMinutes(30); // Frequent updates
    private static final Duration COST_ANALYTICS_TTL = Duration.ofHours(2); // Stable data
    private static final Duration DISCOVERY_STATS_TTL = Duration.ofHours(1); // Medium frequency
    private static final Duration PROVIDER_STATS_TTL = Duration.ofMinutes(15); // External API data
    private static final Duration COMPETITOR_DATA_TTL = Duration.ofHours(4); // Slow-changing data
    private static final Duration PRICE_HISTORY_TTL = Duration.ofHours(6); // Historical data
    
    // Leverage existing EnhancedRedisService and circuit breaker pattern
    private final EnhancedRedisService enhancedRedisService;
    private final CostOptimizationService costOptimizationService;
}
```

#### 1.2 Two-Layer Caching Strategy (Proven Pattern)

1. **L1 Cache (Frontend sessionStorage)**: Shop-specific cache with 2-hour TTL
2. **L2 Cache (Redis)**: Backend shared cache with session tracking (15 minutes - 6 hours TTL)

**No in-memory caching** - optimized for 512MB, 0.5 CPU constraints

#### 1.3 Frontend Cache Integration (Following Dashboard Pattern)

```typescript
// Market Intelligence frontend cache (following dashboard pattern)
interface MarketIntelligenceCache {
  version: string;
  shop: string;
  dashboard?: CacheEntry<MarketIntelligenceDashboard>;
  costAnalytics?: CacheEntry<CostAnalytics>;
  discoveryStats?: CacheEntry<DiscoveryStats>;
  providerStats?: CacheEntry<ProviderStats>;
  competitorData?: CacheEntry<CompetitorData[]>;
  priceHistory?: CacheEntry<PriceHistory[]>;
}

const CACHE_DURATION = 120 * 60 * 1000; // 2 hours (same as dashboard)
const CACHE_VERSION = "v2.0";

const loadMarketIntelligenceCache = (shop: string): MarketIntelligenceCache => {
  const cacheKey = `mi_cache_${shop}`;
  const stored = sessionStorage.getItem(cacheKey);
  
  if (stored) {
    const parsed = JSON.parse(stored);
    // Version and shop validation (prevent data leakage)
    if (parsed.version === CACHE_VERSION && parsed.shop === shop) {
      return parsed;
    }
  }
  
  return { version: CACHE_VERSION, shop };
};
```

### Phase 2: Optimize Write Operations (Week 3-4)

#### 2.1 Leverage Existing Cost Optimization Service

**Reference Implementation**: `CostOptimizationService` with budget tracking and caching

```java
// Extend existing CostOptimizationService for Market Intelligence
@Service
public class MarketIntelligenceWriteService {
    
    @Value("${storesight.memory.profile:512MB}")
    private String memoryProfile;
    
    // Leverage existing batch processing pattern
    @Scheduled(fixedRate = 600000) // Every 10 minutes (512MB optimized)
    public void processBatchWrites() {
        if (!"512MB".equals(memoryProfile) || isMemoryAvailable()) {
            // Process in smaller batches for 512MB
            processPendingDiscoveries(getBatchSize());
            processPendingPriceUpdates(getBatchSize());
            processPendingCostUpdates(getBatchSize());
            
            // Invalidate caches after writes
            invalidateAffectedCaches();
        } else {
            // Skip batch processing if memory pressure detected
            logger.warn("Skipping batch processing due to memory pressure");
        }
    }
    
    private int getBatchSize() {
        return "512MB".equals(memoryProfile) ? 10 : 50; // Smaller batches for 512MB
    }
}
```

#### 2.2 Write-Through Cache Pattern (Following Dashboard Pattern)

```java
public void updateCompetitorData(Long competitorId, CompetitorData data) {
    // 1. Write to database
    competitorRepository.save(data);
    
    // 2. Update Redis cache immediately (backend)
    String cacheKey = COMPETITOR_DATA_PREFIX + data.getShopDomain();
    cacheService.cacheCompetitorData(cacheKey, data);
    
    // 3. Invalidate related caches (both Redis and trigger frontend refresh)
    invalidateRelatedCaches(data.getShopDomain());
    
    // 4. Notify frontend to refresh sessionStorage cache
    notifyFrontendCacheInvalidation(data.getShopDomain(), "competitor_data");
}
```

### Phase 3: Implement Smart Cache Invalidation (Week 5-6)

#### 3.1 Event-Driven Cache Invalidation

```java
@EventListener
public void handleCompetitorUpdate(CompetitorUpdateEvent event) {
    // Invalidate specific caches
    String shopDomain = event.getShopDomain();
    cacheService.invalidateCache(DISCOVERY_STATS_PREFIX + shopDomain);
    cacheService.invalidateCache(DASHBOARD_CACHE_PREFIX + shopDomain);
    
    // Keep cost analytics cache (less frequently changing)
    // Keep provider stats cache (external API data)
}

@EventListener
public void handlePriceScraping(PriceScrapingEvent event) {
    // Invalidate price-related caches
    String shopDomain = event.getShopDomain();
    cacheService.invalidateCache(PRICE_HISTORY_PREFIX + shopDomain);
    cacheService.invalidateCache(COMPETITOR_DATA_PREFIX + shopDomain);
}
```

#### 3.2 Time-Based Cache Warming

```java
@Scheduled(cron = "0 */30 * * * *") // Every 30 minutes
public void warmCriticalCaches() {
    // Pre-load dashboard data for active shops
    List<String> activeShops = getActiveShops();
    
    for (String shopDomain : activeShops) {
        if (!cacheService.hasFreshCache(DASHBOARD_CACHE_PREFIX + shopDomain)) {
            // Warm cache in background
            CompletableFuture.runAsync(() -> loadDashboardData(shopDomain));
        }
    }
}
```

### Phase 4: Database Query Optimization (Week 7-8)

#### 4.1 Leverage Existing Query Result Cache Service

**Reference Implementation**: `QueryResultCacheService` with two-tier caching

```java
// Extend existing QueryResultCacheService for Market Intelligence
@Service
public class MarketIntelligenceQueryService {
    
    // Use existing QueryResultCacheService for complex queries
    public Map<String, Object> getDashboardDataOptimized(String shopDomain) {
        String cacheKey = "mi_dashboard_" + shopDomain;
        
        // Check cache first
        Optional<Map<String, Object>> cached = queryResultCacheService.get(cacheKey, Map.class);
        if (cached.isPresent()) {
            return cached.get();
        }
        
        // Execute optimized query
        Map<String, Object> result = executeOptimizedDashboardQuery(shopDomain);
        
        // Cache result
        queryResultCacheService.put(cacheKey, result, Duration.ofMinutes(30));
        
        return result;
    }
}
```

#### 4.2 Materialized Views for Complex Analytics

```sql
-- Create materialized view for cost analytics
CREATE MATERIALIZED VIEW mv_market_intelligence_cost_summary AS
SELECT 
    shop_id,
    DATE_TRUNC('day', date) as day,
    provider,
    SUM(daily_cost) as total_cost,
    SUM(daily_requests) as total_requests,
    SUM(daily_discoveries) as total_discoveries,
    AVG(daily_cost / NULLIF(daily_requests, 0)) as avg_cost_per_request
FROM market_intelligence_costs 
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY shop_id, DATE_TRUNC('day', date), provider;

-- Refresh schedule (daily at 2 AM)
CREATE OR REPLACE FUNCTION refresh_mi_cost_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_intelligence_cost_summary;
END;
$$ LANGUAGE plpgsql;
```

### Phase 5: 512MB Memory Profile Integration (Week 9-10)

#### 5.1 Profile-Aware Cache Configuration

```properties
# 512MB Profile - Ultra-conservative caching
storesight.memory.512mb.cache.mi-dashboard-ttl=PT30M
storesight.memory.512mb.cache.mi-cost-analytics-ttl=PT2H
storesight.memory.512mb.cache.mi-discovery-stats-ttl=PT1H
storesight.memory.512mb.cache.mi-provider-stats-ttl=PT15M
storesight.memory.512mb.cache.mi-competitor-data-ttl=PT4H
storesight.memory.512mb.cache.mi-price-history-ttl=PT6H

# Redis memory limits for 512MB instance
storesight.memory.512mb.redis.max-memory=64MB
storesight.memory.512mb.redis.eviction-policy=allkeys-lru
storesight.memory.512mb.redis.compression=true

# Request throttling enabled for 512MB
storesight.memory.512mb.request.throttling.enabled=true
storesight.memory.512mb.request.throttling.max-concurrent=2
storesight.memory.512mb.request.throttling.queue-size=10
```

#### 5.2 Request Throttling for Write Operations

```java
@Service
public class MarketIntelligenceThrottlingService {
    
    @Value("${storesight.memory.profile:512MB}")
    private String memoryProfile;
    
    // For 512MB instance, always throttle heavy operations
    public boolean shouldThrottleWrites() {
        return "512MB".equals(memoryProfile) || getCurrentMemoryUsage() > 80;
    }
    
    public void throttleWriteOperation(Runnable operation) {
        if (shouldThrottleWrites()) {
            // Queue operation with loading state (like dashboard pattern)
            writeOperationQueue.offer(operation);
            // Return loading response immediately
        } else {
            // Execute immediately only if memory allows
            operation.run();
        }
    }
}
```

## Implementation Roadmap

### Week 1-2: Foundation
- [ ] Create `MarketIntelligenceCacheService` (following DashboardCacheService pattern)
- [ ] Implement basic caching for dashboard endpoint
- [ ] Add cache statistics and monitoring (following Dashboard pattern)
- [ ] Test cache hit/miss rates

### Week 3-4: Write Optimization
- [ ] Implement batch write operations (leveraging existing CostOptimizationService)
- [ ] Add write-through cache pattern
- [ ] Create event-driven cache invalidation
- [ ] Test write performance improvements

### Week 5-6: Advanced Features
- [ ] Create materialized views for analytics
- [ ] Implement cache warming strategies
- [ ] Add memory profile integration
- [ ] Performance testing and tuning

### Week 7-8: Production Deployment
- [ ] Gradual rollout with feature flags
- [ ] Monitor performance improvements
- [ ] Fine-tune cache TTL values
- [ ] Document optimization results

## Expected Performance Improvements (512MB Instance Optimized)

### Database Load Reduction
- **Dashboard queries**: 80-90% reduction (sessionStorage + Redis cache)
- **Cost analytics**: 70-85% reduction (2-hour Redis cache)
- **Discovery stats**: 60-75% reduction (1-hour Redis cache)
- **Complex reports**: 90-95% reduction (materialized views)

### Redis Load Optimization
- **Smart invalidation**: Only invalidate affected caches
- **Session-aware caching**: Share cache across multiple sessions per shop
- **Shop-specific keys**: Prevent data leakage between shops
- **Circuit breaker**: Graceful degradation when Redis unavailable

### Response Time Improvements
- **Dashboard loading**: 2-5 seconds → 200-500ms (sessionStorage hit)
- **Cost analytics**: 3-8 seconds → 300-800ms (Redis cache hit)
- **Provider comparison**: 5-10 seconds → 500ms-1s (Redis cache hit)
- **Write operations**: Batched processing reduces individual latency

### Memory Usage Optimization (Critical for 512MB)
- **No in-memory caching**: All caching in sessionStorage + Redis
- **Compressed data**: Large objects compressed before Redis storage
- **Batch processing**: Reduces memory spikes from individual operations
- **Profile-aware limits**: Cache size adapts to 512MB constraints

## Monitoring and Alerting

### Cache Performance Metrics
```java
public Map<String, Object> getMarketIntelligenceCacheMetrics() {
    return Map.of(
        "dashboardCacheHitRate", getDashboardCacheHitRate(),
        "costAnalyticsCacheHitRate", getCostAnalyticsCacheHitRate(),
        "averageResponseTime", getAverageResponseTime(),
        "cacheEvictionRate", getCacheEvictionRate(),
        "writeOperationQueueSize", getWriteOperationQueueSize()
    );
}
```

### Performance Alerts
- Cache hit rate below 70%
- Average response time above 2 seconds
- Write operation queue size above 100
- Memory usage above profile threshold

## Risk Mitigation

### Cache Consistency
- **Write-through pattern**: Ensures cache and database consistency
- **Event-driven invalidation**: Immediate cache updates on data changes
- **TTL safety net**: Automatic cache expiration prevents stale data

### Redis Availability
- **Circuit breaker pattern**: Graceful degradation when Redis unavailable
- **Fallback to database**: System continues operating without cache
- **Health monitoring**: Automatic Redis reconnection

### Memory Management
- **Profile-aware limits**: Cache size adapts to available memory
- **Intelligent eviction**: LRU with business logic priorities
- **Memory monitoring**: Alerts when approaching limits

## Success Criteria

### Performance Targets
- [ ] Dashboard load time: < 500ms (95th percentile)
- [ ] Database query reduction: > 75%
- [ ] Cache hit rate: > 80%
- [ ] Memory usage: Within profile limits
- [ ] Write operation latency: < 2 seconds

### Reliability Targets
- [ ] System availability: > 99.9%
- [ ] Cache consistency: > 99.5%
- [ ] Error rate: < 0.1%
- [ ] Recovery time: < 30 seconds

## Leveraging Existing Implementations

### 1. DashboardCacheService Pattern
- **Multi-tier caching**: Session storage + Redis backend
- **Shop-specific keys**: Prevents data leakage
- **Circuit breaker**: Graceful degradation
- **Persistent statistics**: Cache monitoring

### 2. CostOptimizationService Integration
- **Budget tracking**: Daily/monthly limits
- **API cost management**: Provider-specific tracking
- **Cache integration**: Redis-based caching
- **Recommendations**: Automated optimization suggestions

### 3. QueryResultCacheService Pattern
- **Two-tier caching**: Memory + Database
- **Circuit breaker**: Database availability
- **Configurable TTL**: Cleanup scheduling
- **Statistics logging**: Performance monitoring

### 4. Memory Profile Optimizations
- **512MB profile**: Ultra-conservative settings
- **Request throttling**: Queue-based processing
- **Database optimization**: Connection pooling
- **Resource monitoring**: Memory usage tracking

## Conclusion

This optimization strategy leverages the proven **sessionStorage + Redis** caching pattern from the existing dashboard system, specifically optimized for your **512MB, 0.5 CPU Render instance**. The strategy ensures minimal memory footprint while delivering substantial performance gains.

### Key Architectural Decisions

1. **No In-Memory Caching**: All caching external to JVM heap (sessionStorage + Redis)
2. **Shop-Specific Cache Keys**: Prevents data leakage between shops
3. **Session-Aware Sharing**: Multiple sessions per shop share the same cache
4. **Request Throttling**: Enabled for 512MB profile with queue-based processing
5. **Batch Processing**: Memory-conscious batch sizes and longer intervals

### 512MB Instance Benefits

- **Memory Efficiency**: No JVM heap pressure from caching
- **Request Throttling**: Graceful handling of concurrent requests
- **Circuit Breaker**: Fallback when Redis unavailable
- **Compressed Storage**: Large objects compressed before Redis storage

The strategy maintains full write operation capabilities while dramatically reducing read operation costs, making the system scalable within your current infrastructure constraints. 