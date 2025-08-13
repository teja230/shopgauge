package com.storesight.backend.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.HashMap;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

/**
 * Feature flag configuration properties for controlling feature rollouts and enabling/disabling
 * functionality at runtime.
 */
@Component
@ConfigurationProperties(prefix = "storesight.features")
@Validated
public class FeatureFlagConfiguration {

  /** Session management feature flags */
  private SessionFeatures session = new SessionFeatures();

  /** SSE (Server-Sent Events) feature flags */
  private SseFeatures sse = new SseFeatures();

  /** Cache feature flags */
  private CacheFeatures cache = new CacheFeatures();

  /** Monitoring feature flags */
  private MonitoringFeatures monitoring = new MonitoringFeatures();

  /** Security feature flags */
  private SecurityFeatures security = new SecurityFeatures();

  /** Discovery feature flags */
  private DiscoveryFeatures discovery = new DiscoveryFeatures();

  /** Market Intelligence feature flags */
  private MarketIntelligenceFeatures marketIntelligence = new MarketIntelligenceFeatures();

  /** Gradual rollout configuration */
  private GradualRollout rollout = new GradualRollout();

  // Getters and setters
  public SessionFeatures getSession() {
    return session;
  }

  public void setSession(SessionFeatures session) {
    this.session = session;
  }

  public SseFeatures getSse() {
    return sse;
  }

  public void setSse(SseFeatures sse) {
    this.sse = sse;
  }

  public CacheFeatures getCache() {
    return cache;
  }

  public void setCache(CacheFeatures cache) {
    this.cache = cache;
  }

  public MonitoringFeatures getMonitoring() {
    return monitoring;
  }

  public void setMonitoring(MonitoringFeatures monitoring) {
    this.monitoring = monitoring;
  }

  public SecurityFeatures getSecurity() {
    return security;
  }

  public void setSecurity(SecurityFeatures security) {
    this.security = security;
  }

  public DiscoveryFeatures getDiscovery() {
    return discovery;
  }

  public void setDiscovery(DiscoveryFeatures discovery) {
    this.discovery = discovery;
  }

  public MarketIntelligenceFeatures getMarketIntelligence() {
    return marketIntelligence;
  }

  public void setMarketIntelligence(MarketIntelligenceFeatures marketIntelligence) {
    this.marketIntelligence = marketIntelligence;
  }

  public GradualRollout getRollout() {
    return rollout;
  }

  public void setRollout(GradualRollout rollout) {
    this.rollout = rollout;
  }

  /** Session management feature flags */
  public static class SessionFeatures {
    private boolean enhancedSynchronization = true;
    private boolean stuckSessionCleanup = true;
    private boolean distributedLocking = true;
    private boolean sessionValidation = true;
    private boolean asyncSessionUpdates = true;
    private boolean sessionMetrics = true;
    private boolean emergencyCleanup = true;

    // Getters and setters
    public boolean isEnhancedSynchronization() {
      return enhancedSynchronization;
    }

    public void setEnhancedSynchronization(boolean enhancedSynchronization) {
      this.enhancedSynchronization = enhancedSynchronization;
    }

    public boolean isStuckSessionCleanup() {
      return stuckSessionCleanup;
    }

    public void setStuckSessionCleanup(boolean stuckSessionCleanup) {
      this.stuckSessionCleanup = stuckSessionCleanup;
    }

    public boolean isDistributedLocking() {
      return distributedLocking;
    }

    public void setDistributedLocking(boolean distributedLocking) {
      this.distributedLocking = distributedLocking;
    }

    public boolean isSessionValidation() {
      return sessionValidation;
    }

    public void setSessionValidation(boolean sessionValidation) {
      this.sessionValidation = sessionValidation;
    }

    public boolean isAsyncSessionUpdates() {
      return asyncSessionUpdates;
    }

    public void setAsyncSessionUpdates(boolean asyncSessionUpdates) {
      this.asyncSessionUpdates = asyncSessionUpdates;
    }

