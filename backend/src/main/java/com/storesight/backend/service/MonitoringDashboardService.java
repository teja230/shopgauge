package com.storesight.backend.service;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Monitoring dashboard service for creating and managing monitoring dashboards
 *
 * <p>This service provides: - Dashboard configuration for session management and SSE performance -
 * Log aggregation and analysis for error patterns - Performance trend analysis - Real-time
 * monitoring data aggregation
 */
@Service
public class MonitoringDashboardService {

  private static final Logger logger = LoggerFactory.getLogger(MonitoringDashboardService.class);

  // Dependencies
  @Autowired private MetricsCollectionService metricsCollectionService;
  @Autowired private SystemResourceMonitoringService systemResourceMonitoringService;
  @Autowired private DatabaseMonitoringService databaseMonitoringService;
  @Autowired private SseService sseService;
  @Autowired private SessionSynchronizationService sessionSynchronizationService;
  @Autowired private DashboardCacheService dashboardCacheService;
  @Autowired private EnhancedRedisService enhancedRedisService;
  @Autowired private AlertingService alertingService;

  // Dashboard data storage
  private final ConcurrentHashMap<String, List<Map<String, Object>>> dashboardData =
      new ConcurrentHashMap<>();
  private final AtomicLong dataPointsCollected = new AtomicLong(0);
  private final AtomicLong dashboardRequests = new AtomicLong(0);

  // Error pattern tracking
  private final ConcurrentHashMap<String, AtomicLong> errorPatterns = new ConcurrentHashMap<>();
  private final ConcurrentHashMap<String, LocalDateTime> lastErrorOccurrence =
      new ConcurrentHashMap<>();

  /** Initialize dashboard data collections */
  public MonitoringDashboardService() {
    // Initialize dashboard data collections
    dashboardData.put("systemResources", new ArrayList<>());
    dashboardData.put("sessionManagement", new ArrayList<>());
    dashboardData.put("ssePerformance", new ArrayList<>());
    dashboardData.put("databasePerformance", new ArrayList<>());
    dashboardData.put("cachePerformance", new ArrayList<>());
    dashboardData.put("resilienceMetrics", new ArrayList<>());
    dashboardData.put("alertSummary", new ArrayList<>());
  }

  /** Collect monitoring data for dashboards */
  @Scheduled(
      fixedRateString = "${monitoring.dashboard.collection.interval:30000}") // Every 30 seconds
  public void collectMonitoringData() {
    try {
      logger.debug("Collecting monitoring data for dashboards");

      LocalDateTime timestamp = LocalDateTime.now();

      // Collect system resource data
      collectSystemResourceData(timestamp);

      // Collect session management data
      collectSessionManagementData(timestamp);

      // Collect SSE performance data
      collectSsePerformanceData(timestamp);

      // Collect database performance data
      collectDatabasePerformanceData(timestamp);

      // Collect cache performance data
      collectCachePerformanceData(timestamp);

      // Collect resilience metrics data
      collectResilienceMetricsData(timestamp);

      // Collect alert summary data
      collectAlertSummaryData(timestamp);

      // Analyze error patterns
      analyzeErrorPatterns();

      dataPointsCollected.incrementAndGet();
      logger.debug("Monitoring data collection completed");

    } catch (Exception e) {
      logger.error("Error collecting monitoring data: {}", e.getMessage(), e);
    }
  }

  /** Collect system resource monitoring data */
  private void collectSystemResourceData(LocalDateTime timestamp) {
    try {
      Map<String, Object> systemStats =
          systemResourceMonitoringService.getSystemResourceStatistics();

      Map<String, Object> dataPoint = new HashMap<>();
      dataPoint.put("timestamp", timestamp);

      // Extract key metrics
      @SuppressWarnings("unchecked")
      Map<String, Object> memoryStats = (Map<String, Object>) systemStats.get("memory");
      @SuppressWarnings("unchecked")
      Map<String, Object> cpuStats = (Map<String, Object>) systemStats.get("cpu");
      @SuppressWarnings("unchecked")
      Map<String, Object> diskStats = (Map<String, Object>) systemStats.get("disk");

      if (memoryStats != null) {
        dataPoint.put("memoryUsagePercent", memoryStats.get("usagePercent"));
        dataPoint.put("memoryAlert", memoryStats.get("alert"));
      }

      if (cpuStats != null) {
        dataPoint.put("cpuUsagePercent", cpuStats.get("processCpuLoad"));
        dataPoint.put("cpuAlert", cpuStats.get("alert"));
      }

      if (diskStats != null) {
        dataPoint.put("diskUsagePercent", diskStats.get("usagePercent"));
        dataPoint.put("diskAlert", diskStats.get("alert"));
      }

      addDataPoint("systemResources", dataPoint);

    } catch (Exception e) {
      logger.warn("Error collecting system resource data: {}", e.getMessage());
    }
  }

