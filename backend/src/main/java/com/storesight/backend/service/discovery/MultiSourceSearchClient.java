package com.storesight.backend.service.discovery;

import com.storesight.backend.service.CostOptimizationService;
import jakarta.annotation.PostConstruct;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Multi-source search client that intelligently routes requests to the best available provider with
 * cost optimization
 */
@Service
@ConditionalOnProperty(name = "discovery.enabled", havingValue = "true", matchIfMissing = true)
public class MultiSourceSearchClient implements SearchClient {

  private static final Logger log = LoggerFactory.getLogger(MultiSourceSearchClient.class);

  @Value("${discovery.multi-source.enabled:true}")
  private boolean multiSourceEnabled;

  @Value("${discovery.multi-source.fallback-enabled:true}")
  private boolean fallbackEnabled;

  @Value("${discovery.multi-source.max-providers:3}")
  private int maxProvidersToTry;

  @Value("${discovery.multi-source.cost-optimization:true}")
  private boolean costOptimizationEnabled;

  @Autowired private List<SearchClient> searchClients;
  @Autowired private CostOptimizationService costOptimizationService;

  private List<SearchClient> sortedProviders;

  @PostConstruct
  public void init() {
    // Sort providers by priority (lower number = higher priority)
    sortedProviders =
        searchClients.stream()
            .filter(
                client -> !client.getClass().equals(MultiSourceSearchClient.class)) // Exclude self
            .filter(SearchClient::isEnabled)
            .sorted(Comparator.comparingInt(SearchClient::getPriority))
            .collect(Collectors.toList());

    log.info(
        "Initialized MultiSourceSearchClient with {} providers: {}",
        sortedProviders.size(),
        sortedProviders.stream()
            .map(SearchClient::getProviderName)
            .collect(Collectors.joining(", ")));
  }

  @Override
  public boolean isEnabled() {
    return multiSourceEnabled && !sortedProviders.isEmpty();
  }

  @Override
  public String getProviderName() {
    return "MultiSource ("
        + sortedProviders.stream()
            .map(SearchClient::getProviderName)
            .collect(Collectors.joining(", "))
        + ")";
  }

  @Override
  public double getCostPerSearch() {
    // Return the cost of the primary provider
    return sortedProviders.isEmpty() ? 0.0 : sortedProviders.get(0).getCostPerSearch();
  }

  @Override
  public int getPriority() {
    return 0; // Highest priority when enabled
  }

  @Override
  public boolean supportsVolume(int requestsPerDay) {
    return sortedProviders.stream().anyMatch(client -> client.supportsVolume(requestsPerDay));
  }

  @Override
  public Map<String, Object> getProviderConfig() {
    Map<String, Object> config = new HashMap<>();
    config.put("provider", "multi-source");
    config.put("enabled", isEnabled());
    config.put("fallbackEnabled", fallbackEnabled);
    config.put("maxProviders", maxProvidersToTry);
    config.put("costOptimizationEnabled", costOptimizationEnabled);
    config.put(
        "providers",
        sortedProviders.stream().map(SearchClient::getProviderConfig).collect(Collectors.toList()));
    return config;
  }

