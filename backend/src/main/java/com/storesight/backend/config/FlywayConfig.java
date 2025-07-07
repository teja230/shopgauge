package com.storesight.backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Enhanced Flyway configuration with dedicated connection pool to prevent connection leaks.
 * DISABLED: Using Spring Boot auto-configuration instead to prevent JPA conflicts.
 */
@Configuration
@Profile("!test")
@ConditionalOnProperty(
    name = "storesight.flyway.custom.enabled",
    havingValue = "true",
    matchIfMissing = false)
public class FlywayConfig {

  private static final Logger logger = LoggerFactory.getLogger(FlywayConfig.class);

  @Value("${spring.datasource.url}")
  private String dataSourceUrl;

  @Value("${spring.datasource.username}")
  private String dataSourceUsername;

  @Value("${spring.datasource.password}")
  private String dataSourcePassword;

  @Value("${spring.datasource.driver-class-name}")
  private String driverClassName;

  /**
   * Dedicated DataSource for Flyway migrations only. This prevents connection leaks by isolating
   * Flyway from the main application pool.
   */
  @Bean("flywayDataSource")
  public DataSource flywayDataSource() {
    logger.info("Creating dedicated Flyway DataSource to prevent connection leaks");

    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(dataSourceUrl);
    config.setUsername(dataSourceUsername);
    config.setPassword(dataSourcePassword);
    config.setDriverClassName(driverClassName);

    // CRITICAL: Minimal pool for Flyway only - prevents connection leaks
    config.setMaximumPoolSize(3);
    config.setMinimumIdle(1);
    config.setConnectionTimeout(60000);
    config.setIdleTimeout(30000); // Short idle timeout for quick cleanup
    config.setMaxLifetime(120000); // Short max lifetime for quick cleanup
    config.setLeakDetectionThreshold(0); // Disable leak detection for Flyway pool
    config.setValidationTimeout(10000);
    config.setConnectionTestQuery("SELECT 1");
    config.setAutoCommit(true);
    config.setPoolName("FlywayHikariCP");
    config.setAllowPoolSuspension(false);
    config.setInitializationFailTimeout(30000);

    // Flyway-specific optimizations for fast connection cleanup
    config.addDataSourceProperty("cachePrepStmts", "false");
    config.addDataSourceProperty("useServerPrepStmts", "false");
    config.addDataSourceProperty("ApplicationName", "StoreSignt-Flyway");
    config.addDataSourceProperty("socketTimeout", "30");
    config.addDataSourceProperty("loginTimeout", "30");

    return new HikariDataSource(config);
  }

  @Bean
  public Flyway flyway() {
    logger.info("Configuring Flyway with dedicated DataSource");

    Flyway flyway =
        Flyway.configure()
            .dataSource(flywayDataSource())
            .locations("classpath:db/migration")
            .baselineOnMigrate(true)
            .validateOnMigrate(true)
            .outOfOrder(false)
            .mixed(false)
            .group(true)
            .installedBy("storesight-backend")
            .connectRetries(3)
            .connectRetriesInterval(10)
            .lockRetryCount(50)
            .load();

    return flyway;
  }

  @Bean
  public FlywayMigrationInitializer flywayInitializer(Flyway flyway) {
    logger.info("Initializing Flyway migration with connection leak prevention");

    return new FlywayMigrationInitializer(flyway, null) {
      @Override
      public void afterPropertiesSet() throws Exception {
        try {
          logger.info("Starting Flyway migration process");
          super.afterPropertiesSet();
          logger.info("Flyway migration completed successfully");
        } catch (Exception e) {
          logger.error("Flyway migration failed: {}", e.getMessage(), e);
          throw e;
        } finally {
          // Force connection cleanup after migration
          try {
            DataSource flywayDs = flywayDataSource();
            if (flywayDs instanceof HikariDataSource) {
              HikariDataSource hikariDs = (HikariDataSource) flywayDs;
              logger.info("Forcing connection cleanup in Flyway DataSource");
              hikariDs.getHikariPoolMXBean().softEvictConnections();
            }
          } catch (Exception cleanupException) {
            logger.warn("Failed to cleanup Flyway connections: {}", cleanupException.getMessage());
          }
        }
      }
    };
  }
}
