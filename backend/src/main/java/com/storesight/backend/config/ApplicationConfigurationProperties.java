package com.storesight.backend.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.NestedConfigurationProperty;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

/**
 * Centralized configuration properties for the Storesight application. This class externalizes all
 * hardcoded configuration values to make them configurable via environment variables or application
 * properties.
 */
@Component
@ConfigurationProperties(prefix = "storesight")
@Validated
public class ApplicationConfigurationProperties {

  @Valid @NestedConfigurationProperty private SseConfiguration sse = new SseConfiguration();

  @Valid @NestedConfigurationProperty
  private SessionConfiguration session = new SessionConfiguration();

  @Valid @NestedConfigurationProperty private CacheConfiguration cache = new CacheConfiguration();

  @Valid @NestedConfigurationProperty
  private MonitoringConfiguration monitoring = new MonitoringConfiguration();

  @Valid @NestedConfigurationProperty
  private SecurityConfiguration security = new SecurityConfiguration();

  @Valid @NestedConfigurationProperty
  private DiscoveryConfiguration discovery = new DiscoveryConfiguration();

  // Getters and setters
  public SseConfiguration getSse() {
    return sse;
  }

  public void setSse(SseConfiguration sse) {
    this.sse = sse;
  }

  public SessionConfiguration getSession() {
    return session;
  }

  public void setSession(SessionConfiguration session) {
    this.session = session;
  }

  public CacheConfiguration getCache() {
    return cache;
  }

  public void setCache(CacheConfiguration cache) {
    this.cache = cache;
  }

  public MonitoringConfiguration getMonitoring() {
    return monitoring;
  }

  public void setMonitoring(MonitoringConfiguration monitoring) {
    this.monitoring = monitoring;
  }

  public SecurityConfiguration getSecurity() {
    return security;
  }

  public void setSecurity(SecurityConfiguration security) {
    this.security = security;
  }

  public DiscoveryConfiguration getDiscovery() {
    return discovery;
  }

  public void setDiscovery(DiscoveryConfiguration discovery) {
    this.discovery = discovery;
  }

  /** SSE (Server-Sent Events) configuration properties */
  public static class SseConfiguration {
    @Min(1)
    @Max(20)
    private int maxConnectionsPerShop = 5;

    @Min(10)
    @Max(200)
    private int maxConnectionsGlobal = 50;

    @NotNull private Duration connectionTimeout = Duration.ofMinutes(2);

    @NotNull private Duration heartbeatInterval = Duration.ofSeconds(30);

    @NotNull private Duration cleanupInterval = Duration.ofMinutes(1);

    @Min(1)
    @Max(50)
    private int maxBatchSize = 10;

    @NotNull private Duration batchTimeout = Duration.ofSeconds(1);

    @Min(10)
    @Max(500)
    private int maxBatchQueueSize = 100;

    @NotNull private Duration connectionHealthCheckInterval = Duration.ofSeconds(45);

    @NotNull private Duration deadConnectionTimeout = Duration.ofSeconds(90);

    @NotNull private Duration batchCleanupInterval = Duration.ofSeconds(30);

    @Min(1)
    @Max(10)
    private int maxFailedHeartbeats = 3;

    @NotNull private Duration batchMemoryCleanupThreshold = Duration.ofMinutes(5);

    @Positive private int maxBatchMemorySizeBytes = 1024 * 1024; // 1MB

    @NotNull private Duration connectionIdleTimeout = Duration.ofMinutes(10);

    @Min(50)
    @Max(100)
    private int emergencyCleanupThreshold = 80;

    // Getters and setters
    public int getMaxConnectionsPerShop() {
      return maxConnectionsPerShop;
    }

    public void setMaxConnectionsPerShop(int maxConnectionsPerShop) {
      this.maxConnectionsPerShop = maxConnectionsPerShop;
    }

    public int getMaxConnectionsGlobal() {
      return maxConnectionsGlobal;
    }

    public void setMaxConnectionsGlobal(int maxConnectionsGlobal) {
      this.maxConnectionsGlobal = maxConnectionsGlobal;
    }

    public Duration getConnectionTimeout() {
      return connectionTimeout;
    }

    public void setConnectionTimeout(Duration connectionTimeout) {
      this.connectionTimeout = connectionTimeout;
    }

