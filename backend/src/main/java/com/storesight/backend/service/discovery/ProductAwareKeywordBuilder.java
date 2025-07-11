package com.storesight.backend.service.discovery;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.service.DashboardCacheService;
import com.storesight.backend.service.ShopService;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Product-aware keyword builder that generates intelligent search keywords based on actual store
 * products. Uses cache/session storage first, then falls back to Shopify API for real-time product
 * data.
 */
@Service
@Primary
public class ProductAwareKeywordBuilder extends KeywordBuilder {

  private static final Logger log = LoggerFactory.getLogger(ProductAwareKeywordBuilder.class);

  @Autowired private DashboardCacheService dashboardCacheService;
  @Autowired private ShopService shopService;
  @Autowired private WebClient.Builder webClientBuilder;
  @Autowired private ObjectMapper objectMapper;

  @Value("${keyword.generation.max-products:20}")
  private int maxProductsToAnalyze;

  @Value("${keyword.generation.cache-ttl-minutes:30}")
  private int keywordCacheTtlMinutes;

  @Value("${keyword.generation.min-keyword-frequency:2}")
  private int minKeywordFrequency;

  // Product-specific keyword extraction patterns
  private static final Set<String> PRODUCT_CATEGORIES =
      Set.of(
          "apparel",
          "electronics",
          "home",
          "beauty",
          "health",
          "sports",
          "automotive",
          "toys",
          "books",
          "jewelry",
          "furniture",
          "pet",
          "baby",
          "garden",
          "tools");

  private static final Set<String> BRAND_INDICATORS =
      Set.of("by", "from", "brand", "manufacturer", "made by", "designed by");

  private static final Pattern SIZE_PATTERN =
      Pattern.compile(
          "\\b(xs|s|m|l|xl|xxl|\\d+[\"']\"|\\d+x\\d+|\\d+oz|\\d+ml|\\d+g|\\d+kg|\\d+lb)\\b",
          Pattern.CASE_INSENSITIVE);
  private static final Pattern COLOR_PATTERN =
      Pattern.compile(
          "\\b(black|white|red|blue|green|yellow|pink|purple|orange|brown|gray|grey|silver|gold)\\b",
          Pattern.CASE_INSENSITIVE);
  private static final Pattern MATERIAL_PATTERN =
      Pattern.compile(
          "\\b(cotton|leather|silk|wool|polyester|metal|plastic|wood|glass|ceramic)\\b",
          Pattern.CASE_INSENSITIVE);

  /** Build competitor keywords based on actual store products */
  public String buildProductAwareKeywords(String shopDomain, String sessionId) {
    log.info("Building product-aware keywords for shop: {}", shopDomain);

    try {
      // Get products from cache/session storage or Shopify API
      List<ProductInfo> products = getShopProducts(shopDomain, sessionId);

      if (products.isEmpty()) {
        log.warn("No products found for shop: {}, falling back to generic keywords", shopDomain);
        return buildGenericKeywords();
      }

      // Analyze products and generate keywords
      Map<String, Integer> keywordFrequency = analyzeProductsForKeywords(products);

      // Build final keyword string with importance weighting
      String keywords = buildWeightedKeywordString(keywordFrequency, products);

      log.info("Generated product-aware keywords for shop {}: {}", shopDomain, keywords);
      return keywords;

    } catch (Exception e) {
      log.error(
          "Error building product-aware keywords for shop {}: {}", shopDomain, e.getMessage(), e);
      return buildGenericKeywords();
    }
  }

  /** Get shop products from cache/session storage with Shopify API fallback */
  private List<ProductInfo> getShopProducts(String shopDomain, String sessionId) {
    // Try cache first
    Optional<Object> cachedProducts = dashboardCacheService.getCachedProductsData(shopDomain);
    if (cachedProducts.isPresent()) {
      log.debug("Using cached products for shop: {}", shopDomain);
      return parseProductsFromCache(cachedProducts.get());
    }

    // Fallback to Shopify API
    log.debug("Cache miss, fetching products from Shopify API for shop: {}", shopDomain);
    return fetchProductsFromShopifyAPI(shopDomain, sessionId);
  }

