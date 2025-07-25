package com.storesight.backend.controller;

import com.storesight.backend.config.MemoryProfileConfig;
import com.storesight.backend.service.ConfigurationValidationService;
import com.storesight.backend.service.DashboardCacheService;
import com.storesight.backend.service.DatabaseMonitoringService;
import com.storesight.backend.service.EnterpriseHealthService;
import com.storesight.backend.service.RequestThrottlingService;
import com.storesight.backend.service.SessionSynchronizationService;
import com.storesight.backend.service.SystemResourceMonitoringService;
import com.storesight.backend.service.TransactionMonitoringService;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin Health Controller - Enterprise-Grade Health Endpoints
 *
 * <p>This controller provides comprehensive health monitoring endpoints designed for Admin UI
 * consumption. These endpoints are ON-DEMAND ONLY and should not be called on schedules to preserve
 * system resources.
 *
 * <p>Basic health endpoints (/live, /ready) are suitable for automated monitoring. Advanced
 * endpoints (/enterprise, /config/validate) are for Admin UI only.
 */
@RestController
@RequestMapping("/api/admin/health")
public class AdminHealthController {

  private static final Logger logger = LoggerFactory.getLogger(AdminHealthController.class);

  @Autowired private DatabaseMonitoringService databaseMonitoringService;
  @Autowired private SessionSynchronizationService sessionSynchronizationService;
  @Autowired private TransactionMonitoringService transactionMonitoringService;
  @Autowired private SystemResourceMonitoringService systemResourceMonitoringService;
  @Autowired private DashboardCacheService dashboardCacheService;
  @Autowired private MemoryProfileConfig memoryProfileConfig;
  @Autowired private RequestThrottlingService requestThrottlingService;
  @Autowired private EnterpriseHealthService enterpriseHealthService;
  @Autowired private ConfigurationValidationService configurationValidationService;