    public Duration getHeartbeatInterval() {
      return heartbeatInterval;
    }

    public void setHeartbeatInterval(Duration heartbeatInterval) {
      this.heartbeatInterval = heartbeatInterval;
    }

    public Duration getCleanupInterval() {
      return cleanupInterval;
    }

    public void setCleanupInterval(Duration cleanupInterval) {
      this.cleanupInterval = cleanupInterval;
    }

    public int getMaxBatchSize() {
      return maxBatchSize;
    }

    public void setMaxBatchSize(int maxBatchSize) {
      this.maxBatchSize = maxBatchSize;
    }

    public Duration getBatchTimeout() {
      return batchTimeout;
    }

    public void setBatchTimeout(Duration batchTimeout) {
      this.batchTimeout = batchTimeout;
    }

    public int getMaxBatchQueueSize() {
      return maxBatchQueueSize;
    }

    public void setMaxBatchQueueSize(int maxBatchQueueSize) {
      this.maxBatchQueueSize = maxBatchQueueSize;
    }

    public Duration getConnectionHealthCheckInterval() {
      return connectionHealthCheckInterval;
    }

    public void setConnectionHealthCheckInterval(Duration connectionHealthCheckInterval) {
      this.connectionHealthCheckInterval = connectionHealthCheckInterval;
    }

    public Duration getDeadConnectionTimeout() {
      return deadConnectionTimeout;
    }

    public void setDeadConnectionTimeout(Duration deadConnectionTimeout) {
      this.deadConnectionTimeout = deadConnectionTimeout;
    }

    public Duration getBatchCleanupInterval() {
      return batchCleanupInterval;
    }

    public void setBatchCleanupInterval(Duration batchCleanupInterval) {
      this.batchCleanupInterval = batchCleanupInterval;
    }

    public int getMaxFailedHeartbeats() {
      return maxFailedHeartbeats;
    }

    public void setMaxFailedHeartbeats(int maxFailedHeartbeats) {
      this.maxFailedHeartbeats = maxFailedHeartbeats;
    }

    public Duration getBatchMemoryCleanupThreshold() {
      return batchMemoryCleanupThreshold;
    }

    public void setBatchMemoryCleanupThreshold(Duration batchMemoryCleanupThreshold) {
      this.batchMemoryCleanupThreshold = batchMemoryCleanupThreshold;
    }

    public int getMaxBatchMemorySizeBytes() {
      return maxBatchMemorySizeBytes;
    }

    public void setMaxBatchMemorySizeBytes(int maxBatchMemorySizeBytes) {
      this.maxBatchMemorySizeBytes = maxBatchMemorySizeBytes;
    }

    public Duration getConnectionIdleTimeout() {
      return connectionIdleTimeout;
    }

    public void setConnectionIdleTimeout(Duration connectionIdleTimeout) {
      this.connectionIdleTimeout = connectionIdleTimeout;
    }

    public int getEmergencyCleanupThreshold() {
      return emergencyCleanupThreshold;
    }

    public void setEmergencyCleanupThreshold(int emergencyCleanupThreshold) {
      this.emergencyCleanupThreshold = emergencyCleanupThreshold;
    }
  }

  /** Session management configuration properties */
  public static class SessionConfiguration {
    @NotNull private Duration lockDuration = Duration.ofSeconds(5);

    @NotNull private Duration invalidationTrackingDuration = Duration.ofHours(1);

    @NotNull private Duration stuckSessionTimeout = Duration.ofMinutes(5);

    @NotNull private Duration orphanedLockTimeout = Duration.ofMinutes(10);

    @NotNull private Duration sessionDataTtl = Duration.ofHours(4);

    @NotNull private Duration sessionTokenTtl = Duration.ofHours(2);

    @NotNull private Duration shopSessionsTtl = Duration.ofHours(1);

    @NotNull private Duration invalidSessionTtl = Duration.ofMinutes(15);

    @Min(1)
    @Max(20)
    private int maxSessionsPerShop = 5;

    @Min(1)
    @Max(30)
    private int sessionInactivityHours = 4;

    @Min(1)
    @Max(7)
    private int sessionCleanupDays = 2;

