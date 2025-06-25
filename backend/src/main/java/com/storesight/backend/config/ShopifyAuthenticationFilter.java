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

    try {
      // Skip auth for public endpoints
      String path = request.getRequestURI();
      if (path.startsWith("/api/auth/") || path.startsWith("/actuator/") || path.startsWith("/error")) {
        filterChain.doFilter(request, response);
        return;
      }

      // Log request details for debugging (only in debug mode)
      if (logger.isDebugEnabled()) {
        logRequestDetails(request);
      }

      // Extract shop from cookie with fallback mechanisms
      String shopDomain = getShopFromCookie(request);

      // Fallback 1: Check query parameter
      if (shopDomain == null) {
        shopDomain = request.getParameter("shop");
        if (shopDomain != null) {
          logger.info("Found shop in query parameter: {}", shopDomain);
          setShopCookie(response, shopDomain);
        }
      }

      // Fallback 2: Check session
      if (shopDomain == null) {
        shopDomain = getShopFromSession(request);
        if (shopDomain != null) {
          logger.info("Found shop in session: {}", shopDomain);
        }
      }

      // Fallback 3: Check Authorization header (for API clients)
      if (shopDomain == null) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
          // Extract shop from JWT or custom token if needed
          logger.debug("Authorization header present, checking for shop context");
        }
      }

      if (shopDomain != null && !shopDomain.trim().isEmpty()) {
        // Validate shop domain format
        if (isValidShopDomain(shopDomain)) {
                     // Verify shop exists in database
           if (shopService.getTokenForShop(shopDomain, null) != null) {
            // Set authentication context
            UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                    shopDomain, null, AuthorityUtils.createAuthorityList("ROLE_SHOP"));
            SecurityContextHolder.getContext().setAuthentication(authentication);
            
            logger.debug("Authentication set for shop: {}", shopDomain);
          } else {
            logger.warn("Shop not found in database: {}", shopDomain);
            handleAuthenticationFailure(response, "Shop not found. Please re-authenticate.");
            return;
          }
        } else {
          logger.warn("Invalid shop domain format: {}", shopDomain);
          handleAuthenticationFailure(response, "Invalid shop domain format.");
          return;
        }
      } else {
        logger.debug("No shop domain found in request: {}", path);
        handleAuthenticationFailure(response, "Authentication required. Please connect your Shopify store.");
        return;
      }

      filterChain.doFilter(request, response);
      
    } catch (Exception e) {
      logger.error("Authentication filter error for path: {} - {}", request.getRequestURI(), e.getMessage(), e);
      handleAuthenticationFailure(response, "Authentication error occurred. Please try again.");
    }
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

  private String getShopFromSession(HttpServletRequest request) {
    try {
      if (request.getSession(false) != null) {
        return (String) request.getSession().getAttribute("shopDomain");
      }
    } catch (Exception e) {
      logger.warn("Error accessing session: {}", e.getMessage());
    }
    return null;
  }

  private boolean isValidShopDomain(String shopDomain) {
    if (shopDomain == null || shopDomain.trim().isEmpty()) {
      return false;
    }
    
    // Basic validation - should end with .myshopify.com or be a custom domain
    String domain = shopDomain.toLowerCase().trim();
    return domain.matches("^[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9]*(\\.[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9]*)*$") 
           && domain.length() > 3 && domain.length() < 100;
  }

  private void setShopCookie(HttpServletResponse response, String shopDomain) {
    try {
      Cookie shopCookie = new Cookie("shop", shopDomain);
      shopCookie.setPath("/");
      shopCookie.setHttpOnly(false);
      shopCookie.setMaxAge(60 * 60 * 24 * 7); // 7 days
      shopCookie.setSecure(true);
      response.addCookie(shopCookie);

      // Set SameSite attribute via header for better browser compatibility
      response.addHeader(
          "Set-Cookie",
          String.format(
              "shop=%s; Path=/; Max-Age=%d; Domain=shopgaugeai.com; SameSite=Lax; Secure",
              shopDomain, 60 * 60 * 24 * 7));

      logger.info("Set shop cookie for: {}", shopDomain);
    } catch (Exception e) {
      logger.warn("Failed to set shop cookie: {}", e.getMessage());
    }
  }

  private void handleAuthenticationFailure(HttpServletResponse response, String message) throws IOException {
    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");
    
    // Add CORS headers for error responses
    response.setHeader("Access-Control-Allow-Origin", "https://www.shopgaugeai.com");
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "*");
    
    String jsonResponse = String.format(
        "{\"error\":\"Authentication required\",\"message\":\"%s\",\"timestamp\":%d}", 
        message, System.currentTimeMillis());
    
    response.getWriter().write(jsonResponse);
    response.getWriter().flush();
  }
}
