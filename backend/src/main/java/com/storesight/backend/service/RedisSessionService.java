package com.storesight.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.model.ShopSession;
import com.storesight.backend.repository.ShopSessionRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
// Removed unused CompletableFuture import
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Redis-first session service for high-performance session management
 *
 * <p>This service prioritizes Redis for all session operations, only hitting the database when
 * Redis is unavailable or when data needs to be persisted. This significantly improves performance
 * by reducing database load.
 */
@Service
public class RedisSessionService {

  private static final Logger logger = LoggerFactory.getLogger(RedisSessionService.class);

  // Redis key patterns
  private static final String SESSION_DATA_PREFIX = "session_data:";
  private static final String SESSION_TOKEN_PREFIX = "session_token:";
  private static final String SHOP_SESSIONS_PREFIX = "shop_sessions:";
  private static final String INVALID_SESSION_PREFIX = "invalid_session:";

  // TTL values optimized for performance
  private static final Duration SESSION_DATA_TTL = Duration.ofHours(4); // 4 hours
  private static final Duration SESSION_TOKEN_TTL = Duration.ofHours(2); // 2 hours
  private static final Duration SHOP_SESSIONS_TTL = Duration.ofHours(1); // 1 hour
  private static final Duration INVALID_SESSION_TTL = Duration.ofMinutes(15); // 15 minutes

  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;
  private final ShopSessionRepository
      shopSessionRepository; // Use repository directly instead of ShopService

  @Autowired
  public RedisSessionService(
      StringRedisTemplate redisTemplate,
      ObjectMapper objectMapper,
      ShopSessionRepository
          shopSessionRepository) { // Changed from ShopService to ShopSessionRepository
    this.redisTemplate = redisTemplate;
    this.objectMapper = objectMapper;
    this.shopSessionRepository = shopSessionRepository; // Use repository directly
  }

  /** Get session data from Redis first, fallback to database */
  public Optional<SessionData> getSessionData(String shopDomain, String sessionId) {
    try {
      // Try Redis first
      String sessionDataKey = SESSION_DATA_PREFIX + shopDomain + ":" + sessionId;
      String cachedData = redisTemplate.opsForValue().get(sessionDataKey);

      if (cachedData != null) {
        try {
          SessionData sessionData = objectMapper.readValue(cachedData, SessionData.class);
          logger.debug("Session data found in Redis for {}:{}", shopDomain, sessionId);
          return Optional.of(sessionData);
        } catch (JsonProcessingException e) {
          logger.warn("Failed to deserialize session data from Redis: {}", e.getMessage());
          // Remove corrupted data
          redisTemplate.delete(sessionDataKey);
        }
      }

      // Fallback to database
      logger.debug(
          "Session data not found in Redis, checking database for {}:{}", shopDomain, sessionId);
      return getSessionDataFromDatabase(shopDomain, sessionId);

    } catch (Exception e) {
      logger.warn("Redis unavailable for session data lookup: {}", e.getMessage());
      return getSessionDataFromDatabase(shopDomain, sessionId);
    }
  }

  /** Get session token from Redis first, fallback to database */
  public Optional<String> getSessionToken(String shopDomain, String sessionId) {
    try {
      // Check invalid session cache first
      String invalidKey = INVALID_SESSION_PREFIX + shopDomain + ":" + sessionId;
      String invalidSession = redisTemplate.opsForValue().get(invalidKey);
      if (invalidSession != null) {
        logger.debug("Session marked as invalid in Redis: {}:{}", shopDomain, sessionId);
        return Optional.empty();
      }

      // Try Redis token cache
      String tokenKey = SESSION_TOKEN_PREFIX + shopDomain + ":" + sessionId;
      String cachedToken = redisTemplate.opsForValue().get(tokenKey);

      if (cachedToken != null) {
        logger.debug("Session token found in Redis for {}:{}", shopDomain, sessionId);
        return Optional.of(cachedToken);
      }

      // Fallback to database
      logger.debug(
          "Session token not found in Redis, checking database for {}:{}", shopDomain, sessionId);
      return getSessionTokenFromDatabase(shopDomain, sessionId);

    } catch (Exception e) {
      logger.warn("Redis unavailable for session token lookup: {}", e.getMessage());
      return getSessionTokenFromDatabase(shopDomain, sessionId);
    }
  }

