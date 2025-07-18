package com.storesight.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.config.ApplicationConfigurationProperties;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Service for caching frequently accessed query results to improve performance. Implements a
 * two-tier caching strategy with in-memory cache for hot data and database cache for persistent
 * storage.
 */
@Service
public class QueryResultCacheService {

  private static final Logger logger = LoggerFactory.getLogger(QueryResultCacheService.class);

  private final JdbcTemplate jdbcTemplate;
  private final ObjectMapper objectMapper;
  private final ScheduledExecutorService scheduler;

  // In-memory cache for hot data (L1 cache)
  private final ConcurrentHashMap<String, CacheEntry> memoryCache;

  // Cache statistics
  private volatile long hitCount = 0;
  private volatile long missCount = 0;
  private volatile long evictionCount = 0;

  @Autowired private ApplicationConfigurationProperties config;

  // Configuration helper methods
  private int getMaxMemoryCacheSize() {
    return config.getCache().getMaxMemoryCacheSize();
  }

  private Duration getDefaultTtl() {
    return config.getCache().getDefaultTtl();
  }

  private Duration getMemoryCacheTtl() {
    return config.getCache().getMemoryTtl();
  }

  private Duration getCleanupInterval() {
    return config.getCache().getCleanupInterval();
  }

  private Duration getStatisticsInterval() {
    return config.getCache().getStatisticsInterval();
  }

