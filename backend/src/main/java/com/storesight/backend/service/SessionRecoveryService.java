package com.storesight.backend.service;

import com.storesight.backend.model.ShopSession;
import com.storesight.backend.repository.ShopSessionRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service for recovering and fixing session validation issues This service helps resolve the
 * "Session validation failed but token exists" problems
 */
@Service
public class SessionRecoveryService {

  private static final Logger logger = LoggerFactory.getLogger(SessionRecoveryService.class);

  private final ShopSessionRepository shopSessionRepository;
  private final StringRedisTemplate redisTemplate;
  private final ShopService shopService;

  // Track recovery attempts to prevent infinite loops
  private final ConcurrentHashMap<String, AtomicLong> recoveryAttempts = new ConcurrentHashMap<>();
  private static final int MAX_RECOVERY_ATTEMPTS = 3;
  private static final long RECOVERY_COOLDOWN_MS = 300000; // 5 minutes

  @Autowired
  public SessionRecoveryService(
      ShopSessionRepository shopSessionRepository,
      StringRedisTemplate redisTemplate,
      ShopService shopService) {
    this.shopSessionRepository = shopSessionRepository;
    this.redisTemplate = redisTemplate;
    this.shopService = shopService;
  }

  /** Attempt to recover a session that has validation issues */
  public boolean attemptSessionRecovery(String shopDomain, String sessionId) {
    String recoveryKey = shopDomain + ":" + sessionId;
    AtomicLong attempts = recoveryAttempts.computeIfAbsent(recoveryKey, k -> new AtomicLong(0));

    // Check if we've exceeded recovery attempts
    if (attempts.get() >= MAX_RECOVERY_ATTEMPTS) {
      long lastAttempt = attempts.get();
      if (System.currentTimeMillis() - lastAttempt < RECOVERY_COOLDOWN_MS) {
        logger.debug("Session recovery cooldown active for {}:{}", shopDomain, sessionId);
        return false;
      }
      // Reset attempts after cooldown
      attempts.set(0);
    }

    try {
      logger.info(
          "Attempting session recovery for {}:{} (attempt {})",
          shopDomain,
          sessionId,
          attempts.get() + 1);

      // Step 1: Clear any invalid session markers
      clearInvalidSessionMarkers(shopDomain, sessionId);

      // Step 2: Check if session exists in database
      Optional<ShopSession> sessionOpt =
          shopSessionRepository.findActiveSessionByShopDomainAndSessionId(shopDomain, sessionId);

      if (sessionOpt.isPresent()) {
        ShopSession session = sessionOpt.get();

        // Step 3: Validate session state
        if (isSessionValid(session)) {
          // Step 4: Refresh session in Redis
          refreshSessionInRedis(shopDomain, sessionId, session.getAccessToken());

          // Step 5: Update last accessed time
          updateSessionLastAccessed(session);

          logger.info("Session recovery successful for {}:{}", shopDomain, sessionId);
          attempts.set(0); // Reset attempts on success
          return true;
        } else {
          logger.warn(
              "Session {}:{} exists but is invalid (expired/inactive)", shopDomain, sessionId);
          markSessionAsInvalid(shopDomain, sessionId);
        }
      } else {
        logger.warn("Session {}:{} not found in database", shopDomain, sessionId);

        // Step 6: Try to find any valid session for this shop
        Optional<ShopSession> fallbackSession = findValidFallbackSession(shopDomain);
        if (fallbackSession.isPresent()) {
          ShopSession session = fallbackSession.get();
          logger.info("Using fallback session {} for shop {}", session.getSessionId(), shopDomain);

          // Set a header to indicate session recovery was attempted
          // This will be checked by exception handlers to prevent cascade errors
          try {
            jakarta.servlet.http.HttpServletRequest request =
                ((org.springframework.web.context.request.ServletWebRequest)
                        org.springframework.web.context.request.RequestContextHolder
                            .currentRequestAttributes())
                    .getRequest();
            request.setAttribute("X-Session-Recovery", "true");
          } catch (Exception e) {
            logger.debug("Could not set session recovery attribute: {}", e.getMessage());
          }

          // Update the current session ID to use the fallback
          refreshSessionInRedis(shopDomain, sessionId, session.getAccessToken());
          return true;
        }
      }

      // Increment recovery attempts
      attempts.incrementAndGet();
      return false;

    } catch (Exception e) {
      logger.error("Session recovery failed for {}:{} - {}", shopDomain, sessionId, e.getMessage());
      attempts.incrementAndGet();
      return false;
    }
  }

