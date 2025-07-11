package com.storesight.backend.service;

import com.storesight.backend.service.discovery.SearchClient;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Advanced cost optimization service for Market Intelligence. Manages API costs, implements
 * intelligent caching strategies, and provides detailed cost analytics.
 */
@Service
public class CostOptimizationService {

  private static final Logger log = LoggerFactory.getLogger(CostOptimizationService.class);

  @Autowired private RedisTemplate<String, Object> redisTemplate;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Value("${cost.optimization.enabled:true}")
  private boolean costOptimizationEnabled;

  @Value("${cost.optimization.daily-budget:5.00}")
  private BigDecimal dailyBudget;

  @Value("${cost.optimization.monthly-budget:100.00}")
  private BigDecimal monthlyBudget;

  @Value("${cost.optimization.alert-threshold:0.8}")
  private double alertThreshold;

  @Value("${cost.optimization.cache-ttl-hours:24}")
  private int cacheTtlHours;

  @Value("${cost.optimization.aggressive-caching:true}")
  private boolean aggressiveCaching;

  // Cost tracking
  private final Map<String, BigDecimal> dailyCosts = new ConcurrentHashMap<>();
  private final Map<String, BigDecimal> monthlyCosts = new ConcurrentHashMap<>();
  private final Map<String, Integer> dailyRequests = new ConcurrentHashMap<>();
  private final Map<String, Integer> monthlyRequests = new ConcurrentHashMap<>();

