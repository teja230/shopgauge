package com.storesight.backend.service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Comprehensive alerting service for system monitoring
 *
 * <p>This service provides intelligent alerting for: - High memory usage and connection pool
 * exhaustion - Stuck sessions and SSE connection issues - Database performance problems - System
 * resource alerts - Cache performance degradation
 */
@Service
public class AlertingService {

  private static final Logger logger = LoggerFactory.getLogger(AlertingService.class);

  // Alert thresholds from configuration
  @Value("${alerting.memory.warning.threshold:80}")
  private double memoryWarningThreshold;

  @Value("${alerting.memory.critical.threshold:95}")
  private double memoryCriticalThreshold;

  @Value("${alerting.cpu.warning.threshold:80}")
  private double cpuWarningThreshold;

  @Value("${alerting.cpu.critical.threshold:95}")
  private double cpuCriticalThreshold;

  @Value("${alerting.disk.warning.threshold:80}")
  private double diskWarningThreshold;

  @Value("${alerting.disk.critical.threshold:95}")
  private double diskCriticalThreshold;

  @Value("${alerting.connection-pool.warning.threshold:80}")
  private double connectionPoolWarningThreshold;

  @Value("${alerting.connection-pool.critical.threshold:95}")
  private double connectionPoolCriticalThreshold;

  @Value("${alerting.session.stuck.threshold:5}")
  private long stuckSessionThreshold;

  @Value("${alerting.sse.error-rate.threshold:10}")
  private double sseErrorRateThreshold;

  @Value("${alerting.database.error-rate.threshold:5}")
  private double databaseErrorRateThreshold;

  @Value("${alerting.cache.hit-rate.threshold:50}")
  private double cacheHitRateThreshold;

  // Dependencies
  @Autowired private MetricsCollectionService metricsCollectionService;
  @Autowired private SystemResourceMonitoringService systemResourceMonitoringService;
  @Autowired private DatabaseMonitoringService databaseMonitoringService;
  @Autowired private SseService sseService;
  @Autowired private DashboardCacheService dashboardCacheService;
  @Autowired private SessionSynchronizationService sessionSynchronizationService;

  @Autowired private FeatureFlagService featureFlagService;

  // Alert tracking
  private final ConcurrentHashMap<String, AlertState> activeAlerts = new ConcurrentHashMap<>();
  private final AtomicLong totalAlertsGenerated = new AtomicLong(0);
  private final AtomicLong criticalAlertsGenerated = new AtomicLong(0);
  private final AtomicLong warningAlertsGenerated = new AtomicLong(0);

  /** Alert severity levels */
  public enum AlertSeverity {
    INFO,
    WARNING,
    CRITICAL,
    RESOLVED
  }

  /** Alert state tracking */
  public static class AlertState {
    private final String alertId;
    private final AlertSeverity severity;
    private final String message;
    private final LocalDateTime firstOccurrence;
    private LocalDateTime lastOccurrence;
    private long occurrenceCount;
    private boolean acknowledged;

    public AlertState(String alertId, AlertSeverity severity, String message) {
      this.alertId = alertId;
      this.severity = severity;
      this.message = message;
      this.firstOccurrence = LocalDateTime.now();
      this.lastOccurrence = LocalDateTime.now();
      this.occurrenceCount = 1;
      this.acknowledged = false;
    }

    // Getters
    public String getAlertId() {
      return alertId;
    }

    public AlertSeverity getSeverity() {
      return severity;
    }

    public String getMessage() {
      return message;
    }

    public LocalDateTime getFirstOccurrence() {
      return firstOccurrence;
    }

    public LocalDateTime getLastOccurrence() {
      return lastOccurrence;
    }

    public long getOccurrenceCount() {
      return occurrenceCount;
    }

    public boolean isAcknowledged() {
      return acknowledged;
    }

    public void updateOccurrence() {
      this.lastOccurrence = LocalDateTime.now();
      this.occurrenceCount++;
    }

    public void acknowledge() {
      this.acknowledged = true;
    }
  }

