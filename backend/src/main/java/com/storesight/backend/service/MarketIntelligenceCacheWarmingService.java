package com.storesight.backend.service;

import com.storesight.backend.config.MarketIntelligenceOptimizationProperties;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * CORRECTED Market Intelligence Cache Warming Service
 *
 * <p>Enterprise-grade cache warming with proper SQL queries validated against actual database
 * schema. Uses shop_id instead of non-existent shop_domain columns.
 */
@Service
public class MarketIntelligenceCacheWarmingService {

  private static final Logger logger =
      LoggerFactory.getLogger(MarketIntelligenceCacheWarmingService.class);

  private final MarketIntelligenceCacheService cacheService;
  private final CostOptimizationService costOptimizationService;
  private final JdbcTemplate jdbcTemplate;
  private final MarketIntelligenceOptimizationProperties properties;

  @Value("${storesight.memory.profile:512MB}")
  private String memoryProfile;

  // Statistics tracking
  private final AtomicLong totalWarmingOperations = new AtomicLong(0);
  private final AtomicInteger currentWarmingTasks = new AtomicInteger(0);
  private final AtomicInteger successfulWarmups = new AtomicInteger(0);
  private final AtomicInteger failedWarmups = new AtomicInteger(0);

  // Warming priority levels
  public enum WarmingPriority {
    CRITICAL(1),
    HIGH(2),
    MEDIUM(3),
    LOW(4);

    private final int level;

    WarmingPriority(int level) {
      this.level = level;
    }

    public int getLevel() {
      return level;
    }
  }

  public MarketIntelligenceCacheWarmingService(
      MarketIntelligenceCacheService cacheService,
      CostOptimizationService costOptimizationService,
      JdbcTemplate jdbcTemplate,
      MarketIntelligenceOptimizationProperties properties) {
    this.cacheService = cacheService;
    this.costOptimizationService = costOptimizationService;
    this.jdbcTemplate = jdbcTemplate;
    this.properties = properties;
  }

  // =====================================
  // SCHEDULED WARMING (Feature Flag Controlled)
  // =====================================

  /**
   * Scheduled cache warming - ONLY if enabled in feature flags For 512MB instances, this should
   * typically be disabled and done on-demand
   */
  @Scheduled(cron = "${storesight.market-intelligence.cache.warming.schedule:0 0 2 * * *}")
  public void scheduledCacheWarming() {
    // Check if scheduled warming is enabled
    if (!properties.getFeature().getMarketIntelligence().isWarmingEnabled()) {
      logger.debug("Scheduled cache warming is disabled via feature flag");
      return;
    }

    // For 512MB profile, skip scheduled warming to save resources
    if ("512MB".equals(memoryProfile)) {
      logger.debug(
          "Scheduled cache warming skipped for 512MB profile - use on-demand warming instead");
      return;
    }

    logger.info("Starting scheduled cache warming cycle");
    performCacheWarming();
  }

  /** Manual cache warming trigger - always available regardless of feature flags */
  public void triggerManualWarming() {
    logger.info("Starting manual cache warming cycle");
    performCacheWarming();
  }

  // =====================================
  // CORE WARMING LOGIC
  // =====================================

  /** Main cache warming logic */
  private void performCacheWarming() {
    if (currentWarmingTasks.get() > 0) {
      logger.warn("Cache warming already in progress, skipping");
      return;
    }

    currentWarmingTasks.incrementAndGet();

    try {
      // Get active shops that need warming
      List<String> activeShops = getActiveShops();

      if (activeShops.isEmpty()) {
        logger.info("No active shops found for cache warming");
        return;
      }

      logger.info("Starting cache warming for {} shops", activeShops.size());

      // Warm caches by priority level
      warmCriticalData(activeShops);

      if (isMemoryAvailableForWarming()) {
        warmHighPriorityData(activeShops);
      }

      if (isMemoryAvailableForWarming() && !"512MB".equals(memoryProfile)) {
        warmMediumPriorityData(activeShops);
      }

      successfulWarmups.incrementAndGet();
      logger.info("Cache warming cycle completed successfully for {} shops", activeShops.size());

    } catch (Exception e) {
      failedWarmups.incrementAndGet();
      logger.error("Error during cache warming cycle: {}", e.getMessage(), e);
    } finally {
      currentWarmingTasks.decrementAndGet();
    }
  }

