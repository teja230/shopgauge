package com.storesight.backend.service.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.service.SecretService;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** SerpAPI implementation for Google Shopping search */
@Service
@ConditionalOnProperty(name = "discovery.enabled", havingValue = "true", matchIfMissing = true)
public class SerpApiSearchClient implements SearchClient {

  private static final Logger log = LoggerFactory.getLogger(SerpApiSearchClient.class);
  private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(30);

  private final WebClient webClient;
  private final ObjectMapper objectMapper;
  private final SecretService secretService;

  @Value("${discovery.serpapi.key:}")
  private String apiKey;

  @Value("${discovery.serpapi.base-url:https://serpapi.com/search.json}")
  private String baseUrl;

  @Value("${discovery.max.results:10}")
  private int defaultMaxResults;

  @Value("${discovery.serpapi.max-results:3}")
  private int serpapiMaxResults;

  private boolean enabled;

  @Autowired
  public SerpApiSearchClient(
      SecretService secretService,
      @Value("${discovery.serpapi.key:}") String apiKey,
      WebClient.Builder webClientBuilder) {
    this.secretService = secretService;
    this.apiKey = apiKey;
    this.webClient = webClientBuilder.build();
    this.objectMapper = new ObjectMapper();
  }

  @PostConstruct
  public void initializeSecrets() {
    // Fallback to Redis-stored secrets if env vars are not provided
    if (apiKey == null || apiKey.isBlank() || apiKey.equals("dummy_serpapi_key")) {
      secretService
          .getSecret("serpapi.api.key")
          .ifPresent(
              val -> {
                this.apiKey = val;
                log.info("Loaded SerpAPI key from Redis secret store");
              });
    }

    this.enabled =
        apiKey != null && !apiKey.trim().isEmpty() && !apiKey.equals("dummy_serpapi_key");

    // Log final state
    log.info(
        "SerpAPI client initialized - enabled: {}, API key: {}, base URL: {}",
        enabled,
        apiKey != null ? apiKey.substring(0, Math.min(8, apiKey.length())) + "..." : "null",
        baseUrl);
  }

  @Override
  public List<SearchResult> search(String keywords, int maxResults) {
    if (!isEnabled()) {
      log.warn("SerpAPI is not enabled - skipping search for keywords: {}", keywords);
      return List.of();
    }

    // Use SerpAPI-specific max results (more restrictive)
    int actualMaxResults =
        Math.min(maxResults > 0 ? maxResults : serpapiMaxResults, serpapiMaxResults);

    try {
      log.info(
          "Searching for competitors using keywords: '{}' (max results: {})",
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
                          .queryParam("engine", "google_shopping")
                          .queryParam("q", keywords)
                          .queryParam("api_key", apiKey)
                          .queryParam("num", Math.min(actualMaxResults, 20)) // SerpAPI limit
                          .build();
                    } catch (Exception e) {
                      log.error("Invalid SerpAPI base URL: {}", baseUrl, e);
                      // Fallback to default URL
                      return uriBuilder
                          .scheme("https")
                          .host("serpapi.com")
                          .path("/search.json")
                          .queryParam("engine", "google_shopping")
                          .queryParam("q", keywords)
                          .queryParam("api_key", apiKey)
                          .queryParam("num", Math.min(actualMaxResults, 20)) // SerpAPI limit
                          .build();
                    }
                  })
              .retrieve()
              .bodyToMono(String.class)
              .timeout(REQUEST_TIMEOUT)
              .block();

      return parseResponse(response);

    } catch (Exception e) {
      log.error("Error searching with SerpAPI for keywords '{}': {}", keywords, e.getMessage(), e);
      return List.of();
    }
  }

  private List<SearchResult> parseResponse(String response) {
    List<SearchResult> results = new ArrayList<>();

    try {
      JsonNode root = objectMapper.readTree(response);
      JsonNode shoppingResults = root.path("shopping_results");

      if (shoppingResults.isArray()) {
        for (JsonNode result : shoppingResults) {
          String url = result.path("link").asText();
          String title = result.path("title").asText();
          String priceStr = result.path("price").asText();
          String description = result.path("snippet").asText();

          // Parse price from string like "$19.99"
          Double price = null;
          if (!priceStr.isEmpty()) {
            try {
              price = Double.parseDouble(priceStr.replaceAll("[^0-9.]", ""));
            } catch (NumberFormatException e) {
              log.debug("Could not parse price: {}", priceStr);
            }
          }

          if (!url.isEmpty() && !title.isEmpty()) {
            SearchResult searchResult = new SearchResult(url, title, price, description);
            searchResult.setProvider("SerpAPI");
            results.add(searchResult);
          }
        }
      }

      log.info("Parsed {} results from SerpAPI", results.size());

    } catch (Exception e) {
      log.error("Error parsing SerpAPI response: {}", e.getMessage(), e);
    }

    return results;
  }

  @Override
  public boolean isEnabled() {
    return enabled;
  }

  @Override
  public String getProviderName() {
    return "SerpAPI (Google Shopping)";
  }

  @Override
  public double getCostPerSearch() {
    return 0.015; // $0.015 per search (expensive)
  }

  @Override
  public int getPriority() {
    return 3; // Lower priority due to high cost
  }

  @Override
  public boolean supportsVolume(int requestsPerDay) {
    return true; // SerpAPI supports high volume but expensive
  }

  @Override
  public Map<String, Object> getProviderConfig() {
    Map<String, Object> config = new HashMap<>();
    config.put("provider", "serpapi");
    config.put("baseUrl", baseUrl);
    config.put("costPerSearch", getCostPerSearch());
    config.put("maxResults", serpapiMaxResults);
    config.put("globalMaxResults", defaultMaxResults);
    config.put("enabled", isEnabled());
    return config;
  }
}
