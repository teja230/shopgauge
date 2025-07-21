package com.storesight.backend.service;

import com.storesight.backend.config.ApplicationConfigurationProperties;
import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Service;

/**
 * Enhanced connection pool management service that provides monitoring, alerting, and automatic
 * recovery mechanisms for database connections.
 */
@Service
public class EnhancedConnectionPoolService implements HealthIndicator {

  private static final Logger logger = LoggerFactory.getLogger(EnhancedConnectionPoolService.class);

  private final DataSource dataSource;
  private final ScheduledExecutorService scheduler;
  private final AlertingService alertingService;

  // Connection pool metrics
  private final AtomicLong connectionLeakCount = new AtomicLong(0);
  private final AtomicLong connectionTimeoutCount = new AtomicLong(0);
  private final AtomicLong connectionRecoveryCount = new AtomicLong(0);
  private volatile LocalDateTime lastHealthCheck = LocalDateTime.now();
  private volatile boolean isHealthy = true;

  @Autowired private ApplicationConfigurationProperties config;

  // Configuration helper methods
  private double getWarningThreshold() {
    return config.getMonitoring().getConnectionPoolWarningThreshold() / 100.0;
  }

  private double getCriticalThreshold() {
    return config.getMonitoring().getConnectionPoolCriticalThreshold() / 100.0;
  }

  private long getHealthCheckIntervalSeconds() {
    return config.getMonitoring().getHealthCheckInterval().getSeconds();
  }

  private int getConnectionTestTimeoutSeconds() {
    return (int) config.getMonitoring().getConnectionTestTimeout().getSeconds();
  }

  @Autowired
  public EnhancedConnectionPoolService(DataSource dataSource, AlertingService alertingService) {
    this.dataSource = dataSource;
    this.alertingService = alertingService;
    this.scheduler = Executors.newScheduledThreadPool(2);
  }

  @PostConstruct
  public void initialize() {
    // Schedule periodic health checks
    scheduler.scheduleAtFixedRate(
        this::performHealthCheck,
        getHealthCheckIntervalSeconds(),
        getHealthCheckIntervalSeconds(),
        TimeUnit.SECONDS);

    // Schedule periodic metrics collection - use configured interval (default: 6 hours)
    long metricsIntervalSeconds = getHealthCheckIntervalSeconds() * 6; // 6x health check interval
    scheduler.scheduleAtFixedRate(
        this::collectMetrics, metricsIntervalSeconds, metricsIntervalSeconds, TimeUnit.SECONDS);

    logger.info(
        "Enhanced connection pool monitoring initialized with metrics collection every {} seconds",
        metricsIntervalSeconds);
  }

  @PreDestroy
  public void shutdown() {
    scheduler.shutdown();
    try {
      if (!scheduler.awaitTermination(10, TimeUnit.SECONDS)) {
        scheduler.shutdownNow();
      }
    } catch (InterruptedException e) {
      scheduler.shutdownNow();
      Thread.currentThread().interrupt();
    }
    logger.info("Enhanced connection pool monitoring shutdown completed");
  }

  /** Get current connection pool statistics */
  public ConnectionPoolStatistics getStatistics() {
    if (!(dataSource instanceof HikariDataSource)) {
      return new ConnectionPoolStatistics(0, 0, 0, 0, 0, 0, 0, 0, false);
    }

    HikariDataSource hikariDataSource = (HikariDataSource) dataSource;
    HikariPoolMXBean poolBean = hikariDataSource.getHikariPoolMXBean();

    if (poolBean == null) {
      return new ConnectionPoolStatistics(0, 0, 0, 0, 0, 0, 0, 0, false);
    }

    int totalConnections = poolBean.getTotalConnections();
    int activeConnections = poolBean.getActiveConnections();
    int idleConnections = poolBean.getIdleConnections();
    int threadsAwaitingConnection = poolBean.getThreadsAwaitingConnection();

    double utilizationRatio =
        totalConnections > 0 ? (double) activeConnections / totalConnections : 0.0;

    return new ConnectionPoolStatistics(
        totalConnections,
        activeConnections,
        idleConnections,
        threadsAwaitingConnection,
        connectionLeakCount.get(),
        connectionTimeoutCount.get(),
        connectionRecoveryCount.get(),
        utilizationRatio,
        isHealthy);
  }

