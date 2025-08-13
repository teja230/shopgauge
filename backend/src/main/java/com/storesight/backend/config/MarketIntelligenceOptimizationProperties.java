package com.storesight.backend.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration properties for Market Intelligence Optimization
 *
 * <p>Provides comprehensive configuration management for all Market Intelligence optimization
 * features including caching, batch processing, cache warming, and memory profile settings.
 * Optimized for 512MB Render instances with configurable fallbacks.
 */
@Component
@ConfigurationProperties(prefix = "storesight")
public class MarketIntelligenceOptimizationProperties {

  // =====================================
  // CACHE CONFIGURATION
  // =====================================

  private Cache cache = new Cache();

  public static class Cache {
    private MarketIntelligence marketIntelligence = new MarketIntelligence();
    private Warming warming = new Warming();

    public static class MarketIntelligence {
      private boolean enabled = true;
      private Duration dashboardTtl = Duration.ofMinutes(30);
      private Duration costAnalyticsTtl = Duration.ofHours(2);
      private Duration discoveryStatsTtl = Duration.ofHours(1);
      private Duration providerStatsTtl = Duration.ofMinutes(15);
      private Duration competitorDataTtl = Duration.ofHours(4);
      private Duration priceHistoryTtl = Duration.ofHours(6);
      private Duration performanceMetricsTtl = Duration.ofMinutes(10);
      private Duration systemStatusTtl = Duration.ofMinutes(5);
      private int maxEntries = 1000;
      private int maxMemoryMb = 32;

      // Getters and setters
      public boolean isEnabled() {
        return enabled;
      }

      public void setEnabled(boolean enabled) {
        this.enabled = enabled;
      }

      public Duration getDashboardTtl() {
        return dashboardTtl;
      }

      public void setDashboardTtl(Duration dashboardTtl) {
        this.dashboardTtl = dashboardTtl;
      }

      public Duration getCostAnalyticsTtl() {
        return costAnalyticsTtl;
      }

      public void setCostAnalyticsTtl(Duration costAnalyticsTtl) {
        this.costAnalyticsTtl = costAnalyticsTtl;
      }

      public Duration getDiscoveryStatsTtl() {
        return discoveryStatsTtl;
      }

      public void setDiscoveryStatsTtl(Duration discoveryStatsTtl) {
        this.discoveryStatsTtl = discoveryStatsTtl;
      }

      public Duration getProviderStatsTtl() {
        return providerStatsTtl;
      }

      public void setProviderStatsTtl(Duration providerStatsTtl) {
        this.providerStatsTtl = providerStatsTtl;
      }

      public Duration getCompetitorDataTtl() {
        return competitorDataTtl;
      }

      public void setCompetitorDataTtl(Duration competitorDataTtl) {
        this.competitorDataTtl = competitorDataTtl;
      }

      public Duration getPriceHistoryTtl() {
        return priceHistoryTtl;
      }

      public void setPriceHistoryTtl(Duration priceHistoryTtl) {
        this.priceHistoryTtl = priceHistoryTtl;
      }

      public Duration getPerformanceMetricsTtl() {
        return performanceMetricsTtl;
      }

      public void setPerformanceMetricsTtl(Duration performanceMetricsTtl) {
        this.performanceMetricsTtl = performanceMetricsTtl;
      }

      public Duration getSystemStatusTtl() {
        return systemStatusTtl;
      }

      public void setSystemStatusTtl(Duration systemStatusTtl) {
        this.systemStatusTtl = systemStatusTtl;
      }

      public int getMaxEntries() {
        return maxEntries;
      }

      public void setMaxEntries(int maxEntries) {
        this.maxEntries = maxEntries;
      }

      public int getMaxMemoryMb() {
        return maxMemoryMb;
      }

      public void setMaxMemoryMb(int maxMemoryMb) {
        this.maxMemoryMb = maxMemoryMb;
      }
    }

    public static class Warming {
      private boolean enabled = true;
      private String schedule = "0 */30 * * * *";
      private Max max = new Max();
      private int memoryThreshold = 70;
      private List<String> priorityLevels = List.of("CRITICAL", "HIGH");

      public static class Max {
        private int concurrent = 3;

        public int getConcurrent() {
          return concurrent;
        }

        public void setConcurrent(int concurrent) {
          this.concurrent = concurrent;
        }
      }

      // Getters and setters
      public boolean isEnabled() {
        return enabled;
      }

      public void setEnabled(boolean enabled) {
        this.enabled = enabled;
      }

      public String getSchedule() {
        return schedule;
      }