    @Min(5)
    @Max(120)
    private int redisCacheTtlMinutes = 120;

    @Min(5)
    @Max(60)
    private int redisFallbackTtlMinutes = 60;

    @Min(5)
    @Max(30)
    private int invalidSessionCacheMinutes = 15;

    // Session Cleanup Configuration - ULTRA CONSERVATIVE FOR RESOURCE OPTIMIZATION
    @NotNull private Duration synchronizationCleanupInterval = Duration.ofHours(2);
    @NotNull private Duration stuckMarkersCleanupInterval = Duration.ofMinutes(30);
    @NotNull private Duration criticalStuckMarkersCleanupInterval = Duration.ofMinutes(15);
    @NotNull private Duration expiredSessionsCleanupInterval = Duration.ofHours(2);
    @NotNull private Duration staleSessionsCleanupInterval = Duration.ofHours(4);
    @NotNull private Duration throttlingCacheCleanupInterval = Duration.ofHours(2);

    // Session Cleanup Startup Delays - PREVENT RESOURCE CONTENTION
    @NotNull private Duration synchronizationCleanupStartupDelay = Duration.ofMinutes(5);
    @NotNull private Duration stuckMarkersCleanupStartupDelay = Duration.ofMinutes(10);
    @NotNull private Duration criticalStuckMarkersCleanupStartupDelay = Duration.ofMinutes(15);
    @NotNull private Duration expiredSessionsCleanupStartupDelay = Duration.ofMinutes(15);
    @NotNull private Duration staleSessionsCleanupStartupDelay = Duration.ofMinutes(20);
    @NotNull private Duration throttlingCacheCleanupStartupDelay = Duration.ofMinutes(10);

    // Getters and setters
    public Duration getLockDuration() {
      return lockDuration;
    }

    public void setLockDuration(Duration lockDuration) {
      this.lockDuration = lockDuration;
    }

    public Duration getInvalidationTrackingDuration() {
      return invalidationTrackingDuration;
    }

    public void setInvalidationTrackingDuration(Duration invalidationTrackingDuration) {
      this.invalidationTrackingDuration = invalidationTrackingDuration;
    }

    public Duration getStuckSessionTimeout() {
      return stuckSessionTimeout;
    }

    public void setStuckSessionTimeout(Duration stuckSessionTimeout) {
      this.stuckSessionTimeout = stuckSessionTimeout;
    }

    public Duration getOrphanedLockTimeout() {
      return orphanedLockTimeout;
    }

    public void setOrphanedLockTimeout(Duration orphanedLockTimeout) {
      this.orphanedLockTimeout = orphanedLockTimeout;
    }

    public Duration getSessionDataTtl() {
      return sessionDataTtl;
    }

    public void setSessionDataTtl(Duration sessionDataTtl) {
      this.sessionDataTtl = sessionDataTtl;
    }

    public Duration getSessionTokenTtl() {
      return sessionTokenTtl;
    }

    public void setSessionTokenTtl(Duration sessionTokenTtl) {
      this.sessionTokenTtl = sessionTokenTtl;
    }

    public Duration getShopSessionsTtl() {
      return shopSessionsTtl;
    }

    public void setShopSessionsTtl(Duration shopSessionsTtl) {
      this.shopSessionsTtl = shopSessionsTtl;
    }

    public Duration getInvalidSessionTtl() {
      return invalidSessionTtl;
    }

    public void setInvalidSessionTtl(Duration invalidSessionTtl) {
      this.invalidSessionTtl = invalidSessionTtl;
    }

    public int getMaxSessionsPerShop() {
      return maxSessionsPerShop;
    }

    public void setMaxSessionsPerShop(int maxSessionsPerShop) {
      this.maxSessionsPerShop = maxSessionsPerShop;
    }

    public int getSessionInactivityHours() {
      return sessionInactivityHours;
    }

    public void setSessionInactivityHours(int sessionInactivityHours) {
      this.sessionInactivityHours = sessionInactivityHours;
    }

    public int getSessionCleanupDays() {
      return sessionCleanupDays;
    }

    public void setSessionCleanupDays(int sessionCleanupDays) {
      this.sessionCleanupDays = sessionCleanupDays;
    }

    public int getRedisCacheTtlMinutes() {
      return redisCacheTtlMinutes;
    }