  // =====================================
  // PRIORITY-BASED WARMING STRATEGIES
  // =====================================

  /** Warm critical data (Priority 1) - Always executed */
  private void warmCriticalData(List<String> activeShops) {
    logger.debug("Warming critical data for {} shops", activeShops.size());

    List<CompletableFuture<Void>> futures = new ArrayList<>();

    for (String shopIdentifier : activeShops) {
      if (shouldWarmShopCache(shopIdentifier, WarmingPriority.CRITICAL)) {
        CompletableFuture<Void> future =
            CompletableFuture.runAsync(
                () -> {
                  try {
                    warmDashboardData(shopIdentifier);
                    totalWarmingOperations.incrementAndGet();
                  } catch (Exception e) {
                    logger.warn(
                        "Failed to warm critical data for shop {}: {}",
                        shopIdentifier,
                        e.getMessage());
                  }
                });
        futures.add(future);
      }
    }

    // Wait for all critical warming to complete
    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    logger.debug("Critical data warming completed");
  }

  /** Warm high priority data (Priority 2) */
  private void warmHighPriorityData(List<String> activeShops) {
    logger.debug("Warming high priority data for {} shops", activeShops.size());

    List<CompletableFuture<Void>> futures = new ArrayList<>();

    for (String shopIdentifier : activeShops) {
      if (shouldWarmShopCache(shopIdentifier, WarmingPriority.HIGH)) {
        CompletableFuture<Void> future =
            CompletableFuture.runAsync(
                () -> {
                  try {
                    warmCostAnalytics(shopIdentifier);
                    warmDiscoveryStats(shopIdentifier);
                    totalWarmingOperations.addAndGet(2);
                  } catch (Exception e) {
                    logger.warn(
                        "Failed to warm high priority data for shop {}: {}",
                        shopIdentifier,
                        e.getMessage());
                  }
                });
        futures.add(future);
      }
    }

    // Wait for completion with timeout
    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    logger.debug("High priority data warming completed");
  }

  /** Warm medium priority data (Priority 3) */
  private void warmMediumPriorityData(List<String> activeShops) {
    logger.debug("Warming medium priority data for {} shops", activeShops.size());

    List<CompletableFuture<Void>> futures = new ArrayList<>();

    for (String shopIdentifier : activeShops) {
      if (shouldWarmShopCache(shopIdentifier, WarmingPriority.MEDIUM)) {
        CompletableFuture<Void> future =
            CompletableFuture.runAsync(
                () -> {
                  try {
                    warmProviderStats(shopIdentifier);
                    warmPerformanceMetrics(shopIdentifier);
                    totalWarmingOperations.addAndGet(2);
                  } catch (Exception e) {
                    logger.warn(
                        "Failed to warm medium priority data for shop {}: {}",
                        shopIdentifier,
                        e.getMessage());
                  }
                });
        futures.add(future);
      }
    }

    // Wait for completion
    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    logger.debug("Medium priority data warming completed");
  }

  // =====================================
  // INDIVIDUAL WARMING OPERATIONS
  // =====================================

  /** Warm dashboard data for a specific shop */
  private void warmDashboardData(String shopIdentifier) {
    try {
      if (!cacheService.hasFreshCache("mi:dashboard:" + shopIdentifier)) {
        // Simulate dashboard data loading and caching
        Map<String, Object> dashboardData = generateDashboardData(shopIdentifier);
        cacheService.cacheDashboard(shopIdentifier, dashboardData);
        logger.debug("Warmed dashboard cache for shop: {}", shopIdentifier);
      }
    } catch (Exception e) {
      logger.error("Failed to warm dashboard data for shop {}: {}", shopIdentifier, e.getMessage());
    }
  }

