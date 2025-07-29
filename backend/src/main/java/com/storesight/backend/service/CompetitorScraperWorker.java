package com.storesight.backend.service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.openqa.selenium.By;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Advanced competitor scraper with intelligent parsing for major e-commerce platforms. Supports
 * Amazon, Shopify, WooCommerce, BigCommerce, and general e-commerce sites. Includes cost
 * optimization, rate limiting, and intelligent parsing algorithms.
 */
@Service
@Profile("worker")
public class CompetitorScraperWorker {
  private static final Logger log = LoggerFactory.getLogger(CompetitorScraperWorker.class);

  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private RedisTemplate<String, Object> redisTemplate;
  @Autowired private AlertService alertService;
  @Autowired private AsyncProcessingService asyncProcessingService;

  @Value("${selenium.enabled:true}")
  private boolean seleniumEnabled;

  @Value("${scraper.max-concurrent:3}")
  private int maxConcurrentScrapers;

  @Value("${scraper.delay-between-requests:2000}")
  private int delayBetweenRequests;

  @Value("${competitor.scraping.max-urls-per-shop:100}")
  private int maxUrlsPerShop;

  @Value("${competitor.scraping.max-concurrent-scrapers:3}")
  private int maxConcurrentScrapersLimit;

  @Value("${scraper.timeout:30}")
  private int timeoutSeconds;

  @Value("${scraper.user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36}")
  private String userAgent;

  private ThreadPoolExecutor scrapeExecutor;
  private WebDriver driver;

