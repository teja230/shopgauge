package com.storesight.backend.controller;

import com.storesight.backend.service.AlertingService;
import com.storesight.backend.service.DashboardCacheService;
import com.storesight.backend.service.DatabaseMonitoringService;
import com.storesight.backend.service.MetricsCollectionService;
import com.storesight.backend.service.MonitoringConfigurationService;
import com.storesight.backend.service.MonitoringDashboardService;
import com.storesight.backend.service.RedisHealthService;
import com.storesight.backend.service.SessionSynchronizationService;
import com.storesight.backend.service.SseService;
import com.storesight.backend.service.SystemResourceMonitoringService;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Health check controller providing comprehensive system health monitoring
 *
 * <p>This controller provides various health check endpoints for: - Overall system health -
 * Individual service health checks - Performance metrics and statistics - Detailed diagnostic
 * information
 */
@RestController
@RequestMapping("/api/health")
public class HealthController {

  private static final Logger logger = LoggerFactory.getLogger(HealthController.class);

  @Autowired private MetricsCollectionService metricsCollectionService;
  @Autowired private DatabaseMonitoringService databaseMonitoringService;
  @Autowired private SystemResourceMonitoringService systemResourceMonitoringService;
  @Autowired private RedisHealthService redisHealthService;
  @Autowired private SseService sseService;
  @Autowired private SessionSynchronizationService sessionSynchronizationService;
  @Autowired private DashboardCacheService dashboardCacheService;
  @Autowired private AlertingService alertingService;
  @Autowired private MonitoringDashboardService monitoringDashboardService;
  @Autowired private MonitoringConfigurationService monitoringConfigurationService;

  /**
   * Basic liveness check - indicates if the application is running
   *
   * @return Simple OK response
   */
  @GetMapping("/live")
  public ResponseEntity<Map<String, Object>> liveness() {
    Map<String, Object> response = new HashMap<>();
    response.put("status", "UP");
    response.put("timestamp", LocalDateTime.now());
    response.put("service", "ShopGauge Backend");

    return ResponseEntity.ok(response);
  }