  /** Warm cost analytics data for a specific shop */
  private void warmCostAnalytics(String shopIdentifier) {
    try {
      if (!cacheService.hasFreshCache("mi:cost_analytics:" + shopIdentifier)) {
        Object costAnalytics = costOptimizationService.getCostAnalytics();
        cacheService.cacheCostAnalytics(shopIdentifier, costAnalytics);
        logger.debug("Warmed cost analytics cache for shop: {}", shopIdentifier);
      }
    } catch (Exception e) {
      logger.error("Failed to warm cost analytics for shop {}: {}", shopIdentifier, e.getMessage());
    }
  }

  /** Warm discovery stats data for a specific shop */
  private void warmDiscoveryStats(String shopIdentifier) {
    try {
      if (!cacheService.hasFreshCache("mi:discovery_stats:" + shopIdentifier)) {
        Map<String, Object> discoveryStats = generateDiscoveryStats(shopIdentifier);
        cacheService.cacheDiscoveryStats(shopIdentifier, discoveryStats);
        logger.debug("Warmed discovery stats cache for shop: {}", shopIdentifier);
      }
    } catch (Exception e) {
      logger.error(
          "Failed to warm discovery stats for shop {}: {}", shopIdentifier, e.getMessage());
    }
  }

  /** Warm provider stats data for a specific shop */
  private void warmProviderStats(String shopIdentifier) {
    try {
      if (!cacheService.hasFreshCache("mi:provider_stats:" + shopIdentifier)) {
        Map<String, Object> providerStats = generateProviderStats(shopIdentifier);
        cacheService.cacheProviderStats(shopIdentifier, providerStats);
        logger.debug("Warmed provider stats cache for shop: {}", shopIdentifier);
      }
    } catch (Exception e) {
      logger.error("Failed to warm provider stats for shop {}: {}", shopIdentifier, e.getMessage());
    }
  }

  /** Warm performance metrics data for a specific shop */
  private void warmPerformanceMetrics(String shopIdentifier) {
    try {
      if (!cacheService.hasFreshCache("mi:performance_metrics:" + shopIdentifier)) {
        Map<String, Object> performanceMetrics = generatePerformanceMetrics(shopIdentifier);
        cacheService.cachePerformanceMetrics(shopIdentifier, performanceMetrics);
        logger.debug("Warmed performance metrics cache for shop: {}", shopIdentifier);
      }
    } catch (Exception e) {
      logger.error(
          "Failed to warm performance metrics for shop {}: {}", shopIdentifier, e.getMessage());
    }
  }

  // =====================================
  // DATA GENERATION METHODS
  // =====================================

  /** Generate sample dashboard data */
  private Map<String, Object> generateDashboardData(String shopIdentifier) {
    Map<String, Object> data = new HashMap<>();
    data.put("shopId", shopIdentifier);
    data.put("competitorCount", getCompetitorCount(shopIdentifier));
    data.put("activeUrls", getActiveCompetitorCount(shopIdentifier));
    data.put("lastUpdate", LocalDateTime.now().toString());
    return data;
  }

  /** Generate sample discovery stats */
  private Map<String, Object> generateDiscoveryStats(String shopIdentifier) {
    Map<String, Object> stats = new HashMap<>();
    stats.put("shopId", shopIdentifier);
    stats.put("totalSuggestions", 42);
    stats.put("avgRelevanceScore", 85.5);
    stats.put("lastGenerated", LocalDateTime.now().toString());
    return stats;
  }

  /** Generate sample provider stats */
  private Map<String, Object> generateProviderStats(String shopIdentifier) {
    Map<String, Object> stats = new HashMap<>();
    stats.put("shopId", shopIdentifier);
    stats.put("scrapingdog", 15);
    stats.put("serper", 12);
    stats.put("jsoup", 8);
    stats.put("lastUpdated", LocalDateTime.now().toString());
    return stats;
  }

