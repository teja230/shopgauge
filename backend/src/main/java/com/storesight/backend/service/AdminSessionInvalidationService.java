package com.storesight.backend.service;

import com.storesight.backend.model.ShopSession;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Service for handling admin-initiated session invalidations Provides proper session invalidation
 * with notifications to affected users
 */
@Service
public class AdminSessionInvalidationService {

  private static final Logger logger =
      LoggerFactory.getLogger(AdminSessionInvalidationService.class);

  @Autowired private ShopService shopService;
  @Autowired private SseService sseService;
  @Autowired private AdminAuthService adminAuthService;

  /**
   * Invalidate all sessions for a specific shop and notify users This is the primary method for
   * admin-initiated session invalidation
   *
   * @param shopDomain The shop domain to invalidate sessions for
   * @param adminUsername The username of the admin performing the invalidation
   * @param reason The reason for invalidation (optional)
   * @param clientIp The IP address of the admin
   * @return Map containing invalidation results
   */
  public Map<String, Object> invalidateAllSessionsForShop(
      String shopDomain, String adminUsername, String reason, String clientIp) {

    Map<String, Object> result = new HashMap<>();

    try {
      logger.info(
          "Admin {} initiating session invalidation for shop: {} - Reason: {}",
          adminUsername,
          shopDomain,
          reason);

      // Step 1: Get all active sessions for the shop
      List<ShopSession> activeSessions = shopService.getActiveSessionsForShop(shopDomain);

      if (activeSessions.isEmpty()) {
        result.put("success", true);
        result.put("message", "No active sessions found for shop: " + shopDomain);
        result.put("invalidatedSessions", 0);
        result.put("totalSessions", 0);
        return result;
      }

      // Step 2: Send pre-invalidation notification to all connected users
      sendPreInvalidationNotification(shopDomain, adminUsername, reason);

      // Step 3: Invalidate all sessions
      int successfullyInvalidated = 0;
      for (ShopSession session : activeSessions) {
        try {
          // Force invalidate the session
          shopService.forceInvalidateSession(shopDomain, session.getSessionId());
          successfullyInvalidated++;

          logger.debug(
              "Successfully invalidated session {} for shop: {}",
              session.getSessionId(),
              shopDomain);
        } catch (Exception e) {
          logger.warn(
              "Failed to invalidate session {} for shop {}: {}",
              session.getSessionId(),
              shopDomain,
              e.getMessage());
          // Continue with other sessions even if one fails
        }
      }

      // Step 4: Force close all SSE connections for the shop
      try {
        sseService.forceCloseConnectionsForShop(shopDomain);
        logger.info("Force closed all SSE connections for shop: {}", shopDomain);
      } catch (Exception e) {
        logger.warn(
            "Failed to force close SSE connections for shop {}: {}", shopDomain, e.getMessage());
      }

      // Step 5: Send post-invalidation notification
      sendPostInvalidationNotification(shopDomain, adminUsername, successfullyInvalidated);

      // Step 6: Log the admin action
      String auditMessage =
          String.format(
              "Admin %s invalidated %d sessions for shop %s - Reason: %s",
              adminUsername,
              successfullyInvalidated,
              shopDomain,
              reason != null ? reason : "Admin logout");

      adminAuthService.logAuditEvent(
          "ADMIN_SESSION_INVALIDATION", adminUsername, auditMessage, clientIp);

      // Step 7: Prepare response
      result.put("success", true);
      result.put(
          "message",
          "Successfully invalidated "
              + successfullyInvalidated
              + " sessions for shop: "
              + shopDomain);
      result.put("shopDomain", shopDomain);
      result.put("invalidatedSessions", successfullyInvalidated);
      result.put("totalSessions", activeSessions.size());
      result.put("adminUsername", adminUsername);
      result.put("reason", reason);

      logger.info(
          "Admin session invalidation completed: {} of {} sessions invalidated for shop: {}",
          successfullyInvalidated,
          activeSessions.size(),
          shopDomain);

    } catch (Exception e) {
      logger.error(
          "Error during admin session invalidation for shop {}: {}", shopDomain, e.getMessage(), e);

      result.put("success", false);
      result.put("error", "Failed to invalidate sessions: " + e.getMessage());
    }

    return result;
  }