    public boolean isSessionMetrics() {
      return sessionMetrics;
    }

    public void setSessionMetrics(boolean sessionMetrics) {
      this.sessionMetrics = sessionMetrics;
    }

    public boolean isEmergencyCleanup() {
      return emergencyCleanup;
    }

    public void setEmergencyCleanup(boolean emergencyCleanup) {
      this.emergencyCleanup = emergencyCleanup;
    }
  }

  /** SSE feature flags */
  public static class SseFeatures {
    private boolean eventBatching = true;
    private boolean connectionHealthChecks = true;
    private boolean deadConnectionCleanup = true;
    private boolean emergencyCleanup = true;
    private boolean memoryManagement = true;
    private boolean connectionLimits = true;
    private boolean heartbeatMonitoring = true;
    private boolean performanceMetrics = true;

    // New flag to control SSE functionality
    private boolean enabled = false;

    // Getters and setters
    public boolean isEventBatching() {
      return eventBatching;
    }

    public void setEventBatching(boolean eventBatching) {
      this.eventBatching = eventBatching;
    }

    public boolean isConnectionHealthChecks() {
      return connectionHealthChecks;
    }

    public void setConnectionHealthChecks(boolean connectionHealthChecks) {
      this.connectionHealthChecks = connectionHealthChecks;
    }

    public boolean isDeadConnectionCleanup() {
      return deadConnectionCleanup;
    }

    public void setDeadConnectionCleanup(boolean deadConnectionCleanup) {
      this.deadConnectionCleanup = deadConnectionCleanup;
    }

    public boolean isEmergencyCleanup() {
      return emergencyCleanup;
    }

    public void setEmergencyCleanup(boolean emergencyCleanup) {
      this.emergencyCleanup = emergencyCleanup;
    }

    public boolean isMemoryManagement() {
      return memoryManagement;
    }

    public void setMemoryManagement(boolean memoryManagement) {
      this.memoryManagement = memoryManagement;
    }

    public boolean isConnectionLimits() {
      return connectionLimits;
    }

    public void setConnectionLimits(boolean connectionLimits) {
      this.connectionLimits = connectionLimits;
    }

    public boolean isHeartbeatMonitoring() {
      return heartbeatMonitoring;
    }

    public void setHeartbeatMonitoring(boolean heartbeatMonitoring) {
      this.heartbeatMonitoring = heartbeatMonitoring;
    }

    public boolean isPerformanceMetrics() {
      return performanceMetrics;
    }

    public void setPerformanceMetrics(boolean performanceMetrics) {
      this.performanceMetrics = performanceMetrics;
    }

    public boolean isEnabled() {
      return enabled;
    }

    public void setEnabled(boolean enabled) {
      this.enabled = enabled;
    }
  }

  /** Cache feature flags */
  public static class CacheFeatures {
    private boolean multiLevelCaching = true;
    private boolean sessionAwareCaching = true;
    private boolean cacheStatistics = true;
    private boolean automaticCleanup = true;
    private boolean memoryOptimization = true;
    private boolean distributedCaching = true;
    private boolean cacheWarming = true;

    // Getters and setters
    public boolean isMultiLevelCaching() {
      return multiLevelCaching;
    }

    public void setMultiLevelCaching(boolean multiLevelCaching) {
      this.multiLevelCaching = multiLevelCaching;
    }

    public boolean isSessionAwareCaching() {
      return sessionAwareCaching;
    }

    public void setSessionAwareCaching(boolean sessionAwareCaching) {
      this.sessionAwareCaching = sessionAwareCaching;
    }

    public boolean isCacheStatistics() {
      return cacheStatistics;
    }

    public void setCacheStatistics(boolean cacheStatistics) {
      this.cacheStatistics = cacheStatistics;
    }

    public boolean isAutomaticCleanup() {
      return automaticCleanup;
    }

