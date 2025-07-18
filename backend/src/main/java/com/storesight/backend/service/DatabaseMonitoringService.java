package com.storesight.backend.service;

import io.micrometer.core.instrument.Timer;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Database performance monitoring service
 *
 * <p>This service provides comprehensive database monitoring including: - Query performance
 * tracking - Connection pool monitoring - Database health checks - Slow query detection -
 * Connection leak detection
 */
@Service
public class DatabaseMonitoringService {

  private static final Logger logger = LoggerFactory.getLogger(DatabaseMonitoringService.class);

  @Autowired private DataSource dataSource;
  @Autowired private MetricsCollectionService metricsCollectionService;

  // Performance thresholds
  private static final long SLOW_QUERY_THRESHOLD_MS = 1000; // 1 second
  private static final long VERY_SLOW_QUERY_THRESHOLD_MS = 5000; // 5 seconds
  private static final int CONNECTION_POOL_WARNING_THRESHOLD = 80; // 80% utilization

  // Monitoring metrics
  private final AtomicLong totalQueries = new AtomicLong(0);
  private final AtomicLong slowQueries = new AtomicLong(0);
  private final AtomicLong verySlowQueries = new AtomicLong(0);
  private final AtomicLong failedQueries = new AtomicLong(0);
  private final AtomicLong connectionLeaks = new AtomicLong(0);

  /**
   * Execute a monitored database query
   *
   * @param queryName Name/description of the query for monitoring
   * @param queryExecutor Function that executes the query
   * @return Query result
   */
  public <T> T executeMonitoredQuery(String queryName, QueryExecutor<T> queryExecutor) {
    Timer.Sample sample = metricsCollectionService.startDatabaseQuery();
    long startTime = System.currentTimeMillis();

    try {
      totalQueries.incrementAndGet();
      metricsCollectionService.recordDatabaseQuery();

      T result = queryExecutor.execute();

      long duration = System.currentTimeMillis() - startTime;

      // Track slow queries
      if (duration > VERY_SLOW_QUERY_THRESHOLD_MS) {
        verySlowQueries.incrementAndGet();
        logger.warn("Very slow query detected: {} took {}ms", queryName, duration);
      } else if (duration > SLOW_QUERY_THRESHOLD_MS) {
        slowQueries.incrementAndGet();
        logger.info("Slow query detected: {} took {}ms", queryName, duration);
      }

      logger.debug("Query {} completed in {}ms", queryName, duration);
      return result;

    } catch (Exception e) {
      failedQueries.incrementAndGet();
      metricsCollectionService.recordDatabaseError();
      logger.error("Query {} failed: {}", queryName, e.getMessage());
      throw new RuntimeException("Database query failed: " + queryName, e);
    } finally {
      metricsCollectionService.recordDatabaseQueryDuration(sample);
    }
  }

  /**
   * Execute a monitored database connection operation
   *
   * @param operationName Name/description of the operation
   * @param connectionExecutor Function that uses the connection
   * @return Operation result
   */
  public <T> T executeWithMonitoredConnection(
      String operationName, ConnectionExecutor<T> connectionExecutor) {
    long startTime = System.currentTimeMillis();
    Connection connection = null;

    try {
      connection = dataSource.getConnection();

      if (connection == null) {
        metricsCollectionService.recordConnectionPoolExhaustion();
        throw new RuntimeException("Failed to obtain database connection");
      }

      T result = connectionExecutor.execute(connection);

      long duration = System.currentTimeMillis() - startTime;
      logger.debug("Database operation {} completed in {}ms", operationName, duration);

      return result;

    } catch (Exception e) {
      failedQueries.incrementAndGet();
      metricsCollectionService.recordDatabaseError();
      logger.error("Database operation {} failed: {}", operationName, e.getMessage());
      throw new RuntimeException("Database operation failed: " + operationName, e);
    } finally {
      if (connection != null) {
        try {
          connection.close();
        } catch (Exception e) {
          connectionLeaks.incrementAndGet();
          logger.warn(
              "Failed to close database connection for {}: {}", operationName, e.getMessage());
        }
      }
    }
  }

