package com.storesight.backend.service;

import com.storesight.backend.config.FeatureFlagConfiguration;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Service for managing feature flags and gradual rollout logic. Provides centralized access to
 * feature flags with support for percentage-based rollouts and user/shop-specific targeting.
 */
@Service
public class FeatureFlagService {

  private static final Logger logger = LoggerFactory.getLogger(FeatureFlagService.class);

  @Autowired private FeatureFlagConfiguration featureFlags;

  // Cache for rollout decisions to ensure consistency within a session
  private final ConcurrentMap<String, Boolean> rolloutCache = new ConcurrentHashMap<>();

  /** Session management feature flags */
  public boolean isEnhancedSynchronizationEnabled() {
    return isFeatureEnabled(
        "session.enhancedSynchronization",
        featureFlags.getSession().isEnhancedSynchronization(),
        featureFlags.getRollout().getSessionManagementRolloutPercentage());
  }

  public boolean isStuckSessionCleanupEnabled() {
    return isFeatureEnabled(
        "session.stuckSessionCleanup",
        featureFlags.getSession().isStuckSessionCleanup(),
        featureFlags.getRollout().getSessionManagementRolloutPercentage());
  }

  public boolean isDistributedLockingEnabled() {
    return isFeatureEnabled(
        "session.distributedLocking",
        featureFlags.getSession().isDistributedLocking(),
        featureFlags.getRollout().getSessionManagementRolloutPercentage());
  }

  public boolean isSessionValidationEnabled() {
    return isFeatureEnabled(
        "session.sessionValidation",
        featureFlags.getSession().isSessionValidation(),
        featureFlags.getRollout().getSessionManagementRolloutPercentage());
  }

  public boolean isAsyncSessionUpdatesEnabled() {
    return isFeatureEnabled(
        "session.asyncSessionUpdates",
        featureFlags.getSession().isAsyncSessionUpdates(),
        featureFlags.getRollout().getSessionManagementRolloutPercentage());
  }

  public boolean isSessionMetricsEnabled() {
    return isFeatureEnabled(
        "session.sessionMetrics",
        featureFlags.getSession().isSessionMetrics(),
        featureFlags.getRollout().getSessionManagementRolloutPercentage());
  }

  public boolean isSessionEmergencyCleanupEnabled() {
    return isFeatureEnabled(
        "session.emergencyCleanup",
        featureFlags.getSession().isEmergencyCleanup(),
        featureFlags.getRollout().getSessionManagementRolloutPercentage());
  }

  /** SSE feature flags */
  public boolean isEventBatchingEnabled() {
    return isFeatureEnabled(
        "sse.eventBatching",
        featureFlags.getSse().isEventBatching(),
        featureFlags.getRollout().getSseImprovementsRolloutPercentage());
  }

  public boolean isConnectionHealthChecksEnabled() {
    return isFeatureEnabled(
        "sse.connectionHealthChecks",
        featureFlags.getSse().isConnectionHealthChecks(),
        featureFlags.getRollout().getSseImprovementsRolloutPercentage());
  }

  public boolean isDeadConnectionCleanupEnabled() {
    return isFeatureEnabled(
        "sse.deadConnectionCleanup",
        featureFlags.getSse().isDeadConnectionCleanup(),
        featureFlags.getRollout().getSseImprovementsRolloutPercentage());
  }

  public boolean isSseEmergencyCleanupEnabled() {
    return isFeatureEnabled(
        "sse.emergencyCleanup",
        featureFlags.getSse().isEmergencyCleanup(),
        featureFlags.getRollout().getSseImprovementsRolloutPercentage());
  }

  public boolean isMemoryManagementEnabled() {
    return isFeatureEnabled(
        "sse.memoryManagement",
        featureFlags.getSse().isMemoryManagement(),
        featureFlags.getRollout().getSseImprovementsRolloutPercentage());
  }

  public boolean isConnectionLimitsEnabled() {
    return isFeatureEnabled(
        "sse.connectionLimits",
        featureFlags.getSse().isConnectionLimits(),
        featureFlags.getRollout().getSseImprovementsRolloutPercentage());
  }

  public boolean isHeartbeatMonitoringEnabled() {
    return isFeatureEnabled(
        "sse.heartbeatMonitoring",
        featureFlags.getSse().isHeartbeatMonitoring(),
        featureFlags.getRollout().getSseImprovementsRolloutPercentage());
  }