  /** Clear invalid session markers from Redis */
  private void clearInvalidSessionMarkers(String shopDomain, String sessionId) {
    try {
      String invalidKey = "invalid_session:" + shopDomain + ":" + sessionId;
      redisTemplate.delete(invalidKey);

      String failureKey = "validation_failure_count:" + shopDomain + ":" + sessionId;
      redisTemplate.delete(failureKey);

      logger.debug("Cleared invalid session markers for {}:{}", shopDomain, sessionId);
    } catch (Exception e) {
      logger.warn("Failed to clear invalid session markers: {}", e.getMessage());
    }
  }

  /** Check if a session is valid */
  private boolean isSessionValid(ShopSession session) {
    // Check if session is active
    if (session.getIsActive() == null || !session.getIsActive()) {
      return false;
    }

    // Check if session has expired
    if (session.getExpiresAt() != null && session.getExpiresAt().isBefore(LocalDateTime.now())) {
      return false;
    }

    // Check if access token exists
    if (session.getAccessToken() == null || session.getAccessToken().trim().isEmpty()) {
      return false;
    }

    return true;
  }

  /** Refresh session in Redis cache */
  private void refreshSessionInRedis(String shopDomain, String sessionId, String accessToken) {
    try {
      String tokenKey = "shop_token:" + shopDomain + ":" + sessionId;
      redisTemplate
          .opsForValue()
          .set(tokenKey, accessToken, java.time.Duration.ofHours(4)); // 4 hour TTL

      logger.debug("Refreshed session in Redis for {}:{}", shopDomain, sessionId);
    } catch (Exception e) {
      logger.warn("Failed to refresh session in Redis: {}", e.getMessage());
    }
  }

  /** Update session last accessed time */
  @Transactional
  private void updateSessionLastAccessed(ShopSession session) {
    try {
      session.setLastAccessedAt(LocalDateTime.now());
      shopSessionRepository.save(session);
      logger.debug("Updated last accessed time for session: {}", session.getSessionId());
    } catch (Exception e) {
      logger.warn("Failed to update session last accessed time: {}", e.getMessage());
    }
  }

  /** Mark session as invalid in Redis */
  private void markSessionAsInvalid(String shopDomain, String sessionId) {
    try {
      String invalidKey = "invalid_session:" + shopDomain + ":" + sessionId;
      redisTemplate
          .opsForValue()
          .set(invalidKey, "invalid", java.time.Duration.ofMinutes(30)); // 30 minute TTL

      logger.debug("Marked session as invalid: {}:{}", shopDomain, sessionId);
    } catch (Exception e) {
      logger.warn("Failed to mark session as invalid: {}", e.getMessage());
    }
  }

  /** Find a valid fallback session for the shop */
  private Optional<ShopSession> findValidFallbackSession(String shopDomain) {
    try {
      // Use the correct method name from the repository
      Optional<ShopSession> fallbackSession =
          shopSessionRepository.findMostRecentActiveSessionByDomain(shopDomain);

      if (fallbackSession.isPresent() && isSessionValid(fallbackSession.get())) {
        return fallbackSession;
      }

      return Optional.empty();
    } catch (Exception e) {
      logger.warn("Failed to find fallback session for shop {}: {}", shopDomain, e.getMessage());
      return Optional.empty();
    }
  }

  /** Clean up recovery attempts tracking */
  public void cleanupRecoveryTracking() {
    long now = System.currentTimeMillis();
    recoveryAttempts
        .entrySet()
        .removeIf(
            entry -> {
              long lastAttempt = entry.getValue().get();
              return (now - lastAttempt) > RECOVERY_COOLDOWN_MS;
            });
  }

  /** Get recovery statistics */
  public String getRecoveryStatistics() {
    return String.format("Active recovery tracking: %d sessions", recoveryAttempts.size());
  }
}
