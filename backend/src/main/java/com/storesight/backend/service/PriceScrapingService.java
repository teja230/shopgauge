package com.storesight.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.service.discovery.MultiSourceSearchClient;
import com.storesight.backend.service.discovery.ScrapingdogSearchClient;
import com.storesight.backend.service.discovery.SerpApiSearchClient;
import com.storesight.backend.service.discovery.SerperSearchClient;
import jakarta.annotation.PostConstruct;
import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Enterprise-grade price scraping service with multi-tier fallback Uses existing API configurations
 * and follows the MultiSourceSearchClient pattern
 */
@Service
public class PriceScrapingService {

  private static final Logger log = LoggerFactory.getLogger(PriceScrapingService.class);
  private static final String SHARED_PRICE_CACHE_PREFIX = "mi:price_refresh:cache:";

  @Autowired private MultiSourceSearchClient multiSourceSearchClient;
  @Autowired private ScrapingdogSearchClient scrapingdogSearchClient;
  @Autowired private SerperSearchClient serperSearchClient;
  @Autowired private SerpApiSearchClient serpApiSearchClient;
  @Autowired private WebClient webClient;
  @Autowired private org.springframework.data.redis.core.StringRedisTemplate stringRedisTemplate;
  @Autowired private MetricsCollectionService metricsCollectionService;
  private static final ObjectMapper JSON_MAPPER = new ObjectMapper();

  // Headless scraping toggle and client (placeholder interface)
  @Value("${price.scraping.headless.enabled:false}")
  private boolean headlessEnabled;

  /** Minimal headless client abstraction (implemented elsewhere or stubbed). */
  public interface HeadlessScrapingClient {
    HeadlessResult fetchRenderedHtml(String url);
  }

  public static class HeadlessResult {
    public final String html;
    public final long responseTimeMs;

    public HeadlessResult(String html, long responseTimeMs) {
      this.html = html;
      this.responseTimeMs = responseTimeMs;
    }
  }

  @Autowired(required = false)
  private HeadlessScrapingClient headlessScrapingClient;

  @Value("${discovery.scrapingdog.key:${SCRAPINGDOG_KEY:dummy_scrapingdog_key}}")
  private String scrapingdogKey;

  @Value("${discovery.serper.key:${SERPER_KEY:dummy_serper_key}}")
  private String serperKey;

  @Value("${discovery.serpapi.key:${SERPAPI_KEY:dummy_serpapi_key}}")
  private String serpApiKey;

  @Value("${price.scraping.scrapingdog.base-url:https://api.scrapingdog.com/scrape}")
  private String scrapingdogBaseUrl;

  @Value("${price.scraping.serper.base-url:https://google.serper.dev/search}")
  private String serperBaseUrl;

  @Value("${price.scraping.serpapi.base-url:https://serpapi.com/search.json}")
  private String serpApiBaseUrl;

  @Value("${price.scraping.api-optimized:true}")
  private boolean apiOptimized;

  @Value("${price.scraping.max-error-count:2}")
  private int maxErrorCount;

  @Value("${price.scraping.free-first:true}")
  private boolean freeFirst;

  @Value("${price.scraping.api-fallback-only:true}")
  private boolean apiFallbackOnly;

  // Honor discovery settings
  @Value("${discovery.multi-source.enabled:true}")
  private boolean multiSourceEnabled;

  @Value("${discovery.multi-source.fallback-enabled:true}")
  private boolean fallbackEnabled;

  @Value("${discovery.multi-source.max-providers:3}")
  private int maxProvidersToTry;

  // Price extraction patterns for different platforms
  private static final Map<String, Pattern[]> PRICE_PATTERNS = new HashMap<>();
  private static final Map<String, String[]> PRICE_SELECTORS = new HashMap<>();

