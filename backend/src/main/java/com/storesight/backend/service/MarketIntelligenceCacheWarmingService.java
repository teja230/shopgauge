package com.storesight.backend.service;

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
 * Market Intelligence Cache Warming Service
 *
 * <p>Implements intelligent cache warming strategies following the optimization guide. Pre-loads
 * critical data into cache to ensure optimal performance for user requests. Optimized for 512MB
 * memory constraints with intelligent scheduling and prioritization.
 *
 * <p>Key Features: - Proactive cache warming for active shops - Memory-aware warming strategies -
 * Priority-based warming (dashboard, cost analytics, discovery stats) - Background processing with
 * non-blocking operations - Performance monitoring and statistics
 */
@Service
public class MarketIntelligenceCacheWarmingService {

  private static final Logger logger =
      LoggerFactory.getLogger(MarketIntelligenceCacheWarmingService.class);

  // Cache warming priorities
  public enum WarmingPriority {
    CRITICAL(1, "Critical data for immediate use"),
    HIGH(2, "Important data accessed frequently"),
    MEDIUM(3, "Moderate priority data"),
    LOW(4, "Nice-to-have cached data");

    private final int level;
    private final String description;

    WarmingPriority(int level, String description) {
      this.level = level;
      this.description = description;
    }

    public int getLevel() {
      return level;
    }

    public String getDescription() {
      return description;
    }
  }

  // Services
  private final MarketIntelligenceCacheService cacheService;
  private final CostOptimizationService costOptimizationService;
  private final JdbcTemplate jdbcTemplate;

  // Statistics tracking
  private final AtomicLong totalWarmingOperations = new AtomicLong(0);
  private final AtomicLong successfulWarmups = new AtomicLong(0);
  private final AtomicLong failedWarmups = new AtomicLong(0);
  private final AtomicLong skippedWarmups = new AtomicLong(0);
  private final AtomicInteger currentWarmingTasks = new AtomicInteger(0);

  // Memory profile configuration
  @Value("${storesight.memory.profile:512MB}")
  private String memoryProfile;

  @Value("${storesight.cache.warming.enabled:true}")
  private boolean cacheWarmingEnabled;

  @Value("${storesight.cache.warming.max.concurrent:3}")
  private int maxConcurrentWarmingTasks;

  public MarketIntelligenceCacheWarmingService(
      MarketIntelligenceCacheService cacheService,
      CostOptimizationService costOptimizationService,
      JdbcTemplate jdbcTemplate) {
    this.cacheService = cacheService;
    this.costOptimizationService = costOptimizationService;
    this.jdbcTemplate = jdbcTemplate;

    logger.info(
        "MarketIntelligenceCacheWarmingService initialized - Memory Profile: {}, Enabled: {}",
        memoryProfile,
        cacheWarmingEnabled);
  }

  // =====================================
  // SCHEDULED CACHE WARMING
  // =====================================

  /**
   * Main cache warming scheduler - runs every 30 minutes 512MB optimized intervals to balance
   * performance and resource usage
   */
  @Scheduled(cron = "0 */30 * * * *") // Every 30 minutes
  public void scheduleWarmingCycle() {
    if (!cacheWarmingEnabled) {
      logger.debug("Cache warming is disabled, skipping warming cycle");
      return;
    }

    if (!isMemoryAvailableForWarming()) {
      logger.warn("Insufficient memory for cache warming - skipping cycle");
      skippedWarmups.incrementAndGet();
      return;
    }

    if (currentWarmingTasks.get() >= maxConcurrentWarmingTasks) {
      logger.warn(
          "Maximum concurrent warming tasks reached ({}), skipping cycle",
          maxConcurrentWarmingTasks);
      skippedWarmups.incrementAndGet();
      return;
    }

    logger.info("Starting cache warming cycle - Memory Profile: {}", memoryProfile);

    CompletableFuture.runAsync(this::executeWarmingCycle)
        .exceptionally(
            throwable -> {
              logger.error("Cache warming cycle failed: {}", throwable.getMessage(), throwable);
              failedWarmups.incrementAndGet();
              return null;
            });
  }