  /** Get comprehensive database performance statistics */
  public Map<String, Object> getDatabaseStatistics() {
    Map<String, Object> stats = new HashMap<>();

    // Query statistics
    long total = totalQueries.get();
    stats.put("totalQueries", total);
    stats.put("slowQueries", slowQueries.get());
    stats.put("verySlowQueries", verySlowQueries.get());
    stats.put("failedQueries", failedQueries.get());
    stats.put("connectionLeaks", connectionLeaks.get());

    // Calculate percentages
    if (total > 0) {
      stats.put("slowQueryPercentage", (double) slowQueries.get() / total * 100);
      stats.put("verySlowQueryPercentage", (double) verySlowQueries.get() / total * 100);
      stats.put("failureRate", (double) failedQueries.get() / total * 100);
    } else {
      stats.put("slowQueryPercentage", 0.0);
      stats.put("verySlowQueryPercentage", 0.0);
      stats.put("failureRate", 0.0);
    }

    // Connection pool statistics
    Map<String, Object> connectionPoolStats = getConnectionPoolStatistics();
    stats.put("connectionPool", connectionPoolStats);

    stats.put("timestamp", LocalDateTime.now());
    return stats;
  }

  /** Get connection pool statistics */
  public Map<String, Object> getConnectionPoolStatistics() {
    Map<String, Object> stats = new HashMap<>();

    try {
      // Try to get HikariCP statistics if available
      if (dataSource.getClass().getName().contains("HikariDataSource")) {
        // Use reflection to get HikariCP pool statistics
        try {
          Object hikariPool =
              dataSource.getClass().getMethod("getHikariPoolMXBean").invoke(dataSource);

          if (hikariPool != null) {
            int activeConnections =
                (Integer)
                    hikariPool.getClass().getMethod("getActiveConnections").invoke(hikariPool);
            int idleConnections =
                (Integer) hikariPool.getClass().getMethod("getIdleConnections").invoke(hikariPool);
            int totalConnections =
                (Integer) hikariPool.getClass().getMethod("getTotalConnections").invoke(hikariPool);
            int threadsAwaitingConnection =
                (Integer)
                    hikariPool
                        .getClass()
                        .getMethod("getThreadsAwaitingConnection")
                        .invoke(hikariPool);

            // Get maximum pool size from HikariCP configuration
            int maximumPoolSize = 20; // Default fallback
            try {
              Object hikariConfig =
                  dataSource.getClass().getMethod("getHikariConfigMXBean").invoke(dataSource);
              if (hikariConfig != null) {
                maximumPoolSize =
                    (Integer)
                        hikariConfig
                            .getClass()
                            .getMethod("getMaximumPoolSize")
                            .invoke(hikariConfig);
              }
            } catch (Exception configException) {
              logger.debug(
                  "Could not get HikariCP configuration, using default maximum pool size: {}",
                  configException.getMessage());
            }

            stats.put("activeConnections", activeConnections);
            stats.put("idleConnections", idleConnections);
            stats.put("totalConnections", totalConnections);
            stats.put("maximumPoolSize", maximumPoolSize);
            stats.put("threadsAwaitingConnection", threadsAwaitingConnection);

            // Calculate utilization based on maximum pool size, not current total connections
            // This prevents false emergency cleanup triggers when idle connections are closed
            double utilizationPercentage = (double) activeConnections / maximumPoolSize * 100;
            double currentPoolUtilization =
                totalConnections > 0 ? (double) activeConnections / totalConnections * 100 : 0;

            stats.put("utilizationPercentage", utilizationPercentage);
            stats.put("currentPoolUtilization", currentPoolUtilization);

            // Use the correct utilization percentage for warnings
            if (utilizationPercentage > CONNECTION_POOL_WARNING_THRESHOLD) {
              stats.put(
                  "warning",
                  "High connection pool utilization: "
                      + String.format("%.1f%%", utilizationPercentage));
            }

            // Add pool health status
            String poolStatus = "HEALTHY";
            if (utilizationPercentage > 90) {
              poolStatus = "CRITICAL";
            } else if (utilizationPercentage > CONNECTION_POOL_WARNING_THRESHOLD) {
              poolStatus = "WARNING";
            }
            stats.put("poolStatus", poolStatus);

            // Log detailed connection info for debugging
            logger.debug(
                "Connection pool stats - Active: {}, Idle: {}, Total: {}, Max: {}, Utilization: {:.1f}%",
                activeConnections,
                idleConnections,
                totalConnections,
                maximumPoolSize,
                utilizationPercentage);

            if (threadsAwaitingConnection > 0) {
              stats.put("warning", "Threads waiting for connections: " + threadsAwaitingConnection);
              metricsCollectionService.recordConnectionPoolExhaustion();
            }
          }
        } catch (Exception e) {
          logger.debug("Could not get HikariCP statistics: {}", e.getMessage());
          stats.put("error", "HikariCP statistics not available");
        }
      } else {
        stats.put("info", "Connection pool statistics not available for this DataSource type");
      }

      // Basic connection test
      try (Connection connection = dataSource.getConnection()) {
        boolean isValid = connection.isValid(5);
        stats.put("connectionTest", isValid ? "PASS" : "FAIL");

        if (!isValid) {
          stats.put("error", "Database connection validation failed");
        }
      }

    } catch (Exception e) {
      stats.put("error", "Failed to get connection pool statistics: " + e.getMessage());
      logger.warn("Failed to get connection pool statistics: {}", e.getMessage());
    }

    return stats;
  }