  /** Parse products from cached data */
  private List<ProductInfo> parseProductsFromCache(Object cachedData) {
    try {
      JsonNode dataNode = objectMapper.valueToTree(cachedData);
      JsonNode productsNode = dataNode.has("products") ? dataNode.get("products") : dataNode;

      List<ProductInfo> products = new ArrayList<>();

      if (productsNode.isArray()) {
        for (JsonNode productNode : productsNode) {
          ProductInfo product = parseProductNode(productNode);
          if (product != null) {
            products.add(product);
          }
        }
      }

      log.debug("Parsed {} products from cache", products.size());
      return products.stream().limit(maxProductsToAnalyze).collect(Collectors.toList());

    } catch (Exception e) {
      log.error("Error parsing cached products: {}", e.getMessage());
      return List.of();
    }
  }

  /** Fetch products directly from Shopify API */
  private List<ProductInfo> fetchProductsFromShopifyAPI(String shopDomain, String sessionId) {
    try {
      String accessToken = shopService.getTokenForShop(shopDomain, sessionId);
      if (accessToken == null) {
        log.warn("No access token available for shop: {}", shopDomain);
        return List.of();
      }

      String url =
          String.format(
              "https://%s.myshopify.com/admin/api/2023-10/products.json?limit=%d",
              shopDomain.replace(".myshopify.com", ""), maxProductsToAnalyze);

      WebClient webClient = webClientBuilder.build();
      JsonNode response =
          webClient
              .get()
              .uri(url)
              .header("X-Shopify-Access-Token", accessToken)
              .retrieve()
              .bodyToMono(JsonNode.class)
              .block();

      if (response != null && response.has("products")) {
        List<ProductInfo> products = new ArrayList<>();
        for (JsonNode productNode : response.get("products")) {
          ProductInfo product = parseProductNode(productNode);
          if (product != null) {
            products.add(product);
          }
        }

        // Cache the results for future use
        if (!products.isEmpty()) {
          dashboardCacheService.cacheProductsData(shopDomain, response.get("products"));
        }

        log.info("Fetched {} products from Shopify API for shop: {}", products.size(), shopDomain);
        return products;
      }

    } catch (Exception e) {
      log.error(
          "Error fetching products from Shopify API for shop {}: {}", shopDomain, e.getMessage());
    }

    return List.of();
  }

  /** Parse individual product node from JSON */
  private ProductInfo parseProductNode(JsonNode productNode) {
    try {
      String title = productNode.has("title") ? productNode.get("title").asText() : "";
      String productType =
          productNode.has("product_type") ? productNode.get("product_type").asText() : "";
      String vendor = productNode.has("vendor") ? productNode.get("vendor").asText() : "";
      String bodyHtml = productNode.has("body_html") ? productNode.get("body_html").asText() : "";

      // Extract tags
      Set<String> tags = new HashSet<>();
      if (productNode.has("tags")) {
        String tagsStr = productNode.get("tags").asText();
        if (tagsStr != null && !tagsStr.isEmpty()) {
          tags.addAll(Arrays.asList(tagsStr.split(",\\s*")));
        }
      }

      if (title.isEmpty()) {
        return null;
      }

      return new ProductInfo(title, productType, vendor, bodyHtml, tags);

    } catch (Exception e) {
      log.warn("Error parsing product node: {}", e.getMessage());
      return null;
    }
  }

  /** Analyze products to extract keyword frequency */
  private Map<String, Integer> analyzeProductsForKeywords(List<ProductInfo> products) {
    Map<String, Integer> keywordFrequency = new HashMap<>();

    for (ProductInfo product : products) {
      // Extract keywords from title (highest weight)
      extractKeywordsWithWeight(keywordFrequency, product.getTitle(), 3);

      // Extract keywords from product type (high weight)
      extractKeywordsWithWeight(keywordFrequency, product.getProductType(), 2);

      // Extract keywords from vendor/brand (medium weight)
      extractKeywordsWithWeight(keywordFrequency, product.getVendor(), 2);

      // Extract keywords from tags (medium weight)
      for (String tag : product.getTags()) {
        extractKeywordsWithWeight(keywordFrequency, tag, 1);
      }

      // Extract keywords from description (lower weight)
      extractKeywordsWithWeight(keywordFrequency, cleanHtml(product.getBodyHtml()), 1);
    }

    // Filter out low-frequency keywords
    return keywordFrequency.entrySet().stream()
        .filter(entry -> entry.getValue() >= minKeywordFrequency)
        .collect(
            Collectors.toMap(
                Map.Entry::getKey, Map.Entry::getValue, (e1, e2) -> e1, LinkedHashMap::new));
  }