  /** Collect session management monitoring data */
  private void collectSessionManagementData(LocalDateTime timestamp) {
    try {
      SessionSynchronizationService.SessionSynchronizationMetrics metrics =
          sessionSynchronizationService.getMetrics();

      Map<String, Object> dataPoint = new HashMap<>();
      dataPoint.put("timestamp", timestamp);
      dataPoint.put("totalLockAcquisitions", metrics.getTotalLockAcquisitions());
      dataPoint.put("totalLockFailures", metrics.getTotalLockFailures());
      dataPoint.put("totalStuckSessionsCleared", metrics.getTotalStuckSessionsCleared());
      dataPoint.put("totalRedisOperationFailures", metrics.getTotalRedisOperationFailures());
      dataPoint.put("lockSuccessRate", metrics.getLockSuccessRate());

      // Calculate rates
      long totalLocks = metrics.getTotalLockAcquisitions();
      if (totalLocks > 0) {
        double failureRate = (double) metrics.getTotalLockFailures() / totalLocks * 100;
        dataPoint.put("lockFailureRate", failureRate);
      } else {
        dataPoint.put("lockFailureRate", 0.0);
      }

      addDataPoint("sessionManagement", dataPoint);

    } catch (Exception e) {
      logger.warn("Error collecting session management data: {}", e.getMessage());
    }
  }

  /** Collect SSE performance monitoring data */
  private void collectSsePerformanceData(LocalDateTime timestamp) {
    try {
      Map<String, Object> sseStats = sseService.getStatistics();

      Map<String, Object> dataPoint = new HashMap<>();
      dataPoint.put("timestamp", timestamp);
      dataPoint.put("activeConnections", sseStats.get("activeConnections"));
      dataPoint.put("totalConnections", sseStats.get("totalConnections"));
      dataPoint.put("totalErrors", sseStats.get("totalErrors"));
      dataPoint.put("totalEventsSent", sseStats.get("totalEventsSent"));
      dataPoint.put("totalBatchesSent", sseStats.get("totalBatchesSent"));
      dataPoint.put("pendingBatches", sseStats.get("pendingBatches"));

      // Calculate error rate
      long totalConnections = (Long) sseStats.get("totalConnections");
      long totalErrors = (Long) sseStats.get("totalErrors");
      if (totalConnections > 0) {
        double errorRate = (double) totalErrors / totalConnections * 100;
        dataPoint.put("errorRate", errorRate);
      } else {
        dataPoint.put("errorRate", 0.0);
      }

      // Connection utilization
      int activeConnections = (Integer) sseStats.get("activeConnections");
      int maxConnections = (Integer) sseStats.get("maxGlobalConnections");
      double utilization = (double) activeConnections / maxConnections * 100;
      dataPoint.put("connectionUtilization", utilization);

      addDataPoint("ssePerformance", dataPoint);

    } catch (Exception e) {
      logger.warn("Error collecting SSE performance data: {}", e.getMessage());
    }
  }

  /** Collect database performance monitoring data */
  private void collectDatabasePerformanceData(LocalDateTime timestamp) {
    try {
      Map<String, Object> dbStats = databaseMonitoringService.getDatabaseStatistics();

      Map<String, Object> dataPoint = new HashMap<>();
      dataPoint.put("timestamp", timestamp);
      dataPoint.put("totalQueries", dbStats.get("totalQueries"));
      dataPoint.put("slowQueries", dbStats.get("slowQueries"));
      dataPoint.put("failedQueries", dbStats.get("failedQueries"));
      dataPoint.put("failureRate", dbStats.get("failureRate"));
      dataPoint.put("slowQueryPercentage", dbStats.get("slowQueryPercentage"));

      // Connection pool data
      @SuppressWarnings("unchecked")
      Map<String, Object> poolStats = (Map<String, Object>) dbStats.get("connectionPool");
      if (poolStats != null) {
        dataPoint.put("activeConnections", poolStats.get("activeConnections"));
        dataPoint.put("idleConnections", poolStats.get("idleConnections"));
        dataPoint.put("totalConnections", poolStats.get("totalConnections"));
        dataPoint.put("utilizationPercentage", poolStats.get("utilizationPercentage"));
      }

      addDataPoint("databasePerformance", dataPoint);

    } catch (Exception e) {
      logger.warn("Error collecting database performance data: {}", e.getMessage());
    }
  }

