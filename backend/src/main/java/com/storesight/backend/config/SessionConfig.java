package com.storesight.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.session.data.redis.config.annotation.web.http.EnableRedisHttpSession;
import org.springframework.session.events.SessionCreatedEvent;
import org.springframework.session.events.SessionDeletedEvent;
import org.springframework.session.events.SessionExpiredEvent;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
@Profile("!test")
@EnableRedisHttpSession(
    maxInactiveIntervalInSeconds = 14400, // 4 hours (aligned with business app standards)
    redisNamespace = "storesight:sessions")
public class SessionConfig {

  private static final Logger logger = LoggerFactory.getLogger(SessionConfig.class);

  @Value("${spring.profiles.active:dev}")
  private String activeProfile;

  @Bean
  public CookieSerializer cookieSerializer() {
    DefaultCookieSerializer serializer = new DefaultCookieSerializer();
    serializer.setCookieName("SESSION");
    serializer.setUseHttpOnlyCookie(true);
    serializer.setSameSite("Lax");
    serializer.setUseSecureCookie(isProduction());
    serializer.setCookiePath("/");

    // Set domain for production to work across subdomains
    if (isProduction()) {
      serializer.setDomainName("shopgaugeai.com");
      logger.info("Session cookie configured for production domain: shopgaugeai.com");
    } else {
      logger.info("Session cookie configured for development");
    }

    return serializer;
  }

  /**
   * Custom session event listener to handle session lifecycle events This helps prevent race
   * conditions during session cleanup
   */
  @Bean
  public ApplicationListener<SessionDeletedEvent> sessionDeletedEventListener() {
    return event -> {
      String sessionId = event.getSessionId();
      logger.debug("Session deleted event received for sessionId: {}", sessionId);

      // Note: Additional cleanup can be added here if needed
      // but we should avoid heavy operations in this listener
    };
  }

  /** Session created event listener to track session creation */
  @Bean
  public ApplicationListener<SessionCreatedEvent> sessionCreatedEventListener() {
    return event -> {
      String sessionId = event.getSessionId();
      logger.debug("Session created event received for sessionId: {}", sessionId);
    };
  }

  /** Session expired event listener to handle expired sessions gracefully */
  @Bean
  public ApplicationListener<SessionExpiredEvent> sessionExpiredEventListener() {
    return event -> {
      String sessionId = event.getSessionId();
      logger.debug("Session expired event received for sessionId: {}", sessionId);
    };
  }

  /**
   * Custom session filter to handle session invalidation errors gracefully This prevents the
   * IllegalStateException from bubbling up to the client
   */
  @Bean
  public SessionErrorHandlingFilter sessionErrorHandlingFilter() {
    return new SessionErrorHandlingFilter();
  }

  private boolean isProduction() {
    return "prod".equals(activeProfile) || "production".equals(activeProfile);
  }

  /**
   * Custom filter to handle session invalidation errors gracefully This prevents the
   * IllegalStateException from causing HTTP 500 errors
   */
  public static class SessionErrorHandlingFilter extends OncePerRequestFilter {

    private static final Logger filterLogger =
        LoggerFactory.getLogger(SessionErrorHandlingFilter.class);

    @Override
    protected void doFilterInternal(
        HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {

      try {
        filterChain.doFilter(request, response);
      } catch (IllegalStateException e) {
        // Handle session invalidation errors gracefully
        if (e.getMessage() != null && e.getMessage().contains("Session was invalidated")) {
          filterLogger.warn("Session invalidation error handled gracefully: {}", e.getMessage());

          // Return a proper error response instead of letting the exception bubble up
          response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
          response.setContentType("application/json");
          response.setCharacterEncoding("UTF-8");

          String errorResponse =
              String.format(
                  "{\"error\":\"session_invalidated\",\"message\":\"Session has been invalidated. Please re-authenticate.\",\"timestamp\":%d}",
                  System.currentTimeMillis());

          response.getWriter().write(errorResponse);
          response.getWriter().flush();
        } else {
          // Re-throw other IllegalStateExceptions
          throw e;
        }
      }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
      String path = request.getRequestURI();
      // Skip filtering for public endpoints
      return path.startsWith("/api/auth/shopify/")
          || path.startsWith("/actuator/")
          || path.startsWith("/health/")
          || path.startsWith("/api/health/")
          || path.startsWith("/api/admin/")
          || path.equals("/")
          || path.equals("/health")
          || path.equals("/api/health")
          || path.startsWith("/error");
    }
  }
}
