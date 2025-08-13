package com.storesight.backend.service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
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
  private final com.storesight.backend.repository.ShopRepository shopRepository;
  private final com.storesight.backend.repository.MarketIntelligenceCostRepository costRepository;

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
      com.storesight.backend.repository.ShopRepository shopRepository,
      com.storesight.backend.repository.MarketIntelligenceCostRepository costRepository) {
    this.cacheService = cacheService;
    this.batchService = batchService;
    this.eventPublisher = eventPublisher;
    this.jdbcTemplate = jdbcTemplate;
    this.shopRepository = shopRepository;
    this.costRepository = costRepository;

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
  // DATABASE WRITE OPERATIONS (Placeholders)
  // =====================================

  /** Write competitor data to database */
  private void writeCompetitorDataToDatabase(String shopDomain, Object data) {
    logger.debug("Database write: competitor data for shop {}", shopDomain);

    try {
      if (!(data instanceof Map)) {
        logger.debug("competitorData not a Map - skipping DB write");
        return; // Keep non-breaking behaviour
      }

      @SuppressWarnings("unchecked")
      Map<String, Object> payload = (Map<String, Object>) data;

      // Resolve shopId from domain
      Long shopId =
          shopRepository
              .findByShopifyDomain(shopDomain)
              .map(com.storesight.backend.model.Shop::getId)
              .orElse(null);

      if (shopId == null) {
        logger.warn("writeCompetitorDataToDatabase: Unknown shopDomain {} - skipping", shopDomain);
        return;
      }

      String url = asString(payload.getOrDefault("url", payload.get("competitorUrl")));
      if (url == null || url.isBlank()) {
        logger.debug("writeCompetitorDataToDatabase: missing url - skipping");
        return;
      }

      String label = asString(payload.getOrDefault("label", ""));
      String platform = asString(payload.getOrDefault("platform", identifyPlatform(url)));
      String domain = asString(payload.getOrDefault("domain", extractDomain(url)));
      String productId = asString(payload.get("shopifyProductId"));

      // 1) Check existing (non-deleted) competitor by shop+url
      List<Map<String, Object>> existing =
          jdbcTemplate.queryForList(
              "SELECT id FROM competitor_urls WHERE shop_id = ? AND url = ? AND deleted_at IS NULL",
              shopId,
              url);

      if (!existing.isEmpty()) {
        Long id = ((Number) existing.get(0).get("id")).longValue();
        jdbcTemplate.update(
            "UPDATE competitor_urls SET label = COALESCE(?, label), platform = COALESCE(?, platform), domain = COALESCE(?, domain), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            nullIfBlank(label),
            nullIfBlank(platform),
            nullIfBlank(domain),
            id);
        logger.debug("Updated competitor_urls id={} for shop {}", id, shopId);
        return;
      }

      // 2) If soft-deleted record exists, reactivate
      List<Map<String, Object>> softDeleted =
          jdbcTemplate.queryForList(
              "SELECT id FROM competitor_urls WHERE shop_id = ? AND url = ? AND deleted_at IS NOT NULL",
              shopId,
              url);
      if (!softDeleted.isEmpty()) {
        Long id = ((Number) softDeleted.get(0).get("id")).longValue();
        jdbcTemplate.update(
            "UPDATE competitor_urls SET deleted_at = NULL, label = COALESCE(?, label), platform = COALESCE(?, platform), domain = COALESCE(?, domain), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            nullIfBlank(label),
            nullIfBlank(platform),
            nullIfBlank(domain),
            id);
        logger.debug("Reactivated competitor_urls id={} for shop {}", id, shopId);
        return;
      }

      // 3) Insert new record
      if (productId != null && !productId.isBlank()) {
        jdbcTemplate.update(
            "INSERT INTO competitor_urls (shop_id, shopify_product_id, url, label, platform, domain, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
            shopId,
            productId,
            url,
            label,
            platform,
            domain);
      } else {
        jdbcTemplate.update(
            "INSERT INTO competitor_urls (shop_id, shopify_product_id, url, label, platform, domain, created_at) VALUES (?, NULL, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
            shopId,
            url,
            label,
            platform,
            domain);
      }
      logger.debug("Inserted competitor url for shop {}: {}", shopId, url);
    } catch (Exception e) {
      logger.warn("writeCompetitorDataToDatabase failed: {}", e.getMessage());
    }
  }

  /** Write price data to database */
  private void writePriceDataToDatabase(String shopDomain, Object data) {
    logger.debug("Database write: price data for shop {}", shopDomain);
    try {
      if (!(data instanceof Map)) {
        logger.debug("priceData not a Map - skipping DB write");
        return;
      }

      @SuppressWarnings("unchecked")
      Map<String, Object> payload = (Map<String, Object>) data;

      Long competitorId = asLong(payload.getOrDefault("competitorId", payload.get("competitor_url_id")));
      if (competitorId == null) {
        logger.debug("writePriceDataToDatabase: missing competitorId - skipping");
        return;
      }

      BigDecimal price = asBigDecimal(payload.get("price"));
      Boolean inStock = asBoolean(payload.get("inStock"), true);
      Long checkedAtMs = asLong(payload.get("checkedAt"));
      Timestamp checkedAt =
          checkedAtMs != null ? new Timestamp(checkedAtMs) : Timestamp.from(Instant.now());

      String scraperSource = asString(payload.getOrDefault("scraperSource", "write-service"));
      String platform = asString(payload.get("platform"));
      Integer scraperVersion = 1;
      Integer responseTimeMs = asInteger(payload.get("responseTimeMs"));

      jdbcTemplate.update(
          "INSERT INTO price_snapshots (competitor_url_id, price, in_stock, checked_at, scraper_version, scraper_source, platform, response_time_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          competitorId,
          price,
          inStock,
          checkedAt,
          scraperVersion,
          scraperSource,
          platform,
          responseTimeMs);

      logger.debug("Inserted price snapshot for competitor {}", competitorId);
    } catch (Exception e) {
      logger.warn("writePriceDataToDatabase failed: {}", e.getMessage());
    }
  }

  /** Write cost analytics to database */
  private void writeCostAnalyticsToDatabase(String shopDomain, Object data) {
    logger.debug("Database write: cost analytics for shop {}", shopDomain);
    try {
      if (!(data instanceof Map)) {
        logger.debug("costData not a Map - skipping DB write");
        return;
      }

      @SuppressWarnings("unchecked")
      Map<String, Object> payload = (Map<String, Object>) data;

      Long shopId =
          shopRepository
              .findByShopifyDomain(shopDomain)
              .map(com.storesight.backend.model.Shop::getId)
              .orElse(null);
      if (shopId == null) {
        logger.warn("writeCostAnalyticsToDatabase: Unknown shopDomain {} - skipping", shopDomain);
        return;
      }

      java.time.LocalDate date =
          payload.get("date") instanceof java.time.LocalDate
              ? (java.time.LocalDate) payload.get("date")
              : java.time.LocalDate.now();
      String provider = asString(payload.getOrDefault("provider", "unknown"));
      BigDecimal dailyCost = asBigDecimal(payload.getOrDefault("dailyCost", BigDecimal.ZERO));
      Integer dailyRequests = asInteger(payload.getOrDefault("dailyRequests", 0));
      Integer dailyDiscoveries = asInteger(payload.getOrDefault("dailyDiscoveries", 0));

      var existingOpt =
          costRepository.findByShopIdAndDateAndProvider(shopId, date, provider);
      com.storesight.backend.model.MarketIntelligenceCost entity;
      if (existingOpt.isPresent()) {
        entity = existingOpt.get();
        entity.setDailyCost(dailyCost);
        entity.setDailyRequests(dailyRequests);
        entity.setDailyDiscoveries(dailyDiscoveries);
      } else {
        entity =
            new com.storesight.backend.model.MarketIntelligenceCost(
                shopId, date, provider, dailyCost, dailyRequests, dailyDiscoveries);
      }
      costRepository.save(entity);
    } catch (Exception e) {
      logger.warn("writeCostAnalyticsToDatabase failed: {}", e.getMessage());
    }
  }

  /** Write system status to database */
  private void writeSystemStatusToDatabase(String shopDomain, Object data) {
    // No DB table for system status; write-through cache covers the UX
    logger.debug("No-op DB write: system status for shop {} (cache-only)", shopDomain);
  }

  /** Write performance metrics to database */
  private void writePerformanceMetricsToDatabase(String shopDomain, Object data) {
    // No DB table for performance metrics; keep cache-only to avoid breaking changes
    logger.debug("No-op DB write: performance metrics for shop {} (cache-only)", shopDomain);
  }
  // ===== Helper conversions and URL utilities (duplicate minimal logic to avoid tight coupling)
  private static String asString(Object v) {
    return v == null ? null : String.valueOf(v);
  }

  private static Long asLong(Object v) {
    try {
      if (v == null) return null;
      if (v instanceof Number n) return n.longValue();
      String s = String.valueOf(v);
      if (s.isBlank()) return null;
      return Long.parseLong(s);
    } catch (Exception e) {
      return null;
    }
  }

  private static Integer asInteger(Object v) {
    try {
      if (v == null) return null;
      if (v instanceof Number n) return n.intValue();
      String s = String.valueOf(v);
      if (s.isBlank()) return null;
      return Integer.parseInt(s);
    } catch (Exception e) {
      return null;
    }
  }

  private static BigDecimal asBigDecimal(Object v) {
    try {
      if (v == null) return null;
      if (v instanceof BigDecimal b) return b;
      if (v instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
      String s = String.valueOf(v).replace(",", "");
      if (s.isBlank()) return null;
      return new BigDecimal(s);
    } catch (Exception e) {
      return null;
    }
  }

  private static Boolean asBoolean(Object v, boolean defaultVal) {
    if (v == null) return defaultVal;
    if (v instanceof Boolean b) return b;
    String s = String.valueOf(v).toLowerCase();
    if (s.equals("true") || s.equals("1") || s.equals("yes")) return true;
    if (s.equals("false") || s.equals("0") || s.equals("no")) return false;
    return defaultVal;
  }

  private static String nullIfBlank(String s) {
    return (s == null || s.isBlank()) ? null : s;
  }

  private static String extractDomain(String url) {
    try {
      String u = url.toLowerCase();
      int start = u.indexOf("//");
      String rest = start >= 0 ? u.substring(start + 2) : u;
      int slash = rest.indexOf('/');
      return slash > 0 ? rest.substring(0, slash) : rest;
    } catch (Exception e) {
      return "unknown";
    }
  }

  private static String identifyPlatform(String url) {
    String u = url.toLowerCase();
    if (u.contains("amazon.")) return "amazon";
    if (u.contains("walmart.")) return "walmart";
    if (u.contains("target.")) return "target";
    if (u.contains("bestbuy.")) return "bestbuy";
    if (u.contains("etsy.")) return "etsy";
    if (u.contains("ebay.")) return "ebay";
    if (u.contains("shopify") || u.contains(".myshopify.com")) return "shopify";
    return "generic";
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
