package com.storesight.backend.service.discovery;

import jakarta.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/** Multi-source search client that intelligently routes requests to the best available provider */
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

  @Autowired private List<SearchClient> searchClients;

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
    config.put(
        "providers",
        sortedProviders.stream().map(SearchClient::getProviderConfig).collect(Collectors.toList()));
    return config;
  }

  @Override
  @Cacheable(
      value = "searchResults",
      key = "#keywords + '_' + #maxResults",
      unless = "#result.isEmpty()")
  public List<SearchResult> search(String keywords, int maxResults) {
    if (!isEnabled()) {
      log.warn("MultiSourceSearchClient is not enabled");
      return List.of();
    }

    List<SearchResult> allResults = new ArrayList<>();
    Set<String> seenUrls = new HashSet<>();
    int providersUsed = 0;

    for (SearchClient provider : sortedProviders) {
      if (providersUsed >= maxProvidersToTry) {
        break;
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

        // Deduplicate results by URL
        for (SearchResult result : results) {
          if (seenUrls.add(result.getUrl().toLowerCase())) {
            allResults.add(result);
          }
        }

        providersUsed++;

        log.info(
            "Provider {} returned {} unique results", provider.getProviderName(), results.size());

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

    log.info(
        "Multi-source search for '{}' returned {} results from {} providers",
        keywords,
        finalResults.size(),
        providersUsed);

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
    return stats;
  }
}
