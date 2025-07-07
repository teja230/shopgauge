package com.storesight.backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

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

  private static final Logger logger = LoggerFactory.getLogger(FlywayConfig.class);

  @Value("${spring.datasource.url}")
  private String url;

  @Value("${spring.datasource.username}")
  private String username;

  @Value("${spring.datasource.password}")
  private String password;

  /**
   * Creates a dedicated DataSource for Flyway with minimal connection pool to prevent connection
   * leaks during migrations.
   */
  @Bean(name = "flywayDataSource")
  public DataSource flywayDataSource() {
    logger.info("Creating dedicated Flyway DataSource with minimal connection pool");

    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(url);
    config.setUsername(username);
    config.setPassword(password);
    config.setDriverClassName("org.postgresql.Driver");

    // Minimal connection pool for Flyway to prevent resource exhaustion
    config.setMaximumPoolSize(2);
    config.setMinimumIdle(1);
    config.setConnectionTimeout(30000);
    config.setIdleTimeout(600000);
    config.setMaxLifetime(1800000);
    config.setLeakDetectionThreshold(60000);
    config.setPoolName("FlywayHikariCP");

    // Ensure proper connection cleanup
    config.setAutoCommit(false);
    config.setConnectionTestQuery("SELECT 1");
    config.setValidationTimeout(5000);

    // PostgreSQL specific settings for better connection management
    config.addDataSourceProperty("socketTimeout", "20000");
    config.addDataSourceProperty("connectTimeout", "15000");
    config.addDataSourceProperty("tcpKeepAlive", "true");
    config.addDataSourceProperty("loginTimeout", "10");

    return new HikariDataSource(config);
  }

  /** Custom Flyway configuration with proper connection management */
  @Bean(initMethod = "migrate")
  public Flyway flyway(DataSource flywayDataSource) {
    logger.info("Configuring Flyway with custom connection management");

    return Flyway.configure()
        .dataSource(flywayDataSource)
        .locations("classpath:db/migration")
        .baselineOnMigrate(true)
        .validateOnMigrate(true)
        .cleanDisabled(true)
        .mixed(false)
        .group(true)
        .connectRetries(5)
        .connectRetriesInterval(5)
        .lockRetryCount(50)
        .installedBy("storesight-backend")
        // Ignore warnings about existing indexes
        .ignoreMigrationPatterns("*:missing", "*:ignored")
        .load();
  }
}
