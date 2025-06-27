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

    // Connection pool settings
    config.setMaximumPoolSize(20);
    config.setMinimumIdle(5);
    config.setConnectionTimeout(30000);
    config.setIdleTimeout(300000);
    config.setMaxLifetime(1200000);
    config.setLeakDetectionThreshold(60000);
    config.setValidationTimeout(5000);
    config.setConnectionTestQuery("SELECT 1");
    config.setAutoCommit(true);
    config.setPoolName("StoresightHikariCP");

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

    HikariDataSource dataSource = new HikariDataSource(config);

    // Test connection on startup
    try (Connection connection = dataSource.getConnection()) {
      logger.info("Database connection test successful");
    } catch (SQLException e) {
      logger.error("Failed to establish database connection: {}", e.getMessage(), e);
      throw new RuntimeException("Database connection failed", e);
    }

    return dataSource;
  }
}
