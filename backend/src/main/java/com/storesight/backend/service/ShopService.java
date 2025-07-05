package com.storesight.backend.service;

import com.storesight.backend.model.Shop;
import com.storesight.backend.model.ShopSession;
import com.storesight.backend.repository.ShopRepository;
import com.storesight.backend.repository.ShopSessionRepository;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Service
public class ShopService {
  private static final Logger logger = LoggerFactory.getLogger(ShopService.class);

  private final ShopRepository shopRepository;
  private final ShopSessionRepository shopSessionRepository;
  private final StringRedisTemplate redisTemplate;
  private final AsyncSessionService asyncSessionService;

  // Redis key patterns for backward compatibility and caching
  private static final String SHOP_TOKEN_PREFIX = "shop_token:";
  private static final String SHOP_SESSION_PREFIX = "shop_session:";
  private static final String ACTIVE_SESSIONS_PREFIX = "active_sessions:";

  // TTL values - Optimized for better resource management and reduced DB load
  private static final int REDIS_CACHE_TTL_MINUTES = 120; // Increased from 30 to 120 minutes
  private static final int REDIS_FALLBACK_TTL_MINUTES = 60; // Fallback cache TTL
  private static final int SESSION_INACTIVITY_HOURS = 4; // 4 hours (business app standard)
  private static final int SESSION_CLEANUP_DAYS = 2; // 2 days
  private static final int MAX_SESSIONS_PER_SHOP = 5; // Limit concurrent sessions per shop

  @Autowired
  public ShopService(
      ShopRepository shopRepository,
      ShopSessionRepository shopSessionRepository,
      StringRedisTemplate redisTemplate,
      AsyncSessionService asyncSessionService) {
    this.shopRepository = shopRepository;
    this.shopSessionRepository = shopSessionRepository;
    this.redisTemplate = redisTemplate;
    this.asyncSessionService = asyncSessionService;
  }

  @PostConstruct
  public void initializeService() {
    logger.info("Initializing ShopService...");

    // Warm up Redis connection
    try {
      redisTemplate
          .opsForValue()
          .set("shop_service_init", "initialized", java.time.Duration.ofSeconds(60));
      String testValue = redisTemplate.opsForValue().get("shop_service_init");
      if ("initialized".equals(testValue)) {
        logger.info("Redis connection verified successfully");
      } else {
        logger.warn("Redis connection test failed - got: {}", testValue);
      }
    } catch (Exception e) {
      logger.error(
          "Redis connection not available at startup - will retry on demand: {}", e.getMessage());
      // Don't throw exception to allow startup to continue
      // Redis is optional - the app can work without it
    }

    // Warm up database connection
    try {
      long shopCount = shopRepository.count();
      logger.info("Database connection verified - found {} shops", shopCount);
    } catch (Exception e) {
      logger.error("Failed to initialize database connection: {}", e.getMessage());
      // Don't throw exception to allow startup to continue
    }

    logger.info("ShopService initialization completed");
  }

  /**
   * Enhanced session saving with immediate session limit enforcement Optimized for minimal database
   * connection usage
   */
  @Transactional(timeout = 10) // Reduced from 15s to 10s for faster connection release
  public ShopSession saveShop(
      String shopifyDomain, String accessToken, String sessionId, HttpServletRequest request) {
    logger.info("Saving shop: {} for session: {}", shopifyDomain, sessionId);

    // Validate and ensure we have a valid sessionId
    String validSessionId = sessionId;
    if (validSessionId == null || validSessionId.trim().isEmpty()) {
      validSessionId =
          "fallback_" + System.currentTimeMillis() + "_" + Math.abs(shopifyDomain.hashCode());
      logger.warn(
          "Generated fallback sessionId for shop: {} - original was null/empty", shopifyDomain);
    }

    // Find or create shop - optimized single query
    Shop shop =
        shopRepository
            .findByShopifyDomain(shopifyDomain)
            .orElseGet(
                () -> {
                  Shop newShop = new Shop(shopifyDomain, accessToken);
                  return shopRepository.save(newShop);
                });

    // Update shop's main access token (most recent one)
    shop.setAccessToken(accessToken);
    shop = shopRepository.save(shop);

    // CRITICAL: Enforce session limit BEFORE creating new session
    enforceSessionLimitSync(shop, validSessionId);

    // Create or update session (optimized to minimize transaction time)
    ShopSession session = createOrUpdateSession(shop, validSessionId, accessToken, request);

    logger.info(
        "Shop and session saved successfully: {} with session: {}", shopifyDomain, validSessionId);
    return session;
  }

