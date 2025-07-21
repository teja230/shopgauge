package com.storesight.backend.service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.LongAdder;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Performance metrics tracking service for Market Intelligence production monitoring.
 *
 * <p>Tracks: - API endpoint response times and error rates - Discovery and scraping operation
 * throughput - Cache performance and optimization metrics - Database query performance - External
 * API provider performance
 */
@Service
public class PerformanceMetricsService {

  private static final Logger logger = LoggerFactory.getLogger(PerformanceMetricsService.class);

  @Autowired private JdbcTemplate jdbcTemplate;

  @Autowired private DatabaseMonitoringService databaseMonitoringService;

  @Autowired private DashboardCacheService dashboardCacheService;

  // Response time tracking
  private final Map<String, ResponseTimeTracker> endpointMetrics = new ConcurrentHashMap<>();

  // Error rate tracking
  private final Map<String, ErrorRateTracker> errorMetrics = new ConcurrentHashMap<>();

  // Throughput tracking
  private final Map<String, ThroughputTracker> throughputMetrics = new ConcurrentHashMap<>();

  // Cache performance tracking
  private final CachePerformanceTracker cacheTracker = new CachePerformanceTracker();

  // Discovery and scraping metrics
  private final OperationMetricsTracker discoveryMetrics = new OperationMetricsTracker();
  private final OperationMetricsTracker scrapingMetrics = new OperationMetricsTracker();

  // Alert thresholds
  private static final long SLOW_RESPONSE_THRESHOLD_MS = 2000;
  private static final double HIGH_ERROR_RATE_THRESHOLD = 5.0; // 5%
  private static final double LOW_CACHE_HIT_RATE_THRESHOLD = 70.0; // 70%

  /** Record API endpoint response time */
  public void recordResponseTime(String endpoint, long responseTimeMs) {
    endpointMetrics
        .computeIfAbsent(endpoint, k -> new ResponseTimeTracker())
        .recordResponse(responseTimeMs);

    // Check for slow response alert
    if (responseTimeMs > SLOW_RESPONSE_THRESHOLD_MS) {
      logger.warn("Slow response detected for {}: {}ms", endpoint, responseTimeMs);
    }
  }

  /** Record API endpoint error */
  public void recordError(String endpoint, String errorType) {
    errorMetrics.computeIfAbsent(endpoint, k -> new ErrorRateTracker()).recordError(errorType);

    logger.debug("Error recorded for {}: {}", endpoint, errorType);
  }

  /** Record successful API endpoint request */
  public void recordSuccess(String endpoint) {
    errorMetrics.computeIfAbsent(endpoint, k -> new ErrorRateTracker()).recordSuccess();
  }

  /** Record throughput for an operation */
  public void recordThroughput(String operation, int itemsProcessed) {
    throughputMetrics
        .computeIfAbsent(operation, k -> new ThroughputTracker())
        .recordThroughput(itemsProcessed);
  }

  /** Record cache operation */
  public void recordCacheHit(String cacheType) {
    cacheTracker.recordHit(cacheType);
  }

  /** Record cache miss */
  public void recordCacheMiss(String cacheType) {
    cacheTracker.recordMiss(cacheType);
  }

  /** Record discovery operation metrics */
  public void recordDiscoveryOperation(long durationMs, int suggestionsFound, boolean success) {
    discoveryMetrics.recordOperation(durationMs, suggestionsFound, success);
  }

  /** Record scraping operation metrics */
  public void recordScrapingOperation(long durationMs, int urlsProcessed, boolean success) {
    scrapingMetrics.recordOperation(durationMs, urlsProcessed, success);
  }

  /** Get comprehensive performance metrics dashboard data */
  public Map<String, Object> getPerformanceMetrics() {
    Map<String, Object> metrics = new HashMap<>();

    try {
      // API endpoint metrics
      metrics.put("apiEndpoints", getApiEndpointMetrics());

      // Throughput metrics
      metrics.put("throughput", getThroughputMetrics());

      // Cache performance metrics
      metrics.put("cache", getCachePerformanceMetrics());

      // Discovery and scraping metrics
      metrics.put("discovery", discoveryMetrics.getMetrics());
      metrics.put("scraping", scrapingMetrics.getMetrics());

      // Database performance metrics
      metrics.put("database", getDatabasePerformanceMetrics());

      // System alerts
      metrics.put("alerts", getPerformanceAlerts());

      metrics.put("timestamp", LocalDateTime.now());

    } catch (Exception e) {
      logger.error("Error getting performance metrics: {}", e.getMessage());
      metrics.put("error", e.getMessage());
    }

    return metrics;
  }