  /** Collect cache performance monitoring data */
  private void collectCachePerformanceData(LocalDateTime timestamp) {
    try {
      Map<String, Object> cacheStats = dashboardCacheService.getCacheStatistics();

      Map<String, Object> dataPoint = new HashMap<>();
      dataPoint.put("timestamp", timestamp);
      dataPoint.put("hits", cacheStats.get("hits"));
      dataPoint.put("misses", cacheStats.get("misses"));
      dataPoint.put("evictions", cacheStats.get("evictions"));
      dataPoint.put("hitRate", cacheStats.get("hitRate"));
      dataPoint.put("size", cacheStats.get("size"));

      addDataPoint("cachePerformance", dataPoint);

    } catch (Exception e) {
      logger.warn("Error collecting cache performance data: {}", e.getMessage());
    }
  }

  /** Collect resilience metrics data (circuit breakers, retry logic, fallbacks) */
  private void collectResilienceMetricsData(LocalDateTime timestamp) {
    try {
      // Get Redis circuit breaker metrics using Resilience4j
      CircuitBreaker.Metrics redisMetrics = enhancedRedisService.getCircuitBreakerStatistics();
      boolean redisHealthy = enhancedRedisService.testConnection();

      Map<String, Object> dataPoint = new HashMap<>();
      dataPoint.put("timestamp", timestamp);

      // Redis circuit breaker metrics
      dataPoint.put("redisHealthy", redisHealthy);
      dataPoint.put(
          "redisCircuitBreakerState", enhancedRedisService.getCircuitBreakerState().toString());
      dataPoint.put("redisCurrentFailures", redisMetrics.getNumberOfFailedCalls());
      dataPoint.put("redisFailureRate", redisMetrics.getFailureRate());
      dataPoint.put("redisSuccessCount", redisMetrics.getNumberOfSuccessfulCalls());
      dataPoint.put("redisFailureThreshold", 50.0); // From configuration
      dataPoint.put(
          "redisLastFailureTime",
          System.currentTimeMillis()); // Resilience4j doesn't provide this directly
      dataPoint.put(
          "redisLastSuccessTime",
          System.currentTimeMillis()); // Resilience4j doesn't provide this directly

      // Session synchronization resilience metrics (already collected but add resilience focus)
      SessionSynchronizationService.SessionSynchronizationMetrics sessionMetrics =
          sessionSynchronizationService.getMetrics();
      dataPoint.put("sessionLockSuccessRate", sessionMetrics.getLockSuccessRate());
      dataPoint.put("sessionRedisFailures", sessionMetrics.getTotalRedisOperationFailures());
      dataPoint.put("sessionStuckSessionsCleared", sessionMetrics.getTotalStuckSessionsCleared());
      dataPoint.put("sessionOrphanedLocksCleared", sessionMetrics.getTotalOrphanedLocksCleared());

      // Overall system resilience indicators
      boolean systemHealthy = redisHealthy && sessionMetrics.getLockSuccessRate() > 95.0;
      dataPoint.put("overallSystemHealthy", systemHealthy);

      // Calculate overall resilience score (0-100)
      double resilienceScore = calculateResilienceScore(redisMetrics, sessionMetrics, redisHealthy);
      dataPoint.put("resilienceScore", resilienceScore);

      addDataPoint("resilienceMetrics", dataPoint);

    } catch (Exception e) {
      logger.warn("Error collecting resilience metrics data: {}", e.getMessage());
    }
  }