  /** Get all active sessions for a shop from Redis first, fallback to database */
  public List<SessionData> getActiveSessionsForShop(String shopDomain) {
    try {
      // Try Redis first
      String shopSessionsKey = SHOP_SESSIONS_PREFIX + shopDomain;
      String cachedSessions = redisTemplate.opsForValue().get(shopSessionsKey);

      if (cachedSessions != null) {
        try {
          List<SessionData> sessions =
              objectMapper.readValue(
                  cachedSessions,
                  objectMapper
                      .getTypeFactory()
                      .constructCollectionType(List.class, SessionData.class));
          logger.debug(
              "Found {} active sessions in Redis for shop: {}", sessions.size(), shopDomain);
          return sessions;
        } catch (JsonProcessingException e) {
          logger.warn("Failed to deserialize sessions from Redis: {}", e.getMessage());
          // Remove corrupted data
          redisTemplate.delete(shopSessionsKey);
        }
      }

      // Fallback to database
      logger.debug(
          "Active sessions not found in Redis, checking database for shop: {}", shopDomain);
      return getActiveSessionsFromDatabase(shopDomain);

    } catch (Exception e) {
      logger.warn("Redis unavailable for active sessions lookup: {}", e.getMessage());
      return getActiveSessionsFromDatabase(shopDomain);
    }
  }

  /** Cache session data in Redis */
  public void cacheSessionData(String shopDomain, String sessionId, SessionData sessionData) {
    try {
      String sessionDataKey = SESSION_DATA_PREFIX + shopDomain + ":" + sessionId;
      String serializedData = objectMapper.writeValueAsString(sessionData);

      redisTemplate.opsForValue().set(sessionDataKey, serializedData, SESSION_DATA_TTL);
      logger.debug("Cached session data in Redis for {}:{}", shopDomain, sessionId);

      // Also cache token separately for faster access
      cacheSessionToken(shopDomain, sessionId, sessionData.getAccessToken());

      // Update shop sessions list
      updateShopSessionsList(shopDomain);

    } catch (Exception e) {
      logger.warn("Failed to cache session data in Redis: {}", e.getMessage());
    }
  }

  /** Cache session token in Redis */
  public void cacheSessionToken(String shopDomain, String sessionId, String token) {
    try {
      String tokenKey = SESSION_TOKEN_PREFIX + shopDomain + ":" + sessionId;
      redisTemplate.opsForValue().set(tokenKey, token, SESSION_TOKEN_TTL);
      logger.debug("Cached session token in Redis for {}:{}", shopDomain, sessionId);
    } catch (Exception e) {
      logger.warn("Failed to cache session token in Redis: {}", e.getMessage());
    }
  }

  /** Remove session from Redis cache */
  public void removeSessionFromCache(String shopDomain, String sessionId) {
    try {
      // Remove session data
      String sessionDataKey = SESSION_DATA_PREFIX + shopDomain + ":" + sessionId;
      try {
        Boolean deleted = redisTemplate.delete(sessionDataKey);
        if (deleted != null && deleted) {
          logger.debug("Successfully removed session data from Redis: {}", sessionDataKey);
        } else {
          logger.debug("Session data key not found in Redis (already removed): {}", sessionDataKey);
        }
      } catch (Exception e) {
        logger.warn(
            "Failed to remove session data from Redis: {} - {}", sessionDataKey, e.getMessage());
      }

      // Remove session token
      String tokenKey = SESSION_TOKEN_PREFIX + shopDomain + ":" + sessionId;
      try {
        Boolean deleted = redisTemplate.delete(tokenKey);
        if (deleted != null && deleted) {
          logger.debug("Successfully removed session token from Redis: {}", tokenKey);
        } else {
          logger.debug("Session token key not found in Redis (already removed): {}", tokenKey);
        }
      } catch (Exception e) {
        logger.warn("Failed to remove session token from Redis: {} - {}", tokenKey, e.getMessage());
      }

      // Mark as invalid to prevent repeated lookups
      String invalidKey = INVALID_SESSION_PREFIX + shopDomain + ":" + sessionId;
      try {
        redisTemplate.opsForValue().set(invalidKey, "invalid", INVALID_SESSION_TTL);
        logger.debug("Marked session as invalid in Redis: {}", invalidKey);
      } catch (Exception e) {
        logger.warn(
            "Failed to mark session as invalid in Redis: {} - {}", invalidKey, e.getMessage());
      }

      // Update shop sessions list
      try {
        updateShopSessionsList(shopDomain);
      } catch (Exception e) {
        logger.warn("Failed to update shop sessions list for {}: {}", shopDomain, e.getMessage());
      }

      logger.debug("Completed session removal from Redis cache: {}:{}", shopDomain, sessionId);
    } catch (Exception e) {
      logger.warn("Failed to remove session from Redis cache: {}", e.getMessage());
    }
  }

