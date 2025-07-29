package com.storesight.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;

/**
 * Startup Optimization Configuration
 *
 * <p>This configuration delays the startup of memory-intensive services to prevent OOM errors
 * during application startup on 512MB instances.
 */
@Configuration
public class StartupOptimizationConfig {

  private static final Logger logger = LoggerFactory.getLogger(StartupOptimizationConfig.class);

  @Value("${storesight.startup.optimization.enabled:true}")
  private boolean optimizationEnabled;

  @Value("${storesight.startup.monitoring-gradual-enable-delay:PT30M}")
  private String monitoringGradualEnableDelay;

  @EventListener
  @Order(1000) // Run after other startup tasks
  public void onApplicationReady(ApplicationReadyEvent event) {
    if (!optimizationEnabled) {
      logger.info("Startup optimization disabled");
      return;
    }

    logger.info("Startup optimization enabled - monitoring services will be gradually enabled");
    logger.info(
        "Memory-intensive monitoring services delayed by: {}", monitoringGradualEnableDelay);

    // Log memory usage after startup
    Runtime runtime = Runtime.getRuntime();
    long usedMemory = runtime.totalMemory() - runtime.freeMemory();
    long freeMemory = runtime.freeMemory();
    long maxMemory = runtime.maxMemory();
    double memoryUsagePercent = (double) usedMemory / maxMemory * 100;

    logger.info(
        "Startup complete - Memory usage: {}MB used, {}MB free, {}MB max",
        usedMemory / (1024 * 1024),
        freeMemory / (1024 * 1024),
        maxMemory / (1024 * 1024));
    logger.info("Memory usage: {:.1f}% of maximum heap", memoryUsagePercent);

    if (memoryUsagePercent > 70) {
      logger.warn("High memory usage detected at startup: {:.1f}%", memoryUsagePercent);
    }

    // Suggest GC to free up memory after startup
    System.gc();

    // Log memory after GC
    runtime = Runtime.getRuntime();
    long totalMemory = runtime.totalMemory();
    freeMemory = runtime.freeMemory();
    usedMemory = totalMemory - freeMemory;

    logger.info(
        "After GC - Memory usage: {}MB used, {}MB free",
        usedMemory / (1024 * 1024),
        freeMemory / (1024 * 1024));
  }
}
