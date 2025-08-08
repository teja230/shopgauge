package com.storesight.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.service.MarketIntelligenceCacheTypes.*;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Enhanced Market Intelligence Cache Service with write-aware caching strategy
 *
 * <p>This service implements a comprehensive caching strategy optimized for Market Intelligence: -
 * Multi-tier caching (Session, Redis, Database) - Write-aware cache invalidation - Parallel data
 * loading - Cost optimization integration - Performance monitoring and metrics - 512MB memory
 * profile optimization
 */
@Service
public class MarketIntelligenceCacheService {

  private static final Logger logger =
      LoggerFactory.getLogger(MarketIntelligenceCacheService.class);

  // Cache key prefixes for different data types (shop-specific)
  // Admin dashboard-related caches under mi:admin:* namespace
  private static final String DASHBOARD_CACHE_PREFIX = "mi:admin:dashboard:";
  private static final String COST_ANALYTICS_PREFIX = "mi:admin:cost_analytics:";
  private static final String DISCOVERY_STATS_PREFIX = "mi:admin:discovery_stats:";
  private static final String PROVIDER_STATS_PREFIX = "mi:admin:provider_stats:";
  private static final String COMPETITOR_DATA_PREFIX = "mi:competitor_data:";
  private static final String ARCHIVED_COMPETITOR_DATA_PREFIX = "mi:archived_competitor_data:";
  private static final String PRICE_HISTORY_PREFIX = "mi:price_history:";
  private static final String PRICE_TREND_PREFIX = "mi:price_trend:";
  private static final String PRICE_STATUS_PREFIX = "mi:price_status:";
  private static final String PERFORMANCE_METRICS_PREFIX = "mi:admin:performance:";
  private static final String SYSTEM_STATUS_PREFIX = "mi:admin:system_status:";

  // Session tracking prefixes
  private static final String SESSION_TRACKING_PREFIX = "mi:admin:sessions:";
  private static final String SESSION_COUNT_PREFIX = "mi:admin:session_count:";

  // TTL Configuration (512MB optimized)
  private static final Duration DASHBOARD_TTL = Duration.ofMinutes(30); // Frequent updates
  private static final Duration COST_ANALYTICS_TTL = Duration.ofHours(2); // Stable data
  private static final Duration DISCOVERY_STATS_TTL = Duration.ofHours(1); // Medium frequency
  private static final Duration PROVIDER_STATS_TTL = Duration.ofMinutes(15); // External API data
  private static final Duration COMPETITOR_DATA_TTL = Duration.ofHours(4); // Slow-changing data
  private static final Duration PRICE_HISTORY_TTL = Duration.ofHours(6); // Historical data
  private static final Duration PRICE_TREND_TTL =
      Duration.ofHours(6); // Trend data similar to history
  private static final Duration PRICE_STATUS_TTL = Duration.ofMinutes(15); // Near real-time status
  private static final Duration PERFORMANCE_METRICS_TTL =
      Duration.ofMinutes(10); // Frequent monitoring
  private static final Duration SYSTEM_STATUS_TTL = Duration.ofMinutes(5); // Real-time status

  // Cache metadata suffix
  private static final String METADATA_SUFFIX = ":metadata";

  // Leverage existing services
  private final StringRedisTemplate redisTemplate;
  private final EnhancedRedisService enhancedRedisService;
  private final ObjectMapper objectMapper;

  // Cache statistics tracking
  private final AtomicLong cacheHits = new AtomicLong(0);
  private final AtomicLong cacheMisses = new AtomicLong(0);
  private final AtomicLong cacheEvictions = new AtomicLong(0);
  private final AtomicLong writeOperations = new AtomicLong(0);
  private final AtomicLong databaseCalls = new AtomicLong(0);

  // Persistent cache statistics keys
  private static final String CACHE_STATS_HITS_KEY = "mi:admin:cache:stats:hits";
  private static final String CACHE_STATS_MISSES_KEY = "mi:admin:cache:stats:misses";
  private static final String CACHE_STATS_EVICTIONS_KEY = "mi:admin:cache:stats:evictions";
  private static final String CACHE_STATS_WRITES_KEY = "mi:admin:cache:stats:writes";
  private static final String CACHE_STATS_DB_CALLS_KEY = "mi:admin:cache:stats:db_calls";
  private static final String CACHE_STATS_LAST_RESET_KEY = "mi:admin:cache:stats:last_reset";

