package com.storesight.backend.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Type-safe interfaces for Market Intelligence cache data structures. Provides better API design
 * and type safety compared to using Object.
 */
public class MarketIntelligenceCacheTypes {

  /** Dashboard data structure */
  public static class DashboardData {
    @JsonProperty("systemStatus")
    private SystemStatus systemStatus;

    @JsonProperty("costAnalytics")
    private CostAnalytics costAnalytics;

    @JsonProperty("discoveryStats")
    private DiscoveryStats discoveryStats;

    @JsonProperty("providerStats")
    private ProviderStats providerStats;

    @JsonProperty("performanceMetrics")
    private PerformanceMetrics performanceMetrics;

    @JsonProperty("cachedAt")
    private LocalDateTime cachedAt;

    // Constructors
    public DashboardData() {}

    public DashboardData(
        SystemStatus systemStatus,
        CostAnalytics costAnalytics,
        DiscoveryStats discoveryStats,
        ProviderStats providerStats,
        PerformanceMetrics performanceMetrics) {
      this.systemStatus = systemStatus;
      this.costAnalytics = costAnalytics;
      this.discoveryStats = discoveryStats;
      this.providerStats = providerStats;
      this.performanceMetrics = performanceMetrics;
      this.cachedAt = LocalDateTime.now();
    }

    // Getters and setters
    public SystemStatus getSystemStatus() {
      return systemStatus;
    }

    public void setSystemStatus(SystemStatus systemStatus) {
      this.systemStatus = systemStatus;
    }

    public CostAnalytics getCostAnalytics() {
      return costAnalytics;
    }

    public void setCostAnalytics(CostAnalytics costAnalytics) {
      this.costAnalytics = costAnalytics;
    }

    public DiscoveryStats getDiscoveryStats() {
      return discoveryStats;
    }

    public void setDiscoveryStats(DiscoveryStats discoveryStats) {
      this.discoveryStats = discoveryStats;
    }

    public ProviderStats getProviderStats() {
      return providerStats;
    }

    public void setProviderStats(ProviderStats providerStats) {
      this.providerStats = providerStats;
    }

    public PerformanceMetrics getPerformanceMetrics() {
      return performanceMetrics;
    }

    public void setPerformanceMetrics(PerformanceMetrics performanceMetrics) {
      this.performanceMetrics = performanceMetrics;
    }

    public LocalDateTime getCachedAt() {
      return cachedAt;
    }

    public void setCachedAt(LocalDateTime cachedAt) {
      this.cachedAt = cachedAt;
    }
  }

  /** System status data */
  public static class SystemStatus {
    @JsonProperty("status")
    private String status;

    @JsonProperty("uptime")
    private String uptime;

    @JsonProperty("memoryUsage")
    private Double memoryUsage;

    @JsonProperty("cpuUsage")
    private Double cpuUsage;

    @JsonProperty("activeConnections")
    private Integer activeConnections;

    // Constructors
    public SystemStatus() {}

    public SystemStatus(
        String status,
        String uptime,
        Double memoryUsage,
        Double cpuUsage,
        Integer activeConnections) {
      this.status = status;
      this.uptime = uptime;
      this.memoryUsage = memoryUsage;
      this.cpuUsage = cpuUsage;
      this.activeConnections = activeConnections;
    }

    // Getters and setters
    public String getStatus() {
      return status;
    }

    public void setStatus(String status) {
      this.status = status;
    }

    public String getUptime() {
      return uptime;
    }

    public void setUptime(String uptime) {
      this.uptime = uptime;
    }

    public Double getMemoryUsage() {
      return memoryUsage;
    }

    public void setMemoryUsage(Double memoryUsage) {
      this.memoryUsage = memoryUsage;
    }

    public Double getCpuUsage() {
      return cpuUsage;
    }

    public void setCpuUsage(Double cpuUsage) {
      this.cpuUsage = cpuUsage;
    }

    public Integer getActiveConnections() {
      return activeConnections;
    }