  /** Calculate overall system resilience score */
  private double calculateResilienceScore(
      CircuitBreaker.Metrics redisMetrics,
      SessionSynchronizationService.SessionSynchronizationMetrics sessionMetrics,
      boolean redisHealthy) {
    double score = 100.0;

    // Redis health contributes 40% to resilience score
    if (!redisHealthy) {
      score -= 40.0;
    } else {
      // Deduct points based on failure rate
      double redisFailureRate = redisMetrics.getFailureRate() * 100;
      if (redisFailureRate > 5.0) {
        score -= Math.min(20.0, redisFailureRate * 2); // Max 20 points deduction
      }

      // Deduct points for circuit breaker being open
      if (enhancedRedisService.getCircuitBreakerState() == CircuitBreaker.State.OPEN) {
        score -= 15.0;
      } else if (enhancedRedisService.getCircuitBreakerState() == CircuitBreaker.State.HALF_OPEN) {
        score -= 5.0;
      }
    }

    // Session management contributes 30% to resilience score
    double lockSuccessRate = sessionMetrics.getLockSuccessRate();
    if (lockSuccessRate < 95.0) {
      score -= (95.0 - lockSuccessRate) * 0.6; // Scale to max 30 points deduction
    }

    // Redis operation failures contribute 20% to resilience score
    long redisFailures = sessionMetrics.getTotalRedisOperationFailures();
    long totalOperations =
        sessionMetrics.getTotalLockAcquisitions() + sessionMetrics.getTotalLockFailures();
    if (totalOperations > 0) {
      double redisFailureRate = (double) redisFailures / totalOperations * 100;
      if (redisFailureRate > 5.0) {
        score -= Math.min(20.0, redisFailureRate * 2); // Max 20 points deduction
      }
    }

    // Cleanup operations contribute 10% to resilience score (more cleanups = lower resilience)
    long stuckSessions = sessionMetrics.getTotalStuckSessionsCleared();
    long orphanedLocks = sessionMetrics.getTotalOrphanedLocksCleared();
    long totalCleanups = stuckSessions + orphanedLocks;
    if (totalCleanups > 10) {
      score -= Math.min(10.0, totalCleanups * 0.5); // Max 10 points deduction
    }

    return Math.max(0.0, Math.min(100.0, score));
  }

  /** Collect alert summary data */
  private void collectAlertSummaryData(LocalDateTime timestamp) {
    try {
      Map<String, Object> alertStats = alertingService.getAlertStatistics();

      Map<String, Object> dataPoint = new HashMap<>();
      dataPoint.put("timestamp", timestamp);
      dataPoint.put("totalAlertsGenerated", alertStats.get("totalAlertsGenerated"));
      dataPoint.put("criticalAlertsGenerated", alertStats.get("criticalAlertsGenerated"));
      dataPoint.put("warningAlertsGenerated", alertStats.get("warningAlertsGenerated"));
      dataPoint.put("activeAlerts", alertStats.get("activeAlerts"));
      dataPoint.put("activeCriticalAlerts", alertStats.get("activeCriticalAlerts"));
      dataPoint.put("activeWarningAlerts", alertStats.get("activeWarningAlerts"));

      addDataPoint("alertSummary", dataPoint);

    } catch (Exception e) {
      logger.warn("Error collecting alert summary data: {}", e.getMessage());
    }
  }

  /** Add data point to dashboard collection */
  private void addDataPoint(String dashboardType, Map<String, Object> dataPoint) {
    List<Map<String, Object>> dataList = dashboardData.get(dashboardType);
    if (dataList != null) {
      synchronized (dataList) {
        dataList.add(dataPoint);

        // Keep only last 1000 data points to prevent memory issues
        if (dataList.size() > 1000) {
          dataList.remove(0);
        }
      }
    }
  }

  /** Analyze error patterns from logs and metrics */
  private void analyzeErrorPatterns() {
    try {
      // Analyze database errors
      Map<String, Object> dbStats = databaseMonitoringService.getDatabaseStatistics();
      long failedQueries = (Long) dbStats.get("failedQueries");
      updateErrorPattern("database.query.failures", failedQueries);

      // Analyze SSE errors
      Map<String, Object> sseStats = sseService.getStatistics();
      long sseErrors = (Long) sseStats.get("totalErrors");
      updateErrorPattern("sse.connection.errors", sseErrors);

      // Analyze session errors
      SessionSynchronizationService.SessionSynchronizationMetrics sessionMetrics =
          sessionSynchronizationService.getMetrics();
      long redisFailures = sessionMetrics.getTotalRedisOperationFailures();
      updateErrorPattern("session.redis.failures", redisFailures);

      // Analyze system resource alerts
      Map<String, Object> systemStats =
          systemResourceMonitoringService.getSystemResourceStatistics();
      @SuppressWarnings("unchecked")
      Map<String, Object> alertStats = (Map<String, Object>) systemStats.get("alerts");
      if (alertStats != null) {
        long memoryAlerts = (Long) alertStats.get("highMemoryAlerts");
        long cpuAlerts = (Long) alertStats.get("highCpuAlerts");
        long diskAlerts = (Long) alertStats.get("highDiskAlerts");

        updateErrorPattern("system.memory.alerts", memoryAlerts);
        updateErrorPattern("system.cpu.alerts", cpuAlerts);
        updateErrorPattern("system.disk.alerts", diskAlerts);
      }

    } catch (Exception e) {
      logger.warn("Error analyzing error patterns: {}", e.getMessage());
    }
  }