    public void setRedisCacheTtlMinutes(int redisCacheTtlMinutes) {
      this.redisCacheTtlMinutes = redisCacheTtlMinutes;
    }

    public int getRedisFallbackTtlMinutes() {
      return redisFallbackTtlMinutes;
    }

    public void setRedisFallbackTtlMinutes(int redisFallbackTtlMinutes) {
      this.redisFallbackTtlMinutes = redisFallbackTtlMinutes;
    }

    public int getInvalidSessionCacheMinutes() {
      return invalidSessionCacheMinutes;
    }

    public void setInvalidSessionCacheMinutes(int invalidSessionCacheMinutes) {
      this.invalidSessionCacheMinutes = invalidSessionCacheMinutes;
    }

    // Cleanup interval getters and setters
    public Duration getSynchronizationCleanupInterval() {
      return synchronizationCleanupInterval;
    }

    public void setSynchronizationCleanupInterval(Duration synchronizationCleanupInterval) {
      this.synchronizationCleanupInterval = synchronizationCleanupInterval;
    }

    public Duration getStuckMarkersCleanupInterval() {
      return stuckMarkersCleanupInterval;
    }

    public void setStuckMarkersCleanupInterval(Duration stuckMarkersCleanupInterval) {
      this.stuckMarkersCleanupInterval = stuckMarkersCleanupInterval;
    }

    public Duration getCriticalStuckMarkersCleanupInterval() {
      return criticalStuckMarkersCleanupInterval;
    }

    public void setCriticalStuckMarkersCleanupInterval(
        Duration criticalStuckMarkersCleanupInterval) {
      this.criticalStuckMarkersCleanupInterval = criticalStuckMarkersCleanupInterval;
    }

    public Duration getExpiredSessionsCleanupInterval() {
      return expiredSessionsCleanupInterval;
    }

    public void setExpiredSessionsCleanupInterval(Duration expiredSessionsCleanupInterval) {
      this.expiredSessionsCleanupInterval = expiredSessionsCleanupInterval;
    }

    public Duration getStaleSessionsCleanupInterval() {
      return staleSessionsCleanupInterval;
    }

    public void setStaleSessionsCleanupInterval(Duration staleSessionsCleanupInterval) {
      this.staleSessionsCleanupInterval = staleSessionsCleanupInterval;
    }

    public Duration getThrottlingCacheCleanupInterval() {
      return throttlingCacheCleanupInterval;
    }

    public void setThrottlingCacheCleanupInterval(Duration throttlingCacheCleanupInterval) {
      this.throttlingCacheCleanupInterval = throttlingCacheCleanupInterval;
    }

    // Startup delay getters and setters
    public Duration getSynchronizationCleanupStartupDelay() {
      return synchronizationCleanupStartupDelay;
    }

    public void setSynchronizationCleanupStartupDelay(Duration synchronizationCleanupStartupDelay) {
      this.synchronizationCleanupStartupDelay = synchronizationCleanupStartupDelay;
    }

    public Duration getStuckMarkersCleanupStartupDelay() {
      return stuckMarkersCleanupStartupDelay;
    }

    public void setStuckMarkersCleanupStartupDelay(Duration stuckMarkersCleanupStartupDelay) {
      this.stuckMarkersCleanupStartupDelay = stuckMarkersCleanupStartupDelay;
    }

    public Duration getCriticalStuckMarkersCleanupStartupDelay() {
      return criticalStuckMarkersCleanupStartupDelay;
    }

    public void setCriticalStuckMarkersCleanupStartupDelay(
        Duration criticalStuckMarkersCleanupStartupDelay) {
      this.criticalStuckMarkersCleanupStartupDelay = criticalStuckMarkersCleanupStartupDelay;
    }

    public Duration getExpiredSessionsCleanupStartupDelay() {
      return expiredSessionsCleanupStartupDelay;
    }

    public void setExpiredSessionsCleanupStartupDelay(Duration expiredSessionsCleanupStartupDelay) {
      this.expiredSessionsCleanupStartupDelay = expiredSessionsCleanupStartupDelay;
    }

    public Duration getStaleSessionsCleanupStartupDelay() {
      return staleSessionsCleanupStartupDelay;
    }

