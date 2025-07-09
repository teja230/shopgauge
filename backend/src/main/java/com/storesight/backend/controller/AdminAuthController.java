package com.storesight.backend.controller;

import com.storesight.backend.service.AdminAuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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

      result.put("success", false);
      result.put("error", "Invalid username or password");
      result.put("locked", false);

      logger.warn("Admin login failed for IP: {} with username: {}", clientIp, username);
      return ResponseEntity.status(401).body(result);
    }
  }

  @PostMapping("/logout")
  public ResponseEntity<Map<String, Object>> adminLogout(
      HttpServletRequest request, HttpServletResponse response) {

    String clientIp = getClientIpAddress(request);
    String token = getAdminTokenFromRequest(request);
    String username = adminAuthService.getUsernameFromToken(token);

    // Invalidate the token
    adminAuthService.invalidateToken(token);

    // Clear admin token cookie
    Cookie adminCookie = new Cookie("admin_token", "");
    adminCookie.setPath("/");
    adminCookie.setHttpOnly(true);
    adminCookie.setMaxAge(0); // Expire immediately
    adminCookie.setSecure(requireHttps);
    adminCookie.setAttribute("SameSite", "Strict");
    adminCookie.setDomain(getBaseDomain(request.getServerName()));
    response.addCookie(adminCookie);

    Map<String, Object> result = new HashMap<>();
    result.put("success", true);
    result.put("message", "Admin logout successful");

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
}