      public void setSchedule(String schedule) {
        this.schedule = schedule;
      }

      public Max getMax() {
        return max;
      }

      public void setMax(Max max) {
        this.max = max;
      }

      public int getMemoryThreshold() {
        return memoryThreshold;
      }

      public void setMemoryThreshold(int memoryThreshold) {
        this.memoryThreshold = memoryThreshold;
      }

      public List<String> getPriorityLevels() {
        return priorityLevels;
      }

      public void setPriorityLevels(List<String> priorityLevels) {
        this.priorityLevels = priorityLevels;
      }
    }

    // Getters and setters
    public MarketIntelligence getMarketIntelligence() {
      return marketIntelligence;
    }

    public void setMarketIntelligence(MarketIntelligence marketIntelligence) {
      this.marketIntelligence = marketIntelligence;
    }

    public Warming getWarming() {
      return warming;
    }

    public void setWarming(Warming warming) {
      this.warming = warming;
    }
  }

  // =====================================
  // BATCH PROCESSING CONFIGURATION
  // =====================================

  private Batch batch = new Batch();

  public static class Batch {
    private Processing processing = new Processing();

    public static class Processing {
      private boolean enabled = true;
      private Duration interval = Duration.ofMinutes(10);
      private int maxConcurrent = 1;
      private int batchSize = 10;
      private int queueSizeThreshold = 50;
      private int memoryThreshold = 70;

      // Getters and setters
      public boolean isEnabled() {
        return enabled;
      }

      public void setEnabled(boolean enabled) {
        this.enabled = enabled;
      }

      public Duration getInterval() {
        return interval;
      }

      public void setInterval(Duration interval) {
        this.interval = interval;
      }

      public int getMaxConcurrent() {
        return maxConcurrent;
      }

      public void setMaxConcurrent(int maxConcurrent) {
        this.maxConcurrent = maxConcurrent;
      }

      public int getBatchSize() {
        return batchSize;
      }

      public void setBatchSize(int batchSize) {
        this.batchSize = batchSize;
      }

      public int getQueueSizeThreshold() {
        return queueSizeThreshold;
      }

      public void setQueueSizeThreshold(int queueSizeThreshold) {
        this.queueSizeThreshold = queueSizeThreshold;
      }

      public int getMemoryThreshold() {
        return memoryThreshold;
      }

      public void setMemoryThreshold(int memoryThreshold) {
        this.memoryThreshold = memoryThreshold;
      }
    }

    // Getters and setters
    public Processing getProcessing() {
      return processing;
    }

    public void setProcessing(Processing processing) {
      this.processing = processing;
    }
  }

  // =====================================
  // WRITE OPERATIONS CONFIGURATION
  // =====================================

  private Write write = new Write();

  public static class Write {
    private Operations operations = new Operations();

    public static class Operations {
      private boolean enabled = true;
      private boolean writeThroughCache = true;
      private boolean batchEnabled = true;
      private boolean asyncEnabled = true;

      // Getters and setters
      public boolean isEnabled() {
        return enabled;
      }

      public void setEnabled(boolean enabled) {
        this.enabled = enabled;
      }

      public boolean isWriteThroughCache() {
        return writeThroughCache;
      }

      public void setWriteThroughCache(boolean writeThroughCache) {
        this.writeThroughCache = writeThroughCache;
      }

      public boolean isBatchEnabled() {
        return batchEnabled;
      }

      public void setBatchEnabled(boolean batchEnabled) {
        this.batchEnabled = batchEnabled;
      }

      public boolean isAsyncEnabled() {
        return asyncEnabled;
      }

      public void setAsyncEnabled(boolean asyncEnabled) {
        this.asyncEnabled = asyncEnabled;
      }
    }

    // Getters and setters
    public Operations getOperations() {
      return operations;
    }

    public void setOperations(Operations operations) {
      this.operations = operations;
    }
  }

  // =====================================
  // MATERIALIZED VIEWS CONFIGURATION
  // =====================================

  private MaterializedViews materializedViews = new MaterializedViews();

  public static class MaterializedViews {
    private boolean enabled = true;
    private Refresh refresh = new Refresh();

    public static class Refresh {
      private String costSummary = "0 2 * * *"; // Daily at 2 AM
      private String competitorPerformance = "0 */4 * * *"; // Every 4 hours
      private String priceTrends = "0 */2 * * *"; // Every 2 hours
      private String systemPerformance = "0 * * * *"; // Every hour

      // Getters and setters
      public String getCostSummary() {
        return costSummary;
      }

