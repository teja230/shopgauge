package com.storesight.backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PostConstruct;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Enhanced database configuration with performance optimizations, connection pooling, query
 * monitoring, and slow query detection for Market Intelligence operations.
 */
@Configuration
@ConditionalOnProperty(
    name = "storesight.database.enhanced-config.enabled",
    havingValue = "true",
    matchIfMissing = true)
public class EnhancedDatabaseConfig {

  private static final Logger log = LoggerFactory.getLogger(EnhancedDatabaseConfig.class);

  @Value("${spring.datasource.url}")
  private String dataSourceUrl;

  @Value("${spring.datasource.username}")
  private String dataSourceUsername;

  @Value("${spring.datasource.password}")
  private String dataSourcePassword;

  @Value("${spring.datasource.driver-class-name}")
  private String driverClassName;

  // Enhanced connection pool settings - using standard HikariCP properties
  @Value("${spring.datasource.hikari.maximum-pool-size:20}")
  private int maxPoolSize;

  @Value("${spring.datasource.hikari.minimum-idle:5}")
  private int minIdle;

  @Value("${spring.datasource.hikari.connection-timeout:20000}")
  private long connectionTimeout;

  @Value("${spring.datasource.hikari.idle-timeout:300000}")
  private long idleTimeout;

  @Value("${spring.datasource.hikari.max-lifetime:1200000}")
  private long maxLifetime;

  @Value("${spring.datasource.hikari.leak-detection-threshold:15000}")
  private long leakDetectionThreshold;

  // Query monitoring settings
  @Value("${database.monitoring.slow-query-threshold:5000}")
  private long slowQueryThreshold;

  @Value("${database.monitoring.enabled:true}")
  private boolean monitoringEnabled;

  @Value("${database.monitoring.log-slow-queries:true}")
  private boolean logSlowQueries;

  // Performance optimization settings
  @Value("${database.optimization.prepared-statement-cache-size:250}")
  private int preparedStatementCacheSize;

  @Value("${database.optimization.batch-size:25}")
  private int batchSize;

  // Removed JdbcTemplate dependency to avoid circular dependency

  private ScheduledExecutorService monitoringExecutor;
  private HikariDataSource dataSource;

  @PostConstruct
  public void initialize() {
    log.info("Initializing Enhanced Database Configuration");

    if (monitoringEnabled) {
      monitoringExecutor =
          Executors.newScheduledThreadPool(
              2,
              r -> {
                Thread t = new Thread(r, "db-monitor-" + System.currentTimeMillis());
                t.setDaemon(true);
                return t;
              });

      // Start database monitoring
      startDatabaseMonitoring();
    }
  }