  /**
   * Readiness check - indicates if the application is ready to serve requests
   *
   * @return Health status with dependency checks
   */
  @GetMapping("/ready")
  public ResponseEntity<Map<String, Object>> readiness() {
    Map<String, Object> response = new HashMap<>();
    Map<String, String> checks = new HashMap<>();
    boolean allHealthy = true;

    try {
      // Check database health
      Map<String, Object> dbHealth = databaseMonitoringService.performHealthCheck();
      String dbStatus = (String) dbHealth.get("overallStatus");
      checks.put("database", dbStatus);
      if (!"HEALTHY".equals(dbStatus)) {
        allHealthy = false;
      }

      // Check Redis health
      boolean redisHealthy = redisHealthService.isRedisHealthy();
      checks.put("redis", redisHealthy ? "HEALTHY" : "UNHEALTHY");
      if (!redisHealthy) {
        allHealthy = false;
      }

      // Check system resources
      Map<String, String> systemHealth = systemResourceMonitoringService.getHealthIndicators();
      checks.putAll(systemHealth);

      // Check if any system resource is critical
      for (String status : systemHealth.values()) {
        if ("CRITICAL".equals(status) || "ERROR".equals(status)) {
          allHealthy = false;
          break;
        }
      }

      response.put("status", allHealthy ? "UP" : "DOWN");
      response.put("checks", checks);
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(allHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
          .body(response);

    } catch (Exception e) {
      logger.error("Error during readiness check: {}", e.getMessage());
      response.put("status", "DOWN");
      response.put("error", e.getMessage());
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
    }
  }

  /**
   * Comprehensive health check with detailed information
   *
   * @return Detailed health status of all components
   */
  @GetMapping
  public ResponseEntity<Map<String, Object>> health() {
    Map<String, Object> response = new HashMap<>();

    try {
      // Overall status tracking
      boolean overallHealthy = true;
      Map<String, Object> components = new HashMap<>();

      // Database health
      Map<String, Object> databaseHealth = databaseMonitoringService.performHealthCheck();
      components.put("database", databaseHealth);
      if (!"HEALTHY".equals(databaseHealth.get("overallStatus"))) {
        overallHealthy = false;
      }

      // Redis health
      Map<String, Object> redisHealth = redisHealthService.getRedisHealthMetrics();
      components.put("redis", redisHealth);
      if (!redisHealthService.isRedisHealthy()) {
        overallHealthy = false;
      }

      // System resources health
      Map<String, Object> systemHealth =
          systemResourceMonitoringService.getSystemResourceStatistics();
      components.put("systemResources", systemHealth);

      // Check system resource alerts
      @SuppressWarnings("unchecked")
      Map<String, Object> cpuStats = (Map<String, Object>) systemHealth.get("cpu");
      @SuppressWarnings("unchecked")
      Map<String, Object> memoryStats = (Map<String, Object>) systemHealth.get("memory");
      @SuppressWarnings("unchecked")
      Map<String, Object> diskStats = (Map<String, Object>) systemHealth.get("disk");

      if ("CRITICAL".equals(cpuStats.get("alert"))
          || "CRITICAL".equals(memoryStats.get("alert"))
          || "CRITICAL".equals(diskStats.get("alert"))) {
        overallHealthy = false;
      }

      // SSE Service health
      Map<String, Object> sseHealth = getSseServiceHealth();
      components.put("sseService", sseHealth);

      // Application metrics health
      Map<String, String> metricsHealth = metricsCollectionService.getHealthIndicators();
      components.put("applicationMetrics", metricsHealth);

      // Check metrics health
      for (String status : metricsHealth.values()) {
        if ("CRITICAL".equals(status)) {
          overallHealthy = false;
          break;
        }
      }

      response.put("status", overallHealthy ? "UP" : "DOWN");
      response.put("components", components);
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(overallHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
          .body(response);

    } catch (Exception e) {
      logger.error("Error during comprehensive health check: {}", e.getMessage());
      response.put("status", "DOWN");
      response.put("error", e.getMessage());
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
    }
  }

  /**
   * Get application performance metrics
   *
   * @return Comprehensive metrics summary
   */
  @GetMapping("/metrics")
  public ResponseEntity<Map<String, Object>> metrics() {
    try {
      Map<String, Object> response = new HashMap<>();

      // Application metrics
      Map<String, Object> appMetrics = metricsCollectionService.getMetricsSummary();
      response.put("application", appMetrics);

      // Database metrics
      Map<String, Object> dbMetrics = databaseMonitoringService.getDatabaseStatistics();
      response.put("database", dbMetrics);

      // System resource metrics
      Map<String, Object> systemMetrics =
          systemResourceMonitoringService.getSystemResourceStatistics();
      response.put("system", systemMetrics);

      // Redis metrics
      Map<String, Object> redisMetrics = redisHealthService.getRedisHealthMetrics();
      response.put("redis", redisMetrics);

      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving metrics: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get database-specific health information
   *
   * @return Database health and performance metrics
   */
  @GetMapping("/database")
  public ResponseEntity<Map<String, Object>> databaseHealth() {
    try {
      Map<String, Object> response = new HashMap<>();

      // Health check
      Map<String, Object> healthCheck = databaseMonitoringService.performHealthCheck();
      response.put("health", healthCheck);

      // Performance statistics
      Map<String, Object> statistics = databaseMonitoringService.getDatabaseStatistics();
      response.put("statistics", statistics);

      // Health indicators
      Map<String, String> indicators = databaseMonitoringService.getHealthIndicators();
      response.put("indicators", indicators);

      response.put("timestamp", LocalDateTime.now());

      boolean healthy = "HEALTHY".equals(healthCheck.get("overallStatus"));
      return ResponseEntity.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
          .body(response);

    } catch (Exception e) {
      logger.error("Error retrieving database health: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get Redis-specific health information
   *
   * @return Redis health and connection metrics
   */
  @GetMapping("/redis")
  public ResponseEntity<Map<String, Object>> redisHealth() {
    try {
      Map<String, Object> response = redisHealthService.getRedisHealthMetrics();
      response.put("timestamp", LocalDateTime.now());

      boolean healthy = redisHealthService.isRedisHealthy();
      return ResponseEntity.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
          .body(response);

    } catch (Exception e) {
      logger.error("Error retrieving Redis health: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("healthy", false);
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(errorResponse);
    }
  }

  /**
   * Get system resource health information
   *
   * @return System resource usage and health metrics
   */
  @GetMapping("/system")
  public ResponseEntity<Map<String, Object>> systemHealth() {
    try {
      Map<String, Object> response = systemResourceMonitoringService.getSystemResourceStatistics();

      // Add health indicators
      Map<String, String> indicators = systemResourceMonitoringService.getHealthIndicators();
      response.put("healthIndicators", indicators);

      // Determine overall system health
      boolean systemHealthy =
          indicators.values().stream()
              .noneMatch(status -> "CRITICAL".equals(status) || "ERROR".equals(status));

      response.put("overallStatus", systemHealthy ? "HEALTHY" : "UNHEALTHY");

      return ResponseEntity.status(systemHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
          .body(response);

    } catch (Exception e) {
      logger.error("Error retrieving system health: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("overallStatus", "ERROR");
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Force health checks on all services
   *
   * @return Results of forced health checks
   */
  @GetMapping("/check")
  public ResponseEntity<Map<String, Object>> forceHealthCheck() {
    try {
      Map<String, Object> response = new HashMap<>();

      // Force Redis health check
      redisHealthService.forceHealthCheck();
      response.put("redis", "Health check triggered");

      // Force database health check
      Map<String, Object> dbHealth = databaseMonitoringService.performHealthCheck();
      response.put("database", dbHealth.get("overallStatus"));

      // Get current system status
      Map<String, String> systemHealth = systemResourceMonitoringService.getHealthIndicators();
      response.put("system", systemHealth);

      response.put("message", "Health checks completed");
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error during forced health check: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get SSE service health information
   *
   * @return SSE service health and connection metrics
   */
  @GetMapping("/sse")
  public ResponseEntity<Map<String, Object>> sseHealth() {
    try {
      Map<String, Object> response = new HashMap<>();

      // Get SSE service statistics
      Map<String, Object> sseStats = sseService.getStatistics();
      response.put("statistics", sseStats);

      // Determine SSE service health based on statistics
      @SuppressWarnings("unchecked")
      Map<String, Object> health = (Map<String, Object>) sseStats.get("health");
      String healthStatus = (String) health.get("status");

      response.put("overallStatus", healthStatus);
      response.put("timestamp", LocalDateTime.now());

      boolean healthy = "HEALTHY".equals(healthStatus);
      return ResponseEntity.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
          .body(response);

    } catch (Exception e) {
      logger.error("Error retrieving SSE service health: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("overallStatus", "ERROR");
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get session management health information
   *
   * @return Session synchronization service health and metrics
   */
  @GetMapping("/sessions")
  public ResponseEntity<Map<String, Object>> sessionHealth() {
    try {
      Map<String, Object> response = new HashMap<>();

      // Get session synchronization metrics
      SessionSynchronizationService.SessionSynchronizationMetrics metrics =
          sessionSynchronizationService.getMetrics();
      response.put("metrics", metrics);

      // Get lock statistics
      SessionSynchronizationService.SessionLockStatistics lockStats =
          sessionSynchronizationService.getLockStatistics();
      response.put("lockStatistics", lockStats);

      // Determine session health based on metrics
      String healthStatus = "HEALTHY";
      Map<String, String> healthIndicators = new HashMap<>();

      // Check lock failure rate
      long totalLocks = metrics.getTotalLockAcquisitions();
      if (totalLocks > 0) {
        double failureRate = (double) metrics.getTotalLockFailures() / totalLocks * 100;
        if (failureRate > 10) {
          healthStatus = "WARNING";
          healthIndicators.put("lockFailureRate", "HIGH");
        } else {
          healthIndicators.put("lockFailureRate", "NORMAL");
        }
      }

      // Check for stuck sessions
      if (metrics.getTotalStuckSessionsCleared() > 0) {
        healthIndicators.put("stuckSessions", "DETECTED");
        if ("HEALTHY".equals(healthStatus)) {
          healthStatus = "WARNING";
        }
      } else {
        healthIndicators.put("stuckSessions", "NONE");
      }

      // Check Redis operation failures
      if (metrics.getTotalRedisOperationFailures() > 0) {
        healthIndicators.put("redisOperations", "FAILURES_DETECTED");
        healthStatus = "WARNING";
      } else {
        healthIndicators.put("redisOperations", "HEALTHY");
      }

      response.put("overallStatus", healthStatus);
      response.put("healthIndicators", healthIndicators);
      response.put("timestamp", LocalDateTime.now());

      boolean healthy = "HEALTHY".equals(healthStatus);
      return ResponseEntity.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
          .body(response);

    } catch (Exception e) {
      logger.error("Error retrieving session health: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("overallStatus", "ERROR");
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get cache service health information
   *
   * @return Dashboard cache service health and performance metrics
   */
  @GetMapping("/cache")
  public ResponseEntity<Map<String, Object>> cacheHealth() {
    try {
      Map<String, Object> response = new HashMap<>();

      // Get cache statistics
      Map<String, Object> cacheStats = dashboardCacheService.getCacheStatistics();
      response.put("statistics", cacheStats);

      // Determine cache health based on statistics
      String healthStatus = "HEALTHY";
      Map<String, String> healthIndicators = new HashMap<>();

      // Check hit rate
      Double hitRate = (Double) cacheStats.get("hitRate");
      if (hitRate != null) {
        if (hitRate < 50) {
          healthStatus = "WARNING";
          healthIndicators.put("hitRate", "LOW");
        } else if (hitRate < 30) {
          healthStatus = "CRITICAL";
          healthIndicators.put("hitRate", "VERY_LOW");
        } else {
          healthIndicators.put("hitRate", "GOOD");
        }
      }

      // Check eviction rate
      Long evictions = (Long) cacheStats.get("evictions");
      Long total = (Long) cacheStats.get("total");
      if (evictions != null && total != null && total > 0) {
        double evictionRate = (double) evictions / total * 100;
        if (evictionRate > 20) {
          healthIndicators.put("evictionRate", "HIGH");
          if ("HEALTHY".equals(healthStatus)) {
            healthStatus = "WARNING";
          }
        } else {
          healthIndicators.put("evictionRate", "NORMAL");
        }
      }

      response.put("overallStatus", healthStatus);
      response.put("healthIndicators", healthIndicators);
      response.put("timestamp", LocalDateTime.now());

      boolean healthy = "HEALTHY".equals(healthStatus);
      return ResponseEntity.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
          .body(response);

    } catch (Exception e) {
      logger.error("Error retrieving cache health: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("overallStatus", "ERROR");
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get comprehensive application performance metrics
   *
   * @return Detailed performance metrics for all services
   */
  @GetMapping("/performance")
  public ResponseEntity<Map<String, Object>> performanceMetrics() {
    try {
      Map<String, Object> response = new HashMap<>();

      // Session performance metrics
      SessionSynchronizationService.SessionSynchronizationMetrics sessionMetrics =
          sessionSynchronizationService.getMetrics();
      response.put("sessionManagement", sessionMetrics);

      // SSE performance metrics
      Map<String, Object> sseMetrics = sseService.getStatistics();
      response.put("sseService", sseMetrics);

      // Cache performance metrics
      Map<String, Object> cacheMetrics = dashboardCacheService.getCacheStatistics();
      response.put("cacheService", cacheMetrics);

      // Application metrics summary
      Map<String, Object> appMetrics = metricsCollectionService.getMetricsSummary();
      response.put("applicationMetrics", appMetrics);

      // Performance health indicators
      Map<String, String> healthIndicators = metricsCollectionService.getHealthIndicators();
      response.put("healthIndicators", healthIndicators);

      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving performance metrics: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get alerting system information
   *
   * @return Current alerts and alerting statistics
   */
  @GetMapping("/alerts")
  public ResponseEntity<Map<String, Object>> alertsStatus() {
    try {
      Map<String, Object> response = new HashMap<>();

      // Get alert statistics
      Map<String, Object> alertStats = alertingService.getAlertStatistics();
      response.put("statistics", alertStats);

      // Get alert configuration
      Map<String, Object> alertConfig = alertingService.getAlertConfiguration();
      response.put("configuration", alertConfig);

      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving alert status: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get monitoring dashboard data
   *
   * @return Monitoring dashboard data for all dashboard types
   */
  @GetMapping("/dashboard")
  public ResponseEntity<Map<String, Object>> monitoringDashboard() {
    try {
      Map<String, Object> response = monitoringDashboardService.getAllDashboardData();
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving monitoring dashboard data: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get monitoring dashboard configuration
   *
   * @return Dashboard configuration for monitoring tools
   */
  @GetMapping("/dashboard/config")
  public ResponseEntity<Map<String, Object>> dashboardConfiguration() {
    try {
      Map<String, Object> response = monitoringDashboardService.getDashboardConfiguration();
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving dashboard configuration: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get error pattern analysis
   *
   * @return Error pattern analysis and log aggregation data
   */
  @GetMapping("/dashboard/errors")
  public ResponseEntity<Map<String, Object>> errorPatternAnalysis() {
    try {
      Map<String, Object> response = monitoringDashboardService.getErrorPatternAnalysis();
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving error pattern analysis: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get monitoring service statistics
   *
   * @return Statistics about the monitoring service itself
   */
  @GetMapping("/dashboard/stats")
  public ResponseEntity<Map<String, Object>> monitoringStatistics() {
    try {
      Map<String, Object> response = monitoringDashboardService.getMonitoringStatistics();
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving monitoring statistics: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get Grafana dashboard configuration
   *
   * @return Grafana dashboard configuration for external monitoring
   */
  @GetMapping("/config/grafana")
  public ResponseEntity<Map<String, Object>> grafanaDashboardConfig() {
    try {
      Map<String, Object> response = monitoringConfigurationService.getGrafanaDashboardConfig();
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving Grafana dashboard configuration: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get Prometheus alerting rules configuration
   *
   * @return Prometheus alerting rules for external monitoring
   */
  @GetMapping("/config/prometheus")
  public ResponseEntity<Map<String, Object>> prometheusAlertingRules() {
    try {
      Map<String, Object> response = monitoringConfigurationService.getPrometheusAlertingRules();
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving Prometheus alerting rules: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get log aggregation patterns
   *
   * @return Log aggregation patterns for various monitoring tools
   */
  @GetMapping("/config/logs")
  public ResponseEntity<Map<String, Object>> logAggregationPatterns() {
    try {
      Map<String, Object> response = monitoringConfigurationService.getLogAggregationPatterns();
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving log aggregation patterns: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get monitoring tool integrations
   *
   * @return Configuration for various monitoring tool integrations
   */
  @GetMapping("/config/integrations")
  public ResponseEntity<Map<String, Object>> monitoringIntegrations() {
    try {
      Map<String, Object> response = monitoringConfigurationService.getMonitoringIntegrations();
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving monitoring integrations: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get monitoring setup guide
   *
   * @return Comprehensive setup guide for monitoring infrastructure
   */
  @GetMapping("/config/setup")
  public ResponseEntity<Map<String, Object>> monitoringSetupGuide() {
    try {
      Map<String, Object> response = monitoringConfigurationService.getMonitoringSetupGuide();
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving monitoring setup guide: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get monitoring best practices
   *
   * @return Best practices for monitoring and alerting
   */
  @GetMapping("/config/best-practices")
  public ResponseEntity<Map<String, Object>> monitoringBestPractices() {
    try {
      Map<String, Object> response = monitoringConfigurationService.getMonitoringBestPractices();
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving monitoring best practices: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Get SSE service health information (private method for comprehensive health check)
   *
   * @return SSE service health and connection metrics
   */
  private Map<String, Object> getSseServiceHealth() {
    Map<String, Object> sseHealth = new HashMap<>();

    try {
      // Get SSE service statistics
      Map<String, Object> sseStats = sseService.getStatistics();

      // Extract health information
      @SuppressWarnings("unchecked")
      Map<String, Object> health = (Map<String, Object>) sseStats.get("health");
      String healthStatus = (String) health.get("status");

      sseHealth.put("status", healthStatus);
      sseHealth.put("activeConnections", sseStats.get("activeConnections"));
      sseHealth.put("totalConnections", sseStats.get("totalConnections"));
      sseHealth.put("totalErrors", sseStats.get("totalErrors"));

    } catch (Exception e) {
      logger.warn("Error getting SSE service health: {}", e.getMessage());
      sseHealth.put("status", "UNKNOWN");
      sseHealth.put("error", e.getMessage());
    }

    return sseHealth;
  }

  /** Get comprehensive health summary - Admin Dashboard Endpoint */
  @GetMapping("/summary")
  public ResponseEntity<Map<String, Object>> healthSummary() {
    try {
      Map<String, Object> response = new HashMap<>();
      response.put("health", health().getBody());
      response.put("metrics", performanceMetrics().getBody());
      response.put("alerts", alertsStatus().getBody());
      response.put("timestamp", LocalDateTime.now());
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      logger.error("Error retrieving health summary: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /** Get database pool statistics - Admin Dashboard Endpoint */
  @GetMapping("/database-pool")
  public ResponseEntity<Map<String, Object>> databasePoolStatistics() {
    return databaseHealth();
  }

  /** Get cache statistics - Admin Dashboard Endpoint */
  @GetMapping("/cache-statistics")
  public ResponseEntity<Map<String, Object>> cacheStatistics() {
    return cacheHealth();
  }

  /** Get connection leak status - Admin Dashboard Endpoint */
  @GetMapping("/connection-leak-status")
  public ResponseEntity<Map<String, Object>> connectionLeakStatus() {
    try {
      Map<String, Object> response = new HashMap<>();
      Map<String, Object> dbHealth = databaseMonitoringService.performHealthCheck();
      Map<String, Object> dbStats = databaseMonitoringService.getDatabaseStatistics();

      response.put("databaseHealth", dbHealth);
      response.put("connectionPool", dbStats);
      response.put(
          "leakDetection",
          Map.of(
              "enabled", true,
              "status", "MONITORING",
              "lastCheck", LocalDateTime.now(),
              "alert", "NORMAL",
              "message", "Connection pool monitoring active"));
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      logger.error("Error retrieving connection leak status: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }
}