  /**
   * Synchronous session limit enforcement to prevent race conditions This runs within the same
   * transaction as session creation
   */
  private void enforceSessionLimitSync(Shop shop, String currentSessionId) {
    try {
      List<ShopSession> activeSessions =
          shopSessionRepository.findByShopAndIsActiveTrueOrderByLastAccessedAtDesc(shop);

      logger.debug(
          "Found {} active sessions for shop: {}", activeSessions.size(), shop.getShopifyDomain());

      // If we're at or over the limit, we need to deactivate old sessions
      if (activeSessions.size() >= MAX_SESSIONS_PER_SHOP) {
        // Check if current session already exists in the list
        boolean currentSessionExists =
            activeSessions.stream().anyMatch(s -> s.getSessionId().equals(currentSessionId));

        int sessionsToDeactivate =
            currentSessionExists
                ? activeSessions.size() - MAX_SESSIONS_PER_SHOP
                : activeSessions.size() - MAX_SESSIONS_PER_SHOP + 1;

        if (sessionsToDeactivate > 0) {
          // Deactivate the oldest sessions (keep the most recent ones)
          List<ShopSession> sessionsToRemove =
              activeSessions.stream()
                  .skip(MAX_SESSIONS_PER_SHOP - (currentSessionExists ? 1 : 0))
                  .collect(Collectors.toList());

          logger.info(
              "Enforcing session limit: deactivating {} sessions for shop: {}",
              sessionsToRemove.size(),
              shop.getShopifyDomain());

          for (ShopSession session : sessionsToRemove) {
            session.deactivate();
            shopSessionRepository.save(session);
            // Note: Redis cleanup will be done in post-transaction operations
          }
        }
      }
    } catch (Exception e) {
      logger.error(
          "Error enforcing session limit for shop {}: {}",
          shop.getShopifyDomain(),
          e.getMessage(),
          e);
      // Don't fail the transaction, but log the error
    }
  }

  /**
   * Post-transaction operations to reduce connection holding time These operations are moved
   * outside the transaction for better performance
   */
  public void postSaveShopOperations(
      String shopifyDomain, String validSessionId, String accessToken) {
    try {
      // Cache in Redis for performance (with increased TTL)
      cacheShopSession(shopifyDomain, validSessionId, accessToken);

      // Update active sessions list
      updateActiveSessionsList(shopifyDomain);

      // Clean up Redis cache for any deactivated sessions
      cleanupDeactivatedSessionsFromRedis(shopifyDomain);

    } catch (Exception e) {
      logger.warn("Post-save operations failed for shop {}: {}", shopifyDomain, e.getMessage());
    }
  }

  /** Backward compatibility method */
  @Transactional
  public void saveShop(String shopifyDomain, String accessToken, String sessionId) {
    // Validate and ensure we have a valid sessionId
    String validSessionId = sessionId;
    if (validSessionId == null || validSessionId.trim().isEmpty()) {
      validSessionId =
          "fallback_" + System.currentTimeMillis() + "_" + Math.abs(shopifyDomain.hashCode());
      logger.warn(
          "Generated fallback sessionId for shop: {} - original was null/empty", shopifyDomain);
    }

    saveShop(shopifyDomain, accessToken, validSessionId, null);
  }

  /** Get access token for a specific shop and session - Reactive version */
  public Mono<String> getTokenForShopReactive(String shopifyDomain, String sessionId) {
    logger.debug("Getting token for shop: {} and session: {}", shopifyDomain, sessionId);

    if (sessionId == null) {
      return getTokenForShopFallbackReactive(shopifyDomain);
    }

    // Try Redis cache first with proper error handling
    String cachedToken = null;
    try {
      cachedToken =
          redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId);
      if (cachedToken != null) {
        logger.debug(
            "Found token in Redis cache for shop: {} and session: {}", shopifyDomain, sessionId);
        // FIXED: Update last accessed time asynchronously to avoid transaction violations
        updateSessionLastAccessedAsync(sessionId);
        return Mono.just(cachedToken);
      }
    } catch (Exception e) {
      logger.warn(
          "Redis unavailable for reactive token lookup - falling back to database: {}",
          e.getMessage());
      // Continue to database lookup
    }

