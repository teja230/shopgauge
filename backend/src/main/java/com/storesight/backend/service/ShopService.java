package com.storesight.backend.service;

import com.storesight.backend.model.Shop;
import com.storesight.backend.model.ShopSession;
import com.storesight.backend.repository.ShopRepository;
import com.storesight.backend.repository.ShopSessionRepository;
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

@Service
@Transactional
public class ShopService {
  private static final Logger logger = LoggerFactory.getLogger(ShopService.class);

  private final ShopRepository shopRepository;
  private final ShopSessionRepository shopSessionRepository;
  private final StringRedisTemplate redisTemplate;

  // Redis key patterns for backward compatibility and caching
  private static final String SHOP_TOKEN_PREFIX = "shop_token:";
  private static final String SHOP_SESSION_PREFIX = "shop_session:";
  private static final String ACTIVE_SESSIONS_PREFIX = "active_sessions:";

  // TTL values
  private static final int REDIS_CACHE_TTL_MINUTES = 30; // Shorter TTL for cache
  private static final int SESSION_INACTIVITY_HOURS = 24; // Mark sessions inactive after 24 hours
  private static final int SESSION_CLEANUP_DAYS = 7; // Delete old inactive sessions after 7 days

  @Autowired
  public ShopService(
      ShopRepository shopRepository,
      ShopSessionRepository shopSessionRepository,
      StringRedisTemplate redisTemplate) {
    this.shopRepository = shopRepository;
    this.shopSessionRepository = shopSessionRepository;
    this.redisTemplate = redisTemplate;
  }

  /**
   * Save shop and create/update session. This method handles multiple concurrent sessions properly.
   */
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

    // Find or create shop
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

    // Create or update session
    ShopSession session = createOrUpdateSession(shop, validSessionId, accessToken, request);

    // Cache in Redis for performance
    cacheShopSession(shopifyDomain, validSessionId, accessToken);

    // Update active sessions list
    updateActiveSessionsList(shopifyDomain);

    logger.info(
        "Shop and session saved successfully: {} with session: {}", shopifyDomain, validSessionId);
    return session;
  }

  /** Backward compatibility method */
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

  /** Get access token for a specific shop and session */
  public String getTokenForShop(String shopifyDomain, String sessionId) {
    logger.debug("Getting token for shop: {} and session: {}", shopifyDomain, sessionId);

    if (sessionId == null) {
      return getTokenForShopFallback(shopifyDomain);
    }

    // Try Redis cache first
    String cachedToken =
        redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId);
    if (cachedToken != null) {
      logger.debug(
          "Found token in Redis cache for shop: {} and session: {}", shopifyDomain, sessionId);
      updateSessionLastAccessed(sessionId);
      return cachedToken;
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

  /** Get token for shop without specific session (fallback method) */
  private String getTokenForShopFallback(String shopifyDomain) {
    logger.debug("Getting fallback token for shop: {}", shopifyDomain);

    // Try Redis cache (shop-only key)
    String cachedToken = redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain);
    if (cachedToken != null) {
      logger.debug("Found fallback token in Redis for shop: {}", shopifyDomain);
      return cachedToken;
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

        logger.debug("Found fallback token from shop record for shop: {}", shopifyDomain);
        return token;
      }
    }

    logger.warn("No token found for shop: {}", shopifyDomain);
    return null;
  }

  /** Remove/deactivate a specific session */
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
  public List<ShopSession> getActiveSessionsForShop(String shopifyDomain) {
    Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopifyDomain);
    if (shopOpt.isPresent()) {
      return shopSessionRepository.findByShopAndIsActiveTrueOrderByLastAccessedAtDesc(
          shopOpt.get());
    }
    return List.of();
  }

  /** Get session information for debugging */
  public Optional<ShopSession> getSessionInfo(String sessionId) {
    return shopSessionRepository.findBySessionId(sessionId);
  }

  /** Backward compatibility method */
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
      logger.warn("Failed to cache tokens for shop {}: {}", shopifyDomain, e.getMessage());
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

  /** Clean up expired sessions - runs every hour */
  @Scheduled(fixedRate = 3600000) // 1 hour
  public void cleanupExpiredSessions() {
    try {
      List<ShopSession> expiredSessions = shopSessionRepository.findExpiredSessions();
      for (ShopSession session : expiredSessions) {
        session.deactivate();
        shopSessionRepository.save(session);

        // Clear from cache
        if (session.getShop() != null) {
          redisTemplate.delete(
              SHOP_TOKEN_PREFIX
                  + session.getShop().getShopifyDomain()
                  + ":"
                  + session.getSessionId());
        }
      }

      if (!expiredSessions.isEmpty()) {
        logger.info("Deactivated {} expired sessions", expiredSessions.size());
      }
    } catch (Exception e) {
      logger.error("Error during expired session cleanup: {}", e.getMessage(), e);
    }
  }

  /** Clean up old inactive sessions - runs daily at 2 AM */
  @Scheduled(cron = "0 0 2 * * *")
  public void cleanupOldInactiveSessions() {
    try {
      LocalDateTime cutoffDate = LocalDateTime.now().minusDays(SESSION_CLEANUP_DAYS);

      // Find and deactivate old sessions
      List<ShopSession> oldSessions =
          shopSessionRepository.findInactiveSessionsOlderThan(cutoffDate);
      for (ShopSession session : oldSessions) {
        session.deactivate();
        shopSessionRepository.save(session);
      }

      // Delete very old inactive sessions
      LocalDateTime deleteCutoffDate = LocalDateTime.now().minusDays(SESSION_CLEANUP_DAYS * 2);
      shopSessionRepository.deleteOldInactiveSessions(deleteCutoffDate);

      if (!oldSessions.isEmpty()) {
        logger.info("Cleaned up {} old sessions", oldSessions.size());
      }
    } catch (Exception e) {
      logger.error("Error during old session cleanup: {}", e.getMessage(), e);
    }
  }

  // Backward compatibility methods (deprecated but maintained for existing code)

  @Deprecated
  public void removeToken(String shopifyDomain, String sessionId) {
    logger.warn("Using deprecated removeToken method. Use removeSession instead.");
    removeSession(shopifyDomain, sessionId);
  }
}