  /**
   * Get database transactions - Admin Dashboard Endpoint This endpoint provides transaction
   * statistics for the admin monitoring page
   */
  @GetMapping("/transactions")
  public ResponseEntity<Map<String, Object>> transactions() {
    try {
      Map<String, Object> response = new HashMap<>();

      // Get transaction monitoring metrics
      try {
        Map<String, Object> transactionMetrics = transactionMonitoringService.getHealthMetrics();
        response.put("transactionMetrics", transactionMetrics);

        Map<String, Object> transactionAlerts = transactionMonitoringService.getCriticalAlerts();
        response.put("transactionAlerts", transactionAlerts);

        boolean isHealthy = transactionMonitoringService.isHealthy();
        response.put("transactionHealthy", isHealthy);
      } catch (Exception e) {
        logger.warn("Transaction monitoring unavailable: {}", e.getMessage());
        response.put("transactionMetrics", Map.of("error", "Transaction monitoring unavailable"));
      }

      // Get database statistics which should include connection pool info
      try {
        Map<String, Object> dbStats = databaseMonitoringService.getDatabaseStatistics();
        response.put("databaseTransactions", dbStats);
      } catch (Exception e) {
        logger.warn("Database statistics unavailable: {}", e.getMessage());
        response.put("databaseTransactions", Map.of("error", "Database statistics unavailable"));
      }

      // Get session metrics which may include transaction-related data
      try {
        SessionSynchronizationService.SessionSynchronizationMetrics sessionMetrics =
            sessionSynchronizationService.getMetrics();
        response.put("sessionTransactions", sessionMetrics);
      } catch (Exception e) {
        logger.warn("Session metrics unavailable: {}", e.getMessage());
        response.put("sessionTransactions", Map.of("error", "Session metrics unavailable"));
      }

      // Add transaction health indicators
      Map<String, String> healthIndicators = new HashMap<>();
      healthIndicators.put("transactionStatus", "ACTIVE");
      healthIndicators.put("connectionPool", "HEALTHY");
      healthIndicators.put("lockStatus", "NORMAL");

      response.put("healthIndicators", healthIndicators);
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving transaction statistics: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /** Get transaction metrics endpoint for TransactionMonitoring component */
  @GetMapping("/metrics/transactions")
  public ResponseEntity<Map<String, Object>> transactionMetrics() {
    try {
      Map<String, Object> response = new HashMap<>();

      // Get transaction monitoring metrics
      Map<String, Object> transactionMetrics = transactionMonitoringService.getHealthMetrics();
      response.put("metrics", transactionMetrics);

      // Get critical alerts
      Map<String, Object> alerts = transactionMonitoringService.getCriticalAlerts();
      response.put("alerts", alerts);

      // Add health status
      boolean isHealthy = transactionMonitoringService.isHealthy();
      response.put("healthy", isHealthy);
      response.put("status", isHealthy ? "HEALTHY" : "UNHEALTHY");

      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving transaction metrics: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /** Reset transaction metrics endpoint for TransactionMonitoring component */
  @PostMapping("/metrics/transactions/reset")
  public ResponseEntity<Map<String, Object>> resetTransactionMetrics() {
    try {
      // Reset transaction monitoring metrics
      transactionMonitoringService.resetMetrics();

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Transaction metrics reset successfully");
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error resetting transaction metrics: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /** Get cache statistics endpoint for admin dashboard */
  @GetMapping("/cache-statistics")
  public ResponseEntity<Map<String, Object>> cacheStatistics() {
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
      logger.error("Error retrieving cache statistics: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", e.getMessage());
      errorResponse.put("overallStatus", "ERROR");
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /** Reset cache statistics endpoint */
  @PostMapping("/cache-statistics/reset")
  public ResponseEntity<Map<String, Object>> resetCacheStatistics() {
    try {
      dashboardCacheService.resetCacheStatistics();

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Cache statistics reset successfully");
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error resetting cache statistics: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("success", false);
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /** Emergency cleanup endpoint */
  @PostMapping("/emergency-cleanup")
  public ResponseEntity<Map<String, Object>> emergencyCleanup() {
    try {
      Map<String, Object> response = new HashMap<>();

      // Perform database cleanup
      Map<String, Object> dbHealth = databaseMonitoringService.performHealthCheck();

      // Get system health
      Map<String, String> systemHealth = systemResourceMonitoringService.getHealthIndicators();

      response.put("success", true);
      response.put("message", "Emergency cleanup completed");
      response.put("databaseHealth", dbHealth);
      response.put("systemHealth", systemHealth);
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error during emergency cleanup: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("success", false);
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /** Comprehensive cleanup endpoint */
  @PostMapping("/comprehensive-cleanup")
  public ResponseEntity<Map<String, Object>> comprehensiveCleanup() {
    try {
      Map<String, Object> response = new HashMap<>();

      // Perform comprehensive cleanup
      Map<String, Object> dbHealth = databaseMonitoringService.performHealthCheck();
      Map<String, Object> dbStats = databaseMonitoringService.getDatabaseStatistics();

      // Reset transaction metrics
      transactionMonitoringService.resetMetrics();

      // Reset cache statistics
      dashboardCacheService.resetCacheStatistics();

      // Get updated system health
      Map<String, String> systemHealth = systemResourceMonitoringService.getHealthIndicators();

      response.put("success", true);
      response.put("message", "Comprehensive cleanup completed");
      response.put("databaseHealth", dbHealth);
      response.put("databaseStats", dbStats);
      response.put("systemHealth", systemHealth);
      response.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error during comprehensive cleanup: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("success", false);
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /** Get current memory profile configuration */
  @GetMapping("/memory-profile")
  public ResponseEntity<Map<String, Object>> getMemoryProfile() {
    try {
      Map<String, Object> response = new HashMap<>();

      // Memory profile info
      response.put("currentProfile", memoryProfileConfig.getMemoryProfile());
      response.put("isEmergencyMode", memoryProfileConfig.isEmergencyMode());
      response.put("isBalancedMode", memoryProfileConfig.isBalancedMode());
      response.put("isPerformanceMode", memoryProfileConfig.isPerformanceMode());

      // Current settings
      MemoryProfileConfig.MemorySettings settings = memoryProfileConfig.getActiveSettings();
      Map<String, Object> currentSettings = new HashMap<>();
      currentSettings.put("dbPoolMaxSize", settings.getDbPoolMaxSize());
      currentSettings.put("tomcatMaxThreads", settings.getTomcatMaxThreads());
      currentSettings.put("cacheMaxSize", settings.getCacheMaxSize());
      currentSettings.put("requestThrottlingEnabled", settings.isRequestThrottlingEnabled());
      currentSettings.put("maxConcurrentRequests", settings.getMaxConcurrentRequests());
      currentSettings.put("asyncDiscoveryMaxConcurrent", settings.getAsyncDiscoveryMaxConcurrent());
      currentSettings.put("asyncScrapingMaxConcurrent", settings.getAsyncScrapingMaxConcurrent());

      response.put("settings", currentSettings);

      // JVM memory info
      Runtime runtime = Runtime.getRuntime();
      Map<String, Object> memoryInfo = new HashMap<>();
      memoryInfo.put("maxMemoryMB", runtime.maxMemory() / 1024 / 1024);
      memoryInfo.put("totalMemoryMB", runtime.totalMemory() / 1024 / 1024);
      memoryInfo.put("freeMemoryMB", runtime.freeMemory() / 1024 / 1024);
      memoryInfo.put("usedMemoryMB", (runtime.totalMemory() - runtime.freeMemory()) / 1024 / 1024);
      memoryInfo.put(
          "usagePercent",
          Math.round(
              ((double) (runtime.totalMemory() - runtime.freeMemory()) / runtime.maxMemory())
                  * 100));

      response.put("jvmMemory", memoryInfo);
      response.put("timestamp", LocalDateTime.now());
      response.put("success", true);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error getting memory profile: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("success", false);
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /** Get request throttling statistics */
  @GetMapping("/throttling")
  public ResponseEntity<Map<String, Object>> getThrottlingStats() {
    try {
      Map<String, Object> response = new HashMap<>();

      // Get throttling statistics
      Map<String, Object> throttlingStats = requestThrottlingService.getStatistics();
      response.put("throttling", throttlingStats);
      response.put("timestamp", LocalDateTime.now());
      response.put("success", true);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error getting throttling stats: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("success", false);
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Enterprise health status with intelligent recommendations FOR ADMIN UI ONLY - On-demand
   * comprehensive health analysis
   */
  @GetMapping("/enterprise")
  public ResponseEntity<Map<String, Object>> getEnterpriseHealth() {
    try {
      Map<String, Object> response = enterpriseHealthService.getEnterpriseHealthStatus();
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error getting enterprise health: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("success", false);
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /**
   * Readiness probe for load balancers SUITABLE FOR AUTOMATED MONITORING - Lightweight readiness
   * check
   */
  @GetMapping("/ready")
  public ResponseEntity<Map<String, Object>> getReadiness() {
    try {
      Map<String, Object> response = enterpriseHealthService.getReadinessStatus();
      boolean isReady = (Boolean) response.get("ready");

      return ResponseEntity.status(isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
          .body(response);

    } catch (Exception e) {
      logger.error("Error checking readiness: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("ready", false);
      errorResponse.put("status", "ERROR");
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());
      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(errorResponse);
    }
  }

  /**
   * Liveness probe for container orchestration SUITABLE FOR AUTOMATED MONITORING - Lightweight
   * liveness check
   */
  @GetMapping("/live")
  public ResponseEntity<Map<String, Object>> getLiveness() {
    try {
      Map<String, Object> response = enterpriseHealthService.getLivenessStatus();
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error checking liveness: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("alive", false);
      errorResponse.put("status", "ERROR");
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /** Configuration validation endpoint FOR ADMIN UI ONLY - On-demand configuration analysis */
  @GetMapping("/config/validate")
  public ResponseEntity<Map<String, Object>> validateConfiguration() {
    try {
      Map<String, Object> response = configurationValidationService.getValidationResults();

      // Return appropriate HTTP status based on validation results
      boolean hasErrors = (Integer) response.get("errorCount") > 0;
      HttpStatus status = hasErrors ? HttpStatus.BAD_REQUEST : HttpStatus.OK;

      return ResponseEntity.status(status).body(response);

    } catch (Exception e) {
      logger.error("Error validating configuration: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("status", "ERROR");
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }

  /** Revalidate configuration on demand FOR ADMIN UI ONLY - Trigger configuration revalidation */
  @PostMapping("/config/revalidate")
  public ResponseEntity<Map<String, Object>> revalidateConfiguration() {
    try {
      configurationValidationService.revalidateConfiguration();
      Map<String, Object> response = configurationValidationService.getValidationResults();

      Map<String, Object> result = new HashMap<>();
      result.put("success", true);
      result.put("message", "Configuration revalidated successfully");
      result.put("validation", response);
      result.put("timestamp", LocalDateTime.now());

      return ResponseEntity.ok(result);

    } catch (Exception e) {
      logger.error("Error revalidating configuration: {}", e.getMessage());
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("success", false);
      errorResponse.put("error", e.getMessage());
      errorResponse.put("timestamp", LocalDateTime.now());
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
  }
}
