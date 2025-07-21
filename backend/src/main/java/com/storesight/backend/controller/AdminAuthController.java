package com.storesight.backend.controller;

import com.storesight.backend.service.AdminAuthService;
import com.storesight.backend.service.AdminRateLimitingService;

import com.storesight.backend.service.SseService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
public class AdminAuthController {

  private static final Logger logger = LoggerFactory.getLogger(AdminAuthController.class);

  @Autowired private AdminAuthService adminAuthService;
  @Autowired private AdminRateLimitingService adminRateLimitingService;
  @Autowired private SseService sseService;

  @Value("${admin.auth.require-https:true}")
  private boolean requireHttps;

  @PostMapping("/login")
  public ResponseEntity<Map<String, Object>> adminLogin(
      @RequestBody Map<String, String> loginRequest,
      HttpServletRequest request,
      HttpServletResponse response) {

    String username = loginRequest.get("username");
    String password = loginRequest.get("password");

    Map<String, Object> result = new HashMap<>();

    // Get client IP for rate limiting
    String clientIp = getClientIpAddress(request);

    // Check if account is locked
    if (adminAuthService.isAccountLocked(clientIp)) {
      result.put("success", false);
      result.put("error", "Account temporarily locked due to too many failed attempts");
      result.put("locked", true);
      adminAuthService.logAuditEvent(
          "LOGIN_BLOCKED", username, "Account locked from IP: " + clientIp, clientIp);
      return ResponseEntity.status(401).body(result);
    }

    // Validate credentials
    if (adminAuthService.validateCredentials(username, password)) {
      // Generate JWT token
      String token = adminAuthService.generateJwtToken(username);

      // Set admin token cookie with secure settings
      Cookie adminCookie = new Cookie("admin_token", token);
      adminCookie.setPath("/");
      adminCookie.setHttpOnly(true);
      adminCookie.setMaxAge(60 * 60 * 24 * 7); // 7 days
      adminCookie.setSecure(requireHttps);
      adminCookie.setAttribute("SameSite", "Strict");
      adminCookie.setDomain(getBaseDomain(request.getServerName()));
      response.addCookie(adminCookie);

      // Clear any failed login attempts
      adminAuthService.clearFailedLoginAttempts(clientIp);

      result.put("success", true);
      result.put("message", "Admin login successful");
      result.put("token", token);
      result.put("username", username);

      logger.info("Admin login successful for IP: {} with username: {}", clientIp, username);
      adminAuthService.logAuditEvent(
          "LOGIN_SUCCESS", username, "Successful login from IP: " + clientIp, clientIp);
      return ResponseEntity.ok(result);

    } else {
      // Record failed login attempt
      adminAuthService.recordFailedLoginAttempt(clientIp, username);
      adminRateLimitingService.recordLoginAttempt(clientIp);

      result.put("success", false);
      result.put("error", "Invalid username or password");
      result.put("locked", false);
      result.put(
          "remaining_attempts", adminRateLimitingService.getRemainingLoginAttempts(clientIp));

      logger.warn("Admin login failed for IP: {} with username: {}", clientIp, username);
      return ResponseEntity.status(401).body(result);
    }
  }

  @PostMapping("/logout")
  public ResponseEntity<Map<String, Object>> adminLogout(
      HttpServletRequest request, HttpServletResponse response) {

    String clientIp = getClientIpAddress(request);
    String token = getAdminTokenFromRequest(request);
    String username = token != null ? adminAuthService.getUsernameFromToken(token) : "unknown";

    // Always attempt to invalidate the token, even if it's null or invalid
    if (token != null && !token.trim().isEmpty()) {
      adminAuthService.invalidateToken(token);
      logger.info("Admin token invalidated for user: {} from IP: {}", username, clientIp);
    } else {
      logger.info("Admin logout requested without valid token from IP: {}", clientIp);
    }

    // Clear admin token cookie with multiple domain variations to ensure it's cleared
    clearAdminCookie(response, request.getServerName());

    // Also clear with null domain for localhost/development
    if (request.getServerName().contains("localhost")
        || request.getServerName().contains("127.0.0.1")) {
      clearAdminCookie(response, null);
    }

    // Send admin logout notification to all connected shop users
    // This is just a notification, not session invalidation
    try {
      broadcastAdminLogoutNotification();
    } catch (Exception e) {
      logger.warn("Failed to broadcast admin logout notification: {}", e.getMessage());
      // Don't fail the logout if SSE broadcast fails
    }

    Map<String, Object> result = new HashMap<>();
    result.put("success", true);
    result.put("message", "Admin logout successful");
    result.put("username", username);

    logger.info("Admin logout successful for user: {} from IP: {}", username, clientIp);
    adminAuthService.logAuditEvent("LOGOUT", username, "Logout from IP: " + clientIp, clientIp);
    return ResponseEntity.ok(result);
  }



  @GetMapping("/status")
  public ResponseEntity<Map<String, Object>> adminStatus(HttpServletRequest request) {
    String token = getAdminTokenFromRequest(request);
    String clientIp = getClientIpAddress(request);

    Map<String, Object> result = adminAuthService.getSessionInfo(token);

    if (Boolean.TRUE.equals(result.get("authenticated"))) {
      logger.debug(
          "Admin status check successful for user: {} from IP: {}",
          result.get("username"),
          clientIp);
    } else {
      logger.debug("Admin status check failed from IP: {}", clientIp);
    }

    return ResponseEntity.ok(result);
  }

