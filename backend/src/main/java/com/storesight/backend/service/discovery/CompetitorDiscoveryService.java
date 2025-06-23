package com.storesight.backend.service.discovery;

import com.storesight.backend.model.CompetitorSuggestion;
import com.storesight.backend.repository.CompetitorSuggestionRepository;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Service for automatic competitor discovery */
@Service
public class CompetitorDiscoveryService {

  private static final Logger log = LoggerFactory.getLogger(CompetitorDiscoveryService.class);
  private static final int MAX_RESULTS_PER_PRODUCT = 5;
  private static final Executor discoveryExecutor = Executors.newFixedThreadPool(3);

  @Autowired private CompetitorSuggestionRepository suggestionRepository;

  @Autowired private JdbcTemplate jdbcTemplate;

  @Autowired private SearchClient searchClient;

  @Autowired private KeywordBuilder keywordBuilder;

  /** Scheduled task to discover competitors for all active shops Runs daily at 3:45 AM */
  @Scheduled(cron = "0 45 3 * * *")
  public void discoverCompetitorsForAllShops() {
    if (!searchClient.isEnabled()) {
      log.info("Competitor discovery is disabled - search client not available");
      return;
    }

    log.info("Starting daily competitor discovery for all shops");

    try {
      List<Map<String, Object>> activeShops =
          jdbcTemplate.queryForList(
              "SELECT id, shopify_domain FROM shops WHERE created_at >= NOW() - INTERVAL '90 days'");

      log.info("Found {} active shops for competitor discovery", activeShops.size());

      for (Map<String, Object> shop : activeShops) {
        Long shopId = ((Number) shop.get("id")).longValue();
        String shopDomain = (String) shop.get("shopify_domain");

        // Run discovery for each shop asynchronously
        CompletableFuture.runAsync(
            () -> {
              try {
                discoverCompetitorsForShop(shopId, shopDomain);
              } catch (Exception e) {
                log.error(
                    "Error discovering competitors for shop {}: {}", shopDomain, e.getMessage(), e);
              }
            },
            discoveryExecutor);
      }

    } catch (Exception e) {
      log.error("Error in daily competitor discovery: {}", e.getMessage(), e);
    }
  }

  /** Discover competitors for a specific shop */
  @Transactional
  public void discoverCompetitorsForShop(Long shopId, String shopDomain) {
    log.info("Starting competitor discovery for shop: {} (ID: {})", shopDomain, shopId);

    try {
      // Get products for this shop
      List<Map<String, Object>> products =
          jdbcTemplate.queryForList(
              "SELECT id, title, price FROM products WHERE shop_id = ? AND title IS NOT NULL",
              shopId);

      if (products.isEmpty()) {
        log.info("No products found for shop: {}", shopDomain);
        return;
      }

      log.info(
          "Found {} products for competitor discovery in shop: {}", products.size(), shopDomain);

      int totalSuggestions = 0;

      for (Map<String, Object> product : products) {
        Long productId = ((Number) product.get("id")).longValue();
        String productTitle = (String) product.get("title");
        BigDecimal productPrice = (BigDecimal) product.get("price");

        try {
          int suggestions =
              discoverCompetitorsForProduct(
                  shopId, productId, productTitle, productPrice, shopDomain);
          totalSuggestions += suggestions;

          // Small delay to be respectful to the search API
          Thread.sleep(1000);

        } catch (Exception e) {
          log.error(
              "Error discovering competitors for product {} in shop {}: {}",
              productTitle,
              shopDomain,
              e.getMessage());
        }
      }

      log.info(
          "Completed competitor discovery for shop: {} - {} total suggestions added",
          shopDomain,
          totalSuggestions);

    } catch (Exception e) {
      log.error("Error discovering competitors for shop {}: {}", shopDomain, e.getMessage(), e);
    }
  }