  /** Update error pattern tracking */
  private void updateErrorPattern(String pattern, long currentCount) {
    AtomicLong previousCount = errorPatterns.get(pattern);
    if (previousCount == null) {
      errorPatterns.put(pattern, new AtomicLong(currentCount));
    } else {
      long previous = previousCount.get();
      if (currentCount > previous) {
        // Error count increased
        errorPatterns.put(pattern, new AtomicLong(currentCount));
        lastErrorOccurrence.put(pattern, LocalDateTime.now());

        long increase = currentCount - previous;
        if (increase > 0) {
          logger.info(
              "Error pattern detected: {} increased by {} (total: {})",
              pattern,
              increase,
              currentCount);
        }
      }
    }
  }

  /** Get dashboard data for a specific dashboard type */
  public Map<String, Object> getDashboardData(String dashboardType) {
    dashboardRequests.incrementAndGet();

    Map<String, Object> response = new HashMap<>();

    List<Map<String, Object>> data = dashboardData.get(dashboardType);
    if (data != null) {
      synchronized (data) {
        response.put("data", new ArrayList<>(data));
        response.put("dataPoints", data.size());
      }
    } else {
      response.put("data", new ArrayList<>());
      response.put("dataPoints", 0);
    }

    response.put("dashboardType", dashboardType);
    response.put("timestamp", LocalDateTime.now());

    return response;
  }

  /** Get all available dashboard data */
  public Map<String, Object> getAllDashboardData() {
    dashboardRequests.incrementAndGet();

    Map<String, Object> response = new HashMap<>();

    for (String dashboardType : dashboardData.keySet()) {
      List<Map<String, Object>> data = dashboardData.get(dashboardType);
      if (data != null) {
        synchronized (data) {
          response.put(dashboardType, new ArrayList<>(data));
        }
      }
    }

    response.put("timestamp", LocalDateTime.now());
    return response;
  }

  /** Get error pattern analysis */
  public Map<String, Object> getErrorPatternAnalysis() {
    Map<String, Object> analysis = new HashMap<>();

    Map<String, Object> patterns = new HashMap<>();
    errorPatterns.forEach(
        (pattern, count) -> {
          Map<String, Object> patternInfo = new HashMap<>();
          patternInfo.put("count", count.get());
          patternInfo.put("lastOccurrence", lastErrorOccurrence.get(pattern));
          patterns.put(pattern, patternInfo);
        });

    analysis.put("errorPatterns", patterns);
    analysis.put("totalPatterns", errorPatterns.size());
    analysis.put("timestamp", LocalDateTime.now());

    return analysis;
  }

