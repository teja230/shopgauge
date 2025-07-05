package com.storesight.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Enhanced Dashboard Cache Service with Redis per-store caching
 *
 * <p>This service implements a comprehensive caching strategy: - Redis caching per store with
 * configurable TTL - Automatic cache invalidation and refresh - Fallback mechanisms for Redis
 * unavailability - Optimized for reduced API calls and improved performance
 */
@Service
public class DashboardCacheService {

  private static final Logger logger = LoggerFactory.getLogger(DashboardCacheService.class);

  // Cache key prefixes for different data types
  private static final String REVENUE_CACHE_PREFIX = "dashboard:revenue:";
  private static final String ORDERS_CACHE_PREFIX = "dashboard:orders:";
  private static final String PRODUCTS_CACHE_PREFIX = "dashboard:products:";
  private static final String INVENTORY_CACHE_PREFIX = "dashboard:inventory:";
  private static final String INSIGHTS_CACHE_PREFIX = "dashboard:insights:";
  private static final String ANALYTICS_CACHE_PREFIX = "dashboard:analytics:";
  private static final String ABANDONED_CARTS_CACHE_PREFIX = "dashboard:abandoned_carts:";

  // Cache TTL configuration (same as frontend session storage)
  private static final Duration DEFAULT_TTL = Duration.ofMinutes(120); // 2 hours
  private static final Duration FALLBACK_TTL = Duration.ofMinutes(60); // 1 hour for fallback
  private static final Duration EXTENDED_TTL = Duration.ofMinutes(240); // 4 hours for stable data

  // Cache metadata suffix
  private static final String METADATA_SUFFIX = ":metadata";

  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;

  @Autowired
  public DashboardCacheService(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
    this.redisTemplate = redisTemplate;
    this.objectMapper = objectMapper;
  }

  /** Cache entry wrapper with metadata for better cache management */
  public static class CacheEntry<T> {
    private T data;
    private long timestamp;
    private String lastUpdated;
    private String version;
    private String shop;
    private long ttlSeconds;

    public CacheEntry() {}

    public CacheEntry(T data, String shop, long ttlSeconds) {
      this.data = data;
      this.timestamp = System.currentTimeMillis();
      this.lastUpdated = java.time.Instant.now().toString();
      this.version = "v2.0";
      this.shop = shop;
      this.ttlSeconds = ttlSeconds;
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

    public boolean isExpired() {
      return System.currentTimeMillis() - timestamp > (ttlSeconds * 1000);
    }

    public long getAgeMinutes() {
      return (System.currentTimeMillis() - timestamp) / (1000 * 60);
    }
  }

  /** Cache revenue data for a specific shop */
  public void cacheRevenueData(String shopDomain, Object data) {
    cacheData(REVENUE_CACHE_PREFIX + shopDomain, data, shopDomain, DEFAULT_TTL);
  }

  /** Get cached revenue data for a shop */
  public Optional<Object> getCachedRevenueData(String shopDomain) {
    return getCachedData(REVENUE_CACHE_PREFIX + shopDomain, Object.class);
  }

  /** Cache orders data for a specific shop */
  public void cacheOrdersData(String shopDomain, Object data) {
    cacheData(ORDERS_CACHE_PREFIX + shopDomain, data, shopDomain, DEFAULT_TTL);
  }

  /** Get cached orders data for a shop */
  public Optional<Object> getCachedOrdersData(String shopDomain) {
    return getCachedData(ORDERS_CACHE_PREFIX + shopDomain, Object.class);
  }

  /** Cache products data for a specific shop */
  public void cacheProductsData(String shopDomain, Object data) {
    cacheData(PRODUCTS_CACHE_PREFIX + shopDomain, data, shopDomain, DEFAULT_TTL);
  }

  /** Get cached products data for a shop */
  public Optional<Object> getCachedProductsData(String shopDomain) {
    return getCachedData(PRODUCTS_CACHE_PREFIX + shopDomain, Object.class);
  }

