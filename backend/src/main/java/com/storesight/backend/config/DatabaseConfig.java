package com.storesight.backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

@Configuration
@Profile("!test")
@ConditionalOnProperty(
    name = "storesight.database.custom-config.enabled",
    havingValue = "true",
    matchIfMissing = false)
public class DatabaseConfig {

  private static final Logger logger = LoggerFactory.getLogger(DatabaseConfig.class);

  @Value("${spring.datasource.url}")
  private String dataSourceUrl;

  @Value("${spring.datasource.username}")
  private String dataSourceUsername;

  @Value("${spring.datasource.password}")
  private String dataSourcePassword;

  @Value("${spring.datasource.driver-class-name}")
  private String driverClassName;

  private final Environment environment;

  public DatabaseConfig(Environment environment) {
    this.environment = environment;
  }

  @Bean
  @Primary
  public DataSource dataSource() {
    logger.info(
        "Configuring HikariCP data source with URL: {}",
        dataSourceUrl.replaceAll("password=[^&]*", "password=***"));

    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(dataSourceUrl);
    config.setUsername(dataSourceUsername);
    config.setPassword(dataSourcePassword);
    config.setDriverClassName(driverClassName);

    // Check if we're in production environment
    boolean isProduction = isProductionEnvironment();

    // OPTIMIZED Connection pool settings for production scalability
    // Production: smaller pool for remote DB to prevent connection exhaustion
    // Development: slightly larger pool for local development
    int defaultMaxPoolSize = isProduction ? 12 : 15; // Reduced from 15/25 to 12/15
    String poolSizeProp = System.getenv("DB_POOL_SIZE");
    int maxPoolSize = defaultMaxPoolSize;

    if (poolSizeProp != null) {
      try {
        maxPoolSize = Integer.parseInt(poolSizeProp);
        // Enforce maximum limits to prevent connection exhaustion
        if (isProduction && maxPoolSize > 20) {
          logger.warn("DB_POOL_SIZE {} is too large for production, capping at 20", maxPoolSize);
          maxPoolSize = 20;
        } else if (!isProduction && maxPoolSize > 25) {
          logger.warn("DB_POOL_SIZE {} is too large for development, capping at 25", maxPoolSize);
          maxPoolSize = 25;
        }
        logger.info("Using DB_POOL_SIZE from environment: {}", maxPoolSize);
      } catch (NumberFormatException e) {
        logger.warn(
            "Invalid DB_POOL_SIZE env value '{}', using default {}",
            poolSizeProp,
            defaultMaxPoolSize);
        maxPoolSize = defaultMaxPoolSize;
      }
    }

    // CRITICAL: Ensure minimum pool size is reasonable and prevents connection starvation
    int minimumIdle = Math.max(2, Math.min(3, maxPoolSize / 4));

    config.setMaximumPoolSize(maxPoolSize);
    config.setMinimumIdle(minimumIdle);

    // OPTIMIZED timeouts for production stability and faster failure detection
    if (isProduction) {
      config.setConnectionTimeout(25000); // Reduced from 45s to 25s for faster failure detection
      config.setIdleTimeout(180000); // 3 minutes (reduced from 5 minutes)
      config.setMaxLifetime(900000); // 15 minutes (reduced from 20 minutes)
      config.setLeakDetectionThreshold(30000); // 30 seconds (reduced from 2 minutes)
      config.setValidationTimeout(3000); // 3 seconds (reduced from 8 seconds)
      config.setKeepaliveTime(300000); // 5 minutes keepalive
    } else {
      config.setConnectionTimeout(20000); // Reduced from 30s to 20s
      config.setIdleTimeout(180000); // 3 minutes
      config.setMaxLifetime(900000); // 15 minutes
      config.setLeakDetectionThreshold(30000); // 30 seconds for development
      config.setValidationTimeout(3000); // 3 seconds
      config.setKeepaliveTime(300000); // 5 minutes keepalive
    }

    // Enhanced connection testing and reliability
    config.setConnectionTestQuery("SELECT 1");
    config.setAutoCommit(true);
    config.setPoolName("StoresightHikariCP" + (isProduction ? "-Prod" : "-Dev"));

    // CRITICAL: Disable pool suspension to prevent deadlocks
    config.setAllowPoolSuspension(false);
    config.setInitializationFailTimeout(10000); // 10 seconds (reduced from 30s)

    // Connection properties for better performance and reliability
    config.addDataSourceProperty("cachePrepStmts", "true");
    config.addDataSourceProperty("prepStmtCacheSize", "200"); // Reduced from 250
    config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");
    config.addDataSourceProperty("useServerPrepStmts", "true");
    config.addDataSourceProperty("useLocalSessionState", "true");
    config.addDataSourceProperty("rewriteBatchedStatements", "true");
    config.addDataSourceProperty("cacheResultSetMetadata", "true");
    config.addDataSourceProperty("cacheServerConfiguration", "true");
    config.addDataSourceProperty("elideSetAutoCommits", "true");
    config.addDataSourceProperty("maintainTimeStats", "false");

    // Production-specific connection properties for better reliability
    if (isProduction) {
      config.addDataSourceProperty("autoReconnect", "true");
      config.addDataSourceProperty("failOverReadOnly", "false");
      config.addDataSourceProperty("maxReconnects", "2"); // Reduced from 3
      config.addDataSourceProperty("initialTimeout", "8"); // Reduced from 10
      config.addDataSourceProperty("socketTimeout", "20000"); // Reduced from 30s
      config.addDataSourceProperty("connectTimeout", "15000"); // Reduced from 30s
      config.addDataSourceProperty("loginTimeout", "10"); // Added login timeout
      // Add TCP keepalive for production
      config.addDataSourceProperty("tcpKeepAlive", "true");
      // CRITICAL: Add application name for better database monitoring
      config.addDataSourceProperty("ApplicationName", "StoreSignt-Backend-Prod");
    } else {
      config.addDataSourceProperty("ApplicationName", "StoreSignt-Backend-Dev");
    }

    HikariDataSource dataSource = new HikariDataSource(config);

    // Test connection on startup with optimized retry logic
    testDatabaseConnection(dataSource, isProduction);

    // Warm up the connection pool with fewer connections
    warmupConnectionPool(dataSource, isProduction);

    // Log final configuration
    logger.info(
        "HikariCP configured - maxPoolSize: {}, minimumIdle: {}, connectionTimeout: {}ms, "
            + "leakDetectionThreshold: {}ms, isProduction: {}",
        maxPoolSize,
        minimumIdle,
        config.getConnectionTimeout(),
        config.getLeakDetectionThreshold(),
        isProduction);

    return dataSource;
  }

