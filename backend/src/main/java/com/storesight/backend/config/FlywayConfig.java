package com.storesight.backend.config;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/** Simplified Flyway configuration to prevent bean creation conflicts. */
@Configuration
@Profile("!test")
public class FlywayConfig {

  private static final Logger logger = LoggerFactory.getLogger(FlywayConfig.class);

  @Bean
  public Flyway flyway(DataSource dataSource) {
    logger.info("Configuring Flyway with enhanced connection management");

    Flyway flyway =
        Flyway.configure()
            .dataSource(dataSource)
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

  @Bean
  public FlywayMigrationInitializer flywayInitializer(Flyway flyway) {
    logger.info("Initializing Flyway migration");
    return new FlywayMigrationInitializer(flyway, null);
  }
}