  public boolean isSsePerformanceMetricsEnabled() {
    return isFeatureEnabled(
        "sse.performanceMetrics",
        featureFlags.getSse().isPerformanceMetrics(),
        featureFlags.getRollout().getSseImprovementsRolloutPercentage());
  }

  /** Cache feature flags */
  public boolean isMultiLevelCachingEnabled() {
    return isFeatureEnabled(
        "cache.multiLevelCaching",
        featureFlags.getCache().isMultiLevelCaching(),
        featureFlags.getRollout().getCacheOptimizationRolloutPercentage());
  }

  public boolean isSessionAwareCachingEnabled() {
    return isFeatureEnabled(
        "cache.sessionAwareCaching",
        featureFlags.getCache().isSessionAwareCaching(),
        featureFlags.getRollout().getCacheOptimizationRolloutPercentage());
  }

  public boolean isCacheStatisticsEnabled() {
    return isFeatureEnabled(
        "cache.cacheStatistics",
        featureFlags.getCache().isCacheStatistics(),
        featureFlags.getRollout().getCacheOptimizationRolloutPercentage());
  }

  public boolean isAutomaticCleanupEnabled() {
    return isFeatureEnabled(
        "cache.automaticCleanup",
        featureFlags.getCache().isAutomaticCleanup(),
        featureFlags.getRollout().getCacheOptimizationRolloutPercentage());
  }

  public boolean isMemoryOptimizationEnabled() {
    return isFeatureEnabled(
        "cache.memoryOptimization",
        featureFlags.getCache().isMemoryOptimization(),
        featureFlags.getRollout().getCacheOptimizationRolloutPercentage());
  }

  public boolean isDistributedCachingEnabled() {
    return isFeatureEnabled(
        "cache.distributedCaching",
        featureFlags.getCache().isDistributedCaching(),
        featureFlags.getRollout().getCacheOptimizationRolloutPercentage());
  }

  public boolean isCacheWarmingEnabled() {
    return isFeatureEnabled(
        "cache.cacheWarming",
        featureFlags.getCache().isCacheWarming(),
        featureFlags.getRollout().getCacheOptimizationRolloutPercentage());
  }

  /** Monitoring feature flags */
  public boolean isEnhancedMetricsEnabled() {
    return isFeatureEnabled(
        "monitoring.enhancedMetrics",
        featureFlags.getMonitoring().isEnhancedMetrics(),
        featureFlags.getRollout().getMonitoringEnhancementsRolloutPercentage());
  }

  public boolean isPerformanceMonitoringEnabled() {
    return isFeatureEnabled(
        "monitoring.performanceMonitoring",
        featureFlags.getMonitoring().isPerformanceMonitoring(),
        featureFlags.getRollout().getMonitoringEnhancementsRolloutPercentage());
  }

  public boolean isHealthChecksEnabled() {
    return isFeatureEnabled(
        "monitoring.healthChecks",
        featureFlags.getMonitoring().isHealthChecks(),
        featureFlags.getRollout().getMonitoringEnhancementsRolloutPercentage());
  }

  public boolean isAlertingEnabled() {
    return isFeatureEnabled(
        "monitoring.alerting",
        featureFlags.getMonitoring().isAlerting(),
        featureFlags.getRollout().getMonitoringEnhancementsRolloutPercentage());
  }

  public boolean isResourceMonitoringEnabled() {
    return isFeatureEnabled(
        "monitoring.resourceMonitoring",
        featureFlags.getMonitoring().isResourceMonitoring(),
        featureFlags.getRollout().getMonitoringEnhancementsRolloutPercentage());
  }

  public boolean isConnectionPoolMonitoringEnabled() {
    return isFeatureEnabled(
        "monitoring.connectionPoolMonitoring",
        featureFlags.getMonitoring().isConnectionPoolMonitoring(),
        featureFlags.getRollout().getMonitoringEnhancementsRolloutPercentage());
  }

  public boolean isDatabaseMonitoringEnabled() {
    return isFeatureEnabled(
        "monitoring.databaseMonitoring",
        featureFlags.getMonitoring().isDatabaseMonitoring(),
        featureFlags.getRollout().getMonitoringEnhancementsRolloutPercentage());
  }

  public boolean isCustomMetricsEnabled() {
    return isFeatureEnabled(
        "monitoring.customMetrics",
        featureFlags.getMonitoring().isCustomMetrics(),
        featureFlags.getRollout().getMonitoringEnhancementsRolloutPercentage());
  }

  /** Security feature flags */
  public boolean isEnhancedAuthenticationEnabled() {
    return isFeatureEnabled(
        "security.enhancedAuthentication",
        featureFlags.getSecurity().isEnhancedAuthentication(),
        featureFlags.getRollout().getSecurityHardeningRolloutPercentage());
  }