  /** Update session last accessed time in Redis */
  public void updateSessionLastAccessed(String shopDomain, String sessionId) {
    try {
      Optional<SessionData> sessionDataOpt = getSessionData(shopDomain, sessionId);
      if (sessionDataOpt.isPresent()) {
        SessionData sessionData = sessionDataOpt.get();
        sessionData.setLastAccessedAt(LocalDateTime.now());
        cacheSessionData(shopDomain, sessionId, sessionData);
        logger.debug("Updated last accessed time in Redis for {}:{}", shopDomain, sessionId);
      }
    } catch (Exception e) {
      logger.warn("Failed to update last accessed time in Redis: {}", e.getMessage());
    }
  }

  /** Get session statistics from Redis */
  public Map<String, Object> getSessionStatistics() {
    try {
      Map<String, Object> stats = new java.util.HashMap<>();

      // Count active sessions in Redis
      Set<String> sessionKeys = redisTemplate.keys(SESSION_DATA_PREFIX + "*");
      int totalSessions = sessionKeys != null ? sessionKeys.size() : 0;

      // Count active tokens
      Set<String> tokenKeys = redisTemplate.keys(SESSION_TOKEN_PREFIX + "*");
      int activeTokens = tokenKeys != null ? tokenKeys.size() : 0;

      // Count shops with sessions
      Set<String> shopKeys = redisTemplate.keys(SHOP_SESSIONS_PREFIX + "*");
      int shopsWithSessions = shopKeys != null ? shopKeys.size() : 0;

      stats.put("totalSessionsInRedis", totalSessions);
      stats.put("activeTokensInRedis", activeTokens);
      stats.put("shopsWithSessionsInRedis", shopsWithSessions);
      stats.put("redisAvailable", true);

      logger.debug("Session statistics from Redis: {}", stats);
      return stats;

    } catch (Exception e) {
      logger.warn("Failed to get session statistics from Redis: {}", e.getMessage());
      return Map.of("redisAvailable", false, "error", e.getMessage());
    }
  }

  // Database fallback methods
  private Optional<SessionData> getSessionDataFromDatabase(String shopDomain, String sessionId) {
    try {
      Optional<ShopSession> sessionOpt = shopSessionRepository.findBySessionId(sessionId);
      if (sessionOpt.isPresent()) {
        ShopSession session = sessionOpt.get();
        SessionData sessionData = SessionData.fromShopSession(session);

        // Cache in Redis for future requests
        cacheSessionData(shopDomain, sessionId, sessionData);
        return Optional.of(sessionData);
      }
      return Optional.empty();
    } catch (Exception e) {
      logger.warn("Failed to get session data from database: {}", e.getMessage());
      return Optional.empty();
    }
  }

  private Optional<String> getSessionTokenFromDatabase(String shopDomain, String sessionId) {
    try {
      Optional<ShopSession> sessionOpt =
          shopSessionRepository.findActiveSessionByShopDomainAndSessionId(shopDomain, sessionId);
      if (sessionOpt.isPresent()) {
        String token = sessionOpt.get().getAccessToken();
        // Cache in Redis for future requests
        cacheSessionToken(shopDomain, sessionId, token);
        return Optional.of(token);
      }
      return Optional.empty();
    } catch (Exception e) {
      logger.warn("Failed to get session token from database: {}", e.getMessage());
      return Optional.empty();
    }
  }

