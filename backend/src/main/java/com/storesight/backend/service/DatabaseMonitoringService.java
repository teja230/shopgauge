package com.storesight.backend.service;

import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;

@Service
public class DatabaseMonitoringService {

  private static final Logger logger = LoggerFactory.getLogger(DatabaseMonitoringService.class);

  private final DataSource dataSource;
  private final ShopService shopService;
  private final RedisTemplate<String, String> redisTemplate;
  private final NotificationService notificationService;

  private long lastConnectionFailureTime = 0;
  private int consecutiveFailures = 0;

  // Circuit breaker state
  private boolean circuitBreakerOpen = false;
  private long circuitBreakerOpenTime = 0;
  private static final long CIRCUIT_BREAKER_TIMEOUT = 300000; // 5 minutes

  // Enhanced monitoring thresholds
  private static final double HIGH_USAGE_THRESHOLD = 0.7; // 70% pool usage
  private static final double CRITICAL_USAGE_THRESHOLD = 0.85; // 85% pool usage
  private static final double EMERGENCY_USAGE_THRESHOLD =
      0.95; // 95% pool usage - emergency cleanup
  private static final int MAX_CONSECUTIVE_FAILURES = 2; // Reduced from 3
  private static final long WARNING_DURATION_MS = 30000; // 30 seconds
  private static final long CONNECTION_LEAK_THRESHOLD = 15000; // 15 seconds for leak detection

  @Value("${health.database.monitoring.interval:120000}")
  private long monitoringInterval;

  @Value("${health.database.connection.timeout:5000}")
  private int connectionTimeout;

  @Autowired
  public DatabaseMonitoringService(
      DataSource dataSource,
      ShopService shopService,
      RedisTemplate<String, String> redisTemplate,
      NotificationService notificationService) {
    this.dataSource = dataSource;
    this.shopService = shopService;
    this.redisTemplate = redisTemplate;
    this.notificationService = notificationService;
  }

  @Scheduled(fixedRateString = "${health.database.monitoring.interval:120000}")
  public void monitorDatabaseHealth() {
    // Circuit breaker check
    if (circuitBreakerOpen) {
      if (System.currentTimeMillis() - circuitBreakerOpenTime > CIRCUIT_BREAKER_TIMEOUT) {
        logger.info("Circuit breaker timeout reached, attempting to close circuit breaker");
        circuitBreakerOpen = false;
        circuitBreakerOpenTime = 0;
      } else {
        logger.debug("Circuit breaker is open, skipping database health check");
        return;
      }
    }

    if (dataSource instanceof HikariDataSource) {
      monitorHikariCPHealth((HikariDataSource) dataSource);
    } else {
      monitorBasicConnectionHealth();
    }
  }