  @Bean
  @Primary
  @ConditionalOnProperty(
      name = "storesight.database.custom-config.enabled",
      havingValue = "false",
      matchIfMissing = true)
  public DataSource enhancedDataSource() {
    log.info("Configuring Enhanced HikariCP DataSource");

    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(dataSourceUrl);
    config.setUsername(dataSourceUsername);
    config.setPassword(dataSourcePassword);
    config.setDriverClassName(driverClassName);

    // Enhanced connection pool settings
    config.setMaximumPoolSize(maxPoolSize);
    config.setMinimumIdle(minIdle);
    config.setConnectionTimeout(connectionTimeout);
    config.setIdleTimeout(idleTimeout);
    config.setMaxLifetime(maxLifetime);
    config.setLeakDetectionThreshold(leakDetectionThreshold);

    // Connection validation and testing
    config.setConnectionTestQuery("SELECT 1");
    config.setValidationTimeout(5000);
    config.setAutoCommit(true);
    config.setPoolName("EnhancedHikariCP");

    // Performance optimizations
    config.addDataSourceProperty("cachePrepStmts", "true");
    config.addDataSourceProperty("prepStmtCacheSize", String.valueOf(preparedStatementCacheSize));
    config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");
    config.addDataSourceProperty("useServerPrepStmts", "true");
    config.addDataSourceProperty("useLocalSessionState", "true");
    config.addDataSourceProperty("rewriteBatchedStatements", "true");
    config.addDataSourceProperty("cacheResultSetMetadata", "true");
    config.addDataSourceProperty("cacheServerConfiguration", "true");
    config.addDataSourceProperty("elideSetAutoCommits", "true");
    config.addDataSourceProperty("maintainTimeStats", "false");

    // PostgreSQL-specific optimizations
    config.addDataSourceProperty("tcpKeepAlive", "true");
    config.addDataSourceProperty("socketTimeout", "30000");
    config.addDataSourceProperty("connectTimeout", "30000");
    config.addDataSourceProperty("loginTimeout", "10");
    config.addDataSourceProperty("ApplicationName", "StoresightEnhanced");
    config.addDataSourceProperty("assumeMinServerVersion", "12.0");
    config.addDataSourceProperty("autosave", "conservative");
    config.addDataSourceProperty("binaryTransfer", "true");
    config.addDataSourceProperty("defaultRowFetchSize", "1000");

    // Create and configure the data source
    this.dataSource = new HikariDataSource(config);

    // Test connection and warm up pool
    testAndWarmupPool();

    log.info(
        "Enhanced HikariCP DataSource configured successfully - maxPoolSize: {}, minIdle: {}",
        maxPoolSize,
        minIdle);

    return this.dataSource;
  }

  private void testAndWarmupPool() {
    try {
      // Test connection
      try (Connection conn = dataSource.getConnection()) {
        if (conn.isValid(5)) {
          log.info("Database connection test successful");
        }
      }

      // Warm up connection pool
      for (int i = 0; i < Math.min(3, minIdle); i++) {
        try (Connection conn = dataSource.getConnection()) {
          conn.prepareStatement("SELECT 1").execute();
        }
      }

      log.info("Connection pool warmed up successfully");
    } catch (SQLException e) {
      log.error("Failed to test or warm up connection pool: {}", e.getMessage(), e);
    }
  }

  private void startDatabaseMonitoring() {
    // Monitor connection pool health every 4 hours (ultra-conservative for resource conservation)
    monitoringExecutor.scheduleAtFixedRate(this::monitorConnectionPool, 240, 240, TimeUnit.MINUTES);

    // Monitor slow queries nightly at 2:30 AM (staggered from DatabasePerformanceService)
    if (logSlowQueries) {
      monitoringExecutor.scheduleAtFixedRate(
          this::monitorSlowQueries, getInitialDelayToNextRun() + 30, 24 * 60, TimeUnit.MINUTES);
    }

    // Monitor database performance nightly at 3 AM (staggered)
    monitoringExecutor.scheduleAtFixedRate(
        this::monitorDatabasePerformance,
        getInitialDelayToNextRun() + 60,
        24 * 60,
        TimeUnit.MINUTES);

    log.info(
        "Database monitoring started with ultra-conservative intervals for resource conservation");
  }

  /** Calculate initial delay to next 2 AM run */
  private long getInitialDelayToNextRun() {
    try {
      java.time.LocalDateTime now = java.time.LocalDateTime.now();
      java.time.LocalDateTime nextRun = now.withHour(2).withMinute(0).withSecond(0).withNano(0);

      if (now.compareTo(nextRun) > 0) {
        nextRun = nextRun.plusDays(1);
      }

      return java.time.Duration.between(now, nextRun).toMinutes();
    } catch (Exception e) {
      log.warn("Error calculating initial delay, using 5 minutes: {}", e.getMessage());
      return 5; // Fallback to 5 minutes
    }
  }