  /** Test database connection health */
  public boolean testConnection() {
    try (Connection connection = dataSource.getConnection()) {
      boolean isValid = connection.isValid(getConnectionTestTimeoutSeconds());
      if (isValid) {
        // Execute a simple query to ensure full connectivity
        connection.prepareStatement("SELECT 1").execute();
      }
      return isValid;
    } catch (SQLException e) {
      logger.warn("Database connection test failed: {}", e.getMessage());
      return false;
    }
  }

  /** Attempt to recover connection pool if unhealthy */
  public boolean attemptRecovery() {
    logger.info("Attempting connection pool recovery");

    try {
      if (!(dataSource instanceof HikariDataSource)) {
        logger.warn("Cannot perform recovery on non-HikariCP datasource");
        return false;
      }

      HikariDataSource hikariDataSource = (HikariDataSource) dataSource;

      // Soft evict idle connections to force refresh
      HikariPoolMXBean poolBean = hikariDataSource.getHikariPoolMXBean();
      if (poolBean != null) {
        poolBean.softEvictConnections();
        logger.info("Soft evicted idle connections");
      }

      // Test connection after recovery attempt
      boolean recovered = testConnection();
      if (recovered) {
        connectionRecoveryCount.incrementAndGet();
        isHealthy = true;
        logger.info("Connection pool recovery successful");
      } else {
        logger.error("Connection pool recovery failed");
      }

      return recovered;

    } catch (Exception e) {
      logger.error("Error during connection pool recovery", e);
      return false;
    }
  }

  /** Force close all idle connections */
  public void closeIdleConnections() {
    try {
      if (dataSource instanceof HikariDataSource) {
        HikariDataSource hikariDataSource = (HikariDataSource) dataSource;
        HikariPoolMXBean poolBean = hikariDataSource.getHikariPoolMXBean();

        if (poolBean != null) {
          poolBean.softEvictConnections();
          logger.info("Forced closure of idle connections");
        }
      }
    } catch (Exception e) {
      logger.error("Error closing idle connections", e);
    }
  }

  /** Perform comprehensive health check */
  private void performHealthCheck() {
    try {
      lastHealthCheck = LocalDateTime.now();

      // Test basic connectivity
      boolean connectionHealthy = testConnection();

      // Check pool utilization
      ConnectionPoolStatistics stats = getStatistics();
      boolean utilizationHealthy = stats.getUtilizationRatio() < getCriticalThreshold();

      // Check for threads waiting for connections
      boolean waitingThreadsHealthy = stats.getThreadsAwaitingConnection() < 5;

      boolean overallHealthy = connectionHealthy && utilizationHealthy && waitingThreadsHealthy;

      if (!overallHealthy && isHealthy) {
        // Health status changed from healthy to unhealthy
        logger.error(
            "Connection pool health check failed - Connection: {}, Utilization: {}%, Waiting threads: {}",
            connectionHealthy,
            String.format("%.2f", stats.getUtilizationRatio() * 100),
            stats.getThreadsAwaitingConnection());

        // Log critical alert (AlertingService will handle this automatically via monitoring)
        logger.error(
            "Connection pool health critical - Utilization: {}%, Waiting threads: {}",
            String.format("%.2f", stats.getUtilizationRatio() * 100),
            stats.getThreadsAwaitingConnection());

        // Attempt automatic recovery
        attemptRecovery();
      }

      // Log warning if utilization is high but not critical
      if (stats.getUtilizationRatio() >= getWarningThreshold()
          && stats.getUtilizationRatio() < getCriticalThreshold()) {
        logger.warn(
            "Connection pool utilization is high: {}%",
            String.format("%.2f", stats.getUtilizationRatio() * 100));
      }

      isHealthy = overallHealthy;

    } catch (Exception e) {
      logger.error("Error during connection pool health check", e);
      isHealthy = false;
    }
  }

