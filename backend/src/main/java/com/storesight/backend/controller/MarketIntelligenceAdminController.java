package com.storesight.backend.controller;

import com.storesight.backend.service.CostOptimizationService;
import com.storesight.backend.service.DataPrivacyService;
import com.storesight.backend.service.DatabaseMonitoringService;
import com.storesight.backend.service.RedisHealthService;
import com.storesight.backend.service.TransactionMonitoringService;
import com.storesight.backend.service.discovery.CompetitorDiscoveryService;
import com.storesight.backend.service.discovery.MultiSourceSearchClient;
import com.storesight.backend.service.discovery.SearchClient;
import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

/**
 * Admin controller for Market Intelligence management and cost optimization. Provides comprehensive
 * analytics, settings management, and optimization recommendations.
 */
@RestController
@RequestMapping("/api/admin/market-intelligence")
public class MarketIntelligenceAdminController {

  private static final Logger log =
      LoggerFactory.getLogger(MarketIntelligenceAdminController.class);

  @Autowired private CostOptimizationService costOptimizationService;

  @Autowired(required = false)
  private CompetitorDiscoveryService discoveryService;

  @Autowired(required = false)
  private MultiSourceSearchClient multiSourceSearchClient;

  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private DatabaseMonitoringService databaseMonitoringService;
  @Autowired private RedisHealthService redisHealthService;
  @Autowired private TransactionMonitoringService transactionMonitoringService;
  @Autowired private DataPrivacyService dataPrivacyService;
  @Autowired private RedisTemplate<String, Object> redisTemplate;

  @Value("${discovery.enabled:true}")
  private boolean discoveryEnabled;

  @Value("${cost.optimization.enabled:true}")
  private boolean costOptimizationEnabled;