    // Try database using reactive pattern
    return Mono.fromCallable(
            () ->
                shopSessionRepository.findActiveSessionByShopDomainAndSessionId(
                    shopifyDomain, sessionId))
        .publishOn(Schedulers.boundedElastic())
        .flatMap(
            sessionOpt -> {
              if (sessionOpt.isPresent()) {
                ShopSession session = sessionOpt.get();
                String token = session.getAccessToken();

                // FIXED: Update last accessed time asynchronously to avoid transaction violations
                updateSessionLastAccessedAsync(sessionId);

                // Cache for future requests
                cacheShopSession(shopifyDomain, sessionId, token);
                return Mono.just(token);
              }

              // Fallback to most recent active session for this shop
              logger.warn(
                  "No specific session found, trying fallback for shop: {} and session: {}",
                  shopifyDomain,
                  sessionId);
              return getTokenForShopFallbackReactive(shopifyDomain);
            });
  }

  /** Enhanced token retrieval with improved Redis caching strategy */
  @Transactional(readOnly = true, timeout = 5) // Reduced timeout for read-only operations
  public String getTokenForShop(String shopifyDomain, String sessionId) {
    logger.debug("Getting token for shop: {} and session: {}", shopifyDomain, sessionId);

    if (sessionId == null) {
      return getTokenForShopFallback(shopifyDomain);
    }

    // Try Redis cache first with improved error handling
    String cachedToken = null;
    try {
      cachedToken =
          redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId);
      if (cachedToken != null) {
        logger.debug(
            "Found token in Redis cache for shop: {} and session: {}", shopifyDomain, sessionId);
        // CRITICAL FIX: Update last accessed time asynchronously OUTSIDE the read-only transaction
        // This prevents read-only transaction violations
        updateSessionLastAccessedAsync(sessionId);
        return cachedToken;
      }
    } catch (Exception e) {
      logger.warn(
          "Redis unavailable for token lookup - falling back to database: {}", e.getMessage());
    }

    // Try database with read-only transaction - NO UPDATES ALLOWED HERE
    Optional<ShopSession> sessionOpt =
        shopSessionRepository.findActiveSessionByShopDomainAndSessionId(shopifyDomain, sessionId);

    if (sessionOpt.isPresent()) {
      ShopSession session = sessionOpt.get();
      String token = session.getAccessToken();

      // CRITICAL FIX: Update last accessed time asynchronously OUTSIDE the read-only transaction
      // This runs in a separate thread pool and transaction context
      updateSessionLastAccessedAsync(sessionId);

      // Cache for future requests with extended TTL
      cacheShopSessionWithExtendedTTL(shopifyDomain, sessionId, token);

      logger.debug(
          "Found token in database for shop: {} and session: {}", shopifyDomain, sessionId);
      return token;
    }

    // Fallback to most recent active session for this shop
    logger.warn(
        "No specific session found, trying fallback for shop: {} and session: {}",
        shopifyDomain,
        sessionId);
    return getTokenForShopFallback(shopifyDomain);
  }

  /** Get token for shop without specific session (fallback method) - Reactive version */
  private Mono<String> getTokenForShopFallbackReactive(String shopifyDomain) {
    logger.debug("Getting fallback token for shop: {}", shopifyDomain);

    // Try Redis cache (shop-only key) with proper error handling
    try {
      String cachedToken = redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain);
      if (cachedToken != null) {
        logger.debug("Found fallback token in Redis for shop: {}", shopifyDomain);
        return Mono.just(cachedToken);
      }
    } catch (Exception e) {
      logger.warn(
          "Redis unavailable for reactive fallback token lookup - continuing to database: {}",
          e.getMessage());
      // Continue to database lookup
    }

    // Try most recent active session from database
    return Mono.fromCallable(
            () -> shopSessionRepository.findMostRecentActiveSessionByDomain(shopifyDomain))
        .publishOn(Schedulers.boundedElastic())
        .flatMap(
            recentSessionOpt -> {
              if (recentSessionOpt.isPresent()) {
                ShopSession session = recentSessionOpt.get();
                String token = session.getAccessToken();

                // FIXED: Update last accessed time asynchronously to avoid transaction violations
                updateSessionLastAccessedAsync(session.getSessionId());

                // Cache for future requests
                redisTemplate
                    .opsForValue()
                    .set(
                        SHOP_TOKEN_PREFIX + shopifyDomain,
                        token,
                        java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));
                return Mono.just(token);
              }

              // Fallback to shop's main token
              return Mono.fromCallable(() -> shopRepository.findByShopifyDomain(shopifyDomain))
                  .publishOn(Schedulers.boundedElastic())
                  .map(
                      shopOpt -> {
                        if (shopOpt.isPresent()) {
                          String token = shopOpt.get().getAccessToken();
                          if (token != null) {
                            // Cache for future requests
                            redisTemplate
                                .opsForValue()
                                .set(
                                    SHOP_TOKEN_PREFIX + shopifyDomain,
                                    token,
                                    java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));

                            logger.debug(
                                "Found fallback token from shop for shop: {}", shopifyDomain);
                            return token;
                          }
                        }
                        logger.warn("No token found for shop: {}", shopifyDomain);
                        return null;
                      });
            });
  }

  /** Get token for shop without specific session (fallback method) - Blocking version */
  private String getTokenForShopFallback(String shopifyDomain) {
    logger.debug("Getting fallback token for shop: {}", shopifyDomain);

    // Try Redis cache (shop-only key) with proper error handling
    try {
      String cachedToken = redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain);
      if (cachedToken != null) {
        logger.debug("Found fallback token in Redis for shop: {}", shopifyDomain);
        return cachedToken;
      }
    } catch (Exception e) {
      logger.warn(
          "Redis unavailable for fallback token lookup - continuing to database: {}",
          e.getMessage());
      // Continue to database lookup
    }

    // Try most recent active session from database
    Optional<ShopSession> recentSessionOpt =
        shopSessionRepository.findMostRecentActiveSessionByDomain(shopifyDomain);

    if (recentSessionOpt.isPresent()) {
      ShopSession session = recentSessionOpt.get();
      String token = session.getAccessToken();

      // FIXED: Update last accessed time asynchronously to avoid read-only transaction violation
      updateSessionLastAccessedAsync(session.getSessionId());

      // Cache for future requests
      redisTemplate
          .opsForValue()
          .set(
              SHOP_TOKEN_PREFIX + shopifyDomain,
              token,
              java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));

      logger.debug("Found fallback token from most recent session for shop: {}", shopifyDomain);
      return token;
    }

    // Fallback to shop's main token
    Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopifyDomain);
    if (shopOpt.isPresent()) {
      String token = shopOpt.get().getAccessToken();
      if (token != null) {
        // Cache for future requests
        redisTemplate
            .opsForValue()
            .set(
                SHOP_TOKEN_PREFIX + shopifyDomain,
                token,
                java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));

        logger.debug("Found fallback token from shop for shop: {}", shopifyDomain);
        return token;
      }
    }

    logger.warn("No token found for shop: {}", shopifyDomain);
    return null;
  }

  /** Remove/deactivate a specific session */
  @Transactional
  public void removeSession(String shopifyDomain, String sessionId) {
    logger.info("Deactivating session for shop: {} and session: {}", shopifyDomain, sessionId);

    // Deactivate in database
    shopSessionRepository.deactivateSession(sessionId);

    // Remove from Redis cache
    redisTemplate.delete(SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId);

    // Update active sessions list
    updateActiveSessionsList(shopifyDomain);

    logger.info("Session deactivated: {} for shop: {}", sessionId, shopifyDomain);
  }

  /** Remove/deactivate all sessions for a shop (complete logout) */
  @Transactional
  public void removeAllSessionsForShop(String shopifyDomain) {
    logger.info("Deactivating all sessions for shop: {}", shopifyDomain);

    Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopifyDomain);
    if (shopOpt.isPresent()) {
      Shop shop = shopOpt.get();

      // Deactivate all sessions in database
      shopSessionRepository.deactivateAllSessionsForShop(shop);

      // Clear Redis cache
      clearShopCache(shopifyDomain);

      logger.info("All sessions deactivated for shop: {}", shopifyDomain);
    }
  }

  /** Get all active sessions for a shop */
  @Transactional(readOnly = true)
  public List<ShopSession> getActiveSessionsForShop(String shopifyDomain) {
    Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopifyDomain);
    if (shopOpt.isPresent()) {
      return shopSessionRepository.findByShopAndIsActiveTrueOrderByLastAccessedAtDesc(
          shopOpt.get());
    }
    return List.of();
  }

  /** Get session information for debugging */
  @Transactional(readOnly = true)
  public Optional<ShopSession> getSessionInfo(String sessionId) {
    return shopSessionRepository.findBySessionId(sessionId);
  }

  /** Backward compatibility method */
  @Transactional(readOnly = true)
  public Mono<String> getShopAccessToken(String shopDomain) {
    String token = getTokenForShop(shopDomain, null);
    if (token == null) {
      logger.error("No access token found for shop: {}", shopDomain);
      return Mono.error(new RuntimeException("No access token found for shop"));
    }
    return Mono.just(token);
  }

  // Private helper methods

  private ShopSession createOrUpdateSession(
      Shop shop, String sessionId, String accessToken, HttpServletRequest request) {

    // Final validation to ensure sessionId is never null
    if (sessionId == null || sessionId.trim().isEmpty()) {
      sessionId =
          "emergency_"
              + System.currentTimeMillis()
              + "_"
              + Math.abs(shop.getShopifyDomain().hashCode());
      logger.error(
          "Emergency sessionId generation in createOrUpdateSession for shop: {}",
          shop.getShopifyDomain());
    }

    Optional<ShopSession> existingOpt =
        shopSessionRepository.findByShopAndSessionIdAndIsActiveTrue(shop, sessionId);

    ShopSession session;
    if (existingOpt.isPresent()) {
      // Update existing session
      session = existingOpt.get();
      session.setAccessToken(accessToken);
      session.markAsAccessed();
      logger.debug("Updated existing session: {} for shop: {}", sessionId, shop.getShopifyDomain());
    } else {
      // Create new session
      session = new ShopSession(shop, sessionId, accessToken);
      if (request != null) {
        session.setUserAgent(request.getHeader("User-Agent"));
        session.setIpAddress(getClientIpAddress(request));
      }
      logger.debug("Created new session: {} for shop: {}", sessionId, shop.getShopifyDomain());
    }

    // Set expiration time (optional)
    session.setExpiresAt(LocalDateTime.now().plusHours(SESSION_INACTIVITY_HOURS));

    return shopSessionRepository.save(session);
  }

  private void cacheShopSession(String shopifyDomain, String sessionId, String accessToken) {
    try {
      // Cache session-specific token with extended TTL
      redisTemplate
          .opsForValue()
          .set(
              SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId,
              accessToken,
              java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));

      // Cache shop-only token (most recent) with fallback TTL
      redisTemplate
          .opsForValue()
          .set(
              SHOP_TOKEN_PREFIX + shopifyDomain,
              accessToken,
              java.time.Duration.ofMinutes(REDIS_FALLBACK_TTL_MINUTES));

      logger.debug(
          "Cached tokens for shop: {} and session: {} with extended TTL", shopifyDomain, sessionId);
    } catch (Exception e) {
      logger.warn(
          "Failed to cache tokens for shop {} - Redis may be unavailable: {}",
          shopifyDomain,
          e.getMessage());
    }
  }

  private void cacheShopSessionWithExtendedTTL(
      String shopifyDomain, String sessionId, String accessToken) {
    try {
      // Use longer TTL for database-retrieved sessions to reduce future DB queries
      redisTemplate
          .opsForValue()
          .set(
              SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId,
              accessToken,
              java.time.Duration.ofMinutes(
                  REDIS_CACHE_TTL_MINUTES * 2)); // Double TTL for DB-retrieved sessions

      logger.debug(
          "Cached token with extended TTL for shop: {} and session: {}", shopifyDomain, sessionId);
    } catch (Exception e) {
      logger.warn("Failed to cache token with extended TTL: {}", e.getMessage());
    }
  }

  private void updateActiveSessionsList(String shopifyDomain) {
    try {
      List<ShopSession> activeSessions = getActiveSessionsForShop(shopifyDomain);
      String activeSessionIds =
          activeSessions.stream()
              .map(ShopSession::getSessionId)
              .reduce((a, b) -> a + "," + b)
              .orElse("");

      redisTemplate
          .opsForValue()
          .set(
              ACTIVE_SESSIONS_PREFIX + shopifyDomain,
              activeSessionIds,
              java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));

      logger.debug(
          "Updated active sessions list for shop: {} (count: {})",
          shopifyDomain,
          activeSessions.size());
    } catch (Exception e) {
      logger.warn(
          "Failed to update active sessions list for shop {}: {}", shopifyDomain, e.getMessage());
    }
  }

  private void clearShopCache(String shopifyDomain) {
    try {
      // Get all Redis keys for this shop
      var keys = redisTemplate.keys(SHOP_TOKEN_PREFIX + shopifyDomain + "*");
      if (keys != null && !keys.isEmpty()) {
        redisTemplate.delete(keys);
      }

      // Clear active sessions list
      redisTemplate.delete(ACTIVE_SESSIONS_PREFIX + shopifyDomain);

      logger.debug("Cleared cache for shop: {}", shopifyDomain);
    } catch (Exception e) {
      logger.warn("Failed to clear cache for shop {}: {}", shopifyDomain, e.getMessage());
    }
  }

  private void updateSessionLastAccessed(String sessionId) {
    try {
      shopSessionRepository.updateLastAccessedTime(sessionId);
    } catch (Exception e) {
      logger.warn(
          "Failed to update last accessed time for session {}: {}", sessionId, e.getMessage());
    }
  }

  /**
   * Asynchronous session last accessed time update to avoid blocking read-only transactions This
   * method delegates to AsyncSessionService which runs updates in a separate thread pool and
   * transaction context, preventing read-only transaction violations.
   */
  private void updateSessionLastAccessedAsync(String sessionId) {
    try {
      // Delegate to the dedicated async service
      asyncSessionService.updateSessionLastAccessedAsync(sessionId);
    } catch (Exception e) {
      logger.warn(
          "Failed to initiate async session update for session {}: {}", sessionId, e.getMessage());
      // Don't propagate the exception as this is a non-critical background operation
    }
  }

  private String getClientIpAddress(HttpServletRequest request) {
    String xForwardedFor = request.getHeader("X-Forwarded-For");
    if (xForwardedFor != null
        && !xForwardedFor.isEmpty()
        && !"unknown".equalsIgnoreCase(xForwardedFor)) {
      return xForwardedFor.split(",")[0].trim();
    }

    String xRealIp = request.getHeader("X-Real-IP");
    if (xRealIp != null && !xRealIp.isEmpty() && !"unknown".equalsIgnoreCase(xRealIp)) {
      return xRealIp;
    }

    return request.getRemoteAddr();
  }

  // Scheduled cleanup methods

  /** Clean up excessive sessions for a shop to prevent database bloat */
  @Transactional(timeout = 15)
  public void cleanupExcessiveSessions(Shop shop) {
    try {
      List<ShopSession> activeSessions =
          shopSessionRepository.findByShopAndIsActiveTrueOrderByLastAccessedAtDesc(shop);

      if (activeSessions.size() >= MAX_SESSIONS_PER_SHOP) {
        // Keep only the most recent sessions, deactivate the rest
        List<ShopSession> sessionsToDeactivate =
            activeSessions.subList(MAX_SESSIONS_PER_SHOP - 1, activeSessions.size());

        for (ShopSession session : sessionsToDeactivate) {
          session.deactivate();
          shopSessionRepository.save(session);

          // Clear from Redis cache
          try {
            redisTemplate.delete(
                SHOP_TOKEN_PREFIX + shop.getShopifyDomain() + ":" + session.getSessionId());
          } catch (Exception e) {
            logger.warn(
                "Failed to clear Redis cache for session {}: {}",
                session.getSessionId(),
                e.getMessage());
          }
        }

        logger.info(
            "Deactivated {} excessive sessions for shop: {}",
            sessionsToDeactivate.size(),
            shop.getShopifyDomain());
      }
    } catch (Exception e) {
      logger.error(
          "Error during excessive session cleanup for shop {}: {}",
          shop.getShopifyDomain(),
          e.getMessage());
      // Don't propagate exception as this is a cleanup operation
    }
  }

  /** Async version of excessive session cleanup to reduce connection holding time */
  public void cleanupExcessiveSessionsAsync(String shopifyDomain) {
    try {
      Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopifyDomain);
      if (shopOpt.isPresent()) {
        cleanupExcessiveSessions(shopOpt.get());
      }
    } catch (Exception e) {
      logger.warn("Async session cleanup failed for shop {}: {}", shopifyDomain, e.getMessage());
    }
  }

  /** Enhanced session cleanup with better error handling and monitoring */
  @Transactional(timeout = 10) // Reduced timeout for cleanup operations
  @Scheduled(fixedRate = 900000) // 15 minutes (aggressive cleanup)
  public void cleanupExpiredSessions() {
    try {
      logger.debug("Starting expired session cleanup");

      List<ShopSession> expiredSessions = shopSessionRepository.findExpiredSessions();
      int cleanedCount = 0;

      for (ShopSession session : expiredSessions) {
        session.deactivate();
        shopSessionRepository.save(session);
        cleanedCount++;

        // Clear from cache
        if (session.getShop() != null) {
          try {
            redisTemplate.delete(
                SHOP_TOKEN_PREFIX
                    + session.getShop().getShopifyDomain()
                    + ":"
                    + session.getSessionId());
          } catch (Exception e) {
            logger.warn(
                "Failed to clear Redis cache during expired session cleanup: {}", e.getMessage());
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info("Cleaned up {} expired sessions", cleanedCount);
      }

      // Also clean up old inactive sessions more frequently
      cleanupInactiveSessions();

    } catch (Exception e) {
      logger.error("Error during expired session cleanup: {}", e.getMessage(), e);
    }
  }

  /** Clean up old inactive sessions - now called from expired session cleanup and daily */
  @Transactional
  public void cleanupInactiveSessions() {
    try {
      LocalDateTime cutoffDate = LocalDateTime.now().minusDays(SESSION_CLEANUP_DAYS);

      // Find and deactivate old sessions
      List<ShopSession> oldSessions =
          shopSessionRepository.findInactiveSessionsOlderThan(cutoffDate);
      for (ShopSession session : oldSessions) {
        session.deactivate();
        shopSessionRepository.save(session);
      }

      // Delete very old inactive sessions more aggressively
      LocalDateTime deleteCutoffDate = LocalDateTime.now().minusDays(SESSION_CLEANUP_DAYS * 2);
      shopSessionRepository.deleteOldInactiveSessions(deleteCutoffDate);

      if (!oldSessions.isEmpty()) {
        logger.info("Cleaned up {} old inactive sessions", oldSessions.size());
      }
    } catch (Exception e) {
      logger.error("Error during inactive session cleanup: {}", e.getMessage(), e);
    }
  }

  /** Clean up old inactive sessions - runs daily at 2 AM and 2 PM */
  @Transactional
  @Scheduled(cron = "0 0 2,14 * * *") // Run twice daily
  public void cleanupOldInactiveSessionsScheduled() {
    logger.info("Starting scheduled inactive session cleanup");
    cleanupInactiveSessions();

    // Additional cleanup: remove very old Redis keys
    cleanupOldRedisKeys();
  }

  /** Clean up old Redis keys that might be orphaned */
  private void cleanupOldRedisKeys() {
    try {
      // This is a basic cleanup - in production you might want to use Redis SCAN
      // to avoid blocking operations on large keysets
      var allTokenKeys = redisTemplate.keys(SHOP_TOKEN_PREFIX + "*");
      if (allTokenKeys != null && !allTokenKeys.isEmpty()) {
        logger.debug("Found {} Redis token keys for potential cleanup", allTokenKeys.size());
        // For now, just log the count. More sophisticated cleanup can be added later.
      }
    } catch (Exception e) {
      logger.warn("Error during Redis key cleanup: {}", e.getMessage());
    }
  }

  /** Clean up Redis cache for deactivated sessions */
  private void cleanupDeactivatedSessionsFromRedis(String shopifyDomain) {
    try {
      // Get all sessions for this shop from database
      Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopifyDomain);
      if (shopOpt.isPresent()) {
        Shop shop = shopOpt.get();

        // Get all sessions (active and inactive) to compare with Redis
        List<ShopSession> allSessions = shopSessionRepository.findByShop(shop);
        List<String> inactiveSessionIds =
            allSessions.stream()
                .filter(s -> !s.getIsActive())
                .map(ShopSession::getSessionId)
                .collect(Collectors.toList());

        // Remove inactive sessions from Redis
        for (String sessionId : inactiveSessionIds) {
          redisTemplate.delete(SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId);
        }

        if (!inactiveSessionIds.isEmpty()) {
          logger.debug(
              "Cleaned up {} inactive sessions from Redis for shop: {}",
              inactiveSessionIds.size(),
              shopifyDomain);
        }
      }
    } catch (Exception e) {
      logger.warn(
          "Failed to cleanup deactivated sessions from Redis for shop {}: {}",
          shopifyDomain,
          e.getMessage());
    }
  }

  // Backward compatibility methods (deprecated but maintained for existing code)

  @Deprecated
  public void removeToken(String shopifyDomain, String sessionId) {
    logger.warn("Using deprecated removeToken method. Use removeSession instead.");
    removeSession(shopifyDomain, sessionId);
  }

  /** Update session heartbeat to track active browser sessions */
  @Transactional(timeout = 5)
  public boolean updateSessionHeartbeat(String shopifyDomain, String sessionId) {
    try {
      Optional<ShopSession> sessionOpt =
          shopSessionRepository.findActiveSessionByShopDomainAndSessionId(shopifyDomain, sessionId);

      if (sessionOpt.isPresent()) {
        // ENHANCED: Use async service for heartbeat to avoid transaction conflicts
        asyncSessionService.performSessionHeartbeatAsync(sessionId, shopifyDomain);

        // Update Redis cache TTL to extend session life
        try {
          String cachedToken =
              redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId);
          if (cachedToken != null) {
            redisTemplate
                .opsForValue()
                .set(
                    SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId,
                    cachedToken,
                    java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));
          }
        } catch (Exception e) {
          logger.warn("Failed to update Redis TTL during heartbeat: {}", e.getMessage());
        }

        logger.debug(
            "Session heartbeat initiated for shop: {} and session: {}", shopifyDomain, sessionId);
        return true;
      } else {
        logger.warn(
            "Session not found for heartbeat update: shop={}, session={}",
            shopifyDomain,
            sessionId);
        return false;
      }
    } catch (Exception e) {
      logger.error(
          "Error updating session heartbeat for shop {}: {}", shopifyDomain, e.getMessage(), e);
      return false;
    }
  }

  /** Get stale sessions for a shop (sessions that haven't been accessed recently) */
  @Transactional(readOnly = true)
  public List<ShopSession> getStaleSessionsForShop(String shopifyDomain) {
    try {
      Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopifyDomain);
      if (shopOpt.isPresent()) {
        Shop shop = shopOpt.get();

        // Define stale threshold (sessions not accessed for more than 30 minutes)
        LocalDateTime staleThreshold = LocalDateTime.now().minusMinutes(30);

        return shopSessionRepository
            .findByShopAndIsActiveTrueOrderByLastAccessedAtDesc(shop)
            .stream()
            .filter(session -> session.getLastAccessedAt().isBefore(staleThreshold))
            .collect(Collectors.toList());
      }
      return new ArrayList<>();
    } catch (Exception e) {
      logger.error(
          "Error getting stale sessions for shop {}: {}", shopifyDomain, e.getMessage(), e);
      return new ArrayList<>();
    }
  }

  /** Clean up stale sessions (sessions that haven't sent heartbeat for extended period) */
  @Transactional
  @Scheduled(fixedRate = 1800000) // 30 minutes
  public void cleanupStaleSessions() {
    try {
      // Define stale threshold (sessions not accessed for more than 1 hour)
      LocalDateTime staleThreshold = LocalDateTime.now().minusHours(1);

      List<ShopSession> staleSessions =
          shopSessionRepository.findInactiveSessionsOlderThan(staleThreshold);
      int cleanedCount = 0;

      for (ShopSession session : staleSessions) {
        if (session.getIsActive()) {
          session.deactivate();
          shopSessionRepository.save(session);
          cleanedCount++;

          // Clear from Redis cache
          if (session.getShop() != null) {
            try {
              redisTemplate.delete(
                  SHOP_TOKEN_PREFIX
                      + session.getShop().getShopifyDomain()
                      + ":"
                      + session.getSessionId());
            } catch (Exception e) {
              logger.warn(
                  "Failed to clear Redis cache during stale session cleanup: {}", e.getMessage());
            }
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info("Cleaned up {} stale sessions", cleanedCount);
      }
    } catch (Exception e) {
      logger.error("Error during stale session cleanup: {}", e.getMessage(), e);
    }
  }
}