  /** Extract keywords from text with frequency weighting */
  private void extractKeywordsWithWeight(
      Map<String, Integer> keywordFrequency, String text, int weight) {
    if (text == null || text.trim().isEmpty()) {
      return;
    }

    Set<String> keywords = extractKeywords(text, 1.0);
    for (String keyword : keywords) {
      keywordFrequency.merge(keyword, weight, Integer::sum);
    }

    // Extract special patterns
    extractPatternKeywords(keywordFrequency, text, weight);
  }

  /** Extract pattern-based keywords (sizes, colors, materials) */
  private void extractPatternKeywords(
      Map<String, Integer> keywordFrequency, String text, int weight) {
    // Extract sizes
    SIZE_PATTERN
        .matcher(text)
        .results()
        .forEach(
            match -> keywordFrequency.merge(match.group().toLowerCase(), weight, Integer::sum));

    // Extract colors
    COLOR_PATTERN
        .matcher(text)
        .results()
        .forEach(
            match -> keywordFrequency.merge(match.group().toLowerCase(), weight, Integer::sum));

    // Extract materials
    MATERIAL_PATTERN
        .matcher(text)
        .results()
        .forEach(
            match -> keywordFrequency.merge(match.group().toLowerCase(), weight, Integer::sum));
  }

  /** Build weighted keyword string from frequency analysis */
  private String buildWeightedKeywordString(
      Map<String, Integer> keywordFrequency, List<ProductInfo> products) {
    // Sort keywords by frequency (descending)
    List<Map.Entry<String, Integer>> sortedKeywords =
        keywordFrequency.entrySet().stream()
            .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
            .limit(15) // Limit to top 15 keywords for cost efficiency
            .collect(Collectors.toList());

    // Build keyword string with strategic ordering
    StringBuilder keywordBuilder = new StringBuilder();

    // Add high-frequency brand/vendor keywords first
    sortedKeywords.stream()
        .filter(entry -> isLikelyBrand(entry.getKey(), products))
        .limit(3)
        .forEach(entry -> keywordBuilder.append(entry.getKey()).append(" "));

    // Add high-frequency product type keywords
    sortedKeywords.stream()
        .filter(entry -> isProductTypeKeyword(entry.getKey()))
        .limit(4)
        .forEach(entry -> keywordBuilder.append(entry.getKey()).append(" "));

    // Add remaining high-frequency keywords
    sortedKeywords.stream()
        .filter(
            entry ->
                !isLikelyBrand(entry.getKey(), products) && !isProductTypeKeyword(entry.getKey()))
        .limit(8)
        .forEach(entry -> keywordBuilder.append(entry.getKey()).append(" "));

    return keywordBuilder.toString().trim();
  }

  /** Check if keyword is likely a brand name */
  private boolean isLikelyBrand(String keyword, List<ProductInfo> products) {
    return products.stream()
        .anyMatch(
            product ->
                product.getVendor().toLowerCase().contains(keyword.toLowerCase())
                    || product.getTitle().toLowerCase().contains(keyword.toLowerCase() + " "));
  }

  /** Check if keyword is a product type */
  private boolean isProductTypeKeyword(String keyword) {
    return PRODUCT_CATEGORIES.contains(keyword.toLowerCase())
        || keyword.length() > 4; // Longer words are more likely to be product types
  }

  /** Clean HTML from product descriptions */
  private String cleanHtml(String html) {
    if (html == null) return "";
    return html.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
  }

  /** Build generic fallback keywords when no products are available */
  private String buildGenericKeywords() {
    return "shop store online retail products buy purchase quality affordable premium";
  }

  /** Product information container */
  private static class ProductInfo {
    private final String title;
    private final String productType;
    private final String vendor;
    private final String bodyHtml;
    private final Set<String> tags;

    public ProductInfo(
        String title, String productType, String vendor, String bodyHtml, Set<String> tags) {
      this.title = title != null ? title : "";
      this.productType = productType != null ? productType : "";
      this.vendor = vendor != null ? vendor : "";
      this.bodyHtml = bodyHtml != null ? bodyHtml : "";
      this.tags = tags != null ? tags : new HashSet<>();
    }

    public String getTitle() {
      return title;
    }

    public String getProductType() {
      return productType;
    }

    public String getVendor() {
      return vendor;
    }

    public String getBodyHtml() {
      return bodyHtml;
    }

    public Set<String> getTags() {
      return tags;
    }
  }
}
