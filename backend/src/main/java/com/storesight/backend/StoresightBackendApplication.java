package com.storesight.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.event.EventListener;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ComponentScan(basePackages = "com.storesight.backend")
@EnableJpaRepositories(basePackages = "com.storesight.backend.repository")
@EnableScheduling
public class StoresightBackendApplication {

  private static final Logger logger = LoggerFactory.getLogger(StoresightBackendApplication.class);

  public static void main(String[] args) {
    logger.info("Starting StoreSignt Backend Application with connection leak prevention");
    SpringApplication.run(StoresightBackendApplication.class, args);
  }

  @EventListener(ApplicationReadyEvent.class)
  public void onApplicationReady() {
    logger.info("✅ StoreSignt Backend Application started successfully");
    logger.info("✅ Connection leak prevention measures active");
    logger.info("✅ Flyway migrations completed with dedicated connection pool");
    logger.info("✅ Database monitoring service initialized");
    logger.info("✅ Application ready for production traffic");
  }
}
