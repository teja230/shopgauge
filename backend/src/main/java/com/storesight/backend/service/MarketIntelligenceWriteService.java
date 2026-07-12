package com.storesight.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Market Intelligence Write Service with Write-Through Cache Pattern
 *
 * <p>Implements write-through caching strategy where writes go to both database and cache
 * simultaneously, ensuring data consistency and optimal read performance following the optimization
 * guide recommendations.
 *
 * <p>Key Features: - Write-through cache pattern with immediate cache updates - Event-driven cache
 * invalidation - Batch operation integration - Memory profile-aware processing - Performance
 * monitoring and cost tracking
 */
@Service
public class MarketIntelligenceWriteService {

  private static final Logger logger =
      LoggerFactory.getLogger(MarketIntelligenceWriteService.class);

  // Write operation events for cache invalidation
  public static class WriteOperationEvent {
    private final String operation;
    private final String shopDomain;
    private final Object data;
    private final LocalDateTime timestamp;
    private final String operationId;

    public WriteOperationEvent(
        String operation, String shopDomain, Object data, String operationId) {
      this.operation = operation;
      this.shopDomain = shopDomain;
      this.data = data;
      this.operationId = operationId;
      this.timestamp = LocalDateTime.now();
    }

    // Getters
    public String getOperation() {
      return operation;
    }

    public String getShopDomain() {
      return shopDomain;
    }

    public Object getData() {
      return data;
    }

    public LocalDateTime getTimestamp() {
      return timestamp;
    }

    public String getOperationId() {
      return operationId;
    }
  }

  // Services
  private final MarketIntelligenceCacheService cacheService;
  private final MarketIntelligenceBatchService batchService;
  private final ApplicationEventPublisher eventPublisher;
  private final JdbcTemplate jdbcTemplate;
  private final ObjectMapper objectMapper;

  // Statistics tracking
  private final AtomicLong totalWriteOperations = new AtomicLong(0);
  private final AtomicLong successfulWrites = new AtomicLong(0);
  private final AtomicLong failedWrites = new AtomicLong(0);
  private final AtomicLong cachedWrites = new AtomicLong(0);
  private final AtomicLong batchedWrites = new AtomicLong(0);

  // Memory profile configuration
  @Value("${storesight.memory.profile:512MB}")
  private String memoryProfile;

  @Value("${storesight.write.through.cache.enabled:true}")
  private boolean writeThroughCacheEnabled;

  @Value("${storesight.write.batch.enabled:true}")
  private boolean writeBatchEnabled;

  public MarketIntelligenceWriteService(
      MarketIntelligenceCacheService cacheService,
      MarketIntelligenceBatchService batchService,
      ApplicationEventPublisher eventPublisher,
      JdbcTemplate jdbcTemplate,
      ObjectMapper objectMapper) {
    this.cacheService = cacheService;
    this.batchService = batchService;
    this.eventPublisher = eventPublisher;
    this.jdbcTemplate = jdbcTemplate;
    this.objectMapper = objectMapper;

    logger.info(
        "MarketIntelligenceWriteService initialized - Memory Profile: {}, "
            + "WriteThrough: {}, Batching: {}",
        memoryProfile,
        writeThroughCacheEnabled,
        writeBatchEnabled);
  }

  // =====================================
  // WRITE-THROUGH CACHE OPERATIONS
  // =====================================

