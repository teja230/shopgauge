package com.storesight.backend.config;

import com.storesight.backend.service.RedisSessionService;
import com.storesight.backend.service.SessionRecoveryService;
import com.storesight.backend.service.SessionSecurityService;
import com.storesight.backend.service.SessionSynchronizationService;
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
  private final SessionSynchronizationService sessionSynchronizationService;
  private final SessionSecurityService sessionSecurityService;
  private final RedisSessionService redisSessionService;
  private final SessionRecoveryService sessionRecoveryService;

  public ShopifyAuthenticationFilter(
      ShopService shopService,
      SessionSynchronizationService sessionSynchronizationService,
      SessionSecurityService sessionSecurityService,
      RedisSessionService redisSessionService,
      SessionRecoveryService sessionRecoveryService) {
    this.shopService = shopService;
    this.sessionSynchronizationService = sessionSynchronizationService;
    this.sessionSecurityService = sessionSecurityService;
    this.redisSessionService = redisSessionService;
    this.sessionRecoveryService = sessionRecoveryService;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {

    String path = request.getRequestURI();

    // Skip auth for public endpoints - comprehensive list
    if (path.startsWith("/api/auth/shopify/")
        || path.startsWith("/actuator/")
        || path.startsWith("/health/")
        || path.startsWith("/api/health/")
        || path.startsWith("/api/admin/")
        || path.startsWith("/api/sessions/admin/")
        || path.equals("/")
        || path.equals("/health")
        || path.equals("/api/health")
        || path.startsWith("/error")
        || path.contains("/auth/shopify/me")
        || path.contains("/auth/shopify/login")
        || path.contains("/auth/shopify/install")
        || path.contains("/auth/shopify/callback")
        || path.contains("/auth/shopify/refresh")) {
      logger.debug("Skipping authentication for public endpoint: {}", path);
      filterChain.doFilter(request, response);
      return;
    }

    try {
      if (logger.isDebugEnabled()) {
        logRequestDetails(request);
      }

      String shopDomain = getShopFromCookie(request);
      if (shopDomain == null) {
        shopDomain = request.getParameter("shop");
        if (shopDomain != null) {
          logger.info("Found shop in query parameter: {}", shopDomain);
          setShopCookie(response, shopDomain);
        }
      }
      if (shopDomain == null) {
        shopDomain = getShopFromSession(request);
        if (shopDomain != null) {
          logger.info("Found shop in session: {}", shopDomain);
        }
      }

      if (shopDomain != null && !shopDomain.trim().isEmpty() && isValidShopDomain(shopDomain)) {
        String sessionId = null;
        try {
          if (request.getSession(false) != null) {
            sessionId = request.getSession(false).getId();
          }
        } catch (Exception sessionEx) {
          logger.warn("Error accessing Spring Session: {}", sessionEx.getMessage());
        }

        String token = shopService.getTokenForShop(shopDomain, sessionId);
        if (token != null) {
          boolean isOAuthValidation = path.contains("/me") || path.contains("/auth/shopify/me");
          boolean sessionValid =
              shopService.isSessionValid(shopDomain, sessionId, isOAuthValidation);
          if (sessionValid || isOAuthValidation) {
            UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                    shopDomain, null, AuthorityUtils.createAuthorityList("ROLE_SHOP"));
            SecurityContextHolder.getContext().setAuthentication(authentication);
          } else {
            boolean recoverySuccessful =
                sessionRecoveryService.attemptSessionRecovery(shopDomain, sessionId);
            if (!recoverySuccessful) {
              SecurityContextHolder.clearContext();
              request.setAttribute("auth.error", "SESSION_EXPIRED");
              throw new ServletException("Session expired. Please re-authenticate.");
            }
            UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                    shopDomain, null, AuthorityUtils.createAuthorityList("ROLE_SHOP"));
            SecurityContextHolder.getContext().setAuthentication(authentication);
          }
        } else {
          if (sessionId != null) {
            shopService.safeSessionCleanup(shopDomain, sessionId);
          }
          SecurityContextHolder.clearContext();
          request.setAttribute("auth.error", "AUTH_REQUIRED");
          throw new ServletException("Authentication required. Please connect your Shopify store.");
        }
      } else {
        SecurityContextHolder.clearContext();
        request.setAttribute("auth.error", "INVALID_SHOP_DOMAIN");
        throw new ServletException("Invalid shop domain format.");
      }

      filterChain.doFilter(request, response);

    } catch (Exception e) {
      // Let the global exception handlers render the response consistently
      throw e instanceof ServletException ? (ServletException) e : new ServletException(e);
    }
  }

  private void logRequestDetails(HttpServletRequest request) {
    Enumeration<String> headerNames = request.getHeaderNames();
    if (headerNames != null) {
      logger.debug(
          "Request headers: {}",
          Collections.list(headerNames).stream()
              .map(name -> name + "=" + request.getHeader(name))
              .collect(Collectors.joining(", ")));
    }

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
    String domain = shopDomain.toLowerCase().trim();
    return domain.matches(
            "^[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9]*(\\.[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9]*)*$")
        && domain.length() > 3
        && domain.length() < 100;
  }

  private void setShopCookie(HttpServletResponse response, String shopDomain) {
    try {
      Cookie shopCookie = new Cookie("shop", shopDomain);
      shopCookie.setPath("/");
      shopCookie.setHttpOnly(false);
      shopCookie.setMaxAge(60 * 60 * 24 * 7); // 7 days
      shopCookie.setSecure(true);
      response.addCookie(shopCookie);
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
}
