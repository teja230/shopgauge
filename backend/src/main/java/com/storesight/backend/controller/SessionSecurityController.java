package com.storesight.backend.controller;

import com.storesight.backend.service.AdminAuthService;
import com.storesight.backend.service.EnhancedSessionValidationService;
import com.storesight.backend.service.RedisSessionService;
import com.storesight.backend.service.SessionSecurityService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Session Security Management Controller Provides admin endpoints for managing session security,
 * monitoring, and emergency actions
 */
@RestController
@RequestMapping("/api/admin/session-security")
public class SessionSecurityController {

  private static final Logger logger = LoggerFactory.getLogger(SessionSecurityController.class);

  @Autowired private SessionSecurityService sessionSecurityService;

  @Autowired private EnhancedSessionValidationService enhancedSessionValidationService;

  @Autowired private RedisSessionService redisSessionService;

  @Autowired private AdminAuthService adminAuthService;

  /** Get session security status for a specific session */
  @GetMapping("/session/{shopDomain}/{sessionId}/status")
  public ResponseEntity<Map<String, Object>> getSessionSecurityStatus(
      @PathVariable String shopDomain, @PathVariable String sessionId, HttpServletRequest request) {

    String clientIp = getClientIpAddress(request);
    String currentUser = getCurrentUsername(request);

    try {
      Optional<RedisSessionService.SessionData> sessionDataOpt =
          redisSessionService.getSessionData(shopDomain, sessionId);

      Map<String, Object> response = new HashMap<>();

      if (!sessionDataOpt.isPresent()) {
        response.put("session_found", false);
        response.put("message", "Session not found");
        return ResponseEntity.ok(response);
      }

      RedisSessionService.SessionData sessionData = sessionDataOpt.get();

      // Perform enhanced validation
      EnhancedSessionValidationService.EnhancedValidationResult validationResult =
          enhancedSessionValidationService.validateSession(
              shopDomain,
              sessionId,
              sessionData.getIpAddress(),
              sessionData.getUserAgent(),
              getRequestHeaders(request));

      response.put("session_found", true);
      response.put("session_id", sessionId);
      response.put("shop_domain", shopDomain);
      response.put("is_valid", validationResult.isValid());
      response.put("violations", validationResult.getViolations());
      response.put("warnings", validationResult.getWarnings());
      response.put("requires_reauthentication", validationResult.isRequiresReauthentication());
      response.put("requires_token_rotation", validationResult.isRequiresTokenRotation());

      // Session metadata
      response.put(
          "session_metadata",
          Map.of(
              "created_at", sessionData.getCreatedAt(),
              "last_activity", sessionData.getLastAccessedAt(),
              "expires_at", sessionData.getExpiresAt(),
              "ip_address", sessionData.getIpAddress(),
              "is_active", sessionData.isActive(),
              "is_expired", sessionData.isExpired()));

      // Log this security check
      adminAuthService.logAuditEvent(
          "SESSION_SECURITY_STATUS_CHECKED",
          currentUser,
          "Checked security status for session " + sessionId + " in shop " + shopDomain,
          clientIp);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error(
          "Failed to get session security status for {}:{} - {}",
          shopDomain,
          sessionId,
          e.getMessage(),
          e);

      adminAuthService.logAuditEvent(
          "SESSION_SECURITY_STATUS_CHECK_FAILED",
          currentUser,
          "Failed to check security status for session " + sessionId + ": " + e.getMessage(),
          clientIp);

      return ResponseEntity.status(500)
          .body(
              Map.of("error", "Failed to get session security status", "message", e.getMessage()));
    }
  }