  static {
    // Amazon price patterns
    PRICE_PATTERNS.put(
        "amazon",
        new Pattern[] {
          Pattern.compile("\\$([0-9,]+\\.?[0-9]*)"),
          Pattern.compile("([0-9,]+\\.?[0-9]*)"),
          Pattern.compile("USD\\s*([0-9,]+\\.?[0-9]*)")
        });

    PRICE_SELECTORS.put(
        "amazon",
        new String[] {
          ".a-price-whole",
          ".a-price .a-offscreen",
          ".a-price-symbol + .a-price-whole",
          ".a-price-range .a-price .a-offscreen",
          ".a-price-current .a-price-whole",
          "[data-a-price-whole]",
          "[data-a-price-fraction]"
        });

    // Generic patterns
    PRICE_PATTERNS.put(
        "generic",
        new Pattern[] {
          Pattern.compile("\\$([0-9,]+\\.?[0-9]*)"),
          Pattern.compile("([0-9,]+\\.?[0-9]*)"),
          Pattern.compile("Price:\\s*\\$([0-9,]+\\.?[0-9]*)")
        });

    PRICE_SELECTORS.put(
        "generic",
        new String[] {".price", ".product-price", ".money", "[data-price]", ".cost", ".amount"});
  }

  @PostConstruct
  public void init() {
    log.info("Initialized PriceScrapingService with API configurations");
    log.info("Scrapingdog enabled: {}", scrapingdogSearchClient.isEnabled());
    log.info("Serper enabled: {}", serperSearchClient.isEnabled());
    log.info("SerpAPI enabled: {}", serpApiSearchClient.isEnabled());
  }