  /** Get API endpoint performance metrics */
  private Map<String, Object> getApiEndpointMetrics() {
    Map<String, Object> apiMetrics = new HashMap<>();

    // Response time metrics
    Map<String, Object> responseTimeMetrics = new HashMap<>();
    for (Map.Entry<String, ResponseTimeTracker> entry : endpointMetrics.entrySet()) {
      responseTimeMetrics.put(entry.getKey(), entry.getValue().getMetrics());
    }
    apiMetrics.put("responseTimes", responseTimeMetrics);

    // Error rate metrics
    Map<String, Object> errorRateMetrics = new HashMap<>();
    for (Map.Entry<String, ErrorRateTracker> entry : errorMetrics.entrySet()) {
      Map<String, Object> errorStats = entry.getValue().getMetrics();
      errorRateMetrics.put(entry.getKey(), errorStats);

      // Check for high error rate alert
      Double errorRate = (Double) errorStats.get("errorRate");
      if (errorRate != null && errorRate > HIGH_ERROR_RATE_THRESHOLD) {
        logger.warn("High error rate detected for {}: {}%", entry.getKey(), errorRate);
      }
    }
    apiMetrics.put("errorRates", errorRateMetrics);

    return apiMetrics;
  }

  /** Get throughput metrics */
  private Map<String, Object> getThroughputMetrics() {
    Map<String, Object> throughputData = new HashMap<>();

    for (Map.Entry<String, ThroughputTracker> entry : throughputMetrics.entrySet()) {
      throughputData.put(entry.getKey(), entry.getValue().getMetrics());
    }

    return throughputData;
  }

  /** Get cache performance metrics */
  private Map<String, Object> getCachePerformanceMetrics() {
    Map<String, Object> cacheMetrics = cacheTracker.getMetrics();

    try {
      // Add dashboard cache statistics
      Map<String, Object> dashboardCacheStats = dashboardCacheService.getCacheStatistics();
      cacheMetrics.put("dashboardCache", dashboardCacheStats);

    } catch (Exception e) {
      logger.warn("Error getting dashboard cache statistics: {}", e.getMessage());
    }

    // Check for low cache hit rate alert
    Double overallHitRate = (Double) cacheMetrics.get("overallHitRate");
    if (overallHitRate != null && overallHitRate < LOW_CACHE_HIT_RATE_THRESHOLD) {
      logger.warn("Low cache hit rate detected: {}%", overallHitRate);
      cacheMetrics.put("alert", "LOW_HIT_RATE");
    }

    return cacheMetrics;
  }

  /** Get database performance metrics */
  private Map<String, Object> getDatabasePerformanceMetrics() {
    Map<String, Object> dbMetrics = new HashMap<>();

    try {
      // Get database performance metrics
      Map<String, Object> dbStats = databaseMonitoringService.getDatabasePerformanceMetrics();
      dbMetrics.put("statistics", dbStats);

      // Get connection pool stats
      Map<String, Object> poolStats = databaseMonitoringService.getConnectionPoolStats();
      dbMetrics.put("connectionPool", poolStats);

      // Get Market Intelligence specific stats
      Map<String, Object> miStats = databaseMonitoringService.getMarketIntelligenceTableStats();
      dbMetrics.put("marketIntelligence", miStats);

    } catch (Exception e) {
      logger.error("Error getting database performance metrics: {}", e.getMessage());
      dbMetrics.put("error", e.getMessage());
    }

    return dbMetrics;
  }

  /** Get performance alerts */
  private Map<String, Object> getPerformanceAlerts() {
    Map<String, Object> alerts = new HashMap<>();

    // Response time alerts
    List<String> slowEndpoints =
        endpointMetrics.entrySet().stream()
            .filter(entry -> entry.getValue().getAverageResponseTime() > SLOW_RESPONSE_THRESHOLD_MS)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());

    if (!slowEndpoints.isEmpty()) {
      alerts.put("slowEndpoints", slowEndpoints);
    }