  /** Get security overview for all sessions of a shop */
  @GetMapping("/shop/{shopDomain}/overview")
  public ResponseEntity<Map<String, Object>> getShopSessionSecurityOverview(
      @PathVariable String shopDomain, HttpServletRequest request) {

    String clientIp = getClientIpAddress(request);
    String currentUser = getCurrentUsername(request);

    try {
      List<RedisSessionService.SessionData> activeSessions =
          redisSessionService.getActiveSessionsForShop(shopDomain);

      Map<String, Object> overview = new HashMap<>();
      overview.put("shop_domain", shopDomain);
      overview.put("total_active_sessions", activeSessions.size());

      int validSessions = 0;
      int sessionsWithViolations = 0;
      int sessionsWithWarnings = 0;
      int sessionsNeedingRotation = 0;

      for (RedisSessionService.SessionData sessionData : activeSessions) {
        try {
          EnhancedSessionValidationService.EnhancedValidationResult validationResult =
              enhancedSessionValidationService.validateSession(
                  shopDomain,
                  sessionData.getSessionId(),
                  sessionData.getIpAddress(),
                  sessionData.getUserAgent(),
                  getRequestHeaders(request));

          if (validationResult.isValid()) {
            validSessions++;
          }
          if (validationResult.hasViolations()) {
            sessionsWithViolations++;
          }
          if (validationResult.hasWarnings()) {
            sessionsWithWarnings++;
          }
          if (validationResult.isRequiresTokenRotation()) {
            sessionsNeedingRotation++;
          }
        } catch (Exception e) {
          logger.warn(
              "Failed to validate session {} for overview: {}",
              sessionData.getSessionId(),
              e.getMessage());
        }
      }

      overview.put("valid_sessions", validSessions);
      overview.put("sessions_with_violations", sessionsWithViolations);
      overview.put("sessions_with_warnings", sessionsWithWarnings);
      overview.put("sessions_needing_rotation", sessionsNeedingRotation);
      overview.put("security_score", calculateSecurityScore(validSessions, activeSessions.size()));

      // Log this overview access
      adminAuthService.logAuditEvent(
          "SHOP_SESSION_SECURITY_OVERVIEW_ACCESSED",
          currentUser,
          "Accessed session security overview for shop "
              + shopDomain
              + " - "
              + activeSessions.size()
              + " active sessions",
          clientIp);

      return ResponseEntity.ok(overview);

    } catch (Exception e) {
      logger.error(
          "Failed to get session security overview for shop {}: {}", shopDomain, e.getMessage(), e);

      adminAuthService.logAuditEvent(
          "SHOP_SESSION_SECURITY_OVERVIEW_FAILED",
          currentUser,
          "Failed to get session security overview for shop " + shopDomain + ": " + e.getMessage(),
          clientIp);

      return ResponseEntity.status(500)
          .body(
              Map.of(
                  "error", "Failed to get session security overview", "message", e.getMessage()));
    }
  }

  /** Force invalidate a session due to security concerns */
  @PostMapping("/session/{shopDomain}/{sessionId}/force-invalidate")
  public ResponseEntity<Map<String, Object>> forceInvalidateSession(
      @PathVariable String shopDomain,
      @PathVariable String sessionId,
      @RequestBody Map<String, String> request,
      HttpServletRequest httpRequest) {

    String reason = request.get("reason");
    String clientIp = getClientIpAddress(httpRequest);
    String currentUser = getCurrentUsername(httpRequest);

    if (reason == null || reason.trim().isEmpty()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Reason is required for force invalidation"));
    }

    try {
      // Force invalidate the session
      enhancedSessionValidationService.forceInvalidateSession(
          shopDomain, sessionId, reason, clientIp);

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Session force invalidated successfully");
      response.put("session_id", sessionId);
      response.put("shop_domain", shopDomain);
      response.put("reason", reason);
      response.put("invalidated_by", currentUser);

      // Log this critical security action
      adminAuthService.logAuditEvent(
          "SESSION_FORCE_INVALIDATED_BY_ADMIN",
          currentUser,
          "Force invalidated session "
              + sessionId
              + " in shop "
              + shopDomain
              + " - Reason: "
              + reason,
          clientIp);

      logger.warn(
          "Session {}:{} force invalidated by admin {} - Reason: {}",
          shopDomain,
          sessionId,
          currentUser,
          reason);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error(
          "Failed to force invalidate session {}:{} - {}",
          shopDomain,
          sessionId,
          e.getMessage(),
          e);

      adminAuthService.logAuditEvent(
          "SESSION_FORCE_INVALIDATION_FAILED",
          currentUser,
          "Failed to force invalidate session " + sessionId + ": " + e.getMessage(),
          clientIp);

      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to force invalidate session", "message", e.getMessage()));
    }
  }

  /** Mark session as suspicious */
  @PostMapping("/session/{shopDomain}/{sessionId}/mark-suspicious")
  public ResponseEntity<Map<String, Object>> markSessionSuspicious(
      @PathVariable String shopDomain,
      @PathVariable String sessionId,
      @RequestBody Map<String, String> request,
      HttpServletRequest httpRequest) {

    String reason = request.get("reason");
    String clientIp = getClientIpAddress(httpRequest);
    String currentUser = getCurrentUsername(httpRequest);

    if (reason == null || reason.trim().isEmpty()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Reason is required for marking session as suspicious"));
    }

    try {
      // Mark session as suspicious
      enhancedSessionValidationService.markSessionSuspicious(
          shopDomain, sessionId, reason, clientIp);

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Session marked as suspicious");
      response.put("session_id", sessionId);
      response.put("shop_domain", shopDomain);
      response.put("reason", reason);
      response.put("marked_by", currentUser);

      // Log this security action
      adminAuthService.logAuditEvent(
          "SESSION_MARKED_SUSPICIOUS_BY_ADMIN",
          currentUser,
          "Marked session " + sessionId + " as suspicious - Reason: " + reason,
          clientIp);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error(
          "Failed to mark session {}:{} as suspicious - {}",
          shopDomain,
          sessionId,
          e.getMessage(),
          e);

      adminAuthService.logAuditEvent(
          "SESSION_MARK_SUSPICIOUS_FAILED",
          currentUser,
          "Failed to mark session " + sessionId + " as suspicious: " + e.getMessage(),
          clientIp);

      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to mark session as suspicious", "message", e.getMessage()));
    }
  }