    public void setAutomaticCleanup(boolean automaticCleanup) {
      this.automaticCleanup = automaticCleanup;
    }

    public boolean isMemoryOptimization() {
      return memoryOptimization;
    }

    public void setMemoryOptimization(boolean memoryOptimization) {
      this.memoryOptimization = memoryOptimization;
    }

    public boolean isDistributedCaching() {
      return distributedCaching;
    }

    public void setDistributedCaching(boolean distributedCaching) {
      this.distributedCaching = distributedCaching;
    }

    public boolean isCacheWarming() {
      return cacheWarming;
    }

    public void setCacheWarming(boolean cacheWarming) {
      this.cacheWarming = cacheWarming;
    }
  }

  /** Monitoring feature flags */
  public static class MonitoringFeatures {
    private boolean enhancedMetrics = true;
    private boolean performanceMonitoring = true;
    private boolean healthChecks = true;
    private boolean alerting = true;
    private boolean resourceMonitoring = true;
    private boolean connectionPoolMonitoring = true;
    private boolean databaseMonitoring = true;
    private boolean customMetrics = true;

    // New flags for memory-intensive monitoring services
    private boolean scheduledSystemResourceMonitoring = false;
    private boolean scheduledDashboardCollection = false;
    private boolean scheduledPerformanceMetrics = false;
    private boolean scheduledDatabaseMonitoring = false;
    private boolean scheduledRedisMonitoring = false;
    private boolean scheduledAlerting = false;
    private boolean scheduledCacheCleanup = false;
    private boolean scheduledSessionCleanup = false;
    private boolean scheduledSseCleanup = false;

    // Getters and setters
    public boolean isEnhancedMetrics() {
      return enhancedMetrics;
    }

    public void setEnhancedMetrics(boolean enhancedMetrics) {
      this.enhancedMetrics = enhancedMetrics;
    }

    public boolean isPerformanceMonitoring() {
      return performanceMonitoring;
    }

    public void setPerformanceMonitoring(boolean performanceMonitoring) {
      this.performanceMonitoring = performanceMonitoring;
    }

    public boolean isHealthChecks() {
      return healthChecks;
    }

    public void setHealthChecks(boolean healthChecks) {
      this.healthChecks = healthChecks;
    }

    public boolean isAlerting() {
      return alerting;
    }

    public void setAlerting(boolean alerting) {
      this.alerting = alerting;
    }

    public boolean isResourceMonitoring() {
      return resourceMonitoring;
    }

    public void setResourceMonitoring(boolean resourceMonitoring) {
      this.resourceMonitoring = resourceMonitoring;
    }

    public boolean isConnectionPoolMonitoring() {
      return connectionPoolMonitoring;
    }

    public void setConnectionPoolMonitoring(boolean connectionPoolMonitoring) {
      this.connectionPoolMonitoring = connectionPoolMonitoring;
    }

    public boolean isDatabaseMonitoring() {
      return databaseMonitoring;
    }

    public void setDatabaseMonitoring(boolean databaseMonitoring) {
      this.databaseMonitoring = databaseMonitoring;
    }

    public boolean isCustomMetrics() {
      return customMetrics;
    }

    public void setCustomMetrics(boolean customMetrics) {
      this.customMetrics = customMetrics;
    }

    // New getters and setters for scheduled monitoring
    public boolean isScheduledSystemResourceMonitoring() {
      return scheduledSystemResourceMonitoring;
    }

    public void setScheduledSystemResourceMonitoring(boolean scheduledSystemResourceMonitoring) {
      this.scheduledSystemResourceMonitoring = scheduledSystemResourceMonitoring;
    }

    public boolean isScheduledDashboardCollection() {
      return scheduledDashboardCollection;
    }

    public void setScheduledDashboardCollection(boolean scheduledDashboardCollection) {
      this.scheduledDashboardCollection = scheduledDashboardCollection;
    }

    public boolean isScheduledPerformanceMetrics() {
      return scheduledPerformanceMetrics;
    }

