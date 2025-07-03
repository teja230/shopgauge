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

    // Connection pool settings - Use environment variables with sensible defaults
    // Production: smaller pool for remote DB, Development: larger pool for local DB
    int defaultMaxPoolSize = isProduction ? 15 : 25; // Increased from 10 to 15 for production
    String poolSizeProp = System.getenv("DB_POOL_SIZE");
    int maxPoolSize = defaultMaxPoolSize;

    if (poolSizeProp != null) {
      try {
        maxPoolSize = Integer.parseInt(poolSizeProp);
        logger.info("Using DB_POOL_SIZE from environment: {}", maxPoolSize);
      } catch (NumberFormatException e) {
        logger.warn(
            "Invalid DB_POOL_SIZE env value '{}', using default {}",
            poolSizeProp,
            defaultMaxPoolSize);
        maxPoolSize = defaultMaxPoolSize;
      }
    }

    // Ensure minimum pool size is reasonable
    int minimumIdle = Math.max(2, Math.min(5, maxPoolSize / 4));

    config.setMaximumPoolSize(maxPoolSize);
    config.setMinimumIdle(minimumIdle);

    // Enhanced timeouts for production stability
    if (isProduction) {
      config.setConnectionTimeout(45000); // Reduced from 60s to 45s
      config.setIdleTimeout(300000); // 5 minutes (reduced from 10 minutes)
      config.setMaxLifetime(1200000); // 20 minutes (reduced from 30 minutes)
      config.setLeakDetectionThreshold(120000); // 2 minutes (reduced from 3 minutes)
      config.setValidationTimeout(8000); // 8 seconds (reduced from 10 seconds)
    } else {
      config.setConnectionTimeout(30000);
      config.setIdleTimeout(300000);
      config.setMaxLifetime(1200000);
      config.setLeakDetectionThreshold(60000); // 1 minute for development
      config.setValidationTimeout(5000);
    }

    // Enhanced connection testing
    config.setConnectionTestQuery("SELECT 1");
    config.setAutoCommit(true);
    config.setPoolName("StoresightHikariCP" + (isProduction ? "-Prod" : "-Dev"));

    // Connection properties for better performance and reliability
    config.addDataSourceProperty("cachePrepStmts", "true");
    config.addDataSourceProperty("prepStmtCacheSize", "250");
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
      config.addDataSourceProperty("maxReconnects", "3");
      config.addDataSourceProperty("initialTimeout", "10");
      config.addDataSourceProperty("socketTimeout", "30000");
      config.addDataSourceProperty("connectTimeout", "30000");
      // Add TCP keepalive for production
      config.addDataSourceProperty("tcpKeepAlive", "true");
    }

    HikariDataSource dataSource = new HikariDataSource(config);

    // Test connection on startup with retry logic
    testDatabaseConnection(dataSource, isProduction);

    // Warm up the connection pool
    warmupConnectionPool(dataSource, isProduction);

    // Log final configuration
    logger.info(
        "HikariCP configured - maxPoolSize: {}, minimumIdle: {}, connectionTimeout: {}ms, isProduction: {}",
        maxPoolSize,
        minimumIdle,
        config.getConnectionTimeout(),
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
    int maxRetries = isProduction ? 3 : 1;
    int retryDelayMs = isProduction ? 3000 : 1000; // Reduced delay

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      try (Connection connection = dataSource.getConnection()) {
        // Quick connection test
        if (connection.isValid(5)) {
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
      // Create and test connections to warm up the pool
      int warmupConnections = Math.min(3, dataSource.getMinimumIdle());
      for (int i = 0; i < warmupConnections; i++) {
        try (Connection conn = dataSource.getConnection()) {
          // Quick validation
          if (conn.isValid(3)) {
            conn.prepareStatement("SELECT 1").execute();
          }
        }
      }
      logger.info(
          "Database connection pool warmed up successfully with {} connections", warmupConnections);
    } catch (Exception e) {
      logger.warn("Failed to warm up connection pool: {}", e.getMessage());
    }
  }
}