  /** Track API cost for a search request */
  public void trackApiCost(String provider, BigDecimal cost, int requests) {
    if (!costOptimizationEnabled) {
      return;
    }

    String today = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
    String month = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));

    // Track daily costs
    String dailyKey = provider + "_" + today;
    dailyCosts.merge(dailyKey, cost, BigDecimal::add);
    dailyRequests.merge(dailyKey, requests, Integer::sum);

    // Track monthly costs
    String monthlyKey = provider + "_" + month;
    monthlyCosts.merge(monthlyKey, cost, BigDecimal::add);
    monthlyRequests.merge(monthlyKey, requests, Integer::sum);

    // Store in Redis for persistence
    redisTemplate.opsForValue().set("cost_daily_" + dailyKey, cost.toString(), 25, TimeUnit.HOURS);
    redisTemplate
        .opsForValue()
        .set("cost_monthly_" + monthlyKey, cost.toString(), 32, TimeUnit.DAYS);
    redisTemplate.opsForValue().set("requests_daily_" + dailyKey, requests, 25, TimeUnit.HOURS);
    redisTemplate.opsForValue().set("requests_monthly_" + monthlyKey, requests, 32, TimeUnit.DAYS);

    // Check budget alerts
    checkBudgetAlerts(provider, today, month);

    log.debug("Tracked API cost: {} - ${} ({} requests)", provider, cost, requests);
  }

  /** Check if we can make an API request within budget */
  public boolean canMakeRequest(String provider, BigDecimal estimatedCost) {
    if (!costOptimizationEnabled) {
      return true;
    }

    String today = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
    String month = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));

    String dailyKey = provider + "_" + today;
    String monthlyKey = provider + "_" + month;

    BigDecimal currentDailyCost = dailyCosts.getOrDefault(dailyKey, BigDecimal.ZERO);
    BigDecimal currentMonthlyCost = monthlyCosts.getOrDefault(monthlyKey, BigDecimal.ZERO);

    // Check daily budget
    if (currentDailyCost.add(estimatedCost).compareTo(dailyBudget) > 0) {
      log.warn(
          "Daily budget exceeded for {}: current=${}, estimated=${}, budget=${}",
          provider,
          currentDailyCost,
          estimatedCost,
          dailyBudget);
      return false;
    }

    // Check monthly budget
    if (currentMonthlyCost.add(estimatedCost).compareTo(monthlyBudget) > 0) {
      log.warn(
          "Monthly budget exceeded for {}: current=${}, estimated=${}, budget=${}",
          provider,
          currentMonthlyCost,
          estimatedCost,
          monthlyBudget);
      return false;
    }

    return true;
  }

  /** Get cached search results if available */
  public Optional<List<SearchClient.SearchResult>> getCachedResults(String cacheKey) {
    if (!costOptimizationEnabled) {
      return Optional.empty();
    }

    try {
      Object cached = redisTemplate.opsForValue().get("search_cache_" + cacheKey);
      if (cached != null) {
        log.debug("Cache hit for key: {}", cacheKey);
        return Optional.of((List<SearchClient.SearchResult>) cached);
      }
    } catch (Exception e) {
      log.warn("Error retrieving cached results for key {}: {}", cacheKey, e.getMessage());
    }

    return Optional.empty();
  }

  /** Cache search results */
  public void cacheResults(String cacheKey, List<SearchClient.SearchResult> results) {
    if (!costOptimizationEnabled) {
      return;
    }

    try {
      int ttl = aggressiveCaching ? cacheTtlHours * 2 : cacheTtlHours;
      redisTemplate.opsForValue().set("search_cache_" + cacheKey, results, ttl, TimeUnit.HOURS);
      log.debug("Cached {} results for key: {} (TTL: {}h)", results.size(), cacheKey, ttl);
    } catch (Exception e) {
      log.warn("Error caching results for key {}: {}", cacheKey, e.getMessage());
    }
  }

  /** Generate cache key for search request */
  public String generateCacheKey(String provider, String keywords, int maxResults) {
    return String.format("%s_%s_%d", provider, keywords.hashCode(), maxResults);
  }

  /** Check budget alerts */
  private void checkBudgetAlerts(String provider, String today, String month) {
    String dailyKey = provider + "_" + today;
    String monthlyKey = provider + "_" + month;

    BigDecimal currentDailyCost = dailyCosts.getOrDefault(dailyKey, BigDecimal.ZERO);
    BigDecimal currentMonthlyCost = monthlyCosts.getOrDefault(monthlyKey, BigDecimal.ZERO);

    // Daily budget alert
    double dailyUsage = currentDailyCost.divide(dailyBudget, 4, RoundingMode.HALF_UP).doubleValue();
    if (dailyUsage >= alertThreshold) {
      log.warn(
          "Daily budget alert: {} usage at {:.1f}% (${} of ${})",
          provider, dailyUsage * 100, currentDailyCost, dailyBudget);
    }

    // Monthly budget alert
    double monthlyUsage =
        currentMonthlyCost.divide(monthlyBudget, 4, RoundingMode.HALF_UP).doubleValue();
    if (monthlyUsage >= alertThreshold) {
      log.warn(
          "Monthly budget alert: {} usage at {:.1f}% (${} of ${})",
          provider, monthlyUsage * 100, currentMonthlyCost, monthlyBudget);
    }
  }

  /** Get cost analytics */
  public CostAnalytics getCostAnalytics() {
    String today = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
    String month = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));

    Map<String, BigDecimal> todayCosts = new HashMap<>();
    Map<String, BigDecimal> thisMonthCosts = new HashMap<>();
    Map<String, Integer> todayRequests = new HashMap<>();
    Map<String, Integer> thisMonthRequests = new HashMap<>();

    // Aggregate costs by provider
    for (Map.Entry<String, BigDecimal> entry : dailyCosts.entrySet()) {
      String key = entry.getKey();
      if (key.endsWith("_" + today)) {
        String provider = key.replace("_" + today, "");
        todayCosts.put(provider, entry.getValue());
        todayRequests.put(provider, dailyRequests.getOrDefault(key, 0));
      }
    }

    for (Map.Entry<String, BigDecimal> entry : monthlyCosts.entrySet()) {
      String key = entry.getKey();
      if (key.endsWith("_" + month)) {
        String provider = key.replace("_" + month, "");
        thisMonthCosts.put(provider, entry.getValue());
        thisMonthRequests.put(provider, monthlyRequests.getOrDefault(key, 0));
      }
    }

    // Calculate totals
    BigDecimal totalDailyCost =
        todayCosts.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal totalMonthlyCost =
        thisMonthCosts.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

    int totalDailyRequests = todayRequests.values().stream().mapToInt(Integer::intValue).sum();
    int totalMonthlyRequests =
        thisMonthRequests.values().stream().mapToInt(Integer::intValue).sum();

    // Calculate savings from caching
    BigDecimal estimatedSavings = calculateCachingSavings();

    return new CostAnalytics(
        todayCosts,
        thisMonthCosts,
        todayRequests,
        thisMonthRequests,
        totalDailyCost,
        totalMonthlyCost,
        totalDailyRequests,
        totalMonthlyRequests,
        dailyBudget,
        monthlyBudget,
        estimatedSavings);
  }

  /** Calculate estimated savings from caching */
  private BigDecimal calculateCachingSavings() {
    try {
      // Get cache hit statistics
      Set<String> cacheKeys = redisTemplate.keys("search_cache_*");
      if (cacheKeys == null) {
        return BigDecimal.ZERO;
      }

      // Estimate average cost per search
      BigDecimal averageCostPerSearch = BigDecimal.valueOf(0.005); // $0.005 average

      // Estimate cache hits (simplified calculation)
      int estimatedCacheHits = cacheKeys.size() * 10; // Assume 10 hits per cached result

      return averageCostPerSearch.multiply(BigDecimal.valueOf(estimatedCacheHits));
    } catch (Exception e) {
      log.warn("Error calculating caching savings: {}", e.getMessage());
      return BigDecimal.ZERO;
    }
  }

  /** Get cost optimization recommendations */
  public List<CostOptimizationRecommendation> getOptimizationRecommendations() {
    List<CostOptimizationRecommendation> recommendations = new ArrayList<>();
    CostAnalytics analytics = getCostAnalytics();

    // Check if caching is effective
    if (analytics.getEstimatedSavings().compareTo(BigDecimal.valueOf(10)) < 0) {
      recommendations.add(
          new CostOptimizationRecommendation(
              "ENABLE_AGGRESSIVE_CACHING",
              "Enable aggressive caching to reduce API costs",
              "Current savings: $"
                  + analytics.getEstimatedSavings()
                  + ". Aggressive caching could double your savings.",
              CostOptimizationRecommendation.Priority.HIGH));
    }

    // Check budget usage
    double dailyUsage =
        analytics.getTotalDailyCost().divide(dailyBudget, 4, RoundingMode.HALF_UP).doubleValue();
    if (dailyUsage > 0.7) {
      recommendations.add(
          new CostOptimizationRecommendation(
              "REDUCE_DAILY_SEARCHES",
              "Daily budget usage is high",
              String.format(
                  "Current usage: %.1f%%. Consider reducing search frequency.", dailyUsage * 100),
              CostOptimizationRecommendation.Priority.MEDIUM));
    }

    // Check provider efficiency
    for (Map.Entry<String, BigDecimal> entry : analytics.getTodayCosts().entrySet()) {
      String provider = entry.getKey();
      BigDecimal cost = entry.getValue();
      Integer requests = analytics.getTodayRequests().get(provider);

      if (requests != null && requests > 0) {
        BigDecimal costPerRequest =
            cost.divide(BigDecimal.valueOf(requests), 4, RoundingMode.HALF_UP);
        if (costPerRequest.compareTo(BigDecimal.valueOf(0.01)) > 0) {
          recommendations.add(
              new CostOptimizationRecommendation(
                  "OPTIMIZE_PROVIDER_" + provider.toUpperCase(),
                  "High cost per request for " + provider,
                  String.format(
                      "Cost per request: $%.4f. Consider using a more cost-effective provider.",
                      costPerRequest),
                  CostOptimizationRecommendation.Priority.LOW));
        }
      }
    }

    return recommendations;
  }

  /** Reset daily costs (called at midnight) */
  public void resetDailyCosts() {
    String yesterday =
        LocalDateTime.now().minusDays(1).format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));

    // Archive yesterday's costs
    dailyCosts.entrySet().removeIf(entry -> entry.getKey().endsWith("_" + yesterday));
    dailyRequests.entrySet().removeIf(entry -> entry.getKey().endsWith("_" + yesterday));

    log.info("Reset daily costs for new day");
  }

  /** Cost analytics data class */
  public static class CostAnalytics {
    private final Map<String, BigDecimal> todayCosts;
    private final Map<String, BigDecimal> thisMonthCosts;
    private final Map<String, Integer> todayRequests;
    private final Map<String, Integer> thisMonthRequests;
    private final BigDecimal totalDailyCost;
    private final BigDecimal totalMonthlyCost;
    private final int totalDailyRequests;
    private final int totalMonthlyRequests;
    private final BigDecimal dailyBudget;
    private final BigDecimal monthlyBudget;
    private final BigDecimal estimatedSavings;

    public CostAnalytics(
        Map<String, BigDecimal> todayCosts,
        Map<String, BigDecimal> thisMonthCosts,
        Map<String, Integer> todayRequests,
        Map<String, Integer> thisMonthRequests,
        BigDecimal totalDailyCost,
        BigDecimal totalMonthlyCost,
        int totalDailyRequests,
        int totalMonthlyRequests,
        BigDecimal dailyBudget,
        BigDecimal monthlyBudget,
        BigDecimal estimatedSavings) {
      this.todayCosts = todayCosts;
      this.thisMonthCosts = thisMonthCosts;
      this.todayRequests = todayRequests;
      this.thisMonthRequests = thisMonthRequests;
      this.totalDailyCost = totalDailyCost;
      this.totalMonthlyCost = totalMonthlyCost;
      this.totalDailyRequests = totalDailyRequests;
      this.totalMonthlyRequests = totalMonthlyRequests;
      this.dailyBudget = dailyBudget;
      this.monthlyBudget = monthlyBudget;
      this.estimatedSavings = estimatedSavings;
    }

    // Getters
    public Map<String, BigDecimal> getTodayCosts() {
      return todayCosts;
    }

    public Map<String, BigDecimal> getThisMonthCosts() {
      return thisMonthCosts;
    }

    public Map<String, Integer> getTodayRequests() {
      return todayRequests;
    }

    public Map<String, Integer> getThisMonthRequests() {
      return thisMonthRequests;
    }

    public BigDecimal getTotalDailyCost() {
      return totalDailyCost;
    }

    public BigDecimal getTotalMonthlyCost() {
      return totalMonthlyCost;
    }

    public int getTotalDailyRequests() {
      return totalDailyRequests;
    }

    public int getTotalMonthlyRequests() {
      return totalMonthlyRequests;
    }

    public BigDecimal getDailyBudget() {
      return dailyBudget;
    }

    public BigDecimal getMonthlyBudget() {
      return monthlyBudget;
    }

    public BigDecimal getEstimatedSavings() {
      return estimatedSavings;
    }

    public double getDailyUsagePercentage() {
      return dailyBudget.compareTo(BigDecimal.ZERO) > 0
          ? totalDailyCost.divide(dailyBudget, 4, RoundingMode.HALF_UP).doubleValue()
          : 0.0;
    }

    public double getMonthlyUsagePercentage() {
      return monthlyBudget.compareTo(BigDecimal.ZERO) > 0
          ? totalMonthlyCost.divide(monthlyBudget, 4, RoundingMode.HALF_UP).doubleValue()
          : 0.0;
    }
  }

  /** Cost optimization recommendation */
  public static class CostOptimizationRecommendation {
    private final String id;
    private final String title;
    private final String description;
    private final Priority priority;

    public CostOptimizationRecommendation(
        String id, String title, String description, Priority priority) {
      this.id = id;
      this.title = title;
      this.description = description;
      this.priority = priority;
    }

    public enum Priority {
      HIGH,
      MEDIUM,
      LOW
    }

    // Getters
    public String getId() {
      return id;
    }

    public String getTitle() {
      return title;
    }

    public String getDescription() {
      return description;
    }

    public Priority getPriority() {
      return priority;
    }
  }
}
