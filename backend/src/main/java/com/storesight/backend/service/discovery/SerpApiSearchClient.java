package com.storesight.backend.service.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.service.SecretService;
import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

/** SerpAPI implementation for Google Shopping search */
@Component
public class SerpApiSearchClient implements SearchClient {

  private static final Logger log = LoggerFactory.getLogger(SerpApiSearchClient.class);
  private static final String SERPAPI_BASE_URL = "https://serpapi.com/search.json";
  private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(30);

  private final WebClient webClient;
  private final ObjectMapper objectMapper;
  private final SecretService secretService;

  @Value("${discovery.serpapi.key:}")
  private String apiKey;

  private boolean enabled;

  @Autowired
  public SerpApiSearchClient(
      SecretService secretService, @Value("${discovery.serpapi.key:}") String apiKey) {
    this.secretService = secretService;
    this.apiKey = apiKey;
    this.webClient =
        WebClient.builder()
            .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(1024 * 1024)) // 1MB
            .build();
    this.objectMapper = new ObjectMapper();
  }

  @PostConstruct
  public void initializeSecrets() {
    // Fallback to Redis-stored secrets if env vars are not provided
    if (apiKey == null || apiKey.isBlank() || apiKey.equals("dummy_serpapi_key")) {
      secretService
          .getSecret("serpapi_key")
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
        "SerpAPI client initialized - enabled: {}, API key: {}",
        enabled,
        apiKey != null ? apiKey.substring(0, Math.min(8, apiKey.length())) + "..." : "null");
  }

  @Override
  public List<SearchResult> search(String keywords, int maxResults) {
    if (!isEnabled()) {
      log.warn("SerpAPI is not enabled - skipping search for keywords: {}", keywords);
      return List.of();
    }

    try {
      log.info(
          "Searching for competitors using keywords: '{}' (max results: {})", keywords, maxResults);

      String response =
          webClient
              .get()
              .uri(
                  uriBuilder ->
                      uriBuilder
                          .scheme("https")
                          .host("serpapi.com")
                          .path("/search.json")
                          .queryParam("engine", "google_shopping")
                          .queryParam("q", keywords)
                          .queryParam("api_key", apiKey)
                          .queryParam("num", Math.min(maxResults, 20)) // SerpAPI limit
                          .build())
              .retrieve()
              .bodyToMono(String.class)
              .timeout(REQUEST_TIMEOUT)
              .block();

      return parseSearchResults(response);

    } catch (Exception e) {
      log.error("Error searching with SerpAPI for keywords '{}': {}", keywords, e.getMessage(), e);
      return List.of();
    }
  }

  private List<SearchResult> parseSearchResults(String response) {
    List<SearchResult> results = new ArrayList<>();

    try {
      JsonNode root = objectMapper.readTree(response);
      JsonNode shoppingResults = root.get("shopping_results");

      if (shoppingResults != null && shoppingResults.isArray()) {
        for (JsonNode result : shoppingResults) {
          String title = getTextValue(result, "title");
          String link = getTextValue(result, "link");
          Double price = parsePriceValue(result);

          if (title != null && link != null) {
            results.add(new SearchResult(title, link, price, "GOOGLE_SHOPPING"));
          }
        }
      }

      log.info("Parsed {} search results from SerpAPI response", results.size());

    } catch (Exception e) {
      log.error("Error parsing SerpAPI response: {}", e.getMessage(), e);
    }

    return results;
  }

  private String getTextValue(JsonNode node, String fieldName) {
    JsonNode field = node.get(fieldName);
    return field != null && !field.isNull() ? field.asText() : null;
  }

  private Double parsePriceValue(JsonNode result) {
    try {
      // Try different price fields that SerpAPI might return
      JsonNode priceNode = result.get("price");
      if (priceNode != null && !priceNode.isNull()) {
        String priceText = priceNode.asText();
        // Remove currency symbols and parse
        String numericPrice = priceText.replaceAll("[^0-9.]", "");
        if (!numericPrice.isEmpty()) {
          return Double.parseDouble(numericPrice);
        }
      }

      // Try extracted_price field
      JsonNode extractedPrice = result.get("extracted_price");
      if (extractedPrice != null && !extractedPrice.isNull()) {
        return extractedPrice.asDouble();
      }

    } catch (NumberFormatException e) {
      log.debug("Could not parse price from result: {}", result);
    }

    return null;
  }

  @Override
  public boolean isEnabled() {
    return enabled;
  }

  @Override
  public String getProviderName() {
    return "SerpAPI (Google Shopping)";
  }
}