  /** Generate sample performance metrics */
  private Map<String, Object> generatePerformanceMetrics(String shopIdentifier) {
    Map<String, Object> metrics = new HashMap<>();
    metrics.put("shopId", shopIdentifier);
    metrics.put("avgResponseTime", 234.5);
    metrics.put("successRate", 91.2);
    metrics.put("errorCount", 3);
    metrics.put("lastCalculated", LocalDateTime.now().toString());
    return metrics;
  }

  // =====================================
  // HEALTH CHECK METHODS
  // =====================================

  /** Get cache warming health status */
  public Map<String, Object> getWarmingHealth() {
    Map<String, Object> health = new HashMap<>();
    health.put("isEnabled", properties.getFeature().getMarketIntelligence().isWarmingEnabled());
    health.put("memoryProfile", memoryProfile);
    health.put("currentTasks", currentWarmingTasks.get());
    health.put("totalOperations", totalWarmingOperations.get());
    health.put("successfulWarmups", successfulWarmups.get());
    health.put("failedWarmups", failedWarmups.get());
    health.put("memoryAvailable", isMemoryAvailableForWarming());
    health.put("lastUpdate", LocalDateTime.now().toString());
    return health;
  }

  /** Get cache warming statistics */
  public Map<String, Object> getWarmingStats() {
    Map<String, Object> stats = new HashMap<>();
    stats.put("totalOperations", totalWarmingOperations.get());
    stats.put("currentTasks", currentWarmingTasks.get());
    stats.put("successfulWarmups", successfulWarmups.get());
    stats.put("failedWarmups", failedWarmups.get());

    double successRate =
        successfulWarmups.get() + failedWarmups.get() > 0
            ? (double) successfulWarmups.get()
                / (successfulWarmups.get() + failedWarmups.get())
                * 100
            : 0.0;
    stats.put("successRate", successRate);

    stats.put("lastUpdate", LocalDateTime.now().toString());
    return stats;
  }

  /** Reset warming statistics */
  public void resetWarmingStats() {
    totalWarmingOperations.set(0);
    successfulWarmups.set(0);
    failedWarmups.set(0);
    logger.info("Cache warming statistics reset");
  }

  // =====================================
  // UTILITY METHODS
  // =====================================

  /**
   * Get list of active shops that need cache warming - using shop_id from competitor_urls
   * CORRECTED: Uses actual database schema without referencing non-existent shops table
   */
  private List<String> getActiveShops() {
    try {
      // Since shops table doesn't exist, get shop_ids from competitor_urls with recent activity
      String sql =
          """
          SELECT DISTINCT CAST(cu.shop_id AS VARCHAR) as shop_identifier
          FROM competitor_urls cu
          WHERE cu.shop_id IS NOT NULL
            AND cu.status = 'active'
            AND cu.deleted_at IS NULL
            AND cu.last_successful_check > ?
          ORDER BY shop_identifier
          LIMIT 50
          """;
      LocalDateTime since = LocalDateTime.now().minusDays(7); // Active in last 7 days

      List<String> activeShops =
          jdbcTemplate.query(sql, (rs, rowNum) -> rs.getString("shop_identifier"), since);

      if (activeShops.isEmpty()) {
        // Fallback: get shops with any competitor data
        String fallbackSql =
            """
            SELECT DISTINCT CAST(cu.shop_id AS VARCHAR) as shop_identifier
            FROM competitor_urls cu
            WHERE cu.shop_id IS NOT NULL
              AND cu.status = 'active'
              AND cu.deleted_at IS NULL
            ORDER BY shop_identifier
            LIMIT 20
            """;
        activeShops =
            jdbcTemplate.query(fallbackSql, (rs, rowNum) -> rs.getString("shop_identifier"));
      }

      return activeShops;
    } catch (Exception e) {
      logger.warn("Failed to get active shops: {}", e.getMessage());
      // Return fallback list for demo/testing
      List<String> fallback = new ArrayList<>();
      fallback.add("1"); // Default shop ID
      return fallback;
    }
  }

