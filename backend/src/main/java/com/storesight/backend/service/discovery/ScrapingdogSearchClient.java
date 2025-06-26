package com.storesight.backend.service.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.service.SecretService;
import jakarta.annotation.PostConstruct;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

/** Scrapingdog Search API client - most cost-effective option */
@Service
@Primary
@ConditionalOnProperty(name = "discovery.enabled", havingValue = "true", matchIfMissing = true)
public class ScrapingdogSearchClient implements SearchClient {

  private static final Logger log = LoggerFactory.getLogger(ScrapingdogSearchClient.class);

  @Value("${discovery.scrapingdog.key:${SCRAPINGDOG_KEY:dummy_scrapingdog_key}}")
  private String apiKey;

  @Value("${discovery.scrapingdog.base-url:https://api.scrapingdog.com/google}")
  private String baseUrl;

  @Value("${discovery.scrapingdog.max-results:10}")
  private int defaultMaxResults;

  @Autowired private WebClient webClient;

  @Autowired private SecretService secretService;

  private final ObjectMapper objectMapper = new ObjectMapper();

  @PostConstruct
  public void init() {
    // Try to load API key from Redis secrets as fallback
    if ("dummy_scrapingdog_key".equals(apiKey)) {
      try {
        String redisKey = secretService.getSecret("scrapingdog.api.key").orElse(null);
        if (redisKey != null && !redisKey.trim().isEmpty()) {
          this.apiKey = redisKey.trim();
          log.info("Loaded Scrapingdog API key from Redis secrets");
        }
      } catch (Exception e) {
        log.warn("Could not load Scrapingdog API key from Redis: {}", e.getMessage());
      }
    }
  }

  @Override
  public boolean isEnabled() {
    return apiKey != null && !apiKey.equals("dummy_scrapingdog_key");
  }

  @Override
  public String getProviderName() {
    return "Scrapingdog";
  }

  @Override
  public double getCostPerSearch() {
    return 0.001; // $0.001 per search (5 credits × $0.0002 per credit)
  }

  @Override
  public int getPriority() {
    return 1; // Highest priority (most cost-effective)
  }

  @Override
  public boolean supportsVolume(int requestsPerDay) {
    return true; // Scrapingdog supports high volume
  }

  @Override
  public Map<String, Object> getProviderConfig() {
    Map<String, Object> config = new HashMap<>();
    config.put("provider", "scrapingdog");
    config.put("baseUrl", baseUrl);
    config.put("costPerSearch", getCostPerSearch());
    config.put("maxResults", defaultMaxResults);
    config.put("enabled", isEnabled());
    return config;
  }

  @Override
  public List<SearchResult> search(String keywords, int maxResults) {
    if (!isEnabled()) {
      log.warn("Scrapingdog is not enabled - skipping search for keywords: {}", keywords);
      return List.of();
    }

    // Use configured default if maxResults is not specified
    int actualMaxResults = maxResults > 0 ? maxResults : defaultMaxResults;

    try {
      log.info(
          "Searching with Scrapingdog for keywords: '{}' (max results: {})",
          keywords,
          actualMaxResults);

      String response =
          webClient
              .get()
              .uri(
                  uriBuilder -> {
                    try {
                      URI uri = URI.create(baseUrl);
                      return uriBuilder
                          .scheme(uri.getScheme())
                          .host(uri.getHost())
                          .port(uri.getPort() != -1 ? uri.getPort() : -1)
                          .path(uri.getPath())
                          .queryParam("api_key", apiKey)
                          .queryParam("query", keywords)
                          .queryParam(
                              "results", Math.min(actualMaxResults, 100)) // Scrapingdog limit
                          .queryParam("country", "us")
                          .build();
                    } catch (Exception e) {
                      log.error("Invalid Scrapingdog base URL: {}", baseUrl, e);
                      // Fallback to default URL
                      return uriBuilder
                          .scheme("https")
                          .host("api.scrapingdog.com")
                          .path("/google")
                          .queryParam("api_key", apiKey)
                          .queryParam("query", keywords)
                          .queryParam("results", Math.min(actualMaxResults, 100))
                          .queryParam("country", "us")
                          .build();
                    }
                  })
              .retrieve()
              .bodyToMono(String.class)
              .block();

      return parseResponse(response);

    } catch (Exception e) {
      log.error(
          "Error searching with Scrapingdog for keywords '{}': {}", keywords, e.getMessage(), e);
      return List.of();
    }
  }

  private List<SearchResult> parseResponse(String response) {
    List<SearchResult> results = new ArrayList<>();

    try {
      JsonNode root = objectMapper.readTree(response);
      JsonNode organicResults = root.path("organic_data");

      if (organicResults.isArray()) {
        for (JsonNode result : organicResults) {
          String url = result.path("link").asText();
          String title = result.path("title").asText();
          String description = result.path("description").asText();

          // Scrapingdog doesn't provide pricing in search results
          // We'll need to extract this from the target site later
          Double price = null;

          if (!url.isEmpty() && !title.isEmpty()) {
            SearchResult searchResult = new SearchResult(url, title, price, description);
            searchResult.setProvider("Scrapingdog");
            results.add(searchResult);
          }
        }
      }

      log.info("Parsed {} results from Scrapingdog", results.size());

    } catch (Exception e) {
      log.error("Error parsing Scrapingdog response: {}", e.getMessage(), e);
    }

    return results;
  }
}