  // Active fetches tracking to prevent duplicate requests
  private final Map<String, CompletableFuture<Object>> activeFetches = new ConcurrentHashMap<>();

  // Memory profile configuration
  @Value("${storesight.memory.profile:512MB}")
  private String memoryProfile;

  public MarketIntelligenceCacheService(
      StringRedisTemplate redisTemplate,
      EnhancedRedisService enhancedRedisService,
      ObjectMapper objectMapper) {
    this.redisTemplate = redisTemplate;
    this.enhancedRedisService = enhancedRedisService;
    this.objectMapper = objectMapper;

    // Initialize cache statistics from persistent storage
    initializeCacheStatistics();
  }

  /** Initialize cache statistics from persistent storage */
  private void initializeCacheStatistics() {
    try {
      if (!isRedisAvailable()) {
        logger.warn("Redis not available during startup, using default cache statistics");
        return;
      }

      // Load persistent cache statistics
      String hitsStr = redisTemplate.opsForValue().get(CACHE_STATS_HITS_KEY);
      String missesStr = redisTemplate.opsForValue().get(CACHE_STATS_MISSES_KEY);
      String evictionsStr = redisTemplate.opsForValue().get(CACHE_STATS_EVICTIONS_KEY);
      String writesStr = redisTemplate.opsForValue().get(CACHE_STATS_WRITES_KEY);
      String dbCallsStr = redisTemplate.opsForValue().get(CACHE_STATS_DB_CALLS_KEY);

      if (hitsStr != null) {
        cacheHits.set(Long.parseLong(hitsStr));
      }
      if (missesStr != null) {
        cacheMisses.set(Long.parseLong(missesStr));
      }
      if (evictionsStr != null) {
        cacheEvictions.set(Long.parseLong(evictionsStr));
      }
      if (writesStr != null) {
        writeOperations.set(Long.parseLong(writesStr));
      }
      if (dbCallsStr != null) {
        databaseCalls.set(Long.parseLong(dbCallsStr));
      }

      logger.info("Market Intelligence cache statistics initialized from persistent storage");
    } catch (Exception e) {
      logger.warn("Failed to initialize cache statistics: {}", e.getMessage());
    }
  }

  /** Check if Redis is available */
  private boolean isRedisAvailable() {
    try {
      redisTemplate.opsForValue().set("mi_health_check", "ok", Duration.ofSeconds(10));
      return true;
    } catch (Exception e) {
      return false;
    }
  }

  /** Persist cache statistics to Redis */
  private void persistCacheStatistics() {
    try {
      if (!isRedisAvailable()) {
        return;
      }

      redisTemplate
          .opsForValue()
          .set(CACHE_STATS_HITS_KEY, String.valueOf(cacheHits.get()), Duration.ofDays(30));
      redisTemplate
          .opsForValue()
          .set(CACHE_STATS_MISSES_KEY, String.valueOf(cacheMisses.get()), Duration.ofDays(30));
      redisTemplate
          .opsForValue()
          .set(
              CACHE_STATS_EVICTIONS_KEY, String.valueOf(cacheEvictions.get()), Duration.ofDays(30));
      redisTemplate
          .opsForValue()
          .set(CACHE_STATS_WRITES_KEY, String.valueOf(writeOperations.get()), Duration.ofDays(30));
      redisTemplate
          .opsForValue()
          .set(CACHE_STATS_DB_CALLS_KEY, String.valueOf(databaseCalls.get()), Duration.ofDays(30));
      redisTemplate
          .opsForValue()
          .set(CACHE_STATS_LAST_RESET_KEY, LocalDateTime.now().toString(), Duration.ofDays(30));
    } catch (Exception e) {
      logger.warn("Failed to persist cache statistics: {}", e.getMessage());
    }
  }

  /** Cache entry with metadata */
  public static class CacheEntry<T> {
    private T data;
    private long timestamp;
    private String lastUpdated;
    private String version;
    private String shop;
    private long ttlSeconds;
    private String source; // "session", "redis", "database"

    public CacheEntry() {}

    public CacheEntry(T data, String shop, long ttlSeconds, String source) {
      this.data = data;
      this.shop = shop;
      this.timestamp = System.currentTimeMillis();
      this.lastUpdated = LocalDateTime.now().toString();
      this.version = "v1.0";
      this.ttlSeconds = ttlSeconds;
      this.source = source;
    }