  /**
   * Update competitor data with write-through cache pattern 1. Write to database 2. Update cache
   * immediately 3. Invalidate related caches 4. Publish cache invalidation event
   */
  @Transactional
  public CompletableFuture<Void> updateCompetitorData(String shopDomain, Object competitorData) {
    String operationId = UUID.randomUUID().toString();

    return CompletableFuture.supplyAsync(
        () -> {
          try {
            totalWriteOperations.incrementAndGet();

            // 1. Write to database (would be actual repository call)
            logger.debug(
                "Writing competitor data to database for shop: {} (Operation: {})",
                shopDomain,
                operationId);

            // Simulate database write - replace with actual repository call
            writeCompetitorDataToDatabase(shopDomain, competitorData);

            // 2. Update cache immediately (write-through)
            if (writeThroughCacheEnabled) {
              cacheService.cacheCompetitorData(shopDomain, competitorData);
              cachedWrites.incrementAndGet();
              logger.debug("Updated competitor data cache for shop: {}", shopDomain);
            }

            // 3. Invalidate related caches
            cacheService.invalidateRelatedCaches("competitor_added", shopDomain);

            // 4. Publish event for additional cache invalidation
            publishWriteEvent("competitor_update", shopDomain, competitorData, operationId);

            successfulWrites.incrementAndGet();
            logger.info(
                "Successfully updated competitor data for shop: {} (Operation: {})",
                shopDomain,
                operationId);

            return null;

          } catch (Exception e) {
            failedWrites.incrementAndGet();
            logger.error(
                "Failed to update competitor data for shop: {} (Operation: {}): {}",
                shopDomain,
                operationId,
                e.getMessage(),
                e);
            throw new RuntimeException("Failed to update competitor data", e);
          }
        });
  }

  /** Update price data with write-through cache pattern and batch integration */
  @Transactional
  public CompletableFuture<Void> updatePriceData(
      String shopDomain, Object priceData, boolean useBatching) {
    String operationId = UUID.randomUUID().toString();

    if (useBatching && writeBatchEnabled && shouldUseBatching()) {
      // Add to batch for processing
      batchService.addToBatch(
          MarketIntelligenceBatchService.OperationType.PRICE_UPDATE,
          shopDomain,
          priceData,
          operationId);
      batchedWrites.incrementAndGet();
      logger.debug(
          "Added price update to batch for shop: {} (Operation: {})", shopDomain, operationId);
      return CompletableFuture.completedFuture(null);
    }

    return CompletableFuture.supplyAsync(
        () -> {
          try {
            totalWriteOperations.incrementAndGet();

            // 1. Write to database
            logger.debug(
                "Writing price data to database for shop: {} (Operation: {})",
                shopDomain,
                operationId);

            writePriceDataToDatabase(shopDomain, priceData);

            // 2. Update cache immediately
            if (writeThroughCacheEnabled) {
              cacheService.cachePriceHistory(shopDomain, priceData);
              cachedWrites.incrementAndGet();
            }

            // 3. Invalidate related caches
            cacheService.invalidateRelatedCaches("price_scraping", shopDomain);

            // 4. Publish event
            publishWriteEvent("price_update", shopDomain, priceData, operationId);

            successfulWrites.incrementAndGet();
            logger.info(
                "Successfully updated price data for shop: {} (Operation: {})",
                shopDomain,
                operationId);

            return null;

          } catch (Exception e) {
            failedWrites.incrementAndGet();
            logger.error(
                "Failed to update price data for shop: {} (Operation: {}): {}",
                shopDomain,
                operationId,
                e.getMessage(),
                e);
            throw new RuntimeException("Failed to update price data", e);
          }
        });
  }

  /** Update cost analytics with write-through cache pattern */
  @Transactional
  public CompletableFuture<Void> updateCostAnalytics(String shopDomain, Object costData) {
    String operationId = UUID.randomUUID().toString();

    return CompletableFuture.supplyAsync(
        () -> {
          try {
            totalWriteOperations.incrementAndGet();

            // 1. Write to database
            logger.debug(
                "Writing cost analytics to database for shop: {} (Operation: {})",
                shopDomain,
                operationId);

            writeCostAnalyticsToDatabase(shopDomain, costData);

            // 2. Cost analytics cache doesn't need update as it's append-only
            // But we invalidate dashboard cache to show updated costs
            cacheService.invalidateRelatedCaches("cost_tracking", shopDomain);

            // 3. Publish event
            publishWriteEvent("cost_update", shopDomain, costData, operationId);

            successfulWrites.incrementAndGet();
            logger.info(
                "Successfully updated cost analytics for shop: {} (Operation: {})",
                shopDomain,
                operationId);

            return null;

          } catch (Exception e) {
            failedWrites.incrementAndGet();
            logger.error(
                "Failed to update cost analytics for shop: {} (Operation: {}): {}",
                shopDomain,
                operationId,
                e.getMessage(),
                e);
            throw new RuntimeException("Failed to update cost analytics", e);
          }
        });
  }

