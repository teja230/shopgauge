package com.storesight.backend.config;

import com.storesight.backend.service.AdminAuthService;
import com.storesight.backend.service.AdminRateLimitingService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class AdminAuthenticationFilter extends OncePerRequestFilter {

  private static final Logger logger = LoggerFactory.getLogger(AdminAuthenticationFilter.class);

  @Autowired private AdminAuthService adminAuthService;
  @Autowired private AdminRateLimitingService adminRateLimitingService;

  // Sensitive admin operations that require additional rate limiting
  private static final List<String> SENSITIVE_OPERATIONS =
      Arrays.asList(
          "/api/admin/secrets",
          "/api/admin/emergency",
          "/api/admin/comprehensive-cleanup",
          "/api/admin/kill-long-running-queries",
          "/api/admin/cleanup-connections");

  // Critical operations that require additional authorization
  private static final List<String> CRITICAL_OPERATIONS =
      Arrays.asList(
          "/api/admin/emergency/comprehensive-cleanup",
          "/api/admin/emergency/kill-long-running-queries",
          "/api/admin/emergency/cleanup-connections",
          "/api/admin/secrets");

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {

    String path = request.getRequestURI();
    String clientIp = getClientIpAddress(request);
    String method = request.getMethod();

    // Only apply admin auth to admin endpoints
    if (!path.startsWith("/api/admin/") && !path.startsWith("/api/sessions/admin/")) {
      filterChain.doFilter(request, response);
      return;
    }

    // Skip auth for admin login endpoint but apply rate limiting
    if (path.equals("/api/admin/login")) {
      // Apply login rate limiting
      if (!adminRateLimitingService.isLoginAttemptAllowed(clientIp)) {
        logger.warn("Admin login rate limit exceeded for IP: {}", clientIp);
        handleRateLimitExceeded(response, "Too many login attempts. Please try again later.");
        return;
      }
      filterChain.doFilter(request, response);
      return;
    }

    try {
      // Apply general admin rate limiting
      if (!adminRateLimitingService.isAdminRequestAllowed(clientIp, path)) {
        logger.warn("Admin request rate limit exceeded for IP: {} on path: {}", clientIp, path);
        handleRateLimitExceeded(response, "Too many admin requests. Please slow down.");
        return;
      }

      // Check for sensitive operations
      boolean isSensitiveOperation = SENSITIVE_OPERATIONS.stream().anyMatch(path::startsWith);

      if (isSensitiveOperation
          && !adminRateLimitingService.isSensitiveOperationAllowed(clientIp, path)) {
        logger.warn(
            "Sensitive operation rate limit exceeded for IP: {} on path: {}", clientIp, path);
        handleRateLimitExceeded(
            response, "Too many sensitive operations. Please wait before retrying.");
        return;
      }

      // Check for admin authentication
      String adminToken = getAdminTokenFromRequest(request);

      if (adminToken != null
          && adminAuthService.validateJwtToken(adminToken)
          && !adminAuthService.isTokenBlacklisted(adminToken)) {

        // Set admin authentication context
        String username = adminAuthService.getUsernameFromToken(adminToken);
        UsernamePasswordAuthenticationToken authentication =
            new UsernamePasswordAuthenticationToken(
                username, null, AuthorityUtils.createAuthorityList("ROLE_ADMIN"));
        SecurityContextHolder.getContext().setAuthentication(authentication);

        // Check for critical operations that require additional authorization
        boolean isCriticalOperation = CRITICAL_OPERATIONS.stream().anyMatch(path::startsWith);

        if (isCriticalOperation) {
          // Additional authorization check for critical operations
          if (!adminAuthService.isAuthorizedForCriticalOperation(username, path)) {
            logger.warn(
                "Critical operation authorization failed for user: {} on path: {} from IP: {}",
                username,
                path,
                clientIp);
            adminAuthService.logAuditEvent(
                "CRITICAL_OPERATION_DENIED",
                username,
                "Authorization denied for critical endpoint: " + path + " via " + method,
                clientIp);
            handleAdminAuthenticationFailure(
                response, "Insufficient privileges for this operation");
            return;
          }

          // Log critical operations for audit
          adminAuthService.logAuditEvent(
              "CRITICAL_OPERATION",
              username,
              "Accessed critical endpoint: " + path + " via " + method,
              clientIp);
        }

        // Record successful admin request for rate limiting
        adminRateLimitingService.recordAdminRequest(clientIp, path);

        if (isSensitiveOperation) {
          adminRateLimitingService.recordSensitiveOperation(clientIp, path);
          // Log sensitive operations for audit
          adminAuthService.logAuditEvent(
              "SENSITIVE_OPERATION",
              username,
              "Accessed sensitive endpoint: " + path + " via " + method,
              clientIp);
        }

        // Log all admin operations for comprehensive audit trail
        adminAuthService.logAuditEvent(
            "ADMIN_ACCESS",
            username,
            "Accessed admin endpoint: " + path + " via " + method,
            clientIp);

        // Add security headers
        addSecurityHeaders(response);

        logger.debug("Admin authentication successful for path: {} by user: {}", path, username);
        filterChain.doFilter(request, response);
        return;
      }

      // No valid admin authentication found
      logger.warn("Admin authentication failed for path: {} from IP: {}", path, clientIp);
      adminAuthService.logAuditEvent(
          "UNAUTHORIZED_ACCESS_ATTEMPT",
          "unknown",
          "Failed to access admin endpoint: " + path,
          clientIp);
      handleAdminAuthenticationFailure(response, "Admin authentication required");
      return;

    } catch (Exception e) {
      logger.error(
          "Admin authentication filter error for path: {} from IP: {} - {}",
          path,
          clientIp,
          e.getMessage(),
          e);
      adminAuthService.logAuditEvent(
          "AUTHENTICATION_ERROR",
          "unknown",
          "Authentication filter error on: " + path + " - " + e.getMessage(),
          clientIp);
      handleAdminAuthenticationFailure(response, "Admin authentication error occurred");
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

  private void handleAdminAuthenticationFailure(HttpServletResponse response, String message) {
    response.setStatus(HttpStatus.UNAUTHORIZED.value());
    response.setContentType("application/json");
    try {
      response
          .getWriter()
          .write(
              String.format(
                  "{\"error\":\"Admin authentication failed\",\"message\":\"%s\"}", message));
    } catch (IOException e) {
      logger.error("Failed to write authentication failure response", e);
    }
  }

  private void handleRateLimitExceeded(HttpServletResponse response, String message) {
    response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
    response.setContentType("application/json");
    response.setHeader("Retry-After", "60");
    try {
      response
          .getWriter()
          .write(
              String.format(
                  "{\"error\":\"Rate limit exceeded\",\"message\":\"%s\",\"retry_after\":60}",
                  message));
    } catch (IOException e) {
      logger.error("Failed to write rate limit response", e);
    }
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

  private void addSecurityHeaders(HttpServletResponse response) {
    // Add security headers for admin endpoints
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("X-XSS-Protection", "1; mode=block");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Expires", "0");
  }
}