  @Autowired
  public QueryResultCacheService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
    this.jdbcTemplate = jdbcTemplate;
    this.objectMapper = objectMapper;
    this.scheduler = Executors.newScheduledThreadPool(2);
    this.memoryCache = new ConcurrentHashMap<>();
  }

  @PostConstruct
  public void initialize() {
    // Schedule periodic cleanup of expired entries
    scheduler.scheduleAtFixedRate(
        this::cleanupExpiredEntries,
        getCleanupInterval().toMinutes(),
        getCleanupInterval().toMinutes(),
        TimeUnit.MINUTES);

    // Schedule periodic statistics logging
    scheduler.scheduleAtFixedRate(
        this::logCacheStatistics,
        getStatisticsInterval().toMinutes(),
        getStatisticsInterval().toMinutes(),
        TimeUnit.MINUTES);

    logger.info(
        "QueryResultCacheService initialized with memory cache size: {}", getMaxMemoryCacheSize());
  }

  @PreDestroy
  public void shutdown() {
    scheduler.shutdown();
    try {
      if (!scheduler.awaitTermination(10, TimeUnit.SECONDS)) {
        scheduler.shutdownNow();
      }
    } catch (InterruptedException e) {
      scheduler.shutdownNow();
      Thread.currentThread().interrupt();
    }
    memoryCache.clear();
    logger.info("QueryResultCacheService shutdown completed");
  }

  /** Get cached result for the given key */
  public <T> Optional<T> get(String key, Class<T> valueType) {
    try {
      // Check memory cache first (L1)
      CacheEntry memoryEntry = memoryCache.get(key);
      if (memoryEntry != null && !memoryEntry.isExpired()) {
        hitCount++;
        return Optional.of(deserializeValue(memoryEntry.getValue(), valueType));
      }

      // Check database cache (L2)
      String sql =
          "SELECT cache_value, expires_at FROM query_cache WHERE cache_key = ? AND expires_at > CURRENT_TIMESTAMP";

      return jdbcTemplate.query(
          sql,
          rs -> {
            if (rs.next()) {
              String jsonValue = rs.getString("cache_value");
              LocalDateTime expiresAt = rs.getTimestamp("expires_at").toLocalDateTime();

              // Update hit count and last accessed time
              updateCacheStatistics(key);

              // Store in memory cache for faster future access
              CacheEntry entry = new CacheEntry(jsonValue, expiresAt);
              // Use efficient eviction strategy instead of checking size on every put
              memoryCache.put(key, entry);
              // Evict if necessary (handled by eviction strategy)
              if (memoryCache.size() > getMaxMemoryCacheSize()) {
                evictOldestMemoryCacheEntry();
              }

              hitCount++;
              try {
                return Optional.of(deserializeValue(jsonValue, valueType));
              } catch (JsonProcessingException e) {
                logger.error("Error deserializing cached value for key: {}", key, e);
                return Optional.<T>empty();
              }
            } else {
              missCount++;
              return Optional.<T>empty();
            }
          },
          key);

    } catch (Exception e) {
      logger.error("Error retrieving cached value for key: {}", key, e);
      missCount++;
      return Optional.empty();
    }
  }

  /** Cache a value with default TTL */
  public <T> void put(String key, T value) {
    put(key, value, getDefaultTtl());
  }

  /** Cache a value with specified TTL */
  public <T> void put(String key, T value, Duration ttl) {
    try {
      String jsonValue = serializeValue(value);
      LocalDateTime expiresAt = LocalDateTime.now().plus(ttl);

      // Store in database cache (L2)
      String sql =
          "INSERT INTO query_cache (cache_key, cache_value, expires_at) "
              + "VALUES (?, ?::jsonb, ?) "
              + "ON CONFLICT (cache_key) DO UPDATE SET "
              + "cache_value = EXCLUDED.cache_value, "
              + "expires_at = EXCLUDED.expires_at, "
              + "created_at = CURRENT_TIMESTAMP";

      jdbcTemplate.update(sql, key, jsonValue, expiresAt);

      // Store in memory cache (L1) with shorter TTL
      LocalDateTime memoryExpiresAt = LocalDateTime.now().plus(getMemoryCacheTtl());
      CacheEntry entry = new CacheEntry(jsonValue, memoryExpiresAt);

      // Use efficient eviction strategy - put first, then evict if necessary
      memoryCache.put(key, entry);
      if (memoryCache.size() > getMaxMemoryCacheSize()) {
        evictOldestMemoryCacheEntry();
      }

      logger.debug("Cached value for key: {} with TTL: {}", key, ttl);

    } catch (Exception e) {
      logger.error("Error caching value for key: {}", key, e);
    }
  }

  /** Remove a cached value */
  public void evict(String key) {
    try {
      // Remove from memory cache
      memoryCache.remove(key);

      // Remove from database cache
      String sql = "DELETE FROM query_cache WHERE cache_key = ?";
      int deletedRows = jdbcTemplate.update(sql, key);

      if (deletedRows > 0) {
        evictionCount++;
        logger.debug("Evicted cached value for key: {}", key);
      }

    } catch (Exception e) {
      logger.error("Error evicting cached value for key: {}", key, e);
    }
  }

  /** Clear all cached values matching a pattern */
  public void evictByPattern(String pattern) {
    try {
      // Remove from memory cache
      memoryCache.entrySet().removeIf(entry -> entry.getKey().matches(pattern));

      // Remove from database cache
      String sql = "DELETE FROM query_cache WHERE cache_key ~ ?";
      int deletedRows = jdbcTemplate.update(sql, pattern);

      if (deletedRows > 0) {
        evictionCount += deletedRows;
        logger.debug("Evicted {} cached values matching pattern: {}", deletedRows, pattern);
      }

    } catch (Exception e) {
      logger.error("Error evicting cached values by pattern: {}", pattern, e);
    }
  }

  /** Get cache statistics */
  public CacheStatistics getStatistics() {
    try {
      // Get database cache statistics
      String sql =
          "SELECT COUNT(*) as total_entries, "
              + "SUM(hit_count) as total_hits, "
              + "AVG(hit_count) as avg_hits "
              + "FROM query_cache WHERE expires_at > CURRENT_TIMESTAMP";

      return jdbcTemplate.queryForObject(
          sql,
          (rs, rowNum) -> {
            long totalEntries = rs.getLong("total_entries");
            long totalHits = rs.getLong("total_hits");
            double avgHits = rs.getDouble("avg_hits");

            return new CacheStatistics(
                hitCount,
                missCount,
                evictionCount,
                memoryCache.size(),
                totalEntries,
                totalHits,
                avgHits,
                calculateHitRatio());
          });

    } catch (Exception e) {
      logger.error("Error retrieving cache statistics", e);
      return new CacheStatistics(
          hitCount, missCount, evictionCount, memoryCache.size(), 0, 0, 0.0, calculateHitRatio());
    }
  }

  /** Cleanup expired entries from both memory and database cache */
  private void cleanupExpiredEntries() {
    try {
      // Cleanup memory cache
      LocalDateTime now = LocalDateTime.now();
      final int[] memoryEvictedArray = {0};

      memoryCache
          .entrySet()
          .removeIf(
              entry -> {
                if (entry.getValue().isExpired()) {
                  memoryEvictedArray[0]++;
                  return true;
                }
                return false;
              });

      int memoryEvicted = memoryEvictedArray[0];

      if (memoryEvicted > 0) {
        evictionCount += memoryEvicted;
        logger.debug("Cleaned up {} expired entries from memory cache", memoryEvicted);
      }

      // Cleanup database cache
      String sql = "DELETE FROM query_cache WHERE expires_at < CURRENT_TIMESTAMP";
      int dbEvicted = jdbcTemplate.update(sql);

      if (dbEvicted > 0) {
        evictionCount += dbEvicted;
        logger.debug("Cleaned up {} expired entries from database cache", dbEvicted);
      }

    } catch (Exception e) {
      logger.error("Error during cache cleanup", e);
    }
  }

  private void updateCacheStatistics(String key) {
    try {
      String sql =
          "UPDATE query_cache SET hit_count = hit_count + 1, "
              + "last_accessed_at = CURRENT_TIMESTAMP WHERE cache_key = ?";
      jdbcTemplate.update(sql, key);
    } catch (DataAccessException e) {
      // Log but don't fail the cache operation
      logger.debug("Failed to update cache statistics for key: {}", key);
    }
  }

  private void evictOldestMemoryCacheEntry() {
    if (memoryCache.isEmpty()) return;

    // Use LRU-style eviction with batch processing for efficiency
    // Only evict when we're significantly over the limit to reduce frequency
    int currentSize = memoryCache.size();
    int maxSize = getMaxMemoryCacheSize();

    if (currentSize <= maxSize) return;

    // Calculate how many entries to remove (batch eviction)
    int entriesToRemove =
        Math.min(
            currentSize - maxSize + 5, currentSize / 4); // Remove at least 25% or excess + buffer

    // Get oldest entries for batch removal using LRU strategy
    List<String> oldestKeys =
        memoryCache.entrySet().stream()
            .sorted(
                (e1, e2) -> e1.getValue().getCreatedAt().compareTo(e2.getValue().getCreatedAt()))
            .limit(entriesToRemove)
            .map(entry -> entry.getKey())
            .collect(Collectors.toList());

    // Batch remove for efficiency
    for (String key : oldestKeys) {
      memoryCache.remove(key);
      evictionCount++;
    }

    logger.debug(
        "LRU batch evicted {} oldest cache entries (size: {} -> {})",
        oldestKeys.size(),
        currentSize,
        memoryCache.size());
  }

  private <T> String serializeValue(T value) throws JsonProcessingException {
    return objectMapper.writeValueAsString(value);
  }

  private <T> T deserializeValue(String jsonValue, Class<T> valueType)
      throws JsonProcessingException {
    return objectMapper.readValue(jsonValue, valueType);
  }

  private double calculateHitRatio() {
    long total = hitCount + missCount;
    return total > 0 ? (double) hitCount / total : 0.0;
  }

  private void logCacheStatistics() {
    CacheStatistics stats = getStatistics();
    logger.info(
        "Cache Statistics - Hit Ratio: {:.2f}%, Memory Entries: {}, DB Entries: {}, "
            + "Total Hits: {}, Total Misses: {}, Evictions: {}",
        stats.getHitRatio() * 100,
        stats.getMemoryCacheSize(),
        stats.getDatabaseCacheSize(),
        stats.getHitCount(),
        stats.getMissCount(),
        stats.getEvictionCount());
  }

  /** Cache entry for memory cache */
  private static class CacheEntry {
    private final String value;
    private final LocalDateTime expiresAt;
    private final LocalDateTime createdAt;

    public CacheEntry(String value, LocalDateTime expiresAt) {
      this.value = value;
      this.expiresAt = expiresAt;
      this.createdAt = LocalDateTime.now();
    }

    public String getValue() {
      return value;
    }

    public LocalDateTime getCreatedAt() {
      return createdAt;
    }

    public boolean isExpired() {
      return LocalDateTime.now().isAfter(expiresAt);
    }
  }

  /** Cache statistics data class */
  public static class CacheStatistics {
    private final long hitCount;
    private final long missCount;
    private final long evictionCount;
    private final long memoryCacheSize;
    private final long databaseCacheSize;
    private final long totalDatabaseHits;
    private final double averageDatabaseHits;
    private final double hitRatio;

    public CacheStatistics(
        long hitCount,
        long missCount,
        long evictionCount,
        long memoryCacheSize,
        long databaseCacheSize,
        long totalDatabaseHits,
        double averageDatabaseHits,
        double hitRatio) {
      this.hitCount = hitCount;
      this.missCount = missCount;
      this.evictionCount = evictionCount;
      this.memoryCacheSize = memoryCacheSize;
      this.databaseCacheSize = databaseCacheSize;
      this.totalDatabaseHits = totalDatabaseHits;
      this.averageDatabaseHits = averageDatabaseHits;
      this.hitRatio = hitRatio;
    }

    // Getters
    public long getHitCount() {
      return hitCount;
    }

    public long getMissCount() {
      return missCount;
    }

    public long getEvictionCount() {
      return evictionCount;
    }

    public long getMemoryCacheSize() {
      return memoryCacheSize;
    }

    public long getDatabaseCacheSize() {
      return databaseCacheSize;
    }

    public long getTotalDatabaseHits() {
      return totalDatabaseHits;
    }

    public double getAverageDatabaseHits() {
      return averageDatabaseHits;
    }

    public double getHitRatio() {
      return hitRatio;
    }
  }
}