    public void setScheduledPerformanceMetrics(boolean scheduledPerformanceMetrics) {
      this.scheduledPerformanceMetrics = scheduledPerformanceMetrics;
    }

    public boolean isScheduledDatabaseMonitoring() {
      return scheduledDatabaseMonitoring;
    }

    public void setScheduledDatabaseMonitoring(boolean scheduledDatabaseMonitoring) {
      this.scheduledDatabaseMonitoring = scheduledDatabaseMonitoring;
    }

    public boolean isScheduledRedisMonitoring() {
      return scheduledRedisMonitoring;
    }

    public void setScheduledRedisMonitoring(boolean scheduledRedisMonitoring) {
      this.scheduledRedisMonitoring = scheduledRedisMonitoring;
    }

    public boolean isScheduledAlerting() {
      return scheduledAlerting;
    }

    public void setScheduledAlerting(boolean scheduledAlerting) {
      this.scheduledAlerting = scheduledAlerting;
    }

    public boolean isScheduledCacheCleanup() {
      return scheduledCacheCleanup;
    }

    public void setScheduledCacheCleanup(boolean scheduledCacheCleanup) {
      this.scheduledCacheCleanup = scheduledCacheCleanup;
    }

    public boolean isScheduledSessionCleanup() {
      return scheduledSessionCleanup;
    }

    public void setScheduledSessionCleanup(boolean scheduledSessionCleanup) {
      this.scheduledSessionCleanup = scheduledSessionCleanup;
    }

    public boolean isScheduledSseCleanup() {
      return scheduledSseCleanup;
    }

    public void setScheduledSseCleanup(boolean scheduledSseCleanup) {
      this.scheduledSseCleanup = scheduledSseCleanup;
    }
  }

  /** Security feature flags */
  public static class SecurityFeatures {
    private boolean enhancedAuthentication = true;
    private boolean rateLimiting = true;
    private boolean auditLogging = true;
    private boolean sessionSecurity = true;
    private boolean ipValidation = true;
    private boolean csrfProtection = true;
    private boolean xssProtection = true;
    private boolean securityHeaders = true;

    // Getters and setters
    public boolean isEnhancedAuthentication() {
      return enhancedAuthentication;
    }

    public void setEnhancedAuthentication(boolean enhancedAuthentication) {
      this.enhancedAuthentication = enhancedAuthentication;
    }

    public boolean isRateLimiting() {
      return rateLimiting;
    }

    public void setRateLimiting(boolean rateLimiting) {
      this.rateLimiting = rateLimiting;
    }

    public boolean isAuditLogging() {
      return auditLogging;
    }

    public void setAuditLogging(boolean auditLogging) {
      this.auditLogging = auditLogging;
    }

    public boolean isSessionSecurity() {
      return sessionSecurity;
    }

    public void setSessionSecurity(boolean sessionSecurity) {
      this.sessionSecurity = sessionSecurity;
    }

    public boolean isIpValidation() {
      return ipValidation;
    }

    public void setIpValidation(boolean ipValidation) {
      this.ipValidation = ipValidation;
    }

    public boolean isCsrfProtection() {
      return csrfProtection;
    }

    public void setCsrfProtection(boolean csrfProtection) {
      this.csrfProtection = csrfProtection;
    }

    public boolean isXssProtection() {
      return xssProtection;
    }

    public void setXssProtection(boolean xssProtection) {
      this.xssProtection = xssProtection;
    }

    public boolean isSecurityHeaders() {
      return securityHeaders;
    }

    public void setSecurityHeaders(boolean securityHeaders) {
      this.securityHeaders = securityHeaders;
    }
  }

  /** Discovery feature flags */
  public static class DiscoveryFeatures {
    private boolean multiSourceDiscovery = true;
    private boolean cacheOptimization = true;
    private boolean rateLimiting = true;
    private boolean keywordGeneration = true;
    private boolean productAwareDiscovery = true;
    private boolean fallbackMechanisms = true;
    private boolean performanceOptimization = true;

