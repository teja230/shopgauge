package com.storesight.backend.controller;

import com.storesight.backend.exception.CompetitorLimitExceededException;
import com.storesight.backend.exception.DiscoveryServiceUnavailableException;
import com.storesight.backend.model.CompetitorSuggestion;
import com.storesight.backend.repository.CompetitorSuggestionRepository;
import com.storesight.backend.service.AdminRateLimitingService;
import com.storesight.backend.service.CompetitorAuditService;
import com.storesight.backend.service.CompetitorLimitService;
import com.storesight.backend.service.InputValidationService;
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
import org.springframework.context.annotation.Profile;
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

  private static final Logger logger = LoggerFactory.getLogger(CompetitorController.class);

  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private CompetitorSuggestionRepository suggestionRepository;
  @Autowired private CompetitorLimitService limitService;

  @Autowired(required = false)
  private CompetitorDiscoveryService discoveryService;

  @Autowired private CompetitorAuditService competitorAuditService;

  @Autowired private InputValidationService inputValidationService;

  @Autowired private AdminRateLimitingService rateLimitingService;

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

    // Check rate limits
    AdminRateLimitingService.RateLimitResult rateLimitResult =
        rateLimitingService.checkApiRequest(getClientIpAddress(request));
    if (!rateLimitResult.isAllowed()) {
      return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
          .body(Map.of("error", rateLimitResult.getMessage()));
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

      // Audit log the data access
      competitorAuditService.logDataAccessed(
          shopId, "COMPETITOR_LIST", "User viewed competitor list");

      return ResponseEntity.ok(competitors);
    } catch (Exception e) {
      logger.error("Error getting competitors: {}", e.getMessage(), e);
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

    // Check rate limits for competitor addition
    AdminRateLimitingService.RateLimitResult addRateLimit =
        rateLimitingService.checkCompetitorAddition(shopId);
    if (!addRateLimit.isAllowed()) {
      return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
          .body(Map.of("error", addRateLimit.getMessage()));
    }

    // Comprehensive input validation for competitor URLs
    InputValidationService.ValidationResult validation =
        inputValidationService.validateCompetitorUrl(request.url);
    if (!validation.isValid()) {
      return ResponseEntity.badRequest().body(Map.of("error", validation.getErrorMessage()));
    }

    // Validate label if provided
    if (request.label != null && !request.label.trim().isEmpty()) {
      InputValidationService.ValidationResult labelValidation =
          inputValidationService.validateCompetitorLabel(request.label);
      if (!labelValidation.isValid()) {
        return ResponseEntity.badRequest().body(Map.of("error", labelValidation.getErrorMessage()));
      }
    }

    // Check competitor limits before adding
    CompetitorLimitService.LimitCheckResult limitCheck = limitService.checkCompetitorLimit(shopId);
    if (!limitCheck.isCanAdd()) {
      throw new CompetitorLimitExceededException(
          "Competitor limit reached for your plan",
          limitCheck.getCurrent(),
          limitCheck.getLimit(),
          limitCheck.getPlanType().getDisplayName());
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
          logger.info(
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
          logger.info(
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

      // Audit log the competitor addition
      competitorAuditService.logCompetitorAdded(shopId, request.url, label);

      logger.info("Added competitor {} for shop {}", request.url, shopId);
      return ResponseEntity.ok(competitor);

    } catch (Exception e) {
      logger.error("Error adding competitor: {}", e.getMessage(), e);
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

      // Get competitor URL for audit logging before deletion
      List<Map<String, Object>> competitorInfo =
          jdbcTemplate.queryForList(
              "SELECT url FROM competitor_urls WHERE id = ?", Long.parseLong(id));
      String competitorUrl =
          competitorInfo.isEmpty() ? "unknown" : (String) competitorInfo.get(0).get("url");

      // Delete the competitor URL
      jdbcTemplate.update("DELETE FROM competitor_urls WHERE id = ?", Long.parseLong(id));

      // Audit log the deletion
      competitorAuditService.logCompetitorRemoved(shopId, competitorUrl, "User deleted competitor");

      logger.info("Deleted competitor {} for shop {}", id, shopId);
      return ResponseEntity.ok().build();

    } catch (NumberFormatException e) {
      return ResponseEntity.badRequest().body(Map.of("error", "Invalid competitor ID"));
    } catch (Exception e) {
      logger.error("Error deleting competitor: {}", e.getMessage(), e);
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
        logger.debug("Returning cached suggestion count for shop {}: {}", shopId, cached.count);
        return ResponseEntity.ok(Map.of("newSuggestions", cached.count));
      }

      // Fetch fresh count
      long newCount =
          suggestionRepository.countByShopIdAndStatus(shopId, CompetitorSuggestion.Status.NEW);

      // Update cache
      countCache.put(shopId, new CachedCount(newCount));

      // Clean up old cache entries (optional, prevents memory leaks)
      countCache.entrySet().removeIf(entry -> entry.getValue().isExpired(2880)); // 48 hours cleanup

      logger.debug("Fresh suggestion count for shop {}: {}", shopId, newCount);
      return ResponseEntity.ok(Map.of("newSuggestions", newCount));

    } catch (Exception e) {
      logger.error("Error getting suggestion count for shop {}: {}", shopId, e.getMessage());
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

      // Invalidate suggestion count cache to ensure badge updates immediately
      countCache.remove(shopId);
      logger.debug("Invalidated suggestion count cache for shop {} after approval", shopId);

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

      logger.info("Approved suggestion {} and created competitor URL for shop {}", id, shopId);
      return ResponseEntity.ok(Map.of("message", "Suggestion approved and now being tracked"));

    } catch (Exception e) {
      logger.error("Error approving suggestion {}: {}", id, e.getMessage(), e);
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

    // Invalidate suggestion count cache to ensure badge updates immediately
    countCache.remove(shopId);
    logger.debug("Invalidated suggestion count cache for shop {} after ignore", shopId);

    return ResponseEntity.ok(Map.of("message", "Suggestion ignored"));
  }

  /** Get discovery stats with provider information */
  @GetMapping("/competitors/discovery/stats")
  public ResponseEntity<Map<String, Object>> getDiscoveryStats() {
    if (discoveryService == null) {
      throw new DiscoveryServiceUnavailableException(
          "Discovery service is not available",
          "Service not configured or external API credentials missing");
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
  public ResponseEntity<Map<String, Object>> getDiscoveryConfig(HttpServletRequest request) {
    // For consistency with other discovery endpoints, check authentication
    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      Map<String, Object> config = new HashMap<>();

      if (discoveryService == null) {
        // Discovery service not available - return safe defaults
        logger.warn("Discovery service not available for shop {}", shopId);
        config.put("enabled", false);
        config.put("configured", false);
        config.put("error", "Discovery service not available");
        config.put("message", "Discovery service is not properly configured on this server");
        return ResponseEntity.ok(config);
      }

      // Get configuration from discovery service
      Map<String, Object> serviceConfig = discoveryService.getDiscoveryConfig();

      // Validate and enhance the configuration
      boolean searchClientEnabled =
          (Boolean) serviceConfig.getOrDefault("searchClientEnabled", false);
      String searchProvider = (String) serviceConfig.getOrDefault("searchClientProvider", "none");

      config.put("enabled", searchClientEnabled);
      config.put("configured", searchClientEnabled);
      config.put("intervalHours", serviceConfig.getOrDefault("intervalHours", 24));
      config.put("maxResultsPerProduct", serviceConfig.getOrDefault("maxResultsPerProduct", 10));
      config.put("searchProvider", searchProvider);
      config.put("searchClientEnabled", searchClientEnabled);

      // Add diagnostic information for troubleshooting
      if (!searchClientEnabled) {
        config.put(
            "message",
            "Search API credentials not configured. Please set SCRAPINGDOG_KEY, SERPER_KEY, or SERPAPI_KEY environment variables.");
        config.put("availableProviders", List.of("Scrapingdog", "Serper", "SerpAPI"));
        config.put(
            "debugInfo",
            Map.of(
                "discoveryServiceAvailable", discoveryService != null,
                "searchClientEnabled", searchClientEnabled,
                "searchProvider", searchProvider));
      } else {
        config.put("message", "Discovery service ready");
      }

      logger.debug(
          "Discovery config for shop {}: enabled={}, provider={}",
          shopId,
          searchClientEnabled,
          searchProvider);

      return ResponseEntity.ok(config);

    } catch (Exception e) {
      logger.error("Error getting discovery config for shop {}: {}", shopId, e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(
              Map.of(
                  "error",
                  "Failed to get discovery configuration",
                  "enabled",
                  false,
                  "configured",
                  false,
                  "message",
                  "Internal server error: " + e.getMessage(),
                  "debugInfo",
                  Map.of(
                      "exception", e.getClass().getSimpleName(),
                      "exceptionMessage", e.getMessage())));
    }
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
        logger.debug("Discovery status cache hit for shop {} (cost optimization)", shopId);
      } else {
        // Cache miss or expired - fetch fresh data and cache it
        logger.info("Discovery status cache miss for shop {} - fetching fresh data", shopId);
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
      logger.error("Error getting discovery status for shop {}: {}", shopId, e.getMessage(), e);
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
    status.put("is_on_cooldown", false);

    try {
      // Check last discovery time from database
      // First check if the column exists to avoid SQL errors
      List<Map<String, Object>> lastDiscovery = null;
      try {
        lastDiscovery =
            jdbcTemplate.queryForList("SELECT last_discovery_at FROM shops WHERE id = ?", shopId);
      } catch (Exception columnError) {
        // Column might not exist yet, log and continue with default values
        logger.warn(
            "last_discovery_at column not found for shop {}: {}. Using default discovery status.",
            shopId,
            columnError.getMessage());
        return status; // Return default status without discovery tracking
      }

      if (!lastDiscovery.isEmpty()) {
        Object lastDiscoveryObj = lastDiscovery.get(0).get("last_discovery_at");
        if (lastDiscoveryObj != null) {
          java.time.LocalDateTime lastDiscoveryTime = (java.time.LocalDateTime) lastDiscoveryObj;
          java.time.LocalDateTime now = java.time.LocalDateTime.now();
          long hoursSinceLastDiscovery =
              java.time.Duration.between(lastDiscoveryTime, now).toHours();

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
    } catch (Exception e) {
      logger.error("Error building discovery status for shop {}: {}", shopId, e.getMessage(), e);
      // Return safe default values instead of throwing
      status.put("error_details", "Unable to check discovery status: " + e.getMessage());
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
      throw new DiscoveryServiceUnavailableException(
          "Discovery service is not available",
          "Service not configured or external API credentials missing");
    }

    // Check discovery limits before triggering
    CompetitorLimitService.DiscoveryLimitResult discoveryLimit =
        limitService.checkDiscoveryLimit(shopId);
    if (!discoveryLimit.isCanDiscover()) {
      return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
          .body(
              Map.of(
                  "error", "DISCOVERY_LIMIT_REACHED",
                  "message", "Discovery limit reached. Please try again later.",
                  "current", discoveryLimit.getCurrent(),
                  "limit", discoveryLimit.getLimit(),
                  "remaining", discoveryLimit.getRemaining()));
    }

    try {
      // Check server-side discovery cooldown (24 hours)
      try {
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
      } catch (Exception columnErr) {
        // Column might not exist yet in some environments – skip cooldown enforcement and log
        logger.warn(
            "last_discovery_at column not found when triggering discovery for shop {}: {}. Skipping cooldown check.",
            shopId,
            columnErr.getMessage());
      }

      // Update last discovery time immediately
      jdbcTemplate.update(
          "UPDATE shops SET last_discovery_at = CURRENT_TIMESTAMP WHERE id = ?", shopId);

      // Invalidate discovery status cache to ensure fresh status on next check
      countCache.remove(shopId);
      logger.debug(
          "Invalidated discovery status cache for shop {} after triggering discovery", shopId);

      // Trigger discovery asynchronously for immediate response
      java.util.concurrent.CompletableFuture.runAsync(
          () -> {
            try {
              discoveryService.triggerDiscoveryForShop(shopId);
              logger.info("Discovery completed for shop ID: {}", shopId);
            } catch (Exception e) {
              logger.error("Async discovery failed for shop {}: {}", shopId, e.getMessage(), e);
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
      logger.error("Error triggering discovery for shop {}: {}", shopId, e.getMessage(), e);
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
  }

  /** Check competitor tracking limits for the current shop */
  @GetMapping("/competitors/limits")
  public ResponseEntity<Map<String, Object>> checkLimits(HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      // Use the comprehensive limits response that includes all limit information
      CompetitorLimitService.LimitsResponse limitsResponse = limitService.getShopLimits(shopId);

      Map<String, Object> response = new HashMap<>();

      // Competitor limits
      CompetitorLimitService.LimitCheckResult competitorLimit = limitsResponse.getCompetitorLimit();
      response.put(
          "competitorLimit",
          Map.of(
              "canAdd", competitorLimit.isCanAdd(),
              "currentCount", competitorLimit.getCurrent(),
              "limit", competitorLimit.getLimit(),
              "remaining", competitorLimit.getRemaining(),
              "tier", competitorLimit.getPlanType().getDisplayName(),
              "message", limitsResponse.getUpgradeMessage()));

      // Suggestion limits
      CompetitorLimitService.LimitCheckResult suggestionLimit = limitsResponse.getSuggestionLimit();
      response.put(
          "suggestionLimit",
          Map.of(
              "canAdd", suggestionLimit.isCanAdd(),
              "currentCount", suggestionLimit.getCurrent(),
              "limit", suggestionLimit.getLimit(),
              "remaining", suggestionLimit.getRemaining(),
              "tier", suggestionLimit.getPlanType().getDisplayName(),
              "message", limitsResponse.getUpgradeMessage()));

      // Discovery limits
      CompetitorLimitService.DiscoveryLimitResult discoveryLimit =
          limitsResponse.getDiscoveryLimit();
      response.put(
          "discoveryLimit",
          Map.of(
              "canDiscover", discoveryLimit.isCanDiscover(),
              "productCount", discoveryLimit.getCurrent(),
              "competitorCount", competitorLimit.getCurrent(),
              "maxProducts", limitsResponse.getMaxProductsPerShop(),
              "maxCompetitors", competitorLimit.getLimit()));

      // Additional limits
      response.put("maxSuggestionsPerProduct", limitsResponse.getMaxSuggestionsPerProduct());
      response.put("maxProductsPerShop", limitsResponse.getMaxProductsPerShop());
      response.put("maxUrlsPerShop", limitsResponse.getMaxUrlsPerShop());
      response.put("maxConcurrentScrapers", limitsResponse.getMaxConcurrentScrapers());
      response.put("upgradeMessage", limitsResponse.getUpgradeMessage());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error checking limits for shop {}: {}", shopId, e.getMessage());
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to check limits"));
    }
  }

  /** Debug endpoint to check authentication status */
  @GetMapping("/competitors/debug/auth")
  @Profile("!prod") // Only available in non-production environments
  public ResponseEntity<Map<String, Object>> debugAuth(HttpServletRequest request) {

    Map<String, Object> debug = new HashMap<>();

    try {
      Long shopId = getShopIdFromRequest(request);
      debug.put("shopId", shopId);
      debug.put("authenticated", shopId != null);

      if (shopId != null) {
        // Check if shop exists in database
        try {
          Map<String, Object> shop =
              jdbcTemplate.queryForMap(
                  "SELECT id, shopify_domain, created_at FROM shops WHERE id = ?", shopId);
          debug.put("shopExists", true);
          debug.put("shopDomain", shop.get("shopify_domain"));
          debug.put("shopCreatedAt", shop.get("created_at"));
        } catch (Exception e) {
          debug.put("shopExists", false);
          debug.put("shopError", e.getMessage());
        }

        // Check competitor URLs count
        try {
          Integer competitorCount =
              jdbcTemplate.queryForObject(
                  "SELECT COUNT(*) FROM competitor_urls WHERE product_id IN (SELECT id FROM products WHERE shop_id = ?)",
                  Integer.class,
                  shopId);
          debug.put("competitorUrlsCount", competitorCount);
        } catch (Exception e) {
          debug.put("competitorUrlsError", e.getMessage());
        }

        // Check products count
        try {
          Integer productsCount =
              jdbcTemplate.queryForObject(
                  "SELECT COUNT(*) FROM products WHERE shop_id = ?", Integer.class, shopId);
          debug.put("productsCount", productsCount);
        } catch (Exception e) {
          debug.put("productsError", e.getMessage());
        }
      }

      debug.put("timestamp", System.currentTimeMillis());
      debug.put("success", true);

      return ResponseEntity.ok(debug);

    } catch (Exception e) {
      logger.error("Debug auth error: {}", e.getMessage(), e);
      debug.put("error", e.getMessage());
      debug.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(debug);
    }
  }

  /** Comprehensive URL validation for competitor URLs */
  private ValidationResult validateCompetitorUrl(String url) {
    if (url == null || url.trim().isEmpty()) {
      return ValidationResult.invalid("URL is required");
    }

    url = url.trim();

    // Basic URL format validation
    if (!url.matches("^https?://.*")) {
      return ValidationResult.invalid("URL must start with http:// or https://");
    }

    // Length validation
    if (url.length() > 2000) {
      return ValidationResult.invalid("URL is too long (maximum 2000 characters)");
    }

    // Domain validation
    try {
      java.net.URL urlObj = new java.net.URL(url);
      String host = urlObj.getHost();

      if (host == null || host.trim().isEmpty()) {
        return ValidationResult.invalid("Invalid URL format - no host found");
      }

      // Check for localhost or internal IPs (security)
      if (host.equals("localhost")
          || host.equals("127.0.0.1")
          || host.startsWith("192.168.")
          || host.startsWith("10.")
          || host.startsWith("172.")) {
        return ValidationResult.invalid("Cannot track internal or localhost URLs");
      }

      // Validate supported platforms
      if (!isSupportedPlatform(host)) {
        return ValidationResult.invalid(
            "Unsupported platform. Supported platforms: Amazon, Shopify stores, WooCommerce, and other e-commerce sites");
      }

    } catch (java.net.MalformedURLException e) {
      return ValidationResult.invalid("Invalid URL format: " + e.getMessage());
    }

    // Check for suspicious patterns
    if (url.contains("javascript:") || url.contains("data:") || url.contains("file:")) {
      return ValidationResult.invalid("Invalid URL scheme");
    }

    // Check for common non-product pages that shouldn't be tracked
    String lowerUrl = url.toLowerCase();
    if (lowerUrl.contains("/login")
        || lowerUrl.contains("/register")
        || lowerUrl.contains("/checkout")
        || lowerUrl.contains("/cart")
        || lowerUrl.contains("/account")
        || lowerUrl.contains("/admin")) {
      return ValidationResult.invalid("Cannot track login, checkout, or admin pages");
    }

    return ValidationResult.valid();
  }

  /** Check if the domain/host is from a supported e-commerce platform */
  private boolean isSupportedPlatform(String host) {
    String lowerHost = host.toLowerCase();

    // Amazon domains
    if (lowerHost.contains("amazon.")) {
      return true;
    }

    // Shopify stores (myshopify.com or custom domains with Shopify)
    if (lowerHost.contains("myshopify.com")) {
      return true;
    }

    // Other major e-commerce platforms
    if (lowerHost.contains("shopify")
        || lowerHost.contains("woocommerce")
        || lowerHost.contains("bigcommerce")
        || lowerHost.contains("magento")
        || lowerHost.contains("prestashop")
        || lowerHost.contains("opencart")) {
      return true;
    }

    // For other domains, we'll allow them but they might not scrape as well
    // This is more permissive to allow tracking of various e-commerce sites
    return true;
  }

  /** Validation result class */
  private static class ValidationResult {
    private final boolean valid;
    private final String errorMessage;

    private ValidationResult(boolean valid, String errorMessage) {
      this.valid = valid;
      this.errorMessage = errorMessage;
    }

    public static ValidationResult valid() {
      return new ValidationResult(true, null);
    }

    public static ValidationResult invalid(String errorMessage) {
      return new ValidationResult(false, errorMessage);
    }

    public boolean isValid() {
      return valid;
    }

    public String getErrorMessage() {
      return errorMessage;
    }
  }

  /** Extract shop ID from session cookie with caching */
  private Long getShopIdFromRequest(HttpServletRequest request) {
    if (request.getCookies() != null) {
      for (Cookie cookie : request.getCookies()) {
        if ("shop".equals(cookie.getName())) {
          String shopDomain = cookie.getValue();
          logger.debug("Looking for shop ID for domain: {}", shopDomain);

          // Check cache first
          String cacheKey = "shop_id:" + shopDomain;
          Long cachedShopId = getCachedShopId(cacheKey);
          if (cachedShopId != null) {
            logger.debug("Found cached shop ID: {} for domain: {}", cachedShopId, shopDomain);
            return cachedShopId;
          }

          try {
            // Get shop ID from domain
            List<Map<String, Object>> shops =
                jdbcTemplate.queryForList(
                    "SELECT id FROM shops WHERE shopify_domain = ?", shopDomain);
            if (!shops.isEmpty()) {
              Long shopId = ((Number) shops.get(0).get("id")).longValue();
              logger.debug("Found shop ID: {} for domain: {}", shopId, shopDomain);

              // Cache the result for 5 minutes
              cacheShopId(cacheKey, shopId);

              return shopId;
            } else {
              logger.warn("No shop found in database for domain: {}", shopDomain);

              // Log all shops in database for debugging (only in debug mode)
              if (logger.isDebugEnabled()) {
                List<Map<String, Object>> allShops =
                    jdbcTemplate.queryForList("SELECT id, shopify_domain FROM shops");
                logger.debug("All shops in database: {}", allShops);
              }
            }
          } catch (Exception e) {
            logger.error(
                "Database error getting shop ID for domain {}: {}", shopDomain, e.getMessage(), e);
          }
        }
      }
    }
    logger.debug("No shop cookie found or no matching shop in database");
    return null;
  }

  /** Cache for shop ID lookups */
  private final Map<String, CachedShopId> shopIdCache = new ConcurrentHashMap<>();

  private static class CachedShopId {
    final Long shopId;
    final long timestamp;

    CachedShopId(Long shopId) {
      this.shopId = shopId;
      this.timestamp = System.currentTimeMillis();
    }

    boolean isExpired(int cacheMinutes) {
      return System.currentTimeMillis() - timestamp > (cacheMinutes * 60 * 1000L);
    }
  }

  private Long getCachedShopId(String cacheKey) {
    CachedShopId cached = shopIdCache.get(cacheKey);
    if (cached != null && !cached.isExpired(5)) { // 5 minute cache
      return cached.shopId;
    }
    if (cached != null && cached.isExpired(5)) {
      shopIdCache.remove(cacheKey);
    }
    return null;
  }

  private void cacheShopId(String cacheKey, Long shopId) {
    shopIdCache.put(cacheKey, new CachedShopId(shopId));
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
    public String label;

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

  /** Extract client IP address from request */
  private String getClientIpAddress(HttpServletRequest request) {
    String xForwardedFor = request.getHeader("X-Forwarded-For");
    if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
      return xForwardedFor.split(",")[0].trim();
    }

    String xRealIp = request.getHeader("X-Real-IP");
    if (xRealIp != null && !xRealIp.isEmpty()) {
      return xRealIp;
    }

    return request.getRemoteAddr();
  }
}