  public boolean isRateLimitingEnabled() {
    return isFeatureEnabled(
        "security.rateLimiting",
        featureFlags.getSecurity().isRateLimiting(),
        featureFlags.getRollout().getSecurityHardeningRolloutPercentage());
  }

  public boolean isAuditLoggingEnabled() {
    return isFeatureEnabled(
        "security.auditLogging",
        featureFlags.getSecurity().isAuditLogging(),
        featureFlags.getRollout().getSecurityHardeningRolloutPercentage());
  }

  public boolean isSessionSecurityEnabled() {
    return isFeatureEnabled(
        "security.sessionSecurity",
        featureFlags.getSecurity().isSessionSecurity(),
        featureFlags.getRollout().getSecurityHardeningRolloutPercentage());
  }

  public boolean isIpValidationEnabled() {
    return isFeatureEnabled(
        "security.ipValidation",
        featureFlags.getSecurity().isIpValidation(),
        featureFlags.getRollout().getSecurityHardeningRolloutPercentage());
  }

  public boolean isCsrfProtectionEnabled() {
    return isFeatureEnabled(
        "security.csrfProtection",
        featureFlags.getSecurity().isCsrfProtection(),
        featureFlags.getRollout().getSecurityHardeningRolloutPercentage());
  }

  public boolean isXssProtectionEnabled() {
    return isFeatureEnabled(
        "security.xssProtection",
        featureFlags.getSecurity().isXssProtection(),
        featureFlags.getRollout().getSecurityHardeningRolloutPercentage());
  }

  public boolean isSecurityHeadersEnabled() {
    return isFeatureEnabled(
        "security.securityHeaders",
        featureFlags.getSecurity().isSecurityHeaders(),
        featureFlags.getRollout().getSecurityHardeningRolloutPercentage());
  }

  /** Discovery feature flags */
  public boolean isMultiSourceDiscoveryEnabled() {
    return isFeatureEnabled(
        "discovery.multiSourceDiscovery",
        featureFlags.getDiscovery().isMultiSourceDiscovery(),
        featureFlags.getRollout().getDiscoveryOptimizationRolloutPercentage());
  }

  public boolean isCacheOptimizationEnabled() {
    return isFeatureEnabled(
        "discovery.cacheOptimization",
        featureFlags.getDiscovery().isCacheOptimization(),
        featureFlags.getRollout().getDiscoveryOptimizationRolloutPercentage());
  }

  public boolean isDiscoveryRateLimitingEnabled() {
    return isFeatureEnabled(
        "discovery.rateLimiting",
        featureFlags.getDiscovery().isRateLimiting(),
        featureFlags.getRollout().getDiscoveryOptimizationRolloutPercentage());
  }

  public boolean isKeywordGenerationEnabled() {
    return isFeatureEnabled(
        "discovery.keywordGeneration",
        featureFlags.getDiscovery().isKeywordGeneration(),
        featureFlags.getRollout().getDiscoveryOptimizationRolloutPercentage());
  }

  public boolean isProductAwareDiscoveryEnabled() {
    return isFeatureEnabled(
        "discovery.productAwareDiscovery",
        featureFlags.getDiscovery().isProductAwareDiscovery(),
        featureFlags.getRollout().getDiscoveryOptimizationRolloutPercentage());
  }

  public boolean isFallbackMechanismsEnabled() {
    return isFeatureEnabled(
        "discovery.fallbackMechanisms",
        featureFlags.getDiscovery().isFallbackMechanisms(),
        featureFlags.getRollout().getDiscoveryOptimizationRolloutPercentage());
  }

  public boolean isDiscoveryPerformanceOptimizationEnabled() {
    return isFeatureEnabled(
        "discovery.performanceOptimization",
        featureFlags.getDiscovery().isPerformanceOptimization(),
        featureFlags.getRollout().getDiscoveryOptimizationRolloutPercentage());
  }