  /** Cache inventory data for a specific shop */
  public void cacheInventoryData(String shopDomain, Object data) {
    cacheData(INVENTORY_CACHE_PREFIX + shopDomain, data, shopDomain, DEFAULT_TTL);
  }

  /** Get cached inventory data for a shop */
  public Optional<Object> getCachedInventoryData(String shopDomain) {
    return getCachedData(INVENTORY_CACHE_PREFIX + shopDomain, Object.class);
  }

  /** Cache insights data for a specific shop */
  public void cacheInsightsData(String shopDomain, Object data) {
    cacheData(INSIGHTS_CACHE_PREFIX + shopDomain, data, shopDomain, DEFAULT_TTL);
  }

  /** Get cached insights data for a shop */
  public Optional<Object> getCachedInsightsData(String shopDomain) {
    return getCachedData(INSIGHTS_CACHE_PREFIX + shopDomain, Object.class);
  }

  /** Cache analytics data for a specific shop */
  public void cacheAnalyticsData(String shopDomain, Object data) {
    cacheData(ANALYTICS_CACHE_PREFIX + shopDomain, data, shopDomain, DEFAULT_TTL);
  }

  /** Get cached analytics data for a shop */
  public Optional<Object> getCachedAnalyticsData(String shopDomain) {
    return getCachedData(ANALYTICS_CACHE_PREFIX + shopDomain, Object.class);
  }

  /** Cache abandoned carts data for a specific shop */
  public void cacheAbandonedCartsData(String shopDomain, Object data) {
    cacheData(ABANDONED_CARTS_CACHE_PREFIX + shopDomain, data, shopDomain, DEFAULT_TTL);
  }

  /** Get cached abandoned carts data for a shop */
  public Optional<Object> getCachedAbandonedCartsData(String shopDomain) {
    return getCachedData(ABANDONED_CARTS_CACHE_PREFIX + shopDomain, Object.class);
  }

  /** Generic method to cache data with TTL */
  private void cacheData(String key, Object data, String shopDomain, Duration ttl) {
    try {
      CacheEntry<Object> entry = new CacheEntry<>(data, shopDomain, ttl.getSeconds());
      String serializedData = objectMapper.writeValueAsString(entry);

      redisTemplate.opsForValue().set(key, serializedData, ttl);

      // Also store metadata for cache management
      String metadataKey = key + METADATA_SUFFIX;
      String metadata = objectMapper.writeValueAsString(entry);
      redisTemplate
          .opsForValue()
          .set(metadataKey, metadata, ttl.plusMinutes(30)); // Metadata lives longer

      logger.debug("Cached data for key: {} with TTL: {} minutes", key, ttl.toMinutes());

    } catch (JsonProcessingException e) {
      logger.error("Failed to serialize data for caching: {}", e.getMessage());
    } catch (Exception e) {
      logger.warn("Redis unavailable for caching - continuing without cache: {}", e.getMessage());
    }
  }

  /** Generic method to get cached data */
  private <T> Optional<T> getCachedData(String key, Class<T> dataType) {
    try {
      String serializedData = redisTemplate.opsForValue().get(key);

      if (serializedData == null) {
        logger.debug("No cached data found for key: {}", key);
        return Optional.empty();
      }

      @SuppressWarnings("unchecked")
      CacheEntry<T> entry = objectMapper.readValue(serializedData, CacheEntry.class);

      // Check if cache is expired (double-check beyond Redis TTL)
      if (entry.isExpired()) {
        logger.debug(
            "Cache entry expired for key: {} (age: {} minutes)", key, entry.getAgeMinutes());
        invalidateCache(key);
        return Optional.empty();
      }

      logger.debug("Cache hit for key: {} (age: {} minutes)", key, entry.getAgeMinutes());
      return Optional.of(entry.getData());

    } catch (JsonProcessingException e) {
      logger.error("Failed to deserialize cached data for key: {} - {}", key, e.getMessage());
      invalidateCache(key); // Remove corrupted cache
      return Optional.empty();
    } catch (Exception e) {
      logger.warn(
          "Redis unavailable for cache retrieval - falling back to fresh data: {}", e.getMessage());
      return Optional.empty();
    }
  }

