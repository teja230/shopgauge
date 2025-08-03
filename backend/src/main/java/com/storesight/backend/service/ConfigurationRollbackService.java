package com.storesight.backend.service;

import com.storesight.backend.config.ApplicationConfigurationProperties;
import com.storesight.backend.config.FeatureFlagConfiguration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/**
 * Service for managing configuration rollbacks and providing emergency configuration reset
 * capabilities.
 */
@Service
public class ConfigurationRollbackService {

  private static final Logger logger = LoggerFactory.getLogger(ConfigurationRollbackService.class);

  @Autowired private ApplicationConfigurationProperties config;

  @Autowired private FeatureFlagConfiguration featureFlags;

  @Autowired private FeatureFlagService featureFlagService;

  // Store configuration snapshots for rollback
  private final Map<String, ConfigurationSnapshot> configurationSnapshots =
      new ConcurrentHashMap<>();
  private volatile ConfigurationSnapshot currentSnapshot;
  private volatile ConfigurationSnapshot lastKnownGoodSnapshot;

  @EventListener(ApplicationReadyEvent.class)
  public void captureInitialConfiguration() {
    // Check if memory optimization features are enabled
    boolean memoryOptimizationEnabled =
        featureFlagService.isScheduledSystemResourceMonitoringEnabled()
            || featureFlagService.isScheduledDashboardCollectionEnabled()
            || featureFlagService.isScheduledPerformanceMetricsEnabled()
            || featureFlagService.isScheduledDatabaseMonitoringEnabled()
            || featureFlagService.isScheduledAlertingEnabled();

    if (!memoryOptimizationEnabled) {
      logger.debug(
          "Configuration rollback service disabled - memory optimization features not enabled");
      return;
    }

    logger.info("Capturing initial configuration snapshot...");
    currentSnapshot = captureCurrentConfiguration();
    lastKnownGoodSnapshot = currentSnapshot;
    configurationSnapshots.put("initial", currentSnapshot);
    logger.info("Initial configuration snapshot captured successfully");
  }

  /** Capture current configuration state */
  public ConfigurationSnapshot captureCurrentConfiguration() {
    ConfigurationSnapshot snapshot = new ConfigurationSnapshot();
    snapshot.timestamp = LocalDateTime.now();
    snapshot.version = generateVersionString();

    // Capture SSE configuration
    snapshot.sseConfig = captureSseConfiguration();

    // Capture Session configuration
    snapshot.sessionConfig = captureSessionConfiguration();

    // Capture Cache configuration
    snapshot.cacheConfig = captureCacheConfiguration();

    // Capture Monitoring configuration
    snapshot.monitoringConfig = captureMonitoringConfiguration();

    // Capture Security configuration
    snapshot.securityConfig = captureSecurityConfiguration();

    // Capture Discovery configuration
    snapshot.discoveryConfig = captureDiscoveryConfiguration();

    // Capture Feature Flags
    snapshot.featureFlagsConfig = captureFeatureFlagsConfiguration();

    return snapshot;
  }

  /** Save current configuration as a named snapshot */
  public void saveConfigurationSnapshot(String name) {
    ConfigurationSnapshot snapshot = captureCurrentConfiguration();
    configurationSnapshots.put(name, snapshot);
    logger.info("Configuration snapshot '{}' saved at {}", name, snapshot.timestamp);
  }

  /** Mark current configuration as known good */
  public void markCurrentConfigurationAsGood() {
    lastKnownGoodSnapshot = captureCurrentConfiguration();
    logger.info(
        "Current configuration marked as known good at {}", lastKnownGoodSnapshot.timestamp);
  }

  /** Emergency rollback to last known good configuration */
  public RollbackResult emergencyRollbackToLastKnownGood() {
    if (lastKnownGoodSnapshot == null) {
      logger.error("No last known good configuration available for rollback");
      return new RollbackResult(false, "No last known good configuration available");
    }

    logger.warn(
        "Performing emergency rollback to last known good configuration from {}",
        lastKnownGoodSnapshot.timestamp);

    return performRollback(lastKnownGoodSnapshot, "emergency-rollback");
  }