  /** Comprehensive monitoring and alerting with startup delay */
  @Scheduled(
      fixedRateString = "${storesight.monitoring.health-check-interval:PT6H}",
      initialDelayString = "${storesight.monitoring.alerting-startup-delay:PT18M}")
  public void comprehensiveMonitoring() {
    // Check if scheduled alerting is enabled
    if (!featureFlagService.isScheduledAlertingEnabled()) {
      logger.debug("Scheduled alerting is disabled via feature flag");
      return;
    }

    try {
      logger.debug("Starting comprehensive monitoring and alerting check");

      // Check system resources
      checkSystemResourceAlerts();

      // Check database performance
      checkDatabaseAlerts();

      // Check SSE service health
      checkSseServiceAlerts();

      // Check session management
      checkSessionManagementAlerts();

      // Check cache performance
      checkCachePerformanceAlerts();

      // Clean up resolved alerts
      cleanupResolvedAlerts();

      logger.debug("Comprehensive monitoring check completed");

    } catch (Exception e) {
      logger.error("Error during comprehensive monitoring: {}", e.getMessage(), e);
    }
  }

  /** Check system resource alerts */
  private void checkSystemResourceAlerts() {
    try {
      Map<String, Object> systemStats =
          systemResourceMonitoringService.getSystemResourceStatistics();

      // Check memory usage
      @SuppressWarnings("unchecked")
      Map<String, Object> memoryStats = (Map<String, Object>) systemStats.get("memory");
      if (memoryStats != null && memoryStats.containsKey("usagePercent")) {
        double memoryUsage = (Double) memoryStats.get("usagePercent");
        checkMemoryUsageAlert(memoryUsage);
      }

      // Check CPU usage
      @SuppressWarnings("unchecked")
      Map<String, Object> cpuStats = (Map<String, Object>) systemStats.get("cpu");
      if (cpuStats != null && cpuStats.containsKey("processCpuLoad")) {
        Object cpuLoadObj = cpuStats.get("processCpuLoad");
        if (cpuLoadObj instanceof Double) {
          double cpuUsage = (Double) cpuLoadObj;
          checkCpuUsageAlert(cpuUsage);
        }
      }

      // Check disk usage
      @SuppressWarnings("unchecked")
      Map<String, Object> diskStats = (Map<String, Object>) systemStats.get("disk");
      if (diskStats != null && diskStats.containsKey("usagePercent")) {
        double diskUsage = (Double) diskStats.get("usagePercent");
        checkDiskUsageAlert(diskUsage);
      }

    } catch (Exception e) {
      logger.warn("Error checking system resource alerts: {}", e.getMessage());
    }
  }

  /** Check database performance alerts */
  private void checkDatabaseAlerts() {
    try {
      Map<String, Object> dbStats = databaseMonitoringService.getDatabaseStatistics();

      // Check database error rate
      if (dbStats.containsKey("failureRate")) {
        double errorRate = (Double) dbStats.get("failureRate");
        checkDatabaseErrorRateAlert(errorRate);
      }

      // Check connection pool utilization
      @SuppressWarnings("unchecked")
      Map<String, Object> poolStats = (Map<String, Object>) dbStats.get("connectionPool");
      if (poolStats != null && poolStats.containsKey("utilizationPercentage")) {
        double utilization = (Double) poolStats.get("utilizationPercentage");
        checkConnectionPoolAlert(utilization);
      }

      // Check for connection pool exhaustion
      if (poolStats != null && poolStats.containsKey("threadsAwaitingConnection")) {
        int waitingThreads = (Integer) poolStats.get("threadsAwaitingConnection");
        if (waitingThreads > 0) {
          generateAlert(
              "database.connection.pool.exhaustion",
              AlertSeverity.CRITICAL,
              "Connection pool exhaustion detected: "
                  + waitingThreads
                  + " threads waiting for connections");
        } else {
          resolveAlert("database.connection.pool.exhaustion");
        }
      }

    } catch (Exception e) {
      logger.warn("Error checking database alerts: {}", e.getMessage());
    }
  }