  /** Rotate session token for enhanced security */
  @PostMapping("/session/{shopDomain}/{sessionId}/rotate-token")
  public ResponseEntity<Map<String, Object>> rotateSessionToken(
      @PathVariable String shopDomain,
      @PathVariable String sessionId,
      HttpServletRequest httpRequest) {

    String clientIp = getClientIpAddress(httpRequest);
    String currentUser = getCurrentUsername(httpRequest);

    try {
      Optional<String> currentTokenOpt = redisSessionService.getSessionToken(shopDomain, sessionId);

      if (!currentTokenOpt.isPresent()) {
        return ResponseEntity.badRequest().body(Map.of("error", "Session token not found"));
      }

      String currentToken = currentTokenOpt.get();
      String newToken =
          sessionSecurityService.rotateSessionToken(currentToken, sessionId, shopDomain);

      if (newToken == null) {
        return ResponseEntity.status(500).body(Map.of("error", "Failed to generate new token"));
      }

      // Update the session with new token
      redisSessionService.cacheSessionToken(shopDomain, sessionId, newToken);

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Session token rotated successfully");
      response.put("session_id", sessionId);
      response.put("shop_domain", shopDomain);
      response.put("new_token_length", newToken.length());
      response.put("rotated_by", currentUser);

      // Log this security action
      adminAuthService.logAuditEvent(
          "SESSION_TOKEN_ROTATED_BY_ADMIN",
          currentUser,
          "Rotated token for session " + sessionId + " in shop " + shopDomain,
          clientIp);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error(
          "Failed to rotate token for session {}:{} - {}",
          shopDomain,
          sessionId,
          e.getMessage(),
          e);

      adminAuthService.logAuditEvent(
          "SESSION_TOKEN_ROTATION_FAILED",
          currentUser,
          "Failed to rotate token for session " + sessionId + ": " + e.getMessage(),
          clientIp);

      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to rotate session token", "message", e.getMessage()));
    }
  }

  /** Get system-wide session security metrics */
  @GetMapping("/metrics")
  public ResponseEntity<Map<String, Object>> getSessionSecurityMetrics(HttpServletRequest request) {
    String clientIp = getClientIpAddress(request);
    String currentUser = getCurrentUsername(request);

    try {
      // This would require implementing system-wide session metrics collection
      // For now, return basic metrics structure
      Map<String, Object> metrics = new HashMap<>();
      metrics.put("timestamp", java.time.Instant.now());
      metrics.put("note", "Session security metrics collection - implementation pending");

      // Log this metrics access
      adminAuthService.logAuditEvent(
          "SESSION_SECURITY_METRICS_ACCESSED",
          currentUser,
          "Accessed session security metrics",
          clientIp);

      return ResponseEntity.ok(metrics);

    } catch (Exception e) {
      logger.error("Failed to get session security metrics: {}", e.getMessage(), e);
      return ResponseEntity.status(500)
          .body(
              Map.of("error", "Failed to get session security metrics", "message", e.getMessage()));
    }
  }

  private double calculateSecurityScore(int validSessions, int totalSessions) {
    if (totalSessions == 0) return 100.0;
    return (double) validSessions / totalSessions * 100.0;
  }

  private String getClientIpAddress(HttpServletRequest request) {
    String xForwardedFor = request.getHeader("X-Forwarded-For");
    if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
      return xForwardedFor.split(",")[0].trim();
    }

    String xRealIp = request.getHeader("X-Real-IP");
    if (xRealIp != null && !xRealIp.isEmpty()) {
      return xRealIp;
    }

    return request.getRemoteAddr();
  }

  private String getCurrentUsername(HttpServletRequest request) {
    String token = getAdminTokenFromRequest(request);
    if (token != null) {
      return adminAuthService.getUsernameFromToken(token);
    }
    return "unknown";
  }

  private String getAdminTokenFromRequest(HttpServletRequest request) {
    // Check for admin token in cookie
    jakarta.servlet.http.Cookie[] cookies = request.getCookies();
    if (cookies != null) {
      for (jakarta.servlet.http.Cookie cookie : cookies) {
        if ("admin_token".equals(cookie.getName())) {
          return cookie.getValue();
        }
      }
    }

    // Check for admin token in Authorization header
    String authHeader = request.getHeader("Authorization");
    if (authHeader != null && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    return null;
  }

  private Map<String, String> getRequestHeaders(HttpServletRequest request) {
    Map<String, String> headers = new HashMap<>();
    java.util.Enumeration<String> headerNames = request.getHeaderNames();

    while (headerNames.hasMoreElements()) {
      String headerName = headerNames.nextElement();
      headers.put(headerName, request.getHeader(headerName));
    }

    return headers;
  }
}
