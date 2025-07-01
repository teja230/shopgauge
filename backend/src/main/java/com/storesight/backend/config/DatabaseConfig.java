package com.storesight.backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;

@Configuration
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

    // Connection pool settings (pool size can also be overridden via ENV var `DB_POOL_SIZE`)
    int maxPoolSize = isProduction ? 10 : 50; // Reduced for production
    String poolSizeProp = System.getenv("DB_POOL_SIZE");
    if (poolSizeProp != null) {
      try {
        maxPoolSize = Integer.parseInt(poolSizeProp);
      } catch (NumberFormatException ignore) {
        logger.warn(
            "Invalid DB_POOL_SIZE env value '{}', using default {}", poolSizeProp, maxPoolSize);
      }
    }

    config.setMaximumPoolSize(maxPoolSize);
    config.setMinimumIdle(isProduction ? 2 : Math.min(10, maxPoolSize / 5));

    // Production-optimized timeouts
    if (isProduction) {
      config.setConnectionTimeout(60000); // 60 seconds for production
      config.setIdleTimeout(600000); // 10 minutes
      config.setMaxLifetime(1800000); // 30 minutes
      config.setLeakDetectionThreshold(180000); // 3 minutes
      config.setValidationTimeout(10000); // 10 seconds
    } else {
      config.setConnectionTimeout(30000);
      config.setIdleTimeout(300000);
      config.setMaxLifetime(1200000);
      config.setLeakDetectionThreshold(120000);
      config.setValidationTimeout(5000);
    }

    config.setConnectionTestQuery("SELECT 1");
    config.setAutoCommit(true);
    config.setPoolName("StoresightHikariCP" + (isProduction ? "-Prod" : ""));

    // Connection properties for better performance
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
    }

    HikariDataSource dataSource = new HikariDataSource(config);

    // Test connection on startup with retry logic for production
    testDatabaseConnection(dataSource, isProduction);

    // Warm up the connection pool
    warmupConnectionPool(dataSource, isProduction);

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
    int retryDelayMs = isProduction ? 5000 : 1000;

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      try (Connection connection = dataSource.getConnection()) {
        logger.info("Database connection test successful (attempt {}/{})", attempt, maxRetries);
        return;
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
            // In production, we might want to continue startup and let health checks handle it
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
      // Create and close a few connections to warm up the pool
      int warmupConnections = isProduction ? 2 : 3;
      for (int i = 0; i < warmupConnections; i++) {
        try (Connection conn = dataSource.getConnection()) {
          conn.prepareStatement("SELECT 1").execute();
        }
      }
      logger.info("Database connection pool warmed up successfully");
    } catch (Exception e) {
      logger.warn("Failed to warm up connection pool: {}", e.getMessage());
    }
  }
}
