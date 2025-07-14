package com.storesight.backend.controller;

import com.storesight.backend.model.ShopSession;
import com.storesight.backend.service.ShopService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/sessions")
public class SessionManagementController {

  private static final Logger logger = LoggerFactory.getLogger(SessionManagementController.class);
  private final ShopService shopService;
  private final RedisTemplate<String, String> redisTemplate;
  private final ConcurrentHashMap<String, CopyOnWriteArrayList<SseEmitter>> sseEmitters =
      new ConcurrentHashMap<>();

  @Autowired
  public SessionManagementController(
      ShopService shopService, RedisTemplate<String, String> redisTemplate) {
    this.shopService = shopService;
    this.redisTemplate = redisTemplate;
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
                    sessionInfo.put(
                        "lastUsedFormatted", formatLastUsedTime(session.getLastAccessedAt()));
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

  /** Session health check endpoint */
  @GetMapping("/health-check")
  public ResponseEntity<Map<String, Object>> sessionHealthCheck(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    if (shop == null) {
      response.put("error", "No shop authentication found");
      response.put("healthy", false);
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    try {
      String sessionId = request.getSession().getId();

      // Get current session info
      Optional<ShopSession> sessionOpt = shopService.getSessionInfo(sessionId);

      if (sessionOpt.isPresent()) {
        ShopSession session = sessionOpt.get();

        // Calculate session age and time until expiration
        LocalDateTime now = LocalDateTime.now();
        long sessionAgeMinutes = ChronoUnit.MINUTES.between(session.getCreatedAt(), now);
        long timeUntilExpirationMinutes = 0;

        if (session.getExpiresAt() != null) {
          timeUntilExpirationMinutes = ChronoUnit.MINUTES.between(now, session.getExpiresAt());
        }

        // Determine session health status
        boolean isHealthy = session.getIsActive() && !session.isExpired();
        boolean needsRefresh = session.isExpired();
        boolean isExpiringSoon =
            timeUntilExpirationMinutes > 0 && timeUntilExpirationMinutes < 30; // 30 minutes

        response.put("healthy", isHealthy);
        response.put("sessionId", sessionId);
        response.put("shop", shop);
        response.put("isActive", session.getIsActive());
        response.put("isExpired", session.isExpired());
        response.put("needsRefresh", needsRefresh);
        response.put("isExpiringSoon", isExpiringSoon);
        response.put("sessionAgeMinutes", sessionAgeMinutes);
        response.put("timeUntilExpirationMinutes", timeUntilExpirationMinutes);
        response.put(
            "createdAt", session.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        response.put(
            "lastAccessedAt",
            session.getLastAccessedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        if (session.getExpiresAt() != null) {
          response.put(
              "expiresAt", session.getExpiresAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        }

        // Get active session count for this shop
        List<ShopSession> activeSessions = shopService.getActiveSessionsForShop(shop);
        response.put("activeSessionCount", activeSessions.size());
        response.put("maxSessionsPerShop", 5); // From ShopService constant

        // Add recommendations
        List<String> recommendations = new ArrayList<>();
        if (needsRefresh) {
          recommendations.add("Session is expired and needs refresh");
        }
        if (isExpiringSoon) {
          recommendations.add("Session will expire soon, consider refreshing");
        }
        if (activeSessions.size() >= 5) {
          recommendations.add("Maximum sessions reached, consider terminating old sessions");
        }

        response.put("recommendations", recommendations);
        response.put("success", true);

        logger.debug(
            "Session health check for shop: {} and session: {} - healthy: {}",
            shop,
            sessionId,
            isHealthy);
        return ResponseEntity.ok(response);

      } else {
        response.put("healthy", false);
        response.put("error", "Session not found in database");
        response.put("sessionId", sessionId);
        response.put("shop", shop);
        response.put("success", true);

        logger.warn(
            "Session health check failed - session not found: shop={}, session={}",
            shop,
            sessionId);
        return ResponseEntity.ok(response);
      }

    } catch (Exception e) {
      logger.error("Error during session health check for shop {}: {}", shop, e.getMessage(), e);
      response.put("error", "Internal server error during health check");
      response.put("healthy", false);
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  /** Debug endpoint for session troubleshooting */
  @GetMapping("/debug")
  @Profile("!prod") // Only available in non-production environments
  public ResponseEntity<Map<String, Object>> debugSessions(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {

    // Enhanced input validation
    if (shop != null && !isValidShopDomain(shop)) {
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", "Invalid shop parameter");
      errorResponse.put("success", false);
      return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }

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
        // Token information
        String token = shopService.getTokenForShop(shop, sessionId);
        response.put("hasToken", token != null);

        // Session information
        List<ShopSession> activeSessions = shopService.getActiveSessionsForShop(shop);
        response.put("activeSessionsCount", activeSessions.size());

        // Current session details
        Optional<ShopSession> currentSessionOpt = shopService.getSessionInfo(sessionId);
        response.put("sessionInDatabase", currentSessionOpt.isPresent());

        if (currentSessionOpt.isPresent()) {
          ShopSession currentSession = currentSessionOpt.get();
          response.put("sessionActive", currentSession.getIsActive());
          response.put("sessionExpired", currentSession.isExpired());
          response.put("sessionCreatedAt", currentSession.getCreatedAt());
          response.put("sessionLastAccessedAt", currentSession.getLastAccessedAt());
        }

        // Redis information
        try {
          String redisToken = redisTemplate.opsForValue().get("shop_token:" + shop);
          response.put("redisTokenExists", redisToken != null);

          String redisSessionId = redisTemplate.opsForValue().get("shop_session:" + shop);
          response.put("redisSessionId", redisSessionId);

          if (redisSessionId != null) {
            String sessionSpecificToken =
                redisTemplate.opsForValue().get("shop_token:" + shop + ":" + redisSessionId);
            response.put("sessionSpecificTokenExists", sessionSpecificToken != null);
          }
        } catch (Exception redisError) {
          response.put("redisError", redisError.getMessage());
        }
      }

      response.put("timestamp", System.currentTimeMillis());
      response.put("success", true);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error in session debug: {}", e.getMessage(), e);
      response.put("error", "Session debug failed");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  /** Session heartbeat endpoint */
  @PostMapping("/heartbeat")
  public ResponseEntity<Map<String, Object>> sessionHeartbeat(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    if (shop == null) {
      response.put("error", "No shop authentication found");
      response.put("sessionInvalidated", true);
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    try {
      String sessionId = request.getSession().getId();

      // Check if current session is valid
      Optional<ShopSession> sessionOpt = shopService.getSessionInfo(sessionId);

      if (sessionOpt.isPresent()) {
        ShopSession session = sessionOpt.get();

        // Check if session is expired
        if (session.isExpired()) {
          response.put("success", false);
          response.put("error", "Session has expired");
          response.put("sessionInvalidated", true);
          return ResponseEntity.ok(response);
        }

        // Calculate time until expiration
        long expiresInMinutes =
            java.time.Duration.between(LocalDateTime.now(), session.getExpiresAt()).toMinutes();

        // Check if session is expiring soon (within 10 minutes)
        boolean sessionExpiring = expiresInMinutes <= 10;

        // Update session heartbeat
        boolean heartbeatSuccess = shopService.updateSessionHeartbeat(shop, sessionId);

        if (heartbeatSuccess) {
          response.put("success", true);
          response.put("sessionId", sessionId);
          response.put("shop", shop);
          response.put("activeSessionCount", shopService.getActiveSessionsForShop(shop).size());
          response.put("timestamp", System.currentTimeMillis());

          // Add session health information
          response.put("sessionExpiring", sessionExpiring);
          response.put("expiresInMinutes", expiresInMinutes);
          response.put("needsManualRefresh", sessionExpiring && expiresInMinutes <= 5);
          response.put("canExtend", true); // Session can be extended
          response.put("extensionAvailable", true); // Extension is available

          // Add recommendations based on session health
          List<String> recommendations = new ArrayList<>();
          if (sessionExpiring) {
            recommendations.add(
                "Your session will expire soon. Please save your work and refresh the page.");
          }
          if (expiresInMinutes <= 5) {
            recommendations.add(
                "Session expires in less than 5 minutes. Manual refresh recommended.");
          }
          response.put("recommendations", recommendations);

        } else {
          response.put("success", false);
          response.put("error", "Failed to update session heartbeat");
          response.put("needsManualRefresh", true);
        }

      } else {
        response.put("success", false);
        response.put("error", "Session not found");
        response.put("sessionInvalidated", true);
      }

    } catch (Exception e) {
      logger.error("Error during session heartbeat", e);
      response.put("success", false);
      response.put("error", "Internal server error during heartbeat");
    }

    return ResponseEntity.ok(response);
  }

  /** Session refresh endpoint */
  @PostMapping("/refresh")
  public ResponseEntity<Map<String, Object>> refreshSession(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    if (shop == null) {
      response.put("error", "No shop authentication found");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    try {
      String sessionId = request.getSession().getId();

      // Use the ShopService to refresh the session
      boolean refreshSuccess = shopService.refreshExpiredSession(shop, sessionId);

      if (refreshSuccess) {
        // Get updated session info
        Optional<ShopSession> sessionOpt = shopService.getSessionInfo(sessionId);

        if (sessionOpt.isPresent()) {
          ShopSession session = sessionOpt.get();

          response.put("success", true);
          response.put("message", "Session refreshed successfully");
          response.put("sessionId", sessionId);
          response.put("shop", shop);
          response.put(
              "expiresAt", session.getExpiresAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

          logger.info("Session {} refreshed for shop: {}", sessionId, shop);
          return ResponseEntity.ok(response);
        } else {
          response.put("error", "Session not found after refresh");
          response.put("success", false);
          return ResponseEntity.ok(response);
        }
      } else {
        logger.warn("Failed to refresh session {} for shop {}", sessionId, shop);
        response.put("error", "Failed to refresh session");
        response.put("success", false);
        return ResponseEntity.ok(response);
      }

    } catch (Exception e) {
      logger.error("Error refreshing session for shop {}: {}", shop, e.getMessage(), e);
      response.put("error", "Failed to refresh session");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  /** Session extension endpoint - follows industry standards for session management */
  @PostMapping("/extend")
  public ResponseEntity<Map<String, Object>> extendSession(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    if (shop == null) {
      response.put("error", "No shop authentication found");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    try {
      String sessionId = request.getSession().getId();

      // Use the ShopService to extend the session
      boolean extendSuccess = shopService.extendSession(shop, sessionId);

      if (extendSuccess) {
        // Get updated session info
        Optional<ShopSession> sessionOpt = shopService.getSessionInfo(sessionId);

        if (sessionOpt.isPresent()) {
          ShopSession session = sessionOpt.get();

          // Calculate time until expiration
          long expiresInMinutes = 0;
          if (session.getExpiresAt() != null) {
            expiresInMinutes =
                java.time.Duration.between(LocalDateTime.now(), session.getExpiresAt()).toMinutes();
          }

          response.put("success", true);
          response.put("message", "Session extended successfully");
          response.put("sessionId", sessionId);
          response.put("shop", shop);
          response.put(
              "expiresAt", session.getExpiresAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
          response.put("expiresInMinutes", expiresInMinutes);
          response.put("extensionDuration", "4 hours"); // Standard extension duration

          logger.info("Session {} extended for shop: {}", sessionId, shop);
          return ResponseEntity.ok(response);
        } else {
          response.put("error", "Session not found after extension");
          response.put("success", false);
          return ResponseEntity.ok(response);
        }
      } else {
        logger.warn("Failed to extend session {} for shop {}", sessionId, shop);
        response.put("error", "Failed to extend session");
        response.put("success", false);
        return ResponseEntity.ok(response);
      }

    } catch (Exception e) {
      logger.error("Error extending session for shop {}: {}", shop, e.getMessage(), e);
      response.put("error", "Failed to extend session");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  /** Endpoint to check if sessions are stale (for cleanup detection) */
  @GetMapping("/stale-check")
  public ResponseEntity<Map<String, Object>> checkStaleEsessions(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    if (shop == null) {
      response.put("error", "No shop authentication found");
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    try {
      String sessionId = request.getSession().getId();

      // Get stale sessions for this shop
      List<ShopSession> staleSessions = shopService.getStaleSessionsForShop(shop);

      List<Map<String, Object>> staleSessionData =
          staleSessions.stream()
              .map(
                  session -> {
                    Map<String, Object> sessionInfo = new HashMap<>();
                    sessionInfo.put("sessionId", session.getSessionId());
                    sessionInfo.put("isCurrentSession", session.getSessionId().equals(sessionId));
                    sessionInfo.put(
                        "lastAccessedAt",
                        session.getLastAccessedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                    sessionInfo.put(
                        "minutesSinceLastAccess",
                        java.time.Duration.between(session.getLastAccessedAt(), LocalDateTime.now())
                            .toMinutes());
                    return sessionInfo;
                  })
              .collect(Collectors.toList());

      response.put("success", true);
      response.put("shop", shop);
      response.put("currentSessionId", sessionId);
      response.put("staleSessionCount", staleSessions.size());
      response.put("staleSessions", staleSessionData);
      response.put("timestamp", System.currentTimeMillis());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error checking stale sessions for shop {}: {}", shop, e.getMessage(), e);
      response.put("error", "Failed to check stale sessions");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  /** Endpoint to handle session termination signals from browser unload events */
  @PostMapping("/terminate-current")
  public ResponseEntity<Map<String, Object>> terminateCurrentSession(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    try {
      String sessionId =
          request.getSession(false) != null ? request.getSession(false).getId() : null;

      if (shop != null && sessionId != null) {
        shopService.removeSession(shop, sessionId);
        logger.info("Session terminated via unload signal: {} for shop: {}", sessionId, shop);

        response.put("success", true);
        response.put("message", "Session terminated successfully");
        response.put("sessionId", sessionId);
        response.put("shop", shop);
      } else {
        logger.warn(
            "Session termination request missing shop or sessionId: shop={}, sessionId={}",
            shop,
            sessionId);
        response.put("success", false);
        response.put("message", "Missing shop or session information");
      }

      response.put("timestamp", System.currentTimeMillis());
      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error terminating current session for shop {}: {}", shop, e.getMessage(), e);
      response.put("error", "Failed to terminate session");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  /** Check if session limit would be exceeded and return session details for UI */
  @GetMapping("/limit-check")
  public ResponseEntity<Map<String, Object>> checkSessionLimit(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    if (shop == null) {
      response.put("error", "No shop authentication found");
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    try {
      // Use getSession(false) to avoid creating a new session if it doesn't exist
      jakarta.servlet.http.HttpSession sessionObj = request.getSession(false);
      String currentSessionId = (sessionObj != null) ? sessionObj.getId() : null;

      List<ShopSession> activeSessions = null;
      boolean currentSessionFound = false;
      int maxRetries = 3;
      int retryDelay = 500; // 500ms between retries

      for (int attempt = 0; attempt < maxRetries; attempt++) {
        activeSessions = shopService.getActiveSessionsForShop(shop);
        currentSessionFound =
            currentSessionId != null
                && activeSessions.stream()
                    .anyMatch(session -> session.getSessionId().equals(currentSessionId));

        if (currentSessionFound || attempt == maxRetries - 1) {
          break; // Found current session or exhausted retries
        }

        // Wait before retry (only during login timing issues)
        try {
          Thread.sleep(retryDelay);
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          break;
        }

        logger.debug(
            "Retrying session limit check - attempt {}/{} for shop: {} session: {}",
            attempt + 1,
            maxRetries,
            shop,
            currentSessionId);
      }

      boolean limitReached = activeSessions.size() >= 5; // MAX_SESSIONS_PER_SHOP

      response.put("limitReached", limitReached);
      response.put("maxSessions", 5);
      response.put("currentSessionCount", activeSessions.size());
      response.put("shop", shop);
      response.put("currentSessionId", currentSessionId);
      response.put("currentSessionFound", currentSessionFound);

      List<Map<String, Object>> sessionDetails =
          activeSessions.stream()
              .map(
                  session -> {
                    Map<String, Object> sessionInfo = new HashMap<>();
                    sessionInfo.put("sessionId", session.getSessionId());
                    sessionInfo.put(
                        "isCurrentSession",
                        currentSessionId != null
                            && session.getSessionId().equals(currentSessionId));
                    sessionInfo.put(
                        "createdAt",
                        session.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                    sessionInfo.put(
                        "lastAccessedAt",
                        session.getLastAccessedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                    sessionInfo.put(
                        "lastUsedFormatted", formatLastUsedTime(session.getLastAccessedAt()));
                    sessionInfo.put(
                        "ipAddress",
                        session.getIpAddress() != null ? session.getIpAddress() : "Unknown");
                    sessionInfo.put(
                        "userAgent",
                        session.getUserAgent() != null
                            ? session.getUserAgent()
                            : "Unknown Browser");
                    sessionInfo.put("isExpired", session.isExpired());

                    if (session.getExpiresAt() != null) {
                      sessionInfo.put(
                          "expiresAt",
                          session.getExpiresAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                    }

                    return sessionInfo;
                  })
              .collect(Collectors.toList());

      // Only add current session if it exists and is not found in DB
      if (currentSessionId != null && !currentSessionFound) {
        logger.info(
            "Current session {} not found in database for shop {}, adding to response for UI highlighting",
            currentSessionId,
            shop);

        Map<String, Object> currentSessionInfo = new HashMap<>();
        currentSessionInfo.put("sessionId", currentSessionId);
        currentSessionInfo.put("isCurrentSession", true);
        currentSessionInfo.put(
            "createdAt", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        currentSessionInfo.put(
            "lastAccessedAt", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        currentSessionInfo.put("lastUsedFormatted", "Just now");
        currentSessionInfo.put("ipAddress", getClientIpAddress(request));
        currentSessionInfo.put(
            "userAgent",
            request.getHeader("User-Agent") != null
                ? request.getHeader("User-Agent")
                : "Unknown Browser");
        currentSessionInfo.put("isExpired", false);
        currentSessionInfo.put(
            "expiresAt",
            LocalDateTime.now().plusHours(4).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        // Add current session to the beginning of the list
        sessionDetails.add(0, currentSessionInfo);

        // Update session count to include current session
        response.put("currentSessionCount", activeSessions.size() + 1);

        logger.info(
            "Added current session to response. Total sessions: {}, Current session count: {}",
            sessionDetails.size(),
            activeSessions.size() + 1);
      } else if (currentSessionId != null) {
        logger.debug("Current session {} found in database for shop {}", currentSessionId, shop);
      }

      response.put("sessions", sessionDetails);
      response.put("success", true);
      response.put("timestamp", System.currentTimeMillis());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error checking session limit for shop {}: {}", shop, e.getMessage(), e);
      response.put("error", "Failed to check session limit");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  /** Force session limit check (returns true if login should proceed) */
  @PostMapping("/can-create-session")
  public ResponseEntity<Map<String, Object>> canCreateSession(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    if (shop == null) {
      response.put("error", "No shop authentication found");
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    try {
      List<ShopSession> activeSessions = shopService.getActiveSessionsForShop(shop);
      String currentSessionId = request.getSession().getId();

      // Check if current session already exists
      boolean currentSessionExists =
          activeSessions.stream().anyMatch(s -> s.getSessionId().equals(currentSessionId));

      // If current session exists, we can proceed (it's a refresh/re-auth)
      // If it doesn't exist, check if we're at the limit
      boolean canCreate = currentSessionExists || activeSessions.size() < 5;

      response.put("canCreate", canCreate);
      response.put("currentSessionExists", currentSessionExists);
      response.put("activeSessionCount", activeSessions.size());
      response.put("maxSessions", 5);
      response.put("shop", shop);
      response.put("currentSessionId", currentSessionId);
      response.put("success", true);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error(
          "Error checking if session can be created for shop {}: {}", shop, e.getMessage(), e);
      response.put("error", "Failed to check session creation eligibility");
      response.put("canCreate", false);
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  // Helper method for input validation
  private boolean isValidShopDomain(String shop) {
    if (shop == null || shop.trim().isEmpty()) {
      return false;
    }

    // Basic Shopify domain validation
    String trimmedShop = shop.trim();

    // Check length
    if (trimmedShop.length() > 100) {
      return false;
    }

    // Check for valid characters and format
    java.util.regex.Pattern shopPattern =
        java.util.regex.Pattern.compile(
            "^[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9](\\.myshopify\\.com)?$");

    return shopPattern.matcher(trimmedShop).matches();
  }

  /** Format last accessed time in a user-friendly way */
  private String formatLastUsedTime(LocalDateTime lastAccessedAt) {
    if (lastAccessedAt == null) {
      return "Unknown";
    }

    LocalDateTime now = LocalDateTime.now();

    // Calculate the time difference
    long minutes = ChronoUnit.MINUTES.between(lastAccessedAt, now);
    long hours = ChronoUnit.HOURS.between(lastAccessedAt, now);
    long days = ChronoUnit.DAYS.between(lastAccessedAt, now);

    if (minutes < 1) {
      return "Just now";
    } else if (minutes < 60) {
      return minutes + " minute" + (minutes == 1 ? "" : "s") + " ago";
    } else if (hours < 24) {
      return hours + " hour" + (hours == 1 ? "" : "s") + " ago";
    } else if (days < 30) {
      return days + " day" + (days == 1 ? "" : "s") + " ago";
    } else {
      // For older sessions, show the actual date
      return "On " + lastAccessedAt.format(DateTimeFormatter.ofPattern("MMM dd, yyyy"));
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

  // ==================== ADMIN SESSION ENDPOINTS ====================

  /** Admin: Get session health for all shops */
  @GetMapping("/admin/health")
  public ResponseEntity<Map<String, Object>> adminSessionHealth(HttpServletRequest request) {
    Map<String, Object> response = new HashMap<>();

    try {
      // Get all active sessions across all shops
      List<ShopSession> allActiveSessions = shopService.getAllActiveSessions();

      // Calculate system-wide health metrics
      long totalSessions = allActiveSessions.size();
      long expiredSessions = allActiveSessions.stream().filter(ShopSession::isExpired).count();
      long activeSessions = totalSessions - expiredSessions;

      // Calculate health score (0-100)
      int healthScore = totalSessions > 0 ? (int) ((activeSessions * 100) / totalSessions) : 100;

      // Get unique shops
      long uniqueShops =
          allActiveSessions.stream()
              .map(session -> session.getShop().getShopifyDomain())
              .distinct()
              .count();

      // Calculate average sessions per shop
      double avgSessionsPerShop = uniqueShops > 0 ? (double) totalSessions / uniqueShops : 0;

      // Generate recommendations
      List<String> recommendations = new ArrayList<>();
      if (expiredSessions > 0) {
        recommendations.add("Clean up " + expiredSessions + " expired sessions");
      }
      if (avgSessionsPerShop > 3) {
        recommendations.add("Some shops have high session counts - consider cleanup");
      }
      if (healthScore < 80) {
        recommendations.add("Session health is below optimal - investigate issues");
      }

      response.put("totalSessions", totalSessions);
      response.put("activeSessions", activeSessions);
      response.put("expiredSessions", expiredSessions);
      response.put("uniqueShops", uniqueShops);
      response.put("avgSessionsPerShop", Math.round(avgSessionsPerShop * 100.0) / 100.0);
      response.put("healthScore", healthScore);
      response.put("recommendations", recommendations);
      response.put("success", true);

      logger.info(
          "Admin session health check: {} total sessions, {} active, {} expired, {} shops",
          totalSessions,
          activeSessions,
          expiredSessions,
          uniqueShops);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error in admin session health check: {}", e.getMessage(), e);
      response.put("error", "Failed to retrieve session health");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  /** Admin: Get sessions for a specific shop */
  @GetMapping("/admin/shop/{shopDomain}/sessions")
  public ResponseEntity<Map<String, Object>> adminGetShopSessions(
      @PathVariable String shopDomain, HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    try {
      List<ShopSession> shopSessions = shopService.getActiveSessionsForShop(shopDomain);

      List<Map<String, Object>> sessionData =
          shopSessions.stream()
              .map(
                  session -> {
                    Map<String, Object> sessionInfo = new HashMap<>();
                    sessionInfo.put("sessionId", session.getSessionId());
                    sessionInfo.put(
                        "createdAt",
                        session.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                    sessionInfo.put(
                        "lastAccessedAt",
                        session.getLastAccessedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                    sessionInfo.put("ipAddress", session.getIpAddress());
                    sessionInfo.put("userAgent", session.getUserAgent());
                    sessionInfo.put("isActive", session.getIsActive());
                    sessionInfo.put("isExpired", session.isExpired());
                    if (session.getExpiresAt() != null) {
                      sessionInfo.put(
                          "expiresAt",
                          session.getExpiresAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                    }
                    return sessionInfo;
                  })
              .collect(Collectors.toList());

      response.put("shopDomain", shopDomain);
      response.put("sessionCount", shopSessions.size());
      response.put("sessions", sessionData);
      response.put("success", true);

      logger.info("Admin retrieved {} sessions for shop: {}", shopSessions.size(), shopDomain);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving sessions for shop {}: {}", shopDomain, e.getMessage(), e);
      response.put("error", "Failed to retrieve shop sessions");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  /** Admin: Refresh sessions for a specific shop */
  @PostMapping("/admin/shop/{shopDomain}/refresh")
  public ResponseEntity<Map<String, Object>> adminRefreshShopSessions(
      @PathVariable String shopDomain, HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    try {
      // Get current sessions for the shop
      List<ShopSession> currentSessions = shopService.getActiveSessionsForShop(shopDomain);

      // Remove expired sessions
      List<ShopSession> expiredSessions =
          currentSessions.stream().filter(ShopSession::isExpired).collect(Collectors.toList());

      for (ShopSession expiredSession : expiredSessions) {
        shopService.removeSession(shopDomain, expiredSession.getSessionId());
      }

      // Get updated session count
      List<ShopSession> updatedSessions = shopService.getActiveSessionsForShop(shopDomain);

      response.put("shopDomain", shopDomain);
      response.put("removedExpiredSessions", expiredSessions.size());
      response.put("remainingSessions", updatedSessions.size());
      response.put("success", true);
      response.put("message", "Shop sessions refreshed successfully");

      logger.info(
          "Admin refreshed sessions for shop {}: removed {} expired, {} remaining",
          shopDomain,
          expiredSessions.size(),
          updatedSessions.size());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error refreshing sessions for shop {}: {}", shopDomain, e.getMessage(), e);
      response.put("error", "Failed to refresh shop sessions");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  /** Admin: Invalidate all sessions for a specific shop */
  @PostMapping("/admin/shop/{shopDomain}/invalidate")
  public ResponseEntity<Map<String, Object>> adminInvalidateShopSessions(
      @PathVariable String shopDomain,
      HttpServletRequest request,
      HttpServletResponse httpResponse) {

    Map<String, Object> response = new HashMap<>();

    try {
      // Get all sessions for the shop
      List<ShopSession> allSessions = shopService.getActiveSessionsForShop(shopDomain);

      // Remove all sessions with better error handling
      int successfullyInvalidated = 0;
      for (ShopSession session : allSessions) {
        try {
          shopService.removeSession(shopDomain, session.getSessionId());
          successfullyInvalidated++;
        } catch (Exception e) {
          logger.warn(
              "Failed to remove session {} for shop {}: {}",
              session.getSessionId(),
              shopDomain,
              e.getMessage());
          // Continue with other sessions even if one fails
        }
      }

      // Clear shop cookie for this domain to force frontend logout
      clearShopCookie(httpResponse, shopDomain);

      response.put("shopDomain", shopDomain);
      response.put("invalidatedSessions", successfullyInvalidated);
      response.put("totalSessions", allSessions.size());
      response.put("success", true);
      response.put("message", "All sessions for shop invalidated successfully");
      response.put("cookieCleared", true);

      logger.info(
          "Admin invalidated {} of {} sessions for shop: {} and cleared cookies",
          successfullyInvalidated,
          allSessions.size(),
          shopDomain);

      // Broadcast session invalidation asynchronously to prevent blocking
      try {
        broadcastSessionInvalidated(shopDomain);
      } catch (Exception e) {
        logger.warn(
            "Failed to broadcast session invalidation for shop {}: {}", shopDomain, e.getMessage());
        // Don't fail the entire operation if SSE broadcast fails
      }

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error invalidating sessions for shop {}: {}", shopDomain, e.getMessage(), e);
      response.put("error", "Failed to invalidate shop sessions");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  private void clearShopCookie(HttpServletResponse response, String shopDomain) {
    try {
      // Clear shop cookie without domain first (works for all cases)
      Cookie shopCookie = new Cookie("shop", "");
      shopCookie.setPath("/");
      shopCookie.setMaxAge(0); // Expire immediately
      shopCookie.setHttpOnly(false);
      shopCookie.setSecure(true);
      response.addCookie(shopCookie);

      // For Shopify domains, we need to clear the cookie with the myshopify.com domain
      if (shopDomain != null && shopDomain.contains("myshopify.com")) {
        try {
          Cookie myshopifyCookie = new Cookie("shop", "");
          myshopifyCookie.setPath("/");
          myshopifyCookie.setMaxAge(0);
          myshopifyCookie.setHttpOnly(false);
          myshopifyCookie.setSecure(true);
          myshopifyCookie.setDomain("myshopify.com");
          response.addCookie(myshopifyCookie);
          logger.debug("Added myshopify.com domain cookie clear for: {}", shopDomain);
        } catch (Exception e) {
          logger.warn(
              "Failed to clear myshopify.com domain cookie for {}: {}", shopDomain, e.getMessage());
        }
      }

      // Add Set-Cookie header to ensure cookie is cleared (without domain)
      response.addHeader(
          "Set-Cookie",
          "shop=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; HttpOnly=false; Secure");

      // Also add Set-Cookie header with myshopify.com domain for Shopify stores
      if (shopDomain != null && shopDomain.contains("myshopify.com")) {
        response.addHeader(
            "Set-Cookie",
            "shop=; Path=/; Domain=myshopify.com; Expires=Thu, 01 Jan 1970 00:00:01 GMT; HttpOnly=false; Secure");
      }

      logger.info("Cleared shop cookie for domain: {}", shopDomain);
    } catch (Exception e) {
      logger.warn("Failed to clear shop cookie for {}: {}", shopDomain, e.getMessage());
    }
  }

  /** Admin: Get list of all shops with active sessions */
  @GetMapping("/admin/shops")
  public ResponseEntity<Map<String, Object>> adminGetShopsWithSessions(HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    try {
      List<ShopSession> allActiveSessions = shopService.getAllActiveSessions();

      // Group sessions by shop
      Map<String, List<ShopSession>> sessionsByShop =
          allActiveSessions.stream()
              .collect(Collectors.groupingBy(session -> session.getShop().getShopifyDomain()));

      List<Map<String, Object>> shopData =
          sessionsByShop.entrySet().stream()
              .map(
                  entry -> {
                    Map<String, Object> shopInfo = new HashMap<>();
                    String shopDomain = entry.getKey();
                    List<ShopSession> sessions = entry.getValue();

                    long activeSessions = sessions.stream().filter(s -> !s.isExpired()).count();
                    long expiredSessions = sessions.size() - activeSessions;

                    shopInfo.put("shopDomain", shopDomain);
                    shopInfo.put("totalSessions", sessions.size());
                    shopInfo.put("activeSessions", activeSessions);
                    shopInfo.put("expiredSessions", expiredSessions);
                    shopInfo.put(
                        "lastActivity",
                        sessions.stream()
                            .map(ShopSession::getLastAccessedAt)
                            .max(LocalDateTime::compareTo)
                            .map(date -> date.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                            .orElse(null));

                    return shopInfo;
                  })
              .sorted(
                  (a, b) -> {
                    // Sort by total sessions descending, then by shop domain
                    int aTotal = (Integer) a.get("totalSessions");
                    int bTotal = (Integer) b.get("totalSessions");
                    if (aTotal != bTotal) {
                      return Integer.compare(bTotal, aTotal);
                    }
                    return ((String) a.get("shopDomain")).compareTo((String) b.get("shopDomain"));
                  })
              .collect(Collectors.toList());

      response.put("shops", shopData);
      response.put("totalShops", shopData.size());
      response.put("success", true);

      logger.info("Admin retrieved {} shops with active sessions", shopData.size());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error retrieving shops with sessions: {}", e.getMessage(), e);
      response.put("error", "Failed to retrieve shops with sessions");
      response.put("success", false);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
  }

  /**
   * SSE endpoint for shop session events. Clients should connect to
   * /api/sessions/events/{shopDomain} to receive real-time session events. Event format: { "event":
   * "session_invalidated", "message": "Your session has been invalidated by an administrator." }
   */
  @GetMapping("/events/{shopDomain}")
  public SseEmitter subscribeToSessionEvents(@PathVariable String shopDomain) {
    logger.info("SSE connection request for shop: {}", shopDomain);
    SseEmitter emitter = new SseEmitter(0L); // No timeout

    sseEmitters.computeIfAbsent(shopDomain, k -> new CopyOnWriteArrayList<>()).add(emitter);
    logger.info(
        "SSE emitter added for shop: {} (total emitters: {})",
        shopDomain,
        sseEmitters.get(shopDomain).size());

    emitter.onCompletion(
        () -> {
          logger.debug("SSE connection completed for shop: {}", shopDomain);
          removeEmitter(shopDomain, emitter);
        });

    emitter.onTimeout(
        () -> {
          logger.debug("SSE connection timed out for shop: {}", shopDomain);
          removeEmitter(shopDomain, emitter);
        });

    emitter.onError(
        e -> {
          logger.warn("SSE connection error for shop {}: {}", shopDomain, e.getMessage());
          removeEmitter(shopDomain, emitter);
        });

    try {
      // Set proper headers for SSE
      emitter.send(
          SseEmitter.event()
              .name("connected")
              .data("Subscribed to session events for shop: " + shopDomain)
              .id(String.valueOf(System.currentTimeMillis()))
              .reconnectTime(3000));
      logger.info("SSE connection established for shop: {}", shopDomain);
    } catch (Exception e) {
      logger.warn("Failed to send initial SSE event for shop {}: {}", shopDomain, e.getMessage());
      removeEmitter(shopDomain, emitter);
    }

    return emitter;
  }

  private void removeEmitter(String shopDomain, SseEmitter emitter) {
    try {
      CopyOnWriteArrayList<SseEmitter> emitters = sseEmitters.get(shopDomain);
      if (emitters != null) {
        emitters.remove(emitter);
        if (emitters.isEmpty()) {
          sseEmitters.remove(shopDomain);
        }
      }
    } catch (Exception e) {
      logger.warn("Error removing SSE emitter for shop {}: {}", shopDomain, e.getMessage());
    }
  }

  private void broadcastSessionInvalidated(String shopDomain) {
    CopyOnWriteArrayList<SseEmitter> emitters = sseEmitters.get(shopDomain);
    if (emitters != null && !emitters.isEmpty()) {
      logger.info(
          "Broadcasting session invalidation to {} SSE clients for shop: {}",
          emitters.size(),
          shopDomain);

      // Create a copy to avoid concurrent modification issues
      List<SseEmitter> emittersCopy = new ArrayList<>(emitters);

      for (SseEmitter emitter : emittersCopy) {
        try {
          // Send the event asynchronously to prevent blocking
          emitter.send(
              SseEmitter.event()
                  .name("session_invalidated")
                  .data(
                      "{\"event\":\"session_invalidated\",\"message\":\"Your session has been invalidated by an administrator.\"}")
                  .id(String.valueOf(System.currentTimeMillis())));

          logger.debug(
              "Successfully sent session invalidation event to SSE client for shop: {}",
              shopDomain);
        } catch (Exception e) {
          logger.warn(
              "Failed to send session invalidation event to SSE client for shop {}: {}",
              shopDomain,
              e.getMessage());
          // Remove the failed emitter
          try {
            emitters.remove(emitter);
            if (emitters.isEmpty()) {
              sseEmitters.remove(shopDomain);
            }
          } catch (Exception removeEx) {
            logger.warn("Error removing failed SSE emitter: {}", removeEx.getMessage());
          }
        }
      }
    } else {
      logger.info(
          "No SSE clients connected for shop: {} (emitters: {})",
          shopDomain,
          emitters != null ? emitters.size() : "null");
    }
  }
}
