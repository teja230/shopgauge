package com.storesight.backend.controller;

import com.storesight.backend.model.ShopSession;
import com.storesight.backend.service.ShopService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions")
public class SessionManagementController {

  private static final Logger logger = LoggerFactory.getLogger(SessionManagementController.class);
  private final ShopService shopService;

  @Autowired
  public SessionManagementController(ShopService shopService) {
    this.shopService = shopService;
  }

  /** Get active sessions for the current shop */
  @GetMapping("/active")
  public ResponseEntity<Map<String, Object>> getActiveSessions(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    if (shop == null) {
      response.put("error", "No shop authentication found");
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    try {
      List<ShopSession> activeSessions = shopService.getActiveSessionsForShop(shop);
      String currentSessionId = request.getSession().getId();

      List<Map<String, Object>> sessionData =
          activeSessions.stream()
              .map(
                  session -> {
                    Map<String, Object> sessionInfo = new HashMap<>();
                    sessionInfo.put("sessionId", session.getSessionId());
                    sessionInfo.put(
                        "isCurrentSession", session.getSessionId().equals(currentSessionId));
                    sessionInfo.put(
                        "createdAt",
                        session.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                    sessionInfo.put(
                        "lastAccessedAt",
                        session.getLastAccessedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                    sessionInfo.put("ipAddress", session.getIpAddress());
                    sessionInfo.put("userAgent", session.getUserAgent());
                    sessionInfo.put("isExpired", session.isExpired());
                    if (session.getExpiresAt() != null) {
                      sessionInfo.put(
                          "expiresAt",
                          session.getExpiresAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                    }
                    return sessionInfo;
                  })
              .collect(Collectors.toList());

      response.put("shop", shop);
      response.put("currentSessionId", currentSessionId);
      response.put("activeSessionCount", activeSessions.size());
      response.put("sessions", sessionData);
      response.put("success", true);

      logger.info("Retrieved {} active sessions for shop: {}", activeSessions.size(), shop);
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving active sessions for shop {}: {}", shop, e.getMessage(), e);
      response.put("error", "Failed to retrieve active sessions");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  /** Get current session information */
  @GetMapping("/current")
  public ResponseEntity<Map<String, Object>> getCurrentSessionInfo(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    if (shop == null) {
      response.put("error", "No shop authentication found");
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    try {
      String sessionId = request.getSession().getId();
      Optional<ShopSession> sessionOpt = shopService.getSessionInfo(sessionId);

      if (sessionOpt.isPresent()) {
        ShopSession session = sessionOpt.get();
        response.put("sessionId", session.getSessionId());
        response.put("shop", shop);
        response.put(
            "createdAt", session.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        response.put(
            "lastAccessedAt",
            session.getLastAccessedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        response.put("ipAddress", session.getIpAddress());
        response.put("userAgent", session.getUserAgent());
        response.put("isActive", session.getIsActive());
        response.put("isExpired", session.isExpired());
        if (session.getExpiresAt() != null) {
          response.put(
              "expiresAt", session.getExpiresAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        }
        response.put(
            "hasValidToken",
            session.getAccessToken() != null && !session.getAccessToken().isEmpty());
        response.put("success", true);
      } else {
        response.put("sessionId", sessionId);
        response.put("shop", shop);
        response.put("found", false);
        response.put(
            "message", "Session not found in database - might be using fallback authentication");
        response.put("success", true);
      }

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error(
          "Error retrieving current session info for shop {}: {}", shop, e.getMessage(), e);
      response.put("error", "Failed to retrieve session information");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  /** Terminate a specific session */
  @PostMapping("/terminate")
  public ResponseEntity<Map<String, Object>> terminateSession(
      @CookieValue(value = "shop", required = false) String shop,
      @RequestBody Map<String, String> requestBody,
      HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    if (shop == null) {
      response.put("error", "No shop authentication found");
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    String sessionIdToTerminate = requestBody.get("sessionId");
    if (sessionIdToTerminate == null || sessionIdToTerminate.trim().isEmpty()) {
      response.put("error", "Session ID is required");
      return ResponseEntity.badRequest().body(response);
    }

    try {
      String currentSessionId = request.getSession().getId();

      if (sessionIdToTerminate.equals(currentSessionId)) {
        response.put("error", "Cannot terminate your own session. Use logout instead.");
        return ResponseEntity.badRequest().body(response);
      }

      shopService.removeSession(shop, sessionIdToTerminate);

      response.put("success", true);
      response.put("message", "Session terminated successfully");
      response.put("terminatedSessionId", sessionIdToTerminate);

      logger.info(
          "Session {} terminated for shop: {} by session: {}",
          sessionIdToTerminate,
          shop,
          currentSessionId);
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error(
          "Error terminating session {} for shop {}: {}",
          sessionIdToTerminate,
          shop,
          e.getMessage(),
          e);
      response.put("error", "Failed to terminate session");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  /** Terminate all other sessions (keep current session active) */
  @PostMapping("/terminate-others")
  public ResponseEntity<Map<String, Object>> terminateOtherSessions(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    if (shop == null) {
      response.put("error", "No shop authentication found");
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    try {
      String currentSessionId = request.getSession().getId();
      List<ShopSession> activeSessions = shopService.getActiveSessionsForShop(shop);

      int terminatedCount = 0;
      for (ShopSession session : activeSessions) {
        if (!session.getSessionId().equals(currentSessionId)) {
          shopService.removeSession(shop, session.getSessionId());
          terminatedCount++;
        }
      }

      response.put("success", true);
      response.put("message", "Other sessions terminated successfully");
      response.put("terminatedSessionsCount", terminatedCount);
      response.put("currentSessionId", currentSessionId);

      logger.info(
          "Terminated {} other sessions for shop: {} by session: {}",
          terminatedCount,
          shop,
          currentSessionId);
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error terminating other sessions for shop {}: {}", shop, e.getMessage(), e);
      response.put("error", "Failed to terminate other sessions");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  /** Session health check and diagnostics */
  @GetMapping("/health")
  public ResponseEntity<Map<String, Object>> sessionHealthCheck(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    try {
      String sessionId = request.getSession().getId();

      // Basic session info
      response.put("sessionId", sessionId);
      response.put("shop", shop);
      response.put("authenticated", shop != null);

      if (shop != null) {
        // Check token availability
        String token = shopService.getTokenForShop(shop, sessionId);
        response.put("hasToken", token != null);

        // Check active sessions count
        List<ShopSession> activeSessions = shopService.getActiveSessionsForShop(shop);
        response.put("activeSessionsCount", activeSessions.size());

        // Check if current session is in database
        Optional<ShopSession> currentSessionOpt = shopService.getSessionInfo(sessionId);
        response.put("sessionInDatabase", currentSessionOpt.isPresent());

        if (currentSessionOpt.isPresent()) {
          ShopSession currentSession = currentSessionOpt.get();
          response.put("sessionActive", currentSession.getIsActive());
          response.put("sessionExpired", currentSession.isExpired());
        }
      }

      response.put("timestamp", System.currentTimeMillis());
      response.put("success", true);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error in session health check: {}", e.getMessage(), e);
      response.put("error", "Session health check failed");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  /** Debug endpoint for session troubleshooting */
  @GetMapping("/debug")
  public ResponseEntity<Map<String, Object>> debugSessions(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    try {
      String sessionId = request.getSession().getId();

      // Request information
      Map<String, Object> requestInfo = new HashMap<>();
      requestInfo.put("sessionId", sessionId);
      requestInfo.put("remoteAddr", request.getRemoteAddr());
      requestInfo.put("userAgent", request.getHeader("User-Agent"));
      requestInfo.put("xForwardedFor", request.getHeader("X-Forwarded-For"));
      requestInfo.put("xRealIp", request.getHeader("X-Real-IP"));
      response.put("request", requestInfo);

      // Shop and authentication info
      response.put("shop", shop);
      response.put("authenticated", shop != null);

      if (shop != null) {
        // Token check
        String token = shopService.getTokenForShop(shop, sessionId);
        response.put("hasToken", token != null);
        if (token != null) {
          response.put("tokenPreview", token.substring(0, Math.min(10, token.length())) + "...");
        }

        // All active sessions for shop
        List<ShopSession> activeSessions = shopService.getActiveSessionsForShop(shop);
        response.put("totalActiveSessions", activeSessions.size());

        List<Map<String, Object>> sessionSummaries =
            activeSessions.stream()
                .map(
                    session -> {
                      Map<String, Object> summary = new HashMap<>();
                      summary.put("sessionId", session.getSessionId());
                      summary.put("isCurrentSession", session.getSessionId().equals(sessionId));
                      summary.put(
                          "createdAt",
                          session.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                      summary.put(
                          "lastAccessedAt",
                          session
                              .getLastAccessedAt()
                              .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                      summary.put("ipAddress", session.getIpAddress());
                      summary.put("isExpired", session.isExpired());
                      return summary;
                    })
                .collect(Collectors.toList());
        response.put("activeSessions", sessionSummaries);
      }

      response.put("timestamp", System.currentTimeMillis());
      response.put("success", true);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error in session debug: {}", e.getMessage(), e);
      response.put("error", "Session debug failed");
      response.put("details", e.getMessage());
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }
}