  /** Check SSE service alerts */
  private void checkSseServiceAlerts() {
    try {
      Map<String, Object> sseStats = sseService.getStatistics();

      // Check SSE error rate
      long totalConnections = (Long) sseStats.get("totalConnections");
      long totalErrors = (Long) sseStats.get("totalErrors");

      if (totalConnections > 0) {
        double errorRate = (double) totalErrors / totalConnections * 100;
        checkSseErrorRateAlert(errorRate);
      }

      // Check SSE connection utilization
      int activeConnections = (Integer) sseStats.get("activeConnections");
      int maxConnections = (Integer) sseStats.get("maxGlobalConnections");
      double utilization = (double) activeConnections / maxConnections * 100;

      if (utilization > 90) {
        generateAlert(
            "sse.connection.high.utilization",
            AlertSeverity.WARNING,
            String.format(
                "High SSE connection utilization: %.1f%% (%d/%d)",
                utilization, activeConnections, maxConnections));
      } else {
        resolveAlert("sse.connection.high.utilization");
      }

    } catch (Exception e) {
      logger.warn("Error checking SSE service alerts: {}", e.getMessage());
    }
  }

  /** Check session management alerts */
  private void checkSessionManagementAlerts() {
    try {
      SessionSynchronizationService.SessionSynchronizationMetrics metrics =
          sessionSynchronizationService.getMetrics();

      // Check for stuck sessions
      long stuckSessions = metrics.getTotalStuckSessionsCleared();
      if (stuckSessions >= stuckSessionThreshold) {
        generateAlert(
            "session.stuck.detected",
            AlertSeverity.WARNING,
            "Stuck sessions detected and cleared: " + stuckSessions);
      } else {
        resolveAlert("session.stuck.detected");
      }

      // Check session lock failure rate
      long totalLocks = metrics.getTotalLockAcquisitions();
      long failedLocks = metrics.getTotalLockFailures();

      if (totalLocks > 0) {
        double failureRate = (double) failedLocks / totalLocks * 100;
        if (failureRate > 15) {
          generateAlert(
              "session.lock.high.failure.rate",
              AlertSeverity.WARNING,
              String.format(
                  "High session lock failure rate: %.2f%% (%d/%d)",
                  failureRate, failedLocks, totalLocks));
        } else {
          resolveAlert("session.lock.high.failure.rate");
        }
      }

      // Check Redis operation failures
      long redisFailures = metrics.getTotalRedisOperationFailures();
      if (redisFailures > 0) {
        generateAlert(
            "session.redis.operation.failures",
            AlertSeverity.WARNING,
            "Redis operation failures detected in session management: " + redisFailures);
      } else {
        resolveAlert("session.redis.operation.failures");
      }

    } catch (Exception e) {
      logger.warn("Error checking session management alerts: {}", e.getMessage());
    }
  }

  /** Check cache performance alerts */
  private void checkCachePerformanceAlerts() {
    try {
      Map<String, Object> cacheStats = dashboardCacheService.getCacheStatistics();

      // Check cache hit rate
      if (cacheStats.containsKey("hitRate")) {
        Double hitRate = (Double) cacheStats.get("hitRate");
        if (hitRate != null) {
          checkCacheHitRateAlert(hitRate);
        }
      }

      // Check cache eviction rate
      Long evictions = (Long) cacheStats.get("evictions");
      Long total = (Long) cacheStats.get("total");
      if (evictions != null && total != null && total > 0) {
        double evictionRate = (double) evictions / total * 100;
        if (evictionRate > 25) {
          generateAlert(
              "cache.high.eviction.rate",
              AlertSeverity.WARNING,
              String.format(
                  "High cache eviction rate: %.2f%% (%d/%d)", evictionRate, evictions, total));
        } else {
          resolveAlert("cache.high.eviction.rate");
        }
      }

    } catch (Exception e) {
      logger.warn("Error checking cache performance alerts: {}", e.getMessage());
    }
  }

  /** Check memory usage alert */
  private void checkMemoryUsageAlert(double memoryUsage) {
    if (memoryUsage > memoryCriticalThreshold) {
      generateAlert(
          "system.memory.critical",
          AlertSeverity.CRITICAL,
          String.format("Critical memory usage: %.2f%%", memoryUsage));
    } else if (memoryUsage > memoryWarningThreshold) {
      generateAlert(
          "system.memory.warning",
          AlertSeverity.WARNING,
          String.format("High memory usage: %.2f%%", memoryUsage));
    } else {
      resolveAlert("system.memory.critical");
      resolveAlert("system.memory.warning");
    }
  }