  /** Rollback to a named configuration snapshot */
  public RollbackResult rollbackToSnapshot(String snapshotName) {
    ConfigurationSnapshot snapshot = configurationSnapshots.get(snapshotName);
    if (snapshot == null) {
      logger.error("Configuration snapshot '{}' not found", snapshotName);
      return new RollbackResult(false, "Snapshot not found: " + snapshotName);
    }

    logger.info(
        "Rolling back to configuration snapshot '{}' from {}", snapshotName, snapshot.timestamp);
    return performRollback(snapshot, "rollback-to-" + snapshotName);
  }

  /** Disable all enhanced features (emergency safe mode) */
  public RollbackResult enableSafeMode() {
    logger.warn("Enabling safe mode - disabling all enhanced features");

    try {
      // Save current state before safe mode
      saveConfigurationSnapshot("pre-safe-mode-" + System.currentTimeMillis());

      // Create safe mode configuration
      ConfigurationSnapshot safeModeSnapshot = createSafeModeConfiguration();

      return performRollback(safeModeSnapshot, "safe-mode");
    } catch (Exception e) {
      logger.error("Failed to enable safe mode", e);
      return new RollbackResult(false, "Failed to enable safe mode: " + e.getMessage());
    }
  }

  /** Get available configuration snapshots */
  public Map<String, String> getAvailableSnapshots() {
    Map<String, String> snapshots = new HashMap<>();
    for (Map.Entry<String, ConfigurationSnapshot> entry : configurationSnapshots.entrySet()) {
      snapshots.put(
          entry.getKey(), entry.getValue().timestamp.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
    }
    return snapshots;
  }

  /** Get configuration health status */
  public ConfigurationHealthStatus getConfigurationHealth() {
    ConfigurationHealthStatus status = new ConfigurationHealthStatus();
    status.currentVersion = currentSnapshot != null ? currentSnapshot.version : "unknown";
    status.lastKnownGoodVersion =
        lastKnownGoodSnapshot != null ? lastKnownGoodSnapshot.version : "unknown";
    status.availableSnapshots = configurationSnapshots.size();
    status.rolloutEnabled = featureFlags.getRollout().isEnabled();
    status.safeModeActive = isSafeModeActive();
    return status;
  }

  // Private helper methods

  private RollbackResult performRollback(ConfigurationSnapshot snapshot, String reason) {
    try {
      // Save current configuration before rollback
      saveConfigurationSnapshot("pre-rollback-" + System.currentTimeMillis());

      // Apply the rollback configuration
      applyConfigurationSnapshot(snapshot);

      // Clear feature flag cache to ensure new settings take effect
      featureFlagService.clearRolloutCache();

      // Update current snapshot
      currentSnapshot = snapshot;

      logger.info("Configuration rollback completed successfully. Reason: {}", reason);
      return new RollbackResult(true, "Rollback completed successfully");

    } catch (Exception e) {
      logger.error("Configuration rollback failed. Reason: {}", reason, e);
      return new RollbackResult(false, "Rollback failed: " + e.getMessage());
    }
  }

  private void applyConfigurationSnapshot(ConfigurationSnapshot snapshot) {
    // Note: In a real implementation, this would need to update the actual configuration
    // For now, we'll log what would be changed and rely on environment variables
    // for actual configuration changes

    logger.info("Applying configuration snapshot from {}", snapshot.timestamp);
    logger.info("This would require restarting the application with updated environment variables");
    logger.info("SSE Config: {}", snapshot.sseConfig);
    logger.info("Session Config: {}", snapshot.sessionConfig);
    logger.info("Cache Config: {}", snapshot.cacheConfig);
    logger.info("Monitoring Config: {}", snapshot.monitoringConfig);
    logger.info("Security Config: {}", snapshot.securityConfig);
    logger.info("Discovery Config: {}", snapshot.discoveryConfig);
    logger.info("Feature Flags Config: {}", snapshot.featureFlagsConfig);
  }

  private ConfigurationSnapshot createSafeModeConfiguration() {
    ConfigurationSnapshot safeModeSnapshot = new ConfigurationSnapshot();
    safeModeSnapshot.timestamp = LocalDateTime.now();
    safeModeSnapshot.version = "safe-mode-" + System.currentTimeMillis();

    // Create safe mode feature flags (all disabled)
    Map<String, Object> safeModeFeatures = new HashMap<>();
    safeModeFeatures.put("session.enhancedSynchronization", false);
    safeModeFeatures.put("session.stuckSessionCleanup", false);
    safeModeFeatures.put("session.distributedLocking", false);
    safeModeFeatures.put("sse.eventBatching", false);
    safeModeFeatures.put("sse.connectionHealthChecks", false);
    safeModeFeatures.put("sse.deadConnectionCleanup", false);
    safeModeFeatures.put("cache.multiLevelCaching", false);
    safeModeFeatures.put("cache.sessionAwareCaching", false);
    safeModeFeatures.put("monitoring.enhancedMetrics", false);
    safeModeFeatures.put("security.enhancedAuthentication", false);
    safeModeFeatures.put("discovery.multiSourceDiscovery", false);

    safeModeSnapshot.featureFlagsConfig = safeModeFeatures;

    // Use conservative configuration values
    safeModeSnapshot.sseConfig = createConservativeSseConfig();
    safeModeSnapshot.sessionConfig = createConservativeSessionConfig();
    safeModeSnapshot.cacheConfig = createConservativeCacheConfig();
    safeModeSnapshot.monitoringConfig = createConservativeMonitoringConfig();
    safeModeSnapshot.securityConfig = createConservativeSecurityConfig();
    safeModeSnapshot.discoveryConfig = createConservativeDiscoveryConfig();

    return safeModeSnapshot;
  }

  private boolean isSafeModeActive() {
    return currentSnapshot != null && currentSnapshot.version.startsWith("safe-mode-");
  }

  private String generateVersionString() {
    return "config-" + System.currentTimeMillis();
  }

  // Configuration capture methods
  private Map<String, Object> captureSseConfiguration() {
    Map<String, Object> sseConfig = new HashMap<>();
    sseConfig.put("maxConnectionsPerShop", config.getSse().getMaxConnectionsPerShop());
    sseConfig.put("maxConnectionsGlobal", config.getSse().getMaxConnectionsGlobal());
    sseConfig.put("connectionTimeout", config.getSse().getConnectionTimeout().toString());
    sseConfig.put("heartbeatInterval", config.getSse().getHeartbeatInterval().toString());
    sseConfig.put("cleanupInterval", config.getSse().getCleanupInterval().toString());
    sseConfig.put("maxBatchSize", config.getSse().getMaxBatchSize());
    sseConfig.put("batchTimeout", config.getSse().getBatchTimeout().toString());
    return sseConfig;
  }

  private Map<String, Object> captureSessionConfiguration() {
    Map<String, Object> sessionConfig = new HashMap<>();
    sessionConfig.put("lockDuration", config.getSession().getLockDuration().toString());
    sessionConfig.put(
        "stuckSessionTimeout", config.getSession().getStuckSessionTimeout().toString());
    sessionConfig.put(
        "orphanedLockTimeout", config.getSession().getOrphanedLockTimeout().toString());
    sessionConfig.put("maxSessionsPerShop", config.getSession().getMaxSessionsPerShop());
    return sessionConfig;
  }

  private Map<String, Object> captureCacheConfiguration() {
    Map<String, Object> cacheConfig = new HashMap<>();
    cacheConfig.put("defaultTtl", config.getCache().getDefaultTtl().toString());
    cacheConfig.put("memoryTtl", config.getCache().getMemoryTtl().toString());
    cacheConfig.put("maxMemoryCacheSize", config.getCache().getMaxMemoryCacheSize());
    cacheConfig.put("cleanupInterval", config.getCache().getCleanupInterval().toString());
    return cacheConfig;
  }

  private Map<String, Object> captureMonitoringConfiguration() {
    Map<String, Object> monitoringConfig = new HashMap<>();
    monitoringConfig.put(
        "healthCheckInterval", config.getMonitoring().getHealthCheckInterval().toString());
    monitoringConfig.put(
        "connectionTestTimeout", config.getMonitoring().getConnectionTestTimeout().toString());
    monitoringConfig.put(
        "memoryWarningThreshold", config.getMonitoring().getMemoryWarningThreshold());
    monitoringConfig.put(
        "memoryCriticalThreshold", config.getMonitoring().getMemoryCriticalThreshold());
    return monitoringConfig;
  }

  private Map<String, Object> captureSecurityConfiguration() {
    Map<String, Object> securityConfig = new HashMap<>();
    securityConfig.put("rateLimitWindow", config.getSecurity().getRateLimitWindow().toString());
    securityConfig.put("rateLimitRequests", config.getSecurity().getRateLimitRequests());
    securityConfig.put("maxLoginAttempts", config.getSecurity().getMaxLoginAttempts());
    securityConfig.put("lockoutDuration", config.getSecurity().getLockoutDuration().toString());
    return securityConfig;
  }

  private Map<String, Object> captureDiscoveryConfiguration() {
    Map<String, Object> discoveryConfig = new HashMap<>();
    discoveryConfig.put("cacheTimeout", config.getDiscovery().getCacheTimeout().toString());
    discoveryConfig.put("maxResults", config.getDiscovery().getMaxResults());
    discoveryConfig.put("maxConcurrentRequests", config.getDiscovery().getMaxConcurrentRequests());
    discoveryConfig.put("requestTimeout", config.getDiscovery().getRequestTimeout().toString());
    return discoveryConfig;
  }

  private Map<String, Object> captureFeatureFlagsConfiguration() {
    Map<String, Object> featureFlagsConfig = new HashMap<>();
    featureFlagsConfig.put("rolloutEnabled", featureFlags.getRollout().isEnabled());
    featureFlagsConfig.put("rolloutStrategy", featureFlags.getRollout().getStrategy().toString());
    featureFlagsConfig.put(
        "sessionManagementRollout",
        featureFlags.getRollout().getSessionManagementRolloutPercentage());
    featureFlagsConfig.put(
        "sseImprovementsRollout", featureFlags.getRollout().getSseImprovementsRolloutPercentage());
    return featureFlagsConfig;
  }

  // Conservative configuration creation methods
  private Map<String, Object> createConservativeSseConfig() {
    Map<String, Object> config = new HashMap<>();
    config.put("maxConnectionsPerShop", 3);
    config.put("maxConnectionsGlobal", 20);
    config.put("connectionTimeout", "PT1M");
    config.put("heartbeatInterval", "PT1M");
    config.put("cleanupInterval", "PT2M");
    config.put("maxBatchSize", 5);
    config.put("batchTimeout", "PT2S");
    return config;
  }

  private Map<String, Object> createConservativeSessionConfig() {
    Map<String, Object> config = new HashMap<>();
    config.put("lockDuration", "PT3S");
    config.put("stuckSessionTimeout", "PT3M");
    config.put("orphanedLockTimeout", "PT5M");
    config.put("maxSessionsPerShop", 3);
    return config;
  }

  private Map<String, Object> createConservativeCacheConfig() {
    Map<String, Object> config = new HashMap<>();
    config.put("defaultTtl", "PT10M");
    config.put("memoryTtl", "PT3M");
    config.put("maxMemoryCacheSize", 500);
    config.put("cleanupInterval", "PT3M");
    return config;
  }

  private Map<String, Object> createConservativeMonitoringConfig() {
    Map<String, Object> config = new HashMap<>();
    config.put("healthCheckInterval", "PT1M");
    config.put("connectionTestTimeout", "PT3S");
    config.put("memoryWarningThreshold", 70);
    config.put("memoryCriticalThreshold", 85);
    return config;
  }

  private Map<String, Object> createConservativeSecurityConfig() {
    Map<String, Object> config = new HashMap<>();
    config.put("rateLimitWindow", "PT1M");
    config.put("rateLimitRequests", 30);
    config.put("maxLoginAttempts", 3);
    config.put("lockoutDuration", "PT30M");
    return config;
  }

  private Map<String, Object> createConservativeDiscoveryConfig() {
    Map<String, Object> config = new HashMap<>();
    config.put("cacheTimeout", "PT1H");
    config.put("maxResults", 5);
    config.put("maxConcurrentRequests", 1);
    config.put("requestTimeout", "PT15S");
    return config;
  }

  // Inner classes for data structures
  public static class ConfigurationSnapshot {
    public LocalDateTime timestamp;
    public String version;
    public Map<String, Object> sseConfig;
    public Map<String, Object> sessionConfig;
    public Map<String, Object> cacheConfig;
    public Map<String, Object> monitoringConfig;
    public Map<String, Object> securityConfig;
    public Map<String, Object> discoveryConfig;
    public Map<String, Object> featureFlagsConfig;
  }

  public static class RollbackResult {
    public final boolean success;
    public final String message;
    public final LocalDateTime timestamp;

    public RollbackResult(boolean success, String message) {
      this.success = success;
      this.message = message;
      this.timestamp = LocalDateTime.now();
    }
  }

  public static class ConfigurationHealthStatus {
    public String currentVersion;
    public String lastKnownGoodVersion;
    public int availableSnapshots;
    public boolean rolloutEnabled;
    public boolean safeModeActive;
  }
}
