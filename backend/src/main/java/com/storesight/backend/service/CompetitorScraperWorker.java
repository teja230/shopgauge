package com.storesight.backend.service;

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
    this.scrapeExecutor =
        new ThreadPoolExecutor(
            1,
            Math.min(maxConcurrentScrapers, maxConcurrentScrapersLimit),
            60L,
            TimeUnit.SECONDS,
            new LinkedBlockingQueue<>());
  }

  /** Scheduled task to scrape competitor prices (runs every 4 hours) */
  @Scheduled(cron = "0 15 */4 * * *")
  public void scrapeCompetitors() {
    log.info("[Worker] Starting competitor scrape job");

    try {
      // Get all active competitor URLs with shop-based limits
      List<Map<String, Object>> competitorUrls =
          jdbcTemplate.queryForList(
              "SELECT cu.id, cu.url, cu.label, p.shop_id, s.shopify_domain "
                  + "FROM competitor_urls cu "
                  + "JOIN products p ON cu.product_id = p.id "
                  + "JOIN shops s ON p.shop_id = s.id "
                  + "WHERE cu.created_at >= NOW() - INTERVAL '30 days' "
                  + "AND (SELECT COUNT(*) FROM competitor_urls cu2 "
                  + "      JOIN products p2 ON cu2.product_id = p2.id "
                  + "      WHERE p2.shop_id = s.id) <= ? "
                  + "ORDER BY cu.created_at DESC LIMIT ?",
              maxUrlsPerShop,
              maxUrlsPerShop);

      if (competitorUrls.isEmpty()) {
        log.info("[Worker] No competitor URLs found to scrape");
        return;
      }

      log.info("[Worker] Found {} competitor URLs to scrape", competitorUrls.size());

      // Process each URL
      for (Map<String, Object> urlData : competitorUrls) {
        scrapeExecutor.submit(
            () -> {
              try {
                scrapeCompetitorUrl(urlData);
              } catch (Exception e) {
                log.error(
                    "[Worker] Error scraping competitor URL {}: {}",
                    urlData.get("url"),
                    e.getMessage());
              }
            });
      }

      log.info("[Worker] Submitted {} competitor URLs for scraping", competitorUrls.size());

    } catch (Exception e) {
      log.error("[Worker] Error in competitor scrape job: {}", e.getMessage(), e);
    }
  }

  /** Scrape a single competitor URL */
  private void scrapeCompetitorUrl(Map<String, Object> urlData) {
    String url = (String) urlData.get("url");
    Long competitorUrlId = ((Number) urlData.get("id")).longValue();
    Long shopId = ((Number) urlData.get("shop_id")).longValue();
    String shopDomain = (String) urlData.get("shopify_domain");

    log.debug("[Worker] Scraping competitor URL: {}", url);

    // Check rate limiting
    String rateLimitKey = "scraper_rate_limit:" + extractDomain(url);
    if (redisTemplate.hasKey(rateLimitKey)) {
      log.debug("[Worker] Rate limit active for domain: {}", extractDomain(url));
      return;
    }

    try {
      // Set rate limit
      redisTemplate
          .opsForValue()
          .set(rateLimitKey, "1", delayBetweenRequests, TimeUnit.MILLISECONDS);

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

    } catch (Exception e) {
      log.error("[Worker] Error scraping {}: {}", url, e.getMessage());
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

    BigDecimal price = parsePrice(doc, platform);
    boolean inStock = parseStockStatus(doc, platform);

    return new CompetitorData(price, inStock);
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

  /** Store price snapshot in database */
  private void storePriceSnapshot(Long competitorUrlId, CompetitorData data) {
    try {
      jdbcTemplate.update(
          "INSERT INTO price_snapshots (competitor_url_id, price, in_stock, checked_at) "
              + "VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
          competitorUrlId,
          data.price,
          data.inStock);
    } catch (Exception e) {
      log.error("[Worker] Error storing price snapshot: {}", e.getMessage());
    }
  }

  /** Check for price alerts */
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

          if (percentChange.abs().compareTo(BigDecimal.valueOf(5)) > 0) {
            String direction =
                percentChange.compareTo(BigDecimal.ZERO) > 0 ? "increased" : "decreased";
            String message =
                String.format(
                    "Competitor price %s by %.1f%% (from $%.2f to $%.2f)",
                    direction, percentChange.abs(), previousPrice, data.price);

            alertService.triggerBusinessEvent(shopDomain, "Competitor Price Change", message);
          }
        }

        // Check for stock changes
        if (previousInStock != null && previousInStock != data.inStock) {
          String message =
              data.inStock
                  ? "Competitor product is now back in stock"
                  : "Competitor product is now out of stock";

          alertService.triggerBusinessEvent(shopDomain, "Competitor Stock Change", message);
        }
      }
    } catch (Exception e) {
      log.error("[Worker] Error checking price alerts: {}", e.getMessage());
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

    CompetitorData(BigDecimal price, boolean inStock) {
      this.price = price;
      this.inStock = inStock;
    }
  }
}