    public void setStaleSessionsCleanupStartupDelay(Duration staleSessionsCleanupStartupDelay) {
      this.staleSessionsCleanupStartupDelay = staleSessionsCleanupStartupDelay;
    }

    public Duration getThrottlingCacheCleanupStartupDelay() {
      return throttlingCacheCleanupStartupDelay;
    }

    public void setThrottlingCacheCleanupStartupDelay(Duration throttlingCacheCleanupStartupDelay) {
      this.throttlingCacheCleanupStartupDelay = throttlingCacheCleanupStartupDelay;
    }
  }

  /** Cache configuration properties */
  public static class CacheConfiguration {
    @NotNull private Duration defaultTtl = Duration.ofMinutes(10);

    @NotNull private Duration memoryTtl = Duration.ofMinutes(3);

    @Min(100)
    @Max(10000)
    private int maxMemoryCacheSize = 1000;

    @NotNull private Duration cleanupInterval = Duration.ofMinutes(5);

    @NotNull private Duration statisticsInterval = Duration.ofMinutes(10);

    @Min(1)
    @Max(100)
    private int maxBatchSize = 50;

    @NotNull private Duration batchTimeout = Duration.ofSeconds(30);

    // Getters and setters
    public Duration getDefaultTtl() {
      return defaultTtl;
    }

    public void setDefaultTtl(Duration defaultTtl) {
      this.defaultTtl = defaultTtl;
    }

    public Duration getMemoryTtl() {
      return memoryTtl;
    }

    public void setMemoryTtl(Duration memoryTtl) {
      this.memoryTtl = memoryTtl;
    }

    public int getMaxMemoryCacheSize() {
      return maxMemoryCacheSize;
    }

    public void setMaxMemoryCacheSize(int maxMemoryCacheSize) {
      this.maxMemoryCacheSize = maxMemoryCacheSize;
    }

    public Duration getCleanupInterval() {
      return cleanupInterval;
    }

    public void setCleanupInterval(Duration cleanupInterval) {
      this.cleanupInterval = cleanupInterval;
    }

    public Duration getStatisticsInterval() {
      return statisticsInterval;
    }

    public void setStatisticsInterval(Duration statisticsInterval) {
      this.statisticsInterval = statisticsInterval;
    }

    public int getMaxBatchSize() {
      return maxBatchSize;
    }

    public void setMaxBatchSize(int maxBatchSize) {
      this.maxBatchSize = maxBatchSize;
    }

    public Duration getBatchTimeout() {
      return batchTimeout;
    }

    public void setBatchTimeout(Duration batchTimeout) {
      this.batchTimeout = batchTimeout;
    }
  }

  /** Monitoring configuration properties */
  public static class MonitoringConfiguration {
    @NotNull private Duration systemResourcesInterval = Duration.ofMinutes(1);

    @NotNull private Duration databaseInterval = Duration.ofMinutes(2);

    @NotNull private Duration redisInterval = Duration.ofMinutes(3);

    @NotNull private Duration sessionCleanupInterval = Duration.ofMinutes(5);

    @NotNull private Duration sseCleanupInterval = Duration.ofMinutes(1);

    @NotNull private Duration cacheCleanupInterval = Duration.ofMinutes(5);

    @NotNull private Duration dashboardCollectionInterval = Duration.ofSeconds(30);

    @NotNull private Duration healthCheckInterval = Duration.ofSeconds(30);

    @NotNull private Duration connectionTestTimeout = Duration.ofSeconds(5);

    @Min(50)
    @Max(100)
    private int memoryWarningThreshold = 80;

    @Min(50)
    @Max(100)
    private int memoryCriticalThreshold = 95;

    @Min(50)
    @Max(100)
    private int cpuWarningThreshold = 80;

    @Min(50)
    @Max(100)
    private int cpuCriticalThreshold = 95;

    @Min(50)
    @Max(100)
    private int diskWarningThreshold = 80;

    @Min(50)
    @Max(100)
    private int diskCriticalThreshold = 95;

    @Min(50)
    @Max(100)
    private int connectionPoolWarningThreshold = 80;

    @Min(50)
    @Max(100)
    private int connectionPoolCriticalThreshold = 95;