  private boolean isProductionEnvironment() {
    String[] activeProfiles = environment.getActiveProfiles();
    for (String profile : activeProfiles) {
      if ("prod".equals(profile) || "production".equals(profile)) {
        return true;
      }
    }
    return false;
  }

  private void testDatabaseConnection(HikariDataSource dataSource, boolean isProduction) {
    int maxRetries = isProduction ? 2 : 1; // Reduced from 3/1 to 2/1
    int retryDelayMs = isProduction ? 2000 : 1000; // Reduced delay from 3000ms to 2000ms

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      try (Connection connection = dataSource.getConnection()) {
        // Quick connection test with shorter timeout
        if (connection.isValid(3)) { // Reduced from 5 to 3 seconds
          logger.info("Database connection test successful (attempt {}/{})", attempt, maxRetries);
          return;
        } else {
          throw new SQLException("Connection validation failed");
        }
      } catch (SQLException e) {
        logger.warn(
            "Database connection test failed (attempt {}/{}): {}",
            attempt,
            maxRetries,
            e.getMessage());

        if (attempt < maxRetries) {
          try {
            Thread.sleep(retryDelayMs);
            logger.info("Retrying database connection in {} ms...", retryDelayMs);
          } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            break;
          }
        } else {
          logger.error("Failed to establish database connection after {} attempts", maxRetries, e);
          if (isProduction) {
            // In production, continue startup and let health checks handle monitoring
            logger.warn(
                "Continuing startup despite database connection failure - health checks will monitor connection");
          } else {
            throw new RuntimeException("Database connection failed", e);
          }
        }
      }
    }
  }

  private void warmupConnectionPool(HikariDataSource dataSource, boolean isProduction) {
    logger.info("Warming up database connection pool...");
    try {
      // OPTIMIZED: Create fewer connections for warmup to reduce startup load
      int warmupConnections = Math.min(2, dataSource.getMinimumIdle()); // Reduced from 3
      for (int i = 0; i < warmupConnections; i++) {
        try (Connection conn = dataSource.getConnection()) {
          // Quick validation with shorter timeout
          if (conn.isValid(2)) { // Reduced from 3 to 2 seconds
            conn.prepareStatement("SELECT 1").execute();
          }
        }
      }
      logger.info(
          "Database connection pool warmed up successfully with {} connections", warmupConnections);
    } catch (Exception e) {
      logger.warn("Failed to warm up connection pool: {}", e.getMessage());
      // Don't fail startup - warmup is optional
    }
  }
}