  /** Get dashboard configuration for monitoring tools */
  public Map<String, Object> getDashboardConfiguration() {
    Map<String, Object> config = new HashMap<>();

    // System resources dashboard config
    Map<String, Object> systemResourcesConfig = new HashMap<>();
    systemResourcesConfig.put("title", "System Resources");
    systemResourcesConfig.put("description", "CPU, Memory, and Disk usage monitoring");
    systemResourcesConfig.put("refreshInterval", 30);
    systemResourcesConfig.put(
        "charts",
        List.of(
            Map.of("type", "line", "metric", "memoryUsagePercent", "title", "Memory Usage %"),
            Map.of("type", "line", "metric", "cpuUsagePercent", "title", "CPU Usage %"),
            Map.of("type", "line", "metric", "diskUsagePercent", "title", "Disk Usage %")));
    config.put("systemResources", systemResourcesConfig);

    // Session management dashboard config
    Map<String, Object> sessionConfig = new HashMap<>();
    sessionConfig.put("title", "Session Management");
    sessionConfig.put("description", "Session synchronization and lock performance");
    sessionConfig.put("refreshInterval", 30);
    sessionConfig.put(
        "charts",
        List.of(
            Map.of("type", "line", "metric", "lockFailureRate", "title", "Lock Failure Rate %"),
            Map.of(
                "type",
                "bar",
                "metric",
                "totalStuckSessionsCleared",
                "title",
                "Stuck Sessions Cleared"),
            Map.of(
                "type",
                "line",
                "metric",
                "averageOperationDuration",
                "title",
                "Avg Operation Duration (ms)")));
    config.put("sessionManagement", sessionConfig);

    // SSE performance dashboard config
    Map<String, Object> sseConfig = new HashMap<>();
    sseConfig.put("title", "SSE Performance");
    sseConfig.put("description", "Server-Sent Events connection and performance monitoring");
    sseConfig.put("refreshInterval", 30);
    sseConfig.put(
        "charts",
        List.of(
            Map.of("type", "line", "metric", "activeConnections", "title", "Active Connections"),
            Map.of("type", "line", "metric", "errorRate", "title", "Error Rate %"),
            Map.of(
                "type",
                "line",
                "metric",
                "connectionUtilization",
                "title",
                "Connection Utilization %")));
    config.put("ssePerformance", sseConfig);

    // Database performance dashboard config
    Map<String, Object> databaseConfig = new HashMap<>();
    databaseConfig.put("title", "Database Performance");
    databaseConfig.put("description", "Database query performance and connection pool monitoring");
    databaseConfig.put("refreshInterval", 30);
    databaseConfig.put(
        "charts",
        List.of(
            Map.of("type", "line", "metric", "failureRate", "title", "Query Failure Rate %"),
            Map.of("type", "line", "metric", "slowQueryPercentage", "title", "Slow Query Rate %"),
            Map.of(
                "type",
                "line",
                "metric",
                "utilizationPercentage",
                "title",
                "Connection Pool Utilization %")));
    config.put("databasePerformance", databaseConfig);

    // Cache performance dashboard config
    Map<String, Object> cacheConfig = new HashMap<>();
    cacheConfig.put("title", "Cache Performance");
    cacheConfig.put("description", "Cache hit rates and performance monitoring");
    cacheConfig.put("refreshInterval", 30);
    cacheConfig.put(
        "charts",
        List.of(
            Map.of("type", "line", "metric", "hitRate", "title", "Cache Hit Rate %"),
            Map.of("type", "bar", "metric", "evictions", "title", "Cache Evictions"),
            Map.of("type", "line", "metric", "size", "title", "Cache Size")));
    config.put("cachePerformance", cacheConfig);

    config.put("timestamp", LocalDateTime.now());
    return config;
  }

  /** Get monitoring service statistics */
  public Map<String, Object> getMonitoringStatistics() {
    Map<String, Object> stats = new HashMap<>();

    stats.put("dataPointsCollected", dataPointsCollected.get());
    stats.put("dashboardRequests", dashboardRequests.get());
    stats.put("availableDashboards", dashboardData.keySet());
    stats.put("errorPatternsTracked", errorPatterns.size());

    // Data point counts per dashboard
    Map<String, Integer> dataPointCounts = new HashMap<>();
    dashboardData.forEach(
        (type, data) -> {
          synchronized (data) {
            dataPointCounts.put(type, data.size());
          }
        });
    stats.put("dataPointCounts", dataPointCounts);

    stats.put("timestamp", LocalDateTime.now());
    return stats;
  }

  /** Clear dashboard data (useful for testing or maintenance) */
  public void clearDashboardData(String dashboardType) {
    if (dashboardType == null) {
      // Clear all dashboard data
      dashboardData
          .values()
          .forEach(
              data -> {
                synchronized (data) {
                  data.clear();
                }
              });
      logger.info("All dashboard data cleared");
    } else {
      // Clear specific dashboard data
      List<Map<String, Object>> data = dashboardData.get(dashboardType);
      if (data != null) {
        synchronized (data) {
          data.clear();
        }
        logger.info("Dashboard data cleared for: {}", dashboardType);
      }
    }
  }

  /** Reset monitoring statistics */
  public void resetStatistics() {
    dataPointsCollected.set(0);
    dashboardRequests.set(0);
    errorPatterns.clear();
    lastErrorOccurrence.clear();
    logger.info("Monitoring dashboard statistics reset");
  }
}