    public void setActiveConnections(Integer activeConnections) {
      this.activeConnections = activeConnections;
    }
  }

  /** Cost analytics data */
  public static class CostAnalytics {
    @JsonProperty("totalCost")
    private Double totalCost;

    @JsonProperty("apiCalls")
    private Integer apiCalls;

    @JsonProperty("avgCostPerCall")
    private Double avgCostPerCall;

    @JsonProperty("period")
    private String period;

    // Constructors
    public CostAnalytics() {}

    public CostAnalytics(Double totalCost, Integer apiCalls, Double avgCostPerCall, String period) {
      this.totalCost = totalCost;
      this.apiCalls = apiCalls;
      this.avgCostPerCall = avgCostPerCall;
      this.period = period;
    }

    // Getters and setters
    public Double getTotalCost() {
      return totalCost;
    }

    public void setTotalCost(Double totalCost) {
      this.totalCost = totalCost;
    }

    public Integer getApiCalls() {
      return apiCalls;
    }

    public void setApiCalls(Integer apiCalls) {
      this.apiCalls = apiCalls;
    }

    public Double getAvgCostPerCall() {
      return avgCostPerCall;
    }

    public void setAvgCostPerCall(Double avgCostPerCall) {
      this.avgCostPerCall = avgCostPerCall;
    }

    public String getPeriod() {
      return period;
    }

    public void setPeriod(String period) {
      this.period = period;
    }
  }

  /** Discovery statistics */
  public static class DiscoveryStats {
    @JsonProperty("totalSuggestions")
    private Integer totalSuggestions;

    @JsonProperty("avgRelevanceScore")
    private Double avgRelevanceScore;

    @JsonProperty("sourcesUsed")
    private List<String> sourcesUsed;

    // Constructors
    public DiscoveryStats() {}

    public DiscoveryStats(
        Integer totalSuggestions, Double avgRelevanceScore, List<String> sourcesUsed) {
      this.totalSuggestions = totalSuggestions;
      this.avgRelevanceScore = avgRelevanceScore;
      this.sourcesUsed = sourcesUsed;
    }

    // Getters and setters
    public Integer getTotalSuggestions() {
      return totalSuggestions;
    }

    public void setTotalSuggestions(Integer totalSuggestions) {
      this.totalSuggestions = totalSuggestions;
    }

    public Double getAvgRelevanceScore() {
      return avgRelevanceScore;
    }

    public void setAvgRelevanceScore(Double avgRelevanceScore) {
      this.avgRelevanceScore = avgRelevanceScore;
    }

    public List<String> getSourcesUsed() {
      return sourcesUsed;
    }

    public void setSourcesUsed(List<String> sourcesUsed) {
      this.sourcesUsed = sourcesUsed;
    }
  }

  /** Provider statistics */
  public static class ProviderStats {
    @JsonProperty("providerBreakdown")
    private Map<String, Integer> providerBreakdown;

    @JsonProperty("totalRequests")
    private Integer totalRequests;

    // Constructors
    public ProviderStats() {}

    public ProviderStats(Map<String, Integer> providerBreakdown, Integer totalRequests) {
      this.providerBreakdown = providerBreakdown;
      this.totalRequests = totalRequests;
    }

    // Getters and setters
    public Map<String, Integer> getProviderBreakdown() {
      return providerBreakdown;
    }

    public void setProviderBreakdown(Map<String, Integer> providerBreakdown) {
      this.providerBreakdown = providerBreakdown;
    }

    public Integer getTotalRequests() {
      return totalRequests;
    }

    public void setTotalRequests(Integer totalRequests) {
      this.totalRequests = totalRequests;
    }
  }

  /** Performance metrics */
  public static class PerformanceMetrics {
    @JsonProperty("avgResponseTime")
    private Double avgResponseTime;

    @JsonProperty("successRate")
    private Double successRate;

    @JsonProperty("errorCount")
    private Integer errorCount;

    // Constructors
    public PerformanceMetrics() {}