  /** Check CPU usage alert */
  private void checkCpuUsageAlert(double cpuUsage) {
    if (cpuUsage > cpuCriticalThreshold) {
      generateAlert(
          "system.cpu.critical",
          AlertSeverity.CRITICAL,
          String.format("Critical CPU usage: %.2f%%", cpuUsage));
    } else if (cpuUsage > cpuWarningThreshold) {
      generateAlert(
          "system.cpu.warning",
          AlertSeverity.WARNING,
          String.format("High CPU usage: %.2f%%", cpuUsage));
    } else {
      resolveAlert("system.cpu.critical");
      resolveAlert("system.cpu.warning");
    }
  }

  /** Check disk usage alert */
  private void checkDiskUsageAlert(double diskUsage) {
    if (diskUsage > diskCriticalThreshold) {
      generateAlert(
          "system.disk.critical",
          AlertSeverity.CRITICAL,
          String.format("Critical disk usage: %.2f%%", diskUsage));
    } else if (diskUsage > diskWarningThreshold) {
      generateAlert(
          "system.disk.warning",
          AlertSeverity.WARNING,
          String.format("High disk usage: %.2f%%", diskUsage));
    } else {
      resolveAlert("system.disk.critical");
      resolveAlert("system.disk.warning");
    }
  }

  /** Check database error rate alert */
  private void checkDatabaseErrorRateAlert(double errorRate) {
    if (errorRate > databaseErrorRateThreshold) {
      generateAlert(
          "database.high.error.rate",
          AlertSeverity.WARNING,
          String.format("High database error rate: %.2f%%", errorRate));
    } else {
      resolveAlert("database.high.error.rate");
    }
  }

  /** Check connection pool alert */
  private void checkConnectionPoolAlert(double utilization) {
    if (utilization > connectionPoolCriticalThreshold) {
      generateAlert(
          "database.connection.pool.critical",
          AlertSeverity.CRITICAL,
          String.format("Critical connection pool utilization: %.2f%%", utilization));
    } else if (utilization > connectionPoolWarningThreshold) {
      generateAlert(
          "database.connection.pool.warning",
          AlertSeverity.WARNING,
          String.format("High connection pool utilization: %.2f%%", utilization));
    } else {
      resolveAlert("database.connection.pool.critical");
      resolveAlert("database.connection.pool.warning");
    }
  }

  /** Check SSE error rate alert */
  private void checkSseErrorRateAlert(double errorRate) {
    if (errorRate > sseErrorRateThreshold) {
      generateAlert(
          "sse.high.error.rate",
          AlertSeverity.WARNING,
          String.format("High SSE error rate: %.2f%%", errorRate));
    } else {
      resolveAlert("sse.high.error.rate");
    }
  }

  /** Check cache hit rate alert */
  private void checkCacheHitRateAlert(double hitRate) {
    if (hitRate < cacheHitRateThreshold) {
      generateAlert(
          "cache.low.hit.rate",
          AlertSeverity.WARNING,
          String.format("Low cache hit rate: %.2f%%", hitRate));
    } else {
      resolveAlert("cache.low.hit.rate");
    }
  }

  /** Generate or update an alert */
  private void generateAlert(String alertId, AlertSeverity severity, String message) {
    AlertState existingAlert = activeAlerts.get(alertId);

    if (existingAlert != null) {
      // Update existing alert
      existingAlert.updateOccurrence();
      logger.debug(
          "Updated existing alert: {} (occurrence: {})",
          alertId,
          existingAlert.getOccurrenceCount());
    } else {
      // Create new alert
      AlertState newAlert = new AlertState(alertId, severity, message);
      activeAlerts.put(alertId, newAlert);

      totalAlertsGenerated.incrementAndGet();
      if (severity == AlertSeverity.CRITICAL) {
        criticalAlertsGenerated.incrementAndGet();
        logger.error("CRITICAL ALERT: {} - {}", alertId, message);
      } else if (severity == AlertSeverity.WARNING) {
        warningAlertsGenerated.incrementAndGet();
        logger.warn("WARNING ALERT: {} - {}", alertId, message);
      } else {
        logger.info("INFO ALERT: {} - {}", alertId, message);
      }
    }
  }