  /** Execute the complete warming cycle with priority-based approach */
  private void executeWarmingCycle() {
    try {
      currentWarmingTasks.incrementAndGet();

      // Get list of active shops that need cache warming
      List<String> activeShops = getActiveShops();

      if (activeShops.isEmpty()) {
        logger.info("No active shops found for cache warming");
        return;
      }

      logger.info("Cache warming for {} active shops", activeShops.size());

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

  /**
   * Warm critical data (Priority 1) - Always executed Dashboard data for shops with recent activity
   */
  private void warmCriticalData(List<String> activeShops) {
    logger.debug("Warming critical data for {} shops", activeShops.size());

    List<CompletableFuture<Void>> futures = new ArrayList<>();

    for (String shopDomain : activeShops) {
      if (shouldWarmShopCache(shopDomain, WarmingPriority.CRITICAL)) {
        CompletableFuture<Void> future =
            CompletableFuture.runAsync(
                () -> {
                  try {
                    warmDashboardData(shopDomain);
                    totalWarmingOperations.incrementAndGet();
                  } catch (Exception e) {
                    logger.warn(
                        "Failed to warm critical data for shop {}: {}", shopDomain, e.getMessage());
                  }
                });
        futures.add(future);
      }
    }

    // Wait for all critical warming to complete
    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    logger.debug("Critical data warming completed");
  }

  /** Warm high priority data (Priority 2) - Cost analytics and discovery stats */
  private void warmHighPriorityData(List<String> activeShops) {
    logger.debug("Warming high priority data for {} shops", activeShops.size());

    List<CompletableFuture<Void>> futures = new ArrayList<>();

    for (String shopDomain : activeShops) {
      if (shouldWarmShopCache(shopDomain, WarmingPriority.HIGH)) {
        CompletableFuture<Void> future =
            CompletableFuture.runAsync(
                () -> {
                  try {
                    warmCostAnalytics(shopDomain);
                    warmDiscoveryStats(shopDomain);
                    totalWarmingOperations.addAndGet(2);
                  } catch (Exception e) {
                    logger.warn(
                        "Failed to warm high priority data for shop {}: {}",
                        shopDomain,
                        e.getMessage());
                  }
                });
        futures.add(future);
      }
    }

    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    logger.debug("High priority data warming completed");
  }

  /**
   * Warm medium priority data (Priority 3) - Provider stats and performance metrics Only for
   * non-512MB profiles to conserve memory
   */
  private void warmMediumPriorityData(List<String> activeShops) {
    logger.debug("Warming medium priority data for {} shops", activeShops.size());

    List<CompletableFuture<Void>> futures = new ArrayList<>();

    for (String shopDomain : activeShops) {
      if (shouldWarmShopCache(shopDomain, WarmingPriority.MEDIUM)) {
        CompletableFuture<Void> future =
            CompletableFuture.runAsync(
                () -> {
                  try {
                    warmProviderStats(shopDomain);
                    warmPerformanceMetrics(shopDomain);
                    totalWarmingOperations.addAndGet(2);
                  } catch (Exception e) {
                    logger.warn(
                        "Failed to warm medium priority data for shop {}: {}",
                        shopDomain,
                        e.getMessage());
                  }
                });
        futures.add(future);
      }
    }

    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    logger.debug("Medium priority data warming completed");
  }

  // =====================================
  // INDIVIDUAL WARMING OPERATIONS
  // =====================================

  /** Warm dashboard data for a specific shop */
  private void warmDashboardData(String shopDomain) {
    try {
      if (!cacheService.hasFreshCache("mi:dashboard:" + shopDomain)) {
        // Simulate dashboard data loading and caching
        Map<String, Object> dashboardData = generateDashboardData(shopDomain);
        cacheService.cacheDashboard(shopDomain, dashboardData);
        logger.debug("Warmed dashboard cache for shop: {}", shopDomain);
      }
    } catch (Exception e) {
      logger.error("Failed to warm dashboard data for shop {}: {}", shopDomain, e.getMessage());
    }
  }

  /** Warm cost analytics data for a specific shop */
  private void warmCostAnalytics(String shopDomain) {
    try {
      if (!cacheService.hasFreshCache("mi:cost_analytics:" + shopDomain)) {
        Object costAnalytics = costOptimizationService.getCostAnalytics();
        cacheService.cacheCostAnalytics(shopDomain, costAnalytics);
        logger.debug("Warmed cost analytics cache for shop: {}", shopDomain);
      }
    } catch (Exception e) {
      logger.error("Failed to warm cost analytics for shop {}: {}", shopDomain, e.getMessage());
    }
  }

  /** Warm discovery stats data for a specific shop */
  private void warmDiscoveryStats(String shopDomain) {
    try {
      if (!cacheService.hasFreshCache("mi:discovery_stats:" + shopDomain)) {
        Map<String, Object> discoveryStats = generateDiscoveryStats(shopDomain);
        cacheService.cacheDiscoveryStats(shopDomain, discoveryStats);
        logger.debug("Warmed discovery stats cache for shop: {}", shopDomain);
      }
    } catch (Exception e) {
      logger.error("Failed to warm discovery stats for shop {}: {}", shopDomain, e.getMessage());
    }
  }

  /** Warm provider stats data for a specific shop */
  private void warmProviderStats(String shopDomain) {
    try {
      if (!cacheService.hasFreshCache("mi:provider_stats:" + shopDomain)) {
        Map<String, Object> providerStats = generateProviderStats(shopDomain);
        cacheService.cacheProviderStats(shopDomain, providerStats);
        logger.debug("Warmed provider stats cache for shop: {}", shopDomain);
      }
    } catch (Exception e) {
      logger.error("Failed to warm provider stats for shop {}: {}", shopDomain, e.getMessage());
    }
  }

  /** Warm performance metrics data for a specific shop */
  private void warmPerformanceMetrics(String shopDomain) {
    try {
      if (!cacheService.hasFreshCache("mi:performance:" + shopDomain)) {
        Map<String, Object> performanceMetrics = generatePerformanceMetrics(shopDomain);
        cacheService.cachePerformanceMetrics(shopDomain, performanceMetrics);
        logger.debug("Warmed performance metrics cache for shop: {}", shopDomain);
      }
    } catch (Exception e) {
      logger.error(
          "Failed to warm performance metrics for shop {}: {}", shopDomain, e.getMessage());
    }
  }

  // =====================================
  // DATA GENERATION METHODS (Placeholders)
  // =====================================

  /** Generate dashboard data for cache warming In production, this would call actual services */
  private Map<String, Object> generateDashboardData(String shopDomain) {
    Map<String, Object> dashboardData = new HashMap<>();
    dashboardData.put("shop", shopDomain);
    dashboardData.put("cached", true);
    dashboardData.put("warmedAt", LocalDateTime.now().toString());
    dashboardData.put("systemStatus", "operational");
    return dashboardData;
  }

  /** Generate discovery stats for cache warming */
  private Map<String, Object> generateDiscoveryStats(String shopDomain) {
    Map<String, Object> stats = new HashMap<>();
    stats.put("shop", shopDomain);
    stats.put("totalCompetitors", getCompetitorCount(shopDomain));
    stats.put("activeCompetitors", getActiveCompetitorCount(shopDomain));
    stats.put("warmedAt", LocalDateTime.now().toString());
    return stats;
  }

  /** Generate provider stats for cache warming */
  private Map<String, Object> generateProviderStats(String shopDomain) {
    Map<String, Object> stats = new HashMap<>();
    stats.put("shop", shopDomain);
    stats.put("jsoupSuccess", 85.5);
    stats.put("scrapingdogSuccess", 92.3);
    stats.put("serperSuccess", 89.1);
    stats.put("warmedAt", LocalDateTime.now().toString());
    return stats;
  }

  /** Generate performance metrics for cache warming */
  private Map<String, Object> generatePerformanceMetrics(String shopDomain) {
    Map<String, Object> metrics = new HashMap<>();
    metrics.put("shop", shopDomain);
    metrics.put("avgResponseTime", 450);
    metrics.put("successRate", 91.2);
    metrics.put("warmedAt", LocalDateTime.now().toString());
    return metrics;
  }

  // =====================================
  // UTILITY METHODS
  // =====================================

  /** Get list of active shops that need cache warming */
  private List<String> getActiveShops() {
    try {
      String sql =
          "SELECT DISTINCT shop_domain FROM shops WHERE is_active = true AND last_activity > ?";
      LocalDateTime since = LocalDateTime.now().minusDays(7); // Active in last 7 days

      return jdbcTemplate.query(sql, (rs, rowNum) -> rs.getString("shop_domain"), since);
    } catch (Exception e) {
      logger.warn("Failed to get active shops: {}", e.getMessage());
      // Return fallback list for demo/testing
      List<String> fallback = new ArrayList<>();
      fallback.add("admin");
      return fallback;
    }
  }

  /** Check if shop cache should be warmed based on priority */
  private boolean shouldWarmShopCache(String shopDomain, WarmingPriority priority) {
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

  /** Check if memory is available for cache warming operations */
  private boolean isMemoryAvailableForWarming() {
    Runtime runtime = Runtime.getRuntime();
    long usedMemory = runtime.totalMemory() - runtime.freeMemory();
    long maxMemory = runtime.maxMemory();
    double memoryUsagePercent = (double) usedMemory / maxMemory * 100;

    // Conservative thresholds based on memory profile
    double threshold =
        switch (memoryProfile) {
          case "512MB" -> 70.0; // Very conservative for 512MB
          case "1GB" -> 75.0; // Moderate for 1GB
          case "2GB" -> 80.0; // More aggressive for 2GB+
          default -> 75.0; // Default
        };

    boolean available = memoryUsagePercent < threshold;

    if (!available) {
      logger.debug(
          "Memory usage too high for warming: {:.2f}% (threshold: {:.2f}%)",
          memoryUsagePercent, threshold);
    }

    return available;
  }

  /** Get competitor count for a shop */
  private int getCompetitorCount(String shopDomain) {
    try {
      String sql =
          "SELECT COUNT(*) FROM competitor_urls WHERE shop_domain = ? AND deleted_at IS NULL";
      Integer count = jdbcTemplate.queryForObject(sql, Integer.class, shopDomain);
      return count != null ? count : 0;
    } catch (Exception e) {
      logger.warn("Failed to get competitor count for shop {}: {}", shopDomain, e.getMessage());
      return 0;
    }
  }

  /** Get active competitor count for a shop */
  private int getActiveCompetitorCount(String shopDomain) {
    try {
      String sql =
          "SELECT COUNT(*) FROM competitor_urls WHERE shop_domain = ? AND is_active = true AND deleted_at IS NULL";
      Integer count = jdbcTemplate.queryForObject(sql, Integer.class, shopDomain);
      return count != null ? count : 0;
    } catch (Exception e) {
      logger.warn(
          "Failed to get active competitor count for shop {}: {}", shopDomain, e.getMessage());
      return 0;
    }
  }

  // =====================================
  // PUBLIC API METHODS
  // =====================================

  /** Manually trigger cache warming for a specific shop */
  public CompletableFuture<Void> warmShopCache(String shopDomain, WarmingPriority priority) {
    return CompletableFuture.runAsync(
        () -> {
          try {
            logger.info(
                "Manual cache warming triggered for shop: {} with priority: {}",
                shopDomain,
                priority);

            switch (priority) {
              case CRITICAL:
                warmDashboardData(shopDomain);
                break;
              case HIGH:
                warmCostAnalytics(shopDomain);
                warmDiscoveryStats(shopDomain);
                break;
              case MEDIUM:
                warmProviderStats(shopDomain);
                warmPerformanceMetrics(shopDomain);
                break;
              case LOW:
                // Additional warming strategies for low priority
                break;
            }

            totalWarmingOperations.incrementAndGet();
            successfulWarmups.incrementAndGet();

          } catch (Exception e) {
            failedWarmups.incrementAndGet();
            logger.error(
                "Failed to warm cache for shop {} with priority {}: {}",
                shopDomain,
                priority,
                e.getMessage(),
                e);
            throw new RuntimeException("Cache warming failed", e);
          }
        });
  }

  /** Get cache warming statistics */
  public Map<String, Object> getWarmingStatistics() {
    Map<String, Object> stats = new HashMap<>();

    stats.put("memoryProfile", memoryProfile);
    stats.put("cacheWarmingEnabled", cacheWarmingEnabled);
    stats.put("maxConcurrentTasks", maxConcurrentWarmingTasks);
    stats.put("currentWarmingTasks", currentWarmingTasks.get());

    stats.put("totalWarmingOperations", totalWarmingOperations.get());
    stats.put("successfulWarmups", successfulWarmups.get());
    stats.put("failedWarmups", failedWarmups.get());
    stats.put("skippedWarmups", skippedWarmups.get());

    // Calculate success rate
    long total = successfulWarmups.get() + failedWarmups.get();
    double successRate = total > 0 ? (double) successfulWarmups.get() / total * 100 : 100.0;
    stats.put("successRate", String.format("%.2f%%", successRate));

    stats.put("memoryAvailable", isMemoryAvailableForWarming());
    stats.put("lastWarmingCycle", LocalDateTime.now().toString());

    return stats;
  }

  /** Reset warming statistics */
  public void resetWarmingStatistics() {
    totalWarmingOperations.set(0);
    successfulWarmups.set(0);
    failedWarmups.set(0);
    skippedWarmups.set(0);
    logger.info("Cache warming statistics reset");
  }

  /** Check if cache warming is healthy */
  public boolean isCacheWarmingHealthy() {
    if (!cacheWarmingEnabled) {
      return true; // Disabled is considered healthy
    }

    long total = successfulWarmups.get() + failedWarmups.get();
    if (total == 0) {
      return true; // No operations yet, consider healthy
    }

    double successRate = (double) successfulWarmups.get() / total * 100;
    boolean successRateHealthy = successRate >= 90; // 90% success rate threshold

    boolean memoryHealthy = isMemoryAvailableForWarming();
    boolean concurrencyHealthy = currentWarmingTasks.get() <= maxConcurrentWarmingTasks;

    return successRateHealthy && memoryHealthy && concurrencyHealthy;
  }
}