  /**
   * Invalidate a specific session and notify the user
   *
   * @param shopDomain The shop domain
   * @param sessionId The specific session ID to invalidate
   * @param adminUsername The username of the admin performing the invalidation
   * @param reason The reason for invalidation
   * @param clientIp The IP address of the admin
   * @return Map containing invalidation results
   */
  public Map<String, Object> invalidateSpecificSession(
      String shopDomain, String sessionId, String adminUsername, String reason, String clientIp) {

    Map<String, Object> result = new HashMap<>();

    try {
      logger.info(
          "Admin {} invalidating specific session {} for shop: {} - Reason: {}",
          adminUsername,
          sessionId,
          shopDomain,
          reason);

      // Step 1: Validate that the session exists and belongs to the shop
      if (!shopService.isSessionValid(shopDomain, sessionId)) {
        result.put("success", false);
        result.put("error", "Session not found or already invalid");
        return result;
      }

      // Step 2: Send pre-invalidation notification
      sendPreInvalidationNotification(shopDomain, adminUsername, reason, sessionId);

      // Step 3: Force invalidate the session
      shopService.forceInvalidateSession(shopDomain, sessionId);

      // Step 4: Force close SSE connections for the shop (affects all sessions)
      try {
        sseService.forceCloseConnectionsForShop(shopDomain);
        logger.info("Force closed SSE connections for shop: {}", shopDomain);
      } catch (Exception e) {
        logger.warn(
            "Failed to force close SSE connections for shop {}: {}", shopDomain, e.getMessage());
      }

      // Step 5: Send post-invalidation notification
      sendPostInvalidationNotification(shopDomain, adminUsername, 1, sessionId);

      // Step 6: Log the admin action
      String auditMessage =
          String.format(
              "Admin %s invalidated session %s for shop %s - Reason: %s",
              adminUsername, sessionId, shopDomain, reason);

      adminAuthService.logAuditEvent(
          "ADMIN_SESSION_INVALIDATION", adminUsername, auditMessage, clientIp);

      // Step 7: Prepare response
      result.put("success", true);
      result.put("message", "Successfully invalidated session: " + sessionId);
      result.put("shopDomain", shopDomain);
      result.put("sessionId", sessionId);
      result.put("adminUsername", adminUsername);
      result.put("reason", reason);

      logger.info(
          "Admin specific session invalidation completed: session {} for shop: {}",
          sessionId,
          shopDomain);

    } catch (Exception e) {
      logger.error(
          "Error during admin specific session invalidation for session {}:{}: {}",
          shopDomain,
          sessionId,
          e.getMessage(),
          e);

      result.put("success", false);
      result.put("error", "Failed to invalidate session: " + e.getMessage());
    }

    return result;
  }

  /** Send notification before session invalidation */
  private void sendPreInvalidationNotification(
      String shopDomain, String adminUsername, String reason) {
    sendPreInvalidationNotification(shopDomain, adminUsername, reason, null);
  }

  /** Send notification before session invalidation (with optional session ID) */
  private void sendPreInvalidationNotification(
      String shopDomain, String adminUsername, String reason, String sessionId) {

    try {
      String message =
          String.format(
              "An administrator (%s) is about to invalidate your session. Reason: %s",
              adminUsername, reason != null ? reason : "Admin action");

      Map<String, Object> metadata = new HashMap<>();
      metadata.put("adminUsername", adminUsername);
      metadata.put("reason", reason);
      metadata.put("timestamp", System.currentTimeMillis());
      metadata.put("type", "pre_invalidation");

      if (sessionId != null) {
        // Send to specific session
        sseService.broadcastToShop(shopDomain, "session_pre_invalidation", message, 5000, metadata);
      } else {
        // Send to all sessions in the shop
        sseService.broadcastToShop(shopDomain, "session_pre_invalidation", message, 5000, metadata);
      }

      logger.debug("Sent pre-invalidation notification to shop: {}", shopDomain);
    } catch (Exception e) {
      logger.warn(
          "Failed to send pre-invalidation notification to shop {}: {}",
          shopDomain,
          e.getMessage());
    }
  }

  /** Send notification after session invalidation */
  private void sendPostInvalidationNotification(
      String shopDomain, String adminUsername, int invalidatedCount) {
    sendPostInvalidationNotification(shopDomain, adminUsername, invalidatedCount, null);
  }

  /** Send notification after session invalidation (with optional session ID) */
  private void sendPostInvalidationNotification(
      String shopDomain, String adminUsername, int invalidatedCount, String sessionId) {

    try {
      String message =
          String.format(
              "Your session has been invalidated by administrator %s. Please re-authenticate.",
              adminUsername);

      Map<String, Object> metadata = new HashMap<>();
      metadata.put("adminUsername", adminUsername);
      metadata.put("invalidatedCount", invalidatedCount);
      metadata.put("timestamp", System.currentTimeMillis());
      metadata.put("type", "post_invalidation");

      if (sessionId != null) {
        // Send to specific session
        sseService.broadcastToShop(shopDomain, "session_invalidated", message, 10000, metadata);
      } else {
        // Send to all sessions in the shop
        sseService.broadcastToShop(shopDomain, "session_invalidated", message, 10000, metadata);
      }

      logger.debug("Sent post-invalidation notification to shop: {}", shopDomain);
    } catch (Exception e) {
      logger.warn(
          "Failed to send post-invalidation notification to shop {}: {}",
          shopDomain,
          e.getMessage());
    }
  }
}