  /** Resolve an alert */
  private void resolveAlert(String alertId) {
    AlertState alert = activeAlerts.remove(alertId);
    if (alert != null) {
      logger.info("RESOLVED ALERT: {} - {}", alertId, alert.getMessage());
    }
  }

  /** Clean up resolved alerts */
  private void cleanupResolvedAlerts() {
    // Remove alerts that haven't been updated in the last 10 minutes
    LocalDateTime cutoff = LocalDateTime.now().minusMinutes(10);
    activeAlerts
        .entrySet()
        .removeIf(entry -> entry.getValue().getLastOccurrence().isBefore(cutoff));
  }

  /** Get current alert statistics */
  public Map<String, Object> getAlertStatistics() {
    Map<String, Object> stats = new HashMap<>();

    stats.put("totalAlertsGenerated", totalAlertsGenerated.get());
    stats.put("criticalAlertsGenerated", criticalAlertsGenerated.get());
    stats.put("warningAlertsGenerated", warningAlertsGenerated.get());
    stats.put("activeAlerts", activeAlerts.size());

    // Count alerts by severity
    long activeCritical =
        activeAlerts.values().stream()
            .mapToLong(alert -> alert.getSeverity() == AlertSeverity.CRITICAL ? 1 : 0)
            .sum();
    long activeWarning =
        activeAlerts.values().stream()
            .mapToLong(alert -> alert.getSeverity() == AlertSeverity.WARNING ? 1 : 0)
            .sum();

    stats.put("activeCriticalAlerts", activeCritical);
    stats.put("activeWarningAlerts", activeWarning);

    // Alert details
    Map<String, Object> alertDetails = new HashMap<>();
    activeAlerts.forEach(
        (id, alert) -> {
          Map<String, Object> alertInfo = new HashMap<>();
          alertInfo.put("severity", alert.getSeverity().toString());
          alertInfo.put("message", alert.getMessage());
          alertInfo.put("firstOccurrence", alert.getFirstOccurrence());
          alertInfo.put("lastOccurrence", alert.getLastOccurrence());
          alertInfo.put("occurrenceCount", alert.getOccurrenceCount());
          alertInfo.put("acknowledged", alert.isAcknowledged());
          alertDetails.put(id, alertInfo);
        });
    stats.put("alertDetails", alertDetails);

    stats.put("timestamp", LocalDateTime.now());
    return stats;
  }

  /** Acknowledge an alert */
  public boolean acknowledgeAlert(String alertId) {
    AlertState alert = activeAlerts.get(alertId);
    if (alert != null) {
      alert.acknowledge();
      logger.info("Alert acknowledged: {}", alertId);
      return true;
    }
    return false;
  }

  /** Get alert configuration */
  public Map<String, Object> getAlertConfiguration() {
    Map<String, Object> config = new HashMap<>();

    Map<String, Object> thresholds = new HashMap<>();
    thresholds.put("memoryWarning", memoryWarningThreshold);
    thresholds.put("memoryCritical", memoryCriticalThreshold);
    thresholds.put("cpuWarning", cpuWarningThreshold);
    thresholds.put("cpuCritical", cpuCriticalThreshold);
    thresholds.put("diskWarning", diskWarningThreshold);
    thresholds.put("diskCritical", diskCriticalThreshold);
    thresholds.put("connectionPoolWarning", connectionPoolWarningThreshold);
    thresholds.put("connectionPoolCritical", connectionPoolCriticalThreshold);
    thresholds.put("stuckSession", stuckSessionThreshold);
    thresholds.put("sseErrorRate", sseErrorRateThreshold);
    thresholds.put("databaseErrorRate", databaseErrorRateThreshold);
    thresholds.put("cacheHitRate", cacheHitRateThreshold);

    config.put("thresholds", thresholds);
    config.put("timestamp", LocalDateTime.now());

    return config;
  }

  /** Reset alert statistics */
  public void resetAlertStatistics() {
    totalAlertsGenerated.set(0);
    criticalAlertsGenerated.set(0);
    warningAlertsGenerated.set(0);
    activeAlerts.clear();
    logger.info("Alert statistics reset");
  }
}
