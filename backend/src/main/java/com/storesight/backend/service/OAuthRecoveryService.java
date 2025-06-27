package com.storesight.backend.service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class OAuthRecoveryService {

  private static final Logger logger = LoggerFactory.getLogger(OAuthRecoveryService.class);

  @Autowired private ShopService shopService;

  @Autowired private StringRedisTemplate redisTemplate;

  // Track failed authentication attempts
  private final Map<String, Integer> failedAuthAttempts = new ConcurrentHashMap<>();
  private final Map<String, Long> lastFailureTime = new ConcurrentHashMap<>();

  private static final int MAX_FAILED_ATTEMPTS = 3;
  private static final long FAILURE_RESET_WINDOW = 300000; // 5 minutes

  /** Handle authentication failure and attempt recovery */
  public boolean handleAuthFailure(String shop, String sessionId, String error) {
    logger.warn("OAuth failure for shop: {} session: {} error: {}", shop, sessionId, error);

    // Track failure
    trackFailure(shop);

    // Check if we should attempt recovery
    if (shouldAttemptRecovery(shop)) {
      return attemptRecovery(shop, sessionId);
    }

    return false;
  }

  /** Track authentication failure */
  private void trackFailure(String shop) {
    long now = System.currentTimeMillis();
    Long lastFailure = lastFailureTime.get(shop);

    // Reset counter if outside reset window
    if (lastFailure == null || (now - lastFailure) > FAILURE_RESET_WINDOW) {
      failedAuthAttempts.put(shop, 1);
    } else {
      failedAuthAttempts.merge(shop, 1, Integer::sum);
    }

    lastFailureTime.put(shop, now);

    logger.info(
        "Auth failure tracked for shop: {} (attempts: {})", shop, failedAuthAttempts.get(shop));
  }

  /** Check if recovery should be attempted */
  private boolean shouldAttemptRecovery(String shop) {
    Integer attempts = failedAuthAttempts.get(shop);
    return attempts != null && attempts <= MAX_FAILED_ATTEMPTS;
  }

  /** Attempt to recover authentication */
  private boolean attemptRecovery(String shop, String sessionId) {
    logger.info("Attempting OAuth recovery for shop: {}", shop);

    try {
      // Try to get token from database as fallback
      String token = shopService.getTokenForShop(shop, "recovery");

      if (token != null) {
        // Refresh session with recovered token
        shopService.saveShop(shop, token, sessionId);
        logger.info("OAuth recovery successful for shop: {}", shop);

        // Clear failure tracking
        failedAuthAttempts.remove(shop);
        lastFailureTime.remove(shop);

        return true;
      } else {
        logger.warn("No recovery token found for shop: {}", shop);
        return false;
      }

    } catch (Exception e) {
      logger.error("OAuth recovery failed for shop: {}", shop, e);
      return false;
    }
  }

  /** Check if shop is in recovery mode */
  public boolean isInRecoveryMode(String shop) {
    Integer attempts = failedAuthAttempts.get(shop);
    return attempts != null && attempts > MAX_FAILED_ATTEMPTS;
  }

  /** Get recovery status for a shop */
  public Map<String, Object> getRecoveryStatus(String shop) {
    Map<String, Object> status = new java.util.HashMap<>();

    Integer attempts = failedAuthAttempts.get(shop);
    Long lastFailure = lastFailureTime.get(shop);

    status.put("failed_attempts", attempts != null ? attempts : 0);
    status.put("last_failure_time", lastFailure);
    status.put("in_recovery_mode", isInRecoveryMode(shop));
    status.put("can_attempt_recovery", shouldAttemptRecovery(shop));

    if (lastFailure != null) {
      long timeUntilReset = FAILURE_RESET_WINDOW - (System.currentTimeMillis() - lastFailure);
      status.put("time_until_reset_ms", Math.max(0, timeUntilReset));
    }

    return status;
  }

  /** Reset failure tracking for a shop */
  public void resetFailureTracking(String shop) {
    failedAuthAttempts.remove(shop);
    lastFailureTime.remove(shop);
    logger.info("Reset failure tracking for shop: {}", shop);
  }

  /** Store OAuth state for recovery */
  public void storeOAuthState(String state, String shop, Duration ttl) {
    try {
      String key = "oauth:recovery:" + state;
      redisTemplate.opsForValue().set(key, shop, ttl);
      logger.debug("Stored OAuth recovery state: {} for shop: {}", state, shop);
    } catch (Exception e) {
      logger.warn("Failed to store OAuth recovery state: {}", e.getMessage());
    }
  }

  /** Retrieve OAuth state for recovery */
  public String getOAuthState(String state) {
    try {
      String key = "oauth:recovery:" + state;
      return redisTemplate.opsForValue().get(key);
    } catch (Exception e) {
      logger.warn("Failed to retrieve OAuth recovery state: {}", e.getMessage());
      return null;
    }
  }

  /** Clear OAuth state after use */
  public void clearOAuthState(String state) {
    try {
      String key = "oauth:recovery:" + state;
      redisTemplate.delete(key);
      logger.debug("Cleared OAuth recovery state: {}", state);
    } catch (Exception e) {
      logger.warn("Failed to clear OAuth recovery state: {}", e.getMessage());
    }
  }
}