      public void setCostSummary(String costSummary) {
        this.costSummary = costSummary;
      }

      public String getCompetitorPerformance() {
        return competitorPerformance;
      }

      public void setCompetitorPerformance(String competitorPerformance) {
        this.competitorPerformance = competitorPerformance;
      }

      public String getPriceTrends() {
        return priceTrends;
      }

      public void setPriceTrends(String priceTrends) {
        this.priceTrends = priceTrends;
      }

      public String getSystemPerformance() {
        return systemPerformance;
      }

      public void setSystemPerformance(String systemPerformance) {
        this.systemPerformance = systemPerformance;
      }
    }

    // Getters and setters
    public boolean isEnabled() {
      return enabled;
    }

    public void setEnabled(boolean enabled) {
      this.enabled = enabled;
    }

    public Refresh getRefresh() {
      return refresh;
    }

    public void setRefresh(Refresh refresh) {
      this.refresh = refresh;
    }
  }

  // =====================================
  // MEMORY PROFILE CONFIGURATION
  // =====================================

  private Memory memory = new Memory();

  public static class Memory {
    private String profile = "512MB";

    public String getProfile() {
      return profile;
    }

    public void setProfile(String profile) {
      this.profile = profile;
    }

    public boolean is512MB() {
      return "512MB".equals(profile);
    }

    public boolean is1GB() {
      return "1GB".equals(profile);
    }

    public boolean is2GB() {
      return "2GB".equals(profile);
    }
  }

  // =====================================
  // FEATURE FLAGS
  // =====================================

  private Feature feature = new Feature();

  public static class Feature {
    private MarketIntelligence marketIntelligence = new MarketIntelligence();

    public static class MarketIntelligence {
      private boolean cacheEnabled = true;
      private boolean batchEnabled = true;
      private boolean warmingEnabled = true;
      private boolean materializedViewsEnabled = true;
      private boolean writeThroughEnabled = true;
      private boolean eventDrivenInvalidation = true;

      // Getters and setters
      public boolean isCacheEnabled() {
        return cacheEnabled;
      }

      public void setCacheEnabled(boolean cacheEnabled) {
        this.cacheEnabled = cacheEnabled;
      }

      public boolean isBatchEnabled() {
        return batchEnabled;
      }

      public void setBatchEnabled(boolean batchEnabled) {
        this.batchEnabled = batchEnabled;
      }

      public boolean isWarmingEnabled() {
        return warmingEnabled;
      }

      public void setWarmingEnabled(boolean warmingEnabled) {
        this.warmingEnabled = warmingEnabled;
      }

      public boolean isMaterializedViewsEnabled() {
        return materializedViewsEnabled;
      }

      public void setMaterializedViewsEnabled(boolean materializedViewsEnabled) {
        this.materializedViewsEnabled = materializedViewsEnabled;
      }

      public boolean isWriteThroughEnabled() {
        return writeThroughEnabled;
      }

      public void setWriteThroughEnabled(boolean writeThroughEnabled) {
        this.writeThroughEnabled = writeThroughEnabled;
      }

      public boolean isEventDrivenInvalidation() {
        return eventDrivenInvalidation;
      }

      public void setEventDrivenInvalidation(boolean eventDrivenInvalidation) {
        this.eventDrivenInvalidation = eventDrivenInvalidation;
      }
    }

    // Getters and setters
    public MarketIntelligence getMarketIntelligence() {
      return marketIntelligence;
    }

    public void setMarketIntelligence(MarketIntelligence marketIntelligence) {
      this.marketIntelligence = marketIntelligence;
    }
  }

  // =====================================
  // ROLLOUT CONFIGURATION
  // =====================================

  private Rollout rollout = new Rollout();

  public static class Rollout {
    private MarketIntelligence marketIntelligence = new MarketIntelligence();

    public static class MarketIntelligence {
      private int percentage = 100;
      private String shops = "all";

      // Getters and setters
      public int getPercentage() {
        return percentage;
      }

      public void setPercentage(int percentage) {
        this.percentage = percentage;
      }

      public String getShops() {
        return shops;
      }

      public void setShops(String shops) {
        this.shops = shops;
      }

      public boolean isFullRollout() {
        return percentage >= 100;
      }

      public boolean isAllShops() {
        return "all".equals(shops);
      }
    }

    // Getters and setters
    public MarketIntelligence getMarketIntelligence() {
      return marketIntelligence;
    }

    public void setMarketIntelligence(MarketIntelligence marketIntelligence) {
      this.marketIntelligence = marketIntelligence;
    }
  }

