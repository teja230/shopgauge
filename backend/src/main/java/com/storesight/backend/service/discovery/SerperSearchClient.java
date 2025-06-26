package com.storesight.backend.service.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.service.SecretService;
import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

/** Serper Search API client - fast and cost-effective fallback */
@Service
@ConditionalOnProperty(name = "discovery.enabled", havingValue = "true", matchIfMissing = true)
public class SerperSearchClient implements SearchClient {

  private static final Logger log = LoggerFactory.getLogger(SerperSearchClient.class);

  @Value("${discovery.serper.key:${SERPER_KEY:dummy_serper_key}}")
  private String apiKey;

  @Value("${discovery.serper.base-url:https://google.serper.dev/search}")
  private String baseUrl;

  @Value("${discovery.serper.max-results:10}")
  private int defaultMaxResults;

  @Autowired private WebClient webClient;

  @Autowired private SecretService secretService;

  private final ObjectMapper objectMapper = new ObjectMapper();

  @PostConstruct
  public void init() {
    // Try to load API key from Redis secrets as fallback
    if ("dummy_serper_key".equals(apiKey)) {
      try {
        String redisKey = secretService.getSecret("serper.api.key").orElse(null);
        if (redisKey != null && !redisKey.trim().isEmpty()) {
          this.apiKey = redisKey.trim();
          log.info("Loaded Serper API key from Redis secrets");
        }
      } catch (Exception e) {
        log.warn("Could not load Serper API key from Redis: {}", e.getMessage());
      }
    }
  }

  @Override
  public boolean isEnabled() {
    return apiKey != null && !apiKey.equals("dummy_serper_key");
  }

  @Override
  public String getProviderName() {
    return "Serper";
  }

  @Override
  public double getCostPerSearch() {
    return 0.001; // $0.001 per search
  }

  @Override
  public int getPriority() {
    return 2; // Second priority
  }

  @Override
  public boolean supportsVolume(int requestsPerDay) {
    return true; // Serper supports high volume
  }

  @Override
  public Map<String, Object> getProviderConfig() {
    Map<String, Object> config = new HashMap<>();
    config.put("provider", "serper");
    config.put("baseUrl", baseUrl);
    config.put("costPerSearch", getCostPerSearch());
    config.put("maxResults", defaultMaxResults);
    config.put("enabled", isEnabled());
    return config;
  }

  @Override
  public List<SearchResult> search(String keywords, int maxResults) {
    if (!isEnabled()) {
      log.warn("Serper is not enabled - skipping search for keywords: {}", keywords);
      return List.of();
    }

    // Use configured default if maxResults is not specified
    int actualMaxResults = maxResults > 0 ? maxResults : defaultMaxResults;

    try {
      log.info(
          "Searching with Serper for keywords: '{}' (max results: {})", keywords, actualMaxResults);

      String response =
          webClient
              .post()
              .uri(baseUrl)
              .header("X-API-KEY", apiKey)
              .header("Content-Type", "application/json")
              .bodyValue(
                  Map.of(
                      "q",
                      keywords,
                      "num",
                      Math.min(actualMaxResults, 100), // Serper limit
                      "gl",
                      "us"))
              .retrieve()
              .bodyToMono(String.class)
              .block();

      return parseResponse(response);

    } catch (Exception e) {
      log.error("Error searching with Serper for keywords '{}': {}", keywords, e.getMessage(), e);
      return List.of();
    }
  }

  private List<SearchResult> parseResponse(String response) {
    List<SearchResult> results = new ArrayList<>();

    try {
      JsonNode root = objectMapper.readTree(response);
      JsonNode organicResults = root.path("organic");

      if (organicResults.isArray()) {
        for (JsonNode result : organicResults) {
          String url = result.path("link").asText();
          String title = result.path("title").asText();
          String description = result.path("snippet").asText();

          // Serper doesn't provide pricing in search results
          Double price = null;

          if (!url.isEmpty() && !title.isEmpty()) {
            SearchResult searchResult = new SearchResult(url, title, price, description);
            searchResult.setProvider("Serper");
            results.add(searchResult);
          }
        }
      }

      log.info("Parsed {} results from Serper", results.size());

    } catch (Exception e) {
      log.error("Error parsing Serper response: {}", e.getMessage(), e);
    }

    return results;
  }
}
