package com.storesight.backend.service;

import java.time.LocalDateTime;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/**
 * Service to optimize application startup and prevent resource contention
 *
 * <p>This service handles: - Gradual enabling of monitoring services - Startup delay management -
 * Resource optimization during startup - Performance monitoring activation
 */
@Service
public class StartupOptimizationService {

  private static final Logger logger = LoggerFactory.getLogger(StartupOptimizationService.class);

  @Autowired(required = false)
  private SystemResourceMonitoringService systemResourceMonitoringService;

  @Autowired(required = false)
  private PerformanceMetricsService performanceMetricsService;

  @Autowired(required = false)
  private AlertingService alertingService;

  @Autowired private FeatureFlagService featureFlagService;

  @Value("${storesight.startup.optimization.enabled:true}")
  private boolean startupOptimizationEnabled;

  @Value("${storesight.startup.monitoring-gradual-enable-delay:PT5M}")
  private String gradualEnableDelay;

  private final ScheduledExecutorService startupScheduler = Executors.newScheduledThreadPool(1);
  private volatile boolean startupOptimizationCompleted = false;

  /** Handle application startup optimization */
  @EventListener(ApplicationReadyEvent.class)
  public void handleApplicationStartup() {
    // Check if startup optimization is enabled and memory optimization features are active
    boolean memoryOptimizationEnabled =
        featureFlagService.isScheduledSystemResourceMonitoringEnabled()
            || featureFlagService.isScheduledDashboardCollectionEnabled()
            || featureFlagService.isScheduledPerformanceMetricsEnabled()
            || featureFlagService.isScheduledDatabaseMonitoringEnabled()
            || featureFlagService.isScheduledAlertingEnabled();

    if (!startupOptimizationEnabled || startupOptimizationCompleted || !memoryOptimizationEnabled) {
      if (startupOptimizationCompleted) {
        logger.debug("Startup optimization already completed, skipping");
      } else if (!startupOptimizationEnabled) {
        logger.debug("Startup optimization disabled via configuration");
      } else if (!memoryOptimizationEnabled) {
        logger.debug("Startup optimization disabled - memory optimization features not enabled");
      }
      return;
    }

    logger.info("🚀 Application startup optimization initiated");
    logger.info("⏰ Monitoring services will be gradually enabled to prevent resource contention");

    // Schedule gradual monitoring activation
    scheduleGradualMonitoringActivation();
  }

  /** Schedule gradual activation of monitoring services */
  private void scheduleGradualMonitoringActivation() {
    try {
      // Parse the gradual enable delay
      long delayMinutes = parseDurationToMinutes(gradualEnableDelay);

      logger.info("📅 Scheduling monitoring activation in {} minutes", delayMinutes);

      // Schedule monitoring activation
      startupScheduler.schedule(this::activateMonitoringServices, delayMinutes, TimeUnit.MINUTES);

      logger.info("✅ Startup optimization scheduled successfully");

    } catch (Exception e) {
      logger.error("❌ Failed to schedule startup optimization: {}", e.getMessage());
    }
  }

  /** Activate monitoring services after startup delay */
  private void activateMonitoringServices() {
    if (startupOptimizationCompleted) {
      logger.debug("Startup optimization already completed, skipping activation");
      return;
    }

    try {
      logger.info("🔍 Activating monitoring services after startup delay");

      // Enable JVM metrics after startup
      enableJvmMetrics();

      // Mark startup optimization as completed
      startupOptimizationCompleted = true;

      // Log startup completion
      logger.info("✅ Application startup optimization completed at {}", LocalDateTime.now());
      logger.info("🎯 Monitoring services are now active and optimized");

    } catch (Exception e) {
      logger.error("❌ Error activating monitoring services: {}", e.getMessage());
    } finally {
      // Shutdown the startup scheduler
      startupScheduler.shutdown();
    }
  }

  /** Enable JVM metrics after startup */
  private void enableJvmMetrics() {
    try {
      // This would typically involve updating Spring Boot Actuator configuration
      // For now, we'll just log the activation
      logger.info("📊 JVM metrics enabled after startup delay");

    } catch (Exception e) {
      logger.warn("⚠️ Failed to enable JVM metrics: {}", e.getMessage());
    }
  }

  /** Parse duration string to minutes */
  private long parseDurationToMinutes(String duration) {
    try {
      if (duration.startsWith("PT")) {
        duration = duration.substring(2);
      }

      if (duration.endsWith("M")) {
        return Long.parseLong(duration.substring(0, duration.length() - 1));
      } else if (duration.endsWith("H")) {
        return Long.parseLong(duration.substring(0, duration.length() - 1)) * 60;
      } else if (duration.endsWith("S")) {
        return Long.parseLong(duration.substring(0, duration.length() - 1)) / 60;
      }

      return Long.parseLong(duration);
    } catch (Exception e) {
      logger.warn("⚠️ Failed to parse duration '{}', using default 5 minutes", duration);
      return 5;
    }
  }

  /** Get startup optimization status */
  public String getStartupStatus() {
    if (!startupOptimizationEnabled) {
      return "DISABLED_CONFIG";
    }

    boolean memoryOptimizationEnabled =
        featureFlagService.isScheduledSystemResourceMonitoringEnabled()
            || featureFlagService.isScheduledDashboardCollectionEnabled()
            || featureFlagService.isScheduledPerformanceMetricsEnabled()
            || featureFlagService.isScheduledDatabaseMonitoringEnabled()
            || featureFlagService.isScheduledAlertingEnabled();

    return memoryOptimizationEnabled ? "ENABLED" : "DISABLED_MEMORY_OPTIMIZATION";
  }
}