  private List<SessionData> getActiveSessionsFromDatabase(String shopDomain) {
    try {
      // Since we don't have direct access to ShopRepository, we'll need to work with what we have
      // For now, we'll return an empty list and let the calling service handle this
      // This is a limitation of the current architecture - we should consider refactoring
      logger.warn(
          "Cannot get active sessions from database without Shop entity - returning empty list");
      return new ArrayList<>();
    } catch (Exception e) {
      logger.warn("Failed to get active sessions from database: {}", e.getMessage());
      return new ArrayList<>();
    }
  }

  private void updateShopSessionsList(String shopDomain) {
    try {
      List<SessionData> sessions = getActiveSessionsFromDatabase(shopDomain);
      cacheShopSessionsList(shopDomain, sessions);
    } catch (Exception e) {
      logger.warn("Failed to update shop sessions list: {}", e.getMessage());
    }
  }

  private void cacheShopSessionsList(String shopDomain, List<SessionData> sessions) {
    try {
      String shopSessionsKey = SHOP_SESSIONS_PREFIX + shopDomain;
      String serializedSessions = objectMapper.writeValueAsString(sessions);
      redisTemplate.opsForValue().set(shopSessionsKey, serializedSessions, SHOP_SESSIONS_TTL);
      logger.debug("Cached {} sessions for shop: {}", sessions.size(), shopDomain);
    } catch (Exception e) {
      logger.warn("Failed to cache shop sessions list: {}", e.getMessage());
    }
  }

  // Removed duplicate updateSessionLastAccessedAsync method - using ShopService's implementation

  /** Session data wrapper for Redis caching */
  public static class SessionData {
    private String sessionId;
    private String shopDomain;
    private String accessToken;
    private String ipAddress;
    private String userAgent;
    private LocalDateTime createdAt;
    private LocalDateTime lastAccessedAt;
    private LocalDateTime expiresAt;
    private boolean isActive;
    private boolean isExpired;

    public SessionData() {}

    public static SessionData fromShopSession(ShopSession session) {
      SessionData data = new SessionData();
      data.setSessionId(session.getSessionId());
      data.setShopDomain(session.getShop().getShopifyDomain());
      data.setAccessToken(session.getAccessToken());
      data.setIpAddress(session.getIpAddress());
      data.setUserAgent(session.getUserAgent());
      data.setCreatedAt(session.getCreatedAt());
      data.setLastAccessedAt(session.getLastAccessedAt());
      data.setExpiresAt(session.getExpiresAt());
      data.setActive(session.getIsActive());
      data.setExpired(session.isExpired());
      return data;
    }

    // Getters and setters
    public String getSessionId() {
      return sessionId;
    }

    public void setSessionId(String sessionId) {
      this.sessionId = sessionId;
    }

    public String getShopDomain() {
      return shopDomain;
    }

    public void setShopDomain(String shopDomain) {
      this.shopDomain = shopDomain;
    }

    public String getAccessToken() {
      return accessToken;
    }

    public void setAccessToken(String accessToken) {
      this.accessToken = accessToken;
    }

    public String getIpAddress() {
      return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
      this.ipAddress = ipAddress;
    }

    public String getUserAgent() {
      return userAgent;
    }

    public void setUserAgent(String userAgent) {
      this.userAgent = userAgent;
    }

    public LocalDateTime getCreatedAt() {
      return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
      this.createdAt = createdAt;
    }

    public LocalDateTime getLastAccessedAt() {
      return lastAccessedAt;
    }

    public void setLastAccessedAt(LocalDateTime lastAccessedAt) {
      this.lastAccessedAt = lastAccessedAt;
    }

    public LocalDateTime getExpiresAt() {
      return expiresAt;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
      this.expiresAt = expiresAt;
    }

    public boolean isActive() {
      return isActive;
    }

    public void setActive(boolean active) {
      isActive = active;
    }

    public boolean isExpired() {
      return isExpired;
    }

    public void setExpired(boolean expired) {
      isExpired = expired;
    }
  }
}
