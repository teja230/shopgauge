package com.storesight.backend.service;

import com.storesight.backend.repository.ShopSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
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

  private final ShopSessionRepository shopSessionRepository;

  @Autowired
  public AsyncSessionService(ShopSessionRepository shopSessionRepository) {
    this.shopSessionRepository = shopSessionRepository;
  }

  /**
   * Asynchronously update session last accessed time This method runs in a separate thread pool to
   * avoid blocking main requests and uses its own transaction context to prevent read-only
   * transaction violations.
   *
   * @param sessionId The session ID to update
   */
  @Async("sessionTaskExecutor")
  @Transactional(timeout = 3) // Short timeout for simple update operations
  public void updateSessionLastAccessedAsync(String sessionId) {
    try {
      if (sessionId == null || sessionId.trim().isEmpty()) {
        logger.warn("Attempted to update last accessed time for null/empty session ID");
        return;
      }

      // Use the repository's dedicated @Modifying @Transactional method
      shopSessionRepository.updateLastAccessedTime(sessionId);

      logger.debug("Session last accessed time updated asynchronously for session: {}", sessionId);
    } catch (Exception e) {
      logger.warn(
          "Failed to update last accessed time for session {}: {}", sessionId, e.getMessage());
      // Don't propagate the exception as this is a non-critical background operation
      // The main request should continue even if session update fails
    }
  }

  /**
   * Asynchronously update multiple sessions' last accessed time Useful for batch operations
   *
   * @param sessionIds Array of session IDs to update
   */
  @Async("sessionTaskExecutor")
  @Transactional(timeout = 10) // Longer timeout for batch operations
  public void updateMultipleSessionsLastAccessedAsync(String[] sessionIds) {
    if (sessionIds == null || sessionIds.length == 0) {
      return;
    }

    int successCount = 0;
    int failureCount = 0;

    for (String sessionId : sessionIds) {
      try {
        if (sessionId != null && !sessionId.trim().isEmpty()) {
          shopSessionRepository.updateLastAccessedTime(sessionId);
          successCount++;
        }
      } catch (Exception e) {
        failureCount++;
        logger.warn(
            "Failed to update last accessed time for session {}: {}", sessionId, e.getMessage());
      }
    }

    logger.debug(
        "Batch session update completed: {} successful, {} failed", successCount, failureCount);
  }

  /**
   * Asynchronously perform session heartbeat update This is a more comprehensive update that
   * includes validation
   *
   * @param sessionId The session ID to update
   * @param shopDomain The shop domain for validation
   * @return true if update was successful, false otherwise
   */
  @Async("sessionTaskExecutor")
  @Transactional(timeout = 5)
  public void performSessionHeartbeatAsync(String sessionId, String shopDomain) {
    try {
      if (sessionId == null || sessionId.trim().isEmpty()) {
        logger.warn("Attempted heartbeat for null/empty session ID");
        return;
      }

      // Validate that session exists and is active before updating
      var sessionOpt =
          shopSessionRepository.findActiveSessionByShopDomainAndSessionId(shopDomain, sessionId);

      if (sessionOpt.isPresent()) {
        shopSessionRepository.updateLastAccessedTime(sessionId);
        logger.debug(
            "Session heartbeat completed for session: {} in shop: {}", sessionId, shopDomain);
      } else {
        logger.debug(
            "Session not found or inactive during heartbeat: {} in shop: {}",
            sessionId,
            shopDomain);
      }
    } catch (Exception e) {
      logger.warn(
          "Failed to perform session heartbeat for session {} in shop {}: {}",
          sessionId,
          shopDomain,
          e.getMessage());
    }
  }
}