    @Min(1)
    @Max(20)
    private int stuckSessionThreshold = 5;

    @Min(1)
    @Max(50)
    private int sseErrorRateThreshold = 10;

    @Min(1)
    @Max(20)
    private int databaseErrorRateThreshold = 5;

    @Min(10)
    @Max(90)
    private int cacheHitRateThreshold = 50;

    // Getters and setters
    public Duration getSystemResourcesInterval() {
      return systemResourcesInterval;
    }

    public void setSystemResourcesInterval(Duration systemResourcesInterval) {
      this.systemResourcesInterval = systemResourcesInterval;
    }

    public Duration getDatabaseInterval() {
      return databaseInterval;
    }

    public void setDatabaseInterval(Duration databaseInterval) {
      this.databaseInterval = databaseInterval;
    }

    public Duration getRedisInterval() {
      return redisInterval;
    }

    public void setRedisInterval(Duration redisInterval) {
      this.redisInterval = redisInterval;
    }

    public Duration getSessionCleanupInterval() {
      return sessionCleanupInterval;
    }

    public void setSessionCleanupInterval(Duration sessionCleanupInterval) {
      this.sessionCleanupInterval = sessionCleanupInterval;
    }

    public Duration getSseCleanupInterval() {
      return sseCleanupInterval;
    }

    public void setSseCleanupInterval(Duration sseCleanupInterval) {
      this.sseCleanupInterval = sseCleanupInterval;
    }

    public Duration getCacheCleanupInterval() {
      return cacheCleanupInterval;
    }

    public void setCacheCleanupInterval(Duration cacheCleanupInterval) {
      this.cacheCleanupInterval = cacheCleanupInterval;
    }

    public Duration getDashboardCollectionInterval() {
      return dashboardCollectionInterval;
    }

    public void setDashboardCollectionInterval(Duration dashboardCollectionInterval) {
      this.dashboardCollectionInterval = dashboardCollectionInterval;
    }

    public Duration getHealthCheckInterval() {
      return healthCheckInterval;
    }

    public void setHealthCheckInterval(Duration healthCheckInterval) {
      this.healthCheckInterval = healthCheckInterval;
    }

    public Duration getConnectionTestTimeout() {
      return connectionTestTimeout;
    }

    public void setConnectionTestTimeout(Duration connectionTestTimeout) {
      this.connectionTestTimeout = connectionTestTimeout;
    }

    public int getMemoryWarningThreshold() {
      return memoryWarningThreshold;
    }

    public void setMemoryWarningThreshold(int memoryWarningThreshold) {
      this.memoryWarningThreshold = memoryWarningThreshold;
    }

    public int getMemoryCriticalThreshold() {
      return memoryCriticalThreshold;
    }

    public void setMemoryCriticalThreshold(int memoryCriticalThreshold) {
      this.memoryCriticalThreshold = memoryCriticalThreshold;
    }

    public int getCpuWarningThreshold() {
      return cpuWarningThreshold;
    }

    public void setCpuWarningThreshold(int cpuWarningThreshold) {
      this.cpuWarningThreshold = cpuWarningThreshold;
    }

    public int getCpuCriticalThreshold() {
      return cpuCriticalThreshold;
    }

    public void setCpuCriticalThreshold(int cpuCriticalThreshold) {
      this.cpuCriticalThreshold = cpuCriticalThreshold;
    }

    public int getDiskWarningThreshold() {
      return diskWarningThreshold;
    }

    public void setDiskWarningThreshold(int diskWarningThreshold) {
      this.diskWarningThreshold = diskWarningThreshold;
    }

    public int getDiskCriticalThreshold() {
      return diskCriticalThreshold;
    }

    public void setDiskCriticalThreshold(int diskCriticalThreshold) {
      this.diskCriticalThreshold = diskCriticalThreshold;
    }

    public int getConnectionPoolWarningThreshold() {
      return connectionPoolWarningThreshold;
    }

    public void setConnectionPoolWarningThreshold(int connectionPoolWarningThreshold) {
      this.connectionPoolWarningThreshold = connectionPoolWarningThreshold;
    }

    public int getConnectionPoolCriticalThreshold() {
      return connectionPoolCriticalThreshold;
    }

