package com.storesight.backend.config;

import javax.sql.DataSource;
import org.flywaydb.core.api.exception.FlywayValidateException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Configuration to handle Flyway checksum mismatches automatically This is particularly useful for
 * production deployments where migration files may have been modified but the database still has
 * old checksums
 */
@Configuration
@Profile("prod")
public class FlywayRepairConfig {

  private static final Logger logger = LoggerFactory.getLogger(FlywayRepairConfig.class);

  @Autowired private DataSource dataSource;

  @Bean
  public FlywayMigrationStrategy flywayMigrationStrategy() {
    return flyway -> {
      try {
        logger.info("Starting Flyway migration with optimized settings...");
        flyway.migrate();
        logger.info("Flyway migration completed successfully");
      } catch (FlywayValidateException e) {
        logger.warn("Flyway validation failed, attempting repair: {}", e.getMessage());

        try {
          // Attempt to repair the checksum mismatch
          flyway.repair();
          logger.info("Flyway repair completed successfully");

          // Try migration again after repair
          flyway.migrate();
          logger.info("Flyway migration completed successfully after repair");
        } catch (Exception repairException) {
          logger.error("Flyway repair failed: {}", repairException.getMessage());
          throw new RuntimeException("Failed to repair and migrate database", repairException);
        }
      } catch (Exception e) {
        logger.error("Flyway migration failed: {}", e.getMessage());
        throw new RuntimeException("Failed to migrate database", e);
      }
    };
  }
}
