package com.storesight.backend.controller;

import com.storesight.backend.model.ShopSession;
import com.storesight.backend.service.ShopService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions")
public class SessionManagementController {

  private static final Logger logger = LoggerFactory.getLogger(SessionManagementController.class);
  private final ShopService shopService;
  private final RedisTemplate<String, String> redisTemplate;

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

  /** Session heartbeat endpoint to detect browser closure and maintain session activity */
  @PostMapping("/heartbeat")
  public ResponseEntity<Map<String, Object>> sessionHeartbeat(
      @CookieValue(value = "shop", required = false) String shop, HttpServletRequest request) {

    Map<String, Object> response = new HashMap<>();

    if (shop == null) {
      response.put("error", "No shop authentication found");
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    try {
      String sessionId = request.getSession().getId();

      // Update session last accessed time
      boolean sessionUpdated = shopService.updateSessionHeartbeat(shop, sessionId);

      if (sessionUpdated) {
        response.put("success", true);
        response.put("message", "Session heartbeat recorded");
        response.put("sessionId", sessionId);
        response.put("shop", shop);
        response.put("timestamp", System.currentTimeMillis());

        // Return active session count for client-side monitoring
        List<ShopSession> activeSessions = shopService.getActiveSessionsForShop(shop);
        response.put("activeSessionCount", activeSessions.size());

        return ResponseEntity.ok(response);
      } else {
        response.put("error", "Session not found or inactive");
        response.put("success", false);
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
      }

    } catch (Exception e) {
      logger.error("Error processing session heartbeat for shop {}: {}", shop, e.getMessage(), e);
      response.put("error", "Failed to process session heartbeat");
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
      String currentSessionId = request.getSession().getId();

      // Retry mechanism to handle session commit timing during login
      List<ShopSession> activeSessions = null;
      boolean currentSessionFound = false;
      int maxRetries = 3;
      int retryDelay = 500; // 500ms between retries

      for (int attempt = 0; attempt < maxRetries; attempt++) {
        activeSessions = shopService.getActiveSessionsForShop(shop);
        currentSessionFound =
            activeSessions.stream()
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

      // Check if limit would be exceeded
      boolean limitReached = activeSessions.size() >= 5; // MAX_SESSIONS_PER_SHOP

      response.put("limitReached", limitReached);
      response.put("maxSessions", 5);
      response.put("currentSessionCount", activeSessions.size());
      response.put("shop", shop);
      response.put("currentSessionId", currentSessionId);
      response.put("currentSessionFound", currentSessionFound);

      // Include detailed session information for UI
      List<Map<String, Object>> sessionDetails =
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
}