  @Override
  public List<SearchResult> search(String keywords, int maxResults) {
    if (!isEnabled()) {
      log.warn("MultiSourceSearchClient is not enabled");
      return List.of();
    }

    // Check cache first if cost optimization is enabled
    String cacheKey = null;
    if (costOptimizationEnabled) {
      cacheKey = costOptimizationService.generateCacheKey("multi-source", keywords, maxResults);
      Optional<List<SearchResult>> cachedResults =
          costOptimizationService.getCachedResults(cacheKey);
      if (cachedResults.isPresent()) {
        log.info("Returning cached results for keywords: '{}'", keywords);
        return cachedResults.get();
      }
    }

    List<SearchResult> allResults = new ArrayList<>();
    Set<String> seenUrls = new HashSet<>();
    int providersUsed = 0;
    BigDecimal totalCost = BigDecimal.ZERO;
    int totalRequests = 0;

    for (SearchClient provider : sortedProviders) {
      if (providersUsed >= maxProvidersToTry) {
        break;
      }

      // Check budget before making request
      BigDecimal estimatedCost = BigDecimal.valueOf(provider.getCostPerSearch());
      if (costOptimizationEnabled
          && !costOptimizationService.canMakeRequest(provider.getProviderName(), estimatedCost)) {
        log.warn("Skipping provider {} due to budget constraints", provider.getProviderName());
        continue;
      }

      try {
        log.info("Trying provider {} for keywords: '{}'", provider.getProviderName(), keywords);

        List<SearchResult> results;
        if (fallbackEnabled) {
          // Use async with timeout for faster fallback
          results =
              CompletableFuture.supplyAsync(() -> provider.search(keywords, maxResults))
                  .orTimeout(30, TimeUnit.SECONDS)
                  .join();
        } else {
          results = provider.search(keywords, maxResults);
        }

        // Track cost
        if (costOptimizationEnabled) {
          totalCost = totalCost.add(estimatedCost);
          totalRequests++;
          // Track cost without shop ID for global tracking
          costOptimizationService.trackApiCost(provider.getProviderName(), estimatedCost, 1);
        }

        // Deduplicate results by URL
        for (SearchResult result : results) {
          if (seenUrls.add(result.getUrl().toLowerCase())) {
            result.setProvider(provider.getProviderName());
            allResults.add(result);
          }
        }

        providersUsed++;

        log.info(
            "Provider {} returned {} unique results (cost: ${})",
            provider.getProviderName(),
            results.size(),
            estimatedCost);

        // If we have enough results, we can stop
        if (allResults.size() >= maxResults) {
          log.info("Reached target result count with {} providers", providersUsed);
          break;
        }

        // If we have some results and fallback is disabled, stop here
        if (!fallbackEnabled && !allResults.isEmpty()) {
          break;
        }

      } catch (Exception e) {
        log.warn(
            "Provider {} failed for keywords '{}': {}",
            provider.getProviderName(),
            keywords,
            e.getMessage());

        // Continue to next provider if fallback is enabled
        if (!fallbackEnabled) {
          break;
        }
      }
    }

    // Limit results to requested amount and sort by relevance/provider priority
    List<SearchResult> finalResults =
        allResults.stream().limit(maxResults).collect(Collectors.toList());

    // Cache results if cost optimization is enabled
    if (costOptimizationEnabled && cacheKey != null && !finalResults.isEmpty()) {
      costOptimizationService.cacheResults(cacheKey, finalResults);
    }

    log.info(
        "Multi-source search for '{}' returned {} results from {} providers (total cost: ${})",
        keywords,
        finalResults.size(),
        providersUsed,
        totalCost);

    return finalResults;
  }

  /** Get statistics about provider usage and performance */
  public Map<String, Object> getProviderStats() {
    Map<String, Object> stats = new HashMap<>();
    stats.put("totalProviders", sortedProviders.size());
    stats.put(
        "enabledProviders",
        sortedProviders.stream().map(SearchClient::getProviderName).collect(Collectors.toList()));
    stats.put(
        "providerCosts",
        sortedProviders.stream()
            .collect(
                Collectors.toMap(SearchClient::getProviderName, SearchClient::getCostPerSearch)));

    // Add cost optimization stats
    if (costOptimizationEnabled) {
      CostOptimizationService.CostAnalytics analytics = costOptimizationService.getCostAnalytics();
      stats.put(
          "costAnalytics",
          Map.of(
              "dailyCost", analytics.getTotalDailyCost(),
              "monthlyCost", analytics.getTotalMonthlyCost(),
              "dailyRequests", analytics.getTotalDailyRequests(),
              "monthlyRequests", analytics.getTotalMonthlyRequests(),
              "estimatedSavings", analytics.getEstimatedSavings(),
              "dailyUsagePercentage", analytics.getDailyUsagePercentage(),
              "monthlyUsagePercentage", analytics.getMonthlyUsagePercentage()));
    }

    return stats;
  }

  /** Get cost optimization recommendations */
  public List<CostOptimizationService.CostOptimizationRecommendation>
      getCostOptimizationRecommendations() {
    if (!costOptimizationEnabled) {
      return List.of();
    }

    return costOptimizationService.getOptimizationRecommendations();
  }

  /** Reset cost tracking (for testing) */
  public void resetCostTracking() {
    if (costOptimizationEnabled) {
      costOptimizationService.resetDailyCosts();
    }
  }
}