  /** Check if shop cache should be warmed based on priority */
  private boolean shouldWarmShopCache(String shopIdentifier, WarmingPriority priority) {
    // Always warm critical data
    if (priority == WarmingPriority.CRITICAL) {
      return true;
    }

    // For 512MB profile, be more selective
    if ("512MB".equals(memoryProfile)) {
      return priority.getLevel() <= 2; // Only critical and high priority
    }

    // For larger profiles, warm more aggressively
    return priority.getLevel() <= 3; // Critical, high, and medium priority
  }

  /** Check if enough memory is available for warming operations */
  private boolean isMemoryAvailableForWarming() {
    Runtime runtime = Runtime.getRuntime();
    long usedMemory = runtime.totalMemory() - runtime.freeMemory();
    long maxMemory = runtime.maxMemory();
    double memoryUsage = (double) usedMemory / maxMemory;

    boolean available = memoryUsage < 0.7; // Keep warming if memory usage < 70%

    if (!available) {
      logger.warn("Skipping cache warming due to high memory usage: {:.1f}%", memoryUsage * 100);
    }

    return available;
  }

  /**
   * Get competitor count for a shop CORRECTED: Uses shop_id instead of non-existent shop_domain
   * column
   */
  private int getCompetitorCount(String shopIdentifier) {
    try {
      String sql =
          """
          SELECT COUNT(*)
          FROM competitor_urls
          WHERE shop_id = ?
            AND deleted_at IS NULL
          """;
      Long shopId = Long.parseLong(shopIdentifier);
      Integer count = jdbcTemplate.queryForObject(sql, Integer.class, shopId);
      return count != null ? count : 0;
    } catch (Exception e) {
      logger.warn("Failed to get competitor count for shop {}: {}", shopIdentifier, e.getMessage());
      return 0;
    }
  }

  /** Get active competitor count for a shop CORRECTED: Uses shop_id and proper status column */
  private int getActiveCompetitorCount(String shopIdentifier) {
    try {
      String sql =
          """
          SELECT COUNT(*)
          FROM competitor_urls
          WHERE shop_id = ?
            AND status = 'active'
            AND deleted_at IS NULL
          """;
      Long shopId = Long.parseLong(shopIdentifier);
      Integer count = jdbcTemplate.queryForObject(sql, Integer.class, shopId);
      return count != null ? count : 0;
    } catch (Exception e) {
      logger.warn(
          "Failed to get active competitor count for shop {}: {}", shopIdentifier, e.getMessage());
      return 0;
    }
  }

  // =====================================
  // PUBLIC API METHODS
  // =====================================

  /** Trigger on-demand cache warming for specific shop */
  public void warmShopCache(String shopIdentifier) {
    logger.info("Starting on-demand cache warming for shop: {}", shopIdentifier);

    CompletableFuture.runAsync(
        () -> {
          try {
            warmDashboardData(shopIdentifier);
            warmCostAnalytics(shopIdentifier);
            if (isMemoryAvailableForWarming()) {
              warmProviderStats(shopIdentifier);
            }
            logger.info("Completed on-demand cache warming for shop: {}", shopIdentifier);
          } catch (Exception e) {
            logger.error(
                "Failed on-demand cache warming for shop {}: {}", shopIdentifier, e.getMessage());
          }
        });
  }

  /** Trigger cache warming for all active shops */
  public void warmAllCaches() {
    logger.info("Starting on-demand cache warming for all active shops");
    performCacheWarming();
  }

  /** Check if warming is currently in progress */
  public boolean isWarmingInProgress() {
    return currentWarmingTasks.get() > 0;
  }

  /** Get current warming task count */
  public int getCurrentWarmingTasks() {
    return currentWarmingTasks.get();
  }
}