  /** Update system status with write-through cache pattern */
  @Transactional
  public CompletableFuture<Void> updateSystemStatus(String shopDomain, Object statusData) {
    String operationId = UUID.randomUUID().toString();

    return CompletableFuture.supplyAsync(
        () -> {
          try {
            totalWriteOperations.incrementAndGet();

            // 1. Write to database
            logger.debug(
                "Writing system status to database for shop: {} (Operation: {})",
                shopDomain,
                operationId);

            writeSystemStatusToDatabase(shopDomain, statusData);

            // 2. Update cache immediately
            if (writeThroughCacheEnabled) {
              cacheService.cacheSystemStatus(shopDomain, statusData);
              cachedWrites.incrementAndGet();
            }

            // 3. Invalidate related caches
            cacheService.invalidateRelatedCaches("system_status_change", shopDomain);

            // 4. Publish event
            publishWriteEvent("system_status_update", shopDomain, statusData, operationId);

            successfulWrites.incrementAndGet();
            logger.info(
                "Successfully updated system status for shop: {} (Operation: {})",
                shopDomain,
                operationId);

            return null;

          } catch (Exception e) {
            failedWrites.incrementAndGet();
            logger.error(
                "Failed to update system status for shop: {} (Operation: {}): {}",
                shopDomain,
                operationId,
                e.getMessage(),
                e);
            throw new RuntimeException("Failed to update system status", e);
          }
        });
  }

  /** Update performance metrics with write-through cache pattern */
  @Transactional
  public CompletableFuture<Void> updatePerformanceMetrics(String shopDomain, Object metricsData) {
    String operationId = UUID.randomUUID().toString();

    return CompletableFuture.supplyAsync(
        () -> {
          try {
            totalWriteOperations.incrementAndGet();

            // 1. Write to database
            logger.debug(
                "Writing performance metrics to database for shop: {} (Operation: {})",
                shopDomain,
                operationId);

            writePerformanceMetricsToDatabase(shopDomain, metricsData);

            // 2. Update cache immediately
            if (writeThroughCacheEnabled) {
              cacheService.cachePerformanceMetrics(shopDomain, metricsData);
              cachedWrites.incrementAndGet();
            }

            // 3. Invalidate related caches
            cacheService.invalidateRelatedCaches("performance_update", shopDomain);

            // 4. Publish event
            publishWriteEvent("performance_metrics_update", shopDomain, metricsData, operationId);

            successfulWrites.incrementAndGet();
            logger.info(
                "Successfully updated performance metrics for shop: {} (Operation: {})",
                shopDomain,
                operationId);

            return null;

          } catch (Exception e) {
            failedWrites.incrementAndGet();
            logger.error(
                "Failed to update performance metrics for shop: {} (Operation: {}): {}",
                shopDomain,
                operationId,
                e.getMessage(),
                e);
            throw new RuntimeException("Failed to update performance metrics", e);
          }
        });
  }

  // =====================================
  // DATABASE WRITE OPERATIONS
  // =====================================

  /** Write competitor data to database */
  private void writeCompetitorDataToDatabase(String shopDomain, Object data) {
    persistWrite("competitor_data", shopDomain, data);
  }

  /** Write price data to database */
  private void writePriceDataToDatabase(String shopDomain, Object data) {
    persistWrite("price_data", shopDomain, data);
  }

  /** Write cost analytics to database */
  private void writeCostAnalyticsToDatabase(String shopDomain, Object data) {
    persistWrite("cost_analytics", shopDomain, data);
  }

  /** Write system status to database */
  private void writeSystemStatusToDatabase(String shopDomain, Object data) {
    persistWrite("system_status", shopDomain, data);
  }

  /** Write performance metrics to database */
  private void writePerformanceMetricsToDatabase(String shopDomain, Object data) {
    persistWrite("performance_metrics", shopDomain, data);
  }