  /**
   * Unified multi-tier price scraping with intelligent fallback Follows enterprise-grade patterns
   * with proper error handling and cost tracking
   */
  public PriceScrapingResult scrapePriceWithMultiTier(String url) {
    long startTime = System.currentTimeMillis();
    String platform = identifyPlatform(url);

    log.info("Starting enterprise-grade price scraping for URL: {} (platform: {})", url, platform);

    // Tier 1: Direct Jsoup scraping (fastest, free, compliant)
    try {
      log.debug("Tier 1: Attempting direct Jsoup scraping");
      var jsoupLatency = metricsCollectionService.startScrapingLatency("jsoup");
      PriceScrapingResult jsoupResult = scrapeWithJsoup(url, platform);
      metricsCollectionService.recordScrapingLatency(jsoupLatency, "jsoup");

      if (jsoupResult.isSuccess()) {
        metricsCollectionService.recordScrapingSuccess("jsoup");
        log.info("Tier 1 successful: Price ${} extracted via Jsoup", jsoupResult.getPrice());
        return jsoupResult;
      }

      metricsCollectionService.recordScrapingFailure("jsoup");
      log.warn("Tier 1 failed: {}", jsoupResult.getFailureReason());
    } catch (Exception e) {
      metricsCollectionService.recordScrapingFailure("jsoup");
      log.warn("Tier 1 failed: Jsoup error - {}", e.getMessage());
    }

    // Optional Headless Tier: handle dynamic pages blocked by anti-bot, gated by flag
    if (headlessEnabled && headlessScrapingClient != null) {
      try {
        log.debug("Headless Tier: Attempting headless-rendered fetch");
        var headlessLatency = metricsCollectionService.startScrapingLatency("headless");
        long start = System.currentTimeMillis();
        HeadlessResult res = headlessScrapingClient.fetchRenderedHtml(url);
        metricsCollectionService.recordScrapingLatency(headlessLatency, "headless");

        if (res != null && res.html != null && !res.html.isBlank()) {
          org.jsoup.nodes.Document doc = org.jsoup.Jsoup.parse(res.html);
          java.math.BigDecimal price = extractPriceFromDocument(doc, platform);
          boolean inStock = extractStockStatusFromDocument(doc, platform);
          long responseTime = res.responseTimeMs > 0 ? res.responseTimeMs : (System.currentTimeMillis() - start);
          if (price != null) {
            metricsCollectionService.recordScrapingSuccess("headless");
            return PriceScrapingResult.success(price, inStock, platform, "headless", responseTime);
          }
        }
        metricsCollectionService.recordScrapingFailure("headless");
      } catch (Exception e) {
        metricsCollectionService.recordScrapingFailure("headless");
        log.warn("Headless scraping failed: {}", e.getMessage());
      }
    }

    // Tier 2-4: API-based scraping (COST-OPTIMIZED for $19.99 plan)
    if (apiOptimized && multiSourceEnabled) {
      int providersTried = 0;
      int maxProviders =
          Math.min(maxProvidersToTry, 3); // Allow all 3 providers (Scrapingdog, Serper, SerpAPI)

      // Only use APIs if free-first is disabled or as fallback only
      if (!freeFirst || apiFallbackOnly) {

        // Try Scrapingdog API (primary - same cost as Serper: $0.001)
        if (scrapingdogSearchClient.isEnabled() && providersTried < maxProviders) {
          try {
            log.debug("Tier 2: Attempting Scrapingdog API (cost: $0.001)");
            var latency = metricsCollectionService.startScrapingLatency("scrapingdog");
            PriceScrapingResult scrapingdogResult = scrapeWithScrapingdog(url);
            metricsCollectionService.recordScrapingLatency(latency, "scrapingdog");

            if (scrapingdogResult.isSuccess()) {
              metricsCollectionService.recordScrapingSuccess("scrapingdog");
              log.info(
                  "Tier 2 successful: Price ${} extracted via Scrapingdog",
                  scrapingdogResult.getPrice());
              return scrapingdogResult;
            }

            metricsCollectionService.recordScrapingFailure("scrapingdog");
            log.warn("Tier 2 failed: {}", scrapingdogResult.getFailureReason());
            providersTried++;
          } catch (Exception e) {
            metricsCollectionService.recordScrapingFailure("scrapingdog");
            log.warn("Tier 2 failed: Scrapingdog error - {}", e.getMessage());
            providersTried++;
          }
        }

        // Try Serper API (fallback - same cost as Scrapingdog: $0.001)
        if (serperSearchClient.isEnabled() && providersTried < maxProviders) {
          try {
            log.debug("Tier 3: Attempting Serper API (cost: $0.001)");
            var latency = metricsCollectionService.startScrapingLatency("serper");
            PriceScrapingResult serperResult = scrapeWithSerper(url);
            metricsCollectionService.recordScrapingLatency(latency, "serper");

            if (serperResult.isSuccess()) {
              metricsCollectionService.recordScrapingSuccess("serper");
              log.info(
                  "Tier 3 successful: Price ${} extracted via Serper", serperResult.getPrice());
              return serperResult;
            }

            metricsCollectionService.recordScrapingFailure("serper");
            log.warn("Tier 3 failed: {}", serperResult.getFailureReason());
            providersTried++;
          } catch (Exception e) {
            metricsCollectionService.recordScrapingFailure("serper");
            log.warn("Tier 3 failed: Serper error - {}", e.getMessage());
            providersTried++;
          }
        }

        // Try SerpAPI as last resort (expensive but comprehensive: $0.015)
        if (serpApiSearchClient.isEnabled() && providersTried < maxProviders) {
          try {
            log.debug("Tier 4: Attempting SerpAPI (cost: $0.015)");
            var latency = metricsCollectionService.startScrapingLatency("serpapi");
            PriceScrapingResult serpApiResult = scrapeWithSerpAPI(url);
            metricsCollectionService.recordScrapingLatency(latency, "serpapi");

            if (serpApiResult.isSuccess()) {
              metricsCollectionService.recordScrapingSuccess("serpapi");
              log.info(
                  "Tier 4 successful: Price ${} extracted via SerpAPI", serpApiResult.getPrice());
              return serpApiResult;
            }

            metricsCollectionService.recordScrapingFailure("serpapi");
            log.warn("Tier 4 failed: {}", serpApiResult.getFailureReason());
            providersTried++;
          } catch (Exception e) {
            metricsCollectionService.recordScrapingFailure("serpapi");
            log.warn("Tier 4 failed: SerpAPI error - {}", e.getMessage());
            providersTried++;
          }
        }
      }
    }

    // All tiers failed
    log.error(
        "All price scraping tiers failed for URL: {} (total time: {}ms, platform: {})",
        url,
        (System.currentTimeMillis() - startTime),
        platform);

    return PriceScrapingResult.failure(
        "All scraping tiers exhausted - likely blocked by anti-bot protection",
        "all-tiers-failed",
        System.currentTimeMillis() - startTime);
  }

  // Shared cross-shop cache helpers for RedisPriceRefreshQueueService integration
  public java.util.Optional<PriceScrapingResult> getCachedPriceResult(String urlKey) {
    try {
      String key = SHARED_PRICE_CACHE_PREFIX + urlKey;
      String json = stringRedisTemplate.opsForValue().get(key);
      if (json == null) return java.util.Optional.empty();
      return java.util.Optional.ofNullable(PriceScrapingResult.fromJson(json));
    } catch (Exception e) {
      log.debug("getCachedPriceResult failed: {}", e.getMessage());
      return java.util.Optional.empty();
    }
  }

