package com.storesight.backend.config;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.DependsOn;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("!test")
public class FlywayConfig {

  @Bean
  public Flyway flyway(DataSource dataSource) {
    Flyway flyway =
        Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .baselineOnMigrate(true)
            .load();

    // Production-safe approach: repair checksum mismatches before migration
    try {
      flyway.repair();
    } catch (Exception e) {
      // Log the repair attempt but don't fail startup
      System.out.println("Flyway repair attempted: " + e.getMessage());
    }

    return flyway;
  }

  @Bean
  @DependsOn("flyway")
  public FlywayMigrationInitializer flywayInitializer(Flyway flyway) {
    return new FlywayMigrationInitializer(flyway, null);
  }
}