    // Getters and setters
    public T getData() {
      return data;
    }

    public void setData(T data) {
      this.data = data;
    }

    public long getTimestamp() {
      return timestamp;
    }

    public void setTimestamp(long timestamp) {
      this.timestamp = timestamp;
    }

    public String getLastUpdated() {
      return lastUpdated;
    }

    public void setLastUpdated(String lastUpdated) {
      this.lastUpdated = lastUpdated;
    }

    public String getVersion() {
      return version;
    }

    public void setVersion(String version) {
      this.version = version;
    }

    public String getShop() {
      return shop;
    }

    public void setShop(String shop) {
      this.shop = shop;
    }

    public long getTtlSeconds() {
      return ttlSeconds;
    }

    public void setTtlSeconds(long ttlSeconds) {
      this.ttlSeconds = ttlSeconds;
    }

    public String getSource() {
      return source;
    }

    public void setSource(String source) {
      this.source = source;
    }

    public boolean isExpired() {
      return System.currentTimeMillis() - timestamp > (ttlSeconds * 1000);
    }

    public long getAgeMinutes() {
      return (System.currentTimeMillis() - timestamp) / (1000 * 60);
    }
  }

  // =====================================
  // CACHE OPERATIONS FOR DIFFERENT DATA TYPES
  // =====================================

  /** Cache dashboard data (accepts Object for backward compatibility, DashboardData preferred) */
  public void cacheDashboard(String shopDomain, Object data) {
    cacheData(DASHBOARD_CACHE_PREFIX + shopDomain, data, shopDomain, DASHBOARD_TTL);
  }

  /** Get cached dashboard data (returns Object for backward compatibility) */
  public Optional<Object> getCachedDashboard(String shopDomain) {
    return getCachedData(DASHBOARD_CACHE_PREFIX + shopDomain, Object.class);
  }

  /**
   * Cache cost analytics data (accepts Object for backward compatibility, CostAnalytics preferred)
   */
  public void cacheCostAnalytics(String shopDomain, Object data) {
    cacheData(COST_ANALYTICS_PREFIX + shopDomain, data, shopDomain, COST_ANALYTICS_TTL);
  }

  /** Get cached cost analytics (returns Object for backward compatibility) */
  public Optional<Object> getCachedCostAnalytics(String shopDomain) {
    return getCachedData(COST_ANALYTICS_PREFIX + shopDomain, Object.class);
  }

  /** Cache discovery stats (accepts Object for backward compatibility, DiscoveryStats preferred) */
  public void cacheDiscoveryStats(String shopDomain, Object data) {
    cacheData(DISCOVERY_STATS_PREFIX + shopDomain, data, shopDomain, DISCOVERY_STATS_TTL);
  }

  /** Get cached discovery stats (returns Object for backward compatibility) */
  public Optional<Object> getCachedDiscoveryStats(String shopDomain) {
    return getCachedData(DISCOVERY_STATS_PREFIX + shopDomain, Object.class);
  }

  /** Cache provider stats (accepts Object for backward compatibility, ProviderStats preferred) */
  public void cacheProviderStats(String shopDomain, Object data) {
    cacheData(PROVIDER_STATS_PREFIX + shopDomain, data, shopDomain, PROVIDER_STATS_TTL);
  }

  /** Get cached provider stats (returns Object for backward compatibility) */
  public Optional<Object> getCachedProviderStats(String shopDomain) {
    return getCachedData(PROVIDER_STATS_PREFIX + shopDomain, Object.class);
  }

  /** Cache competitor data (accepts Object for backward compatibility, CompetitorData preferred) */
  public void cacheCompetitorData(String shopDomain, Object data) {
    cacheData(COMPETITOR_DATA_PREFIX + shopDomain, data, shopDomain, COMPETITOR_DATA_TTL);
  }

  /** Get cached competitor data (returns Object for backward compatibility) */
  public Optional<Object> getCachedCompetitorData(String shopDomain) {
    return getCachedData(COMPETITOR_DATA_PREFIX + shopDomain, Object.class);
  }

  /** Cache price history data (accepts Object for backward compatibility, PriceData preferred) */
  public void cachePriceHistory(String shopDomain, Object data) {
    cacheData(PRICE_HISTORY_PREFIX + shopDomain, data, shopDomain, PRICE_HISTORY_TTL);
  }

