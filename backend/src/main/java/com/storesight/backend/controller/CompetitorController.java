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
  public List<CompetitorDto> getCompetitors() {
    List<Map<String, Object>> rows =
        jdbcTemplate.queryForList("SELECT * FROM competitor_urls WHERE product_id=1");
    return rows.stream()
        .map(
            row ->
                new CompetitorDto(
                    String.valueOf(row.get("id")),
                    String.valueOf(row.get("url")),
                    18.99, // TODO: join with price_snapshots for real price
                    true, // TODO: join with price_snapshots for real inStock
                    0.0, // TODO: calculate percentDiff
                    "2025-06-17T16:54:02.307+00:00" // TODO: use real lastChecked
                    ))
        .collect(Collectors.toList());
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
      // Check cache for this shop (30-minute cache to reduce DB hits significantly)
      CachedCount cached = countCache.get(shopId);
      if (cached != null && !cached.isExpired(30)) {
        log.debug("Returning cached suggestion count for shop {}: {}", shopId, cached.count);
        return ResponseEntity.ok(Map.of("newSuggestions", cached.count));
      }

      // Fetch fresh count
      long newCount =
          suggestionRepository.countByShopIdAndStatus(shopId, CompetitorSuggestion.Status.NEW);

      // Update cache
      countCache.put(shopId, new CachedCount(newCount));

      // Clean up old cache entries (optional, prevents memory leaks)
      countCache.entrySet().removeIf(entry -> entry.getValue().isExpired(60));

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

    // Move to approved status
    suggestion.setStatus(CompetitorSuggestion.Status.APPROVED);
    suggestionRepository.save(suggestion);

    // TODO: Create actual competitor_url entry for price tracking
    // This would involve inserting into competitor_urls table

    return ResponseEntity.ok(Map.of("message", "Suggestion approved and now being tracked"));
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

  /** Manually trigger discovery for a specific shop (for testing/admin use) */
  @PostMapping("/competitors/discovery/trigger/{shopId}")
  public ResponseEntity<Map<String, String>> triggerDiscovery(@PathVariable Long shopId) {
    if (discoveryService == null) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Discovery service not available"));
    }

    try {
      discoveryService.triggerDiscoveryForShop(shopId);
      return ResponseEntity.ok(Map.of("message", "Discovery triggered for shop ID: " + shopId));
    } catch (Exception e) {
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
    public double price;
    public boolean inStock;
    public double percentDiff;
    public String lastChecked;

    public CompetitorDto(
        String id,
        String url,
        double price,
        boolean inStock,
        double percentDiff,
        String lastChecked) {
      this.id = id;
      this.url = url;
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
