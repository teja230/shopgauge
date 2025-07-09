package com.storesight.backend.config;

import com.storesight.backend.service.AdminAuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
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

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {

    String path = request.getRequestURI();

    // Only apply admin auth to admin endpoints
    if (!path.startsWith("/api/admin/")) {
      filterChain.doFilter(request, response);
      return;
    }

    // Skip auth for admin login endpoint
    if (path.equals("/api/admin/login")) {
      filterChain.doFilter(request, response);
      return;
    }

    try {
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

        logger.debug("Admin authentication successful for path: {} by user: {}", path, username);
        filterChain.doFilter(request, response);
        return;
      }

      // No valid admin authentication found
      logger.warn("Admin authentication failed for path: {}", path);
      handleAdminAuthenticationFailure(response, "Admin authentication required");
      return;

    } catch (Exception e) {
      logger.error("Admin authentication filter error for path: {} - {}", path, e.getMessage(), e);
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
}