  /** Get cached price history (returns Object for backward compatibility) */
  public Optional<Object> getCachedPriceHistory(String shopDomain) {
    return getCachedData(PRICE_HISTORY_PREFIX + shopDomain, Object.class);
  }

  /** Cache archived competitor data list for a shop */
  public void cacheArchivedCompetitorData(String shopDomain, Object data) {
    cacheData(ARCHIVED_COMPETITOR_DATA_PREFIX + shopDomain, data, shopDomain, COMPETITOR_DATA_TTL);
  }

  /** Get cached archived competitor data list */
  public Optional<Object> getCachedArchivedCompetitorData(String shopDomain) {
    return getCachedData(ARCHIVED_COMPETITOR_DATA_PREFIX + shopDomain, Object.class);
  }

  /** Cache price history for a specific competitor and days */
  public void cachePriceHistoryForCompetitor(
      String shopDomain, long competitorId, int days, Object data) {
    String key = PRICE_HISTORY_PREFIX + shopDomain + ":" + competitorId + ":" + days;
    cacheData(key, data, shopDomain, PRICE_HISTORY_TTL);
  }

  /** Get cached price history for a specific competitor and days */
  public Optional<Object> getCachedPriceHistoryForCompetitor(
      String shopDomain, long competitorId, int days) {
    String key = PRICE_HISTORY_PREFIX + shopDomain + ":" + competitorId + ":" + days;
    return getCachedData(key, Object.class);
  }

  /** Cache price trend for a specific competitor and days */
  public void cachePriceTrendForCompetitor(
      String shopDomain, long competitorId, int days, Object data) {
    String key = PRICE_TREND_PREFIX + shopDomain + ":" + competitorId + ":" + days;
    cacheData(key, data, shopDomain, PRICE_TREND_TTL);
  }

  /** Get cached price trend for a specific competitor and days */
  public Optional<Object> getCachedPriceTrendForCompetitor(
      String shopDomain, long competitorId, int days) {
    String key = PRICE_TREND_PREFIX + shopDomain + ":" + competitorId + ":" + days;
    return getCachedData(key, Object.class);
  }

  /** Cache price status (latest snapshot) for a specific competitor */
  public void cachePriceStatusForCompetitor(String shopDomain, long competitorId, Object data) {
    String key = PRICE_STATUS_PREFIX + shopDomain + ":" + competitorId;
    cacheData(key, data, shopDomain, PRICE_STATUS_TTL);
  }

  /** Get cached price status (latest snapshot) for a specific competitor */
  public Optional<Object> getCachedPriceStatusForCompetitor(String shopDomain, long competitorId) {
    String key = PRICE_STATUS_PREFIX + shopDomain + ":" + competitorId;
    return getCachedData(key, Object.class);
  }

  /**
   * Cache performance metrics (accepts Object for backward compatibility, PerformanceMetrics
   * preferred)
   */
  public void cachePerformanceMetrics(String shopDomain, Object data) {
    cacheData(PERFORMANCE_METRICS_PREFIX + shopDomain, data, shopDomain, PERFORMANCE_METRICS_TTL);
  }

  /** Get cached performance metrics (returns Object for backward compatibility) */
  public Optional<Object> getCachedPerformanceMetrics(String shopDomain) {
    return getCachedData(PERFORMANCE_METRICS_PREFIX + shopDomain, Object.class);
  }

  /** Cache system status (accepts Object for backward compatibility, SystemStatus preferred) */
  public void cacheSystemStatus(String shopDomain, Object data) {
    cacheData(SYSTEM_STATUS_PREFIX + shopDomain, data, shopDomain, SYSTEM_STATUS_TTL);
  }

  /** Get cached system status (returns Object for backward compatibility) */
  public Optional<Object> getCachedSystemStatus(String shopDomain) {
    return getCachedData(SYSTEM_STATUS_PREFIX + shopDomain, Object.class);
  }

  // =====================================
  // CORE CACHING METHODS
  // =====================================

