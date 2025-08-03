package com.storesight.backend.service;

import com.storesight.backend.config.MemoryProfileConfig;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Configuration Validation Service
 *
 * <p>Validates system configuration for production readiness and provides intelligent
 * recommendations for optimization.
 */
@Service
public class ConfigurationValidationService {

  private static final Logger logger =
      LoggerFactory.getLogger(ConfigurationValidationService.class);

  @Autowired private MemoryProfileConfig memoryProfileConfig;

  @Value("${spring.profiles.active:default}")
  private String activeProfile;

  @Value("${spring.datasource.hikari.maximum-pool-size:10}")
  private int dbPoolSize;

  @Value("${server.tomcat.max-threads:200}")
  private int tomcatMaxThreads;

  @Value("${management.endpoints.web.exposure.include:health}")
  private String exposedEndpoints;

  // Note: Validation is performed on-demand only, not on startup

  /** Validate memory profile configuration */
  private void validateMemoryProfile(List<String> warnings, List<String> errors) {
    String profile = memoryProfileConfig.getMemoryProfile();
    Runtime runtime = Runtime.getRuntime();
    long maxMemoryMB = runtime.maxMemory() / 1024 / 1024;

    // Validate profile matches available memory
    switch (profile.toUpperCase()) {
      case "512MB":
        if (maxMemoryMB > 600) {
          warnings.add(
              "Running 512MB profile on "
                  + maxMemoryMB
                  + "MB heap - consider upgrading to 1GB profile");
        }
        break;
      case "1GB":
        if (maxMemoryMB < 600) {
          errors.add(
              "1GB profile requires at least 768MB heap, but only " + maxMemoryMB + "MB available");
        } else if (maxMemoryMB > 1200) {
          warnings.add(
              "Running 1GB profile on "
                  + maxMemoryMB
                  + "MB heap - consider upgrading to 2GB profile");
        }
        break;
      case "2GB":
        if (maxMemoryMB < 1200) {
          errors.add(
              "2GB profile requires at least 1536MB heap, but only "
                  + maxMemoryMB
                  + "MB available");
        }
        break;
      default:
        errors.add("Unknown memory profile: " + profile);
    }

    // Validate profile-specific settings
    MemoryProfileConfig.MemorySettings settings = memoryProfileConfig.getActiveSettings();
    if (settings.getDbPoolMaxSize() > 20) {
      warnings.add(
          "Database pool size ("
              + settings.getDbPoolMaxSize()
              + ") is very high - may cause memory issues");
    }

    if (settings.getTomcatMaxThreads() > 200) {
      warnings.add(
          "Tomcat thread count ("
              + settings.getTomcatMaxThreads()
              + ") is very high - may cause memory issues");
    }
  }

  /** Validate database configuration */
  private void validateDatabaseConfiguration(List<String> warnings, List<String> errors) {
    if (dbPoolSize < 2) {
      warnings.add(
          "Database pool size (" + dbPoolSize + ") is very low - may cause connection bottlenecks");
    } else if (dbPoolSize > 50) {
      warnings.add(
          "Database pool size (" + dbPoolSize + ") is very high - may cause memory issues");
    }

    // Validate pool size matches memory profile
    MemoryProfileConfig.MemorySettings settings = memoryProfileConfig.getActiveSettings();
    if (dbPoolSize != settings.getDbPoolMaxSize()) {
      warnings.add(
          "Database pool size ("
              + dbPoolSize
              + ") doesn't match memory profile recommendation ("
              + settings.getDbPoolMaxSize()
              + ")");
    }
  }

  /** Validate Tomcat configuration */
  private void validateTomcatConfiguration(List<String> warnings, List<String> errors) {
    if (tomcatMaxThreads < 10) {
      warnings.add(
          "Tomcat max threads (" + tomcatMaxThreads + ") is very low - may cause request queuing");
    } else if (tomcatMaxThreads > 500) {
      warnings.add(
          "Tomcat max threads (" + tomcatMaxThreads + ") is very high - may cause memory issues");
    }

    // Validate thread count matches memory profile
    MemoryProfileConfig.MemorySettings settings = memoryProfileConfig.getActiveSettings();
    if (tomcatMaxThreads != settings.getTomcatMaxThreads()) {
      warnings.add(
          "Tomcat max threads ("
              + tomcatMaxThreads
              + ") doesn't match memory profile recommendation ("
              + settings.getTomcatMaxThreads()
              + ")");
    }
  }

  /** Validate security configuration */
  private void validateSecurityConfiguration(List<String> warnings, List<String> errors) {
    if (!"prod".equals(activeProfile) && !"production".equals(activeProfile)) {
      warnings.add("Not running in production profile - ensure security settings are appropriate");
    }

    // Check if sensitive endpoints are exposed
    if (exposedEndpoints.contains("env") || exposedEndpoints.contains("configprops")) {
      warnings.add("Sensitive management endpoints are exposed - review security implications");
    }
  }

  /** Validate monitoring configuration */
  private void validateMonitoringConfiguration(List<String> warnings, List<String> errors) {
    // Check if essential health endpoints are available
    if (!exposedEndpoints.contains("health")) {
      errors.add("Health endpoint not exposed - required for load balancer health checks");
    }

    // Validate memory profile has appropriate monitoring
    if (memoryProfileConfig.isEmergencyMode()) {
      warnings.add("Running in emergency mode - monitoring may be limited");
    }
  }

  /** Get validation results for API consumption (on-demand only) */
  public Map<String, Object> getValidationResults() {
    // Perform validation on-demand
    List<String> validationWarnings = new ArrayList<>();
    List<String> validationErrors = new ArrayList<>();

    // Run all validations
    validateMemoryProfile(validationWarnings, validationErrors);
    validateDatabaseConfiguration(validationWarnings, validationErrors);
    validateTomcatConfiguration(validationWarnings, validationErrors);
    validateSecurityConfiguration(validationWarnings, validationErrors);
    validateMonitoringConfiguration(validationWarnings, validationErrors);

    Map<String, Object> results = new HashMap<>();
    results.put("status", validationErrors.isEmpty() ? "VALID" : "INVALID");
    results.put("errors", validationErrors);
    results.put("warnings", validationWarnings);
    results.put("errorCount", validationErrors.size());
    results.put("warningCount", validationWarnings.size());

    // Add configuration summary
    Map<String, Object> config = new HashMap<>();
    config.put("memoryProfile", memoryProfileConfig.getMemoryProfile());
    config.put("activeProfile", activeProfile);
    config.put("dbPoolSize", dbPoolSize);
    config.put("tomcatMaxThreads", tomcatMaxThreads);
    config.put("scalingRecommendation", memoryProfileConfig.getScalingRecommendation());
    config.put("nextRecommendedProfile", memoryProfileConfig.getNextRecommendedProfile());
    config.put("underMemoryPressure", memoryProfileConfig.isUnderMemoryPressure());

    results.put("configuration", config);

    return results;
  }

  /** Validate configuration on demand (same as getValidationResults) */
  public void revalidateConfiguration() {
    logger.info("Configuration validation requested via Admin UI");
    // Validation is performed on-demand in getValidationResults()
  }
}
