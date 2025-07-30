package com.storesight.backend.service;

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

  @Autowired private MultiSourceSearchClient multiSourceSearchClient;
  @Autowired private ScrapingdogSearchClient scrapingdogSearchClient;
  @Autowired private SerperSearchClient serperSearchClient;
  @Autowired private SerpApiSearchClient serpApiSearchClient;
  @Autowired private WebClient webClient;

  @Value("${discovery.scrapingdog.key:${SCRAPINGDOG_KEY:dummy_scrapingdog_key}}")
  private String scrapingdogKey;

  @Value("${discovery.serper.key:${SERPER_KEY:dummy_serper_key}}")
  private String serperKey;

  @Value("${discovery.serpapi.key:${SERPAPI_KEY:dummy_serpapi_key}}")
  private String serpApiKey;

  @Value("${discovery.scrapingdog.base-url:https://api.scrapingdog.com/scrape}")
  private String scrapingdogBaseUrl;

  @Value("${discovery.serper.base-url:https://google.serper.dev/search}")
  private String serperBaseUrl;

  @Value("${discovery.serpapi.base-url:https://serpapi.com/search.json}")
  private String serpApiBaseUrl;

  @Value("${price.scraping.api-optimized:true}")
  private boolean apiOptimized;

  @Value("${price.scraping.max-error-count:3}")
  private int maxErrorCount;

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
      PriceScrapingResult jsoupResult = scrapeWithJsoup(url, platform);

      if (jsoupResult.isSuccess()) {
        log.info("Tier 1 successful: Price ${} extracted via Jsoup", jsoupResult.getPrice());
        return jsoupResult;
      }

      log.warn("Tier 1 failed: {}", jsoupResult.getFailureReason());
    } catch (Exception e) {
      log.warn("Tier 1 failed: Jsoup error - {}", e.getMessage());
    }

    // Tier 2: Scrapingdog API (cost-effective, compliant) - Only if API optimized
    if (scrapingdogSearchClient.isEnabled() && apiOptimized) {
      try {
        log.debug("Tier 2: Attempting Scrapingdog API");
        PriceScrapingResult scrapingdogResult = scrapeWithScrapingdog(url);

        if (scrapingdogResult.isSuccess()) {
          log.info(
              "Tier 2 successful: Price ${} extracted via Scrapingdog",
              scrapingdogResult.getPrice());
          return scrapingdogResult;
        }

        log.warn("Tier 2 failed: {}", scrapingdogResult.getFailureReason());
      } catch (Exception e) {
        log.warn("Tier 2 failed: Scrapingdog error - {}", e.getMessage());
      }
    }

    // Tier 3: Serper API (fast fallback, compliant) - Only if API optimized
    if (serperSearchClient.isEnabled() && apiOptimized) {
      try {
        log.debug("Tier 3: Attempting Serper API");
        PriceScrapingResult serperResult = scrapeWithSerper(url);

        if (serperResult.isSuccess()) {
          log.info("Tier 3 successful: Price ${} extracted via Serper", serperResult.getPrice());
          return serperResult;
        }

        log.warn("Tier 3 failed: {}", serperResult.getFailureReason());
      } catch (Exception e) {
        log.warn("Tier 3 failed: Serper error - {}", e.getMessage());
      }
    }

    // Tier 4: SerpAPI (comprehensive, compliant) - Only if API optimized
    if (serpApiSearchClient.isEnabled() && apiOptimized) {
      try {
        log.debug("Tier 4: Attempting SerpAPI");
        PriceScrapingResult serpApiResult = scrapeWithSerpAPI(url);

        if (serpApiResult.isSuccess()) {
          log.info("Tier 4 successful: Price ${} extracted via SerpAPI", serpApiResult.getPrice());
          return serpApiResult;
        }

        log.warn("Tier 4 failed: {}", serpApiResult.getFailureReason());
      } catch (Exception e) {
        log.warn("Tier 4 failed: SerpAPI error - {}", e.getMessage());
      }
    }

    // All tiers failed
    long totalTime = System.currentTimeMillis() - startTime;
    log.error("All price scraping tiers failed for URL: {} (total time: {}ms)", url, totalTime);

    return PriceScrapingResult.failure(
        "All scraping tiers exhausted", "all-tiers-failed", totalTime);
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
      if (pageText.contains("continue shopping") || pageText.contains("click the button below")) {
        long responseTime = System.currentTimeMillis() - startTime;
        return PriceScrapingResult.failure("Platform blocking detected", "blocked", responseTime);
      }

      // Extract price using platform-specific patterns
      BigDecimal price = extractPriceFromDocument(doc, platform);
      boolean inStock = extractStockStatusFromDocument(doc, platform);

      long responseTime = System.currentTimeMillis() - startTime;

      if (price != null && price.compareTo(BigDecimal.ZERO) > 0) {
        return PriceScrapingResult.success(price, inStock, platform, "jsoup", responseTime);
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

  /** Scrapingdog API integration (Tier 2) Uses existing configuration and is compliant */
  private PriceScrapingResult scrapeWithScrapingdog(String url) {
    long startTime = System.currentTimeMillis();

    try {
      String response =
          webClient
              .get()
              .uri(
                  scrapingdogBaseUrl
                      + "?api_key="
                      + scrapingdogKey
                      + "&url="
                      + java.net.URLEncoder.encode(url, "UTF-8")
                      + "&country=us")
              .retrieve()
              .bodyToMono(String.class)
              .timeout(java.time.Duration.ofSeconds(30))
              .block();

      if (response != null && !response.trim().isEmpty()) {
        // Parse the response to extract price
        BigDecimal price = extractPriceFromApiResponse(response, "scrapingdog");
        long responseTime = System.currentTimeMillis() - startTime;

        if (price != null && price.compareTo(BigDecimal.ZERO) > 0) {
          return PriceScrapingResult.success(price, true, "unknown", "scrapingdog", responseTime);
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
          return PriceScrapingResult.success(price, true, "unknown", "serper", responseTime);
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
          return PriceScrapingResult.success(price, true, "unknown", "serpapi", responseTime);
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
    String[] stockSelectors = {
      ".a-color-success",
      ".a-color-price",
      ".a-text-success", // Amazon
      ".availability",
      ".stock", // Generic
      ".in-stock",
      ".available", // Generic
      ".out-of-stock",
      ".unavailable",
      ".sold-out" // Out of stock indicators
    };

    for (String selector : stockSelectors) {
      Elements elements = doc.select(selector);
      for (Element element : elements) {
        String text = element.text().toLowerCase();

        // Check for out of stock indicators
        if (text.contains("out of stock")
            || text.contains("unavailable")
            || text.contains("sold out")
            || text.contains("not available")) {
          return false;
        }

        // Check for in stock indicators
        if (text.contains("in stock")
            || text.contains("available")
            || text.contains("add to cart")
            || text.contains("buy now")) {
          return true;
        }
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
