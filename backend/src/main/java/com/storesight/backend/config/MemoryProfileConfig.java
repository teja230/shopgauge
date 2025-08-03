package com.storesight.backend.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Memory Profile Configuration
 *
 * <p>Dynamically configures application settings based on available memory. Supports 512MB
 * (emergency), 1GB (balanced), and 2GB (performance) profiles.
 */
@Configuration
@ConfigurationProperties(prefix = "storesight.memory")
public class MemoryProfileConfig {

  private static final Logger logger = LoggerFactory.getLogger(MemoryProfileConfig.class);

  @Value("${storesight.memory.profile:512MB}")
  private String memoryProfile;

  // Current active configuration
  private MemorySettings activeSettings;

  @PostConstruct
  public void initializeMemoryProfile() {
    logger.info("Initializing memory profile: {}", memoryProfile);

    switch (memoryProfile.toUpperCase()) {
      case "512MB":
        activeSettings = new MemorySettings512MB();
        logger.warn("Running in 512MB EMERGENCY mode - performance may be limited");
        break;
      case "1GB":
        activeSettings = new MemorySettings1GB();
        logger.info("Running in 1GB BALANCED mode - optimal for most workloads");
        break;
      case "2GB":
        activeSettings = new MemorySettings2GB();
        logger.info("Running in 2GB PERFORMANCE mode - maximum performance");
        break;
      default:
        logger.warn("Unknown memory profile '{}', defaulting to 512MB", memoryProfile);
        activeSettings = new MemorySettings512MB();
        break;
    }

    logger.info("Memory profile configuration:");
    logger.info("  - Database pool: {} connections", activeSettings.getDbPoolMaxSize());
    logger.info("  - Tomcat threads: {}", activeSettings.getTomcatMaxThreads());
    logger.info("  - Cache size: {} entries", activeSettings.getCacheMaxSize());
    logger.info(
        "  - Request throttling: {}",
        activeSettings.isRequestThrottlingEnabled() ? "ENABLED" : "DISABLED");
    logger.info("  - Max concurrent requests: {}", activeSettings.getMaxConcurrentRequests());
  }

  public MemorySettings getActiveSettings() {
    return activeSettings;
  }

  public String getMemoryProfile() {
    return memoryProfile;
  }

  public boolean isEmergencyMode() {
    return "512MB".equalsIgnoreCase(memoryProfile);
  }

  public boolean isBalancedMode() {
    return "1GB".equalsIgnoreCase(memoryProfile);
  }

  public boolean isPerformanceMode() {
    return "2GB".equalsIgnoreCase(memoryProfile);
  }

  /** Get intelligent scaling recommendation based on current system state */
  public String getScalingRecommendation() {
    Runtime runtime = Runtime.getRuntime();
    double memoryUsage =
        (double) (runtime.totalMemory() - runtime.freeMemory()) / runtime.maxMemory();

    if (isEmergencyMode()) {
      if (memoryUsage > 0.8) {
        return "URGENT: Upgrade to 1GB profile - memory usage critical";
      } else if (memoryUsage > 0.7) {
        return "RECOMMENDED: Upgrade to 1GB profile for better performance";
      } else {
        return "OPTIONAL: Consider 1GB profile to disable request throttling";
      }
    } else if (isBalancedMode()) {
      if (memoryUsage > 0.85) {
        return "URGENT: Upgrade to 2GB profile - approaching memory limits";
      } else if (memoryUsage > 0.75) {
        return "RECOMMENDED: Consider 2GB profile for high-traffic periods";
      } else {
        return "OPTIMAL: Current profile suitable for workload";
      }
    } else if (isPerformanceMode()) {
      if (memoryUsage > 0.9) {
        return "CRITICAL: Consider horizontal scaling or larger instance";
      } else {
        return "OPTIMAL: Maximum performance profile active";
      }
    }

    return "UNKNOWN: Unable to determine recommendation";
  }

  /** Get next recommended profile based on current usage */
  public String getNextRecommendedProfile() {
    Runtime runtime = Runtime.getRuntime();
    double memoryUsage =
        (double) (runtime.totalMemory() - runtime.freeMemory()) / runtime.maxMemory();

    if (isEmergencyMode() && memoryUsage > 0.7) {
      return "1GB";
    } else if (isBalancedMode() && memoryUsage > 0.8) {
      return "2GB";
    }

    return memoryProfile; // No change recommended
  }

  /** Check if system is under memory pressure */
  public boolean isUnderMemoryPressure() {
    Runtime runtime = Runtime.getRuntime();
    double memoryUsage =
        (double) (runtime.totalMemory() - runtime.freeMemory()) / runtime.maxMemory();

    // Different thresholds based on profile
    if (isEmergencyMode()) {
      return memoryUsage > 0.75; // Lower threshold for 512MB
    } else if (isBalancedMode()) {
      return memoryUsage > 0.80; // Medium threshold for 1GB
    } else {
      return memoryUsage > 0.85; // Higher threshold for 2GB
    }
  }

