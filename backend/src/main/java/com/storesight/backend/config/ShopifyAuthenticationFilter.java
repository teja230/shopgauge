package com.storesight.backend.config;

import com.storesight.backend.service.ShopService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class ShopifyAuthenticationFilter extends OncePerRequestFilter {

  private static final Logger logger = LoggerFactory.getLogger(ShopifyAuthenticationFilter.class);
  private final ShopService shopService;

  public ShopifyAuthenticationFilter(ShopService shopService) {
    this.shopService = shopService;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {

    // Skip auth for public endpoints
    String path = request.getRequestURI();
    if (path.startsWith("/api/auth/") || path.startsWith("/actuator/")) {
      filterChain.doFilter(request, response);
      return;
    }

    // Extract shop from cookie
    String shopDomain = getShopFromCookie(request);

    // If shop parameter is present in query string, use it as fallback
    if (shopDomain == null) {
      shopDomain = request.getParameter("shop");
    }

    if (shopDomain == null) {
      logger.debug("No shop found in cookie or query parameter");
      unauthorized(response);
      return;
    }

    logger.debug("Found shop in request: {}", shopDomain);

    // Get sessionId if available
    String sessionId = request.getSession(false) != null ? request.getSession().getId() : null;

    // Verify shop has a valid access token
    String accessToken = shopService.getTokenForShop(shopDomain, sessionId);
    if (accessToken == null) {
      logger.warn("No access token found for shop: {}", shopDomain);
      unauthorized(response);
      return;
    }

    // Authentication successful, set security context
    var authentication =
        new UsernamePasswordAuthenticationToken(
            shopDomain, accessToken, AuthorityUtils.createAuthorityList("ROLE_SHOP"));
    SecurityContextHolder.getContext().setAuthentication(authentication);

    // Continue with the request
    filterChain.doFilter(request, response);
  }

  private String getShopFromCookie(HttpServletRequest request) {
    Cookie[] cookies = request.getCookies();
    if (cookies != null) {
      for (Cookie cookie : cookies) {
        if ("shop".equals(cookie.getName())) {
          return cookie.getValue();
        }
      }
    }
    return null;
  }

  private void unauthorized(HttpServletResponse response) throws IOException {
    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    response.getWriter().write("{\"error\":\"Authentication required\"}");
  }
}
