package com.storesight.backend.config;

import com.storesight.backend.service.ShopService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.Enumeration;
import java.util.stream.Collectors;
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

    // Log all request details for debugging
    logRequestDetails(request);

    // Extract shop from cookie
    String shopDomain = getShopFromCookie(request);

    // If shop parameter is present in query string, use it as fallback
    if (shopDomain == null) {
      shopDomain = request.getParameter("shop");
      if (shopDomain != null) {
        logger.info("Found shop in query parameter: {}", shopDomain);

        // Set a new cookie for future requests if we found the shop in the query parameter
        // This helps with cross-domain cookie issues
        Cookie shopCookie = new Cookie("shop", shopDomain);
        shopCookie.setPath("/");
        shopCookie.setHttpOnly(false);
        shopCookie.setMaxAge(60 * 60 * 24 * 7); // 7 days
        shopCookie.setSecure(true);
        response.addCookie(shopCookie);

        // Also set the SameSite attribute via header
        // For cross-origin requests between subdomains, we need SameSite=None
        response.addHeader(
            "Set-Cookie",
            String.format(
                "shop=%s; Path=/; Max-Age=%d; SameSite=None; Secure",
                shopDomain, 60 * 60 * 24 * 7));

        logger.info("Set new shop cookie for subsequent requests: {}", shopDomain);
      }
    }

    // Look for shop in the session as a last resort
    if (shopDomain == null && request.getSession(false) != null) {
      shopDomain = (String) request.getSession().getAttribute("shopDomain");
      if (shopDomain != null) {
        logger.info("Found shop in session attribute: {}", shopDomain);
      }
    }

    if (shopDomain == null) {
      // Check referer header for shop parameter as last resort
      String referer = request.getHeader("referer");
      if (referer != null && referer.contains("shop=")) {
        int shopIndex = referer.indexOf("shop=");
        String shopParam = referer.substring(shopIndex + 5);
        if (shopParam.contains("&")) {
          shopParam = shopParam.substring(0, shopParam.indexOf("&"));
        }
        shopDomain = shopParam;
        logger.info("Extracted shop from referer URL: {}", shopDomain);
      }
    }

    if (shopDomain == null) {
      logger.warn("Authentication failed: No shop found in cookie, query parameter, or session");
      unauthorized(response);
      return;
    }

    logger.info("Found shop in request: {}", shopDomain);

    // Get sessionId if available
    String sessionId = request.getSession(false) != null ? request.getSession().getId() : null;

    // Verify shop has a valid access token
    String accessToken = shopService.getTokenForShop(shopDomain, sessionId);
    if (accessToken == null) {
      logger.warn("No access token found for shop: {}", shopDomain);
      unauthorized(response);
      return;
    }

    // Store shop in session for future requests as a fallback
    if (request.getSession(false) != null) {
      request.getSession().setAttribute("shopDomain", shopDomain);
    }

    // Authentication successful, set security context
    var authentication =
        new UsernamePasswordAuthenticationToken(
            shopDomain, accessToken, AuthorityUtils.createAuthorityList("ROLE_SHOP"));
    SecurityContextHolder.getContext().setAuthentication(authentication);
    logger.info("Successfully authenticated shop: {}", shopDomain);

    // Continue with the request
    filterChain.doFilter(request, response);
  }

  private void logRequestDetails(HttpServletRequest request) {
    // Log headers
    Enumeration<String> headerNames = request.getHeaderNames();
    if (headerNames != null) {
      logger.debug(
          "Request headers: {}",
          Collections.list(headerNames).stream()
              .map(name -> name + "=" + request.getHeader(name))
              .collect(Collectors.joining(", ")));
    }

    // Log cookies
    Cookie[] cookies = request.getCookies();
    if (cookies != null) {
      logger.debug(
          "Request cookies: {}",
          Arrays.stream(cookies)
              .map(
                  c ->
                      c.getName()
                          + "="
                          + c.getValue()
                          + " (domain="
                          + c.getDomain()
                          + ",path="
                          + c.getPath()
                          + ")")
              .collect(Collectors.joining(", ")));
    } else {
      logger.debug("No cookies in request");
    }

    // Log session info
    if (request.getSession(false) != null) {
      logger.debug("Session ID: {}", request.getSession().getId());
    } else {
      logger.debug("No active session");
    }
  }

  private String getShopFromCookie(HttpServletRequest request) {
    Cookie[] cookies = request.getCookies();
    if (cookies != null) {
      for (Cookie cookie : cookies) {
        if ("shop".equals(cookie.getName())) {
          logger.info(
              "Found shop cookie: {} with domain: {}, path: {}",
              cookie.getValue(),
              cookie.getDomain(),
              cookie.getPath());
          return cookie.getValue();
        }
      }
    }
    logger.debug("Shop cookie not found in request");
    return null;
  }

  private void unauthorized(HttpServletResponse response) throws IOException {
    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    response.setContentType("application/json");
    response.getWriter().write("{\"error\":\"Authentication required\"}");
  }
}