  public void cachePriceResult(String urlKey, PriceScrapingResult result, java.time.Duration ttl) {
    try {
      String key = SHARED_PRICE_CACHE_PREFIX + urlKey;
      stringRedisTemplate.opsForValue().set(key, result.toJson(), ttl);
    } catch (Exception e) {
      log.debug("cachePriceResult failed: {}", e.getMessage());
    }
  }

  /** Jsoup-based price scraping (Tier 1) Compliant with platform terms of service */
  private PriceScrapingResult scrapeWithJsoup(String url, String platform) {
    long startTime = System.currentTimeMillis();

    try {
      Document doc =
          Jsoup.connect(url)
              .userAgent(
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
              .timeout(10000)
              .followRedirects(true)
              .header(
                  "Accept",
                  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
              .header("Accept-Language", "en-US,en;q=0.5")
              .header("Accept-Encoding", "gzip, deflate")
              .header("Connection", "keep-alive")
              .header("Upgrade-Insecure-Requests", "1")
              .get();

      // Check for blocking patterns
      String pageText = doc.text().toLowerCase();
      if (pageText.contains("continue shopping")
          || pageText.contains("click the button below")
          || pageText.contains("robot or human")
          || pageText.contains("verify you are human")) {
        long responseTime = System.currentTimeMillis() - startTime;
        log.warn(
            "Platform blocking detected for URL: {} - page contains anti-bot verification", url);
        return PriceScrapingResult.failure(
            "Platform blocking detected - anti-bot verification required", "blocked", responseTime);
      }

      // Extract price using platform-specific patterns
      BigDecimal price = extractPriceFromDocument(doc, platform);
      boolean inStock = extractStockStatusFromDocument(doc, platform);

      long responseTime = System.currentTimeMillis() - startTime;

      // Handle out-of-stock items properly
      if (price != null) {
        if (price.compareTo(BigDecimal.ZERO) > 0) {
          // Valid price found
          return PriceScrapingResult.success(price, inStock, platform, "jsoup", responseTime);
        } else if (!inStock) {
          // Out of stock item - return success with price 0 and inStock false
          return PriceScrapingResult.success(
              BigDecimal.ZERO, false, platform, "jsoup", responseTime);
        } else {
          // Price is 0 but item is in stock - this is unusual, treat as no price found
          return PriceScrapingResult.failure(
              "No valid price found in page content", "no-price-found", responseTime);
        }
      } else {
        return PriceScrapingResult.failure(
            "No price found in page content", "no-price-found", responseTime);
      }

    } catch (Exception e) {
      long responseTime = System.currentTimeMillis() - startTime;
      return PriceScrapingResult.failure(
          "Jsoup scraping failed: " + e.getMessage(), "jsoup-failed", responseTime);
    }
  }

  /** Scrapingdog API integration (Tier 2) Uses platform-specific endpoints for better results */
  private PriceScrapingResult scrapeWithScrapingdog(String url) {
    long startTime = System.currentTimeMillis();

    try {
      // Identify platform to use the correct endpoint
      String platform = identifyPlatform(url);
      String endpoint;
      String queryParam;

      // Use platform-specific endpoints for better results
      if (platform.equals("amazon")) {
        endpoint = "https://api.scrapingdog.com/amazon/product";
        queryParam = "url";
      } else if (platform.equals("walmart")) {
        endpoint = "https://api.scrapingdog.com/walmart/search";
        queryParam = "q";
        // For Walmart, we need to extract product info for search
        String productInfo = extractProductInfo(url);
        url = "price " + productInfo;
      } else {
        // Use general endpoint for other platforms
        endpoint = "https://api.scrapingdog.com/scrape";
        queryParam = "q";
        String productInfo = extractProductInfo(url);
        url = "price " + productInfo;
      }

      String response =
          webClient
              .get()
              .uri(
                  endpoint
                      + "?api_key="
                      + scrapingdogKey
                      + "&"
                      + queryParam
                      + "="
                      + java.net.URLEncoder.encode(url, "UTF-8")
                      + "&gl=us"
                      + "&num=5")
              .retrieve()
              .bodyToMono(String.class)
              .timeout(java.time.Duration.ofSeconds(30))
              .block();

      if (response != null && !response.trim().isEmpty()) {
        // Parse the response to extract price
        BigDecimal price = extractPriceFromApiResponse(response, "scrapingdog");
        long responseTime = System.currentTimeMillis() - startTime;

        if (price != null && price.compareTo(BigDecimal.ZERO) > 0) {
          // Use proper platform detection instead of hardcoded "unknown"
          return PriceScrapingResult.success(price, true, platform, "scrapingdog", responseTime);
        } else if (price != null && price.compareTo(BigDecimal.ZERO) == 0) {
          // Price is 0 - could be out of stock, return with inStock false
          return PriceScrapingResult.success(
              BigDecimal.ZERO, false, platform, "scrapingdog", responseTime);
        } else {
          return PriceScrapingResult.failure(
              "No price found in Scrapingdog response", "no-price-found", responseTime);
        }
      } else {
        long responseTime = System.currentTimeMillis() - startTime;
        return PriceScrapingResult.failure(
            "Empty response from Scrapingdog", "empty-response", responseTime);
      }

    } catch (Exception e) {
      long responseTime = System.currentTimeMillis() - startTime;
      return PriceScrapingResult.failure(
          "Scrapingdog API failed: " + e.getMessage(), "api-failed", responseTime);
    }
  }

  /** Serper API integration (Tier 3) Uses existing configuration and is compliant */
  private PriceScrapingResult scrapeWithSerper(String url) {
    long startTime = System.currentTimeMillis();

    try {
      String response =
          webClient
              .post()
              .uri(serperBaseUrl)
              .header("X-API-KEY", serperKey)
              .header("Content-Type", "application/json")
              .bodyValue(Map.of("q", "price " + extractProductInfo(url), "num", 5, "gl", "us"))
              .retrieve()
              .bodyToMono(String.class)
              .timeout(java.time.Duration.ofSeconds(30))
              .block();

      if (response != null && !response.trim().isEmpty()) {
        BigDecimal price = extractPriceFromApiResponse(response, "serper");
        long responseTime = System.currentTimeMillis() - startTime;

        if (price != null && price.compareTo(BigDecimal.ZERO) > 0) {
          // Use proper platform detection instead of hardcoded "unknown"
          String platform = identifyPlatform(url);
          return PriceScrapingResult.success(price, true, platform, "serper", responseTime);
        } else if (price != null && price.compareTo(BigDecimal.ZERO) == 0) {
          // Price is 0 - could be out of stock, return with inStock false
          String platform = identifyPlatform(url);
          return PriceScrapingResult.success(
              BigDecimal.ZERO, false, platform, "serper", responseTime);
        } else {
          return PriceScrapingResult.failure(
              "No price found in Serper response", "no-price-found", responseTime);
        }
      } else {
        long responseTime = System.currentTimeMillis() - startTime;
        return PriceScrapingResult.failure(
            "Empty response from Serper", "empty-response", responseTime);
      }

    } catch (Exception e) {
      long responseTime = System.currentTimeMillis() - startTime;
      return PriceScrapingResult.failure(
          "Serper API failed: " + e.getMessage(), "api-failed", responseTime);
    }
  }

  /** SerpAPI integration (Tier 4) Uses existing configuration and is compliant */
  private PriceScrapingResult scrapeWithSerpAPI(String url) {
    long startTime = System.currentTimeMillis();

    try {
      String response =
          webClient
              .get()
              .uri(
                  serpApiBaseUrl
                      + "?engine=google_shopping&q="
                      + java.net.URLEncoder.encode(extractProductInfo(url), "UTF-8")
                      + "&api_key="
                      + serpApiKey
                      + "&num=5")
              .retrieve()
              .bodyToMono(String.class)
              .timeout(java.time.Duration.ofSeconds(30))
              .block();

      if (response != null && !response.trim().isEmpty()) {
        BigDecimal price = extractPriceFromApiResponse(response, "serpapi");
        long responseTime = System.currentTimeMillis() - startTime;

        if (price != null && price.compareTo(BigDecimal.ZERO) > 0) {
          // Use proper platform detection instead of hardcoded "unknown"
          String platform = identifyPlatform(url);
          return PriceScrapingResult.success(price, true, platform, "serpapi", responseTime);
        } else if (price != null && price.compareTo(BigDecimal.ZERO) == 0) {
          // Price is 0 - could be out of stock, return with inStock false
          String platform = identifyPlatform(url);
          return PriceScrapingResult.success(
              BigDecimal.ZERO, false, platform, "serpapi", responseTime);
        } else {
          return PriceScrapingResult.failure(
              "No price found in SerpAPI response", "no-price-found", responseTime);
        }
      } else {
        long responseTime = System.currentTimeMillis() - startTime;
        return PriceScrapingResult.failure(
            "Empty response from SerpAPI", "empty-response", responseTime);
      }

    } catch (Exception e) {
      long responseTime = System.currentTimeMillis() - startTime;
      return PriceScrapingResult.failure(
          "SerpAPI failed: " + e.getMessage(), "api-failed", responseTime);
    }
  }

  /** Extract price from HTML document using platform-specific patterns */
  private BigDecimal extractPriceFromDocument(Document doc, String platform) {
    String[] selectors = PRICE_SELECTORS.getOrDefault(platform, PRICE_SELECTORS.get("generic"));
    Pattern[] patterns = PRICE_PATTERNS.getOrDefault(platform, PRICE_PATTERNS.get("generic"));

    // Try CSS selectors first
    for (String selector : selectors) {
      Elements elements = doc.select(selector);
      for (Element element : elements) {
        String text = element.text().trim();
        if (!text.isEmpty()) {
          BigDecimal price = extractPriceFromText(text, patterns);
          if (price != null) {
            return price;
          }
        }
      }
    }

    // Try patterns on entire page text as fallback
    String pageText = doc.text();
    return extractPriceFromText(pageText, patterns);
  }

  /** Extract price from text using regex patterns */
  private BigDecimal extractPriceFromText(String text, Pattern[] patterns) {
    for (Pattern pattern : patterns) {
      Matcher matcher = pattern.matcher(text);
      if (matcher.find()) {
        try {
          String priceStr = matcher.group(1).replaceAll(",", "");
          return new BigDecimal(priceStr);
        } catch (Exception e) {
          log.debug("Error parsing price from text: {}", e.getMessage());
        }
      }
    }
    return null;
  }

  /** Extract price from API response */
  private BigDecimal extractPriceFromApiResponse(String response, String apiName) {
    try {
      // Simple price extraction from API response
      Pattern pricePattern = Pattern.compile("\\$([0-9,]+\\.?[0-9]*)");
      Matcher matcher = pricePattern.matcher(response);
      if (matcher.find()) {
        String priceStr = matcher.group(1).replaceAll(",", "");
        return new BigDecimal(priceStr);
      }
    } catch (Exception e) {
      log.warn("Error extracting price from {} response: {}", apiName, e.getMessage());
    }
    return null;
  }

  /** Extract stock status from document */
  private boolean extractStockStatusFromDocument(Document doc, String platform) {
    // Platform-specific stock selectors
    String[] stockSelectors;
    if ("amazon".equals(platform)) {
      stockSelectors =
          new String[] {
            "#availability span",
            ".a-size-medium.a-color-success",
            ".a-size-medium.a-color-price",
            ".a-size-medium.a-color-error",
            ".a-size-medium.a-color-state",
            "#availability",
            ".a-color-success",
            ".a-color-price",
            ".a-color-error",
            ".a-color-state",
            ".a-text-success",
            ".a-text-error",
            ".a-text-warning",
            ".a-text-price",
            ".a-text-state",
            ".a-text-availability",
            ".a-text-stock",
            ".a-text-inventory",
            ".a-text-quantity",
            ".a-text-status"
          };
    } else {
      stockSelectors =
          new String[] {
            ".availability",
            ".stock",
            ".in-stock",
            ".available",
            ".out-of-stock",
            ".unavailable",
            ".sold-out",
            ".status",
            ".inventory",
            ".quantity"
          };
    }

    for (String selector : stockSelectors) {
      Elements elements = doc.select(selector);
      for (Element element : elements) {
        String text = element.text().toLowerCase().trim();

        // Check for out of stock indicators
        if (text.contains("out of stock")
            || text.contains("unavailable")
            || text.contains("sold out")
            || text.contains("not available")
            || text.contains("currently unavailable")
            || text.contains("temporarily out of stock")
            || text.contains("we don't know when or if this item will be back in stock")
            || text.contains("no longer available")
            || text.contains("discontinued")
            || text.contains("unavailable from this seller")
            || text.contains("out of stock")
            || text.contains("oos")) {
          return false;
        }

        // Check for in stock indicators
        if (text.contains("in stock")
            || text.contains("available")
            || text.contains("add to cart")
            || text.contains("buy now")
            || text.contains("add to basket")
            || text.contains("purchase")
            || text.contains("order now")
            || text.contains("get it")
            || text.contains("shipping")
            || text.contains("delivery")) {
          return true;
        }
      }
    }

    // Also check for Amazon-specific patterns in the entire page
    if ("amazon".equals(platform)) {
      String pageText = doc.text().toLowerCase();

      // Check for out of stock patterns in page text
      if (pageText.contains("out of stock")
          || pageText.contains("currently unavailable")
          || pageText.contains("temporarily out of stock")
          || pageText.contains("we don't know when or if this item will be back in stock")
          || pageText.contains("no longer available")
          || pageText.contains("discontinued")) {
        return false;
      }

      // Check for in stock patterns in page text
      if (pageText.contains("in stock")
          || pageText.contains("add to cart")
          || pageText.contains("buy now")
          || pageText.contains("get it")) {
        return true;
      }
    }

    // Default to in stock if no clear indicator
    return true;
  }

  /** Identify platform from URL */
  private String identifyPlatform(String url) {
    String lowerUrl = url.toLowerCase();
    if (lowerUrl.contains("amazon.")) return "amazon";
    if (lowerUrl.contains("walmart.")) return "walmart";
    if (lowerUrl.contains("target.")) return "target";
    if (lowerUrl.contains("bestbuy.")) return "bestbuy";
    if (lowerUrl.contains("ebay.")) return "ebay";
    if (lowerUrl.contains("etsy.")) return "etsy";
    if (lowerUrl.contains("shopify") || lowerUrl.contains(".myshopify.com")) return "shopify";
    return "generic";
  }

  /** Extract product information from URL for API queries */
  private String extractProductInfo(String url) {
    try {
      // Extract product name or ID from URL
      String[] parts = url.split("/");
      if (parts.length > 0) {
        String lastPart = parts[parts.length - 1];
        // Remove query parameters
        return lastPart.split("\\?")[0];
      }
    } catch (Exception e) {
      log.debug("Error extracting product info from URL: {}", e.getMessage());
    }
    return "product";
  }

  /** Price scraping result with comprehensive information */
  public static class PriceScrapingResult {
    private final BigDecimal price;
    private final boolean inStock;
    private final String platform;
    private final String scraperSource;
    private final long responseTime;
    private final boolean success;
    private final String failureReason;

    private PriceScrapingResult(
        BigDecimal price,
        boolean inStock,
        String platform,
        String scraperSource,
        long responseTime,
        boolean success,
        String failureReason) {
      this.price = price;
      this.inStock = inStock;
      this.platform = platform;
      this.scraperSource = scraperSource;
      this.responseTime = responseTime;
      this.success = success;
      this.failureReason = failureReason;
    }

    public String toJson() {
      try {
        return JSON_MAPPER.writeValueAsString(this);
      } catch (Exception e) {
        return null;
      }
    }

    public static PriceScrapingResult fromJson(String json) {
      try {
        return JSON_MAPPER.readValue(json, PriceScrapingResult.class);
      } catch (Exception e) {
        return null;
      }
    }

    public static PriceScrapingResult success(
        BigDecimal price,
        boolean inStock,
        String platform,
        String scraperSource,
        long responseTime) {
      return new PriceScrapingResult(
          price, inStock, platform, scraperSource, responseTime, true, null);
    }

    public static PriceScrapingResult failure(
        String failureReason, String scraperSource, long responseTime) {
      return new PriceScrapingResult(
          null, false, "unknown", scraperSource, responseTime, false, failureReason);
    }

    // Getters
    public BigDecimal getPrice() {
      return price;
    }

    public boolean isInStock() {
      return inStock;
    }

    public String getPlatform() {
      return platform;
    }

    public String getScraperSource() {
      return scraperSource;
    }

    public long getResponseTime() {
      return responseTime;
    }

    public boolean isSuccess() {
      return success;
    }

    public String getFailureReason() {
      return failureReason;
    }
  }
}