  /** Collect and log connection pool metrics */
  private void collectMetrics() {
    try {
      ConnectionPoolStatistics stats = getStatistics();

      // Only log if there are issues or high utilization
      if (stats.getUtilizationRatio() > getWarningThreshold()
          || stats.getThreadsAwaitingConnection() > 0
          || stats.getConnectionLeakCount() > 0
          || stats.getConnectionTimeoutCount() > 0) {

        logger.warn(
            "Connection Pool Metrics - Total: {}, Active: {}, Idle: {}, "
                + "Utilization: {}%, Waiting: {}, Leaks: {}, Timeouts: {}, Recoveries: {}",
            stats.getTotalConnections(),
            stats.getActiveConnections(),
            stats.getIdleConnections(),
            String.format("%.2f", stats.getUtilizationRatio() * 100),
            stats.getThreadsAwaitingConnection(),
            stats.getConnectionLeakCount(),
            stats.getConnectionTimeoutCount(),
            stats.getConnectionRecoveryCount());
      } else {
        // Log at debug level for normal operation
        logger.debug(
            "Connection Pool Metrics - Total: {}, Active: {}, Idle: {}, "
                + "Utilization: {}%, Waiting: {}, Leaks: {}, Timeouts: {}, Recoveries: {}",
            stats.getTotalConnections(),
            stats.getActiveConnections(),
            stats.getIdleConnections(),
            String.format("%.2f", stats.getUtilizationRatio() * 100),
            stats.getThreadsAwaitingConnection(),
            stats.getConnectionLeakCount(),
            stats.getConnectionTimeoutCount(),
            stats.getConnectionRecoveryCount());
      }

    } catch (Exception e) {
      logger.error("Error collecting connection pool metrics", e);
    }
  }

  /** Spring Boot health indicator implementation */
  @Override
  public Health health() {
    try {
      ConnectionPoolStatistics stats = getStatistics();

      Health.Builder builder = isHealthy ? Health.up() : Health.down();

      return builder
          .withDetail("totalConnections", stats.getTotalConnections())
          .withDetail("activeConnections", stats.getActiveConnections())
          .withDetail("idleConnections", stats.getIdleConnections())
          .withDetail(
              "utilizationRatio", String.format("%.2f%%", stats.getUtilizationRatio() * 100))
          .withDetail("threadsAwaitingConnection", stats.getThreadsAwaitingConnection())
          .withDetail("connectionLeakCount", stats.getConnectionLeakCount())
          .withDetail("connectionTimeoutCount", stats.getConnectionTimeoutCount())
          .withDetail("connectionRecoveryCount", stats.getConnectionRecoveryCount())
          .withDetail("lastHealthCheck", lastHealthCheck.toString())
          .withDetail("connectionTest", testConnection())
          .build();

    } catch (Exception e) {
      return Health.down()
          .withDetail("error", e.getMessage())
          .withDetail("lastHealthCheck", lastHealthCheck.toString())
          .build();
    }
  }

  /** Connection pool statistics data class */
  public static class ConnectionPoolStatistics {
    private final int totalConnections;
    private final int activeConnections;
    private final int idleConnections;
    private final int threadsAwaitingConnection;
    private final long connectionLeakCount;
    private final long connectionTimeoutCount;
    private final long connectionRecoveryCount;
    private final double utilizationRatio;
    private final boolean isHealthy;

    public ConnectionPoolStatistics(
        int totalConnections,
        int activeConnections,
        int idleConnections,
        int threadsAwaitingConnection,
        long connectionLeakCount,
        long connectionTimeoutCount,
        long connectionRecoveryCount,
        double utilizationRatio,
        boolean isHealthy) {
      this.totalConnections = totalConnections;
      this.activeConnections = activeConnections;
      this.idleConnections = idleConnections;
      this.threadsAwaitingConnection = threadsAwaitingConnection;
      this.connectionLeakCount = connectionLeakCount;
      this.connectionTimeoutCount = connectionTimeoutCount;
      this.connectionRecoveryCount = connectionRecoveryCount;
      this.utilizationRatio = utilizationRatio;
      this.isHealthy = isHealthy;
    }

    // Getters
    public int getTotalConnections() {
      return totalConnections;
    }

    public int getActiveConnections() {
      return activeConnections;
    }

    public int getIdleConnections() {
      return idleConnections;
    }

    public int getThreadsAwaitingConnection() {
      return threadsAwaitingConnection;
    }

    public long getConnectionLeakCount() {
      return connectionLeakCount;
    }

    public long getConnectionTimeoutCount() {
      return connectionTimeoutCount;
    }

    public long getConnectionRecoveryCount() {
      return connectionRecoveryCount;
    }

    public double getUtilizationRatio() {
      return utilizationRatio;
    }

    public boolean isHealthy() {
      return isHealthy;
    }
  }
}