  /** Perform database health check */
  public Map<String, Object> performHealthCheck() {
    Map<String, Object> healthCheck = new HashMap<>();
    long startTime = System.currentTimeMillis();

    try {
      // Test basic connectivity
      try (Connection connection = dataSource.getConnection()) {
        boolean isValid = connection.isValid(5);
        long responseTime = System.currentTimeMillis() - startTime;

        healthCheck.put("connectivity", isValid ? "HEALTHY" : "UNHEALTHY");
        healthCheck.put("responseTimeMs", responseTime);

        if (responseTime > 1000) {
          healthCheck.put("warning", "Slow database response: " + responseTime + "ms");
        }

        // Test a simple query
        if (isValid) {
          try (PreparedStatement stmt = connection.prepareStatement("SELECT 1");
              ResultSet rs = stmt.executeQuery()) {

            boolean queryWorked = rs.next() && rs.getInt(1) == 1;
            healthCheck.put("queryTest", queryWorked ? "PASS" : "FAIL");

            long totalResponseTime = System.currentTimeMillis() - startTime;
            healthCheck.put("totalResponseTimeMs", totalResponseTime);
          }
        }
      }

      // Check performance metrics
      Map<String, Object> performanceHealth = new HashMap<>();

      long total = totalQueries.get();
      if (total > 0) {
        double failureRate = (double) failedQueries.get() / total * 100;
        double slowQueryRate = (double) slowQueries.get() / total * 100;

        performanceHealth.put("failureRate", failureRate);
        performanceHealth.put("slowQueryRate", slowQueryRate);

        // Health assessment
        String performanceStatus = "HEALTHY";
        if (failureRate > 5) {
          performanceStatus = "CRITICAL";
        } else if (failureRate > 1 || slowQueryRate > 20) {
          performanceStatus = "WARNING";
        }

        performanceHealth.put("status", performanceStatus);
      } else {
        performanceHealth.put("status", "NO_DATA");
      }

      healthCheck.put("performance", performanceHealth);
      healthCheck.put("overallStatus", "HEALTHY");

    } catch (Exception e) {
      healthCheck.put("connectivity", "UNHEALTHY");
      healthCheck.put("error", e.getMessage());
      healthCheck.put("overallStatus", "UNHEALTHY");
      healthCheck.put("responseTimeMs", System.currentTimeMillis() - startTime);

      logger.error("Database health check failed: {}", e.getMessage());
    }

    healthCheck.put("timestamp", LocalDateTime.now());
    return healthCheck;
  }

