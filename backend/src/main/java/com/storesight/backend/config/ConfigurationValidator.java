package com.storesight.backend.config;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Configuration validator that validates all application configuration properties on startup and
 * logs any issues or warnings.
 */
@Component
public class ConfigurationValidator {

  private static final Logger logger = LoggerFactory.getLogger(ConfigurationValidator.class);

  @Autowired private ApplicationConfigurationProperties config;

  @EventListener(ApplicationReadyEvent.class)
  public void validateConfiguration() {
    logger.info("Starting configuration validation...");

    List<String> warnings = new ArrayList<>();
    List<String> errors = new ArrayList<>();

    validateSseConfiguration(warnings, errors);
    validateSessionConfiguration(warnings, errors);
    validateCacheConfiguration(warnings, errors);
    validateMonitoringConfiguration(warnings, errors);
    validateSecurityConfiguration(warnings, errors);
    validateDiscoveryConfiguration(warnings, errors);

    // Log results
    if (!warnings.isEmpty()) {
      logger.warn("Configuration validation warnings:");
      warnings.forEach(warning -> logger.warn("  - {}", warning));
    }

    if (!errors.isEmpty()) {
      logger.error("Configuration validation errors:");
      errors.forEach(error -> logger.error("  - {}", error));
      throw new IllegalStateException(
          "Configuration validation failed with " + errors.size() + " errors");
    }

    if (warnings.isEmpty() && errors.isEmpty()) {
      logger.info("Configuration validation completed successfully - all values are valid");
    } else {
      logger.info(
          "Configuration validation completed with {} warnings and {} errors",
          warnings.size(),
          errors.size());
    }
  }

  private void validateSseConfiguration(List<String> warnings, List<String> errors) {
    ApplicationConfigurationProperties.SseConfiguration sse = config.getSse();

    // Validate connection limits
    if (sse.getMaxConnectionsPerShop() > sse.getMaxConnectionsGlobal()) {
      errors.add(
          "SSE max connections per shop ("
              + sse.getMaxConnectionsPerShop()
              + ") cannot be greater than global max ("
              + sse.getMaxConnectionsGlobal()
              + ")");
    }

    // Validate timeouts
    if (sse.getConnectionTimeout().compareTo(Duration.ofSeconds(30)) < 0) {
      warnings.add("SSE connection timeout is very short: " + sse.getConnectionTimeout());
    }

    if (sse.getBatchTimeout().compareTo(Duration.ofMillis(100)) < 0) {
      warnings.add("SSE batch timeout is very short: " + sse.getBatchTimeout());
    }

    // Validate batch settings
    if (sse.getMaxBatchSize() > sse.getMaxBatchQueueSize()) {
      errors.add(
          "SSE max batch size ("
              + sse.getMaxBatchSize()
              + ") cannot be greater than max batch queue size ("
              + sse.getMaxBatchQueueSize()
              + ")");
    }

    // Validate cleanup intervals
    if (sse.getCleanupInterval().compareTo(sse.getHeartbeatInterval()) < 0) {
      warnings.add("SSE cleanup interval should be longer than heartbeat interval");
    }
  }

  private void validateSessionConfiguration(List<String> warnings, List<String> errors) {
    ApplicationConfigurationProperties.SessionConfiguration session = config.getSession();

    // Validate timeout relationships
    if (session.getLockDuration().compareTo(Duration.ofSeconds(1)) < 0) {
      warnings.add("Session lock duration is very short: " + session.getLockDuration());
    }

    if (session.getStuckSessionTimeout().compareTo(session.getLockDuration()) <= 0) {
      errors.add("Stuck session timeout must be longer than lock duration");
    }

    if (session.getOrphanedLockTimeout().compareTo(session.getStuckSessionTimeout()) <= 0) {
      warnings.add("Orphaned lock timeout should be longer than stuck session timeout");
    }

    // Validate TTL relationships
    if (session.getSessionTokenTtl().compareTo(session.getSessionDataTtl()) > 0) {
      warnings.add("Session token TTL is longer than session data TTL - this may cause issues");
    }
  }