    // Error rate alerts
    List<String> highErrorEndpoints =
        errorMetrics.entrySet().stream()
            .filter(entry -> entry.getValue().getErrorRate() > HIGH_ERROR_RATE_THRESHOLD)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());

    if (!highErrorEndpoints.isEmpty()) {
      alerts.put("highErrorEndpoints", highErrorEndpoints);
    }

    // Cache performance alerts
    if (cacheTracker.getOverallHitRate() < LOW_CACHE_HIT_RATE_THRESHOLD) {
      alerts.put("lowCacheHitRate", cacheTracker.getOverallHitRate());
    }

    // Discovery/scraping alerts
    if (discoveryMetrics.getSuccessRate() < 90.0) {
      alerts.put("lowDiscoverySuccessRate", discoveryMetrics.getSuccessRate());
    }

    if (scrapingMetrics.getSuccessRate() < 95.0) {
      alerts.put("lowScrapingSuccessRate", scrapingMetrics.getSuccessRate());
    }

    return alerts;
  }

  /** Reset all performance metrics */
  public void resetMetrics() {
    endpointMetrics.clear();
    errorMetrics.clear();
    throughputMetrics.clear();
    cacheTracker.reset();
    discoveryMetrics.reset();
    scrapingMetrics.reset();

    logger.info("Performance metrics reset");
  }

  /** Scheduled task to log performance summary */
  @Scheduled(fixedRateString = "${storesight.monitoring.cache-cleanup-interval:PT8H}")
  public void logPerformanceSummary() {
    try {
      Map<String, Object> metrics = getPerformanceMetrics();

      @SuppressWarnings("unchecked")
      Map<String, Object> alerts = (Map<String, Object>) metrics.get("alerts");

      if (alerts != null && !alerts.isEmpty()) {
        logger.warn("Performance alerts detected: {}", alerts.keySet());
      } else {
        logger.debug("Performance monitoring: no alerts");
      }

    } catch (Exception e) {
      logger.error("Error during performance summary logging: {}", e.getMessage());
    }
  }

  /** Response time tracker */
  private static class ResponseTimeTracker {
    private final LongAdder totalRequests = new LongAdder();
    private final LongAdder totalResponseTime = new LongAdder();
    private final AtomicLong minResponseTime = new AtomicLong(Long.MAX_VALUE);
    private final AtomicLong maxResponseTime = new AtomicLong(0);

    public void recordResponse(long responseTimeMs) {
      totalRequests.increment();
      totalResponseTime.add(responseTimeMs);

      // Update min/max
      minResponseTime.updateAndGet(current -> Math.min(current, responseTimeMs));
      maxResponseTime.updateAndGet(current -> Math.max(current, responseTimeMs));
    }

    public long getAverageResponseTime() {
      long requests = totalRequests.sum();
      return requests > 0 ? totalResponseTime.sum() / requests : 0;
    }

    public Map<String, Object> getMetrics() {
      Map<String, Object> metrics = new HashMap<>();
      metrics.put("totalRequests", totalRequests.sum());
      metrics.put("averageResponseTimeMs", getAverageResponseTime());
      metrics.put(
          "minResponseTimeMs", minResponseTime.get() == Long.MAX_VALUE ? 0 : minResponseTime.get());
      metrics.put("maxResponseTimeMs", maxResponseTime.get());
      return metrics;
    }
  }

  /** Error rate tracker */
  private static class ErrorRateTracker {
    private final LongAdder totalRequests = new LongAdder();
    private final LongAdder totalErrors = new LongAdder();
    private final Map<String, LongAdder> errorTypes = new ConcurrentHashMap<>();

    public void recordError(String errorType) {
      totalRequests.increment();
      totalErrors.increment();
      errorTypes.computeIfAbsent(errorType, k -> new LongAdder()).increment();
    }

    public void recordSuccess() {
      totalRequests.increment();
    }

    public double getErrorRate() {
      long requests = totalRequests.sum();
      return requests > 0 ? (double) totalErrors.sum() / requests * 100 : 0;
    }

    public Map<String, Object> getMetrics() {
      Map<String, Object> metrics = new HashMap<>();
      metrics.put("totalRequests", totalRequests.sum());
      metrics.put("totalErrors", totalErrors.sum());
      metrics.put("errorRate", getErrorRate());

      Map<String, Long> errorTypeStats = new HashMap<>();
      for (Map.Entry<String, LongAdder> entry : errorTypes.entrySet()) {
        errorTypeStats.put(entry.getKey(), entry.getValue().sum());
      }
      metrics.put("errorTypes", errorTypeStats);

      return metrics;
    }
  }

  /** Throughput tracker */
  private static class ThroughputTracker {
    private final LongAdder totalItems = new LongAdder();
    private final LongAdder totalOperations = new LongAdder();
    private volatile LocalDateTime lastReset = LocalDateTime.now();

    public void recordThroughput(int itemsProcessed) {
      totalItems.add(itemsProcessed);
      totalOperations.increment();
    }

    public Map<String, Object> getMetrics() {
      Map<String, Object> metrics = new HashMap<>();
      long operations = totalOperations.sum();
      long items = totalItems.sum();

      metrics.put("totalOperations", operations);
      metrics.put("totalItems", items);
      metrics.put("averageItemsPerOperation", operations > 0 ? (double) items / operations : 0);

      // Calculate throughput per minute
      long minutesSinceReset = ChronoUnit.MINUTES.between(lastReset, LocalDateTime.now());
      if (minutesSinceReset > 0) {
        metrics.put("operationsPerMinute", (double) operations / minutesSinceReset);
        metrics.put("itemsPerMinute", (double) items / minutesSinceReset);
      }

      return metrics;
    }
  }

  /** Cache performance tracker */
  private static class CachePerformanceTracker {
    private final Map<String, LongAdder> cacheHits = new ConcurrentHashMap<>();
    private final Map<String, LongAdder> cacheMisses = new ConcurrentHashMap<>();

    public void recordHit(String cacheType) {
      cacheHits.computeIfAbsent(cacheType, k -> new LongAdder()).increment();
    }

    public void recordMiss(String cacheType) {
      cacheMisses.computeIfAbsent(cacheType, k -> new LongAdder()).increment();
    }

    public double getOverallHitRate() {
      long totalHits = cacheHits.values().stream().mapToLong(LongAdder::sum).sum();
      long totalMisses = cacheMisses.values().stream().mapToLong(LongAdder::sum).sum();
      long totalRequests = totalHits + totalMisses;

      return totalRequests > 0 ? (double) totalHits / totalRequests * 100 : 0;
    }

    public Map<String, Object> getMetrics() {
      Map<String, Object> metrics = new HashMap<>();

      Map<String, Object> cacheTypeMetrics = new HashMap<>();
      for (String cacheType : cacheHits.keySet()) {
        long hits = cacheHits.get(cacheType).sum();
        long misses = cacheMisses.getOrDefault(cacheType, new LongAdder()).sum();
        long total = hits + misses;

        Map<String, Object> typeMetrics = new HashMap<>();
        typeMetrics.put("hits", hits);
        typeMetrics.put("misses", misses);
        typeMetrics.put("hitRate", total > 0 ? (double) hits / total * 100 : 0);

        cacheTypeMetrics.put(cacheType, typeMetrics);
      }

      metrics.put("cacheTypes", cacheTypeMetrics);
      metrics.put("overallHitRate", getOverallHitRate());

      return metrics;
    }

    public void reset() {
      cacheHits.clear();
      cacheMisses.clear();
    }
  }

  /** Operation metrics tracker for discovery and scraping */
  private static class OperationMetricsTracker {
    private final LongAdder totalOperations = new LongAdder();
    private final LongAdder successfulOperations = new LongAdder();
    private final LongAdder totalDuration = new LongAdder();
    private final LongAdder totalItemsProcessed = new LongAdder();

    public void recordOperation(long durationMs, int itemsProcessed, boolean success) {
      totalOperations.increment();
      totalDuration.add(durationMs);
      totalItemsProcessed.add(itemsProcessed);

      if (success) {
        successfulOperations.increment();
      }
    }

    public double getSuccessRate() {
      long total = totalOperations.sum();
      return total > 0 ? (double) successfulOperations.sum() / total * 100 : 0;
    }

    public Map<String, Object> getMetrics() {
      Map<String, Object> metrics = new HashMap<>();
      long operations = totalOperations.sum();

      metrics.put("totalOperations", operations);
      metrics.put("successfulOperations", successfulOperations.sum());
      metrics.put("successRate", getSuccessRate());
      metrics.put("averageDurationMs", operations > 0 ? totalDuration.sum() / operations : 0);
      metrics.put("totalItemsProcessed", totalItemsProcessed.sum());
      metrics.put(
          "averageItemsPerOperation",
          operations > 0 ? (double) totalItemsProcessed.sum() / operations : 0);

      return metrics;
    }

    public void reset() {
      totalOperations.reset();
      successfulOperations.reset();
      totalDuration.reset();
      totalItemsProcessed.reset();
    }
  }
}