  private void persistWrite(String dataType, String shopDomain, Object data) {
    try {
      jdbcTemplate.update(
          """
          INSERT INTO market_intelligence_write_log
              (operation_id, shop_domain, data_type, payload, created_at)
          VALUES (?, ?, ?, CAST(? AS jsonb), CURRENT_TIMESTAMP)
          """,
          UUID.randomUUID(),
          shopDomain,
          dataType,
          objectMapper.writeValueAsString(data));
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Market intelligence payload is not serializable", e);
    }
  }

  // =====================================
  // UTILITY METHODS
  // =====================================

  /** Determine if batching should be used based on memory profile and system load */
  private boolean shouldUseBatching() {
    if (!"512MB".equals(memoryProfile)) {
      return true; // Always use batching for larger memory profiles
    }

    // For 512MB profile, use batching only when memory pressure is low
    Runtime runtime = Runtime.getRuntime();
    long usedMemory = runtime.totalMemory() - runtime.freeMemory();
    long maxMemory = runtime.maxMemory();
    double memoryUsagePercent = (double) usedMemory / maxMemory * 100;

    return memoryUsagePercent < 70; // Conservative threshold for 512MB
  }

  /** Publish write operation event for cache invalidation */
  private void publishWriteEvent(
      String operation, String shopDomain, Object data, String operationId) {
    try {
      WriteOperationEvent event = new WriteOperationEvent(operation, shopDomain, data, operationId);
      eventPublisher.publishEvent(event);
      logger.debug(
          "Published write event: {} for shop: {} (Operation: {})",
          operation,
          shopDomain,
          operationId);
    } catch (Exception e) {
      logger.warn(
          "Failed to publish write event for operation {}: {}", operationId, e.getMessage());
    }
  }

  // =====================================
  // MONITORING AND STATISTICS
  // =====================================

  /** Get write operation statistics */
  public Map<String, Object> getWriteStatistics() {
    Map<String, Object> stats = new HashMap<>();

    stats.put("memoryProfile", memoryProfile);
    stats.put("writeThroughCacheEnabled", writeThroughCacheEnabled);
    stats.put("writeBatchEnabled", writeBatchEnabled);
    stats.put("totalWriteOperations", totalWriteOperations.get());
    stats.put("successfulWrites", successfulWrites.get());
    stats.put("failedWrites", failedWrites.get());
    stats.put("cachedWrites", cachedWrites.get());
    stats.put("batchedWrites", batchedWrites.get());

    // Calculate success rate
    long total = successfulWrites.get() + failedWrites.get();
    double successRate = total > 0 ? (double) successfulWrites.get() / total * 100 : 100.0;
    stats.put("successRate", String.format("%.2f%%", successRate));

    // Calculate cache hit rate for writes
    long totalWithCache = successfulWrites.get();
    double cacheRate =
        totalWithCache > 0 ? (double) cachedWrites.get() / totalWithCache * 100 : 0.0;
    stats.put("writeCacheRate", String.format("%.2f%%", cacheRate));

    // Calculate batch rate
    double batchRate =
        totalWriteOperations.get() > 0
            ? (double) batchedWrites.get() / totalWriteOperations.get() * 100
            : 0.0;
    stats.put("batchRate", String.format("%.2f%%", batchRate));

    return stats;
  }

  /** Reset write operation statistics */
  public void resetWriteStatistics() {
    totalWriteOperations.set(0);
    successfulWrites.set(0);
    failedWrites.set(0);
    cachedWrites.set(0);
    batchedWrites.set(0);
    logger.info("Write operation statistics reset");
  }

  /** Check if write operations are healthy */
  public boolean isWriteOperationsHealthy() {
    long total = successfulWrites.get() + failedWrites.get();
    if (total == 0) {
      return true; // No operations yet, consider healthy
    }

    double successRate = (double) successfulWrites.get() / total * 100;
    boolean successRateHealthy = successRate >= 95; // 95% success rate threshold

    boolean memoryHealthy = shouldUseBatching(); // Memory pressure check

    return successRateHealthy && memoryHealthy;
  }

  /** Get write throughput (operations per minute) */
  public double getWriteThroughput() {
    // Implementation would track operations over time
    // For now, return a simple calculation based on total operations
    return totalWriteOperations.get() / 60.0; // Rough estimate
  }
}
