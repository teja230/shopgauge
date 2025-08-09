package com.storesight.backend.controller;

import com.storesight.backend.exception.ArchivedCompetitorLimitExceededException;
import com.storesight.backend.exception.CompetitorLimitExceededException;
import com.storesight.backend.exception.DiscoveryServiceUnavailableException;
import com.storesight.backend.model.CompetitorSuggestion;
import com.storesight.backend.repository.CompetitorSuggestionRepository;
import com.storesight.backend.service.AdminRateLimitingService;
import com.storesight.backend.service.CompetitorAuditService;
import com.storesight.backend.service.CompetitorLimitService;
import com.storesight.backend.service.DashboardCacheService;
import com.storesight.backend.service.EnhancedRedisService;
import com.storesight.backend.service.InputValidationService;
import com.storesight.backend.service.PriceChangeCalculationService;
import com.storesight.backend.service.PriceScrapingService;
import com.storesight.backend.service.RedisPriceRefreshQueueService;
import com.storesight.backend.service.SessionSynchronizationService;
import com.storesight.backend.service.ShopService;
import com.storesight.backend.service.SmartSnapshotService;
import com.storesight.backend.service.discovery.CompetitorDiscoveryService;
import com.storesight.backend.service.discovery.MultiSourceSearchClient;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;

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

  @Autowired private DashboardCacheService dashboardCacheService;

  @Autowired private ShopService shopService;

  @Autowired private RedisTemplate<String, Object> redisTemplate;
  @Autowired private EnhancedRedisService enhancedRedisService;
  @Autowired private SessionSynchronizationService sessionSynchronizationService;
  @Autowired private PriceScrapingService priceScrapingService;
  @Autowired private SmartSnapshotService smartSnapshotService;
  @Autowired private PriceChangeCalculationService priceChangeCalculationService;

  @Autowired
  private com.storesight.backend.service.MarketIntelligenceCacheService
      marketIntelligenceCacheService;

  @Value("${competitor.scraping.max-urls-per-shop:10}")
  private int maxUrlsPerShop;

  // Redis-based suggestion count cache with proper invalidation
  private static final String SUGGESTION_COUNT_CACHE_PREFIX = "mi:suggestion_count:";
  private static final String SUGGESTION_CACHE_INVALIDATION_KEY =
      "mi:suggestion_cache_invalidation";
  private static final int CACHE_TTL_MINUTES =
      120; // 120 minutes cache duration (consistent with other caches)

  /** Resolve shop domain by ID for cache key construction */
  private String resolveShopDomain(Long shopId) {
    try {
      Map<String, Object> shop =
          jdbcTemplate.queryForMap("SELECT shopify_domain FROM shops WHERE id = ?", shopId);
      Object domain = shop.get("shopify_domain");
      return domain != null ? domain.toString() : "unknown";
    } catch (Exception e) {
      logger.warn("Failed to resolve shop domain for id {}: {}", shopId, e.getMessage());
      return "unknown";
    }
  }

  /** Refresh competitors cache for a shop by querying DB and writing through to Redis */
  private void refreshCompetitorCacheForShop(Long shopId, String shopDomain) {
    try {
      String query =
          """
              SELECT cu.id, cu.url, cu.label, cu.shopify_product_id,
                     CASE
                         WHEN ps.in_stock = false AND ps.price = 0 THEN
                             COALESCE(
                                 (SELECT price FROM price_snapshots
                                  WHERE competitor_url_id = cu.id
                                  AND deleted_at IS NULL
                                  AND price > 0
                                  ORDER BY checked_at DESC LIMIT 1),
                                 0.0
                             )
                         ELSE COALESCE(ps.price, 0.0)
                     END as price,
                     COALESCE(ps.in_stock, true) as in_stock,
                     COALESCE(ps.checked_at, cu.created_at) as last_checked,
                     COALESCE(ps.price_change_percent, 0.0) as price_change_percent,
                     p.title as product_title,
                     CASE
                         WHEN ps.in_stock = false AND ps.price = 0 AND
                              EXISTS (SELECT 1 FROM price_snapshots
                                     WHERE competitor_url_id = cu.id
                                     AND deleted_at IS NULL
                                     AND price > 0)
                         THEN true
                         ELSE false
                     END as showing_old_price
          FROM competitor_urls cu
              LEFT JOIN (
                  SELECT competitor_url_id, price, in_stock, checked_at, price_change_percent,
                         ROW_NUMBER() OVER (PARTITION BY competitor_url_id ORDER BY checked_at DESC) as rn
                  FROM price_snapshots
                  WHERE deleted_at IS NULL
              ) ps ON cu.id = ps.competitor_url_id AND ps.rn = 1
              LEFT JOIN products p ON cu.shopify_product_id = p.shopify_product_id
              WHERE cu.shop_id = ? AND cu.deleted_at IS NULL
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
                        row.get("last_checked") != null
                            ? row.get("last_checked").toString()
                            : "Never";
                    String shopifyProductId =
                        row.get("shopify_product_id") != null
                            ? String.valueOf(row.get("shopify_product_id"))
                            : null;
                    String productTitle =
                        row.get("product_title") != null
                            ? String.valueOf(row.get("product_title"))
                            : null;
                    Double percentDiff =
                        row.get("price_change_percent") != null
                            ? ((Number) row.get("price_change_percent")).doubleValue()
                            : 0.0;
                    Boolean showingOldPrice =
                        row.get("showing_old_price") != null
                            ? (Boolean) row.get("showing_old_price")
                            : false;

                    return new CompetitorDto(
                        id,
                        url,
                        label,
                        price,
                        inStock,
                        percentDiff,
                        lastChecked,
                        shopifyProductId,
                        productTitle,
                        showingOldPrice);
                  })
              .collect(Collectors.toList());

      marketIntelligenceCacheService.cacheCompetitorData(shopDomain, competitors);
      logger.debug(
          "Refreshed competitors cache for shop {} ({} items)", shopDomain, competitors.size());
    } catch (Exception e) {
      logger.warn(
          "Failed to refresh competitors cache for shop {}: {}", shopDomain, e.getMessage());
    }
  }

  /** Get cached suggestion count with Redis-based caching and proper invalidation */
  private Long getCachedSuggestionCount(Long shopId) {
    String cacheKey = SUGGESTION_COUNT_CACHE_PREFIX + shopId;
    String invalidationKey = SUGGESTION_CACHE_INVALIDATION_KEY + ":" + shopId;

    try {
      // Check if cache is invalidated using EnhancedRedisService
      Optional<String> invalidationValueOpt = enhancedRedisService.get(invalidationKey);
      if (invalidationValueOpt.isPresent()) {
        logger.debug("Cache invalidated for shop {}, fetching fresh count", shopId);
        return null; // Force fresh fetch
      }

      // Get cached count using EnhancedRedisService
      Optional<String> cachedValueOpt = enhancedRedisService.get(cacheKey);
      if (cachedValueOpt.isPresent()) {
        Long count = Long.valueOf(cachedValueOpt.get());
        logger.debug("Returning cached suggestion count for shop {}: {}", shopId, count);
        return count;
      }

      return null; // Cache miss, need fresh fetch
    } catch (Exception e) {
      logger.warn("Error reading from Redis cache for shop {}: {}", shopId, e.getMessage());
      return null; // Fallback to fresh fetch on Redis error
    }
  }

  /** Cache suggestion count in Redis with TTL */
  private void cacheSuggestionCount(Long shopId, Long count) {
    String cacheKey = SUGGESTION_COUNT_CACHE_PREFIX + shopId;

    try {
      boolean success =
          enhancedRedisService.setWithTtl(
              cacheKey, count.toString(), java.time.Duration.ofMinutes(CACHE_TTL_MINUTES));
      if (success) {
        logger.debug(
            "Cached suggestion count for shop {}: {} (TTL: {} minutes)",
            shopId,
            count,
            CACHE_TTL_MINUTES);
      } else {
        logger.warn("Failed to cache suggestion count for shop {}", shopId);
      }
    } catch (Exception e) {
      logger.warn("Error caching suggestion count for shop {}: {}", shopId, e.getMessage());
    }
  }

  /** Invalidate suggestion count cache for a shop */
  private void invalidateSuggestionCountCache(Long shopId) {
    String cacheKey = SUGGESTION_COUNT_CACHE_PREFIX + shopId;
    String invalidationKey = SUGGESTION_CACHE_INVALIDATION_KEY + ":" + shopId;

    try {
      // Set invalidation marker (short TTL to prevent permanent invalidation)
      boolean invalidationSet =
          enhancedRedisService.setWithTtl(
              invalidationKey, "invalidated", java.time.Duration.ofMinutes(1));

      // Remove cached count
      boolean deleted = enhancedRedisService.delete(cacheKey);

      if (invalidationSet && deleted) {
        logger.debug("Invalidated suggestion count cache for shop {}", shopId);
      } else {
        logger.warn(
            "Partial cache invalidation for shop {} - invalidationSet: {}, deleted: {}",
            shopId,
            invalidationSet,
            deleted);
      }
    } catch (Exception e) {
      logger.warn("Error invalidating cache for shop {}: {}", shopId, e.getMessage());
    }
  }

  /** Clear all suggestion count caches (for admin operations) */
  private void clearAllSuggestionCountCaches() {
    try {
      // This is a simple approach - in production you might want to use Redis SCAN
      logger.info("Clearing all suggestion count caches");
      // Note: In a real implementation, you'd use Redis SCAN to find and delete all keys
      // For now, we'll rely on TTL expiration
    } catch (Exception e) {
      logger.warn("Error clearing suggestion count caches: {}", e.getMessage());
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

    // Get session ID for locking
    String sessionId = request.getSession().getId();

    // Use optional session synchronization to prevent race conditions
    ResponseEntity<?> result =
        sessionSynchronizationService.executeWithOptionalSessionLock(
            sessionId,
            new SessionSynchronizationService.SessionOperation<ResponseEntity<?>>() {
              @Override
              public ResponseEntity<?> execute() {
                try {
                  final String shopDomain = resolveShopDomain(shopId);

                  // L1: Session cache handled by frontend. L2: Redis cache here. L3: DB fallback.
                  java.util.Optional<Object> cachedCompetitors =
                      marketIntelligenceCacheService.getCachedCompetitorData(shopDomain);
                  if (cachedCompetitors.isPresent()) {
                    logger.debug("Returning cached competitors for shop: {}", shopDomain);
                    return ResponseEntity.ok(cachedCompetitors.get());
                  }

                  // Get competitor URLs for this shop, joining with latest price snapshots and
                  // product info, including last known price for out-of-stock items
                  String query =
                      """
              SELECT cu.id, cu.url, cu.label, cu.shopify_product_id,
                     CASE
                         WHEN ps.in_stock = false AND ps.price = 0 THEN
                             -- For out-of-stock items, show the last known price if available
                             COALESCE(
                                 (SELECT price FROM price_snapshots
                                  WHERE competitor_url_id = cu.id
                                  AND deleted_at IS NULL
                                  AND price > 0
                                  ORDER BY checked_at DESC LIMIT 1),
                                 0.0
                             )
                         ELSE COALESCE(ps.price, 0.0)
                     END as price,
                     COALESCE(ps.in_stock, true) as in_stock,
                     COALESCE(ps.checked_at, cu.created_at) as last_checked,
                     COALESCE(ps.price_change_percent, 0.0) as price_change_percent,
                     p.title as product_title,
                     -- Add flag to indicate if we're showing old price for out-of-stock item
                     CASE
                         WHEN ps.in_stock = false AND ps.price = 0 AND
                              EXISTS (SELECT 1 FROM price_snapshots
                                     WHERE competitor_url_id = cu.id
                                     AND deleted_at IS NULL
                                     AND price > 0)
                         THEN true
                         ELSE false
                     END as showing_old_price
          FROM competitor_urls cu
              LEFT JOIN (
                  SELECT competitor_url_id, price, in_stock, checked_at, price_change_percent,
                         ROW_NUMBER() OVER (PARTITION BY competitor_url_id ORDER BY checked_at DESC) as rn
                  FROM price_snapshots
                  WHERE deleted_at IS NULL
              ) ps ON cu.id = ps.competitor_url_id AND ps.rn = 1
              LEFT JOIN products p ON cu.shopify_product_id = p.shopify_product_id
              WHERE cu.shop_id = ? AND cu.deleted_at IS NULL
          ORDER BY cu.created_at DESC
          """;

                  List<Map<String, Object>> rows = jdbcTemplate.queryForList(query, shopId);

                  logger.info(
                      "getCompetitors: Found {} competitor rows for shop {}", rows.size(), shopId);

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
                                    row.get("price") != null
                                        ? ((Number) row.get("price")).doubleValue()
                                        : 0.0;
                                Boolean inStock =
                                    row.get("in_stock") != null
                                        ? (Boolean) row.get("in_stock")
                                        : true;
                                String lastChecked =
                                    row.get("last_checked") != null
                                        ? row.get("last_checked").toString()
                                        : "Never";
                                String shopifyProductId =
                                    row.get("shopify_product_id") != null
                                        ? String.valueOf(row.get("shopify_product_id"))
                                        : null;
                                String productTitle =
                                    row.get("product_title") != null
                                        ? String.valueOf(row.get("product_title"))
                                        : null;
                                Double percentDiff =
                                    row.get("price_change_percent") != null
                                        ? ((Number) row.get("price_change_percent")).doubleValue()
                                        : 0.0;
                                Boolean showingOldPrice =
                                    row.get("showing_old_price") != null
                                        ? (Boolean) row.get("showing_old_price")
                                        : false;

                                logger.debug(
                                    "getCompetitors: Processing competitor ID {} with URL {} and price change {}% (showing old price: {})",
                                    id, url, percentDiff, showingOldPrice);
                                return new CompetitorDto(
                                    id,
                                    url,
                                    label,
                                    price,
                                    inStock,
                                    percentDiff,
                                    lastChecked,
                                    shopifyProductId,
                                    productTitle,
                                    showingOldPrice);
                              })
                          .collect(Collectors.toList());

                  logger.info(
                      "getCompetitors: Returning {} competitors for shop {}",
                      competitors.size(),
                      shopId);

                  // Write-through: cache fresh result in Redis
                  marketIntelligenceCacheService.cacheCompetitorData(shopDomain, competitors);

                  // Check for and log any inconsistent data (competitors without price snapshots)
                  if (competitors.size() > 0) {
                    List<Map<String, Object>> inconsistentCompetitors =
                        jdbcTemplate.queryForList(
                            "SELECT cu.id, cu.url FROM competitor_urls cu "
                                + "LEFT JOIN price_snapshots ps ON cu.id = ps.competitor_url_id "
                                + "WHERE cu.shop_id = ? AND cu.deleted_at IS NULL AND ps.id IS NULL",
                            shopId);

                    if (!inconsistentCompetitors.isEmpty()) {
                      logger.warn(
                          "getCompetitors: Found {} competitors without price snapshots for shop {}",
                          inconsistentCompetitors.size(),
                          shopId);
                      for (Map<String, Object> comp : inconsistentCompetitors) {
                        logger.warn(
                            "getCompetitors: Inconsistent competitor - ID: {}, URL: {}",
                            comp.get("id"),
                            comp.get("url"));
                      }
                    }
                  }

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
            });

    // Handle case where session operation returns null (session being invalidated)
    if (result == null) {
      logger.warn(
          "Session operation returned null for session {}, returning error response", sessionId);
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Session expired", "requiresReauth", true));
    }

    return result;
  }

  /** Per-competitor on-demand refresh with targeted cache patching */
  @PostMapping("/competitors/{id}/refresh")
  public ResponseEntity<Map<String, Object>> refreshSingleCompetitor(
      @PathVariable String id, HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    long competitorId;
    try {
      competitorId = Long.parseLong(id);
    } catch (NumberFormatException e) {
      return ResponseEntity.badRequest().body(Map.of("error", "Invalid competitor id"));
    }

    try {
      // Ensure competitor belongs to this shop and is active (not archived)
      List<Map<String, Object>> rows =
          jdbcTemplate.queryForList(
              "SELECT id, url, label FROM competitor_urls WHERE id = ? AND shop_id = ? AND deleted_at IS NULL",
              competitorId,
              shopId);
      if (rows.isEmpty()) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", "Competitor not found"));
      }

      Map<String, Object> record = rows.get(0);
      String url = (String) record.get("url");
      String label = record.get("label") != null ? record.get("label").toString() : url;

      // Use the same queue-based infrastructure but with a single item
      RedisPriceRefreshQueueService.CompetitorRefreshItem item =
          new RedisPriceRefreshQueueService.CompetitorRefreshItem(competitorId, url, label);

      RedisPriceRefreshQueueService.RefreshSession session =
          priceRefreshQueueService.startPriceRefresh(shopId, java.util.List.of(item));

      String shopDomain = resolveShopDomain(shopId);

      // Best-effort: If we already have a latest snapshot, patch list cache immediately
      // The queue will update DB and caches again when it completes
      try {
        List<Map<String, Object>> latest =
            jdbcTemplate.queryForList(
                "SELECT price, in_stock, checked_at FROM price_snapshots WHERE competitor_url_id = ? AND deleted_at IS NULL ORDER BY checked_at DESC LIMIT 1",
                competitorId);
        if (!latest.isEmpty()) {
          Map<String, Object> snap = latest.get(0);
          Map<String, Object> patch = new java.util.HashMap<>();
          patch.put("price", snap.getOrDefault("price", java.math.BigDecimal.ZERO));
          patch.put("inStock", snap.getOrDefault("in_stock", Boolean.TRUE));
          patch.put(
              "lastChecked",
              snap.get("checked_at") != null
                  ? snap.get("checked_at").toString()
                  : java.time.LocalDateTime.now().toString());
          // percentDiff recomputation is skipped here; UI can recompute or will be corrected on
          // next load
          marketIntelligenceCacheService.updateCompetitorListEntry(shopDomain, competitorId, patch);
        }
      } catch (Exception ignore) {
        // Non-blocking cache patch
      }

      return ResponseEntity.ok(
          Map.of(
              "message", "Refresh started",
              "session_id", session.sessionId,
              "total", session.totalCompetitors));

    } catch (Exception e) {
      logger.error(
          "Error starting single competitor refresh for {} on shop {}: {}",
          competitorId,
          shopId,
          e.getMessage(),
          e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to start competitor refresh"));
    }
  }

  /** Add a new competitor manually */
  @PostMapping("/competitors")
  public ResponseEntity<?> addCompetitor(
      @RequestBody AddCompetitorRequest request, HttpServletRequest httpRequest) {
    logger.info("addCompetitor: Starting request with URL: {}", request.url);

    Long shopId = getShopIdFromRequest(httpRequest);
    logger.info("addCompetitor: Extracted shopId: {}", shopId);

    if (shopId == null) {
      logger.warn("addCompetitor: No shopId found - authentication failed");
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
      // Get shop domain from shopId for Redis lookup
      String shopDomain = getShopDomainFromId(shopId);
      if (shopDomain == null) {
        logger.error("addCompetitor: Could not determine shop domain for shopId: {}", shopId);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of("error", "Unable to determine shop domain"));
      }

      // Get products from Redis cache and validate productId
      String productId = null;

      if (request.productId != null && !request.productId.trim().isEmpty()) {
        String providedProductId = request.productId.trim();
        logger.info("addCompetitor: Using provided productId: {}", providedProductId);

        // First try Redis cache, then fallback to session storage via API
        var cachedProducts = dashboardCacheService.getCachedProductsData(shopDomain);
        if (cachedProducts.isPresent()) {
          try {
            @SuppressWarnings("unchecked")
            Map<String, Object> productsData = (Map<String, Object>) cachedProducts.get();
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> products =
                (List<Map<String, Object>>) productsData.get("products");

            if (products != null && !products.isEmpty()) {
              // Check if the provided productId exists in the cached products
              boolean productExists =
                  products.stream()
                      .anyMatch(product -> providedProductId.equals(product.get("id").toString()));

              if (!productExists) {
                logger.warn(
                    "addCompetitor: Provided productId {} not found in cached products for shop {}",
                    providedProductId,
                    shopDomain);
                return ResponseEntity.status(HttpStatus.PRECONDITION_REQUIRED)
                    .body(
                        Map.of(
                            "error", "PRODUCTS_SYNC_NEEDED",
                            "message",
                                "The provided product ID was not found. Please sync your products first.",
                            "action", "SYNC_PRODUCTS",
                            "redirect_url", "/dashboard"));
              }
              productId = providedProductId;
            } else {
              logger.warn("addCompetitor: No products found in cache for shop {}", shopDomain);
              return ResponseEntity.status(HttpStatus.PRECONDITION_REQUIRED)
                  .body(
                      Map.of(
                          "error", "PRODUCTS_SYNC_NEEDED",
                          "message",
                              "Please visit your Dashboard first to sync products from Shopify, then try adding competitors.",
                          "action", "SYNC_PRODUCTS",
                          "redirect_url", "/dashboard"));
            }
          } catch (Exception e) {
            logger.warn("addCompetitor: Error parsing cached products data: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.PRECONDITION_REQUIRED)
                .body(
                    Map.of(
                        "error", "PRODUCTS_SYNC_NEEDED",
                        "message", "Product data is corrupted. Please sync your products first.",
                        "action", "SYNC_PRODUCTS",
                        "redirect_url", "/dashboard"));
          }
        } else {
          logger.warn("addCompetitor: No cached products found for shop {}", shopDomain);
          return ResponseEntity.status(HttpStatus.PRECONDITION_REQUIRED)
              .body(
                  Map.of(
                      "error", "PRODUCTS_SYNC_NEEDED",
                      "message",
                          "Please visit your Dashboard first to sync products from Shopify, then try adding competitors.",
                      "action", "SYNC_PRODUCTS",
                      "redirect_url", "/dashboard"));
        }
      } else {
        // No productId provided or empty string - get first product from Redis cache
        logger.info(
            "addCompetitor: No productId provided, looking for cached products for shop {}",
            shopDomain);

        var cachedProducts = dashboardCacheService.getCachedProductsData(shopDomain);
        if (cachedProducts.isPresent()) {
          try {
            @SuppressWarnings("unchecked")
            Map<String, Object> productsData = (Map<String, Object>) cachedProducts.get();
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> products =
                (List<Map<String, Object>>) productsData.get("products");

            if (products != null && !products.isEmpty()) {
              // Use a random product instead of always the first one
              int randomIndex = new java.util.Random().nextInt(products.size());
              Map<String, Object> randomProduct = products.get(randomIndex);
              Object shopifyId = randomProduct.get("id");
              if (shopifyId != null) {
                productId = shopifyId.toString();
                logger.info(
                    "addCompetitor: Using random cached product (index {}) with Shopify ID: {}",
                    randomIndex,
                    productId);
              } else {
                logger.warn("addCompetitor: First product has no ID");
                return ResponseEntity.status(HttpStatus.PRECONDITION_REQUIRED)
                    .body(
                        Map.of(
                            "error", "PRODUCTS_SYNC_NEEDED",
                            "message",
                                "Product data is incomplete. Please sync your products first.",
                            "action", "SYNC_PRODUCTS",
                            "redirect_url", "/dashboard"));
              }
            } else {
              logger.warn("addCompetitor: No products found in cache for shop {}", shopDomain);
              return ResponseEntity.status(HttpStatus.PRECONDITION_REQUIRED)
                  .body(
                      Map.of(
                          "error", "PRODUCTS_SYNC_NEEDED",
                          "message",
                              "Please visit your Dashboard first to sync products from Shopify, then try adding competitors.",
                          "action", "SYNC_PRODUCTS",
                          "redirect_url", "/dashboard"));
            }
          } catch (Exception e) {
            logger.warn("addCompetitor: Error parsing cached products data: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.PRECONDITION_REQUIRED)
                .body(
                    Map.of(
                        "error",
                        "PRODUCTS_SYNC_NEEDED",
                        "message",
                        "Product data is corrupted. Please sync your products first.",
                        "action",
                        "SYNC_PRODUCTS",
                        "redirect_url",
                        "/dashboard"));
          }
        } else {
          logger.info(
              "addCompetitor: No cached products found for shop {}, attempting to fetch from Shopify API",
              shopDomain);

          // Try to fetch products from Shopify API as fallback
          try {
            // This would be a call to Shopify API to get products
            // For now, we'll allow addition without product association
            // TODO: Implement Shopify API call to fetch products
            logger.info(
                "addCompetitor: Shopify API fallback not implemented yet, allowing competitor addition without product association");
            productId = null; // No product association for now

            // TODO: When Shopify API integration is ready, we can:
            // 1. Call Shopify API to get products
            // 2. Use first product or best match
            // 3. Cache the products for future use
            // 4. Associate competitor with selected product

          } catch (Exception e) {
            logger.warn(
                "addCompetitor: Failed to fetch products from Shopify API: {}", e.getMessage());
            productId = null; // No product association
          }
        }
      }

      // Check if competitor URL already exists for this shop and product
      logger.info(
          "addCompetitor: Checking for existing competitor URL for shop {} and product {}",
          shopId,
          productId);

      List<Map<String, Object>> existing;
      if (productId != null) {
        existing =
            jdbcTemplate.queryForList(
                "SELECT id FROM competitor_urls WHERE shop_id = ? AND shopify_product_id = ? AND url = ?",
                shopId,
                productId,
                request.url);
      } else {
        existing =
            jdbcTemplate.queryForList(
                "SELECT id FROM competitor_urls WHERE shop_id = ? AND shopify_product_id IS NULL AND url = ?",
                shopId,
                request.url);
      }

      if (!existing.isEmpty()) {
        logger.warn(
            "addCompetitor: Competitor URL already exists for shop {} and product {}",
            shopId,
            productId);
        return ResponseEntity.badRequest()
            .body(Map.of("error", "This competitor URL is already being tracked"));
      }

      // Extract title from URL if no custom label provided
      String label;
      if (request.label != null && !request.label.trim().isEmpty()) {
        // Use custom label if provided
        label = request.label.trim();
        logger.info("addCompetitor: Using custom label '{}' for URL: {}", label, request.url);
      } else {
        // Extract title from URL with enhanced platform support
        label = extractTitleByPlatform(request.url);
        logger.info("addCompetitor: Extracted label '{}' for URL: {}", label, request.url);
      }

      // Check if this URL was previously soft-deleted for this shop
      List<Map<String, Object>> existingDeleted =
          jdbcTemplate.queryForList(
              "SELECT id, url, label FROM competitor_urls WHERE shop_id = ? AND url = ? AND deleted_at IS NOT NULL",
              shopId,
              request.url);

      if (!existingDeleted.isEmpty()) {
        // Reactivate the soft-deleted competitor
        Map<String, Object> existingDeletedRecord = existingDeleted.get(0);
        Long existingId = ((Number) existingDeletedRecord.get("id")).longValue();

        jdbcTemplate.update(
            "UPDATE competitor_urls SET deleted_at = NULL, label = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            request.label != null ? request.label : (String) existingDeletedRecord.get("label"),
            existingId);

        logger.info(
            "addCompetitor: Reactivated soft-deleted competitor ID {} for URL {}",
            existingId,
            request.url);

        // Get the reactivated record
        List<Map<String, Object>> reactivatedRecord =
            jdbcTemplate.queryForList(
                "SELECT id, url, label FROM competitor_urls WHERE id = ?", existingId);

        if (!reactivatedRecord.isEmpty()) {
          Map<String, Object> record = reactivatedRecord.get(0);
          CompetitorDto competitor =
              new CompetitorDto(
                  String.valueOf(record.get("id")),
                  String.valueOf(record.get("url")),
                  String.valueOf(record.get("label")),
                  0.0, // Price will be updated by scraper
                  true, // Assume in stock initially
                  0.0, // No price difference initially
                  "Just reactivated",
                  productId, // shopifyProductId
                  null, // productTitle - will be populated on next fetch
                  false); // showingOldPrice - not applicable for reactivated items

          // Start background price scraping for the reactivated competitor
          try {
            logger.info(
                "addCompetitor: Starting background price scraping for reactivated competitor ID: {}",
                record.get("id"));
            startBackgroundPriceScraping(record.get("id").toString(), request.url, shopId);
          } catch (Exception e) {
            logger.warn(
                "addCompetitor: Failed to start background price scraping for reactivated competitor: {}",
                e.getMessage());
          }

          return ResponseEntity.ok(
              Map.of(
                  "message",
                  "Competitor reactivated successfully",
                  "competitor",
                  competitor,
                  "reactivated",
                  true));
        }
      }

      // Check if a soft-deleted competitor with the same URL exists and reactivate it
      logger.info("addCompetitor: Checking for existing soft-deleted competitor");

      List<Map<String, Object>> existingSoftDeleted =
          jdbcTemplate.queryForList(
              "SELECT id FROM competitor_urls WHERE shop_id = ? AND url = ? AND deleted_at IS NOT NULL",
              shopId,
              request.url);

      int rowsAffected;
      String competitorId;

      if (!existingSoftDeleted.isEmpty()) {
        // Reactivate the soft-deleted competitor
        competitorId = existingSoftDeleted.get(0).get("id").toString();
        logger.info("addCompetitor: Reactivating soft-deleted competitor ID: {}", competitorId);

        String platform = identifyPlatform(request.url);
        String domain = extractDomain(request.url);

        logger.info(
            "addCompetitor: Reactivating - Extracted platform: '{}', domain: '{}' from URL: {}",
            platform,
            domain,
            request.url);

        rowsAffected =
            jdbcTemplate.update(
                "UPDATE competitor_urls SET deleted_at = NULL, label = ?, platform = ?, domain = ?, shopify_product_id = ? WHERE id = ?",
                label,
                platform,
                domain,
                productId,
                Long.parseLong(competitorId));

        logger.info("addCompetitor: Reactivated {} competitor records", rowsAffected);

        // Also reactivate associated price snapshots
        int reactivatedSnapshots =
            jdbcTemplate.update(
                "UPDATE price_snapshots SET deleted_at = NULL WHERE competitor_url_id = ? AND deleted_at IS NOT NULL",
                Long.parseLong(competitorId));
        logger.info("addCompetitor: Reactivated {} price snapshots", reactivatedSnapshots);

      } else {
        // Insert new competitor URL with platform and domain info
        logger.info("addCompetitor: Inserting new competitor URL into database");

        String platform = identifyPlatform(request.url);
        String domain = extractDomain(request.url);

        logger.info(
            "addCompetitor: New competitor - Extracted platform: '{}', domain: '{}' from URL: {}",
            platform,
            domain,
            request.url);

        if (productId != null) {
          rowsAffected =
              jdbcTemplate.update(
                  "INSERT INTO competitor_urls (shop_id, shopify_product_id, url, label, platform, domain, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                  shopId,
                  productId,
                  request.url,
                  label,
                  platform,
                  domain);
        } else {
          rowsAffected =
              jdbcTemplate.update(
                  "INSERT INTO competitor_urls (shop_id, shopify_product_id, url, label, platform, domain, created_at) VALUES (?, NULL, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                  shopId,
                  request.url,
                  label,
                  platform,
                  domain);
        }

        // Get the newly inserted competitor ID
        List<Map<String, Object>> newRecord =
            jdbcTemplate.queryForList(
                "SELECT id FROM competitor_urls WHERE shop_id = ? AND url = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
                shopId,
                request.url);
        competitorId = newRecord.get(0).get("id").toString();
      }

      logger.info("addCompetitor: Database operation affected {} rows", rowsAffected);

      // Get the competitor record details
      logger.info("addCompetitor: Retrieving competitor record details");

      List<Map<String, Object>> competitorRecord =
          jdbcTemplate.queryForList(
              "SELECT id, url, label FROM competitor_urls WHERE id = ?",
              Long.parseLong(competitorId));

      if (competitorRecord.isEmpty()) {
        logger.error("addCompetitor: Failed to retrieve competitor record");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of("error", "Failed to create competitor record"));
      }

      Map<String, Object> record = competitorRecord.get(0);
      logger.info("addCompetitor: Retrieved competitor record with ID: {}", record.get("id"));

      CompetitorDto competitor =
          new CompetitorDto(
              String.valueOf(record.get("id")),
              String.valueOf(record.get("url")),
              String.valueOf(record.get("label")),
              0.0, // Price will be updated by scraper
              true, // Assume in stock initially
              0.0, // No price difference initially
              "Just added",
              productId, // shopifyProductId
              null, // productTitle - will be populated on next fetch
              false); // showingOldPrice - not applicable for newly added items

      // Audit log the competitor addition
      competitorAuditService.logCompetitorAdded(shopId, request.url, label);

      // Start background price scraping for the competitor (non-blocking)
      try {
        logger.info(
            "addCompetitor: Starting background price scraping for competitor ID: {}",
            competitorId);
        // Start background scraping - this won't block the response
        startBackgroundPriceScraping(competitorId, request.url, shopId);
      } catch (Exception e) {
        logger.warn("addCompetitor: Failed to start background price scraping: {}", e.getMessage());
        // Don't fail the competitor addition if background scraping fails
      }

      logger.info(
          "addCompetitor: Successfully added competitor {} for shop {}", request.url, shopId);

      // Write-through cache update for competitors list
      shopDomain = resolveShopDomain(shopId);
      refreshCompetitorCacheForShop(shopId, shopDomain);

      return ResponseEntity.ok(competitor);

    } catch (Exception e) {
      logger.error(
          "addCompetitor: Unexpected error for shop {} with URL {}: {}",
          shopId,
          request.url,
          e.getMessage(),
          e);

      // Provide user-friendly error messages without exposing system internals
      String errorMessage = "Unable to add competitor at this time. Please try again.";
      if (e.getMessage() != null) {
        if (e.getMessage().contains("duplicate key")
            || e.getMessage().contains("unique constraint")) {
          errorMessage = "This competitor URL is already being tracked";
        } else if (e.getMessage().contains("foreign key")
            || e.getMessage().contains("product_id")) {
          errorMessage = "Invalid product reference. Please refresh the page and try again.";
        } else if (e.getMessage().contains("connection") || e.getMessage().contains("database")) {
          errorMessage = "Service temporarily unavailable. Please try again in a moment.";
        } else {
          // Don't expose internal error messages to users
          errorMessage = "Unable to add competitor at this time. Please try again.";
        }
      }

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", errorMessage));
    }
  }

  /** Delete a competitor */
  @DeleteMapping("/competitors/{id}")
  @Transactional
  public ResponseEntity<?> deleteCompetitor(@PathVariable String id, HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      logger.info(
          "deleteCompetitor: Starting deletion for competitor ID: {} for shop: {}", id, shopId);

      // Check archived competitor limits before archiving
      CompetitorLimitService.LimitCheckResult archivedLimitCheck =
          limitService.checkArchivedCompetitorLimit(shopId);
      if (!archivedLimitCheck.isCanAdd()) {
        throw new ArchivedCompetitorLimitExceededException(
            "Archived competitor limit reached for your plan",
            archivedLimitCheck.getCurrent(),
            archivedLimitCheck.getLimit(),
            archivedLimitCheck.getPlanType().getDisplayName());
      }

      // Verify the competitor belongs to this shop and get URL for audit logging
      List<Map<String, Object>> competitors =
          jdbcTemplate.queryForList(
              "SELECT cu.id, cu.url FROM competitor_urls cu WHERE cu.id = ? AND cu.shop_id = ? AND cu.deleted_at IS NULL",
              Long.parseLong(id),
              shopId);

      if (competitors.isEmpty()) {
        logger.warn(
            "deleteCompetitor: Competitor {} not found for shop {} or already deleted", id, shopId);
        return ResponseEntity.notFound().build();
      }

      String competitorUrl = (String) competitors.get(0).get("url");
      logger.info("deleteCompetitor: Found competitor URL: {} for deletion", competitorUrl);

      // Audit log the deletion attempt before performing the actual deletion
      competitorAuditService.logCompetitorRemoved(
          shopId, competitorUrl, "User initiated competitor deletion");

      // Soft delete related price snapshots first
      int deletedSnapshots =
          jdbcTemplate.update(
              "UPDATE price_snapshots SET deleted_at = CURRENT_TIMESTAMP WHERE competitor_url_id = ? AND deleted_at IS NULL",
              Long.parseLong(id));
      logger.info(
          "deleteCompetitor: Soft deleted {} price snapshots for competitor {}",
          deletedSnapshots,
          id);

      // Soft delete the competitor URL
      int deletedCompetitors =
          jdbcTemplate.update(
              "UPDATE competitor_urls SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
              Long.parseLong(id));
      logger.info(
          "deleteCompetitor: Soft deleted {} competitor URLs for ID {}", deletedCompetitors, id);

      if (deletedCompetitors == 0) {
        logger.error("deleteCompetitor: No competitor URL was deleted for ID {}", id);
        throw new RuntimeException("Failed to delete competitor URL");
      }

      // Audit log the successful deletion completion
      competitorAuditService.logCompetitorRemoved(
          shopId, competitorUrl, "Competitor deletion completed successfully");

      logger.info("deleteCompetitor: Successfully deleted competitor {} for shop {}", id, shopId);

      // Write-through cache update after deletion
      String shopDomain = resolveShopDomain(shopId);
      refreshCompetitorCacheForShop(shopId, shopDomain);
      // Also refresh archived list cache to reflect newly archived item
      try {
        String archivedQuery =
            """
            SELECT
                cu.id,
                cu.url,
                cu.label,
                cu.deleted_at,
                cu.platform,
                cu.domain,
                cu.last_successful_check,
                COUNT(ps.id) as price_snapshots_count
            FROM competitor_urls cu
            LEFT JOIN price_snapshots ps ON cu.id = ps.competitor_url_id AND ps.deleted_at IS NULL
            WHERE cu.shop_id = ? AND cu.deleted_at IS NOT NULL
            GROUP BY cu.id, cu.url, cu.label, cu.deleted_at, cu.platform, cu.domain, cu.last_successful_check
            ORDER BY cu.deleted_at DESC
            """;
        List<Map<String, Object>> archivedCompetitorsList =
            jdbcTemplate.queryForList(archivedQuery, shopId);
        marketIntelligenceCacheService.cacheArchivedCompetitorData(
            shopDomain, archivedCompetitorsList);
      } catch (Exception ex) {
        logger.warn(
            "Failed to refresh archived competitors cache for shop {}: {}",
            shopDomain,
            ex.getMessage());
      }

      // Include fresh counts for consistent UI
      Integer activeCount =
          jdbcTemplate.queryForObject(
              "SELECT COUNT(*) FROM competitor_urls WHERE shop_id = ? AND deleted_at IS NULL",
              Integer.class,
              shopId);
      Integer archivedCount =
          jdbcTemplate.queryForObject(
              "SELECT COUNT(*) FROM competitor_urls WHERE shop_id = ? AND deleted_at IS NOT NULL",
              Integer.class,
              shopId);

      return ResponseEntity.ok(
          Map.of(
              "success",
              true,
              "message",
              "Competitor deleted successfully",
              "activeCount",
              activeCount == null ? 0 : activeCount,
              "archivedCount",
              archivedCount == null ? 0 : archivedCount));

    } catch (ArchivedCompetitorLimitExceededException e) {
      // Let the exception handler process this specific exception
      throw e;
    } catch (NumberFormatException e) {
      logger.error("deleteCompetitor: Invalid competitor ID format: {}", id);
      return ResponseEntity.badRequest().body(Map.of("error", "Invalid competitor ID"));
    } catch (Exception e) {
      logger.error(
          "deleteCompetitor: Error deleting competitor {} for shop {}: {}",
          id,
          shopId,
          e.getMessage(),
          e);

      // Provide user-friendly error messages without exposing system internals
      String errorMessage = "Unable to remove competitor tracking at this time. Please try again.";
      if (e.getMessage() != null) {
        if (e.getMessage().contains("foreign key") || e.getMessage().contains("constraint")) {
          errorMessage =
              "This competitor cannot be removed right now. It may be associated with other data. Please try again later.";
        } else if (e.getMessage().contains("connection") || e.getMessage().contains("database")) {
          errorMessage = "Service temporarily unavailable. Please try again in a moment.";
        } else if (e.getMessage().contains("timeout")) {
          errorMessage = "Request timed out. Please try again.";
        } else {
          // Don't expose internal error messages to users
          errorMessage = "Unable to remove competitor tracking at this time. Please try again.";
        }
      }

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", errorMessage));
    }
  }

  /** Admin endpoint to clean up inconsistent competitor data */
  @PostMapping("/competitors/cleanup-inconsistent")
  @Profile("!prod") // Only available in non-production environments
  public ResponseEntity<Map<String, Object>> cleanupInconsistentCompetitors(
      HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      logger.info("cleanupInconsistentCompetitors: Starting cleanup for shop {}", shopId);

      // Find competitors without price snapshots
      List<Map<String, Object>> inconsistentCompetitors =
          jdbcTemplate.queryForList(
              "SELECT cu.id, cu.url FROM competitor_urls cu "
                  + "LEFT JOIN price_snapshots ps ON cu.id = ps.competitor_url_id "
                  + "WHERE cu.shop_id = ? AND ps.id IS NULL",
              shopId);

      if (inconsistentCompetitors.isEmpty()) {
        return ResponseEntity.ok(
            Map.of("message", "No inconsistent competitors found", "cleanedCount", 0));
      }

      logger.info(
          "cleanupInconsistentCompetitors: Found {} inconsistent competitors to clean up",
          inconsistentCompetitors.size());

      int cleanedCount = 0;
      for (Map<String, Object> comp : inconsistentCompetitors) {
        Long compId = ((Number) comp.get("id")).longValue();
        String compUrl = (String) comp.get("url");

        try {
          // Delete the inconsistent competitor
          jdbcTemplate.update(
              "UPDATE competitor_urls SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", compId);
          cleanedCount++;
          logger.info(
              "cleanupInconsistentCompetitors: Cleaned up competitor ID {} with URL {}",
              compId,
              compUrl);
        } catch (Exception e) {
          logger.error(
              "cleanupInconsistentCompetitors: Failed to clean up competitor ID {}: {}",
              compId,
              e.getMessage());
        }
      }

      Map<String, Object> result =
          Map.of(
              "message",
              "Cleanup completed",
              "cleanedCount",
              cleanedCount,
              "totalFound",
              inconsistentCompetitors.size());

      logger.info(
          "cleanupInconsistentCompetitors: Cleanup completed for shop {} - {}", shopId, result);
      return ResponseEntity.ok(result);

    } catch (Exception e) {
      logger.error(
          "cleanupInconsistentCompetitors: Error during cleanup for shop {}: {}",
          shopId,
          e.getMessage(),
          e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to cleanup inconsistent competitors"));
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

      logger.info(
          "getSuggestions: Found {} suggestions for shop {} (status: {}, page: {}, size: {})",
          suggestions.getTotalElements(),
          shopId,
          status,
          page,
          size);

      // Invalidate cache when suggestions are fetched to ensure consistency
      invalidateSuggestionCountCache(shopId);
      logger.debug(
          "Invalidated suggestion count cache for shop {} after fetching suggestions", shopId);

      return ResponseEntity.ok(result);
    } catch (Exception e) {
      System.err.println("Error getting suggestions: " + e.getMessage());
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to load suggestions"));
    }
  }

  /**
   * Get count of NEW suggestions for badge display - with Redis-based caching and proper
   * invalidation
   */
  @GetMapping("/competitors/suggestions/count")
  public ResponseEntity<Map<String, Object>> getSuggestionCount(HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);

    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required", "newSuggestions", 0L));
    }

    // Get session ID for locking
    String sessionId = request.getSession().getId();

    // Use optional session synchronization to prevent race conditions
    ResponseEntity<Map<String, Object>> result =
        sessionSynchronizationService.executeWithOptionalSessionLock(
            sessionId,
            new SessionSynchronizationService.SessionOperation<
                ResponseEntity<Map<String, Object>>>() {
              @Override
              public ResponseEntity<Map<String, Object>> execute() {
                try {
                  // Check cache for this shop (Redis-based with proper invalidation)
                  Long cachedCount = getCachedSuggestionCount(shopId);
                  if (cachedCount != null) {
                    logger.info(
                        "Returning cached suggestion count for shop {}: {}", shopId, cachedCount);
                    return ResponseEntity.ok(Map.of("newSuggestions", cachedCount));
                  }

                  // Fetch fresh count
                  long newCount =
                      suggestionRepository.countByShopIdAndStatus(
                          shopId, CompetitorSuggestion.Status.NEW);

                  logger.info(
                      "getSuggestionCount: Fresh count for shop {}: {} (cache was expired or missing)",
                      shopId,
                      newCount);

                  // Update cache
                  cacheSuggestionCount(shopId, newCount);

                  logger.debug("Fresh suggestion count for shop {}: {}", shopId, newCount);
                  return ResponseEntity.ok(Map.of("newSuggestions", newCount));

                } catch (Exception e) {
                  logger.error(
                      "Error getting suggestion count for shop {}: {}", shopId, e.getMessage());
                  return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                      .body(Map.of("error", "Database error", "newSuggestions", 0L));
                }
              }
            });

    // Handle case where session operation returns null (session being invalidated)
    if (result == null) {
      logger.warn(
          "Session operation returned null for session {}, returning error response", sessionId);
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Session expired", "requiresReauth", true, "newSuggestions", 0L));
    }

    return result;
  }

  /** Manual refresh endpoint for forcing cache invalidation */
  @PostMapping("/competitors/suggestions/refresh-count")
  public ResponseEntity<Map<String, Object>> refreshSuggestionCount(HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);

    if (shopId == null) {
      return ResponseEntity.badRequest().body(Map.of("error", "Authentication required"));
    }

    // Clear cache for this shop
    invalidateSuggestionCountCache(shopId);

    // Return fresh count
    return getSuggestionCount(request);
  }

  /** Approve a competitor suggestion */
  @PostMapping("/competitors/suggestions/{id}/approve")
  @Transactional
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
      invalidateSuggestionCountCache(shopId);
      logger.debug("Invalidated suggestion count cache for shop {} after approval", shopId);

      // Create actual competitor_url entry for price tracking
      String label =
          suggestion.getTitle() != null
              ? suggestion.getTitle()
              : extractTitleFromUrl(suggestion.getSuggestedUrl());

      jdbcTemplate.update(
          "INSERT INTO competitor_urls (shop_id, shopify_product_id, url, label, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
          suggestion.getShopId(),
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
  @Transactional
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
    invalidateSuggestionCountCache(shopId);
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

      // Discovery status is always fetched fresh for real-time accuracy
      // (Database queries are fast, no need for complex caching here)
      logger.debug("Fetching fresh discovery status for shop {}", shopId);

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

      // Discovery status is always fresh, no cache invalidation needed
      logger.debug("Discovery triggered for shop {}", shopId);

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
  @GetMapping("/competitors/deleted")
  public ResponseEntity<Map<String, Object>> getDeletedCompetitors(HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      String query =
          """
          SELECT
              cu.id,
              cu.url,
              cu.label,
              cu.deleted_at,
              cu.platform,
              cu.domain,
              cu.last_successful_check,
              COUNT(ps.id) as price_snapshots_count
          FROM competitor_urls cu
          LEFT JOIN price_snapshots ps ON cu.id = ps.competitor_url_id AND ps.deleted_at IS NULL
          WHERE cu.shop_id = ? AND cu.deleted_at IS NOT NULL
          GROUP BY cu.id, cu.url, cu.label, cu.deleted_at, cu.platform, cu.domain, cu.last_successful_check
          ORDER BY cu.deleted_at DESC
          """;

      String shopDomain = resolveShopDomain(shopId);

      // Try Redis first
      Optional<Object> cached =
          marketIntelligenceCacheService.getCachedArchivedCompetitorData(shopDomain);
      if (cached.isPresent()) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> deletedCompetitors = (List<Map<String, Object>>) cached.get();
        return ResponseEntity.ok(Map.of("competitors", deletedCompetitors, "cached", true));
      }

      // DB fallback and write-through
      List<Map<String, Object>> deletedCompetitors = jdbcTemplate.queryForList(query, shopId);
      marketIntelligenceCacheService.cacheArchivedCompetitorData(shopDomain, deletedCompetitors);

      return ResponseEntity.ok(Map.of("competitors", deletedCompetitors, "cached", false));

    } catch (Exception e) {
      logger.error("Error getting deleted competitors for shop {}: {}", shopId, e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to retrieve deleted competitors"));
    }
  }

  @PostMapping("/competitors/{id}/restore")
  @Transactional
  public ResponseEntity<Map<String, Object>> restoreCompetitor(
      @PathVariable String id,
      @RequestBody Map<String, String> request,
      HttpServletRequest httpRequest) {

    Long shopId = getShopIdFromRequest(httpRequest);
    if (shopId == null) {
      logger.error("Restore competitor: No shop ID found in request");
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required - no shop ID found"));
    }

    // Parse competitor ID
    Long competitorId;
    try {
      competitorId = Long.parseLong(id);
    } catch (NumberFormatException e) {
      logger.error("Restore competitor: Invalid competitor ID format: {}", id);
      return ResponseEntity.badRequest().body(Map.of("error", "Invalid competitor ID format"));
    }

    try {

      // Check active competitor limits before restoring (since we're moving from archived to
      // active)
      CompetitorLimitService.LimitCheckResult activeLimitCheck =
          limitService.checkCompetitorLimit(shopId);
      if (!activeLimitCheck.isCanAdd()) {
        throw new CompetitorLimitExceededException(
            "Competitor limit reached for your plan",
            activeLimitCheck.getCurrent(),
            activeLimitCheck.getLimit(),
            activeLimitCheck.getPlanType().getDisplayName());
      }

      // Verify the competitor belongs to this shop and is deleted
      List<Map<String, Object>> competitors =
          jdbcTemplate.queryForList(
              "SELECT id, url, label FROM competitor_urls WHERE id = ? AND shop_id = ? AND deleted_at IS NOT NULL",
              competitorId,
              shopId);

      if (competitors.isEmpty()) {
        logger.warn(
            "Restore competitor: No deleted competitor found with ID {} for shop {}",
            competitorId,
            shopId);
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", "Competitor not found or not deleted"));
      }

      String newLabel = request.get("label");
      if (newLabel == null || newLabel.trim().isEmpty()) {
        newLabel = (String) competitors.get(0).get("label");
      }

      // Note: Archive/restore operations should not trigger immediate scraping
      // Background scraping system will handle price updates based on 24-hour schedule

      // Restore the competitor - let background scraping handle price updates
      // No immediate scraping for archive/restore operations to prevent unnecessary costs
      jdbcTemplate.update(
          "UPDATE competitor_urls SET deleted_at = NULL, label = ? WHERE id = ?",
          newLabel,
          competitorId);
      logger.info(
          "Restore: Restored competitor {} - background scraping will handle price updates (24-hour rule)",
          competitorId);

      // Restore associated price snapshots
      jdbcTemplate.update(
          "UPDATE price_snapshots SET deleted_at = NULL WHERE competitor_url_id = ? AND deleted_at IS NOT NULL",
          competitorId);

      // Patch caches: remove from archived list cache and refresh active list for immediate
      // consistency on subsequent reads
      try {
        String shopDomain = resolveShopDomain(shopId);
        marketIntelligenceCacheService.removeFromArchivedList(shopDomain, competitorId);
        // Rebuild active competitors cache from DB so UI immediately sees the restored item
        refreshCompetitorCacheForShop(shopId, shopDomain);
      } catch (Exception ignore) {
      }

      // Return fresh counts from DB for consistent UX
      Integer activeCount =
          jdbcTemplate.queryForObject(
              "SELECT COUNT(*) FROM competitor_urls WHERE shop_id = ? AND deleted_at IS NULL",
              Integer.class,
              shopId);
      Integer archivedCount =
          jdbcTemplate.queryForObject(
              "SELECT COUNT(*) FROM competitor_urls WHERE shop_id = ? AND deleted_at IS NOT NULL",
              Integer.class,
              shopId);

      logger.info("Restored competitor {} for shop {}", competitorId, shopId);
      return ResponseEntity.ok(
          Map.of(
              "success",
              true,
              "message",
              "Competitor restored successfully",
              "activeCount",
              activeCount == null ? 0 : activeCount,
              "archivedCount",
              archivedCount == null ? 0 : archivedCount));

    } catch (CompetitorLimitExceededException e) {
      // Include current counts in error response for UX consistency
      try {
        Integer activeCount =
            jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM competitor_urls WHERE shop_id = ? AND deleted_at IS NULL",
                Integer.class,
                shopId);
        Integer archivedCount =
            jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM competitor_urls WHERE shop_id = ? AND deleted_at IS NOT NULL",
                Integer.class,
                shopId);
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
            .body(
                Map.of(
                    "error",
                    "COMPETITOR_LIMIT_EXCEEDED",
                    "message",
                    e.getMessage(),
                    "activeCount",
                    activeCount == null ? 0 : activeCount,
                    "archivedCount",
                    archivedCount == null ? 0 : archivedCount));
      } catch (Exception ignore) {
        throw e;
      }
    } catch (Exception e) {
      logger.error(
          "Error restoring competitor {} for shop {}: {}", competitorId, shopId, e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to restore competitor: " + e.getMessage()));
    }
  }

  @DeleteMapping("/competitors/{id}/permanent")
  @Transactional
  public ResponseEntity<Map<String, Object>> permanentlyDeleteCompetitor(
      @PathVariable String id, HttpServletRequest request) {

    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      // Verify the competitor belongs to this shop and is deleted
      List<Map<String, Object>> competitors =
          jdbcTemplate.queryForList(
              "SELECT id FROM competitor_urls WHERE id = ? AND shop_id = ? AND deleted_at IS NOT NULL",
              Long.parseLong(id),
              shopId);

      if (competitors.isEmpty()) {
        return ResponseEntity.notFound().build();
      }

      // Permanently delete price snapshots
      jdbcTemplate.update(
          "DELETE FROM price_snapshots WHERE competitor_url_id = ?", Long.parseLong(id));

      // Permanently delete competitor
      jdbcTemplate.update("DELETE FROM competitor_urls WHERE id = ?", Long.parseLong(id));

      logger.info("Permanently deleted competitor {} for shop {}", id, shopId);
      return ResponseEntity.ok(
          Map.of("success", true, "message", "Competitor permanently deleted"));

    } catch (Exception e) {
      logger.error(
          "Error permanently deleting competitor {} for shop {}: {}",
          id,
          shopId,
          e.getMessage(),
          e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to permanently delete competitor"));
    }
  }

  @GetMapping("/competitors/{id}/price-history")
  public ResponseEntity<Map<String, Object>> getPriceHistory(
      @PathVariable String id,
      @RequestParam(defaultValue = "90") int days,
      HttpServletRequest request) {

    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      // Verify the competitor belongs to this shop
      List<Map<String, Object>> competitors =
          jdbcTemplate.queryForList(
              "SELECT id FROM competitor_urls WHERE id = ? AND shop_id = ? AND deleted_at IS NULL",
              Long.parseLong(id),
              shopId);

      if (competitors.isEmpty()) {
        return ResponseEntity.notFound().build();
      }

      String shopDomain = resolveShopDomain(shopId);

      // Try Redis cache first
      Optional<Object> cached =
          marketIntelligenceCacheService.getCachedPriceHistoryForCompetitor(
              shopDomain, Long.parseLong(id), days);
      if (cached.isPresent()) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> priceHistory = (List<Map<String, Object>>) cached.get();

        Map<String, Object> statistics =
            smartSnapshotService.getPriceStatistics(Long.parseLong(id));
        boolean hasSufficientHistory =
            smartSnapshotService.hasSufficientHistory(Long.parseLong(id), 7);

        return ResponseEntity.ok(
            Map.of(
                "priceHistory", priceHistory,
                "statistics", statistics,
                "hasSufficientHistory", hasSufficientHistory,
                "days", days,
                "cached", true));
      }

      // DB/Service fallback
      List<Map<String, Object>> priceHistory =
          smartSnapshotService.getPriceHistory(Long.parseLong(id), days);

      // Get price statistics
      Map<String, Object> statistics = smartSnapshotService.getPriceStatistics(Long.parseLong(id));

      // Check if there's sufficient history for graph overlay
      boolean hasSufficientHistory =
          smartSnapshotService.hasSufficientHistory(Long.parseLong(id), 7); // At least 7 days

      // Write-through to Redis
      marketIntelligenceCacheService.cachePriceHistoryForCompetitor(
          shopDomain, Long.parseLong(id), days, priceHistory);

      return ResponseEntity.ok(
          Map.of(
              "priceHistory", priceHistory,
              "statistics", statistics,
              "hasSufficientHistory", hasSufficientHistory,
              "days", days,
              "cached", false));

    } catch (Exception e) {
      logger.error("Error getting price history for competitor {}: {}", id, e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to retrieve price history"));
    }
  }

  /** Validate and fix price change calculations for a competitor */
  @PostMapping("/competitors/{id}/validate-price-changes")
  public ResponseEntity<Map<String, Object>> validatePriceChanges(
      @PathVariable String id, HttpServletRequest request) {

    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      // Check if competitor belongs to this shop
      List<Map<String, Object>> competitorCheck =
          jdbcTemplate.queryForList(
              "SELECT id FROM competitor_urls WHERE id = ? AND shop_id = ? AND deleted_at IS NULL",
              Long.parseLong(id),
              shopId);

      if (competitorCheck.isEmpty()) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", "Competitor not found"));
      }

      Long competitorId = Long.parseLong(id);

      // Validate and fix price changes
      priceChangeCalculationService.validateAndFixPriceChanges(competitorId);

      // Get updated statistics
      Map<String, Object> statistics =
          priceChangeCalculationService.getPriceChangeStatistics(competitorId);

      logger.info(
          "validatePriceChanges: Validated price changes for competitor {} for shop {}",
          id,
          shopId);

      return ResponseEntity.ok(
          Map.of("message", "Price changes validated and fixed", "statistics", statistics));

    } catch (Exception e) {
      logger.error("Error validating price changes: {}", e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to validate price changes"));
    }
  }

  /** Get price trend analysis for a competitor */
  @GetMapping("/competitors/{id}/price-trend")
  public ResponseEntity<Map<String, Object>> getPriceTrend(
      @PathVariable String id,
      @RequestParam(defaultValue = "30") int days,
      HttpServletRequest request) {

    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      // Check if competitor belongs to this shop
      List<Map<String, Object>> competitorCheck =
          jdbcTemplate.queryForList(
              "SELECT id FROM competitor_urls WHERE id = ? AND shop_id = ? AND deleted_at IS NULL",
              Long.parseLong(id),
              shopId);

      if (competitorCheck.isEmpty()) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", "Competitor not found"));
      }

      Long competitorId = Long.parseLong(id);
      String shopDomain = resolveShopDomain(shopId);

      // Try Redis first
      Optional<Object> cached =
          marketIntelligenceCacheService.getCachedPriceTrendForCompetitor(
              shopDomain, competitorId, days);
      if (cached.isPresent()) {
        @SuppressWarnings("unchecked")
        Map<String, Object> cachedTrend = (Map<String, Object>) cached.get();
        return ResponseEntity.ok(cachedTrend);
      }

      // Get price trend analysis
      String trend = priceChangeCalculationService.getPriceTrend(competitorId, days);
      Optional<BigDecimal> changeOverPeriod =
          priceChangeCalculationService.calculatePriceChangeOverPeriod(competitorId, days);

      Map<String, Object> response = new HashMap<>();
      response.put("trend", trend);
      response.put("days", days);

      if (changeOverPeriod.isPresent()) {
        response.put("changePercent", changeOverPeriod.get());
      } else {
        response.put("changePercent", null);
      }

      logger.info(
          "getPriceTrend: Retrieved price trend for competitor {} over {} days: {}",
          id,
          days,
          trend);

      // Write-through
      marketIntelligenceCacheService.cachePriceTrendForCompetitor(
          shopDomain, competitorId, days, response);
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error getting price trend: {}", e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to get price trend"));
    }
  }

  @GetMapping("/competitors/{id}/price-status")
  public ResponseEntity<Map<String, Object>> getPriceStatus(
      @PathVariable String id, HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      String shopDomain = resolveShopDomain(shopId);

      // Try Redis cache first (latest snapshot status)
      Optional<Object> cached =
          marketIntelligenceCacheService.getCachedPriceStatusForCompetitor(
              shopDomain, Long.parseLong(id));
      if (cached.isPresent()) {
        @SuppressWarnings("unchecked")
        Map<String, Object> snapshot = (Map<String, Object>) cached.get();
        return ResponseEntity.ok(snapshot);
      }

      // Check if competitor has any price snapshots
      List<Map<String, Object>> snapshots =
          jdbcTemplate.queryForList(
              "SELECT price, in_stock, checked_at FROM price_snapshots WHERE competitor_url_id = ? ORDER BY checked_at DESC LIMIT 1",
              Long.parseLong(id));

      if (!snapshots.isEmpty()) {
        Map<String, Object> snapshot = snapshots.get(0);
        Map<String, Object> response =
            Map.of(
                "hasPrice", true,
                "price", snapshot.get("price"),
                "inStock", snapshot.get("in_stock"),
                "lastChecked", snapshot.get("checked_at"));
        // Write-through
        marketIntelligenceCacheService.cachePriceStatusForCompetitor(
            shopDomain, Long.parseLong(id), response);
        return ResponseEntity.ok(response);
      } else {
        return ResponseEntity.ok(
            Map.of("hasPrice", false, "message", "Price tracking is being activated"));
      }
    } catch (Exception e) {
      logger.error(
          "getPriceStatus: Error checking price status for competitor {}: {}", id, e.getMessage());
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to check price status"));
    }
  }

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

  @GetMapping("/competitors/{id}/products")
  public ResponseEntity<Map<String, Object>> getAvailableProducts(
      @PathVariable String id,
      @RequestParam(defaultValue = "false") boolean isDemoMode,
      HttpServletRequest request) {

    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      logger.warn(
          "Authentication required for competitor products endpoint - competitor ID: {}", id);
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      // Get shop domain for cache lookup
      String shopDomain = getShopDomainFromId(shopId);
      if (shopDomain == null) {
        logger.error("Unable to determine shop domain for shop ID: {}", shopId);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of("error", "Unable to determine shop domain"));
      }

      logger.info(
          "Fetching available products for competitor {} in shop {} (demo mode: {})",
          id,
          shopDomain,
          isDemoMode);

      if (isDemoMode) {
        // Demo mode: provide demo products
        logger.info("Demo mode: Providing demo products for shop {}", shopDomain);
        List<Map<String, Object>> demoProducts =
            List.of(
                createDemoProduct("demo-product-1", "Demo Product 1", "demo-product-1", 29.99),
                createDemoProduct("demo-product-2", "Demo Product 2", "demo-product-2", 49.99),
                createDemoProduct("demo-product-3", "Demo Product 3", "demo-product-3", 79.99),
                createDemoProduct("demo-product-4", "Demo Product 4", "demo-product-4", 99.99),
                createDemoProduct("demo-product-5", "Demo Product 5", "demo-product-5", 129.99));

        return ResponseEntity.ok(Map.of("products", demoProducts));
      } else {
        // Live mode: Use the analytics products endpoint logic
        logger.info("Live mode: Using analytics products endpoint for shop {}", shopDomain);

        // Check Redis cache first
        var cachedProducts = dashboardCacheService.getCachedProductsData(shopDomain);
        if (cachedProducts.isPresent()) {
          logger.info("Cache hit for products data for shop: {}", shopDomain);
          return ResponseEntity.ok((Map<String, Object>) cachedProducts.get());
        }

        // Get the session token for Shopify API calls
        String sessionId = request.getSession().getId();
        String token = shopService.getTokenForShop(shopDomain, sessionId);

        if (token == null) {
          logger.error("No Shopify token available for shop: {}", shopDomain);
          return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(
                  Map.of("error", "Shopify authentication required. Please reconnect your store."));
        }

        // Use the same logic as analytics endpoint
        String url =
            String.format(
                "https://%s.myshopify.com/admin/api/2023-10/products.json?limit=50", shopDomain);

        try {
          WebClient webClient = WebClient.builder().build();
          Map<String, Object> shopifyResponse =
              webClient
                  .get()
                  .uri(url)
                  .header("X-Shopify-Access-Token", token)
                  .retrieve()
                  .bodyToMono(Map.class)
                  .block();

          if (shopifyResponse != null && shopifyResponse.containsKey("products")) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> shopifyProducts =
                (List<Map<String, Object>>) shopifyResponse.get("products");

            if (shopifyProducts != null && !shopifyProducts.isEmpty()) {
              logger.info(
                  "Successfully fetched {} products from Shopify for shop {}",
                  shopifyProducts.size(),
                  shopDomain);

              // Convert Shopify products to our format (same as analytics endpoint)
              List<Map<String, Object>> availableProducts = new ArrayList<>();
              for (Map<String, Object> product : shopifyProducts) {
                String productId = product.get("id").toString();
                String title = (String) product.get("title");
                String handle = (String) product.get("handle");

                // Get price from first variant
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> variants =
                    (List<Map<String, Object>>) product.get("variants");
                double price = 0.0;
                if (variants != null && !variants.isEmpty()) {
                  Object priceObj = variants.get(0).get("price");
                  if (priceObj != null) {
                    try {
                      price = Double.parseDouble(priceObj.toString());
                    } catch (NumberFormatException e) {
                      logger.warn("Invalid price format for product {}: {}", productId, priceObj);
                    }
                  }
                }

                Map<String, Object> productData = new HashMap<>();
                productData.put("id", productId);
                productData.put("title", title);
                productData.put("handle", handle);
                productData.put("price", price);
                availableProducts.add(productData);
              }

              // Cache the products data
              Map<String, Object> productsData = new HashMap<>();
              productsData.put("products", availableProducts);
              productsData.put("total_products", availableProducts.size());
              dashboardCacheService.cacheProductsData(shopDomain, productsData);

              logger.info(
                  "Successfully cached {} products for shop {}",
                  availableProducts.size(),
                  shopDomain);
              return ResponseEntity.ok(Map.of("products", availableProducts));
            } else {
              logger.warn("No products found in Shopify response for shop {}", shopDomain);
              return ResponseEntity.ok(Map.of("products", List.of()));
            }
          } else {
            logger.error("Invalid Shopify response for shop {}: {}", shopDomain, shopifyResponse);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed to fetch products from Shopify"));
          }
        } catch (Exception e) {
          logger.error(
              "Error fetching products from Shopify for shop {}: {}", shopDomain, e.getMessage());
          return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
              .body(
                  Map.of(
                      "error",
                      "Failed to connect to Shopify. Please check your connection and try again."));
        }
      }
    } catch (Exception e) {
      logger.error(
          "Error fetching products for competitor {} in shop {}: {}",
          id,
          shopId,
          e.getMessage(),
          e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to load products. Please try again."));
    }
  }

  public ResponseEntity<Map<String, Object>> debugTimestamps(HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);
    String shopDomain = shopId != null ? getShopDomainFromId(shopId) : null;

    Map<String, Object> debugInfo = new HashMap<>();
    debugInfo.put("shopId", shopId);
    debugInfo.put("shopDomain", shopDomain);

    if (shopId != null) {
      try {
        // Get raw timestamp data from database
        String query =
            """
            SELECT
                cu.id,
                cu.url,
                cu.created_at as competitor_created,
                cu.last_successful_check,
                ps.checked_at as latest_price_check,
                ps.price,
                ps.in_stock
            FROM competitor_urls cu
            LEFT JOIN (
                SELECT competitor_url_id, price, in_stock, checked_at,
                       ROW_NUMBER() OVER (PARTITION BY competitor_url_id ORDER BY checked_at DESC) as rn
                FROM price_snapshots
            ) ps ON cu.id = ps.competitor_url_id AND ps.rn = 1
            WHERE cu.shop_id = ?
            ORDER BY cu.created_at DESC
            """;

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(query, shopId);
        List<Map<String, Object>> timestampData = new ArrayList<>();

        for (Map<String, Object> row : rows) {
          Map<String, Object> competitorData = new HashMap<>();
          competitorData.put("id", row.get("id"));
          competitorData.put("url", row.get("url"));
          competitorData.put("competitor_created", row.get("competitor_created"));
          competitorData.put("last_successful_check", row.get("last_successful_check"));
          competitorData.put("latest_price_check", row.get("latest_price_check"));
          competitorData.put("price", row.get("price"));
          competitorData.put("in_stock", row.get("in_stock"));
          timestampData.add(competitorData);
        }

        debugInfo.put("competitors", timestampData);
        debugInfo.put("count", timestampData.size());

      } catch (Exception e) {
        debugInfo.put("error", e.getMessage());
        debugInfo.put("errorType", e.getClass().getSimpleName());
      }
    }

    return ResponseEntity.ok(debugInfo);
  }

  @PostMapping("/competitors/{id}/associate")
  @Transactional
  public ResponseEntity<Map<String, Object>> associateProduct(
      @PathVariable String id,
      @RequestBody Map<String, String> request,
      @RequestParam(defaultValue = "false") boolean isDemoMode,
      HttpServletRequest httpRequest) {

    Long shopId = getShopIdFromRequest(httpRequest);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    String productId = request.get("productId");
    if (productId == null || productId.trim().isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Product ID is required"));
    }

    try {
      // Verify competitor exists and belongs to this shop
      List<Map<String, Object>> competitorCheck =
          jdbcTemplate.queryForList(
              "SELECT id, url, shopify_product_id FROM competitor_urls WHERE id = ? AND shop_id = ?",
              id,
              shopId);

      if (competitorCheck.isEmpty()) {
        return ResponseEntity.notFound().build();
      }

      Map<String, Object> competitor = competitorCheck.get(0);
      String currentProductId =
          competitor.get("shopify_product_id") != null
              ? competitor.get("shopify_product_id").toString()
              : null;

      // Verify product exists in cache or is a demo product
      String shopDomain = getShopDomainFromId(shopId);
      var cachedProducts = dashboardCacheService.getCachedProductsData(shopDomain);

      boolean productExists = false;

      // Check if it's a demo product (only allowed in demo mode)
      if (productId.startsWith("demo-product-")) {
        if (isDemoMode) {
          productExists = true;
          logger.info("Demo mode: Associating competitor with demo product: {}", productId);
        } else {
          return ResponseEntity.badRequest()
              .body(Map.of("error", "Demo products are only available in demo mode"));
        }
      } else {
        // Check against cached products
        if (cachedProducts.isEmpty()) {
          return ResponseEntity.status(HttpStatus.PRECONDITION_REQUIRED)
              .body(Map.of("error", "Product cache not available. Please sync products first."));
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> productsData = (Map<String, Object>) cachedProducts.get();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> products =
            (List<Map<String, Object>>) productsData.get("products");

        productExists =
            products.stream().anyMatch(product -> productId.equals(product.get("id").toString()));
      }

      if (!productExists) {
        return ResponseEntity.badRequest()
            .body(Map.of("error", "Selected product not found in your store"));
      }

      // Update competitor with new product association
      int rowsAffected =
          jdbcTemplate.update(
              "UPDATE competitor_urls SET shopify_product_id = ? WHERE id = ? AND shop_id = ?",
              productId,
              id,
              shopId);

      if (rowsAffected == 0) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of("error", "Failed to update competitor association"));
      }

      // Log the association change
      String competitorUrl = competitor.get("url").toString();
      logger.info(
          "Competitor {} associated with product {} (was: {})",
          competitorUrl,
          productId,
          currentProductId);

      // Audit the association change
      competitorAuditService.logCompetitorUpdated(
          shopId,
          competitorUrl,
          Map.of(
              "action", "ASSOCIATE_PRODUCT",
              "old_product_id", currentProductId,
              "new_product_id", productId));

      return ResponseEntity.ok(
          Map.of(
              "success", true,
              "message", "Competitor successfully associated with product",
              "competitor_id", id,
              "product_id", productId,
              "previous_product_id", currentProductId));

    } catch (Exception e) {
      logger.error(
          "Error associating product {} with competitor {}: {}", productId, id, e.getMessage());
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to associate product with competitor"));
    }
  }

  @PostMapping("/competitors/{id}/disassociate")
  @Transactional
  public ResponseEntity<Map<String, Object>> disassociateProduct(
      @PathVariable String id,
      @RequestParam(defaultValue = "false") boolean isDemoMode,
      HttpServletRequest httpRequest) {

    Long shopId = getShopIdFromRequest(httpRequest);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      // Get current association
      List<Map<String, Object>> competitorCheck =
          jdbcTemplate.queryForList(
              "SELECT id, url, shopify_product_id FROM competitor_urls WHERE id = ? AND shop_id = ?",
              id,
              shopId);

      if (competitorCheck.isEmpty()) {
        return ResponseEntity.notFound().build();
      }

      Map<String, Object> competitor = competitorCheck.get(0);
      String currentProductId =
          competitor.get("shopify_product_id") != null
              ? competitor.get("shopify_product_id").toString()
              : null;

      if (currentProductId == null) {
        return ResponseEntity.badRequest()
            .body(Map.of("error", "Competitor is not currently associated with any product"));
      }

      // Remove association
      int rowsAffected =
          jdbcTemplate.update(
              "UPDATE competitor_urls SET shopify_product_id = NULL WHERE id = ? AND shop_id = ?",
              id,
              shopId);

      if (rowsAffected == 0) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of("error", "Failed to remove product association"));
      }

      // Log the disassociation
      String competitorUrl = competitor.get("url").toString();
      logger.info("Competitor {} disassociated from product {}", competitorUrl, currentProductId);

      // Audit the disassociation
      competitorAuditService.logCompetitorUpdated(
          shopId,
          competitorUrl,
          Map.of("action", "DISASSOCIATE_PRODUCT", "removed_product_id", currentProductId));

      return ResponseEntity.ok(
          Map.of(
              "success",
              true,
              "message",
              "Product association removed successfully",
              "competitor_id",
              id,
              "removed_product_id",
              currentProductId));

    } catch (Exception e) {
      logger.error("Error disassociating product from competitor {}: {}", id, e.getMessage());
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to remove product association"));
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
        || lowerHost.contains("opencart")
        || lowerHost.contains("bestbuy")
        || lowerHost.contains("target")
        || lowerHost.contains("walmart")) {
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
  /** Get shop domain from shop ID */
  private String getShopDomainFromId(Long shopId) {
    try {
      List<Map<String, Object>> shops =
          jdbcTemplate.queryForList("SELECT shopify_domain FROM shops WHERE id = ?", shopId);
      if (!shops.isEmpty()) {
        return (String) shops.get(0).get("shopify_domain");
      }
    } catch (Exception e) {
      logger.error("Error getting shop domain for shopId {}: {}", shopId, e.getMessage());
    }
    return null;
  }

  /** Enhanced method to extract product title from URL with HTML scraping */
  private String extractTitleFromUrl(String url) {
    if (url == null || url.trim().isEmpty()) {
      return "Unknown Competitor";
    }

    try {
      // First try to extract from HTML page title
      String htmlTitle = extractTitleFromHtml(url);
      if (htmlTitle != null
          && !htmlTitle.trim().isEmpty()
          && !htmlTitle.equals("Unknown Competitor")) {
        return htmlTitle;
      }

      // Fallback to domain-based extraction
      String domain = url.replaceAll("https?://", "").replaceAll("/.*", "");
      if (domain.startsWith("www.")) {
        domain = domain.substring(4);
      }
      return domain;
    } catch (Exception e) {
      logger.debug("extractTitleFromUrl: Error extracting title from {}: {}", url, e.getMessage());
      return "Unknown Competitor";
    }
  }

  /** Extract product title from HTML page */
  private String extractTitleFromHtml(String url) {
    try {
      // Use Jsoup to fetch and parse the page
      org.jsoup.nodes.Document doc =
          org.jsoup.Jsoup.connect(url)
              .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
              .timeout(5000)
              .followRedirects(true)
              .get();

      // Try multiple selectors for product titles
      String title = null;

      // 1. Try meta title first
      title = doc.select("meta[property=og:title]").attr("content");
      if (title != null && !title.trim().isEmpty()) {
        return cleanTitle(title);
      }

      // 2. Try page title
      title = doc.title();
      if (title != null && !title.trim().isEmpty() && !title.equals("Unknown")) {
        return cleanTitle(title);
      }

      // 3. Try product-specific selectors
      title = extractProductTitleFromSelectors(doc, url);
      if (title != null && !title.trim().isEmpty()) {
        return cleanTitle(title);
      }

      return null;
    } catch (Exception e) {
      logger.debug("extractTitleFromHtml: Error fetching title from {}: {}", url, e.getMessage());
      return null;
    }
  }

  /** Extract product title using platform-specific selectors */
  private String extractProductTitleFromSelectors(org.jsoup.nodes.Document doc, String url) {
    try {
      String title = null;

      if (url.contains("amazon.com")) {
        // Amazon-specific selectors
        title = doc.select("#productTitle").text();
        if (title.isEmpty()) {
          title = doc.select("h1.a-size-large").text();
        }
        if (title.isEmpty()) {
          title = doc.select("[data-automation-id=product-title]").text();
        }
      } else if (url.contains("shopify.com") || url.contains("myshopify.com")) {
        // Shopify-specific selectors
        title = doc.select("h1.product-single__title").text();
        if (title.isEmpty()) {
          title = doc.select(".product__title h1").text();
        }
        if (title.isEmpty()) {
          title = doc.select("h1.product__title").text();
        }
        if (title.isEmpty()) {
          title = doc.select(".product-title h1").text();
        }
      } else if (url.contains("etsy.com")) {
        // Etsy-specific selectors
        title = doc.select("h1[data-testid=listing-page-title]").text();
        if (title.isEmpty()) {
          title = doc.select("h1.wt-text-heading-01").text();
        }
        if (title.isEmpty()) {
          title = doc.select(".listing-page-title h1").text();
        }
        if (title.isEmpty()) {
          title = doc.select("h1[class*=title]").text();
        }
        if (title.isEmpty()) {
          title = doc.select(".listing-page-title").text();
        }
      } else {
        // Generic product selectors
        title = doc.select("h1.product-title").text();
        if (title.isEmpty()) {
          title = doc.select(".product-title").text();
        }
        if (title.isEmpty()) {
          title = doc.select("h1[class*=product]").text();
        }
        if (title.isEmpty()) {
          title = doc.select("h1[class*=title]").text();
        }
      }

      return title;
    } catch (Exception e) {
      logger.debug("extractProductTitleFromSelectors: Error extracting title: {}", e.getMessage());
      return null;
    }
  }

  /** Clean and format the extracted title with improved formatting */
  private String cleanTitle(String title) {
    if (title == null || title.trim().isEmpty()) {
      return null;
    }

    // Remove common suffixes and prefixes
    title = title.replaceAll("\\|.*$", "").trim(); // Remove everything after |
    title = title.replaceAll("^.*\\|", "").trim(); // Remove everything before |
    title = title.replaceAll("\\s+", " ").trim(); // Normalize whitespace

    // Remove common store names from title
    String[] storeNames = {"amazon", "shopify", "etsy", "ebay", "walmart", "target", "bestbuy"};
    for (String store : storeNames) {
      title = title.replaceAll("(?i)\\b" + store + "\\b", "").trim();
    }

    // Apply intelligent formatting
    title = formatProductTitle(title);

    // Limit length to 60 characters for better UI display
    if (title.length() > 60) {
      title = title.substring(0, 57) + "...";
    }

    return title.isEmpty() ? null : title;
  }

  /** Format product title with intelligent capitalization and structure */
  private String formatProductTitle(String title) {
    if (title == null || title.trim().isEmpty()) {
      return title;
    }

    // Split into words and apply intelligent capitalization
    String[] words = title.split("\\s+");
    StringBuilder formatted = new StringBuilder();

    for (int i = 0; i < words.length; i++) {
      String word = words[i].toLowerCase();

      // Skip empty words
      if (word.isEmpty()) continue;

      // Capitalize first letter of each word
      if (word.length() > 0) {
        word = word.substring(0, 1).toUpperCase() + word.substring(1);
      }

      // Special handling for common product terms
      word = formatProductTerm(word);

      formatted.append(word);
      if (i < words.length - 1) {
        formatted.append(" ");
      }
    }

    return formatted.toString().trim();
  }

  /** Format common product terms for better readability */
  private String formatProductTerm(String word) {
    // Common product specifications that should be uppercase
    String[] uppercaseTerms = {
      "gb",
      "tb",
      "mb",
      "gb",
      "tb",
      "mb",
      "gb",
      "tb",
      "mb",
      "gb",
      "tb",
      "mb",
      "hd",
      "4k",
      "8k",
      "1080p",
      "720p",
      "wifi",
      "bluetooth",
      "usb",
      "hdmi",
      "vga",
      "dvi",
      "dp",
      "thunderbolt",
      "lightning",
      "type-c",
      "type-c",
      "oled",
      "lcd",
      "led",
      "ips",
      "va",
      "tn",
      "amd",
      "intel",
      "nvidia",
      "apple",
      "samsung",
      "sony",
      "lg",
      "dell",
      "hp",
      "lenovo",
      "asus",
      "acer",
      "msi",
      "gigabyte",
      "corsair",
      "logitech",
      "razer",
      "steelseries"
    };

    // Common words that should remain lowercase
    String[] lowercaseTerms = {
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
      "from", "up", "about", "into", "through", "during", "before", "after", "above", "below",
      "between", "among", "within", "without", "against", "toward", "towards", "upon", "over",
      "under", "inch", "inches", "foot", "feet", "cm", "mm", "kg", "lb", "lbs"
    };

    String lowerWord = word.toLowerCase();

    // Check for uppercase terms
    for (String term : uppercaseTerms) {
      if (lowerWord.equals(term)) {
        return word.toUpperCase();
      }
    }

    // Check for lowercase terms (except first word)
    for (String term : lowercaseTerms) {
      if (lowerWord.equals(term)) {
        return word.toLowerCase();
      }
    }

    return word;
  }

  /** Helper method to extract Amazon product title from URL */
  private String extractAmazonTitle(String url) {
    try {
      // Enhanced URL-based extraction for Amazon
      if (url.contains("/dp/")) {
        String productId = url.split("/dp/")[1].split("/")[0];
        // Try to extract product name from URL path
        String[] urlParts = url.split("/dp/" + productId);
        if (urlParts.length > 0 && urlParts[0].contains("/")) {
          String pathPart = urlParts[0].substring(urlParts[0].lastIndexOf("/") + 1);
          if (!pathPart.isEmpty()
              && !pathPart.equals("www.amazon.com")
              && !pathPart.equals("amazon.com")) {
            String productName = pathPart.replace("-", " ").replace("_", " ");
            return cleanTitle(productName);
          }
        }
        return "Amazon Product " + productId;
      } else if (url.contains("/gp/product/")) {
        String productId = url.split("/gp/product/")[1].split("/")[0];
        return "Amazon Product " + productId;
      } else if (url.contains("/gp/buyagain/")) {
        return "Amazon Buy Again";
      } else if (url.contains("/s?")) {
        return "Amazon Search Results";
      } else if (url.contains("/b/")) {
        return "Amazon Brand Page";
      } else if (url.contains("/gp/offer-listing/")) {
        return "Amazon Offers";
      } else {
        return "Amazon Page";
      }
    } catch (Exception e) {
      logger.debug("extractAmazonTitle: Error extracting title from URL: {}", e.getMessage());
      return "Amazon Product";
    }
  }

  /** Helper method to extract Shopify product title from URL */
  private String extractShopifyTitle(String url) {
    try {
      // URL slug extraction for Shopify
      if (url.contains("/products/")) {
        String[] parts = url.split("/products/");
        if (parts.length > 1) {
          String productSlug = parts[1].split("\\?")[0].split("/")[0];
          return cleanTitle(productSlug.replace("-", " ").replace("_", " "));
        }
      }
      return extractTitleFromUrl(url);
    } catch (Exception e) {
      logger.debug("extractShopifyTitle: Error extracting title from URL: {}", e.getMessage());
      return extractTitleFromUrl(url);
    }
  }

  /** Helper method to extract Best Buy product title from URL with intelligent formatting */
  private String extractBestBuyTitle(String url) {
    try {
      // URL slug extraction for Best Buy
      // Example:
      // https://www.bestbuy.com/site/apple-macbook-air-13-inch-laptop-apple-m4-chip-built-for-apple-intelligence-16gb-memory-256gb-ssd-midnight/6565862.p?skuId=6565862
      if (url.contains("/site/")) {
        String[] parts = url.split("/site/");
        if (parts.length > 1) {
          String productPath = parts[1].split("\\?")[0];
          // Remove SKU and convert to title case
          String productName = productPath.split("/")[0];

          // Extract key product information more intelligently
          String formattedTitle = formatBestBuyTitle(productName);
          return cleanTitle(formattedTitle);
        }
      }
      return extractTitleFromUrl(url);
    } catch (Exception e) {
      logger.debug("extractBestBuyTitle: Error extracting title from URL: {}", e.getMessage());
      return extractTitleFromUrl(url);
    }
  }

  /** Format Best Buy product title to extract key information */
  private String formatBestBuyTitle(String productName) {
    if (productName == null || productName.trim().isEmpty()) {
      return productName;
    }

    // Replace hyphens with spaces
    String title = productName.replace("-", " ").replace("_", " ");

    // Extract key product components
    String[] words = title.split("\\s+");
    StringBuilder keyInfo = new StringBuilder();

    // Common product patterns to prioritize
    String[] priorityTerms = {
      "macbook",
      "air",
      "pro",
      "laptop",
      "computer",
      "desktop",
      "tablet",
      "phone",
      "iphone",
      "ipad",
      "apple",
      "samsung",
      "sony",
      "lg",
      "dell",
      "hp",
      "lenovo",
      "tv",
      "television",
      "monitor",
      "display",
      "speaker",
      "headphone",
      "camera",
      "gaming",
      "console",
      "playstation",
      "xbox",
      "nintendo",
      "switch"
    };

    // Build title with priority terms first
    for (String word : words) {
      String lowerWord = word.toLowerCase();

      // Check if this is a priority term
      boolean isPriority = false;
      for (String term : priorityTerms) {
        if (lowerWord.contains(term) || term.contains(lowerWord)) {
          isPriority = true;
          break;
        }
      }

      if (isPriority) {
        if (keyInfo.length() > 0) keyInfo.append(" ");
        keyInfo.append(word);
      }
    }

    // If we found priority terms, use them; otherwise use the full title
    if (keyInfo.length() > 0) {
      return keyInfo.toString();
    } else {
      return title;
    }
  }

  /** Helper method to extract Walmart product title from URL */
  private String extractWalmartTitle(String url) {
    try {
      // URL slug extraction for Walmart
      // Example: https://www.walmart.com/ip/apple-macbook-air-13-inch-laptop/12345678
      if (url.contains("/ip/")) {
        String[] parts = url.split("/ip/");
        if (parts.length > 1) {
          String productPath = parts[1].split("\\?")[0];
          // Remove product ID and convert to title case
          String productName = productPath.split("/")[0];
          return cleanTitle(productName.replace("-", " ").replace("_", " "));
        }
      }
      return extractTitleFromUrl(url);
    } catch (Exception e) {
      logger.debug("extractWalmartTitle: Error extracting title from URL: {}", e.getMessage());
      return extractTitleFromUrl(url);
    }
  }

  /** Helper method to extract Target product title from URL with enhanced parsing */
  private String extractTargetTitle(String url) {
    try {
      // URL slug extraction for Target
      // Examples:
      // https://www.target.com/p/apple-macbook-air-13-inch-laptop/-/A-12345678
      // https://www.target.com/p/viva-signature-cloth-choose-a-sheet-paper-towels/-/A-83372436?preselect=87450171#lnk=sametab
      if (url.contains("/p/")) {
        String[] parts = url.split("/p/");
        if (parts.length > 1) {
          String productPath = parts[1].split("\\?")[0]; // Remove query parameters
          productPath = productPath.split("#")[0]; // Remove hash fragments

          // Handle complex Target URL structure
          String[] pathSegments = productPath.split("/");
          if (pathSegments.length > 0) {
            // Get the first segment which contains the product name
            String productName = pathSegments[0];

            // If the product name is very long, try to extract key information
            if (productName.length() > 50) {
              return cleanTitle(formatTargetTitle(productName));
            } else {
              return cleanTitle(productName.replace("-", " ").replace("_", " "));
            }
          }
        }
      }
      return extractTitleFromUrl(url);
    } catch (Exception e) {
      logger.debug("extractTargetTitle: Error extracting title from URL: {}", e.getMessage());
      return extractTitleFromUrl(url);
    }
  }

  /** Format Target product title to extract key information */
  private String formatTargetTitle(String productName) {
    if (productName == null || productName.trim().isEmpty()) {
      return productName;
    }

    // Replace hyphens with spaces
    String title = productName.replace("-", " ").replace("_", " ");

    // Extract key product components
    String[] words = title.split("\\s+");
    StringBuilder keyInfo = new StringBuilder();

    // Common Target product patterns to prioritize
    String[] priorityTerms = {
      "viva",
      "signature",
      "cloth",
      "paper",
      "towels",
      "towel",
      "napkins",
      "napkin",
      "tissue",
      "toilet",
      "bathroom",
      "kitchen",
      "cleaning",
      "household",
      "essentials",
      "electronics",
      "clothing",
      "shoes",
      "accessories",
      "home",
      "garden",
      "toys",
      "baby",
      "beauty",
      "health",
      "pharmacy",
      "grocery",
      "food",
      "beverages",
      "sports",
      "outdoors",
      "automotive",
      "office",
      "school",
      "party",
      "holiday"
    };

    // Build title with priority terms first
    for (String word : words) {
      String lowerWord = word.toLowerCase();

      // Check if this is a priority term
      boolean isPriority = false;
      for (String term : priorityTerms) {
        if (lowerWord.contains(term) || term.contains(lowerWord)) {
          isPriority = true;
          break;
        }
      }

      if (isPriority) {
        if (keyInfo.length() > 0) keyInfo.append(" ");
        keyInfo.append(word);
      }
    }

    // If we found priority terms, use them; otherwise use the full title
    if (keyInfo.length() > 0) {
      return keyInfo.toString();
    } else {
      return title;
    }
  }

  /** Helper method to extract eBay product title from URL with enhanced parsing */
  private String extractEbayTitle(String url) {
    try {
      // Enhanced URL slug extraction for eBay
      // Examples:
      // https://www.ebay.com/itm/apple-macbook-air-13-inch-laptop/123456789012
      // https://www.ebay.com/itm/iphone-14-pro-max-256gb-unlocked/123456789012
      // https://www.ebay.com/itm/samsung-galaxy-s23-ultra-5g-512gb/123456789012
      if (url.contains("/itm/")) {
        String[] parts = url.split("/itm/");
        if (parts.length > 1) {
          String productPath = parts[1].split("\\?")[0]; // Remove query parameters
          productPath = productPath.split("#")[0]; // Remove hash fragments

          // Enhanced parsing to handle numbers in product names
          String productName = extractEbayProductName(productPath);
          return cleanTitle(productName);
        }
      }
      return extractTitleFromUrl(url);
    } catch (Exception e) {
      logger.debug("extractEbayTitle: Error extracting title from URL: {}", e.getMessage());
      return extractTitleFromUrl(url);
    }
  }

  /** Enhanced method to extract eBay product name from URL path */
  private String extractEbayProductName(String productPath) {
    if (productPath == null || productPath.trim().isEmpty()) {
      return "eBay Product";
    }

    // Split by forward slash to get path segments
    String[] segments = productPath.split("/");
    if (segments.length == 0) {
      return "eBay Product";
    }

    // Get the first segment which contains the product name
    String productSegment = segments[0];

    // Enhanced parsing to handle numbers and special characters
    String cleanedName = formatEbayProductName(productSegment);

    return cleanedName;
  }

  /** Helper method to extract Etsy product title from URL with enhanced parsing */
  private String extractEtsyTitle(String url) {
    try {
      // Enhanced URL slug extraction for Etsy
      // Examples:
      // https://www.etsy.com/listing/1716334357/linen-fabric-stella-pink-red-gingham-2cm
      // https://www.etsy.com/listing/1234567890/handmade-jewelry-necklace
      if (url.contains("/listing/")) {
        String[] parts = url.split("/listing/");
        if (parts.length > 1) {
          String productPath = parts[1].split("\\?")[0]; // Remove query parameters
          productPath = productPath.split("#")[0]; // Remove hash fragments

          // Enhanced parsing to handle Etsy listing format
          String productName = extractEtsyProductName(productPath);
          return cleanTitle(productName);
        }
      }
      return extractTitleFromUrl(url);
    } catch (Exception e) {
      logger.debug("extractEtsyTitle: Error extracting title from URL: {}", e.getMessage());
      return extractTitleFromUrl(url);
    }
  }

  /** Enhanced method to extract Etsy product name from URL path */
  private String extractEtsyProductName(String productPath) {
    if (productPath == null || productPath.trim().isEmpty()) {
      return "Etsy Product";
    }

    // Split by forward slash to get path segments
    String[] segments = productPath.split("/");
    if (segments.length == 0) {
      return "Etsy Product";
    }

    // Etsy URLs have format: listing_id/product-name-slug
    // We want the product name slug (second part)
    if (segments.length >= 2) {
      String productSegment = segments[1];
      return formatEtsyProductName(productSegment);
    } else if (segments.length == 1) {
      // Fallback: if only one segment, it might be the product name
      String productSegment = segments[0];
      return formatEtsyProductName(productSegment);
    }

    return "Etsy Product";
  }

  /** Format Etsy product name with intelligent parsing */
  private String formatEtsyProductName(String productSegment) {
    if (productSegment == null || productSegment.trim().isEmpty()) {
      return "Etsy Product";
    }

    // Remove any listing ID if it's numeric
    String[] parts = productSegment.split("-");
    StringBuilder formattedTitle = new StringBuilder();
    boolean foundNonNumeric = false;

    for (String part : parts) {
      // Skip purely numeric parts (likely listing IDs)
      if (part.matches("^\\d+$")) {
        continue;
      }

      // Skip very short parts (likely not meaningful)
      if (part.length() < 2) {
        continue;
      }

      // Add meaningful parts to the title
      if (formattedTitle.length() > 0) {
        formattedTitle.append(" ");
      }
      formattedTitle.append(formatProductTerm(part));
      foundNonNumeric = true;
    }

    // If we found meaningful content, use it; otherwise use a simplified version
    if (formattedTitle.length() > 0 && foundNonNumeric) {
      return formattedTitle.toString();
    } else {
      // Fallback: use first few meaningful words
      String[] meaningfulWords = productSegment.split("[-\\s]+");
      StringBuilder fallback = new StringBuilder();
      int wordCount = 0;

      for (String word : meaningfulWords) {
        if (word.length() > 2 && !word.matches("^\\d+$") && wordCount < 5) {
          if (fallback.length() > 0) fallback.append(" ");
          fallback.append(word);
          wordCount++;
        }
      }

      return fallback.length() > 0 ? fallback.toString() : "Etsy Product";
    }
  }

  /** Format eBay product name with intelligent parsing */
  private String formatEbayProductName(String productSegment) {
    if (productSegment == null || productSegment.trim().isEmpty()) {
      return "eBay Product";
    }

    // Replace hyphens and underscores with spaces
    String title = productSegment.replace("-", " ").replace("_", " ");

    // Split into words for intelligent processing
    String[] words = title.split("\\s+");
    StringBuilder formattedTitle = new StringBuilder();

    // Common eBay product patterns to prioritize
    String[] priorityTerms = {
      "iphone",
      "ipad",
      "macbook",
      "air",
      "pro",
      "max",
      "mini",
      "apple",
      "samsung",
      "galaxy",
      "ultra",
      "plus",
      "note",
      "fold",
      "flip",
      "sony",
      "lg",
      "motorola",
      "google",
      "pixel",
      "oneplus",
      "xiaomi",
      "huawei",
      "oppo",
      "vivo",
      "realme",
      "laptop",
      "computer",
      "desktop",
      "tablet",
      "phone",
      "smartphone",
      "mobile",
      "tv",
      "television",
      "monitor",
      "display",
      "speaker",
      "headphone",
      "earbuds",
      "camera",
      "lens",
      "gaming",
      "console",
      "playstation",
      "xbox",
      "nintendo",
      "switch",
      "controller",
      "accessory",
      "case",
      "cover",
      "protector",
      "charger",
      "cable",
      "adapter",
      "dock",
      "stand",
      "keyboard",
      "mouse",
      "trackpad",
      "stylus"
    };

    // Build title with intelligent word selection
    for (int i = 0; i < words.length; i++) {
      String word = words[i].toLowerCase();

      // Skip very short words (likely noise)
      if (word.length() < 2) continue;

      // Skip pure numbers unless they're part of a product name (like iPhone 14)
      if (word.matches("^\\d+$")) {
        // Check if previous word is a product term
        if (i > 0) {
          String prevWord = words[i - 1].toLowerCase();
          boolean isProductNumber = false;
          for (String term : priorityTerms) {
            if (prevWord.contains(term) || term.contains(prevWord)) {
              isProductNumber = true;
              break;
            }
          }
          if (isProductNumber) {
            if (formattedTitle.length() > 0) formattedTitle.append(" ");
            formattedTitle.append(words[i]); // Keep the number
          }
        }
        continue;
      }

      // Check if this is a priority term
      boolean isPriority = false;
      for (String term : priorityTerms) {
        if (word.contains(term) || term.contains(word)) {
          isPriority = true;
          break;
        }
      }

      // Include priority terms and meaningful words
      if (isPriority || word.length() > 3) {
        if (formattedTitle.length() > 0) formattedTitle.append(" ");
        formattedTitle.append(words[i]);
      }
    }

    // If we found meaningful content, use it; otherwise use a simplified version
    if (formattedTitle.length() > 0) {
      return formattedTitle.toString();
    } else {
      // Fallback: use first few meaningful words
      String[] meaningfulWords = title.split("\\s+");
      StringBuilder fallback = new StringBuilder();
      int wordCount = 0;

      for (String word : meaningfulWords) {
        if (word.length() > 2 && !word.matches("^\\d+$") && wordCount < 5) {
          if (fallback.length() > 0) fallback.append(" ");
          fallback.append(word);
          wordCount++;
        }
      }

      return fallback.length() > 0 ? fallback.toString() : "eBay Product";
    }
  }

  /** Enhanced method to extract title by platform */
  private String extractTitleByPlatform(String url) {
    try {
      String lowerUrl = url.toLowerCase();

      if (lowerUrl.contains("amazon.com")) {
        return extractAmazonTitle(url);
      } else if (lowerUrl.contains("bestbuy.com")) {
        return extractBestBuyTitle(url);
      } else if (lowerUrl.contains("walmart.com")) {
        return extractWalmartTitle(url);
      } else if (lowerUrl.contains("target.com")) {
        return extractTargetTitle(url);
      } else if (lowerUrl.contains("ebay.com")) {
        return extractEbayTitle(url);
      } else if (lowerUrl.contains("etsy.com")) {
        return extractEtsyTitle(url);
      } else if (lowerUrl.contains("shopify") || lowerUrl.contains("myshopify.com")) {
        return extractShopifyTitle(url);
      } else {
        // Generic fallback
        return extractTitleFromUrl(url);
      }
    } catch (Exception e) {
      logger.debug("extractTitleByPlatform: Error extracting title from URL: {}", e.getMessage());
      return extractTitleFromUrl(url);
    }
  }

  /** Start background price scraping without blocking the response */
  private void startBackgroundPriceScraping(String competitorId, String url, Long shopId) {
    // Use CompletableFuture to run scraping in background
    java.util.concurrent.CompletableFuture.runAsync(
        () -> {
          try {
            logger.info(
                "startBackgroundPriceScraping: Starting background scraping for competitor ID: {}",
                competitorId);

            // Add a small delay to ensure the competitor is fully saved
            Thread.sleep(1000);

            // Use the existing scraping logic but in background
            triggerImmediatePriceScraping(competitorId, url, shopId);

            logger.info(
                "startBackgroundPriceScraping: Completed background scraping for competitor ID: {}",
                competitorId);
          } catch (Exception e) {
            logger.warn(
                "startBackgroundPriceScraping: Background scraping failed for competitor ID {}: {}",
                competitorId,
                e.getMessage());
          }
        });
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
    public String shopifyProductId;
    public String productTitle;
    public boolean showingOldPrice;

    public CompetitorDto(
        String id,
        String url,
        String label,
        double price,
        boolean inStock,
        double percentDiff,
        String lastChecked,
        String shopifyProductId,
        String productTitle,
        boolean showingOldPrice) {
      this.id = id;
      this.url = url;
      this.label = label;
      this.price = price;
      this.inStock = inStock;
      this.percentDiff = percentDiff;
      this.lastChecked = lastChecked;
      this.shopifyProductId = shopifyProductId;
      this.productTitle = productTitle;
      this.showingOldPrice = showingOldPrice;
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
  /** Trigger immediate price scraping for a newly added competitor with COST OPTIMIZATION */
  private void triggerImmediatePriceScraping(String competitorId, String url, Long shopId) {
    try {
      logger.info(
          "triggerImmediatePriceScraping: Starting ENTERPRISE-GRADE immediate scraping for competitor ID: {}",
          competitorId);

      // COST OPTIMIZATION 0: Check if recent successful check exists (< 24 hours) - CRITICAL FIX
      List<Map<String, Object>> competitorData =
          jdbcTemplate.queryForList(
              """
          SELECT last_successful_check FROM competitor_urls
          WHERE id = ?
          """,
              Long.parseLong(competitorId));

      if (!competitorData.isEmpty()) {
        Object lastSuccessfulCheckObj = competitorData.get(0).get("last_successful_check");
        if (lastSuccessfulCheckObj != null) {
          try {
            java.time.LocalDateTime lastSuccessfulCheck =
                (java.time.LocalDateTime) lastSuccessfulCheckObj;
            java.time.LocalDateTime now = java.time.LocalDateTime.now();
            java.time.Duration duration = java.time.Duration.between(lastSuccessfulCheck, now);

            // Skip scraping if last successful check was less than 24 hours ago
            if (duration.toHours() < 24) {
              logger.info(
                  "triggerImmediatePriceScraping: Skipping - Recent successful check exists ({} hours ago) for competitor {}",
                  duration.toHours(),
                  competitorId);
              return; // Skip scraping if recent successful check exists
            }
          } catch (Exception e) {
            logger.warn(
                "triggerImmediatePriceScraping: Could not parse last successful check time: {}",
                lastSuccessfulCheckObj);
            // Continue with scraping if we can't parse the timestamp
          }
        }
      }

      // COST OPTIMIZATION 1: Check if we recently scraped this URL (within last 2 hours)
      String domain = extractDomain(url);
      String recentScrapeKey = "mi:recent_scrape:" + domain + ":" + url.hashCode();

      if (redisTemplate.hasKey(recentScrapeKey)) {
        logger.info("triggerImmediatePriceScraping: Skipping - URL scraped recently: {}", url);
        return; // Skip if we scraped this URL recently
      }

      // COST OPTIMIZATION 2: Check rate limiting with longer delays
      String rateLimitKey = "mi:scraper_rate_limit:" + domain;
      if (redisTemplate.hasKey(rateLimitKey)) {
        logger.debug("triggerImmediatePriceScraping: Rate limit active for domain: {}", domain);
        return; // Skip immediate scraping if rate limited
      }

      // COST OPTIMIZATION 3: Longer rate limiting delays to reduce costs
      int immediateScrapingDelay = 5000; // 5 seconds delay (reduced from 500ms)
      redisTemplate
          .opsForValue()
          .set(rateLimitKey, "1", immediateScrapingDelay, TimeUnit.MILLISECONDS);

      // Check if scraping is allowed and within limits
      if (!isScrapingAllowed(shopId)) {
        logger.debug("triggerImmediatePriceScraping: Scraping not allowed for shop {}", shopId);
        return;
      }

      // COST OPTIMIZATION 4: Use cached price if available (fallback to scraping)
      java.math.BigDecimal cachedPrice = getCachedPriceForUrl(url);
      if (cachedPrice != null) {
        logger.info(
            "triggerImmediatePriceScraping: Using cached price ${} for competitor {}",
            cachedPrice,
            competitorId);

        // Store cached price as initial snapshot
        jdbcTemplate.update(
            "INSERT INTO price_snapshots (competitor_url_id, price, in_stock, checked_at, scraper_version, scraper_source) "
                + "VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'v2.0-cached', 'cached')",
            Long.parseLong(competitorId),
            cachedPrice,
            true); // Assume in stock for cached data

        // Update competitor URL status on successful cached scrape with platform and domain info
        String platform = identifyPlatform(url);
        jdbcTemplate.update(
            "UPDATE competitor_urls SET status = 'active', last_successful_check = CURRENT_TIMESTAMP, error_count = 0, platform = ?, domain = ? WHERE id = ?",
            platform,
            domain,
            Long.parseLong(competitorId));

        // Mark as recently scraped to prevent immediate re-scraping
        redisTemplate.opsForValue().set(recentScrapeKey, "1", 2, TimeUnit.HOURS);
        return;
      }

      // NEW: Use PriceScrapingService for reliable 4-tier scraping
      try {
        long startTime = System.currentTimeMillis();

        // Use the new unified PriceScrapingService with API fallbacks
        PriceScrapingService.PriceScrapingResult result =
            priceScrapingService.scrapePriceWithMultiTier(url);

        long totalTime = System.currentTimeMillis() - startTime;

        if (result.isSuccess()) {
          logger.info(
              "triggerImmediatePriceScraping: SUCCESS - Price ${} extracted via {} ({}ms)",
              result.getPrice(),
              result.getScraperSource(),
              result.getResponseTime());

          // Store snapshot with proper data handling (same as CompetitorScraperWorker)
          jdbcTemplate.update(
              "INSERT INTO price_snapshots (competitor_url_id, price, in_stock, price_change_percent, significant_change, checked_at, scraper_version, platform, response_time_ms, scraper_source) "
                  + "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)",
              Long.parseLong(competitorId),
              result.getPrice(),
              result.isInStock(),
              null, // Will calculate this after insertion
              false, // Will update this after calculation
              "v2.0-unified",
              result.getPlatform(),
              (int) result.getResponseTime(),
              result.getScraperSource());

          // Get the ID of the newly inserted snapshot
          Long snapshotId = jdbcTemplate.queryForObject("SELECT LASTVAL()", Long.class);

          // Calculate price change percentage using the enhanced service
          if (result.getPrice() != null) {
            Optional<BigDecimal> calculatedChange =
                priceChangeCalculationService.calculatePriceChangePercent(
                    Long.parseLong(competitorId), result.getPrice());
            if (calculatedChange.isPresent()) {
              BigDecimal priceChangePercent = calculatedChange.get();
              boolean significantChange =
                  priceChangeCalculationService.isSignificantPriceChange(
                      priceChangePercent, BigDecimal.valueOf(5));

              // Update the snapshot with the calculated percentage
              jdbcTemplate.update(
                  "UPDATE price_snapshots SET price_change_percent = ?, significant_change = ? WHERE id = ?",
                  priceChangePercent,
                  significantChange,
                  snapshotId);

              logger.info(
                  "triggerImmediatePriceScraping: Calculated and updated price change for competitor {}: {}% (significant: {})",
                  competitorId, priceChangePercent, significantChange);
            }
          }

          logger.info(
              "triggerImmediatePriceScraping: Created snapshot for competitor {} with platform: {}, response_time: {}ms",
              competitorId,
              result.getPlatform(),
              result.getResponseTime());

          // Update competitor URL status on successful scrape with platform and domain info
          String platform = identifyPlatform(url);
          jdbcTemplate.update(
              "UPDATE competitor_urls SET status = 'active', last_successful_check = CURRENT_TIMESTAMP, error_count = 0, platform = ?, domain = ? WHERE id = ?",
              platform,
              domain,
              Long.parseLong(competitorId));

          // Mark as recently scraped to prevent immediate re-scraping
          redisTemplate.opsForValue().set(recentScrapeKey, "1", 2, TimeUnit.HOURS);

        } else {
          logger.warn(
              "triggerImmediatePriceScraping: FAILED - {} ({}ms) for competitor {}",
              result.getFailureReason(),
              totalTime,
              competitorId);

          // Update competitor URL status on failed scrape with more detailed logging
          try {
            int updatedRows =
                jdbcTemplate.update(
                    "UPDATE competitor_urls SET status = 'error', error_count = error_count + 1 WHERE id = ?",
                    Long.parseLong(competitorId));
            logger.info(
                "triggerImmediatePriceScraping: Updated competitor {} error status - {} rows affected",
                competitorId,
                updatedRows);
          } catch (Exception dbError) {
            logger.error(
                "triggerImmediatePriceScraping: Failed to update error status for competitor {}: {}",
                competitorId,
                dbError.getMessage());
          }
        }

      } catch (Exception e) {
        logger.error(
            "triggerImmediatePriceScraping: Exception during unified scraping for competitor {}: {}",
            competitorId,
            e.getMessage());

        // Update competitor URL status on exception
        jdbcTemplate.update(
            "UPDATE competitor_urls SET status = 'error', error_count = error_count + 1 WHERE id = ?",
            Long.parseLong(competitorId));
      }

    } catch (Exception e) {
      logger.error(
          "triggerImmediatePriceScraping: Critical error for competitor {}: {}",
          competitorId,
          e.getMessage());
    }
  }

  /** Get cached price for URL to reduce scraping costs */
  private java.math.BigDecimal getCachedPriceForUrl(String url) {
    try {
      String cacheKey = "mi:price_cache:" + url.hashCode();
      Optional<String> cachedOpt = enhancedRedisService.get(cacheKey);
      if (cachedOpt.isPresent()) {
        return new java.math.BigDecimal(cachedOpt.get());
      }
    } catch (Exception e) {
      logger.debug("getCachedPriceForUrl: Error getting cached price: {}", e.getMessage());
    }
    return null;
  }

  /** Cache price for URL to reduce future scraping costs */
  private void cachePriceForUrl(String url, java.math.BigDecimal price) {
    try {
      String cacheKey = "mi:price_cache:" + url.hashCode();
      // Cache for 24 hours to reduce scraping frequency
      boolean success =
          enhancedRedisService.setWithTtl(
              cacheKey, price.toString(), java.time.Duration.ofHours(24));
      if (!success) {
        logger.debug("cachePriceForUrl: Failed to cache price for URL: {}", url);
      }
    } catch (Exception e) {
      logger.debug("cachePriceForUrl: Error caching price: {}", e.getMessage());
    }
  }

  /** Check if scraping is allowed for the shop (cost optimization) */
  private boolean isScrapingAllowed(Long shopId) {
    try {
      // Use the proper limit service to check competitor limits
      CompetitorLimitService.LimitCheckResult limitCheck =
          limitService.checkCompetitorLimit(shopId);

      if (!limitCheck.isCanAdd()) {
        logger.debug(
            "triggerImmediatePriceScraping: Shop {} has reached competitor limit ({} >= {})",
            shopId,
            limitCheck.getCurrent(),
            limitCheck.getLimit());
        return false;
      }

      return true;
    } catch (Exception e) {
      logger.warn(
          "triggerImmediatePriceScraping: Error checking competitor limits: {}", e.getMessage());
      return true; // Allow scraping if check fails
    }
  }

  /** Extract domain from URL */
  private String extractDomain(String url) {
    try {
      return url.replaceAll("https?://", "").replaceAll("/.*", "");
    } catch (Exception e) {
      return url;
    }
  }

  /** Identify platform from URL */
  private String identifyPlatform(String url) {
    String lowerUrl = url.toLowerCase();
    if (lowerUrl.contains("amazon.")) {
      return "amazon";
    } else if (lowerUrl.contains("walmart.")) {
      return "walmart";
    } else if (lowerUrl.contains("target.")) {
      return "target";
    } else if (lowerUrl.contains("bestbuy.")) {
      return "bestbuy";
    } else if (lowerUrl.contains("ebay.")) {
      return "ebay";
    } else if (lowerUrl.contains("etsy.")) {
      return "etsy";
    } else if (lowerUrl.contains("shopify") || lowerUrl.contains("myshopify.com")) {
      return "shopify";
    } else if (lowerUrl.contains("woocommerce")) {
      return "woocommerce";
    } else if (lowerUrl.contains("bigcommerce")) {
      return "bigcommerce";
    } else if (lowerUrl.contains("magento")) {
      return "magento";
    } else if (lowerUrl.contains("prestashop")) {
      return "prestashop";
    } else if (lowerUrl.contains("opencart")) {
      return "opencart";
    } else {
      return "other";
    }
  }

  /** Extract price from document using enhanced patterns */
  private java.math.BigDecimal extractPriceFromDocument(
      org.jsoup.nodes.Document doc, String platform) {
    // Enhanced price patterns with better specificity
    java.util.regex.Pattern[] patterns = {
      java.util.regex.Pattern.compile("\\$([0-9,]+\\.?[0-9]*)"),
      java.util.regex.Pattern.compile("USD\\s*([0-9,]+\\.?[0-9]*)"),
      java.util.regex.Pattern.compile("([0-9,]+\\.?[0-9]*)\\s*USD"),
      java.util.regex.Pattern.compile("Price:\\s*\\$([0-9,]+\\.?[0-9]*)"),
      java.util.regex.Pattern.compile("Cost:\\s*\\$([0-9,]+\\.?[0-9]*)"),
      // Additional patterns for better price detection
      java.util.regex.Pattern.compile("\\$([0-9]+)\\s*USD"),
      java.util.regex.Pattern.compile("([0-9,]+\\.?[0-9]*)\\s*\\$"),
      java.util.regex.Pattern.compile("Price\\s*:\\s*([0-9,]+\\.?[0-9]*)"),
      java.util.regex.Pattern.compile("Cost\\s*:\\s*([0-9,]+\\.?[0-9]*)")
    };

    // Platform-specific selectors
    String[] selectors = {
      // Amazon-specific (enhanced for current layout)
      ".a-price .a-offscreen",
      ".a-price-whole",
      ".a-price .a-price-whole",
      "[data-a-color='price'] .a-offscreen",
      ".a-price-range .a-offscreen",
      ".a-price .a-price-range .a-offscreen",
      ".a-price-range .a-price-whole",
      ".a-price .a-price-range .a-price-whole",
      // Additional Amazon selectors
      "[data-a-color='price'] .a-price-whole",
      ".a-price-range .a-price-fraction",
      ".a-price .a-price-range .a-price-fraction",
      // New Amazon selectors based on current layout
      ".a-price-current .a-offscreen",
      ".a-price-current .a-price-whole",
      ".a-price-current .a-price-fraction",
      ".a-price-current .a-price-symbol + .a-price-whole",
      ".a-price-current .a-price-symbol + .a-price-whole + .a-price-fraction",
      // Price display patterns
      "[data-a-color='price'] .a-price-current .a-offscreen",
      "[data-a-color='price'] .a-price-current .a-price-whole",
      // Fallback selectors for Amazon
      ".a-price-current",
      ".a-price-current .a-price",
      ".a-price-current .a-price .a-offscreen",
      // Generic
      ".price",
      ".product-price",
      ".money",
      "[data-price]",
      ".cost",
      ".amount",
      ".price-current",
      ".price-value",
      ".product-cost",
      ".item-price",
      // Shopify
      ".price__regular",
      ".price__sale",
      ".price-item",
      // Walmart
      ".price-characteristic",
      ".price-main",
      ".price-current"
    };

    // Try CSS selectors first (most reliable)
    for (String selector : selectors) {
      org.jsoup.select.Elements elements = doc.select(selector);
      logger.debug(
          "extractPriceFromDocument: Trying selector '{}', found {} elements",
          selector,
          elements.size());

      for (org.jsoup.nodes.Element element : elements) {
        String text = element.text().trim();
        logger.debug("extractPriceFromDocument: Element text: '{}'", text);

        if (!text.isEmpty() && text.length() < 50) { // Avoid very long text
          java.math.BigDecimal price = extractPriceFromText(text, patterns);
          if (price != null && price.compareTo(java.math.BigDecimal.ZERO) > 0) {
            logger.debug(
                "extractPriceFromDocument: Found price ${} using selector '{}'", price, selector);
            return price;
          }
        }
      }
    }

    // Special handling for Amazon - try to find price in page text with more specific patterns
    if (platform.equals("amazon")) {
      logger.debug("extractPriceFromDocument: Amazon-specific fallback - searching page text");
      String pageText = doc.text();

      // Look for price patterns like "Price: $54.95" or "$54.95"
      java.util.regex.Pattern[] amazonPatterns = {
        java.util.regex.Pattern.compile("Price:\\s*\\$([0-9,]+\\.?[0-9]*)"),
        java.util.regex.Pattern.compile("\\$([0-9,]+\\.?[0-9]*)\\s*\\[.*?\\]"),
        java.util.regex.Pattern.compile("\\$([0-9,]+\\.?[0-9]*)\\s*USD"),
        java.util.regex.Pattern.compile("\\$([0-9,]+\\.?[0-9]*)\\s*\\("),
        java.util.regex.Pattern.compile("\\$([0-9,]+\\.?[0-9]*)\\s*Free Returns"),
        java.util.regex.Pattern.compile("\\$([0-9,]+\\.?[0-9]*)\\s*\\|"),
      };

      for (java.util.regex.Pattern pattern : amazonPatterns) {
        java.util.regex.Matcher matcher = pattern.matcher(pageText);
        if (matcher.find()) {
          try {
            String priceStr = matcher.group(1).replaceAll(",", "");
            java.math.BigDecimal price = new java.math.BigDecimal(priceStr);

            if (price.compareTo(java.math.BigDecimal.valueOf(0.01)) >= 0
                && price.compareTo(java.math.BigDecimal.valueOf(100000)) <= 0) {
              logger.debug(
                  "extractPriceFromDocument: Found Amazon price ${} using pattern '{}'",
                  price,
                  pattern.pattern());
              return price;
            }
          } catch (NumberFormatException e) {
            logger.debug(
                "extractPriceFromDocument: Failed to parse Amazon price: {}", e.getMessage());
          }
        }
      }
    }

    // Try patterns on entire page text as fallback
    String pageText = doc.text();
    java.math.BigDecimal fallbackPrice = extractPriceFromText(pageText, patterns);
    if (fallbackPrice != null && fallbackPrice.compareTo(java.math.BigDecimal.ZERO) > 0) {
      logger.debug(
          "extractPriceFromDocument: Found fallback price ${} from page text", fallbackPrice);
      return fallbackPrice;
    }

    logger.warn("extractPriceFromDocument: Could not extract price from {}", platform);
    return null;
  }

  /** Extract price from text using patterns */
  private java.math.BigDecimal extractPriceFromText(
      String text, java.util.regex.Pattern[] patterns) {
    for (java.util.regex.Pattern pattern : patterns) {
      java.util.regex.Matcher matcher = pattern.matcher(text);
      if (matcher.find()) {
        try {
          String priceStr = matcher.group(1).replaceAll(",", "");
          java.math.BigDecimal price = new java.math.BigDecimal(priceStr);

          // Validate price is reasonable (not too low or too high)
          if (price.compareTo(java.math.BigDecimal.valueOf(0.01)) >= 0
              && price.compareTo(java.math.BigDecimal.valueOf(100000)) <= 0) {
            logger.debug(
                "extractPriceFromText: Extracted valid price ${} from text: {}",
                price,
                text.substring(0, Math.min(text.length(), 100)));
            return price;
          } else {
            logger.debug(
                "extractPriceFromText: Price ${} outside reasonable range, skipping", price);
          }
        } catch (NumberFormatException e) {
          logger.debug(
              "extractPriceFromText: Failed to parse price from '{}': {}", text, e.getMessage());
        }
      }
    }
    return null;
  }

  /** Extract stock status from document */
  private boolean extractStockStatusFromDocument(org.jsoup.nodes.Document doc, String platform) {
    String[] selectors = {
      ".stock", ".availability", ".in-stock", ".out-of-stock", ".product-availability"
    };

    for (String selector : selectors) {
      org.jsoup.select.Elements elements = doc.select(selector);
      for (org.jsoup.nodes.Element element : elements) {
        String text = element.text().toLowerCase();

        // Check for out of stock indicators
        if (text.contains("out of stock")
            || text.contains("unavailable")
            || text.contains("sold out")) {
          return false;
        }

        // Check for in stock indicators
        if (text.contains("in stock")
            || text.contains("available")
            || text.contains("add to cart")) {
          return true;
        }
      }
    }

    // Default to in stock if no clear indicator
    return true;
  }

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

  private Map<String, Object> createDemoProduct(
      String id, String title, String handle, double price) {
    Map<String, Object> product = new HashMap<>();
    product.put("id", id);
    product.put("title", title);
    product.put("handle", handle);
    product.put("price", price);
    return product;
  }

  @Autowired private RedisPriceRefreshQueueService priceRefreshQueueService;

  /** Manual price scraping endpoint with scalable event-driven processing */
  @PostMapping("/competitors/refresh-prices")
  public ResponseEntity<Map<String, Object>> refreshCompetitorPrices(HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      logger.info("refreshCompetitorPrices: Starting scalable price refresh for shop {}", shopId);

      // Get competitors that haven't been checked in 24+ hours
      List<Map<String, Object>> staleCompetitors =
          jdbcTemplate.queryForList(
              """
          SELECT cu.id, cu.url, cu.label, cu.shop_id, s.shopify_domain,
                 COALESCE(ps.checked_at, cu.created_at) as last_checked,
                 COALESCE(ps.price, 0) as last_price,
                 cu.error_count, cu.status
          FROM competitor_urls cu
          JOIN shops s ON cu.shop_id = s.id
          LEFT JOIN (
              SELECT competitor_url_id, price, checked_at,
                     ROW_NUMBER() OVER (PARTITION BY competitor_url_id ORDER BY checked_at DESC) as rn
              FROM price_snapshots
          ) ps ON cu.id = ps.competitor_url_id AND ps.rn = 1
          WHERE cu.shop_id = ?
          AND cu.deleted_at IS NULL
          AND (ps.checked_at IS NULL OR ps.checked_at < NOW() - INTERVAL '24 hours')
          AND cu.error_count < 3
          ORDER BY ps.checked_at ASC NULLS FIRST
          """,
              shopId);

      if (staleCompetitors.isEmpty()) {
        return ResponseEntity.ok(
            Map.of(
                "message",
                "All competitors have recent price data (checked within 24 hours)",
                "updated_count",
                0,
                "total_competitors",
                0,
                "session_id",
                ""));
      }

      logger.info(
          "refreshCompetitorPrices: Found {} stale competitors for shop {}",
          staleCompetitors.size(),
          shopId);

      // Convert to refresh items
      List<RedisPriceRefreshQueueService.CompetitorRefreshItem> refreshItems =
          staleCompetitors.stream()
              .map(
                  competitor ->
                      new RedisPriceRefreshQueueService.CompetitorRefreshItem(
                          ((Number) competitor.get("id")).longValue(),
                          (String) competitor.get("url"),
                          (String) competitor.get("label")))
              .toList();

      // Start scalable queue-based refresh
      RedisPriceRefreshQueueService.RefreshSession session =
          priceRefreshQueueService.startPriceRefresh(shopId, refreshItems);

      // Check if refresh is disabled
      if (session.sessionId.equals("disabled")) {
        return ResponseEntity.ok(
            Map.of(
                "message",
                "Price refresh is currently disabled",
                "updated_count",
                0,
                "total_competitors",
                0,
                "total_domains",
                0,
                "session_id",
                "",
                "estimated_completion_time",
                "N/A"));
      }

      logger.info(
          "refreshCompetitorPrices: Started queue-based refresh session {} for {} competitors across {} domains",
          session.sessionId,
          session.totalCompetitors,
          session.totalDomains);

      return ResponseEntity.ok(
          Map.of(
              "message",
              "Scalable price refresh started for "
                  + session.totalCompetitors
                  + " competitors across "
                  + session.totalDomains
                  + " domains",
              "updated_count",
              session.totalCompetitors,
              "total_competitors",
              session.totalCompetitors,
              "total_domains",
              session.totalDomains,
              "session_id",
              session.sessionId,
              "estimated_completion_time",
              "3-8 minutes"));

    } catch (Exception e) {
      logger.error(
          "refreshCompetitorPrices: Error starting scalable refresh for shop {}: {}",
          shopId,
          e.getMessage(),
          e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to start price refresh: " + e.getMessage()));
    }
  }

  /** Get price refresh progress for a session */
  @GetMapping("/competitors/refresh-progress/{sessionId}")
  public ResponseEntity<Map<String, Object>> getPriceRefreshProgress(
      @PathVariable String sessionId, HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      RedisPriceRefreshQueueService.RefreshProgress progress =
          priceRefreshQueueService.getProgress(sessionId);

      if (progress == null) {
        return ResponseEntity.notFound().build();
      }

      // Verify session belongs to this shop
      if (!Objects.equals(progress.shopId, shopId)) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access denied"));
      }

      return ResponseEntity.ok(
          Map.of(
              "sessionId", progress.sessionId,
              "total", progress.total,
              "completed", progress.completed.get(),
              "failed", progress.failed.get(),
              "skipped", progress.skipped.get(),
              "percentage", progress.getPercentage(),
              "status", progress.getStatus(),
              "estimatedTimeRemaining", progress.getEstimatedTimeRemaining(),
              "isCompleted", progress.isCompleted()));

    } catch (Exception e) {
      logger.error("Error getting refresh progress for session {}: {}", sessionId, e.getMessage());
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to get refresh progress"));
    }
  }

  /** Get price refresh status for a shop */
  @GetMapping("/competitors/refresh-status")
  public ResponseEntity<Map<String, Object>> getPriceRefreshStatus(HttpServletRequest request) {
    Long shopId = getShopIdFromRequest(request);
    if (shopId == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Authentication required"));
    }

    try {
      // Get statistics about price freshness
      List<Map<String, Object>> stats =
          jdbcTemplate.queryForList(
              """
          SELECT
              COUNT(*) as total_competitors,
              COUNT(CASE WHEN ps.checked_at IS NULL OR ps.checked_at < NOW() - INTERVAL '24 hours' THEN 1 END) as stale_count,
              COUNT(CASE WHEN ps.checked_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as recent_count,
              COUNT(CASE WHEN ps.checked_at >= NOW() - INTERVAL '6 hours' THEN 1 END) as today_count,
              COUNT(CASE WHEN ps.checked_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h_count
          FROM competitor_urls cu
          LEFT JOIN (
              SELECT competitor_url_id, checked_at,
                     ROW_NUMBER() OVER (PARTITION BY competitor_url_id ORDER BY checked_at DESC) as rn
              FROM price_snapshots
          ) ps ON cu.id = ps.competitor_url_id AND ps.rn = 1
          WHERE cu.shop_id = ? AND cu.deleted_at IS NULL
          """,
              shopId);

      if (stats.isEmpty()) {
        return ResponseEntity.ok(
            Map.of(
                "total_competitors", 0,
                "stale_count", 0,
                "recent_count", 0,
                "can_refresh", false));
      }

      Map<String, Object> stat = stats.get(0);
      int totalCompetitors = ((Number) stat.get("total_competitors")).intValue();
      int staleCount = ((Number) stat.get("stale_count")).intValue();
      int recentCount = ((Number) stat.get("recent_count")).intValue();

      return ResponseEntity.ok(
          Map.of(
              "total_competitors",
              totalCompetitors,
              "stale_count",
              staleCount,
              "recent_count",
              recentCount,
              "today_count",
              ((Number) stat.get("today_count")).intValue(),
              "last_24h_count",
              ((Number) stat.get("last_24h_count")).intValue(),
              "can_refresh",
              staleCount > 0,
              "last_refresh_available",
              staleCount > 0 ? "Yes" : "No - all prices are recent"));

    } catch (Exception e) {
      logger.error(
          "getPriceRefreshStatus: Error getting status for shop {}: {}", shopId, e.getMessage(), e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Failed to get refresh status: " + e.getMessage()));
    }
  }
}