    public PerformanceMetrics(Double avgResponseTime, Double successRate, Integer errorCount) {
      this.avgResponseTime = avgResponseTime;
      this.successRate = successRate;
      this.errorCount = errorCount;
    }

    // Getters and setters
    public Double getAvgResponseTime() {
      return avgResponseTime;
    }

    public void setAvgResponseTime(Double avgResponseTime) {
      this.avgResponseTime = avgResponseTime;
    }

    public Double getSuccessRate() {
      return successRate;
    }

    public void setSuccessRate(Double successRate) {
      this.successRate = successRate;
    }

    public Integer getErrorCount() {
      return errorCount;
    }

    public void setErrorCount(Integer errorCount) {
      this.errorCount = errorCount;
    }
  }

  /** Competitor data */
  public static class CompetitorData {
    @JsonProperty("shopId")
    private Long shopId;

    @JsonProperty("competitorCount")
    private Integer competitorCount;

    @JsonProperty("lastCheck")
    private LocalDateTime lastCheck;

    @JsonProperty("activeUrls")
    private List<CompetitorUrl> activeUrls;

    // Constructors
    public CompetitorData() {}

    public CompetitorData(
        Long shopId,
        Integer competitorCount,
        LocalDateTime lastCheck,
        List<CompetitorUrl> activeUrls) {
      this.shopId = shopId;
      this.competitorCount = competitorCount;
      this.lastCheck = lastCheck;
      this.activeUrls = activeUrls;
    }

    // Getters and setters
    public Long getShopId() {
      return shopId;
    }

    public void setShopId(Long shopId) {
      this.shopId = shopId;
    }

    public Integer getCompetitorCount() {
      return competitorCount;
    }

    public void setCompetitorCount(Integer competitorCount) {
      this.competitorCount = competitorCount;
    }

    public LocalDateTime getLastCheck() {
      return lastCheck;
    }

    public void setLastCheck(LocalDateTime lastCheck) {
      this.lastCheck = lastCheck;
    }

    public List<CompetitorUrl> getActiveUrls() {
      return activeUrls;
    }

    public void setActiveUrls(List<CompetitorUrl> activeUrls) {
      this.activeUrls = activeUrls;
    }
  }

  /** Competitor URL data */
  public static class CompetitorUrl {
    @JsonProperty("id")
    private Integer id;

    @JsonProperty("url")
    private String url;

    @JsonProperty("label")
    private String label;

    @JsonProperty("platform")
    private String platform;

    @JsonProperty("status")
    private String status;

    // Constructors
    public CompetitorUrl() {}

    public CompetitorUrl(Integer id, String url, String label, String platform, String status) {
      this.id = id;
      this.url = url;
      this.label = label;
      this.platform = platform;
      this.status = status;
    }

    // Getters and setters
    public Integer getId() {
      return id;
    }

    public void setId(Integer id) {
      this.id = id;
    }

    public String getUrl() {
      return url;
    }

    public void setUrl(String url) {
      this.url = url;
    }

    public String getLabel() {
      return label;
    }

    public void setLabel(String label) {
      this.label = label;
    }

    public String getPlatform() {
      return platform;
    }

    public void setPlatform(String platform) {
      this.platform = platform;
    }

    public String getStatus() {
      return status;
    }

    public void setStatus(String status) {
      this.status = status;
    }
  }

  /** Price data */
  public static class PriceData {
    @JsonProperty("competitorUrlId")
    private Integer competitorUrlId;

    @JsonProperty("currentPrice")
    private Double currentPrice;

    @JsonProperty("previousPrice")
    private Double previousPrice;

    @JsonProperty("priceChangePercent")
    private Double priceChangePercent;

    @JsonProperty("inStock")
    private Boolean inStock;

    @JsonProperty("lastUpdated")
    private LocalDateTime lastUpdated;

    // Constructors
    public PriceData() {}