  /** Discover competitors for a specific product */
  @Transactional
  public int discoverCompetitorsForProduct(
      Long shopId,
      Long productId,
      String productTitle,
      BigDecimal productPrice,
      String shopDomain) {

    log.debug("Discovering competitors for product: {} (ID: {})", productTitle, productId);

    // Build search keywords
    String keywords = keywordBuilder.buildCompetitorKeywords(productTitle, null, null);

    if (keywords.trim().isEmpty()) {
      log.warn("No valid keywords generated for product: {}", productTitle);
      return 0;
    }

    // Search for competitors
    List<SearchClient.SearchResult> searchResults =
        searchClient.search(keywords, MAX_RESULTS_PER_PRODUCT);

    if (searchResults.isEmpty()) {
      log.debug("No search results found for product: {}", productTitle);
      return 0;
    }

    int suggestionsAdded = 0;

    for (SearchClient.SearchResult result : searchResults) {
      try {
        // Filter out own domain
        if (isOwnDomain(result.getUrl(), shopDomain)) {
          log.debug("Skipping own domain: {}", result.getUrl());
          continue;
        }

        // Check if suggestion already exists
        if (suggestionRepository.existsByShopIdAndProductIdAndSuggestedUrl(
            shopId, productId, result.getUrl())) {
          log.debug("Suggestion already exists for URL: {}", result.getUrl());
          continue;
        }

        // Create new suggestion
        CompetitorSuggestion suggestion =
            new CompetitorSuggestion(
                shopId,
                productId,
                result.getUrl(),
                result.getTitle(),
                result.getPrice() != null ? BigDecimal.valueOf(result.getPrice()) : null,
                CompetitorSuggestion.Source.GOOGLE_SHOPPING);

        suggestionRepository.save(suggestion);
        suggestionsAdded++;

        log.debug("Added competitor suggestion: {} -> {}", result.getTitle(), result.getUrl());

      } catch (Exception e) {
        log.error(
            "Error processing search result for product {}: {}", productTitle, e.getMessage());
      }
    }

    log.debug("Added {} competitor suggestions for product: {}", suggestionsAdded, productTitle);
    return suggestionsAdded;
  }

  /** Check if a URL belongs to the merchant's own domain */
  private boolean isOwnDomain(String url, String shopDomain) {
    try {
      URI uri = new URI(url);
      String host = uri.getHost();

      if (host == null) {
        return false;
      }

      // Check if it's the Shopify domain
      if (host.equals(shopDomain) || host.endsWith("." + shopDomain)) {
        return true;
      }

      // Check if it's a custom domain (this is basic - could be enhanced)
      // For now, we'll just check common patterns
      return false;

    } catch (URISyntaxException e) {
      log.debug("Invalid URL format: {}", url);
      return false;
    }
  }

  /** Manually trigger discovery for a specific shop (for testing/admin use) */
  public void triggerDiscoveryForShop(Long shopId) {
    log.info("Manually triggering competitor discovery for shop ID: {}", shopId);

    Map<String, Object> shop =
        jdbcTemplate.queryForMap("SELECT shopify_domain FROM shops WHERE id = ?", shopId);

    String shopDomain = (String) shop.get("shopify_domain");
    discoverCompetitorsForShop(shopId, shopDomain);
  }

  /** Get discovery status/stats */
  public Map<String, Object> getDiscoveryStats() {
    long totalSuggestions = suggestionRepository.count();

    // Count all NEW suggestions across all shops
    long newSuggestions =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM competitor_suggestions WHERE status = 'NEW'", Long.class);

    // Count all APPROVED suggestions across all shops
    long approvedSuggestions =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM competitor_suggestions WHERE status = 'APPROVED'", Long.class);

    Map<String, Object> stats =
        Map.of(
            "searchClientEnabled", searchClient.isEnabled(),
            "searchClientProvider", searchClient.getProviderName(),
            "totalSuggestions", totalSuggestions,
            "newSuggestions", newSuggestions,
            "approvedSuggestions", approvedSuggestions);

    log.debug("Discovery stats: {}", stats);
    return stats;
  }
}