  @PostMapping("/refresh")
  public ResponseEntity<Map<String, Object>> refreshToken(
      HttpServletRequest request, HttpServletResponse response) {

    String token = getAdminTokenFromRequest(request);
    String clientIp = getClientIpAddress(request);

    Map<String, Object> result = new HashMap<>();

    if (token != null
        && adminAuthService.validateJwtToken(token)
        && !adminAuthService.isTokenBlacklisted(token)) {

      String username = adminAuthService.getUsernameFromToken(token);

      // Generate new token
      String newToken = adminAuthService.generateJwtToken(username);

      // Invalidate old token
      adminAuthService.invalidateToken(token);

      // Set new admin token cookie
      Cookie adminCookie = new Cookie("admin_token", newToken);
      adminCookie.setPath("/");
      adminCookie.setHttpOnly(true);
      adminCookie.setMaxAge(60 * 60 * 24 * 7); // 7 days
      adminCookie.setSecure(requireHttps);
      adminCookie.setAttribute("SameSite", "Strict");
      adminCookie.setDomain(getBaseDomain(request.getServerName()));
      response.addCookie(adminCookie);

      result.put("success", true);
      result.put("message", "Token refreshed successfully");
      result.put("token", newToken);
      result.put("username", username);

      logger.info("Admin token refreshed for user: {} from IP: {}", username, clientIp);
      adminAuthService.logAuditEvent(
          "TOKEN_REFRESHED", username, "Token refreshed from IP: " + clientIp, clientIp);

      return ResponseEntity.ok(result);
    } else {
      result.put("success", false);
      result.put("error", "Invalid or expired token");
      return ResponseEntity.status(401).body(result);
    }
  }

  @GetMapping("/rate-limit-status")
  public ResponseEntity<Map<String, Object>> getRateLimitStatus(HttpServletRequest request) {
    String clientIp = getClientIpAddress(request);
    String token = getAdminTokenFromRequest(request);
    String username = token != null ? adminAuthService.getUsernameFromToken(token) : "unknown";

    Map<String, Object> result = new HashMap<>();

    try {
      AdminRateLimitingService.RateLimitStats stats =
          adminRateLimitingService.getRateLimitStats(clientIp);

      result.put("success", true);
      result.put("ip_address", clientIp);
      result.put("remaining_admin_requests", stats.getRemainingAdminRequests());
      result.put("remaining_login_attempts", stats.getRemainingLoginAttempts());
      result.put("rate_limit_enabled", stats.isRateLimitEnabled());
      result.put("timestamp", java.time.Instant.now().toString());

      // Log rate limit status check for audit
      adminAuthService.logAuditEvent(
          "RATE_LIMIT_STATUS_CHECK",
          username,
          "Rate limit status checked from IP: " + clientIp,
          clientIp);

      return ResponseEntity.ok(result);
    } catch (Exception e) {
      logger.error("Failed to get rate limit status for IP {}: {}", clientIp, e.getMessage());
      result.put("success", false);
      result.put("error", "Failed to retrieve rate limit status");
      return ResponseEntity.status(500).body(result);
    }
  }

  private String getAdminTokenFromRequest(HttpServletRequest request) {
    // Check for admin token in cookie
    Cookie[] cookies = request.getCookies();
    if (cookies != null) {
      for (Cookie cookie : cookies) {
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

  private String getBaseDomain(String host) {
    if (host == null || host.isBlank()) {
      return null;
    }

    // Remove port if present
    host = host.split(":")[0];

    String[] parts = host.split("\\.");
    if (parts.length < 2) {
      return null; // Don't set domain for localhost or single-part domains
    }

    // For domains like shopgaugeai.com, just return the full domain
    if (parts.length == 2) {
      return host;
    }

    // For subdomains like api.shopgaugeai.com, return the base domain
    if (parts.length > 2) {
      return parts[parts.length - 2] + "." + parts[parts.length - 1];
    }

    return null;
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

  private void clearAdminCookie(HttpServletResponse response, String domain) {
    Cookie adminCookie = new Cookie("admin_token", "");
    adminCookie.setPath("/");
    adminCookie.setHttpOnly(true);
    adminCookie.setMaxAge(0); // Expire immediately
    adminCookie.setSecure(requireHttps);
    adminCookie.setAttribute("SameSite", "Strict");
    if (domain != null) {
      adminCookie.setDomain(getBaseDomain(domain));
    }
    response.addCookie(adminCookie);
  }

  /**
   * Broadcast admin logout notification to all connected shop users This allows shop users to be
   * aware when an admin logs out
   */
  private void broadcastAdminLogoutNotification() {
    try {
      logger.info("Broadcasting admin logout notification to all connected shops");

      // Broadcast to all connected shops that an admin has logged out
      sseService.broadcastToAllShops(
          "admin_logout", "An administrator has logged out. Your session remains active.", 5000);

      logger.info("Admin logout notification broadcast completed");

    } catch (Exception e) {
      logger.error("Error broadcasting admin logout notification: {}", e.getMessage());
    }
  }
}