    public void setConnectionPoolCriticalThreshold(int connectionPoolCriticalThreshold) {
      this.connectionPoolCriticalThreshold = connectionPoolCriticalThreshold;
    }

    public int getStuckSessionThreshold() {
      return stuckSessionThreshold;
    }

    public void setStuckSessionThreshold(int stuckSessionThreshold) {
      this.stuckSessionThreshold = stuckSessionThreshold;
    }

    public int getSseErrorRateThreshold() {
      return sseErrorRateThreshold;
    }

    public void setSseErrorRateThreshold(int sseErrorRateThreshold) {
      this.sseErrorRateThreshold = sseErrorRateThreshold;
    }

    public int getDatabaseErrorRateThreshold() {
      return databaseErrorRateThreshold;
    }

    public void setDatabaseErrorRateThreshold(int databaseErrorRateThreshold) {
      this.databaseErrorRateThreshold = databaseErrorRateThreshold;
    }

    public int getCacheHitRateThreshold() {
      return cacheHitRateThreshold;
    }

    public void setCacheHitRateThreshold(int cacheHitRateThreshold) {
      this.cacheHitRateThreshold = cacheHitRateThreshold;
    }
  }

  /** Security configuration properties */
  public static class SecurityConfiguration {
    @NotNull private Duration rateLimitWindow = Duration.ofMinutes(1);

    @Min(10)
    @Max(1000)
    private int rateLimitRequests = 60;

    @NotNull private Duration adminSessionTimeout = Duration.ofHours(1);

    @Min(1)
    @Max(10)
    private int maxLoginAttempts = 5;

    @NotNull private Duration lockoutDuration = Duration.ofMinutes(15);

    @NotNull private Duration tokenExpiry = Duration.ofHours(24);

    private boolean requireHttps = true;

    private boolean auditLogging = true;

    private boolean csrfEnabled = true;

    private boolean xssProtection = true;

    private boolean contentSecurityPolicy = true;

    @NotNull private Duration sessionValidationInterval = Duration.ofMinutes(5);

    @NotNull private Duration ipValidationTimeout = Duration.ofMinutes(30);

    // Getters and setters
    public Duration getRateLimitWindow() {
      return rateLimitWindow;
    }

    public void setRateLimitWindow(Duration rateLimitWindow) {
      this.rateLimitWindow = rateLimitWindow;
    }

    public int getRateLimitRequests() {
      return rateLimitRequests;
    }

    public void setRateLimitRequests(int rateLimitRequests) {
      this.rateLimitRequests = rateLimitRequests;
    }

    public Duration getAdminSessionTimeout() {
      return adminSessionTimeout;
    }

    public void setAdminSessionTimeout(Duration adminSessionTimeout) {
      this.adminSessionTimeout = adminSessionTimeout;
    }

    public int getMaxLoginAttempts() {
      return maxLoginAttempts;
    }

    public void setMaxLoginAttempts(int maxLoginAttempts) {
      this.maxLoginAttempts = maxLoginAttempts;
    }

    public Duration getLockoutDuration() {
      return lockoutDuration;
    }

    public void setLockoutDuration(Duration lockoutDuration) {
      this.lockoutDuration = lockoutDuration;
    }

    public Duration getTokenExpiry() {
      return tokenExpiry;
    }

    public void setTokenExpiry(Duration tokenExpiry) {
      this.tokenExpiry = tokenExpiry;
    }

    public boolean isRequireHttps() {
      return requireHttps;
    }

    public void setRequireHttps(boolean requireHttps) {
      this.requireHttps = requireHttps;
    }

    public boolean isAuditLogging() {
      return auditLogging;
    }

    public void setAuditLogging(boolean auditLogging) {
      this.auditLogging = auditLogging;
    }

    public boolean isCsrfEnabled() {
      return csrfEnabled;
    }

    public void setCsrfEnabled(boolean csrfEnabled) {
      this.csrfEnabled = csrfEnabled;
    }

    public boolean isXssProtection() {
      return xssProtection;
    }

    public void setXssProtection(boolean xssProtection) {
      this.xssProtection = xssProtection;
    }

    public boolean isContentSecurityPolicy() {
      return contentSecurityPolicy;
    }