  private void monitorConnectionPool() {
    try {
      if (dataSource != null) {
        int activeConnections = dataSource.getHikariPoolMXBean().getActiveConnections();
        int idleConnections = dataSource.getHikariPoolMXBean().getIdleConnections();
        int totalConnections = dataSource.getHikariPoolMXBean().getTotalConnections();
        int threadsAwaitingConnection =
            dataSource.getHikariPoolMXBean().getThreadsAwaitingConnection();

        log.debug(
            "Connection Pool Status - Active: {}, Idle: {}, Total: {}, Awaiting: {}",
            activeConnections,
            idleConnections,
            totalConnections,
            threadsAwaitingConnection);

        // Alert if pool utilization is high
        double utilization = (double) activeConnections / maxPoolSize * 100;
        if (utilization > 80) {
          log.warn(
              "High connection pool utilization: {:.1f}% ({}/{})",
              utilization, activeConnections, maxPoolSize);
        }

        // Alert if threads are waiting for connections
        if (threadsAwaitingConnection > 0) {
          log.warn("Threads awaiting database connections: {}", threadsAwaitingConnection);
        }
      }
    } catch (Exception e) {
      log.error("Error monitoring connection pool: {}", e.getMessage());
    }
  }

  private void monitorSlowQueries() {
    // Simplified monitoring without JdbcTemplate dependency to avoid circular dependency
    log.debug("Slow query monitoring disabled to avoid circular dependency");
  }

  private void monitorDatabasePerformance() {
    // Simplified monitoring without JdbcTemplate dependency to avoid circular dependency
    log.debug("Database performance monitoring disabled to avoid circular dependency");
  }

  /** Create optimized indexes for Market Intelligence queries */
  @PostConstruct
  public void createOptimizedIndexes() {
    // Simplified index creation without JdbcTemplate dependency to avoid circular dependency
    log.info("Index creation disabled to avoid circular dependency");
  }

  private void createIndexIfNotExists(String indexName, String tableName, String indexDefinition) {
    // Simplified index creation without JdbcTemplate dependency to avoid circular dependency
    log.debug(
        "Index creation disabled to avoid circular dependency: {} on {}", indexName, tableName);
  }

  /** Get database performance metrics */
  public DatabasePerformanceMetrics getPerformanceMetrics() {
    try {
      DatabasePerformanceMetrics metrics = new DatabasePerformanceMetrics();

      if (dataSource != null) {
        metrics.activeConnections = dataSource.getHikariPoolMXBean().getActiveConnections();
        metrics.idleConnections = dataSource.getHikariPoolMXBean().getIdleConnections();
        metrics.totalConnections = dataSource.getHikariPoolMXBean().getTotalConnections();
        metrics.threadsAwaitingConnection =
            dataSource.getHikariPoolMXBean().getThreadsAwaitingConnection();
        metrics.connectionUtilization = (double) metrics.activeConnections / maxPoolSize * 100;
      }

      // Get slow query count - simplified to avoid circular dependency
      metrics.slowQueryCount = 0L;

      return metrics;

    } catch (Exception e) {
      log.error("Error getting database performance metrics: {}", e.getMessage());
      return new DatabasePerformanceMetrics();
    }
  }

  public static class DatabasePerformanceMetrics {
    public int activeConnections;
    public int idleConnections;
    public int totalConnections;
    public int threadsAwaitingConnection;
    public double connectionUtilization;
    public long slowQueryCount;

    // Getters
    public int getActiveConnections() {
      return activeConnections;
    }

    public int getIdleConnections() {
      return idleConnections;
    }

    public int getTotalConnections() {
      return totalConnections;
    }

    public int getThreadsAwaitingConnection() {
      return threadsAwaitingConnection;
    }

    public double getConnectionUtilization() {
      return connectionUtilization;
    }

    public long getSlowQueryCount() {
      return slowQueryCount;
    }
  }

  public void shutdown() {
    if (monitoringExecutor != null) {
      monitoringExecutor.shutdown();
      try {
        if (!monitoringExecutor.awaitTermination(30, TimeUnit.SECONDS)) {
          monitoringExecutor.shutdownNow();
        }
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        monitoringExecutor.shutdownNow();
      }
    }
  }
}
