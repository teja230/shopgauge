package com.storesight.backend.service;

import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class DatabaseMonitoringService {

  private static final Logger logger = LoggerFactory.getLogger(DatabaseMonitoringService.class);

  private final DataSource dataSource;
  private long lastConnectionFailureTime = 0;
  private int consecutiveFailures = 0;

  // Enhanced monitoring thresholds
  private static final double HIGH_USAGE_THRESHOLD = 0.8; // 80% pool usage
  private static final double CRITICAL_USAGE_THRESHOLD = 0.95; // 95% pool usage
  private static final int MAX_CONSECUTIVE_FAILURES = 2; // Reduced from 3
  private static final long WARNING_DURATION_MS = 30000; // 30 seconds

  public DatabaseMonitoringService(DataSource dataSource) {
    this.dataSource = dataSource;
  }

  @Scheduled(fixedRate = 30000) // Run every 30 seconds (increased from 1 minute)
  public void monitorDatabaseHealth() {
    if (dataSource instanceof HikariDataSource) {
      monitorHikariCPHealth((HikariDataSource) dataSource);
    } else {
      monitorBasicConnectionHealth();
    }
  }

  private void monitorHikariCPHealth(HikariDataSource hikariDataSource) {
    try {
      Map<String, Object> metrics = new HashMap<>();

      // Get HikariCP metrics
      int activeConnections = hikariDataSource.getHikariPoolMXBean().getActiveConnections();
      int idleConnections = hikariDataSource.getHikariPoolMXBean().getIdleConnections();
      int totalConnections = hikariDataSource.getHikariPoolMXBean().getTotalConnections();
      int threadsAwaiting = hikariDataSource.getHikariPoolMXBean().getThreadsAwaitingConnection();
      int maxPoolSize = hikariDataSource.getMaximumPoolSize();
      int minimumIdle = hikariDataSource.getMinimumIdle();

      metrics.put("activeConnections", activeConnections);
      metrics.put("idleConnections", idleConnections);
      metrics.put("totalConnections", totalConnections);
      metrics.put("threadsAwaitingConnection", threadsAwaiting);
      metrics.put("maxPoolSize", maxPoolSize);
      metrics.put("minimumIdle", minimumIdle);

      // Calculate usage ratios for better monitoring
      double activeUsageRatio = (double) activeConnections / maxPoolSize;
      double totalUsageRatio = (double) totalConnections / maxPoolSize;

      metrics.put("activeUsageRatio", Math.round(activeUsageRatio * 100.0) / 100.0);
      metrics.put("totalUsageRatio", Math.round(totalUsageRatio * 100.0) / 100.0);

      // Test actual connection with timeout
      try (Connection connection = hikariDataSource.getConnection()) {
        boolean isValid = connection.isValid(3); // Reduced timeout to 3 seconds
        metrics.put("connectionValid", isValid);

        if (isValid) {
          consecutiveFailures = 0;
          if (lastConnectionFailureTime > 0) {
            logger.info("Database connection recovered after failures");
            lastConnectionFailureTime = 0;
          }

          // Enhanced monitoring with early warnings
          if (threadsAwaiting > 0) {
            logger.warn(
                "ALERT: {} threads waiting for database connections - Pool pressure detected: {}",
                threadsAwaiting,
                metrics);
          } else if (activeUsageRatio >= CRITICAL_USAGE_THRESHOLD) {
            logger.error(
                "CRITICAL: Database pool usage at {}% - Immediate action required: {}",
                Math.round(activeUsageRatio * 100), metrics);
          } else if (activeUsageRatio >= HIGH_USAGE_THRESHOLD) {
            logger.warn(
                "WARNING: High database pool usage at {}% - Monitor closely: {}",
                Math.round(activeUsageRatio * 100), metrics);
          } else if (logger.isDebugEnabled()) {
            logger.debug(
                "Database health check passed - Usage: {}%: {}",
                Math.round(activeUsageRatio * 100), metrics);
          }

          // Check for pool growth issues
          if (totalConnections < minimumIdle) {
            logger.warn(
                "WARNING: Total connections ({}) below minimum idle ({})",
                totalConnections,
                minimumIdle);
          }

        } else {
          handleConnectionFailure("Connection validation failed", metrics);
        }
      } catch (SQLException e) {
        handleConnectionFailure("Connection test failed: " + e.getMessage(), metrics);
      }
    } catch (Exception e) {
      logger.error("Database monitoring failed", e);
    }
  }

  private void monitorBasicConnectionHealth() {
    try (Connection connection = dataSource.getConnection()) {
      boolean isValid = connection.isValid(3); // Reduced timeout
      if (isValid) {
        consecutiveFailures = 0;
        if (lastConnectionFailureTime > 0) {
          logger.info("Database connection recovered");
          lastConnectionFailureTime = 0;
        }
      } else {
        handleConnectionFailure("Connection validation failed", Map.of("connectionValid", false));
      }
    } catch (SQLException e) {
      handleConnectionFailure(
          "Connection test failed: " + e.getMessage(), Map.of("error", e.getMessage()));
    }
  }

  private void handleConnectionFailure(String error, Map<String, Object> metrics) {
    consecutiveFailures++;
    long currentTime = System.currentTimeMillis();

    if (lastConnectionFailureTime == 0) {
      lastConnectionFailureTime = currentTime;
    }

    long failureDuration = currentTime - lastConnectionFailureTime;

    logger.error(
        "Database connection failure #{} (duration: {}ms): {} - Metrics: {}",
        consecutiveFailures,
        failureDuration,
        error,
        metrics);

    // Enhanced alerting with earlier warnings
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      logger.error(
          "CRITICAL: Database connection has failed {} consecutive times over {}ms - IMMEDIATE ACTION REQUIRED",
          consecutiveFailures,
          failureDuration);
    } else if (failureDuration > WARNING_DURATION_MS) {
      logger.warn(
          "WARNING: Database connection issues for {}ms - Monitor closely", failureDuration);
    }
  }

  public Map<String, Object> getDatabaseMetrics() {
    Map<String, Object> metrics = new HashMap<>();

    if (dataSource instanceof HikariDataSource) {
      HikariDataSource hikariDataSource = (HikariDataSource) dataSource;

      int activeConnections = hikariDataSource.getHikariPoolMXBean().getActiveConnections();
      int maxPoolSize = hikariDataSource.getMaximumPoolSize();

      metrics.put("activeConnections", activeConnections);
      metrics.put("idleConnections", hikariDataSource.getHikariPoolMXBean().getIdleConnections());
      metrics.put("totalConnections", hikariDataSource.getHikariPoolMXBean().getTotalConnections());
      metrics.put(
          "threadsAwaitingConnection",
          hikariDataSource.getHikariPoolMXBean().getThreadsAwaitingConnection());
      metrics.put("maxPoolSize", maxPoolSize);
      metrics.put("minimumIdle", hikariDataSource.getMinimumIdle());

      // Add calculated ratios
      metrics.put(
          "activeUsageRatio",
          Math.round(((double) activeConnections / maxPoolSize) * 100.0) / 100.0);
      metrics.put(
          "activeUsagePercent", Math.round(((double) activeConnections / maxPoolSize) * 100));
    }

    metrics.put("consecutiveFailures", consecutiveFailures);
    metrics.put("lastFailureTime", lastConnectionFailureTime);
    metrics.put("healthStatus", consecutiveFailures == 0 ? "HEALTHY" : "DEGRADED");

    return metrics;
  }

  /** Get connection pool status for health checks */
  public String getPoolStatus() {
    if (dataSource instanceof HikariDataSource) {
      HikariDataSource hikariDataSource = (HikariDataSource) dataSource;
      int activeConnections = hikariDataSource.getHikariPoolMXBean().getActiveConnections();
      int maxPoolSize = hikariDataSource.getMaximumPoolSize();
      double usageRatio = (double) activeConnections / maxPoolSize;

      if (usageRatio >= CRITICAL_USAGE_THRESHOLD) {
        return "CRITICAL";
      } else if (usageRatio >= HIGH_USAGE_THRESHOLD) {
        return "WARNING";
      } else {
        return "HEALTHY";
      }
    }
    return "UNKNOWN";
  }
}