    public PriceData(
        Integer competitorUrlId,
        Double currentPrice,
        Double previousPrice,
        Double priceChangePercent,
        Boolean inStock,
        LocalDateTime lastUpdated) {
      this.competitorUrlId = competitorUrlId;
      this.currentPrice = currentPrice;
      this.previousPrice = previousPrice;
      this.priceChangePercent = priceChangePercent;
      this.inStock = inStock;
      this.lastUpdated = lastUpdated;
    }

    // Getters and setters
    public Integer getCompetitorUrlId() {
      return competitorUrlId;
    }

    public void setCompetitorUrlId(Integer competitorUrlId) {
      this.competitorUrlId = competitorUrlId;
    }

    public Double getCurrentPrice() {
      return currentPrice;
    }

    public void setCurrentPrice(Double currentPrice) {
      this.currentPrice = currentPrice;
    }

    public Double getPreviousPrice() {
      return previousPrice;
    }

    public void setPreviousPrice(Double previousPrice) {
      this.previousPrice = previousPrice;
    }

    public Double getPriceChangePercent() {
      return priceChangePercent;
    }

    public void setPriceChangePercent(Double priceChangePercent) {
      this.priceChangePercent = priceChangePercent;
    }

    public Boolean getInStock() {
      return inStock;
    }

    public void setInStock(Boolean inStock) {
      this.inStock = inStock;
    }

    public LocalDateTime getLastUpdated() {
      return lastUpdated;
    }

    public void setLastUpdated(LocalDateTime lastUpdated) {
      this.lastUpdated = lastUpdated;
    }
  }

  /** Cache statistics */
  public static class CacheStats {
    @JsonProperty("hits")
    private Long hits;

    @JsonProperty("misses")
    private Long misses;

    @JsonProperty("hitRate")
    private Double hitRate;

    @JsonProperty("size")
    private Integer size;

    @JsonProperty("lastUpdated")
    private LocalDateTime lastUpdated;

    // Constructors
    public CacheStats() {}

    public CacheStats(Long hits, Long misses, Double hitRate, Integer size) {
      this.hits = hits;
      this.misses = misses;
      this.hitRate = hitRate;
      this.size = size;
      this.lastUpdated = LocalDateTime.now();
    }

    // Getters and setters
    public Long getHits() {
      return hits;
    }

    public void setHits(Long hits) {
      this.hits = hits;
    }

    public Long getMisses() {
      return misses;
    }

    public void setMisses(Long misses) {
      this.misses = misses;
    }

    public Double getHitRate() {
      return hitRate;
    }

    public void setHitRate(Double hitRate) {
      this.hitRate = hitRate;
    }

    public Integer getSize() {
      return size;
    }

    public void setSize(Integer size) {
      this.size = size;
    }

    public LocalDateTime getLastUpdated() {
      return lastUpdated;
    }

    public void setLastUpdated(LocalDateTime lastUpdated) {
      this.lastUpdated = lastUpdated;
    }
  }

  /** Generic cache wrapper for typed data */
  public static class CachedData<T> {
    @JsonProperty("data")
    private T data;

    @JsonProperty("cachedAt")
    private LocalDateTime cachedAt;

    @JsonProperty("tier")
    private String tier;

    @JsonProperty("expiresAt")
    private LocalDateTime expiresAt;

    // Constructors
    public CachedData() {}

    public CachedData(T data, String tier, LocalDateTime expiresAt) {
      this.data = data;
      this.tier = tier;
      this.expiresAt = expiresAt;
      this.cachedAt = LocalDateTime.now();
    }

    // Getters and setters
    public T getData() {
      return data;
    }

    public void setData(T data) {
      this.data = data;
    }

    public LocalDateTime getCachedAt() {
      return cachedAt;
    }

    public void setCachedAt(LocalDateTime cachedAt) {
      this.cachedAt = cachedAt;
    }

    public String getTier() {
      return tier;
    }

    public void setTier(String tier) {
      this.tier = tier;
    }

    public LocalDateTime getExpiresAt() {
      return expiresAt;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
      this.expiresAt = expiresAt;
    }

    public boolean isExpired() {
      return expiresAt != null && LocalDateTime.now().isAfter(expiresAt);
    }
  }
}
