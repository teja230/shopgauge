# Market Intelligence Optimization Strategy

## Executive Summary

Based on analysis of the current dashboard and profile optimization patterns, this document outlines a comprehensive strategy to optimize Market Intelligence performance by reducing Redis and database calls while maintaining write operation capabilities. The strategy leverages proven patterns from the existing dashboard caching system and monitoring optimizations.

## Current State Analysis

### Existing Optimization Patterns

#### 1. Dashboard Cache Service Optimizations
- **Multi-layer caching**: Redis with TTL-based expiration (2-4 hours)
- **Session-aware caching**: Cache shared across sessions, cleared only when last session ends
- **Circuit breaker pattern**: Graceful degradation when Redis unavailable
- **Metadata tracking**: Cache age, version, and statistics monitoring
- **Persistent statistics**: Cache hit/miss rates stored in Redis

#### 2. Monitoring Service Optimizations
- **Ultra-conservative intervals**: 4-8 hour collection cycles vs. real-time
- **Startup delays**: Staggered service initialization (25-80 minutes)
- **Feature flags**: Ability to disable scheduled operations
- **In-memory aggregation**: Data collected in memory, persisted periodically

#### 3. Memory Profile Optimizations
- **Intelligent throttling**: Request queuing instead of rejection (512MB profile)
- **Resource-aware configuration**: Database pools, thread counts adjusted by profile
- **Graceful degradation**: System remains responsive under pressure

## Market Intelligence Current Implementation

### Performance Bottlenecks Identified

1. **Real-time data fetching**: Every dashboard request hits database/external APIs
2. **No caching layer**: Market intelligence data fetched fresh each time
3. **Write-heavy operations**: Competitor discovery, price scraping, cost tracking
4. **Complex queries**: Multi-table joins for analytics and reporting
5. **External API dependencies**: SerpAPI, scraping services with rate limits

### Current Architecture Issues

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

### Phase 1: Implement Multi-Layer Caching System

#### 1.1 Market Intelligence Cache Service

```java
@Service
public class MarketIntelligenceCacheService {
    
    // Cache prefixes for different data types
    private static final String DASHBOARD_CACHE_PREFIX = "mi:dashboard:";
    private static final String COST_ANALYTICS_PREFIX = "mi:cost_analytics:";
    private static final String DISCOVERY_STATS_PREFIX = "mi:discovery_stats:";
    private static final String PROVIDER_STATS_PREFIX = "mi:provider_stats:";
    private static final String COMPETITOR_DATA_PREFIX = "mi:competitor_data:";
    
    // TTL Configuration
    private static final Duration DASHBOARD_TTL = Duration.ofMinutes(30); // Frequent updates
    private static final Duration COST_ANALYTICS_TTL = Duration.ofHours(2); // Stable data
    private static final Duration DISCOVERY_STATS_TTL = Duration.ofHours(1); // Medium frequency
    private static final Duration PROVIDER_STATS_TTL = Duration.ofMinutes(15); // External API data
    private static final Duration COMPETITOR_DATA_TTL = Duration.ofHours(4); // Slow-changing data
}
```

#### 1.2 Tiered Caching Strategy

1. **L1 Cache (In-Memory)**: Frequently accessed data (5-15 minutes TTL)
2. **L2 Cache (Redis)**: Shared data across sessions (30 minutes - 4 hours TTL)
3. **L3 Cache (Database)**: Materialized views for complex queries (daily refresh)

### Phase 2: Optimize Write Operations

#### 2.1 Batch Write Operations

```java
@Service
public class MarketIntelligenceBatchService {
    
    @Scheduled(fixedRate = 300000) // Every 5 minutes
    public void processBatchWrites() {
        // Batch competitor discoveries
        processPendingDiscoveries();
        
        // Batch price updates
        processPendingPriceUpdates();
        
        // Batch cost tracking
        processPendingCostUpdates();
        
        // Invalidate relevant caches after batch writes
        invalidateAffectedCaches();
    }
}
```

#### 2.2 Write-Through Cache Pattern

```java
public void updateCompetitorData(Long competitorId, CompetitorData data) {
    // 1. Write to database
    competitorRepository.save(data);
    
    // 2. Update cache immediately
    String cacheKey = COMPETITOR_DATA_PREFIX + competitorId;
    cacheService.cacheCompetitorData(cacheKey, data);
    
    // 3. Invalidate related dashboard caches
    invalidateRelatedDashboardCaches(data.getShopId());
}
```

