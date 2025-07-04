package com.storesight.backend.service;

import com.storesight.backend.model.Shop;
import com.storesight.backend.model.ShopSession;
import com.storesight.backend.repository.ShopRepository;
import com.storesight.backend.repository.ShopSessionRepository;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
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

  // Redis key patterns for backward compatibility and caching
  private static final String SHOP_TOKEN_PREFIX = "shop_token:";
  private static final String SHOP_SESSION_PREFIX = "shop_session:";
  private static final String ACTIVE_SESSIONS_PREFIX = "active_sessions:";

  // TTL values - Further optimized for better resource management
  private static final int REDIS_CACHE_TTL_MINUTES = 30; // Shorter TTL for cache
  private static final int SESSION_INACTIVITY_HOURS =
      4; // Reduced from 12h to 4h (business app standard)
  private static final int SESSION_CLEANUP_DAYS = 2; // Reduced from 3 to 2 days
  private static final int MAX_SESSIONS_PER_SHOP = 5; // Limit concurrent sessions per shop

  @Autowired
  public ShopService(
      ShopRepository shopRepository,
      ShopSessionRepository shopSessionRepository,
      StringRedisTemplate redisTemplate) {
    this.shopRepository = shopRepository;
    this.shopSessionRepository = shopSessionRepository;
    this.redisTemplate = redisTemplate;
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
   * Save shop and create/update session. This method handles multiple concurrent sessions properly.
   * OPTIMIZED: Reduced transaction scope to minimize connection holding time
   */
  @Transactional(timeout = 15) // Reduced timeout for faster connection release
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

    // Find or create shop - optimized query
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

    // Create or update session (simplified to reduce transaction time)
    ShopSession session = createOrUpdateSession(shop, validSessionId, accessToken, request);

    logger.info(
        "Shop and session saved successfully: {} with session: {}", shopifyDomain, validSessionId);
    return session;
  }

  /** Post-transaction operations to reduce connection holding time */
  public void postSaveShopOperations(
      String shopifyDomain, String validSessionId, String accessToken) {
    // These operations are moved outside the transaction to reduce connection holding time
    try {
      // Check and limit concurrent sessions (moved to separate transaction)
      cleanupExcessiveSessionsAsync(shopifyDomain);

      // Cache in Redis for performance
      cacheShopSession(shopifyDomain, validSessionId, accessToken);

      // Update active sessions list
      updateActiveSessionsList(shopifyDomain);
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
  @Transactional
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
        updateSessionLastAccessed(sessionId);
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

                // Update last accessed time
                session.markAsAccessed();
                return Mono.fromCallable(() -> shopSessionRepository.save(session))
                    .publishOn(Schedulers.boundedElastic())
                    .then(
                        Mono.fromCallable(
                            () -> {
                              // Cache for future requests
                              cacheShopSession(shopifyDomain, sessionId, token);
                              return token;
                            }));
              }

              // Fallback to most recent active session for this shop
              logger.warn(
                  "No specific session found, trying fallback for shop: {} and session: {}",
                  shopifyDomain,
                  sessionId);
              return getTokenForShopFallbackReactive(shopifyDomain);
            });
  }

  /**
   * Get access token for a specific shop and session - Blocking version for backward compatibility
   */
  @Transactional
  public String getTokenForShop(String shopifyDomain, String sessionId) {
    logger.debug("Getting token for shop: {} and session: {}", shopifyDomain, sessionId);

    if (sessionId == null) {
      return getTokenForShopFallback(shopifyDomain);
    }

    // Try Redis cache first with proper error handling
    String cachedToken = null;
    try {
      cachedToken =
          redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId);
      if (cachedToken != null) {
        logger.debug(
            "Found token in Redis cache for shop: {} and session: {}", shopifyDomain, sessionId);
        updateSessionLastAccessed(sessionId);
        return cachedToken;
      }
    } catch (Exception e) {
      logger.warn(
          "Redis unavailable for token lookup - falling back to database: {}", e.getMessage());
      // Continue to database lookup
    }

    // Try database
    Optional<ShopSession> sessionOpt =
        shopSessionRepository.findActiveSessionByShopDomainAndSessionId(shopifyDomain, sessionId);

    if (sessionOpt.isPresent()) {
      ShopSession session = sessionOpt.get();
      String token = session.getAccessToken();

      // Update last accessed time
      session.markAsAccessed();
      shopSessionRepository.save(session);

      // Cache for future requests
      cacheShopSession(shopifyDomain, sessionId, token);

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

                // Update last accessed time
                session.markAsAccessed();
                return Mono.fromCallable(() -> shopSessionRepository.save(session))
                    .publishOn(Schedulers.boundedElastic())
                    .then(
                        Mono.fromCallable(
                            () -> {
                              // Cache for future requests
                              redisTemplate
                                  .opsForValue()
                                  .set(
                                      SHOP_TOKEN_PREFIX + shopifyDomain,
                                      token,
                                      java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));
                              return token;
                            }));
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

      // Update last accessed time
      session.markAsAccessed();
      shopSessionRepository.save(session);

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
      // Cache session-specific token
      redisTemplate
          .opsForValue()
          .set(
              SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId,
              accessToken,
              java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));

      // Cache shop-only token (most recent)
      redisTemplate
          .opsForValue()
          .set(
              SHOP_TOKEN_PREFIX + shopifyDomain,
              accessToken,
              java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));

      logger.debug("Cached tokens for shop: {} and session: {}", shopifyDomain, sessionId);
    } catch (Exception e) {
      logger.warn(
          "Failed to cache tokens for shop {} - Redis may be unavailable: {}",
          shopifyDomain,
          e.getMessage());
      // Don't propagate the exception - caching is optional
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

  /** Clean up expired sessions - runs every 15 minutes (aggressive cleanup) */
  @Transactional
  @Scheduled(fixedRate = 900000) // 15 minutes (reduced from 30 minutes)
  public void cleanupExpiredSessions() {
    try {
      List<ShopSession> expiredSessions = shopSessionRepository.findExpiredSessions();
      for (ShopSession session : expiredSessions) {
        session.deactivate();
        shopSessionRepository.save(session);

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

      if (!expiredSessions.isEmpty()) {
        logger.info("Deactivated {} expired sessions", expiredSessions.size());
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

  // Backward compatibility methods (deprecated but maintained for existing code)

  @Deprecated
  public void removeToken(String shopifyDomain, String sessionId) {
    logger.warn("Using deprecated removeToken method. Use removeSession instead.");
    removeSession(shopifyDomain, sessionId);
  }
}