  /** Invalidate cache for a specific key */
  public void invalidateCache(String key) {
    try {
      redisTemplate.delete(key);
      redisTemplate.delete(key + METADATA_SUFFIX);
      logger.debug("Invalidated cache for key: {}", key);
    } catch (Exception e) {
      logger.warn("Failed to invalidate cache for key: {} - {}", key, e.getMessage());
    }
  }

  /** Invalidate all cache for a specific shop */
  public void invalidateShopCache(String shopDomain) {
    try {
      String pattern = "*:" + shopDomain;
      var keys = redisTemplate.keys(pattern);

      if (keys != null && !keys.isEmpty()) {
        redisTemplate.delete(keys);
        logger.info("Invalidated {} cache entries for shop: {}", keys.size(), shopDomain);
      }

    } catch (Exception e) {
      logger.warn("Failed to invalidate shop cache for: {} - {}", shopDomain, e.getMessage());
    }
  }

  /** Check if cached data exists and is fresh */
  public boolean hasFreshCache(String key) {
    try {
      return redisTemplate.hasKey(key);
    } catch (Exception e) {
      logger.warn("Failed to check cache freshness for key: {} - {}", key, e.getMessage());
      return false;
    }
  }

  /** Get cache metadata for monitoring */
  public Optional<CacheEntry<Object>> getCacheMetadata(String key) {
    try {
      String metadataKey = key + METADATA_SUFFIX;
      String metadata = redisTemplate.opsForValue().get(metadataKey);

      if (metadata == null) {
        return Optional.empty();
      }

      @SuppressWarnings("unchecked")
      CacheEntry<Object> entry = objectMapper.readValue(metadata, CacheEntry.class);
      return Optional.of(entry);

    } catch (Exception e) {
      logger.warn("Failed to get cache metadata for key: {} - {}", key, e.getMessage());
      return Optional.empty();
    }
  }

  /** Refresh cache TTL for a key (extend cache life) */
  public void refreshCacheTTL(String key, Duration newTtl) {
    try {
      if (redisTemplate.hasKey(key)) {
        redisTemplate.expire(key, newTtl);
        redisTemplate.expire(key + METADATA_SUFFIX, newTtl.plusMinutes(30));
        logger.debug("Refreshed TTL for key: {} to {} minutes", key, newTtl.toMinutes());
      }
    } catch (Exception e) {
      logger.warn("Failed to refresh TTL for key: {} - {}", key, e.getMessage());
    }
  }

  /** Get cache statistics for monitoring */
  public String getCacheStats(String shopDomain) {
    try {
      StringBuilder stats = new StringBuilder();
      stats.append("Cache Statistics for shop: ").append(shopDomain).append("\n");

      String[] prefixes = {
        REVENUE_CACHE_PREFIX,
        ORDERS_CACHE_PREFIX,
        PRODUCTS_CACHE_PREFIX,
        INVENTORY_CACHE_PREFIX,
        INSIGHTS_CACHE_PREFIX,
        ANALYTICS_CACHE_PREFIX,
        ABANDONED_CARTS_CACHE_PREFIX
      };

      for (String prefix : prefixes) {
        String key = prefix + shopDomain;
        Optional<CacheEntry<Object>> metadata = getCacheMetadata(key);

        if (metadata.isPresent()) {
          CacheEntry<Object> entry = metadata.get();
          stats
              .append(prefix.replace("dashboard:", "").replace(":", ""))
              .append(": cached (age: ")
              .append(entry.getAgeMinutes())
              .append(" min)\n");
        } else {
          stats.append(prefix.replace("dashboard:", "").replace(":", "")).append(": not cached\n");
        }
      }

      return stats.toString();

    } catch (Exception e) {
      logger.warn("Failed to get cache stats for shop: {} - {}", shopDomain, e.getMessage());
      return "Cache stats unavailable";
    }
  }
}