    public void setContentSecurityPolicy(boolean contentSecurityPolicy) {
      this.contentSecurityPolicy = contentSecurityPolicy;
    }

    public Duration getSessionValidationInterval() {
      return sessionValidationInterval;
    }

    public void setSessionValidationInterval(Duration sessionValidationInterval) {
      this.sessionValidationInterval = sessionValidationInterval;
    }

    public Duration getIpValidationTimeout() {
      return ipValidationTimeout;
    }

    public void setIpValidationTimeout(Duration ipValidationTimeout) {
      this.ipValidationTimeout = ipValidationTimeout;
    }
  }

  /** Discovery configuration properties */
  public static class DiscoveryConfiguration {
    @NotNull private Duration cacheTimeout = Duration.ofHours(2);

    @Min(1)
    @Max(50)
    private int maxResults = 10;

    @Min(1)
    @Max(10)
    private int maxConcurrentRequests = 3;

    @NotNull private Duration requestTimeout = Duration.ofSeconds(30);

    @NotNull private Duration rateLimitDelay = Duration.ofMillis(500);

    @Min(1)
    @Max(100)
    private int maxSuggestionsPerProduct = 5;

    @Min(1)
    @Max(200)
    private int maxProductsPerShop = 50;

    @Min(1)
    @Max(1000)
    private int maxTotalSuggestions = 200;

    @Min(1)
    @Max(500)
    private int maxUrlsPerShop = 100;

    @Min(1)
    @Max(20)
    private int maxProducts = 20;

    @NotNull private Duration keywordCacheTtl = Duration.ofMinutes(30);

    @Min(1)
    @Max(10)
    private int minKeywordFrequency = 2;

    // Getters and setters
    public Duration getCacheTimeout() {
      return cacheTimeout;
    }

    public void setCacheTimeout(Duration cacheTimeout) {
      this.cacheTimeout = cacheTimeout;
    }

    public int getMaxResults() {
      return maxResults;
    }

    public void setMaxResults(int maxResults) {
      this.maxResults = maxResults;
    }

    public int getMaxConcurrentRequests() {
      return maxConcurrentRequests;
    }

    public void setMaxConcurrentRequests(int maxConcurrentRequests) {
      this.maxConcurrentRequests = maxConcurrentRequests;
    }

    public Duration getRequestTimeout() {
      return requestTimeout;
    }

    public void setRequestTimeout(Duration requestTimeout) {
      this.requestTimeout = requestTimeout;
    }

    public Duration getRateLimitDelay() {
      return rateLimitDelay;
    }

    public void setRateLimitDelay(Duration rateLimitDelay) {
      this.rateLimitDelay = rateLimitDelay;
    }

    public int getMaxSuggestionsPerProduct() {
      return maxSuggestionsPerProduct;
    }

    public void setMaxSuggestionsPerProduct(int maxSuggestionsPerProduct) {
      this.maxSuggestionsPerProduct = maxSuggestionsPerProduct;
    }

    public int getMaxProductsPerShop() {
      return maxProductsPerShop;
    }

    public void setMaxProductsPerShop(int maxProductsPerShop) {
      this.maxProductsPerShop = maxProductsPerShop;
    }

    public int getMaxTotalSuggestions() {
      return maxTotalSuggestions;
    }

    public void setMaxTotalSuggestions(int maxTotalSuggestions) {
      this.maxTotalSuggestions = maxTotalSuggestions;
    }

    public int getMaxUrlsPerShop() {
      return maxUrlsPerShop;
    }

    public void setMaxUrlsPerShop(int maxUrlsPerShop) {
      this.maxUrlsPerShop = maxUrlsPerShop;
    }

    public int getMaxProducts() {
      return maxProducts;
    }

    public void setMaxProducts(int maxProducts) {
      this.maxProducts = maxProducts;
    }

    public Duration getKeywordCacheTtl() {
      return keywordCacheTtl;
    }

    public void setKeywordCacheTtl(Duration keywordCacheTtl) {
      this.keywordCacheTtl = keywordCacheTtl;
    }

    public int getMinKeywordFrequency() {
      return minKeywordFrequency;
    }

    public void setMinKeywordFrequency(int minKeywordFrequency) {
      this.minKeywordFrequency = minKeywordFrequency;
    }
  }
}
