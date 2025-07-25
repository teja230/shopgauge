package com.storesight.backend.service;

import com.storesight.backend.config.MemoryProfileConfig;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Enterprise Health Service
 *
 * <p>Provides comprehensive health monitoring and intelligent recommendations for enterprise
 * deployments. Includes proactive alerting and capacity planning.
 */
@Service
public class EnterpriseHealthService {

  private static final Logger logger = LoggerFactory.getLogger(EnterpriseHealthService.class);

  @Autowired private MemoryProfileConfig memoryProfileConfig;

  @Autowired private RequestThrottlingService requestThrottlingService;

  /** Get comprehensive enterprise health status */
  public Map<String, Object> getEnterpriseHealthStatus() {
    Map<String, Object> health = new HashMap<>();

    // System overview
    health.put("timestamp", LocalDateTime.now());
    health.put("status", determineOverallHealth());
    health.put("memoryProfile", memoryProfileConfig.getMemoryProfile());
    health.put("deploymentMode", getDeploymentMode());

    // Performance metrics
    health.put("performance", getPerformanceMetrics());

    // Capacity analysis
    health.put("capacity", getCapacityAnalysis());

    // Recommendations
    health.put("recommendations", getIntelligentRecommendations());

    // Alerts
    health.put("alerts", getActiveAlerts());

    return health;
  }

  /** Determine overall system health status */
  private String determineOverallHealth() {
    Runtime runtime = Runtime.getRuntime();
    double memoryUsage =
        (double) (runtime.totalMemory() - runtime.freeMemory()) / runtime.maxMemory();

    if (memoryUsage > 0.95) return "CRITICAL";
    if (memoryUsage > 0.85) return "WARNING";
    if (memoryUsage > 0.70) return "CAUTION";
    return "HEALTHY";
  }

  /** Get deployment mode based on memory profile */
  private String getDeploymentMode() {
    if (memoryProfileConfig.isEmergencyMode()) return "EMERGENCY";
    if (memoryProfileConfig.isBalancedMode()) return "PRODUCTION";
    if (memoryProfileConfig.isPerformanceMode()) return "ENTERPRISE";
    return "UNKNOWN";
  }

  /** Get performance metrics */
  private Map<String, Object> getPerformanceMetrics() {
    Map<String, Object> metrics = new HashMap<>();

    Runtime runtime = Runtime.getRuntime();
    long maxMemory = runtime.maxMemory();
    long totalMemory = runtime.totalMemory();
    long freeMemory = runtime.freeMemory();
    long usedMemory = totalMemory - freeMemory;

    metrics.put(
        "memoryUsage",
        Map.of(
            "used",
            usedMemory / 1024 / 1024 + "MB",
            "max",
            maxMemory / 1024 / 1024 + "MB",
            "percentage",
            Math.round((double) usedMemory / maxMemory * 100),
            "status",
            usedMemory / (double) maxMemory > 0.85 ? "HIGH" : "NORMAL"));

    // Database metrics
    MemoryProfileConfig.MemorySettings settings = memoryProfileConfig.getActiveSettings();
    metrics.put(
        "database",
        Map.of(
            "maxConnections",
            settings.getDbPoolMaxSize(),
            "status",
            "HEALTHY" // Would integrate with actual DB monitoring
            ));

    // Request throttling metrics
    if (settings.isRequestThrottlingEnabled()) {
      Map<String, Object> throttlingStats = requestThrottlingService.getStatistics();
      metrics.put(
          "requestThrottling",
          Map.of(
              "enabled",
              true,
              "status",
              "ACTIVE",
              "shops",
              ((Map<String, Object>) throttlingStats.get("shops")).size()));
    } else {
      metrics.put("requestThrottling", Map.of("enabled", false, "status", "DISABLED"));
    }

    return metrics;
  }

  /** Analyze current capacity and utilization */
  private Map<String, Object> getCapacityAnalysis() {
    Map<String, Object> capacity = new HashMap<>();

    Runtime runtime = Runtime.getRuntime();
    double memoryUsage =
        (double) (runtime.totalMemory() - runtime.freeMemory()) / runtime.maxMemory();

    MemoryProfileConfig.MemorySettings settings = memoryProfileConfig.getActiveSettings();

    capacity.put("currentUtilization", Math.round(memoryUsage * 100) + "%");
    capacity.put("recommendedMaxUtilization", "80%");
    capacity.put("headroom", Math.round((0.8 - memoryUsage) * 100) + "%");

    // Capacity recommendations
    if (memoryUsage > 0.8) {
      capacity.put("status", "NEAR_CAPACITY");
      capacity.put("action", "UPGRADE_RECOMMENDED");
    } else if (memoryUsage > 0.7) {
      capacity.put("status", "MODERATE_USAGE");
      capacity.put("action", "MONITOR_CLOSELY");
    } else {
      capacity.put("status", "HEALTHY_CAPACITY");
      capacity.put("action", "NO_ACTION_NEEDED");
    }

    // Scaling recommendations
    if (memoryProfileConfig.isEmergencyMode() && memoryUsage > 0.7) {
      capacity.put("scaleRecommendation", "Upgrade to 1GB profile for better performance");
    } else if (memoryProfileConfig.isBalancedMode() && memoryUsage > 0.8) {
      capacity.put(
          "scaleRecommendation", "Consider upgrading to 2GB profile for high-traffic periods");
    }

    return capacity;
  }