  // =====================================
  // RENDER PLATFORM CONFIGURATION
  // =====================================

  private Render render = new Render();

  public static class Render {
    private boolean optimized = true;
    private String memoryProfile = "512MB";
    private String cpuProfile = "0.5";
    private Duration startupProbeDelay = Duration.ofSeconds(60);
    private Duration livenessProbeDelay = Duration.ofSeconds(90);

    // Getters and setters
    public boolean isOptimized() {
      return optimized;
    }

    public void setOptimized(boolean optimized) {
      this.optimized = optimized;
    }

    public String getMemoryProfile() {
      return memoryProfile;
    }

    public void setMemoryProfile(String memoryProfile) {
      this.memoryProfile = memoryProfile;
    }

    public String getCpuProfile() {
      return cpuProfile;
    }

    public void setCpuProfile(String cpuProfile) {
      this.cpuProfile = cpuProfile;
    }

    public Duration getStartupProbeDelay() {
      return startupProbeDelay;
    }

    public void setStartupProbeDelay(Duration startupProbeDelay) {
      this.startupProbeDelay = startupProbeDelay;
    }

    public Duration getLivenessProbeDelay() {
      return livenessProbeDelay;
    }

    public void setLivenessProbeDelay(Duration livenessProbeDelay) {
      this.livenessProbeDelay = livenessProbeDelay;
    }
  }

  // =====================================
  // ROOT GETTERS AND SETTERS
  // =====================================

  public Cache getCache() {
    return cache;
  }

  public void setCache(Cache cache) {
    this.cache = cache;
  }

  public Batch getBatch() {
    return batch;
  }

  public void setBatch(Batch batch) {
    this.batch = batch;
  }

  public Write getWrite() {
    return write;
  }

  public void setWrite(Write write) {
    this.write = write;
  }

  public MaterializedViews getMaterializedViews() {
    return materializedViews;
  }

  public void setMaterializedViews(MaterializedViews materializedViews) {
    this.materializedViews = materializedViews;
  }

  public Memory getMemory() {
    return memory;
  }

  public void setMemory(Memory memory) {
    this.memory = memory;
  }

  public Feature getFeature() {
    return feature;
  }

  public void setFeature(Feature feature) {
    this.feature = feature;
  }

  public Rollout getRollout() {
    return rollout;
  }

  public void setRollout(Rollout rollout) {
    this.rollout = rollout;
  }

  public Render getRender() {
    return render;
  }

  public void setRender(Render render) {
    this.render = render;
  }

  // =====================================
  // UTILITY METHODS
  // =====================================

  /** Check if Market Intelligence optimization is fully enabled */
  public boolean isMarketIntelligenceOptimizationEnabled() {
    return feature.getMarketIntelligence().isCacheEnabled()
        && feature.getMarketIntelligence().isBatchEnabled()
        && feature.getMarketIntelligence().isWarmingEnabled();
  }

  /** Check if feature is enabled for specific shop */
  public boolean isEnabledForShop(String shopDomain) {
    if (!rollout.getMarketIntelligence().isFullRollout()) {
      // Implement percentage-based rollout logic here
      return false;
    }

    if (!rollout.getMarketIntelligence().isAllShops()) {
      // Implement shop-specific rollout logic here
      return false;
    }

    return true;
  }

  /** Get effective batch size based on memory profile */
  public int getEffectiveBatchSize() {
    return switch (memory.getProfile()) {
      case "512MB" -> 10; // Conservative for 512MB
      case "1GB" -> 25; // Moderate for 1GB
      case "2GB" -> 50; // Aggressive for 2GB+
      default -> 20; // Default
    };
  }

  /** Get effective memory threshold based on profile */
  public int getEffectiveMemoryThreshold() {
    return switch (memory.getProfile()) {
      case "512MB" -> 70; // Conservative for 512MB
      case "1GB" -> 75; // Moderate for 1GB
      case "2GB" -> 80; // Aggressive for 2GB+
      default -> 75; // Default
    };
  }

  /** Get configuration summary for debugging */
  public String getConfigurationSummary() {
    return String.format(
        "MarketIntelligenceOptimization[memory=%s, cache=%s, batch=%s, warming=%s, materialized=%s]",
        memory.getProfile(),
        feature.getMarketIntelligence().isCacheEnabled(),
        feature.getMarketIntelligence().isBatchEnabled(),
        feature.getMarketIntelligence().isWarmingEnabled(),
        feature.getMarketIntelligence().isMaterializedViewsEnabled());
  }
}