  // Price parsing patterns for different sites
  private static final Map<String, Pattern[]> PRICE_PATTERNS = new HashMap<>();
  private static final Map<String, String[]> PRICE_SELECTORS = new HashMap<>();
  private static final Map<String, String[]> STOCK_SELECTORS = new HashMap<>();

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
          ".a-price-current .a-price-whole"
        });

    STOCK_SELECTORS.put(
        "amazon",
        new String[] {
          "#availability span", ".a-size-medium.a-color-success",
          ".a-size-medium.a-color-price", "#availability"
        });

    // Shopify price patterns
    PRICE_PATTERNS.put(
        "shopify",
        new Pattern[] {
          Pattern.compile("\\$([0-9,]+\\.?[0-9]*)"),
          Pattern.compile("([0-9,]+\\.?[0-9]*)"),
          Pattern.compile("USD\\s*([0-9,]+\\.?[0-9]*)")
        });

    PRICE_SELECTORS.put(
        "shopify",
        new String[] {
          ".price",
          ".product-price",
          ".money",
          ".price-item--sale",
          ".price-item--regular",
          "[data-price]"
        });

    STOCK_SELECTORS.put(
        "shopify",
        new String[] {
          ".product-form__buttons",
          ".btn.product-form__cart-submit",
          ".product-availability",
          ".inventory-counter",
          ".stock-counter"
        });

    // WooCommerce price patterns
    PRICE_PATTERNS.put(
        "woocommerce",
        new Pattern[] {
          Pattern.compile("\\$([0-9,]+\\.?[0-9]*)"),
          Pattern.compile("([0-9,]+\\.?[0-9]*)"),
          Pattern.compile("USD\\s*([0-9,]+\\.?[0-9]*)")
        });

    PRICE_SELECTORS.put(
        "woocommerce",
        new String[] {
          ".price", ".woocommerce-price-amount", ".amount", ".price-current", ".product-price"
        });

    STOCK_SELECTORS.put(
        "woocommerce", new String[] {".stock", ".in-stock", ".out-of-stock", ".stock-status"});

    // Generic patterns
    PRICE_PATTERNS.put(
        "generic",
        new Pattern[] {
          Pattern.compile("\\$([0-9,]+\\.?[0-9]*)"),
          Pattern.compile("([0-9,]+\\.?[0-9]*)"),
          Pattern.compile("USD\\s*([0-9,]+\\.?[0-9]*)")
        });

    PRICE_SELECTORS.put(
        "generic",
        new String[] {
          ".price", ".product-price", ".cost", ".amount", "[data-price]", ".pricing", ".money"
        });

    STOCK_SELECTORS.put(
        "generic",
        new String[] {
          ".stock",
          ".availability",
          ".in-stock",
          ".out-of-stock",
          ".product-availability",
          ".inventory"
        });
  }

  public CompetitorScraperWorker() {
    // Constructor left empty - ThreadPoolExecutor will be initialized in @PostConstruct
  }

  /** Initialize ThreadPoolExecutor after @Value fields are injected */
  @PostConstruct
  public void initializeExecutor() {
    this.scrapeExecutor =
        new ThreadPoolExecutor(
            1,
            Math.min(maxConcurrentScrapers, maxConcurrentScrapersLimit),
            60L,
            TimeUnit.SECONDS,
            new LinkedBlockingQueue<>());

    log.info(
        "[Worker] Initialized ThreadPoolExecutor with maxConcurrentScrapers={}, maxConcurrentScrapersLimit={}",
        maxConcurrentScrapers,
        maxConcurrentScrapersLimit);
  }

  /** Scheduled task to scrape competitor prices (COST OPTIMIZED - runs every 12 hours) */
  @Scheduled(cron = "0 0 */12 * * *")
  public void scrapeCompetitors() {
    log.info("[Worker] Starting competitor scrape job");

    try {
      // COST OPTIMIZATION: Get only competitors that need scraping (intelligent selection)
      List<Map<String, Object>> competitorUrls =
          jdbcTemplate.queryForList(
              "SELECT cu.id, cu.url, cu.label, cu.shop_id, s.shopify_domain, "
                  + "COALESCE(ps.checked_at, cu.created_at) as last_checked, "
                  + "COALESCE(ps.price, 0) as last_price "
                  + "FROM competitor_urls cu "
                  + "JOIN shops s ON cu.shop_id = s.id "
                  + "LEFT JOIN ("
                  + "  SELECT competitor_url_id, price, checked_at, "
                  + "         ROW_NUMBER() OVER (PARTITION BY competitor_url_id ORDER BY checked_at DESC) as rn "
                  + "  FROM price_snapshots"
                  + ") ps ON cu.id = ps.competitor_url_id AND ps.rn = 1 "
                  + "WHERE cu.created_at >= NOW() - INTERVAL '30 days' "
                  + "AND (SELECT COUNT(*) FROM competitor_urls cu2 WHERE cu2.shop_id = s.id) <= ? "
                  + "AND (ps.checked_at IS NULL OR ps.checked_at < NOW() - INTERVAL '12 hours') "
                  + "ORDER BY ps.checked_at ASC NULLS FIRST LIMIT ?",
              maxUrlsPerShop,
              maxUrlsPerShop);

      if (competitorUrls.isEmpty()) {
        log.info("[Worker] No competitor URLs found to scrape");
        return;
      }

      log.info("[Worker] Found {} competitor URLs to scrape", competitorUrls.size());

      // Process each URL using enhanced async processing
      for (Map<String, Object> urlData : competitorUrls) {
        String url = (String) urlData.get("url");
        Long shopId = ((Number) urlData.get("shop_id")).longValue();
        String shopDomain = (String) urlData.get("shopify_domain");
        String taskId =
            "scraping-" + shopId + "-" + urlData.get("id") + "-" + System.currentTimeMillis();

        asyncProcessingService
            .submitScrapingTask(
                taskId,
                shopDomain,
                shopId,
                () -> {
                  try {
                    scrapeCompetitorUrl(urlData);
                  } catch (Exception e) {
                    log.error("[Worker] Error scraping competitor URL {}: {}", url, e.getMessage());
                    throw new RuntimeException("Scraping failed for URL " + url, e);
                  }
                })
            .exceptionally(
                throwable -> {
                  log.error(
                      "[Worker] Async scraping task failed for URL {}: {}",
                      url,
                      throwable.getMessage());
                  return null;
                });
      }

      log.info("[Worker] Submitted {} competitor URLs for scraping", competitorUrls.size());

    } catch (Exception e) {
      log.error("[Worker] Error in competitor scrape job: {}", e.getMessage(), e);
    }
  }

  /** Scrape a single competitor URL with COST OPTIMIZATION */
  private void scrapeCompetitorUrl(Map<String, Object> urlData) {
    String url = (String) urlData.get("url");
    Long competitorUrlId = ((Number) urlData.get("id")).longValue();
    Long shopId = ((Number) urlData.get("shop_id")).longValue();
    String shopDomain = (String) urlData.get("shopify_domain");
    Object lastCheckedObj = urlData.get("last_checked");
    Object lastPriceObj = urlData.get("last_price");

    log.debug("[Worker] Scraping competitor URL: {}", url);

    // COST OPTIMIZATION 1: Check if we recently scraped this URL
    String domain = extractDomain(url);
    String recentScrapeKey = "recent_scrape:" + domain + ":" + url.hashCode();

    if (redisTemplate.hasKey(recentScrapeKey)) {
      log.info("[Worker] Skipping - URL scraped recently: {}", url);
      return;
    }

    // COST OPTIMIZATION 2: Check rate limiting with longer delays
    String rateLimitKey = "scraper_rate_limit:" + domain;
    if (redisTemplate.hasKey(rateLimitKey)) {
      log.debug("[Worker] Rate limit active for domain: {}", domain);
      return;
    }

    // COST OPTIMIZATION 3: Use cached price if available
    BigDecimal cachedPrice = getCachedPriceForUrl(url);
    if (cachedPrice != null) {
      log.info("[Worker] Using cached price ${} for URL: {}", cachedPrice, url);

      // Store cached price as snapshot
      storePriceSnapshot(competitorUrlId, new CompetitorData(cachedPrice, true));

      // Mark as recently scraped
      redisTemplate.opsForValue().set(recentScrapeKey, "1", 2, TimeUnit.HOURS);
      return;
    }

    try {
      // Set rate limit with longer delays for cost optimization
      int optimizedDelay = Math.max(delayBetweenRequests, 10000); // At least 10 seconds
      redisTemplate.opsForValue().set(rateLimitKey, "1", optimizedDelay, TimeUnit.MILLISECONDS);

      // Determine scraping method
      boolean requiresJs = requiresJavaScript(url);
      CompetitorData data = null;

      if (requiresJs && seleniumEnabled) {
        data = scrapeWithSelenium(url);
      } else {
        data = scrapeWithJsoup(url);
      }

      if (data != null) {
        // Store price snapshot
        storePriceSnapshot(competitorUrlId, data);

        // COST OPTIMIZATION 4: Cache the price for future use
        cachePriceForUrl(url, data.price);

        // Check for alerts
        checkPriceAlerts(competitorUrlId, shopId, shopDomain, data);

        log.debug(
            "[Worker] Successfully scraped {}: price=${}, inStock={}",
            url,
            data.price,
            data.inStock);
      } else {
        log.warn("[Worker] Failed to scrape data from: {}", url);
      }

      // Mark as recently scraped to prevent immediate re-scraping
      redisTemplate.opsForValue().set(recentScrapeKey, "1", 2, TimeUnit.HOURS);

    } catch (Exception e) {
      log.error("[Worker] Error scraping {}: {}", url, e.getMessage());
    }
  }

  /** Get cached price for URL to reduce scraping costs */
  private BigDecimal getCachedPriceForUrl(String url) {
    try {
      String cacheKey = "price_cache:" + url.hashCode();
      Object cached = redisTemplate.opsForValue().get(cacheKey);
      if (cached != null) {
        return new BigDecimal(cached.toString());
      }
    } catch (Exception e) {
      log.debug("[Worker] Error getting cached price: {}", e.getMessage());
    }
    return null;
  }

  /** Cache price for URL to reduce future scraping costs */
  private void cachePriceForUrl(String url, BigDecimal price) {
    try {
      String cacheKey = "price_cache:" + url.hashCode();
      // Cache for 24 hours to reduce scraping frequency
      redisTemplate.opsForValue().set(cacheKey, price.toString(), 24, TimeUnit.HOURS);
    } catch (Exception e) {
      log.debug("[Worker] Error caching price: {}", e.getMessage());
    }
  }

  /** Scrape using Selenium (for JavaScript-heavy sites) */
  private CompetitorData scrapeWithSelenium(String url) {
    if (driver == null) {
      initializeWebDriver();
    }

    try {
      driver.get(url);
      WebDriverWait wait = new WebDriverWait(driver, java.time.Duration.ofSeconds(timeoutSeconds));

      // Wait for page to load
      wait.until(ExpectedConditions.presenceOfElementLocated(By.tagName("body")));

      // Get page source after JavaScript execution
      String html = driver.getPageSource();
      Document doc = Jsoup.parse(html);

      return parseCompetitorData(doc, url);

    } catch (TimeoutException e) {
      log.warn("[Worker] Timeout scraping with Selenium: {}", url);
      return null;
    } catch (Exception e) {
      log.error("[Worker] Error scraping with Selenium: {}", e.getMessage());
      return null;
    }
  }

  /** Scrape using Jsoup (for static content) */
  private CompetitorData scrapeWithJsoup(String url) {
    try {
      Document doc =
          Jsoup.connect(url)
              .userAgent(userAgent)
              .timeout(timeoutSeconds * 1000)
              .followRedirects(true)
              .get();

      return parseCompetitorData(doc, url);

    } catch (Exception e) {
      log.error("[Worker] Error scraping with Jsoup: {}", e.getMessage());
      return null;
    }
  }

  /** Parse competitor data from HTML document */
  private CompetitorData parseCompetitorData(Document doc, String url) {
    String domain = extractDomain(url);
    String platform = identifyPlatform(url, doc);

    log.info("[Worker] Parsing data for platform: {} from URL: {}", platform, url);

    BigDecimal price = parsePrice(doc, platform);
    boolean inStock = parseStockStatus(doc, platform);

    return new CompetitorData(price, inStock, platform);
  }

  /** Parse price from document */
  private BigDecimal parsePrice(Document doc, String platform) {
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

  /** Parse stock status from document */
  private boolean parseStockStatus(Document doc, String platform) {
    String[] selectors = STOCK_SELECTORS.getOrDefault(platform, STOCK_SELECTORS.get("generic"));

    for (String selector : selectors) {
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

  /** Extract price from text using patterns */
  private BigDecimal extractPriceFromText(String text, Pattern[] patterns) {
    for (Pattern pattern : patterns) {
      Matcher matcher = pattern.matcher(text);
      if (matcher.find()) {
        try {
          String priceStr = matcher.group(1).replaceAll(",", "");
          return new BigDecimal(priceStr);
        } catch (NumberFormatException e) {
          // Try next pattern
        }
      }
    }
    return null;
  }

  /** Identify e-commerce platform */
  private String identifyPlatform(String url, Document doc) {
    String lowerUrl = url.toLowerCase();

    if (lowerUrl.contains("amazon.com")) {
      return "amazon";
    } else if (lowerUrl.contains("shopify") || doc.select("[data-shopify]").size() > 0) {
      return "shopify";
    } else if (doc.select(".woocommerce").size() > 0) {
      return "woocommerce";
    } else {
      return "generic";
    }
  }

  /** Check if URL requires JavaScript rendering */
  private boolean requiresJavaScript(String url) {
    String lowerUrl = url.toLowerCase();
    return lowerUrl.contains("amazon.com")
        || lowerUrl.contains("walmart.com")
        || lowerUrl.contains("target.com");
  }

  /** Extract domain from URL */
  private String extractDomain(String url) {
    try {
      return url.replaceAll("https?://", "").replaceAll("/.*", "");
    } catch (Exception e) {
      return url;
    }
  }

  /** Store price snapshot in database with enhanced tracking */
  private void storePriceSnapshot(Long competitorUrlId, CompetitorData data) {
    try {
      // Calculate price change percentage if previous price exists
      BigDecimal priceChangePercent = null;
      boolean significantChange = false;

      List<Map<String, Object>> previousPrices =
          jdbcTemplate.queryForList(
              "SELECT price FROM price_snapshots WHERE competitor_url_id = ? AND price IS NOT NULL ORDER BY checked_at DESC LIMIT 1",
              competitorUrlId);

      if (!previousPrices.isEmpty() && data.price != null) {
        BigDecimal previousPrice = (BigDecimal) previousPrices.get(0).get("price");
        if (previousPrice != null && previousPrice.compareTo(BigDecimal.ZERO) > 0) {
          BigDecimal priceDiff = data.price.subtract(previousPrice);
          priceChangePercent =
              priceDiff
                  .divide(previousPrice, 4, BigDecimal.ROUND_HALF_UP)
                  .multiply(BigDecimal.valueOf(100));
          significantChange = priceChangePercent.abs().compareTo(BigDecimal.valueOf(5)) > 0;
        }
      }

      jdbcTemplate.update(
          "INSERT INTO price_snapshots (competitor_url_id, price, in_stock, price_change_percent, significant_change, checked_at, scraper_version, platform) "
              + "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)",
          competitorUrlId,
          data.price,
          data.inStock,
          priceChangePercent,
          significantChange,
          "v2.0",
          data.platform);

      // Update competitor URL status on successful scrape
      jdbcTemplate.update(
          "UPDATE competitor_urls SET status = 'active', last_successful_check = CURRENT_TIMESTAMP, error_count = 0 WHERE id = ?",
          competitorUrlId);

    } catch (Exception e) {
      log.error("[Worker] Error storing price snapshot: {}", e.getMessage());

      // Update error count on failure
      try {
        jdbcTemplate.update(
            "UPDATE competitor_urls SET error_count = COALESCE(error_count, 0) + 1, status = CASE WHEN COALESCE(error_count, 0) + 1 >= 5 THEN 'error' ELSE status END WHERE id = ?",
            competitorUrlId);
      } catch (Exception updateError) {
        log.error(
            "[Worker] Error updating competitor URL error count: {}", updateError.getMessage());
      }
    }
  }

  /** Check for price alerts with enhanced tracking */
  private void checkPriceAlerts(
      Long competitorUrlId, Long shopId, String shopDomain, CompetitorData data) {
    try {
      // Get previous price
      List<Map<String, Object>> previousPrices =
          jdbcTemplate.queryForList(
              "SELECT price, in_stock FROM price_snapshots "
                  + "WHERE competitor_url_id = ? AND price IS NOT NULL "
                  + "ORDER BY checked_at DESC LIMIT 1 OFFSET 1",
              competitorUrlId);

      if (!previousPrices.isEmpty()) {
        BigDecimal previousPrice = (BigDecimal) previousPrices.get(0).get("price");
        Boolean previousInStock = (Boolean) previousPrices.get(0).get("in_stock");

        // Check for price changes
        if (previousPrice != null && data.price != null) {
          BigDecimal priceDiff = data.price.subtract(previousPrice);
          BigDecimal percentChange =
              priceDiff
                  .divide(previousPrice, 4, BigDecimal.ROUND_HALF_UP)
                  .multiply(BigDecimal.valueOf(100));

          // Significant price change threshold (5%)
          if (percentChange.abs().compareTo(BigDecimal.valueOf(5)) > 0) {
            String alertType =
                percentChange.compareTo(BigDecimal.ZERO) > 0 ? "price_increase" : "price_drop";
            String direction =
                percentChange.compareTo(BigDecimal.ZERO) > 0 ? "increased" : "decreased";

            // Create price alert record
            createPriceAlert(
                competitorUrlId, shopId, previousPrice, data.price, percentChange, alertType);

            // Send notification
            String message =
                String.format(
                    "Competitor price %s by %.1f%% (from $%.2f to $%.2f)",
                    direction, percentChange.abs(), previousPrice, data.price);

            alertService.triggerBusinessEvent(shopDomain, "Competitor Price Change", message);

            log.info(
                "[Worker] Price alert triggered for competitor {}: {} by {}%",
                competitorUrlId, direction, percentChange.abs());
          }
        }

        // Check for stock changes
        if (previousInStock != null && previousInStock != data.inStock) {
          String alertType = data.inStock ? "back_in_stock" : "out_of_stock";
          String message =
              data.inStock
                  ? "Competitor product is now back in stock"
                  : "Competitor product is now out of stock";

          // Create stock alert record
          createPriceAlert(competitorUrlId, shopId, null, null, null, alertType);

          // Send notification
          alertService.triggerBusinessEvent(shopDomain, "Competitor Stock Change", message);

          log.info(
              "[Worker] Stock alert triggered for competitor {}: {}", competitorUrlId, alertType);
        }
      }
    } catch (Exception e) {
      log.error("[Worker] Error checking price alerts: {}", e.getMessage());
    }
  }

  /** Create price alert record in database */
  private void createPriceAlert(
      Long competitorUrlId,
      Long shopId,
      BigDecimal oldPrice,
      BigDecimal newPrice,
      BigDecimal changePercent,
      String alertType) {
    try {
      jdbcTemplate.update(
          "INSERT INTO price_alerts (competitor_url_id, shop_id, old_price, new_price, change_percent, alert_type, notification_sent, created_at) "
              + "VALUES (?, ?, ?, ?, ?, ?, true, CURRENT_TIMESTAMP)",
          competitorUrlId,
          shopId,
          oldPrice,
          newPrice,
          changePercent,
          alertType);

      log.debug(
          "[Worker] Created price alert record: competitorUrlId={}, alertType={}, changePercent={}",
          competitorUrlId,
          alertType,
          changePercent);
    } catch (Exception e) {
      log.error("[Worker] Error creating price alert record: {}", e.getMessage());
    }
  }

  /** Initialize Selenium WebDriver */
  private void initializeWebDriver() {
    if (!seleniumEnabled) {
      return;
    }

    try {
      ChromeOptions options = new ChromeOptions();
      options.addArguments("--headless");
      options.addArguments("--no-sandbox");
      options.addArguments("--disable-dev-shm-usage");
      options.addArguments("--disable-gpu");
      options.addArguments("--window-size=1920,1080");
      options.addArguments("--user-agent=" + userAgent);

      this.driver = new ChromeDriver(options);
      log.info("[Worker] Initialized Selenium WebDriver");

    } catch (Exception e) {
      log.error("[Worker] Failed to initialize Selenium WebDriver: {}", e.getMessage());
      this.seleniumEnabled = false;
    }
  }

  /** Cleanup resources */
  @PreDestroy
  public void cleanup() {
    if (driver != null) {
      driver.quit();
    }
    if (scrapeExecutor != null) {
      scrapeExecutor.shutdown();
    }
  }

  /** Data class for competitor information */
  private static class CompetitorData {
    final BigDecimal price;
    final boolean inStock;
    final String platform;

    CompetitorData(BigDecimal price, boolean inStock, String platform) {
      this.price = price;
      this.inStock = inStock;
      this.platform = platform;
    }
  }
}