  /** Type-safe generic method to cache data */
  private <T> void cacheTypedData(String key, T data, String shopDomain, Duration ttl) {
    try {
      if (!isRedisAvailable()) {
        logger.warn("Redis not available, skipping cache for key: {}", key);
        return;
      }

      CacheEntry<T> entry = new CacheEntry<>(data, shopDomain, ttl.toSeconds(), "redis");
      String serializedData = objectMapper.writeValueAsString(entry);

      enhancedRedisService.setWithTtl(key, serializedData, ttl);
      enhancedRedisService.setWithTtl(key + METADATA_SUFFIX, serializedData, ttl);

      logger.debug("Cached typed data for key: {} (TTL: {} minutes)", key, ttl.toMinutes());
      recordCacheWrite();
    } catch (JsonProcessingException e) {
      logger.error("Failed to serialize typed data for caching key: {} - {}", key, e.getMessage());
    } catch (Exception e) {
      logger.warn("Failed to cache typed data for key: {} - {}", key, e.getMessage());
    }
  }

  /** Generic method to cache data (backward compatibility) */
  private void cacheData(String key, Object data, String shopDomain, Duration ttl) {
    try {
      if (!isRedisAvailable()) {
        logger.warn("Redis not available, skipping cache for key: {}", key);
        return;
      }

      CacheEntry<Object> entry = new CacheEntry<>(data, shopDomain, ttl.toSeconds(), "redis");
      String serializedData = objectMapper.writeValueAsString(entry);

      enhancedRedisService.setWithTtl(key, serializedData, ttl);
      enhancedRedisService.setWithTtl(key + METADATA_SUFFIX, serializedData, ttl);

      logger.debug("Cached data for key: {} (TTL: {} minutes)", key, ttl.toMinutes());
      recordCacheWrite();
    } catch (JsonProcessingException e) {
      logger.error("Failed to serialize data for caching key: {} - {}", key, e.getMessage());
    } catch (Exception e) {
      logger.warn("Failed to cache data for key: {} - {}", key, e.getMessage());
    }
  }

  /** Type-safe method to get cached data */
  private <T> Optional<T> getCachedTypedData(String key, Class<T> dataType) {
    try {
      // Check if there's an active fetch for this key
      if (activeFetches.containsKey(key)) {
        logger.debug("Waiting for active fetch for key: {}", key);
        CompletableFuture<Object> future = activeFetches.get(key);
        if (future != null) {
          Object result = future.get();
          return Optional.of(dataType.cast(result));
        }
      }

      // Use enhanced Redis service with circuit breaker
      Optional<String> serializedDataOpt = enhancedRedisService.get(key);

      if (serializedDataOpt.isEmpty()) {
        logger.info("No cached data found for key: {} (cache miss)", key);
        recordCacheMiss();
        return Optional.empty();
      }

      String serializedData = serializedDataOpt.get();
      // Use proper type handling with Jackson
      CacheEntry<T> entry =
          objectMapper.readValue(
              serializedData,
              objectMapper.getTypeFactory().constructParametricType(CacheEntry.class, dataType));

      // Check if cache is expired
      if (entry.isExpired()) {
        logger.debug(
            "Cache entry expired for key: {} (age: {} minutes)", key, entry.getAgeMinutes());
        recordCacheMiss();
        invalidateCache(key);
        return Optional.empty();
      }

      logger.info(
          "Cache hit for key: {} (age: {} minutes, source: {})",
          key,
          entry.getAgeMinutes(),
          entry.getSource());
      recordCacheHit();
      return Optional.of(entry.getData());

    } catch (JsonProcessingException e) {
      logger.error("Failed to deserialize cached typed data for key: {} - {}", key, e.getMessage());
      recordCacheMiss();
      invalidateCache(key);
      return Optional.empty();
    } catch (Exception e) {
      logger.warn(
          "Redis unavailable for typed cache retrieval - falling back to fresh data: {}",
          e.getMessage());
      recordCacheMiss();
      return Optional.empty();
    }
  }

