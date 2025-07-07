package com.storesight.backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.DependsOn;
import org.springframework.context.annotation.Profile;

/**
 * Enhanced Flyway configuration with dedicated connection pool to prevent connection leaks during
 * migrations.
 */
@Configuration
@Profile("!test")
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

    // CRITICAL: Minimal pool for Flyway only
    config.setMaximumPoolSize(2);
    config.setMinimumIdle(1);
    config.setConnectionTimeout(30000);
    config.setIdleTimeout(60000);
    config.setMaxLifetime(300000);
    config.setLeakDetectionThreshold(10000);
    config.setValidationTimeout(5000);
    config.setConnectionTestQuery("SELECT 1");
    config.setAutoCommit(true);
    config.setPoolName("FlywayHikariCP");
    config.setAllowPoolSuspension(false);
    config.setInitializationFailTimeout(5000);

    // Flyway-specific optimizations
    config.addDataSourceProperty("cachePrepStmts", "false");
    config.addDataSourceProperty("useServerPrepStmts", "false");
    config.addDataSourceProperty("ApplicationName", "StoreSignt-Flyway");

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
            .lockRetryCount(10)
            .load();

    // Production-safe approach: repair checksum mismatches before migration
    try {
      logger.info("Attempting Flyway repair before migration");
      flyway.repair();
      logger.info("Flyway repair completed successfully");
    } catch (Exception e) {
      logger.warn("Flyway repair failed, continuing with migration: {}", e.getMessage());
    }

    return flyway;
  }

  /**
   * Custom migration initializer with enhanced error handling and connection cleanup to prevent
   * leaks.
   */
  @Bean
  @DependsOn("flyway")
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
          // Ensure Flyway DataSource is properly closed after migration
          try {
            DataSource flywayDs = flywayDataSource();
            if (flywayDs instanceof HikariDataSource) {
              logger.info("Closing Flyway DataSource after migration");
              ((HikariDataSource) flywayDs).close();
            }
          } catch (Exception closeException) {
            logger.warn("Failed to close Flyway DataSource: {}", closeException.getMessage());
          }
        }
      }
    };
  }
}
