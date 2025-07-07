package com.storesight.backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Custom Flyway configuration to prevent connection leaks during migrations. This configuration
 * creates a dedicated DataSource for Flyway with minimal connection pool to prevent resource
 * exhaustion and connection leaks.
 *
 * <p>DISABLED BY DEFAULT - Only enable if specifically needed for debugging connection issues.
 */
@Configuration
@ConditionalOnProperty(
    name = "storesight.flyway.custom.enabled",
    havingValue = "true",
    matchIfMissing = false)
public class FlywayConfig {

  @Value("${spring.datasource.url}")
  private String dbUrl;

  @Value("${spring.datasource.username}")
  private String dbUsername;

  @Value("${spring.datasource.password}")
  private String dbPassword;

  @Value("${spring.datasource.driver-class-name}")
  private String driverClassName;

  /**
   * Creates a dedicated DataSource specifically for Flyway operations This prevents connection
   * leaks by using a minimal, isolated connection pool
   */
  @Bean(name = "flywayDataSource")
  public DataSource flywayDataSource() {
    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(dbUrl);
    config.setUsername(dbUsername);
    config.setPassword(dbPassword);
    config.setDriverClassName(driverClassName);

    // CRITICAL: Minimal connection pool settings for Flyway
    config.setMaximumPoolSize(2); // Only 2 connections max for migrations
    config.setMinimumIdle(1); // Keep 1 connection ready
    config.setConnectionTimeout(30000); // 30 seconds timeout
    config.setIdleTimeout(300000); // 5 minutes idle timeout
    config.setMaxLifetime(600000); // 10 minutes max lifetime
    config.setLeakDetectionThreshold(90000); // 90 seconds for long migrations
    config.setValidationTimeout(5000); // 5 seconds validation

    // PostgreSQL-specific optimizations
    config.addDataSourceProperty("cachePrepStmts", "true");
    config.addDataSourceProperty("prepStmtCacheSize", "250");
    config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");
    config.addDataSourceProperty("useServerPrepStmts", "true");
    config.addDataSourceProperty("reWriteBatchedInserts", "true");
    config.addDataSourceProperty("ApplicationName", "Flyway-Migration");

    // Connection pool name for debugging
    config.setPoolName("FlywayCP");

    return new HikariDataSource(config);
  }

  /** Configures Flyway with dedicated DataSource */
  @Bean
  @Primary
  public Flyway flyway(DataSource flywayDataSource) {
    return Flyway.configure()
        .dataSource(flywayDataSource)
        .locations("classpath:db/migration")
        .baselineOnMigrate(true)
        .validateOnMigrate(true)
        .connectRetries(5)
        .connectRetriesInterval(5)
        .lockRetryCount(50)
        .ignoreMigrationPatterns("*:missing", "*:ignored")
        .load();
  }
}