  /** Generic method to get cached data (backward compatibility) */
  private <T> Optional<T> getCachedData(String key, Class<T> dataType) {
    try {
      // Check if there's an active fetch for this key
      if (activeFetches.containsKey(key)) {
        logger.debug("Waiting for active fetch for key: {}", key);
        CompletableFuture<Object> future = activeFetches.get(key);
        if (future != null) {
          Object result = future.get();
          return Optional.of(dataType.cast(result));
        }
      }

      // Use enhanced Redis service with circuit breaker
      Optional<String> serializedDataOpt = enhancedRedisService.get(key);

      if (serializedDataOpt.isEmpty()) {
        logger.info("No cached data found for key: {} (cache miss)", key);
        recordCacheMiss();
        return Optional.empty();
      }

      String serializedData = serializedDataOpt.get();
      @SuppressWarnings("unchecked")
      CacheEntry<T> entry = objectMapper.readValue(serializedData, CacheEntry.class);

      // Check if cache is expired
      if (entry.isExpired()) {
        logger.debug(
            "Cache entry expired for key: {} (age: {} minutes)", key, entry.getAgeMinutes());
        recordCacheMiss();
        invalidateCache(key);
        return Optional.empty();
      }

      logger.info(
          "Cache hit for key: {} (age: {} minutes, source: {})",
          key,
          entry.getAgeMinutes(),
          entry.getSource());
      recordCacheHit();
      return Optional.of(entry.getData());

    } catch (JsonProcessingException e) {
      logger.error("Failed to deserialize cached data for key: {} - {}", key, e.getMessage());
      recordCacheMiss();
      invalidateCache(key);
      return Optional.empty();
    } catch (Exception e) {
      logger.warn(
          "Redis unavailable for cache retrieval - falling back to fresh data: {}", e.getMessage());
      recordCacheMiss();
      return Optional.empty();
    }
  }

  // =====================================
  // WRITE-AWARE CACHE INVALIDATION
  // =====================================

  /** Invalidate related caches when write operations occur */
  public void invalidateRelatedCaches(String operation, String shopDomain) {
    logger.info("Invalidating related caches for operation: {} on shop: {}", operation, shopDomain);

    switch (operation) {
      case "price_scraping":
        invalidateCache(PRICE_HISTORY_PREFIX + shopDomain);
        invalidateCache(COMPETITOR_DATA_PREFIX + shopDomain);
        invalidateCache(DASHBOARD_CACHE_PREFIX + shopDomain);
        break;
      case "competitor_added":
        invalidateCache(DISCOVERY_STATS_PREFIX + shopDomain);
        invalidateCache(COMPETITOR_DATA_PREFIX + shopDomain);
        invalidateCache(DASHBOARD_CACHE_PREFIX + shopDomain);
        break;
      case "competitor_removed":
        invalidateCache(COMPETITOR_DATA_PREFIX + shopDomain);
        invalidateCache(DISCOVERY_STATS_PREFIX + shopDomain);
        invalidateCache(DASHBOARD_CACHE_PREFIX + shopDomain);
        break;
      case "system_status_change":
        invalidateCache(SYSTEM_STATUS_PREFIX + shopDomain);
        invalidateCache(DASHBOARD_CACHE_PREFIX + shopDomain);
        break;
      case "performance_update":
        invalidateCache(PERFORMANCE_METRICS_PREFIX + shopDomain);
        break;
      case "cost_tracking":
        // Don't invalidate cost cache - it's append-only, but invalidate dashboard
        invalidateCache(DASHBOARD_CACHE_PREFIX + shopDomain);
        break;
      default:
        logger.warn("Unknown operation for cache invalidation: {}", operation);
    }
  }

  /** Cache write results immediately for subsequent reads */
  public void cacheWriteResult(String key, Object data, Duration ttl) {
    try {
      // Store in Redis immediately
      cacheData(key, data, extractShopFromKey(key), ttl);

      // Log cache operation for monitoring
      logger.info("Cached write result for key: {} with TTL: {} minutes", key, ttl.toMinutes());
    } catch (Exception e) {
      logger.error("Failed to cache write result for key: {} - {}", key, e.getMessage());
    }
  }

  /** Extract shop domain from cache key */
  private String extractShopFromKey(String key) {
    // Extract shop domain from key format like "mi:search:shop-domain"
    String[] parts = key.split(":");
    return parts.length > 2 ? parts[2] : "unknown";
  }

  // =====================================
  // PARALLEL PROCESSING OPTIMIZATION
  // =====================================