  /** Core feature flag evaluation logic */
  private boolean isFeatureEnabled(String featureName, boolean baseEnabled, int rolloutPercentage) {
    // If feature is disabled at base level, return false
    if (!baseEnabled) {
      return false;
    }

    // If gradual rollout is disabled, return base value
    if (!featureFlags.getRollout().isEnabled()) {
      return baseEnabled;
    }

    // If rollout percentage is 100%, return base value
    if (rolloutPercentage >= 100) {
      return baseEnabled;
    }

    // If rollout percentage is 0%, return false
    if (rolloutPercentage <= 0) {
      return false;
    }

    // Check cache first for consistency
    String cacheKey = featureName + "_rollout";
    Boolean cachedResult = rolloutCache.get(cacheKey);
    if (cachedResult != null) {
      return cachedResult;
    }

    // Calculate rollout decision based on strategy
    boolean rolloutDecision = calculateRolloutDecision(featureName, rolloutPercentage);

    // Cache the decision
    rolloutCache.put(cacheKey, rolloutDecision);

    return rolloutDecision;
  }

  /** Calculate rollout decision based on configured strategy */
  private boolean calculateRolloutDecision(String featureName, int rolloutPercentage) {
    switch (featureFlags.getRollout().getStrategy()) {
      case PERCENTAGE_BASED:
        return calculatePercentageBasedRollout(featureName, rolloutPercentage);
      case USER_BASED:
        return calculateUserBasedRollout(featureName, rolloutPercentage);
      case SHOP_BASED:
        return calculateShopBasedRollout(featureName, rolloutPercentage);
      case TIME_BASED:
        return calculateTimeBasedRollout(featureName, rolloutPercentage);
      case CANARY:
        return calculateCanaryRollout(featureName, rolloutPercentage);
      default:
        logger.warn(
            "Unknown rollout strategy: {}, falling back to percentage-based",
            featureFlags.getRollout().getStrategy());
        return calculatePercentageBasedRollout(featureName, rolloutPercentage);
    }
  }

  /** Percentage-based rollout using consistent hashing */
  private boolean calculatePercentageBasedRollout(String featureName, int rolloutPercentage) {
    try {
      // Use feature name + instance identifier for consistent hashing
      String hashInput = featureName + "_" + System.getProperty("user.name", "default");
      MessageDigest md = MessageDigest.getInstance("MD5");
      byte[] hash = md.digest(hashInput.getBytes());

      // Convert first 4 bytes to int and get percentage
      int hashValue =
          Math.abs(
              ((hash[0] & 0xFF) << 24)
                  | ((hash[1] & 0xFF) << 16)
                  | ((hash[2] & 0xFF) << 8)
                  | (hash[3] & 0xFF));
      int percentage = hashValue % 100;

      return percentage < rolloutPercentage;
    } catch (NoSuchAlgorithmException e) {
      logger.error("Failed to calculate hash for rollout decision", e);
      // Fallback to simple random
      return Math.random() * 100 < rolloutPercentage;
    }
  }

  /** User-based rollout (placeholder - would need user context) */
  private boolean calculateUserBasedRollout(String featureName, int rolloutPercentage) {
    // For now, fallback to percentage-based
    // In a real implementation, this would use user ID or session ID
    return calculatePercentageBasedRollout(featureName, rolloutPercentage);
  }

  /** Shop-based rollout (placeholder - would need shop context) */
  private boolean calculateShopBasedRollout(String featureName, int rolloutPercentage) {
    // For now, fallback to percentage-based
    // In a real implementation, this would use shop domain or ID
    return calculatePercentageBasedRollout(featureName, rolloutPercentage);
  }

  /** Time-based rollout */
  private boolean calculateTimeBasedRollout(String featureName, int rolloutPercentage) {
    // Simple time-based rollout: gradually increase percentage over time
    long currentHour = System.currentTimeMillis() / (1000 * 60 * 60);
    int timeBasedPercentage = (int) ((currentHour % 24) * rolloutPercentage / 24);
    return calculatePercentageBasedRollout(
        featureName, Math.min(timeBasedPercentage, rolloutPercentage));
  }

  /** Canary rollout (placeholder) */
  private boolean calculateCanaryRollout(String featureName, int rolloutPercentage) {
    // For now, fallback to percentage-based
    // In a real implementation, this would check if instance is marked as canary
    return calculatePercentageBasedRollout(featureName, rolloutPercentage);
  }

  /** Clear rollout cache (useful for testing or configuration changes) */
  public void clearRolloutCache() {
    rolloutCache.clear();
    logger.info("Rollout cache cleared");
  }

  /** Get rollout cache statistics */
  public int getRolloutCacheSize() {
    return rolloutCache.size();
  }

  /** Check if gradual rollout is enabled */
  public boolean isGradualRolloutEnabled() {
    return featureFlags.getRollout().isEnabled();
  }

  /** Get current rollout strategy */
  public FeatureFlagConfiguration.RolloutStrategy getRolloutStrategy() {
    return featureFlags.getRollout().getStrategy();
  }
}
