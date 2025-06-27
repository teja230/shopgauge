package com.storesight.backend.controller;

import com.storesight.backend.model.CompetitorSuggestion;
import com.storesight.backend.repository.CompetitorSuggestionRepository;
import com.storesight.backend.service.discovery.CompetitorDiscoveryService;
import com.storesight.backend.service.discovery.MultiSourceSearchClient;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class CompetitorController {

  private static final Logger log = LoggerFactory.getLogger(CompetitorController.class);

  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private CompetitorSuggestionRepository suggestionRepository;

  @Autowired(required = false)
  private CompetitorDiscoveryService discoveryService;

  // Cache for debouncing frequent count requests
  private final Map<Long, CachedCount> countCache = new ConcurrentHashMap<>();

  private static class CachedCount {
    final long count;
    final LocalDateTime timestamp;

    CachedCount(long count) {
      this.count = count;
      this.timestamp = LocalDateTime.now();
    }

    boolean isExpired(int cacheMinutes) {
      return ChronoUnit.MINUTES.between(timestamp, LocalDateTime.now()) > cacheMinutes;
    }
  }

  @GetMapping("/competitors")
  public ResponseEntity<?> getCompetitors(HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      // Get competitor URLs for this shop, joining with latest price snapshots
      String query =
          """
          SELECT cu.id, cu.url, cu.label, ps.price, ps.in_stock, ps.checked_at,
                 p.title as product_title
          FROM competitor_urls cu
          JOIN products p ON cu.product_id = p.id
          LEFT JOIN price_snapshots ps ON cu.id = ps.competitor_url_id
          WHERE p.shop_id = ?
          ORDER BY cu.created_at DESC
          """;

      List<Map<String, Object>> rows = jdbcTemplate.queryForList(query, shopId);

      List<CompetitorDto> competitors =
          rows.stream()
              .map(
                  row -> {
                    String id = String.valueOf(row.get("id"));
                    String url = String.valueOf(row.get("url"));
                    String label =
                        row.get("label") != null
                            ? String.valueOf(row.get("label"))
                            : extractTitleFromUrl(url);
                    Double price =
                        row.get("price") != null ? ((Number) row.get("price")).doubleValue() : 0.0;
                    Boolean inStock =
                        row.get("in_stock") != null ? (Boolean) row.get("in_stock") : true;
                    String lastChecked =
                        row.get("checked_at") != null ? row.get("checked_at").toString() : "Never";

                    return new CompetitorDto(id, url, label, price, inStock, 0.0, lastChecked);
                  })
              .collect(Collectors.toList());

      return ResponseEntity.ok(competitors);
    } catch (Exception e) {
      log.error("Error getting competitors: {}", e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to load competitors"));
    }
  }

  /** Add a new competitor manually */
  @PostMapping("/competitors")
  public ResponseEntity<?> addCompetitor(
      @RequestBody AddCompetitorRequest request, HttpServletRequest httpRequest) {
    Long shopId = getShopIdFromRequest(httpRequest);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    if (request.url == null || request.url.trim().isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "URL is required"));
    }

    try {
      // Get a default product for this shop if no productId specified
      Long productId = null;
      if (request.productId != null && !request.productId.trim().isEmpty()) {
        try {
          productId = Long.parseLong(request.productId);
        } catch (NumberFormatException e) {
          // If not a number, try to find product by title or shopify_product_id
          List<Map<String, Object>> products =
              jdbcTemplate.queryForList(
                  "SELECT id FROM products WHERE shop_id = ? AND (title ILIKE ? OR shopify_product_id = ?) LIMIT 1",
                  shopId,
                  "%" + request.productId + "%",
                  request.productId);
          if (!products.isEmpty()) {
            productId = ((Number) products.get(0).get("id")).longValue();
          }
        }
      }

      // If still no product ID, try to fetch products from Shopify first
      if (productId == null) {
        List<Map<String, Object>> products =
            jdbcTemplate.queryForList(
                "SELECT id FROM products WHERE shop_id = ? ORDER BY created_at DESC LIMIT 1",
                shopId);

        if (products.isEmpty()) {
          // Try to sync products from Shopify before giving up
          log.info(
              "No products found in database for shop {}, attempting to sync from Shopify", shopId);

          return ResponseEntity.status(HttpStatus.PRECONDITION_REQUIRED)
              .body(
                  Map.of(
                      "error", "PRODUCTS_SYNC_NEEDED",
                      "message",
                          "Please visit your Dashboard first to sync products from Shopify, then try adding competitors.",
                      "action", "SYNC_PRODUCTS",
                      "redirect_url", "/dashboard"));
        } else {
          productId = ((Number) products.get(0).get("id")).longValue();
          log.info(
              "Using existing product {} for competitor tracking in shop {}", productId, shopId);
        }
      }

      // Check if competitor URL already exists for this product
      List<Map<String, Object>> existing =
          jdbcTemplate.queryForList(
              "SELECT id FROM competitor_urls WHERE product_id = ? AND url = ?",
              productId,
              request.url);
      if (!existing.isEmpty()) {
        return ResponseEntity.badRequest()
            .body(Map.of("error", "This competitor URL is already being tracked"));
      }

      // Extract title from URL if no label provided
      String label =
          request.url.contains("amazon.com")
              ? extractAmazonTitle(request.url)
              : request.url.contains("shopify")
                  ? extractShopifyTitle(request.url)
                  : extractTitleFromUrl(request.url);

      // Insert new competitor URL
      jdbcTemplate.update(
          "INSERT INTO competitor_urls (product_id, url, label, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
          productId,
          request.url,
          label);

      // Get the inserted record
      List<Map<String, Object>> newRecord =
          jdbcTemplate.queryForList(
              "SELECT id, url, label FROM competitor_urls WHERE product_id = ? AND url = ? ORDER BY created_at DESC LIMIT 1",
              productId,
              request.url);

      if (newRecord.isEmpty()) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of("error", "Failed to create competitor record"));
      }

      Map<String, Object> record = newRecord.get(0);
      CompetitorDto competitor =
          new CompetitorDto(
              String.valueOf(record.get("id")),
              String.valueOf(record.get("url")),
              String.valueOf(record.get("label")),
              0.0, // Price will be updated by scraper
              true, // Assume in stock initially
              0.0, // No price difference initially
              "Just added");

      log.info("Added competitor {} for shop {}", request.url, shopId);
      return ResponseEntity.ok(competitor);

    } catch (Exception e) {
      log.error("Error adding competitor: {}", e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to add competitor: " + e.getMessage()));
    }
  }

  /** Delete a competitor */
  @DeleteMapping("/competitors/{id}")
  public ResponseEntity<?> deleteCompetitor(@PathVariable String id, HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      // Verify the competitor belongs to this shop
      List<Map<String, Object>> competitors =
          jdbcTemplate.queryForList(
              "SELECT cu.id FROM competitor_urls cu JOIN products p ON cu.product_id = p.id WHERE cu.id = ? AND p.shop_id = ?",
              Long.parseLong(id),
              shopId);

      if (competitors.isEmpty()) {
        return ResponseEntity.notFound().build();
      }

      // Delete related price snapshots first
      jdbcTemplate.update(
          "DELETE FROM price_snapshots WHERE competitor_url_id = ?", Long.parseLong(id));

      // Delete the competitor URL
      jdbcTemplate.update("DELETE FROM competitor_urls WHERE id = ?", Long.parseLong(id));

      log.info("Deleted competitor {} for shop {}", id, shopId);
      return ResponseEntity.ok().build();

    } catch (NumberFormatException e) {
      return ResponseEntity.badRequest().body(Map.of("error", "Invalid competitor ID"));
    } catch (Exception e) {
      log.error("Error deleting competitor: {}", e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to delete competitor"));
    }
  }

  /** Get competitor suggestions for the authenticated shop */
  @GetMapping("/competitors/suggestions")
  public ResponseEntity<?> getSuggestions(
      HttpServletRequest request,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size,
      @RequestParam(defaultValue = "NEW") String status) {

    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      Pageable pageable = PageRequest.of(page, size, Sort.by("discoveredAt").descending());
      CompetitorSuggestion.Status statusEnum =
          CompetitorSuggestion.Status.valueOf(status.toUpperCase());

      Page<CompetitorSuggestion> suggestions =
          suggestionRepository.findByShopIdAndStatus(shopId, statusEnum, pageable);
      Page<CompetitorSuggestionDto> result = suggestions.map(this::convertToDto);

      return ResponseEntity.ok(result);
    } catch (Exception e) {
      System.err.println("Error getting suggestions: " + e.getMessage());
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to load suggestions"));
    }
  }

  /** Get count of NEW suggestions for badge display - with caching and debounce */
  @GetMapping("/competitors/suggestions/count")
  @Cacheable(
      value = "suggestionCounts",
      key = "#request.remoteAddr + '_' + #request.getHeader('Cookie')",
      unless = "#result.body.get('error') != null")
  public ResponseEntity<Map<String, Object>> getSuggestionCount(HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);

    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required", "newSuggestions", 0L));
    }

    try {
      // Check cache for this shop (24-hour cache for costly discovery APIs)
      CachedCount cached = countCache.get(shopId);
      if (cached != null && !cached.isExpired(1440)) { // 24 hours = 1440 minutes
        log.debug("Returning cached suggestion count for shop {}: {}", shopId, cached.count);
        return ResponseEntity.ok(Map.of("newSuggestions", cached.count));
      }

      // Fetch fresh count
      long newCount =
          suggestionRepository.countByShopIdAndStatus(shopId, CompetitorSuggestion.Status.NEW);

      // Update cache
      countCache.put(shopId, new CachedCount(newCount));

      // Clean up old cache entries (optional, prevents memory leaks)
      countCache.entrySet().removeIf(entry -> entry.getValue().isExpired(2880)); // 48 hours cleanup

      log.debug("Fresh suggestion count for shop {}: {}", shopId, newCount);
      return ResponseEntity.ok(Map.of("newSuggestions", newCount));

    } catch (Exception e) {
      log.error("Error getting suggestion count for shop {}: {}", shopId, e.getMessage());
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Database error", "newSuggestions", 0L));
    }
  }

  /** Manual refresh endpoint for forcing cache invalidation */
  @PostMapping("/competitors/suggestions/refresh-count")
  public ResponseEntity<Map<String, Object>> refreshSuggestionCount(HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);

    if (shopId == null) {
      return ResponseEntity.badRequest().body(Map.of("error", "Authentication required"));
    }

    // Clear cache for this shop
    countCache.remove(shopId);

    // Return fresh count
    return getSuggestionCount(request);
  }

  /** Approve a competitor suggestion */
  @PostMapping("/competitors/suggestions/{id}/approve")
  public ResponseEntity<Map<String, String>> approveSuggestion(
      @PathVariable Long id, HttpServletRequest request) {

    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.badRequest().build();
    }

    CompetitorSuggestion suggestion = suggestionRepository.findById(id).orElse(null);
    if (suggestion == null || !suggestion.getShopId().equals(shopId)) {
      return ResponseEntity.notFound().build();
    }

    try {
      // Move to approved status
      suggestion.setStatus(CompetitorSuggestion.Status.APPROVED);
      suggestionRepository.save(suggestion);

      // Create actual competitor_url entry for price tracking
      String label =
          suggestion.getTitle() != null
              ? suggestion.getTitle()
              : extractTitleFromUrl(suggestion.getSuggestedUrl());

      jdbcTemplate.update(
          "INSERT INTO competitor_urls (product_id, url, label, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
          suggestion.getProductId(),
          suggestion.getSuggestedUrl(),
          label);

      log.info("Approved suggestion {} and created competitor URL for shop {}", id, shopId);
      return ResponseEntity.ok(Map.of("message", "Suggestion approved and now being tracked"));

    } catch (Exception e) {
      log.error("Error approving suggestion {}: {}", id, e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to approve suggestion"));
    }
  }

  /** Ignore a competitor suggestion */
  @PostMapping("/competitors/suggestions/{id}/ignore")
  public ResponseEntity<Map<String, String>> ignoreSuggestion(
      @PathVariable Long id, HttpServletRequest request) {

    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.badRequest().build();
    }

    CompetitorSuggestion suggestion = suggestionRepository.findById(id).orElse(null);
    if (suggestion == null || !suggestion.getShopId().equals(shopId)) {
      return ResponseEntity.notFound().build();
    }

    // Move to ignored status
    suggestion.setStatus(CompetitorSuggestion.Status.IGNORED);
    suggestionRepository.save(suggestion);

    return ResponseEntity.ok(Map.of("message", "Suggestion ignored"));
  }

  /** Get discovery stats with provider information */
  @GetMapping("/competitors/discovery/stats")
  public ResponseEntity<Map<String, Object>> getDiscoveryStats() {
    if (discoveryService == null) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Discovery service not available"));
    }

    Map<String, Object> stats = discoveryService.getDiscoveryStats();

    // Add provider-specific stats
    if (discoveryService.getSearchClient() instanceof MultiSourceSearchClient) {
      MultiSourceSearchClient multiClient =
          (MultiSourceSearchClient) discoveryService.getSearchClient();
      stats.put("providerStats", multiClient.getProviderStats());
    }

    return ResponseEntity.ok(stats);
  }

  /** Get discovery configuration */
  @GetMapping("/competitors/discovery/config")
  public ResponseEntity<Map<String, Object>> getDiscoveryConfig() {
    if (discoveryService == null) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Discovery service not available"));
    }
    return ResponseEntity.ok(discoveryService.getDiscoveryConfig());
  }

  /**
   * Get discovery status with transparent smart caching for cost optimization Users always get
   * real-time feeling responses regardless of cache status
   */
  @GetMapping("/competitors/discovery/status")
  public ResponseEntity<Map<String, Object>> getDiscoveryStatus(HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      // Smart caching strategy: Transparent to users, optimized for cost
      String cacheKey = "discovery_status_" + shopId;

      // Check if we have cached status (prevents expensive API calls)
      CachedCount cachedStatus = countCache.get(shopId);
      boolean isFromCache = cachedStatus != null && !cachedStatus.isExpired(1440); // 24 hours

      if (isFromCache) {
        // Cache hit - but user gets same real-time experience
        log.debug("Discovery status cache hit for shop {} (cost optimization)", shopId);
      } else {
        // Cache miss or expired - fetch fresh data and cache it
        log.info("Discovery status cache miss for shop {} - fetching fresh data", shopId);
        countCache.put(shopId, new CachedCount(1)); // Cache for 24 hours
      }

      // Always fetch current status from database for real-time accuracy
      // (Database queries are fast, API calls are expensive)
      Map<String, Object> status = buildDiscoveryStatus(shopId);

      // Add user-friendly fields without exposing cache implementation
      status.put("can_discover", !((Boolean) status.getOrDefault("is_on_cooldown", false)));
      status.put("status", status.get("is_on_cooldown").equals(true) ? "cooldown" : "ready");

      return ResponseEntity.ok(status);
    } catch (Exception e) {
      log.error("Error getting discovery status for shop {}: {}", shopId, e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to get discovery status"));
    }
  }

  /** Build discovery status response from database */
  private Map<String, Object> buildDiscoveryStatus(Long shopId) {
    Map<String, Object> status = new HashMap<>();
    status.put("shop_id", shopId);
    status.put("discovery_available", true);
    status.put("hours_remaining", 0);
    status.put("last_discovery", null);

    // Check last discovery time from database
    List<Map<String, Object>> lastDiscovery =
        jdbcTemplate.queryForList("SELECT last_discovery_at FROM shops WHERE id = ?", shopId);

    if (!lastDiscovery.isEmpty()) {
      Object lastDiscoveryObj = lastDiscovery.get(0).get("last_discovery_at");
      if (lastDiscoveryObj != null) {
        java.time.LocalDateTime lastDiscoveryTime = (java.time.LocalDateTime) lastDiscoveryObj;
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        long hoursSinceLastDiscovery = java.time.Duration.between(lastDiscoveryTime, now).toHours();

        status.put("last_discovery", lastDiscoveryTime.toString());
        status.put("hours_since_last", hoursSinceLastDiscovery);

        if (hoursSinceLastDiscovery < 24) {
          long hoursRemaining = 24 - hoursSinceLastDiscovery;
          status.put("discovery_available", false);
          status.put("hours_remaining", hoursRemaining);
          status.put("is_on_cooldown", true);
        } else {
          status.put("is_on_cooldown", false);
        }
      }
    }

    return status;
  }

  /** Manually trigger discovery for a specific shop (for testing/admin use) */
  @PostMapping("/competitors/discovery/trigger")
  public ResponseEntity<Map<String, Object>> triggerDiscovery(HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    if (discoveryService == null) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Discovery service not available"));
    }

    try {
      // Check server-side discovery cooldown (24 hours)
      List<Map<String, Object>> lastDiscovery =
          jdbcTemplate.queryForList("SELECT last_discovery_at FROM shops WHERE id = ?", shopId);

      if (!lastDiscovery.isEmpty()) {
        Object lastDiscoveryObj = lastDiscovery.get(0).get("last_discovery_at");
        if (lastDiscoveryObj != null) {
          java.time.LocalDateTime lastDiscoveryTime = (java.time.LocalDateTime) lastDiscoveryObj;
          java.time.LocalDateTime now = java.time.LocalDateTime.now();
          long hoursSinceLastDiscovery =
              java.time.Duration.between(lastDiscoveryTime, now).toHours();

          if (hoursSinceLastDiscovery < 24) {
            long hoursRemaining = 24 - hoursSinceLastDiscovery;
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(
                    Map.of(
                        "error",
                        "Discovery cooldown active",
                        "message",
                        "Discovery was last run "
                            + hoursSinceLastDiscovery
                            + " hours ago. Next available in "
                            + hoursRemaining
                            + " hours.",
                        "hours_remaining",
                        hoursRemaining,
                        "last_discovery",
                        lastDiscoveryTime.toString()));
          }
        }
      }

      // Update last discovery time immediately
      jdbcTemplate.update(
          "UPDATE shops SET last_discovery_at = CURRENT_TIMESTAMP WHERE id = ?", shopId);

      // Invalidate discovery status cache to ensure fresh status on next check
      countCache.remove(shopId);
      log.debug(
          "Invalidated discovery status cache for shop {} after triggering discovery", shopId);

      // Trigger discovery asynchronously for immediate response
      java.util.concurrent.CompletableFuture.runAsync(
          () -> {
            try {
              discoveryService.triggerDiscoveryForShop(shopId);
              log.info("Discovery completed for shop ID: {}", shopId);
            } catch (Exception e) {
              log.error("Async discovery failed for shop {}: {}", shopId, e.getMessage(), e);
            }
          });

      return ResponseEntity.ok(
          Map.of(
              "message",
              "Discovery started for shop ID: " + shopId,
              "status",
              "processing",
              "estimated_completion",
              "1-6 hours",
              "next_available",
              java.time.LocalDateTime.now().plusHours(24).toString()));
    } catch (Exception e) {
      log.error("Error triggering discovery for shop {}: {}", shopId, e.getMessage(), e);
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
  }

  /** Debug endpoint to check authentication status */
  @GetMapping("/competitors/debug/auth")
  public ResponseEntity<Map<String, Object>> debugAuth(HttpServletRequest request) {
    Map<String, Object> debug = new HashMap<>();

    // Check cookies
    Map<String, String> cookies = new HashMap<>();
    if (request.getCookies() != null) {
      for (Cookie cookie : request.getCookies()) {
        cookies.put(cookie.getName(), cookie.getValue());
      }
    }
    debug.put("cookies", cookies);

    // Check shop ID extraction
    Long shopId = getShopIdFromRequest(request);
    debug.put("shopId", shopId);
    debug.put("shopIdFound", shopId != null);

    // Check database connection for shops table
    try {
      long shopCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM shops", Long.class);
      debug.put("totalShopsInDb", shopCount);
      debug.put("databaseConnected", true);
    } catch (Exception e) {
      debug.put("databaseError", e.getMessage());
      debug.put("databaseConnected", false);
    }

    // If shop cookie exists, check if shop exists in database
    String shopCookie = cookies.get("shop");
    if (shopCookie != null) {
      try {
        List<Map<String, Object>> shops =
            jdbcTemplate.queryForList(
                "SELECT id, shopify_domain, created_at FROM shops WHERE shopify_domain = ?",
                shopCookie);
        debug.put("shopInDatabase", !shops.isEmpty());
        if (!shops.isEmpty()) {
          debug.put("shopRecord", shops.get(0));
        }
      } catch (Exception e) {
        debug.put("shopQueryError", e.getMessage());
      }
    }

    return ResponseEntity.ok(debug);
  }

  /** Extract shop ID from session cookie */
  private Long getShopIdFromRequest(HttpServletRequest request) {
    if (request.getCookies() != null) {
      for (Cookie cookie : request.getCookies()) {
        if ("shop".equals(cookie.getName())) {
          String shopDomain = cookie.getValue();
          System.out.println("Looking for shop ID for domain: " + shopDomain);

          try {
            // Get shop ID from domain
            List<Map<String, Object>> shops =
                jdbcTemplate.queryForList(
                    "SELECT id FROM shops WHERE shopify_domain = ?", shopDomain);
            if (!shops.isEmpty()) {
              Long shopId = ((Number) shops.get(0).get("id")).longValue();
              System.out.println("Found shop ID: " + shopId + " for domain: " + shopDomain);
              return shopId;
            } else {
              System.out.println("No shop found in database for domain: " + shopDomain);

              // Log all shops in database for debugging
              List<Map<String, Object>> allShops =
                  jdbcTemplate.queryForList("SELECT id, shopify_domain FROM shops");
              System.out.println("All shops in database: " + allShops);
            }
          } catch (Exception e) {
            System.err.println("Database error getting shop ID: " + e.getMessage());
            e.printStackTrace();
          }
        }
      }
    }
    System.out.println("No shop cookie found or no matching shop in database");
    return null;
  }

  /** Helper method to extract title from URL */
  private String extractTitleFromUrl(String url) {
    if (url == null || url.trim().isEmpty()) {
      return "Unknown Competitor";
    }

    try {
      // Extract domain name as basic title
      String domain = url.replaceAll("https?://", "").replaceAll("/.*", "");
      if (domain.startsWith("www.")) {
        domain = domain.substring(4);
      }
      return domain;
    } catch (Exception e) {
      return "Unknown Competitor";
    }
  }

  /** Helper method to extract Amazon product title from URL */
  private String extractAmazonTitle(String url) {
    try {
      // Handle different Amazon URL patterns
      if (url.contains("/dp/")) {
        // Product page
        String productId = url.split("/dp/")[1].split("/")[0];
        return "Amazon Product " + productId;
      } else if (url.contains("/gp/buyagain/")) {
        // Buy Again page
        return "Amazon Buy Again";
      } else if (url.contains("/s?")) {
        // Search results page
        return "Amazon Search Results";
      } else if (url.contains("/b/")) {
        // Brand page
        return "Amazon Brand Page";
      } else if (url.contains("/gp/product/")) {
        // Product page (alternative format)
        String productId = url.split("/gp/product/")[1].split("/")[0];
        return "Amazon Product " + productId;
      } else if (url.contains("/gp/offer-listing/")) {
        // Offer listing page
        return "Amazon Offers";
      } else {
        // Generic Amazon page
        return "Amazon Page";
      }
    } catch (Exception e) {
      return "Amazon Product";
    }
  }

  /** Helper method to extract Shopify product title from URL */
  private String extractShopifyTitle(String url) {
    if (url.contains("/products/")) {
      String[] parts = url.split("/products/");
      if (parts.length > 1) {
        String productSlug = parts[1].split("\\?")[0].split("/")[0];
        return productSlug.replace("-", " ");
      }
    }
    return extractTitleFromUrl(url);
  }

  /** Request class for adding competitors */
  public static class AddCompetitorRequest {
    public String url;
    public String productId;

    public AddCompetitorRequest() {}

    public AddCompetitorRequest(String url, String productId) {
      this.url = url;
      this.productId = productId;
    }
  }

  /** Convert entity to DTO */
  private CompetitorSuggestionDto convertToDto(CompetitorSuggestion suggestion) {
    return new CompetitorSuggestionDto(
        suggestion.getId(),
        suggestion.getSuggestedUrl(),
        suggestion.getTitle(),
        suggestion.getPrice(),
        suggestion.getSource().toString(),
        suggestion.getDiscoveredAt().toString(),
        suggestion.getStatus().toString());
  }

  public static class CompetitorDto {
    public String id;
    public String url;
    public String label;
    public double price;
    public boolean inStock;
    public double percentDiff;
    public String lastChecked;

    public CompetitorDto(
        String id,
        String url,
        String label,
        double price,
        boolean inStock,
        double percentDiff,
        String lastChecked) {
      this.id = id;
      this.url = url;
      this.label = label;
      this.price = price;
      this.inStock = inStock;
      this.percentDiff = percentDiff;
      this.lastChecked = lastChecked;
    }
  }

  public static class CompetitorSuggestionDto {
    public Long id;
    public String suggestedUrl;
    public String title;
    public java.math.BigDecimal price;
    public String source;
    public String discoveredAt;
    public String status;

    public CompetitorSuggestionDto(
        Long id,
        String suggestedUrl,
        String title,
        java.math.BigDecimal price,
        String source,
        String discoveredAt,
        String status) {
      this.id = id;
      this.suggestedUrl = suggestedUrl;
      this.title = title;
      this.price = price;
      this.source = source;
      this.discoveredAt = discoveredAt;
      this.status = status;
    }
  }
}