  /** Load all Market Intelligence data in parallel */
  public CompletableFuture<Map<String, Object>> loadAllDataAsync(String shopDomain) {
    Map<String, CompletableFuture<Object>> futures = new HashMap<>();

    // Start all data loading in parallel
    futures.put("dashboard", loadDashboardAsync(shopDomain));
    futures.put("costAnalytics", loadCostAnalyticsAsync(shopDomain));
    futures.put("discoveryStats", loadDiscoveryStatsAsync(shopDomain));
    futures.put("providerStats", loadProviderStatsAsync(shopDomain));
    futures.put("competitorData", loadCompetitorDataAsync(shopDomain));
    futures.put("performanceMetrics", loadPerformanceMetricsAsync(shopDomain));
    futures.put("systemStatus", loadSystemStatusAsync(shopDomain));

    return CompletableFuture.allOf(futures.values().toArray(new CompletableFuture[0]))
        .thenApply(
            v -> {
              Map<String, Object> results = new HashMap<>();
              futures.forEach(
                  (key, future) -> {
                    try {
                      results.put(key, future.get());
                    } catch (Exception e) {
                      logger.warn("Failed to get result for {}: {}", key, e.getMessage());
                      results.put(key, null);
                    }
                  });
              return results;
            });
  }

  /** Async data loading methods */
  private CompletableFuture<Object> loadDashboardAsync(String shopDomain) {
    return CompletableFuture.supplyAsync(() -> getCachedDashboard(shopDomain).orElse(null));
  }

  private CompletableFuture<Object> loadCostAnalyticsAsync(String shopDomain) {
    return CompletableFuture.supplyAsync(() -> getCachedCostAnalytics(shopDomain).orElse(null));
  }

  private CompletableFuture<Object> loadDiscoveryStatsAsync(String shopDomain) {
    return CompletableFuture.supplyAsync(() -> getCachedDiscoveryStats(shopDomain).orElse(null));
  }

  private CompletableFuture<Object> loadProviderStatsAsync(String shopDomain) {
    return CompletableFuture.supplyAsync(() -> getCachedProviderStats(shopDomain).orElse(null));
  }

  private CompletableFuture<Object> loadCompetitorDataAsync(String shopDomain) {
    return CompletableFuture.supplyAsync(() -> getCachedCompetitorData(shopDomain).orElse(null));
  }

  private CompletableFuture<Object> loadPerformanceMetricsAsync(String shopDomain) {
    return CompletableFuture.supplyAsync(
        () -> getCachedPerformanceMetrics(shopDomain).orElse(null));
  }

  private CompletableFuture<Object> loadSystemStatusAsync(String shopDomain) {
    return CompletableFuture.supplyAsync(() -> getCachedSystemStatus(shopDomain).orElse(null));
  }

  // =====================================
  // CACHE MANAGEMENT
  // =====================================

  /** Invalidate cache for a specific key */
  public void invalidateCache(String key) {
    try {
      enhancedRedisService.delete(key);
      enhancedRedisService.delete(key + METADATA_SUFFIX);
      logger.debug("Invalidated cache for key: {}", key);
    } catch (Exception e) {
      logger.warn("Failed to invalidate cache for key: {} - {}", key, e.getMessage());
    }
  }

  /** Invalidate all cache for a specific shop */
  public void invalidateShopCache(String shopDomain) {
    logger.info("Invalidating all cache for shop: {}", shopDomain);

    String[] prefixes = {
      DASHBOARD_CACHE_PREFIX,
      COST_ANALYTICS_PREFIX,
      DISCOVERY_STATS_PREFIX,
      PROVIDER_STATS_PREFIX,
      COMPETITOR_DATA_PREFIX,
      ARCHIVED_COMPETITOR_DATA_PREFIX,
      PRICE_HISTORY_PREFIX,
      PRICE_TREND_PREFIX,
      PRICE_STATUS_PREFIX,
      PERFORMANCE_METRICS_PREFIX,
      SYSTEM_STATUS_PREFIX
    };

    for (String prefix : prefixes) {
      invalidateCache(prefix + shopDomain);
    }
  }

  /** Check if cache is fresh */
  public boolean hasFreshCache(String key) {
    try {
      Optional<String> metadataOpt = enhancedRedisService.get(key + METADATA_SUFFIX);
      if (metadataOpt.isEmpty()) {
        return false;
      }

      @SuppressWarnings("unchecked")
      CacheEntry<Object> entry = objectMapper.readValue(metadataOpt.get(), CacheEntry.class);
      return !entry.isExpired();
    } catch (Exception e) {
      logger.warn("Failed to check cache freshness for key: {} - {}", key, e.getMessage());
      return false;
    }
  }