    // Getters and setters
    public boolean isMultiSourceDiscovery() {
      return multiSourceDiscovery;
    }

    public void setMultiSourceDiscovery(boolean multiSourceDiscovery) {
      this.multiSourceDiscovery = multiSourceDiscovery;
    }

    public boolean isCacheOptimization() {
      return cacheOptimization;
    }

    public void setCacheOptimization(boolean cacheOptimization) {
      this.cacheOptimization = cacheOptimization;
    }

    public boolean isRateLimiting() {
      return rateLimiting;
    }

    public void setRateLimiting(boolean rateLimiting) {
      this.rateLimiting = rateLimiting;
    }

    public boolean isKeywordGeneration() {
      return keywordGeneration;
    }

    public void setKeywordGeneration(boolean keywordGeneration) {
      this.keywordGeneration = keywordGeneration;
    }

    public boolean isProductAwareDiscovery() {
      return productAwareDiscovery;
    }

    public void setProductAwareDiscovery(boolean productAwareDiscovery) {
      this.productAwareDiscovery = productAwareDiscovery;
    }

    public boolean isFallbackMechanisms() {
      return fallbackMechanisms;
    }

    public void setFallbackMechanisms(boolean fallbackMechanisms) {
      this.fallbackMechanisms = fallbackMechanisms;
    }

    public boolean isPerformanceOptimization() {
      return performanceOptimization;
    }

    public void setPerformanceOptimization(boolean performanceOptimization) {
      this.performanceOptimization = performanceOptimization;
    }
  }

  /** Gradual rollout configuration */
  public static class GradualRollout {
    private boolean enabled = false;

    @Min(0)
    @Max(100)
    private int sessionManagementRolloutPercentage = 100;

    @Min(0)
    @Max(100)
    private int sseImprovementsRolloutPercentage = 100;

    @Min(0)
    @Max(100)
    private int cacheOptimizationRolloutPercentage = 100;

    @Min(0)
    @Max(100)
    private int monitoringEnhancementsRolloutPercentage = 100;

    @Min(0)
    @Max(100)
    private int securityHardeningRolloutPercentage = 100;

    @Min(0)
    @Max(100)
    private int discoveryOptimizationRolloutPercentage = 100;

    @NotNull private RolloutStrategy strategy = RolloutStrategy.PERCENTAGE_BASED;

    private Map<String, String> rolloutCriteria = new HashMap<>();

    // Getters and setters
    public boolean isEnabled() {
      return enabled;
    }

    public void setEnabled(boolean enabled) {
      this.enabled = enabled;
    }

    public int getSessionManagementRolloutPercentage() {
      return sessionManagementRolloutPercentage;
    }

    public void setSessionManagementRolloutPercentage(int sessionManagementRolloutPercentage) {
      this.sessionManagementRolloutPercentage = sessionManagementRolloutPercentage;
    }

    public int getSseImprovementsRolloutPercentage() {
      return sseImprovementsRolloutPercentage;
    }

    public void setSseImprovementsRolloutPercentage(int sseImprovementsRolloutPercentage) {
      this.sseImprovementsRolloutPercentage = sseImprovementsRolloutPercentage;
    }

    public int getCacheOptimizationRolloutPercentage() {
      return cacheOptimizationRolloutPercentage;
    }

    public void setCacheOptimizationRolloutPercentage(int cacheOptimizationRolloutPercentage) {
      this.cacheOptimizationRolloutPercentage = cacheOptimizationRolloutPercentage;
    }

    public int getMonitoringEnhancementsRolloutPercentage() {
      return monitoringEnhancementsRolloutPercentage;
    }

    public void setMonitoringEnhancementsRolloutPercentage(
        int monitoringEnhancementsRolloutPercentage) {
      this.monitoringEnhancementsRolloutPercentage = monitoringEnhancementsRolloutPercentage;
    }