  private void validateCacheConfiguration(List<String> warnings, List<String> errors) {
    ApplicationConfigurationProperties.CacheConfiguration cache = config.getCache();

    // Validate TTL relationships
    if (cache.getMemoryTtl().compareTo(cache.getDefaultTtl()) > 0) {
      warnings.add("Memory cache TTL is longer than default TTL - this may cause stale data");
    }

    // Validate cleanup interval
    if (cache.getCleanupInterval().compareTo(cache.getDefaultTtl()) > 0) {
      warnings.add(
          "Cache cleanup interval is longer than default TTL - expired entries may accumulate");
    }

    // Validate memory cache size
    if (cache.getMaxMemoryCacheSize() < 100) {
      warnings.add("Memory cache size is very small: " + cache.getMaxMemoryCacheSize());
    }
  }

  private void validateMonitoringConfiguration(List<String> warnings, List<String> errors) {
    ApplicationConfigurationProperties.MonitoringConfiguration monitoring = config.getMonitoring();

    // Validate threshold relationships
    if (monitoring.getMemoryWarningThreshold() >= monitoring.getMemoryCriticalThreshold()) {
      errors.add("Memory warning threshold must be less than critical threshold");
    }

    if (monitoring.getCpuWarningThreshold() >= monitoring.getCpuCriticalThreshold()) {
      errors.add("CPU warning threshold must be less than critical threshold");
    }

    if (monitoring.getDiskWarningThreshold() >= monitoring.getDiskCriticalThreshold()) {
      errors.add("Disk warning threshold must be less than critical threshold");
    }

    if (monitoring.getConnectionPoolWarningThreshold()
        >= monitoring.getConnectionPoolCriticalThreshold()) {
      errors.add("Connection pool warning threshold must be less than critical threshold");
    }

    // Validate intervals
    if (monitoring.getHealthCheckInterval().compareTo(Duration.ofSeconds(10)) < 0) {
      warnings.add(
          "Health check interval is very frequent: " + monitoring.getHealthCheckInterval());
    }

    if (monitoring.getConnectionTestTimeout().compareTo(Duration.ofSeconds(1)) < 0) {
      warnings.add(
          "Connection test timeout is very short: " + monitoring.getConnectionTestTimeout());
    }
  }

  private void validateSecurityConfiguration(List<String> warnings, List<String> errors) {
    ApplicationConfigurationProperties.SecurityConfiguration security = config.getSecurity();

    // Validate rate limiting
    if (security.getRateLimitRequests() < 10) {
      warnings.add(
          "Rate limit is very restrictive: "
              + security.getRateLimitRequests()
              + " requests per "
              + security.getRateLimitWindow());
    }

    // Validate lockout settings
    if (security.getMaxLoginAttempts() < 3) {
      warnings.add("Max login attempts is very restrictive: " + security.getMaxLoginAttempts());
    }

    if (security.getLockoutDuration().compareTo(Duration.ofMinutes(5)) < 0) {
      warnings.add("Lockout duration is very short: " + security.getLockoutDuration());
    }

    // Validate session timeout
    if (security.getAdminSessionTimeout().compareTo(Duration.ofMinutes(30)) < 0) {
      warnings.add("Admin session timeout is very short: " + security.getAdminSessionTimeout());
    }

    // Validate token expiry
    if (security.getTokenExpiry().compareTo(Duration.ofHours(1)) < 0) {
      warnings.add("Token expiry is very short: " + security.getTokenExpiry());
    }
  }

  private void validateDiscoveryConfiguration(List<String> warnings, List<String> errors) {
    ApplicationConfigurationProperties.DiscoveryConfiguration discovery = config.getDiscovery();

    // Validate limits
    if (discovery.getMaxResults() > 50) {
      warnings.add("Discovery max results is very high: " + discovery.getMaxResults());
    }

    if (discovery.getMaxConcurrentRequests() > 10) {
      warnings.add(
          "Max concurrent discovery requests is very high: "
              + discovery.getMaxConcurrentRequests());
    }

    // Validate timeouts
    if (discovery.getRequestTimeout().compareTo(Duration.ofSeconds(10)) < 0) {
      warnings.add("Discovery request timeout is very short: " + discovery.getRequestTimeout());
    }

    // Validate rate limiting
    if (discovery.getRateLimitDelay().compareTo(Duration.ofMillis(100)) < 0) {
      warnings.add("Discovery rate limit delay is very short: " + discovery.getRateLimitDelay());
    }

    // Validate cache settings
    if (discovery.getCacheTimeout().compareTo(Duration.ofMinutes(30)) < 0) {
      warnings.add("Discovery cache timeout is very short: " + discovery.getCacheTimeout());
    }
  }
}