  // =====================================
  // STATISTICS AND MONITORING
  // =====================================

  /** Record cache hit */
  public void recordCacheHit() {
    cacheHits.incrementAndGet();
    persistCacheStatistics();
  }

  /** Record cache miss */
  public void recordCacheMiss() {
    cacheMisses.incrementAndGet();
    persistCacheStatistics();
  }

  /** Record cache write operation */
  public void recordCacheWrite() {
    writeOperations.incrementAndGet();
    persistCacheStatistics();
  }

  /** Record database call */
  public void recordDatabaseCall() {
    databaseCalls.incrementAndGet();
    persistCacheStatistics();
  }

  /** Get cache statistics */
  public Map<String, Object> getCacheStatistics() {
    long hits = cacheHits.get();
    long misses = cacheMisses.get();
    long evictions = cacheEvictions.get();
    long writes = writeOperations.get();
    long dbCalls = databaseCalls.get();

    double hitRatio = (hits + misses) > 0 ? (double) hits / (hits + misses) : 0.0;

    Map<String, Object> stats = new HashMap<>();
    stats.put("hits", hits);
    stats.put("misses", misses);
    stats.put("evictions", evictions);
    stats.put("writes", writes);
    stats.put("databaseCalls", dbCalls);
    stats.put("hitRatio", String.format("%.2f%%", hitRatio * 100));
    stats.put("totalOperations", hits + misses);
    stats.put("memoryProfile", memoryProfile);

    return stats;
  }

  /** Reset cache statistics */
  public void resetCacheStatistics() {
    cacheHits.set(0);
    cacheMisses.set(0);
    cacheEvictions.set(0);
    writeOperations.set(0);
    databaseCalls.set(0);
    persistCacheStatistics();
    logger.info("Market Intelligence cache statistics reset");
  }

  // =====================================
  // SESSION MANAGEMENT
  // =====================================

  /** Register a session for a shop */
  public void registerSession(String shopDomain, String sessionId) {
    try {
      String sessionKey = SESSION_TRACKING_PREFIX + shopDomain;
      String countKey = SESSION_COUNT_PREFIX + shopDomain;

      // Add session to set
      redisTemplate.opsForSet().add(sessionKey, sessionId);
      redisTemplate.expire(sessionKey, Duration.ofHours(24));

      // Increment session count
      redisTemplate.opsForValue().increment(countKey);
      redisTemplate.expire(countKey, Duration.ofHours(24));

      logger.debug("Registered session {} for shop: {}", sessionId, shopDomain);
    } catch (Exception e) {
      logger.warn("Failed to register session for shop: {} - {}", shopDomain, e.getMessage());
    }
  }

  /** Unregister a session for a shop */
  public boolean unregisterSession(String shopDomain, String sessionId) {
    try {
      String sessionKey = SESSION_TRACKING_PREFIX + shopDomain;
      String countKey = SESSION_COUNT_PREFIX + shopDomain;

      // Remove session from set
      Long removed = redisTemplate.opsForSet().remove(sessionKey, sessionId);

      if (removed != null && removed > 0) {
        // Decrement session count
        redisTemplate.opsForValue().decrement(countKey);
        logger.debug("Unregistered session {} for shop: {}", sessionId, shopDomain);
        return true;
      }

      return false;
    } catch (Exception e) {
      logger.warn("Failed to unregister session for shop: {} - {}", shopDomain, e.getMessage());
      return false;
    }
  }

  /** Get session count for a shop */
  public long getSessionCount(String shopDomain) {
    try {
      String countKey = SESSION_COUNT_PREFIX + shopDomain;
      String countStr = redisTemplate.opsForValue().get(countKey);
      return countStr != null ? Long.parseLong(countStr) : 0;
    } catch (Exception e) {
      logger.warn("Failed to get session count for shop: {} - {}", shopDomain, e.getMessage());
      return 0;
    }
  }

  /** Check if session is registered */
  public boolean isSessionRegistered(String shopDomain, String sessionId) {
    try {
      String sessionKey = SESSION_TRACKING_PREFIX + shopDomain;
      return Boolean.TRUE.equals(redisTemplate.opsForSet().isMember(sessionKey, sessionId));
    } catch (Exception e) {
      logger.warn(
          "Failed to check session registration for shop: {} - {}", shopDomain, e.getMessage());
      return false;
    }
  }
}