    public int getSecurityHardeningRolloutPercentage() {
      return securityHardeningRolloutPercentage;
    }

    public void setSecurityHardeningRolloutPercentage(int securityHardeningRolloutPercentage) {
      this.securityHardeningRolloutPercentage = securityHardeningRolloutPercentage;
    }

    public int getDiscoveryOptimizationRolloutPercentage() {
      return discoveryOptimizationRolloutPercentage;
    }

    public void setDiscoveryOptimizationRolloutPercentage(
        int discoveryOptimizationRolloutPercentage) {
      this.discoveryOptimizationRolloutPercentage = discoveryOptimizationRolloutPercentage;
    }

    public RolloutStrategy getStrategy() {
      return strategy;
    }

    public void setStrategy(RolloutStrategy strategy) {
      this.strategy = strategy;
    }

    public Map<String, String> getRolloutCriteria() {
      return rolloutCriteria;
    }

    public void setRolloutCriteria(Map<String, String> rolloutCriteria) {
      this.rolloutCriteria = rolloutCriteria;
    }
  }

  /** Market Intelligence feature flags */
  public static class MarketIntelligenceFeatures {
    private boolean cacheEnabled = true;
    private boolean batchProcessingEnabled = true;
    private boolean writeOperationsEnabled = true;
    private boolean cacheWarmingEnabled = false; // Disabled by default for 512MB instances
    private boolean materializedViewsEnabled = true;
    private boolean eventDrivenInvalidationEnabled = true;
    private boolean scheduledRefreshEnabled = false; // Disabled by default, use on-demand
    private boolean performanceMonitoringEnabled = true;

    public boolean isCacheEnabled() {
      return cacheEnabled;
    }

    public void setCacheEnabled(boolean cacheEnabled) {
      this.cacheEnabled = cacheEnabled;
    }

    public boolean isBatchProcessingEnabled() {
      return batchProcessingEnabled;
    }

    public void setBatchProcessingEnabled(boolean batchProcessingEnabled) {
      this.batchProcessingEnabled = batchProcessingEnabled;
    }

    public boolean isWriteOperationsEnabled() {
      return writeOperationsEnabled;
    }

    public void setWriteOperationsEnabled(boolean writeOperationsEnabled) {
      this.writeOperationsEnabled = writeOperationsEnabled;
    }

    public boolean isCacheWarmingEnabled() {
      return cacheWarmingEnabled;
    }

    public void setCacheWarmingEnabled(boolean cacheWarmingEnabled) {
      this.cacheWarmingEnabled = cacheWarmingEnabled;
    }

    public boolean isMaterializedViewsEnabled() {
      return materializedViewsEnabled;
    }

    public void setMaterializedViewsEnabled(boolean materializedViewsEnabled) {
      this.materializedViewsEnabled = materializedViewsEnabled;
    }

    public boolean isEventDrivenInvalidationEnabled() {
      return eventDrivenInvalidationEnabled;
    }

    public void setEventDrivenInvalidationEnabled(boolean eventDrivenInvalidationEnabled) {
      this.eventDrivenInvalidationEnabled = eventDrivenInvalidationEnabled;
    }

    public boolean isScheduledRefreshEnabled() {
      return scheduledRefreshEnabled;
    }

    public void setScheduledRefreshEnabled(boolean scheduledRefreshEnabled) {
      this.scheduledRefreshEnabled = scheduledRefreshEnabled;
    }

    public boolean isPerformanceMonitoringEnabled() {
      return performanceMonitoringEnabled;
    }

    public void setPerformanceMonitoringEnabled(boolean performanceMonitoringEnabled) {
      this.performanceMonitoringEnabled = performanceMonitoringEnabled;
    }
  }

  /** Rollout strategy enumeration */
  public enum RolloutStrategy {
    PERCENTAGE_BASED,
    USER_BASED,
    SHOP_BASED,
    TIME_BASED,
    CANARY
  }
}
