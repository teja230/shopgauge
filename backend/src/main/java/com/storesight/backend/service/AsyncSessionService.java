package com.storesight.backend.service;

import com.storesight.backend.repository.ShopSessionRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Asynchronous session management service to handle session updates without blocking main request
 * threads or causing transaction violations.
 *
 * <p>This service is specifically designed to handle session last accessed time updates and other
 * non-critical session operations that should not block user requests.
 */
@Service
public class AsyncSessionService {

  private static final Logger logger = LoggerFactory.getLogger(AsyncSessionService.class);

  // Throttling configuration to reduce database load
  private static final int UPDATE_THROTTLE_MINUTES = 5; // Only update every 5 minutes
  private final Map<String, LocalDateTime> lastUpdateTimes = new ConcurrentHashMap<>();

  private final ShopSessionRepository shopSessionRepository;

  @Autowired
  public AsyncSessionService(ShopSessionRepository shopSessionRepository) {
    this.shopSessionRepository = shopSessionRepository;
  }

  /**
   * Asynchronously update session last accessed time with throttling and error handling This method
   * runs in a separate thread pool to avoid blocking main requests and uses its own transaction
   * context to prevent read-only transaction violations.
   *
   * @param sessionId The session ID to update
   */
  @Async("sessionTaskExecutor")
  @Transactional(timeout = 5, propagation = Propagation.REQUIRES_NEW)
  public void updateSessionLastAccessedAsync(String sessionId) {
    try {
      // Validate session ID
      if (sessionId == null || sessionId.trim().isEmpty()) {
        logger.debug("Skipping session update for null/empty session ID");
        return;
      }

      // Check if we should throttle this update
      if (shouldThrottleUpdate(sessionId)) {
        logger.debug("Throttling session update for session: {}", sessionId);
        return;
      }

      // Perform the update with error handling
      shopSessionRepository.updateLastAccessedTime(sessionId);

      // Record the update time for throttling
      lastUpdateTimes.put(sessionId, LocalDateTime.now());
      logger.debug("Updated last accessed time for session: {}", sessionId);

    } catch (Exception e) {
      logger.warn(
          "Failed to update session last accessed time for session {}: {}",
          sessionId,
          e.getMessage());
      // Don't re-throw the exception to prevent it from bubbling up to the main request
    }
  }

  /** Check if we should throttle the session update to reduce database load */
  private boolean shouldThrottleUpdate(String sessionId) {
    LocalDateTime lastUpdate = lastUpdateTimes.get(sessionId);
    if (lastUpdate == null) {
      return false; // First update, allow it
    }

    LocalDateTime now = LocalDateTime.now();
    return now.isBefore(lastUpdate.plusMinutes(UPDATE_THROTTLE_MINUTES));
  }

  /** Batch update multiple sessions at once to reduce database calls */
  @Async("sessionTaskExecutor")
  @Transactional(timeout = 10, propagation = Propagation.REQUIRES_NEW)
  public void batchUpdateSessionsAsync(List<String> sessionIds) {
    try {
      List<String> sessionsToUpdate =
          sessionIds.stream()
              .filter(sessionId -> !shouldThrottleUpdate(sessionId))
              .collect(Collectors.toList());

      if (sessionsToUpdate.isEmpty()) {
        logger.debug("No sessions need updating due to throttling");
        return;
      }

      // Batch update all sessions (individual updates for now)
      LocalDateTime now = LocalDateTime.now();
      for (String sessionId : sessionsToUpdate) {
        shopSessionRepository.updateLastAccessedTime(sessionId);
        lastUpdateTimes.put(sessionId, now);
      }

      logger.debug("Batch updated {} sessions", sessionsToUpdate.size());
    } catch (Exception e) {
      logger.warn("Failed to batch update sessions: {}", e.getMessage());
      // Don't re-throw to prevent bubbling up to main request
    }
  }

  /** Perform session heartbeat with optimized database access */
  @Async("sessionTaskExecutor")
  @Transactional(timeout = 5, propagation = Propagation.REQUIRES_NEW)
  public void performSessionHeartbeatAsync(String sessionId, String shopDomain) {
    try {
      // Validate inputs
      if (sessionId == null || sessionId.trim().isEmpty()) {
        logger.debug("Skipping heartbeat for null/empty session ID");
        return;
      }

      // Only update if not throttled
      if (!shouldThrottleUpdate(sessionId)) {
        shopSessionRepository.updateLastAccessedTime(sessionId);
        lastUpdateTimes.put(sessionId, LocalDateTime.now());
        logger.debug("Session heartbeat updated for session: {}", sessionId);
      }
    } catch (Exception e) {
      logger.warn("Session heartbeat failed for session {}: {}", sessionId, e.getMessage());
      // Don't re-throw to prevent bubbling up to main request
    }
  }

  /** Clean up old throttling entries to prevent memory leaks */
  @Scheduled(fixedRate = 3600000) // Run every hour
  public void cleanupThrottlingCache() {
    LocalDateTime cutoff = LocalDateTime.now().minusHours(1);
    lastUpdateTimes.entrySet().removeIf(entry -> entry.getValue().isBefore(cutoff));
    logger.debug("Cleaned up throttling cache, {} entries remaining", lastUpdateTimes.size());
  }
}