### Phase 3: Implement Smart Cache Invalidation

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

### Phase 4: Database Query Optimization

#### 4.1 Materialized Views for Complex Analytics

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

#### 4.2 Optimized Query Patterns

```java
// Instead of multiple queries, use single optimized query
public Map<String, Object> getDashboardDataOptimized(String shopDomain) {
    String sql = """
        WITH cost_summary AS (
            SELECT SUM(daily_cost) as total_cost, COUNT(*) as total_requests
            FROM market_intelligence_costs 
            WHERE shop_id = ? AND date >= CURRENT_DATE - INTERVAL '7 days'
        ),
        discovery_summary AS (
            SELECT COUNT(*) as total_discoveries, 
                   COUNT(CASE WHEN status = 'active' THEN 1 END) as active_competitors
            FROM competitor_urls 
            WHERE shop_id = ? AND deleted_at IS NULL
        )
        SELECT * FROM cost_summary, discovery_summary
        """;
    
    return jdbcTemplate.queryForMap(sql, shopId, shopId);
}
```

### Phase 5: Memory Profile Integration

#### 5.1 Profile-Aware Cache Configuration

```properties
# 512MB Profile - Conservative caching
storesight.memory.512mb.cache.mi-dashboard-ttl=PT15M
storesight.memory.512mb.cache.mi-cost-analytics-ttl=PT1H
storesight.memory.512mb.cache.mi-max-entries=50

# 1GB Profile - Balanced caching  
storesight.memory.1gb.cache.mi-dashboard-ttl=PT30M
storesight.memory.1gb.cache.mi-cost-analytics-ttl=PT2H
storesight.memory.1gb.cache.mi-max-entries=200

# 2GB Profile - Aggressive caching
storesight.memory.2gb.cache.mi-dashboard-ttl=PT1H
storesight.memory.2gb.cache.mi-cost-analytics-ttl=PT4H
storesight.memory.2gb.cache.mi-max-entries=500
```

#### 5.2 Request Throttling for Write Operations

```java
@Service
public class MarketIntelligenceThrottlingService {
    
    @Value("${storesight.memory.profile}")
    private String memoryProfile;
    
    public boolean shouldThrottleWrites() {
        return "512MB".equals(memoryProfile) && getCurrentWriteLoad() > getWriteThreshold();
    }
    
    public void throttleWriteOperation(Runnable operation) {
        if (shouldThrottleWrites()) {
            // Queue operation for later execution
            writeOperationQueue.offer(operation);
        } else {
            // Execute immediately
            operation.run();
        }
    }
}
```

## Implementation Roadmap

### Week 1-2: Foundation
- [ ] Create `MarketIntelligenceCacheService`
- [ ] Implement basic caching for dashboard endpoint
- [ ] Add cache statistics and monitoring
- [ ] Test cache hit/miss rates

### Week 3-4: Write Optimization
- [ ] Implement batch write operations
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

## Expected Performance Improvements

### Database Load Reduction
- **Dashboard queries**: 80-90% reduction (cached for 30 minutes)
- **Cost analytics**: 70-85% reduction (cached for 2 hours)
- **Discovery stats**: 60-75% reduction (cached for 1 hour)
- **Complex reports**: 90-95% reduction (materialized views)

### Redis Load Optimization
- **Smart invalidation**: Only invalidate affected caches
- **Session-aware caching**: Share cache across multiple sessions
- **Tiered TTL**: Different expiration times based on data volatility
- **Circuit breaker**: Graceful degradation when Redis unavailable

### Response Time Improvements
- **Dashboard loading**: 2-5 seconds → 200-500ms (cached)
- **Cost analytics**: 3-8 seconds → 300-800ms (cached)
- **Provider comparison**: 5-10 seconds → 500ms-1s (cached)
- **Write operations**: Batched processing reduces individual latency

### Memory Usage Optimization
- **Profile-aware caching**: Cache size adapts to available memory
- **Intelligent eviction**: LRU eviction with usage-based priorities
- **Batch processing**: Reduces memory spikes from individual operations

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

## Conclusion

This optimization strategy leverages proven patterns from the existing dashboard and monitoring systems to significantly improve Market Intelligence performance. The phased approach ensures minimal risk while delivering substantial performance gains through intelligent caching, batch processing, and memory-aware optimizations.

The strategy maintains full write operation capabilities while dramatically reducing read operation costs, making the system more scalable and responsive for end users.