  /** Scheduled monitoring task to check database health */
  @Scheduled(fixedRate = 300000) // Every 5 minutes
  public void scheduledHealthCheck() {
    try {
      Map<String, Object> healthCheck = performHealthCheck();
      String status = (String) healthCheck.get("overallStatus");

      if ("UNHEALTHY".equals(status)) {
        logger.warn("Database health check failed: {}", healthCheck);
      } else {
        logger.debug("Database health check passed: {}", healthCheck);
      }

      // Update system metrics based on health check
      Long responseTime = (Long) healthCheck.get("responseTimeMs");
      if (responseTime != null && responseTime > 2000) {
        logger.warn("Database response time is high: {}ms", responseTime);
      }

    } catch (Exception e) {
      logger.error("Error during scheduled database health check: {}", e.getMessage());
    }
  }

  /** Reset monitoring statistics */
  public void resetStatistics() {
    totalQueries.set(0);
    slowQueries.set(0);
    verySlowQueries.set(0);
    failedQueries.set(0);
    connectionLeaks.set(0);
    logger.info("Database monitoring statistics reset");
  }

  /** Functional interface for query execution */
  @FunctionalInterface
  public interface QueryExecutor<T> {
    T execute() throws Exception;
  }

  /** Functional interface for connection-based operations */
  @FunctionalInterface
  public interface ConnectionExecutor<T> {
    T execute(Connection connection) throws Exception;
  }

  /** Get database pool status for admin interface */
  public String getPoolStatus() {
    try {
      Map<String, Object> poolStats = getConnectionPoolStatistics();
      if (poolStats.containsKey("poolStatus")) {
        return (String) poolStats.get("poolStatus");
      } else if (poolStats.containsKey("utilizationPercentage")) {
        // Fallback to manual calculation using corrected utilization
        double utilization = (Double) poolStats.get("utilizationPercentage");
        if (utilization > 90) {
          return "CRITICAL";
        } else if (utilization > 70) {
          return "WARNING";
        } else {
          return "HEALTHY";
        }
      }
      return "UNKNOWN";
    } catch (Exception e) {
      logger.warn("Error getting pool status: {}", e.getMessage());
      return "ERROR";
    }
  }

  /** Get database metrics for admin interface */
  public Map<String, Object> getDatabaseMetrics() {
    return getDatabaseStatistics();
  }

  /** Perform emergency cleanup (placeholder for admin interface) */
  public void performEmergencyCleanup() {
    logger.info("Emergency database cleanup requested - resetting statistics");
    resetStatistics();
  }

  /** Get database health indicators for monitoring dashboards */
  public Map<String, String> getHealthIndicators() {
    Map<String, String> indicators = new HashMap<>();

    long total = totalQueries.get();
    if (total > 0) {
      double failureRate = (double) failedQueries.get() / total * 100;
      double slowQueryRate = (double) slowQueries.get() / total * 100;

      // Database reliability indicator
      if (failureRate < 1) {
        indicators.put("reliability", "HEALTHY");
      } else if (failureRate < 5) {
        indicators.put("reliability", "WARNING");
      } else {
        indicators.put("reliability", "CRITICAL");
      }

      // Database performance indicator
      if (slowQueryRate < 10) {
        indicators.put("performance", "HEALTHY");
      } else if (slowQueryRate < 25) {
        indicators.put("performance", "WARNING");
      } else {
        indicators.put("performance", "CRITICAL");
      }
    } else {
      indicators.put("reliability", "NO_DATA");
      indicators.put("performance", "NO_DATA");
    }

    // Connection pool health - use the corrected utilization calculation
    Map<String, Object> poolStats = getConnectionPoolStatistics();
    if (poolStats.containsKey("poolStatus")) {
      String poolStatus = (String) poolStats.get("poolStatus");
      indicators.put("connectionPool", poolStatus);
    } else if (poolStats.containsKey("utilizationPercentage")) {
      // Fallback to manual calculation if poolStatus is not available
      double utilization = (Double) poolStats.get("utilizationPercentage");
      if (utilization < 70) {
        indicators.put("connectionPool", "HEALTHY");
      } else if (utilization < 90) {
        indicators.put("connectionPool", "WARNING");
      } else {
        indicators.put("connectionPool", "CRITICAL");
      }
    } else {
      indicators.put("connectionPool", "UNKNOWN");
    }

    return indicators;
  }
}