  // Base interface for memory settings
  public interface MemorySettings {
    int getDbPoolMaxSize();

    int getDbPoolMinIdle();

    int getTomcatMaxThreads();

    int getTomcatMaxConnections();

    int getRedisPoolMaxActive();

    int getCacheMaxSize();

    int getAsyncDiscoveryMaxConcurrent();

    int getAsyncScrapingMaxConcurrent();

    int getAsyncNotificationMaxConcurrent();

    int getAsyncQueueCapacity();

    int getMaxSessionsPerShop();

    int getSseMaxConnectionsPerShop();

    int getSseMaxConnectionsGlobal();

    boolean isRequestThrottlingEnabled();

    int getMaxConcurrentRequests();
  }

  // 512MB Emergency Mode Settings
  public static class MemorySettings512MB implements MemorySettings {
    @Override
    public int getDbPoolMaxSize() {
      return 3;
    }

    @Override
    public int getDbPoolMinIdle() {
      return 1;
    }

    @Override
    public int getTomcatMaxThreads() {
      return 15;
    }

    @Override
    public int getTomcatMaxConnections() {
      return 50;
    }

    @Override
    public int getRedisPoolMaxActive() {
      return 2;
    }

    @Override
    public int getCacheMaxSize() {
      return 100;
    }

    @Override
    public int getAsyncDiscoveryMaxConcurrent() {
      return 1;
    }

    @Override
    public int getAsyncScrapingMaxConcurrent() {
      return 1;
    }

    @Override
    public int getAsyncNotificationMaxConcurrent() {
      return 2;
    }

    @Override
    public int getAsyncQueueCapacity() {
      return 50;
    }

    @Override
    public int getMaxSessionsPerShop() {
      return 5;
    }

    @Override
    public int getSseMaxConnectionsPerShop() {
      return 3;
    }

    @Override
    public int getSseMaxConnectionsGlobal() {
      return 20;
    }

    @Override
    public boolean isRequestThrottlingEnabled() {
      return true;
    }

    @Override
    public int getMaxConcurrentRequests() {
      return 2;
    }
  }

  // 1GB Balanced Mode Settings
  public static class MemorySettings1GB implements MemorySettings {
    @Override
    public int getDbPoolMaxSize() {
      return 8;
    }

    @Override
    public int getDbPoolMinIdle() {
      return 3;
    }

    @Override
    public int getTomcatMaxThreads() {
      return 50;
    }

    @Override
    public int getTomcatMaxConnections() {
      return 200;
    }

    @Override
    public int getRedisPoolMaxActive() {
      return 5;
    }

    @Override
    public int getCacheMaxSize() {
      return 500;
    }

    @Override
    public int getAsyncDiscoveryMaxConcurrent() {
      return 3;
    }

    @Override
    public int getAsyncScrapingMaxConcurrent() {
      return 5;
    }

    @Override
    public int getAsyncNotificationMaxConcurrent() {
      return 10;
    }

    @Override
    public int getAsyncQueueCapacity() {
      return 1000;
    }

    @Override
    public int getMaxSessionsPerShop() {
      return 10;
    }

    @Override
    public int getSseMaxConnectionsPerShop() {
      return 5;
    }

    @Override
    public int getSseMaxConnectionsGlobal() {
      return 50;
    }

    @Override
    public boolean isRequestThrottlingEnabled() {
      return false;
    }

    @Override
    public int getMaxConcurrentRequests() {
      return 10;
    }
  }

  // 2GB Performance Mode Settings
  public static class MemorySettings2GB implements MemorySettings {
    @Override
    public int getDbPoolMaxSize() {
      return 15;
    }

    @Override
    public int getDbPoolMinIdle() {
      return 5;
    }

    @Override
    public int getTomcatMaxThreads() {
      return 100;
    }

    @Override
    public int getTomcatMaxConnections() {
      return 500;
    }

    @Override
    public int getRedisPoolMaxActive() {
      return 10;
    }

    @Override
    public int getCacheMaxSize() {
      return 1000;
    }

    @Override
    public int getAsyncDiscoveryMaxConcurrent() {
      return 5;
    }

    @Override
    public int getAsyncScrapingMaxConcurrent() {
      return 10;
    }

    @Override
    public int getAsyncNotificationMaxConcurrent() {
      return 20;
    }

    @Override
    public int getAsyncQueueCapacity() {
      return 2000;
    }

    @Override
    public int getMaxSessionsPerShop() {
      return 20;
    }

    @Override
    public int getSseMaxConnectionsPerShop() {
      return 10;
    }

    @Override
    public int getSseMaxConnectionsGlobal() {
      return 100;
    }

    @Override
    public boolean isRequestThrottlingEnabled() {
      return false;
    }

    @Override
    public int getMaxConcurrentRequests() {
      return 20;
    }
  }
}