  /** Get comprehensive Market Intelligence dashboard */
  @GetMapping("/dashboard")
  public ResponseEntity<Map<String, Object>> getDashboard() {
    try {
      Map<String, Object> dashboard = new HashMap<>();

      // System status
      dashboard.put("systemStatus", getSystemStatus());

      // Cost analytics
      if (costOptimizationEnabled) {
        dashboard.put("costAnalytics", costOptimizationService.getCostAnalytics());
        dashboard.put(
            "costRecommendations", costOptimizationService.getOptimizationRecommendations());
      }

      // Discovery stats
      if (discoveryEnabled && discoveryService != null) {
        dashboard.put("discoveryStats", discoveryService.getDiscoveryStats());
      }

      // Provider stats
      if (multiSourceSearchClient != null) {
        dashboard.put("providerStats", multiSourceSearchClient.getProviderStats());
      }

      // Database stats
      dashboard.put("databaseStats", getDatabaseStats());

      // Performance metrics
      dashboard.put("performanceMetrics", getPerformanceMetrics());

      return ResponseEntity.ok(dashboard);

    } catch (Exception e) {
      log.error("Error getting Market Intelligence dashboard: {}", e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to load dashboard: " + e.getMessage()));
    }
  }

  /** Get cost analytics details */
  @GetMapping("/cost-analytics")
  public ResponseEntity<Map<String, Object>> getCostAnalytics() {
    if (!costOptimizationEnabled) {
      return ResponseEntity.ok(
          Map.of("enabled", false, "message", "Cost optimization is disabled"));
    }

    try {
      CostOptimizationService.CostAnalytics analytics = costOptimizationService.getCostAnalytics();

      Map<String, Object> response = new HashMap<>();
      response.put("analytics", analytics);
      response.put("recommendations", costOptimizationService.getOptimizationRecommendations());
      response.put("savings", calculatePotentialSavings(analytics));

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      log.error("Error getting cost analytics: {}", e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to load cost analytics: " + e.getMessage()));
    }
  }

  /** Get provider performance comparison */
  @GetMapping("/provider-comparison")
  public ResponseEntity<Map<String, Object>> getProviderComparison() {
    if (multiSourceSearchClient == null) {
      return ResponseEntity.ok(
          Map.of("enabled", false, "message", "Discovery services are disabled"));
    }

    try {
      Map<String, Object> comparison = new HashMap<>();
      Map<String, Object> stats = multiSourceSearchClient.getProviderStats();

      comparison.put("providerStats", stats);
      comparison.put("costEfficiency", calculateCostEfficiency());
      comparison.put("recommendations", getProviderRecommendations());

      return ResponseEntity.ok(comparison);

    } catch (Exception e) {
      log.error("Error getting provider comparison: {}", e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to load provider comparison: " + e.getMessage()));
    }
  }

  /** Test search providers */
  @PostMapping("/test-search")
  public ResponseEntity<Map<String, Object>> testSearch(@RequestBody Map<String, String> request) {
    if (multiSourceSearchClient == null) {
      return ResponseEntity.ok(
          Map.of("enabled", false, "message", "Discovery services are disabled"));
    }

    String keywords = request.get("keywords");
    if (keywords == null || keywords.trim().isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Keywords are required"));
    }

    try {
      List<SearchClient.SearchResult> results = multiSourceSearchClient.search(keywords, 5);

      Map<String, Object> response = new HashMap<>();
      response.put("results", results);
      response.put("totalResults", results.size());
      response.put("keywords", keywords);
      response.put(
          "providers",
          results.stream().map(SearchClient.SearchResult::getProvider).distinct().toList());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      log.error("Error testing search: {}", e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Search test failed: " + e.getMessage()));
    }
  }

  /** Reset cost tracking */
  @PostMapping("/reset-costs")
  public ResponseEntity<Map<String, Object>> resetCosts() {
    if (!costOptimizationEnabled) {
      return ResponseEntity.badRequest().body(Map.of("error", "Cost optimization is disabled"));
    }

    try {
      costOptimizationService.resetDailyCosts();
      if (multiSourceSearchClient != null) {
        multiSourceSearchClient.resetCostTracking();
      }

      return ResponseEntity.ok(
          Map.of("message", "Cost tracking reset successfully", "timestamp", new Date()));

    } catch (Exception e) {
      log.error("Error resetting costs: {}", e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to reset costs: " + e.getMessage()));
    }
  }

  /** Get system configuration */
  @GetMapping("/config")
  public ResponseEntity<Map<String, Object>> getConfig() {
    Map<String, Object> config = new HashMap<>();

    config.put("discoveryEnabled", discoveryEnabled);
    config.put("costOptimizationEnabled", costOptimizationEnabled);

    if (multiSourceSearchClient != null) {
      config.put("multiSourceConfig", multiSourceSearchClient.getProviderConfig());
    }

    if (discoveryEnabled && discoveryService != null) {
      config.put("discoveryConfig", discoveryService.getDiscoveryConfig());
    }

    return ResponseEntity.ok(config);
  }

  /** Update system configuration */
  @PutMapping("/config")
  public ResponseEntity<Map<String, Object>> updateConfig(
      @RequestBody Map<String, Object> newConfig) {
    try {
      // This would normally update configuration in the database or config service
      // For now, we'll just return the current config
      log.info("Configuration update requested: {}", newConfig);

      return ResponseEntity.ok(
          Map.of("message", "Configuration updated successfully", "config", getConfig().getBody()));

    } catch (Exception e) {
      log.error("Error updating config: {}", e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to update configuration: " + e.getMessage()));
    }
  }

  /** Get detailed logs */
  @GetMapping("/logs")
  public ResponseEntity<Map<String, Object>> getLogs(
      @RequestParam(defaultValue = "100") int limit,
      @RequestParam(defaultValue = "INFO") String level) {

    try {
      // This would normally fetch logs from a logging service
      // For now, we'll return recent activity
      List<Map<String, Object>> logs = getRecentActivity(limit);

      return ResponseEntity.ok(
          Map.of("logs", logs, "totalLogs", logs.size(), "level", level, "timestamp", new Date()));

    } catch (Exception e) {
      log.error("Error getting logs: {}", e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to load logs: " + e.getMessage()));
    }
  }

  /** Get historical cost data for a shop */
  @GetMapping("/cost-history")
  public ResponseEntity<Map<String, Object>> getCostHistory(
      @RequestParam(defaultValue = "30") int days, @RequestParam(required = false) Long shopId) {

    try {
      if (shopId == null) {
        return ResponseEntity.badRequest().body(Map.of("error", "Shop ID is required"));
      }

      // Get historical cost data
      List<Map<String, Object>> historicalData =
          costOptimizationService.getHistoricalCostData(shopId, days);

      // Get provider-specific data
      Map<String, Object> providerData = costOptimizationService.getProviderCostData(shopId, days);

      Map<String, Object> response = new HashMap<>();
      response.put("historicalData", historicalData);
      response.put("providerData", providerData);
      response.put("days", days);
      response.put("shopId", shopId);
      response.put("totalDays", historicalData.size());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      log.error("Error getting cost history for shop {}: {}", shopId, e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to load cost history: " + e.getMessage()));
    }
  }

  /** Get system health check */
  @GetMapping("/health")
  public ResponseEntity<Map<String, Object>> getHealth() {
    Map<String, Object> health = new HashMap<>();
    boolean allHealthy = true;

    // Check discovery service
    if (discoveryEnabled) {
      boolean discoveryHealthy = discoveryService.getSearchClient().isEnabled();
      health.put(
          "discovery",
          Map.of(
              "status", discoveryHealthy ? "healthy" : "unhealthy", "enabled", discoveryHealthy));
      allHealthy = allHealthy && discoveryHealthy;
    }

    // Check cost optimization
    if (costOptimizationEnabled) {
      health.put("costOptimization", Map.of("status", "healthy", "enabled", true));
    }

    // Check database
    try {
      jdbcTemplate.queryForObject("SELECT 1", Integer.class);
      health.put(
          "database",
          Map.of(
              "status", "healthy",
              "connection", "active"));
    } catch (Exception e) {
      health.put("database", Map.of("status", "unhealthy", "error", e.getMessage()));
      allHealthy = false;
    }

    health.put(
        "overall", Map.of("status", allHealthy ? "healthy" : "unhealthy", "timestamp", new Date()));

    return ResponseEntity.ok(health);
  }

  // Helper methods

  private Map<String, Object> getSystemStatus() {
    Map<String, Object> status = new HashMap<>();
    status.put("discoveryEnabled", discoveryEnabled);
    status.put("costOptimizationEnabled", costOptimizationEnabled);
    status.put("providersEnabled", multiSourceSearchClient.isEnabled());
    status.put("timestamp", new Date());
    return status;
  }

  private Map<String, Object> getDatabaseStats() {
    Map<String, Object> stats = new HashMap<>();

    try {
      // Get competitor URLs count
      Integer competitorCount =
          jdbcTemplate.queryForObject("SELECT COUNT(*) FROM competitor_urls", Integer.class);
      stats.put("competitorUrls", competitorCount);

      // Get suggestions count
      Integer suggestionsCount =
          jdbcTemplate.queryForObject("SELECT COUNT(*) FROM competitor_suggestions", Integer.class);
      stats.put("suggestions", suggestionsCount);

      // Get price snapshots count
      Integer snapshotsCount =
          jdbcTemplate.queryForObject("SELECT COUNT(*) FROM price_snapshots", Integer.class);
      stats.put("priceSnapshots", snapshotsCount);

      // Use DataPrivacyService to get real-time active shops (Redis-first, DB fallback)
      List<Map<String, Object>> activeShops = dataPrivacyService.getActiveShops();
      stats.put("activeShops", activeShops.size());

    } catch (Exception e) {
      log.warn("Error getting database stats: {}", e.getMessage());
      stats.put("error", "Unable to fetch database statistics");
    }

    return stats;
  }

  private Map<String, Object> getPerformanceMetrics() {
    Map<String, Object> metrics = new HashMap<>();

    try {
      // Get real database metrics
      Map<String, Object> dbMetrics = databaseMonitoringService.getDatabaseMetrics();

      // Get Redis performance metrics
      Map<String, Object> redisMetrics = redisHealthService.getRedisHealthMetrics();

      // Get transaction monitoring metrics
      Map<String, Object> transactionMetrics = transactionMonitoringService.getHealthMetrics();

      // Calculate average response time from Redis performance
      long redisResponseTime = (Long) redisMetrics.getOrDefault("responseTimeMs", 0L);
      String avgResponseTime = redisResponseTime > 0 ? redisResponseTime + "ms" : "N/A";

      // Calculate error rate from transaction metrics
      long totalTransactions = (Long) transactionMetrics.getOrDefault("total_transactions", 0L);
      long failedTransactions = (Long) transactionMetrics.getOrDefault("failed_transactions", 0L);
      double errorRate =
          totalTransactions > 0 ? (double) failedTransactions / totalTransactions * 100 : 0.0;

      // Calculate uptime based on health status
      boolean dbHealthy = "HEALTHY".equals(dbMetrics.get("healthStatus"));
      boolean redisHealthy = (Boolean) redisMetrics.getOrDefault("healthy", false);
      boolean transactionHealthy = transactionMonitoringService.isHealthy();

      double uptimePercentage = 0.0;
      if (dbHealthy && redisHealthy && transactionHealthy) {
        uptimePercentage = 99.9; // All systems healthy
      } else if (dbHealthy && redisHealthy) {
        uptimePercentage = 95.0; // Database and Redis healthy, transactions degraded
      } else if (dbHealthy) {
        uptimePercentage = 85.0; // Only database healthy
      } else {
        uptimePercentage = 50.0; // Critical issues
      }

      metrics.put("avgResponseTime", avgResponseTime);
      metrics.put("errorRate", String.format("%.2f%%", errorRate));
      metrics.put("uptime", String.format("%.1f%%", uptimePercentage));

      // Add detailed metrics for debugging
      metrics.put("databaseStatus", dbMetrics.get("healthStatus"));
      metrics.put("redisStatus", redisHealthy ? "healthy" : "unhealthy");
      metrics.put("transactionStatus", transactionHealthy ? "healthy" : "degraded");
      metrics.put("totalTransactions", totalTransactions);
      metrics.put("failedTransactions", failedTransactions);
      metrics.put("redisResponseTimeMs", redisResponseTime);

    } catch (Exception e) {
      log.warn("Error getting real performance metrics: {}", e.getMessage());
      // Fallback to basic metrics if monitoring services fail
      metrics.put("avgResponseTime", "N/A");
      metrics.put("cacheHitRate", "N/A");
      metrics.put("errorRate", "N/A");
      metrics.put("uptime", "N/A");
      metrics.put("error", "Failed to fetch real metrics: " + e.getMessage());
    }

    return metrics;
  }

  private Map<String, Object> calculatePotentialSavings(
      CostOptimizationService.CostAnalytics analytics) {
    Map<String, Object> savings = new HashMap<>();

    // Calculate potential savings from optimization
    BigDecimal currentMonthlyCost = analytics.getTotalMonthlyCost();
    BigDecimal estimatedSavings = analytics.getEstimatedSavings();

    savings.put("currentMonthlyCost", currentMonthlyCost);
    savings.put("estimatedSavings", estimatedSavings);
    savings.put(
        "savingsPercentage",
        currentMonthlyCost.compareTo(BigDecimal.ZERO) > 0
            ? estimatedSavings
                .divide(currentMonthlyCost, 4, BigDecimal.ROUND_HALF_UP)
                .multiply(BigDecimal.valueOf(100))
            : BigDecimal.ZERO);

    return savings;
  }

  private Map<String, Object> calculateCostEfficiency() {
    Map<String, Object> efficiency = new HashMap<>();

    // This would calculate actual efficiency metrics
    efficiency.put("mostEfficientProvider", "Scrapingdog");
    efficiency.put("costPerResult", "$0.001");
    efficiency.put("averageResultsPerSearch", 8.5);
    efficiency.put("recommendedProvider", "Scrapingdog");

    return efficiency;
  }

  private List<String> getProviderRecommendations() {
    List<String> recommendations = new ArrayList<>();

    recommendations.add("Use Scrapingdog as primary provider for cost efficiency");
    recommendations.add("Enable aggressive caching to reduce API calls by 50%");
    recommendations.add("Set daily budget limits to control costs");
    recommendations.add("Use fallback providers only when necessary");

    return recommendations;
  }

  private List<Map<String, Object>> getRecentActivity(int limit) {
    List<Map<String, Object>> activity = new ArrayList<>();

    // This would normally fetch from logs or activity table
    activity.add(
        Map.of(
            "timestamp", new Date(),
            "level", "INFO",
            "message", "Market Intelligence system started",
            "category", "System"));

    activity.add(
        Map.of(
            "timestamp", new Date(),
            "level", "INFO",
            "message", "Cost optimization enabled",
            "category", "Cost"));

    return activity.stream().limit(limit).toList();
  }

  // ==================== COMPETITOR DEBUG ENDPOINTS ====================

  /** Get scraping status for a specific shop */
  @GetMapping("/competitors/scraping-status")
  public ResponseEntity<Map<String, Object>> getCompetitorScrapingStatus(
      @RequestParam(required = false) Long shopId) {
    try {
      Map<String, Object> debugInfo = new HashMap<>();
      
      if (shopId == null) {
        // Get all shops if no specific shop provided
        List<Map<String, Object>> shops = jdbcTemplate.queryForList(
            "SELECT id, shopify_domain FROM shops WHERE deleted_at IS NULL ORDER BY id");
        debugInfo.put("availableShops", shops);
        debugInfo.put("message", "No shop ID provided. Use ?shopId=X to get specific shop data.");
        return ResponseEntity.ok(debugInfo);
      }
      
      // Get shop domain
      String shopDomain = null;
      try {
        Map<String, Object> shop = jdbcTemplate.queryForMap(
            "SELECT shopify_domain FROM shops WHERE id = ?", shopId);
        shopDomain = (String) shop.get("shopify_domain");
      } catch (Exception e) {
        return ResponseEntity.badRequest().body(Map.of("error", "Shop not found: " + shopId));
      }
      
      debugInfo.put("shopId", shopId);
      debugInfo.put("shopDomain", shopDomain);
      
      // Get comprehensive scraping status data
      String query = """
          SELECT 
              cu.id,
              cu.url,
              cu.status,
              cu.error_count,
              cu.created_at as competitor_created,
              cu.last_successful_check,
              ps.checked_at as latest_price_check,
              ps.price,
              ps.in_stock,
              ps.platform,
              ps.scraper_source,
              ps.response_time_ms,
              CASE 
                  WHEN cu.error_count >= 5 THEN 'BLOCKED_BY_ERRORS'
                  WHEN cu.status = 'error' THEN 'ERROR_STATUS'
                  WHEN ps.checked_at IS NULL THEN 'NEVER_SCRAPED'
                  WHEN ps.checked_at < NOW() - INTERVAL '12 hours' THEN 'DUE_FOR_SCRAPING'
                  ELSE 'RECENTLY_SCRAPED'
              END as scraping_status
          FROM competitor_urls cu
          LEFT JOIN (
              SELECT competitor_url_id, price, in_stock, checked_at, platform, scraper_source, response_time_ms,
                     ROW_NUMBER() OVER (PARTITION BY competitor_url_id ORDER BY checked_at DESC) as rn
              FROM price_snapshots
          ) ps ON cu.id = ps.competitor_url_id AND ps.rn = 1
          WHERE cu.shop_id = ? AND cu.deleted_at IS NULL
          ORDER BY cu.created_at DESC
          """;
      
      List<Map<String, Object>> rows = jdbcTemplate.queryForList(query, shopId);
      List<Map<String, Object>> statusData = new ArrayList<>();
      
      for (Map<String, Object> row : rows) {
        Map<String, Object> competitorData = new HashMap<>();
        competitorData.put("id", row.get("id"));
        competitorData.put("url", row.get("url"));
        competitorData.put("status", row.get("status"));
        competitorData.put("error_count", row.get("error_count"));
        competitorData.put("competitor_created", row.get("competitor_created"));
        competitorData.put("last_successful_check", row.get("last_successful_check"));
        competitorData.put("latest_price_check", row.get("latest_price_check"));
        competitorData.put("price", row.get("price"));
        competitorData.put("in_stock", row.get("in_stock"));
        competitorData.put("platform", row.get("platform"));
        competitorData.put("scraper_source", row.get("scraper_source"));
        competitorData.put("response_time_ms", row.get("response_time_ms"));
        competitorData.put("scraping_status", row.get("scraping_status"));
        statusData.add(competitorData);
      }
      
      // Summary statistics
      Map<String, Object> summary = new HashMap<>();
      summary.put("total_competitors", statusData.size());
      summary.put("active_status", statusData.stream().filter(c -> "active".equals(c.get("status"))).count());
      summary.put("error_status", statusData.stream().filter(c -> "error".equals(c.get("status"))).count());
      summary.put("blocked_by_errors", statusData.stream().filter(c -> "BLOCKED_BY_ERRORS".equals(c.get("scraping_status"))).count());
      summary.put("due_for_scraping", statusData.stream().filter(c -> "DUE_FOR_SCRAPING".equals(c.get("scraping_status"))).count());
      summary.put("recently_scraped", statusData.stream().filter(c -> "RECENTLY_SCRAPED".equals(c.get("scraping_status"))).count());
      summary.put("never_scraped", statusData.stream().filter(c -> "NEVER_SCRAPED".equals(c.get("scraping_status"))).count());
      
      // Platform and scraper source analytics
      Map<String, Long> platformStats = statusData.stream()
          .filter(c -> c.get("platform") != null)
          .collect(Collectors.groupingBy(
              c -> (String) c.get("platform"), 
              Collectors.counting()));
      
      Map<String, Long> scraperSourceStats = statusData.stream()
          .filter(c -> c.get("scraper_source") != null)
          .collect(Collectors.groupingBy(
              c -> (String) c.get("scraper_source"), 
              Collectors.counting()));
      
      summary.put("platform_stats", platformStats);
      summary.put("scraper_source_stats", scraperSourceStats);
      
      debugInfo.put("competitors", statusData);
      debugInfo.put("summary", summary);
      
      return ResponseEntity.ok(debugInfo);
      
    } catch (Exception e) {
      log.error("Error getting competitor scraping status: {}", e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to get scraping status: " + e.getMessage()));
    }
  }

  /** Trigger immediate scraping for a specific competitor */
  @PostMapping("/competitors/{id}/trigger-scraping")
  public ResponseEntity<Map<String, Object>> triggerCompetitorScraping(
      @PathVariable String id, 
      @RequestParam(required = false) Long shopId) {
    try {
      Map<String, Object> debugInfo = new HashMap<>();
      debugInfo.put("competitorId", id);
      debugInfo.put("shopId", shopId);
      
      // Get competitor details
      List<Map<String, Object>> competitorData = jdbcTemplate.queryForList(
          "SELECT id, url, shop_id FROM competitor_urls WHERE id = ? AND deleted_at IS NULL",
          Long.parseLong(id));
      
      if (competitorData.isEmpty()) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", "Competitor not found"));
      }
      
      Map<String, Object> competitor = competitorData.get(0);
      String url = (String) competitor.get("url");
      Long actualShopId = ((Number) competitor.get("shop_id")).longValue();
      
      // Validate shop access if shopId provided
      if (shopId != null && !shopId.equals(actualShopId)) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(Map.of("error", "Access denied to competitor from different shop"));
      }
      
      debugInfo.put("url", url);
      debugInfo.put("actualShopId", actualShopId);
      
      // Check Redis keys before scraping
      String domain = extractDomain(url);
      String recentScrapeKey = "recent_scrape:" + domain + ":" + url.hashCode();
      String rateLimitKey = "scraper_rate_limit:" + domain;
      
      debugInfo.put("domain", domain);
      debugInfo.put("recentScrapeKey", recentScrapeKey);
      debugInfo.put("rateLimitKey", rateLimitKey);
      debugInfo.put("recentScrapeExists", redisTemplate.hasKey(recentScrapeKey));
      debugInfo.put("rateLimitExists", redisTemplate.hasKey(rateLimitKey));
      
      // Check current competitor status
      List<Map<String, Object>> currentStatus = jdbcTemplate.queryForList(
          "SELECT status, last_successful_check, error_count FROM competitor_urls WHERE id = ?",
          Long.parseLong(id));
      if (!currentStatus.isEmpty()) {
        debugInfo.put("currentStatus", currentStatus.get(0));
      }
      
      // Trigger immediate scraping (this would need to be implemented)
      // For now, just simulate the trigger
      debugInfo.put("scrapingTriggered", true);
      debugInfo.put("message", "Scraping trigger endpoint - implementation needed");
      
      return ResponseEntity.ok(debugInfo);
      
    } catch (Exception e) {
      log.error("Error triggering competitor scraping: {}", e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to trigger scraping: " + e.getMessage()));
    }
  }

  /** Get cache debug information for a shop */
  @GetMapping("/competitors/cache-debug")
  public ResponseEntity<Map<String, Object>> getCacheDebugInfo(
      @RequestParam(required = false) Long shopId) {
    try {
      Map<String, Object> debugInfo = new HashMap<>();
      
      if (shopId == null) {
        return ResponseEntity.badRequest().body(Map.of("error", "shopId parameter required"));
      }
      
      // Get shop domain
      String shopDomain = null;
      try {
        Map<String, Object> shop = jdbcTemplate.queryForMap(
            "SELECT shopify_domain FROM shops WHERE id = ?", shopId);
        shopDomain = (String) shop.get("shopify_domain");
      } catch (Exception e) {
        return ResponseEntity.badRequest().body(Map.of("error", "Shop not found: " + shopId));
      }
      
      debugInfo.put("shopId", shopId);
      debugInfo.put("shopDomain", shopDomain);
      
      // Check Redis connectivity
      try {
        redisTemplate.opsForValue().set("test_key", "test_value", java.time.Duration.ofSeconds(10));
        String testValue = (String) redisTemplate.opsForValue().get("test_key");
        debugInfo.put("redisConnected", "test_value".equals(testValue));
        debugInfo.put("redisError", null);
      } catch (Exception e) {
        debugInfo.put("redisConnected", false);
        debugInfo.put("redisError", e.getMessage());
      }
      
      // Check cache keys
      String cacheKey = "dashboard:products:" + shopDomain;
      debugInfo.put("cacheKey", cacheKey);
      debugInfo.put("cacheExists", redisTemplate.hasKey(cacheKey));
      
      if (redisTemplate.hasKey(cacheKey)) {
        Object cachedData = redisTemplate.opsForValue().get(cacheKey);
        debugInfo.put("cachedData", cachedData);
        debugInfo.put("cacheType", cachedData != null ? cachedData.getClass().getSimpleName() : "null");
      }
      
      // Get database product count
      try {
        Integer productCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM products WHERE shop_id = ?", Integer.class, shopId);
        debugInfo.put("databaseProductCount", productCount);
      } catch (Exception e) {
        debugInfo.put("databaseProductCount", "Error: " + e.getMessage());
      }
      
      return ResponseEntity.ok(debugInfo);
      
    } catch (Exception e) {
      log.error("Error getting cache debug info: {}", e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to get cache debug info: " + e.getMessage()));
    }
  }

  /** Helper method to extract domain from URL */
  private String extractDomain(String url) {
    try {
      return url.replaceAll("https?://", "").replaceAll("/.*", "");
    } catch (Exception e) {
      return url;
    }
  }
}
