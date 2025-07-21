package com.storesight.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.config.ApplicationConfigurationProperties;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
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
  private final AtomicLong hitCount = new AtomicLong(0);
  private final AtomicLong missCount = new AtomicLong(0);
  private final AtomicLong evictionCount = new AtomicLong(0);

  // Circuit breaker for database operations
  private final AtomicBoolean databaseAvailable = new AtomicBoolean(true);
  private final AtomicLong lastDatabaseCheck = new AtomicLong(0);
  private static final long DATABASE_CHECK_INTERVAL_MS = 300000; // 5 minutes (reduced frequency)
  private static final long ERROR_SUPPRESSION_INTERVAL_MS =
      900000; // 15 minutes (reduced frequency)
  private final AtomicLong lastErrorLog = new AtomicLong(0);

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
    // Check database availability on startup
    checkDatabaseAvailability();

    // Schedule periodic cleanup of expired entries with startup delay
    scheduler.scheduleAtFixedRate(
        this::cleanupExpiredEntries,
        10, // 10-minute startup delay
        getCleanupInterval().toMinutes(),
        TimeUnit.MINUTES);

    // Schedule periodic statistics logging - reduced frequency for resource conservation
    long statsIntervalMinutes =
        Math.max(getStatisticsInterval().toMinutes() * 4, 60); // At least 1 hour
    scheduler.scheduleAtFixedRate(
        this::logCacheStatistics,
        30,
        statsIntervalMinutes,
        TimeUnit.MINUTES); // 30-minute startup delay

    logger.info(
        "QueryResultCacheService initialized with memory cache size: {} (Database available: {})",
        getMaxMemoryCacheSize(),
        databaseAvailable.get());
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
        hitCount.incrementAndGet();
        return Optional.of(deserializeValue(memoryEntry.getValue(), valueType));
      }

      // Check database cache (L2) only if database is available
      if (!isDatabaseAvailable()) {
        missCount.incrementAndGet();
        return Optional.empty();
      }

      String sql =
          "SELECT cache_value, expires_at FROM query_cache WHERE cache_key = ? AND expires_at > CURRENT_TIMESTAMP";

      return jdbcTemplate.query(
          sql,
          rs -> {
            if (rs.next()) {
              String jsonValue = rs.getString("cache_value");
              LocalDateTime expiresAt = rs.getTimestamp("expires_at").toLocalDateTime();

              // Update hit count and last accessed time (non-blocking)
              updateCacheStatistics(key);

              // Store in memory cache for faster future access
              CacheEntry entry = new CacheEntry(jsonValue, expiresAt);
              memoryCache.put(key, entry);

              // Evict if necessary (handled by eviction strategy)
              if (memoryCache.size() > getMaxMemoryCacheSize()) {
                evictOldestMemoryCacheEntry();
              }

              hitCount.incrementAndGet();
              try {
                return Optional.of(deserializeValue(jsonValue, valueType));
              } catch (JsonProcessingException e) {
                logErrorWithSuppression("Error deserializing cached value for key: " + key, e);
                return Optional.<T>empty();
              }
            } else {
              missCount.incrementAndGet();
              return Optional.<T>empty();
            }
          },
          key);

    } catch (Exception e) {
      markDatabaseUnavailable();
      logErrorWithSuppression("Error retrieving cached value for key: " + key, e);
      missCount.incrementAndGet();
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

      // Always store in memory cache (L1)
      LocalDateTime memoryExpiresAt = LocalDateTime.now().plus(getMemoryCacheTtl());
      CacheEntry entry = new CacheEntry(jsonValue, memoryExpiresAt);

      // Use efficient eviction strategy - evict first if necessary, then put
      if (memoryCache.size() >= getMaxMemoryCacheSize()) {
        evictOldestMemoryCacheEntry();
      }
      memoryCache.put(key, entry);

      // Store in database cache (L2) only if database is available
      if (isDatabaseAvailable()) {
        try {
          String sql =
              "INSERT INTO query_cache (cache_key, cache_value, expires_at) "
                  + "VALUES (?, ?::jsonb, ?) "
                  + "ON CONFLICT (cache_key) DO UPDATE SET "
                  + "cache_value = EXCLUDED.cache_value, "
                  + "expires_at = EXCLUDED.expires_at, "
                  + "updated_at = CURRENT_TIMESTAMP";

          jdbcTemplate.update(sql, key, jsonValue, expiresAt);
        } catch (Exception e) {
          markDatabaseUnavailable();
          logErrorWithSuppression("Error storing cache value in database for key: " + key, e);
        }
      }

      logger.debug("Cached value for key: {} with TTL: {}", key, ttl);

    } catch (Exception e) {
      logErrorWithSuppression("Error caching value for key: " + key, e);
    }
  }

  /** Remove a cached value */
  public void evict(String key) {
    try {
      // Remove from memory cache
      memoryCache.remove(key);

      // Remove from database cache only if database is available
      if (isDatabaseAvailable()) {
        try {
          String sql = "DELETE FROM query_cache WHERE cache_key = ?";
          int deletedRows = jdbcTemplate.update(sql, key);

          if (deletedRows > 0) {
            evictionCount.incrementAndGet();
            logger.debug("Evicted cached value for key: {}", key);
          }
        } catch (Exception e) {
          markDatabaseUnavailable();
          logErrorWithSuppression("Error evicting cache value from database for key: " + key, e);
        }
      }

    } catch (Exception e) {
      logErrorWithSuppression("Error evicting cached value for key: " + key, e);
    }
  }

  /** Clear all cached values matching a pattern */
  public void evictByPattern(String pattern) {
    try {
      // Remove from memory cache
      memoryCache.entrySet().removeIf(entry -> entry.getKey().matches(pattern));

      // Remove from database cache only if database is available
      if (isDatabaseAvailable()) {
        try {
          String sql = "DELETE FROM query_cache WHERE cache_key ~ ?";
          int deletedRows = jdbcTemplate.update(sql, pattern);

          if (deletedRows > 0) {
            evictionCount.addAndGet(deletedRows);
            logger.debug("Evicted {} cached values matching pattern: {}", deletedRows, pattern);
          }
        } catch (Exception e) {
          markDatabaseUnavailable();
          logErrorWithSuppression("Error evicting cache values by pattern: " + pattern, e);
        }
      }

    } catch (Exception e) {
      logErrorWithSuppression("Error evicting cached values by pattern: " + pattern, e);
    }
  }

  /** Get cache statistics */
  public CacheStatistics getStatistics() {
    try {
      // If database is not available, return memory-only statistics
      if (!isDatabaseAvailable()) {
        return new CacheStatistics(
            hitCount.get(),
            missCount.get(),
            evictionCount.get(),
            memoryCache.size(),
            0,
            0,
            0.0,
            calculateHitRatio());
      }

      // Get database cache statistics - use queryForList to handle empty results
      String sql =
          "SELECT COUNT(*) as total_entries, "
              + "COALESCE(SUM(hit_count), 0) as total_hits, "
              + "COALESCE(AVG(hit_count), 0) as avg_hits "
              + "FROM query_cache WHERE expires_at > CURRENT_TIMESTAMP";

      List<Map<String, Object>> results = jdbcTemplate.queryForList(sql);

      if (results.isEmpty()) {
        // Return default statistics when table is empty
        return new CacheStatistics(
            hitCount.get(),
            missCount.get(),
            evictionCount.get(),
            memoryCache.size(),
            0,
            0,
            0.0,
            calculateHitRatio());
      }

      Map<String, Object> row = results.get(0);
      long totalEntries = ((Number) row.get("total_entries")).longValue();
      long totalHits = ((Number) row.get("total_hits")).longValue();
      double avgHits = ((Number) row.get("avg_hits")).doubleValue();

      return new CacheStatistics(
          hitCount.get(),
          missCount.get(),
          evictionCount.get(),
          memoryCache.size(),
          totalEntries,
          totalHits,
          avgHits,
          calculateHitRatio());

    } catch (Exception e) {
      markDatabaseUnavailable();
      logErrorWithSuppression("Error retrieving cache statistics", e);
      return new CacheStatistics(
          hitCount.get(),
          missCount.get(),
          evictionCount.get(),
          memoryCache.size(),
          0,
          0,
          0.0,
          calculateHitRatio());
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
        evictionCount.addAndGet(memoryEvicted);
        logger.debug("Cleaned up {} expired entries from memory cache", memoryEvicted);
      }

      // Cleanup database cache only if database is available
      if (isDatabaseAvailable()) {
        try {
          String sql = "DELETE FROM query_cache WHERE expires_at < CURRENT_TIMESTAMP";
          int dbEvicted = jdbcTemplate.update(sql);

          if (dbEvicted > 0) {
            evictionCount.addAndGet(dbEvicted);
            logger.debug("Cleaned up {} expired entries from database cache", dbEvicted);
          }
        } catch (Exception e) {
          markDatabaseUnavailable();
          logErrorWithSuppression("Error cleaning up expired database cache entries", e);
        }
      }

    } catch (Exception e) {
      logErrorWithSuppression("Error during cache cleanup", e);
    }
  }

  private void updateCacheStatistics(String key) {
    if (!isDatabaseAvailable()) {
      return;
    }

    try {
      String sql =
          "UPDATE query_cache SET hit_count = hit_count + 1, "
              + "updated_at = CURRENT_TIMESTAMP WHERE cache_key = ?";
      jdbcTemplate.update(sql, key);
    } catch (DataAccessException e) {
      markDatabaseUnavailable();
      // Don't log this error as it's not critical
    }
  }

  private boolean isDatabaseAvailable() {
    long now = System.currentTimeMillis();

    // Check if we need to verify database availability
    if (!databaseAvailable.get() && (now - lastDatabaseCheck.get()) > DATABASE_CHECK_INTERVAL_MS) {
      checkDatabaseAvailability();
    }

    return databaseAvailable.get();
  }

  private void checkDatabaseAvailability() {
    try {
      // Try a simple query to check if the table exists - use query instead of queryForObject
      // to avoid "Incorrect result size" error when table is empty
      List<Integer> results =
          jdbcTemplate.queryForList("SELECT 1 FROM query_cache LIMIT 1", Integer.class);
      databaseAvailable.set(true);
      lastDatabaseCheck.set(System.currentTimeMillis());
      logger.debug("Database cache is available");
    } catch (Exception e) {
      databaseAvailable.set(false);
      lastDatabaseCheck.set(System.currentTimeMillis());

      // Only log this error once per interval
      long now = System.currentTimeMillis();
      if (now - lastErrorLog.get() > ERROR_SUPPRESSION_INTERVAL_MS) {
        logger.warn(
            "Database cache is not available, falling back to memory-only cache: {}",
            e.getMessage());
        lastErrorLog.set(now);
      }
    }
  }

  private void markDatabaseUnavailable() {
    if (databaseAvailable.compareAndSet(true, false)) {
      logger.warn("Database cache marked as unavailable, switching to memory-only mode");
    }
  }

  private void logErrorWithSuppression(String message, Exception e) {
    long now = System.currentTimeMillis();
    if (now - lastErrorLog.get() > ERROR_SUPPRESSION_INTERVAL_MS) {
      logger.error(message, e);
      lastErrorLog.set(now);
    } else {
      logger.debug(message + ": " + e.getMessage());
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
      evictionCount.incrementAndGet();
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
    long total = hitCount.get() + missCount.get();
    return total > 0 ? (double) hitCount.get() / total : 0.0;
  }

  private void logCacheStatistics() {
    CacheStatistics stats = getStatistics();

    // Only log if there's actual activity or issues
    long totalActivity = stats.getHitCount() + stats.getMissCount();

    if (totalActivity > 0) {
      // Only log if there are issues or low hit ratio
      if (stats.getHitRatio() < 0.5 || stats.getEvictionCount() > 100) {
        logger.warn(
            "Cache Statistics - Hit Ratio: {}%, Memory Entries: {}, DB Entries: {}, "
                + "Total Hits: {}, Total Misses: {}, Evictions: {}",
            String.format("%.2f", stats.getHitRatio() * 100),
            stats.getMemoryCacheSize(),
            stats.getDatabaseCacheSize(),
            stats.getHitCount(),
            stats.getMissCount(),
            stats.getEvictionCount());
      } else {
        logger.debug(
            "Cache Statistics - Hit Ratio: {}%, Memory Entries: {}, DB Entries: {}, "
                + "Total Hits: {}, Total Misses: {}, Evictions: {}",
            String.format("%.2f", stats.getHitRatio() * 100),
            stats.getMemoryCacheSize(),
            stats.getDatabaseCacheSize(),
            stats.getHitCount(),
            stats.getMissCount(),
            stats.getEvictionCount());
      }
    } else {
      // No activity - only log at trace level to reduce noise
      logger.trace("Cache Statistics - No activity detected, skipping detailed logging");
    }
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