  private void monitorHikariCPHealth(HikariDataSource hikariDataSource) {
    try {
      Map<String, Object> metrics = new HashMap<>();

      // Get HikariCP metrics WITHOUT getting a connection first
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

      // CRITICAL: Check for emergency cleanup before attempting connection test
      if (activeUsageRatio >= EMERGENCY_USAGE_THRESHOLD) {
        logger.error(
            "EMERGENCY: Connection pool usage at {}% - Triggering emergency cleanup",
            Math.round(activeUsageRatio * 100));
        performEmergencyCleanup();
        // Skip connection test to avoid further strain
        metrics.put("connectionValid", false);
        metrics.put("emergencyCleanupTriggered", true);
        return;
      }

      // Only test connection if we have idle connections and usage is below emergency threshold
      if (idleConnections > 0 && activeUsageRatio < EMERGENCY_USAGE_THRESHOLD) {
        try (Connection connection = hikariDataSource.getConnection()) {
          boolean isValid = connection.isValid(connectionTimeout / 1000); // Use configurable timeout
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
      } else {
        logger.warn("No idle connections available for health check - skipping connection test");
        metrics.put("connectionValid", false);
        metrics.put("skippedReason", "No idle connections");
      }
    } catch (Exception e) {
      logger.error("Database monitoring failed", e);
    }
  }

  private void monitorBasicConnectionHealth() {
    try (Connection connection = dataSource.getConnection()) {
      boolean isValid = connection.isValid(connectionTimeout / 1000); // Use configurable timeout
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

  /**
   * Enhanced emergency connection cleanup method to handle connection leaks comprehensively. This
   * performs multiple cleanup strategies when connection pool is exhausted.
   */
  public void performEmergencyCleanup() {
    if (dataSource instanceof HikariDataSource) {
      HikariDataSource hikariDataSource = (HikariDataSource) dataSource;

      try {
        logger.warn(
            "EMERGENCY: Performing comprehensive connection pool cleanup due to leak detection");

        // Get metrics before cleanup
        int activeConnectionsBefore = hikariDataSource.getHikariPoolMXBean().getActiveConnections();
        int idleConnectionsBefore = hikariDataSource.getHikariPoolMXBean().getIdleConnections();
        int threadsAwaitingBefore =
            hikariDataSource.getHikariPoolMXBean().getThreadsAwaitingConnection();

        // STEP 1: Traditional soft eviction (for any idle connections)
        logger.info("EMERGENCY CLEANUP Step 1: Soft evicting idle connections");
        hikariDataSource.getHikariPoolMXBean().softEvictConnections();
        Thread.sleep(1000);

        // STEP 2: Trigger aggressive session cleanup
        logger.info("EMERGENCY CLEANUP Step 2: Triggering aggressive session cleanup");
        triggerEmergencySessionCleanup();
        Thread.sleep(2000);

        // STEP 3: Clear Redis cache to reduce load
        logger.info("EMERGENCY CLEANUP Step 3: Clearing Redis cache");
        triggerEmergencyRedisCleanup();
        Thread.sleep(1000);

        // STEP 4: Suspend and resume pool to force connection refresh
        logger.info("EMERGENCY CLEANUP Step 4: Suspending and resuming connection pool");
        try {
          // Note: HikariCP doesn't support suspend/resume, but we can try to force refresh
          hikariDataSource.getHikariPoolMXBean().softEvictConnections();
          Thread.sleep(1000);
          // Force pool to create new connections by evicting again
          hikariDataSource.getHikariPoolMXBean().softEvictConnections();
        } catch (Exception e) {
          logger.warn("Pool suspend/resume failed: {}", e.getMessage());
        }

        // STEP 5: Force garbage collection to help with resource cleanup
        logger.info("EMERGENCY CLEANUP Step 5: Forcing garbage collection");
        System.gc();
        Thread.sleep(1000);

        // Get metrics after cleanup
        int activeConnectionsAfter = hikariDataSource.getHikariPoolMXBean().getActiveConnections();
        int idleConnectionsAfter = hikariDataSource.getHikariPoolMXBean().getIdleConnections();
        int threadsAwaitingAfter =
            hikariDataSource.getHikariPoolMXBean().getThreadsAwaitingConnection();

        // Calculate improvement
        int activeConnectionsFreed = activeConnectionsBefore - activeConnectionsAfter;
        int threadsAwaitingReduced = threadsAwaitingBefore - threadsAwaitingAfter;

        logger.warn(
            "EMERGENCY CLEANUP COMPLETED - Before: active={}, idle={}, waiting={} | After: active={}, idle={}, waiting={} | Freed: {} active connections, {} waiting threads",
            activeConnectionsBefore,
            idleConnectionsBefore,
            threadsAwaitingBefore,
            activeConnectionsAfter,
            idleConnectionsAfter,
            threadsAwaitingAfter,
            activeConnectionsFreed,
            threadsAwaitingReduced);

        // If cleanup was ineffective, log recommendations
        if (activeConnectionsFreed < 2 && threadsAwaitingAfter > 0) {
          logger.error(
              "EMERGENCY CLEANUP INEFFECTIVE: Only {} connections freed, {} threads still waiting. "
                  + "Consider: 1) Application restart, 2) Database connection review, 3) Check for connection leaks in application code",
              activeConnectionsFreed,
              threadsAwaitingAfter);
        }

      } catch (Exception e) {
        logger.error("Emergency connection cleanup failed", e);
      }
    }
  }

  /** Trigger emergency session cleanup to free up database connections */
  private void triggerEmergencySessionCleanup() {
    try {
      // This would need to be injected or accessed via ApplicationContext
      // For now, we'll use a static approach or service locator pattern

      // Trigger cleanup of expired sessions
      logger.info("Triggering emergency expired session cleanup");
      shopService.cleanupExpiredSessions();

      // Trigger cleanup of stale sessions (sessions not accessed for > 30 minutes)
      logger.info("Triggering emergency stale session cleanup");
      shopService.cleanupStaleSessions();

    } catch (Exception e) {
      logger.error("Emergency session cleanup failed: {}", e.getMessage());
    }
  }

  /** Trigger emergency Redis cache cleanup to reduce database load */
  private void triggerEmergencyRedisCleanup() {
    try {
      logger.info("Triggering emergency Redis cache cleanup");

      // Clear all session-related Redis keys
      var sessionKeys = redisTemplate.keys("shop_token:*");
      if (sessionKeys != null && !sessionKeys.isEmpty()) {
        redisTemplate.delete(sessionKeys);
        logger.info("Cleared {} session token keys from Redis", sessionKeys.size());
      }

      // Clear analytics cache
      var analyticsKeys = redisTemplate.keys("analytics_cache:*");
      if (analyticsKeys != null && !analyticsKeys.isEmpty()) {
        redisTemplate.delete(analyticsKeys);
        logger.info("Cleared {} analytics cache keys from Redis", analyticsKeys.size());
      }

      // Clear dashboard cache
      var dashboardKeys = redisTemplate.keys("dashboard_cache:*");
      if (dashboardKeys != null && !dashboardKeys.isEmpty()) {
        redisTemplate.delete(dashboardKeys);
        logger.info("Cleared {} dashboard cache keys from Redis", dashboardKeys.size());
      }

      // Clear notification cache
      var notificationKeys = redisTemplate.keys("notification:*");
      if (notificationKeys != null && !notificationKeys.isEmpty()) {
        redisTemplate.delete(notificationKeys);
        logger.info("Cleared {} notification cache keys from Redis", notificationKeys.size());
      }

      logger.info("Emergency Redis cache cleanup completed");

    } catch (Exception e) {
      logger.error("Emergency Redis cleanup failed: {}", e.getMessage());
    }
  }

  /** Check if emergency cleanup is needed based on connection metrics. */
  public boolean isEmergencyCleanupNeeded() {
    if (dataSource instanceof HikariDataSource) {
      HikariDataSource hikariDataSource = (HikariDataSource) dataSource;
      int activeConnections = hikariDataSource.getHikariPoolMXBean().getActiveConnections();
      int maxPoolSize = hikariDataSource.getMaximumPoolSize();
      double usageRatio = (double) activeConnections / maxPoolSize;

      return usageRatio >= EMERGENCY_USAGE_THRESHOLD;
    }
    return false;
  }
}