  /** Generate intelligent recommendations based on current state */
  private java.util.List<Map<String, Object>> getIntelligentRecommendations() {
    java.util.List<Map<String, Object>> recommendations = new java.util.ArrayList<>();

    Runtime runtime = Runtime.getRuntime();
    double memoryUsage =
        (double) (runtime.totalMemory() - runtime.freeMemory()) / runtime.maxMemory();

    // Memory-based recommendations
    if (memoryUsage > 0.85) {
      recommendations.add(
          Map.of(
              "type", "CRITICAL",
              "category", "MEMORY",
              "title", "High Memory Usage Detected",
              "description", "Memory usage is above 85%. Consider upgrading memory profile.",
              "action", "Set MEMORY_PROFILE to next tier",
              "priority", "HIGH"));
    }

    // Profile-specific recommendations
    if (memoryProfileConfig.isEmergencyMode()) {
      recommendations.add(
          Map.of(
              "type", "OPTIMIZATION",
              "category", "PERFORMANCE",
              "title", "Running in Emergency Mode",
              "description",
                  "Request throttling is active. Upgrade to 1GB profile for better performance.",
              "action", "Set MEMORY_PROFILE=1GB and upgrade server resources",
              "priority", "MEDIUM"));
    }

    // Throttling recommendations
    MemoryProfileConfig.MemorySettings settings = memoryProfileConfig.getActiveSettings();
    if (settings.isRequestThrottlingEnabled()) {
      Map<String, Object> throttlingStats = requestThrottlingService.getStatistics();
      @SuppressWarnings("unchecked")
      Map<String, Object> shops = (Map<String, Object>) throttlingStats.get("shops");

      if (shops != null && !shops.isEmpty()) {
        recommendations.add(
            Map.of(
                "type", "INFO",
                "category", "USER_EXPERIENCE",
                "title", "Request Throttling Active",
                "description", "Users may experience loading delays during peak usage.",
                "action", "Consider upgrading memory profile to disable throttling",
                "priority", "LOW"));
      }
    }

    // General optimization recommendations
    recommendations.add(
        Map.of(
            "type", "BEST_PRACTICE",
            "category", "MONITORING",
            "title", "Regular Health Monitoring",
            "description", "Monitor system health regularly using /api/health/enterprise endpoint.",
            "action", "Set up automated health checks and alerting",
            "priority", "LOW"));

    return recommendations;
  }

  /** Get active system alerts */
  private java.util.List<Map<String, Object>> getActiveAlerts() {
    java.util.List<Map<String, Object>> alerts = new java.util.ArrayList<>();

    Runtime runtime = Runtime.getRuntime();
    double memoryUsage =
        (double) (runtime.totalMemory() - runtime.freeMemory()) / runtime.maxMemory();

    // Memory alerts
    if (memoryUsage > 0.95) {
      alerts.add(
          Map.of(
              "severity", "CRITICAL",
              "type", "MEMORY_CRITICAL",
              "message", "Memory usage above 95% - immediate action required",
              "timestamp", LocalDateTime.now(),
              "action", "Restart application or upgrade memory profile"));
    } else if (memoryUsage > 0.85) {
      alerts.add(
          Map.of(
              "severity", "WARNING",
              "type", "MEMORY_HIGH",
              "message", "Memory usage above 85% - consider scaling up",
              "timestamp", LocalDateTime.now(),
              "action", "Monitor closely and plan memory profile upgrade"));
    }

    // Profile-specific alerts
    if (memoryProfileConfig.isEmergencyMode()) {
      alerts.add(
          Map.of(
              "severity", "INFO",
              "type", "EMERGENCY_MODE",
              "message", "Running in emergency mode with request throttling",
              "timestamp", LocalDateTime.now(),
              "action", "Upgrade to 1GB profile when possible"));
    }

    return alerts;
  }

  /** Get system readiness status for load balancers */
  public Map<String, Object> getReadinessStatus() {
    Map<String, Object> readiness = new HashMap<>();

    Runtime runtime = Runtime.getRuntime();
    double memoryUsage =
        (double) (runtime.totalMemory() - runtime.freeMemory()) / runtime.maxMemory();

    boolean isReady = memoryUsage < 0.95; // Not ready if memory is critically high

    readiness.put("ready", isReady);
    readiness.put("status", isReady ? "READY" : "NOT_READY");
    readiness.put("memoryUsage", Math.round(memoryUsage * 100) + "%");
    readiness.put("timestamp", LocalDateTime.now());

    if (!isReady) {
      readiness.put("reason", "High memory usage - system may be unstable");
    }

    return readiness;
  }

  /** Get liveness status for health checks */
  public Map<String, Object> getLivenessStatus() {
    Map<String, Object> liveness = new HashMap<>();

    // Basic liveness check - application is running
    liveness.put("alive", true);
    liveness.put("status", "ALIVE");
    liveness.put("timestamp", LocalDateTime.now());
    liveness.put("memoryProfile", memoryProfileConfig.getMemoryProfile());

    return liveness;
  }
}
