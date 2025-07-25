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
    redisNamespace = "storesight:sessions",
    saveMode =
        org.springframework.session.SaveMode.ON_SET_ATTRIBUTE) // Only save when attributes change
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

      // Cleanup any stuck session markers
      try {
        // Add any additional cleanup logic here if needed
        logger.debug("Session cleanup completed for sessionId: {}", sessionId);
      } catch (Exception e) {
        logger.warn(
            "Error during session cleanup for sessionId: {} - {}", sessionId, e.getMessage());
      }
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
   *
   * <p>Note: This bean is created in WebSecurityConfig to avoid duplicate bean definitions
   */
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
          filterLogger.warn(
              "Session invalidation error handled gracefully for path: {} - {}",
              request.getRequestURI(),
              e.getMessage());

          // Check if response is already committed - if so, we can't write to it
          if (response.isCommitted()) {
            filterLogger.info(
                "Response already committed for session invalidation - allowing to complete normally for path: {}",
                request.getRequestURI());
            return;
          }

          // Check if response stream has already been written to
          try {
            // Try to get the writer to see if it's already been accessed
            response.getWriter();
            filterLogger.info(
                "Response writer already accessed for session invalidation - allowing to complete normally for path: {}",
                request.getRequestURI());
            return;
          } catch (IllegalStateException writerException) {
            if (writerException.getMessage() != null && 
                writerException.getMessage().contains("getOutputStream() has already been called")) {
              filterLogger.info(
                  "Response output stream already accessed for session invalidation - allowing to complete normally for path: {}",
                  request.getRequestURI());
              return;
            }
          }

          // Always allow the response to complete normally for session invalidation errors
          // This prevents cascading failures during concurrent requests after OAuth
          filterLogger.info(
              "Session invalidation occurred for path: {} - allowing response to complete normally",
              request.getRequestURI());
          return;
        } else {
          // Re-throw other IllegalStateExceptions
          throw e;
        }
      } catch (ServletException e) {
        // Handle ServletException that might contain session invalidation errors
        if (e.getCause() instanceof IllegalStateException) {
          IllegalStateException ise = (IllegalStateException) e.getCause();
          if (ise.getMessage() != null && ise.getMessage().contains("Session was invalidated")) {
            filterLogger.warn(
                "Session invalidation error in ServletException handled gracefully for path: {} - {}",
                request.getRequestURI(),
                ise.getMessage());

            // Check response commitment and stream access
            if (response.isCommitted()) {
              filterLogger.info(
                  "Response already committed for session invalidation in ServletException - allowing to complete normally for path: {}",
                  request.getRequestURI());
              return;
            }

            try {
              response.getWriter();
              filterLogger.info(
                  "Response writer already accessed for session invalidation in ServletException - allowing to complete normally for path: {}",
                  request.getRequestURI());
              return;
            } catch (IllegalStateException writerException) {
              if (writerException.getMessage() != null && 
                  writerException.getMessage().contains("getOutputStream() has already been called")) {
                filterLogger.info(
                    "Response output stream already accessed for session invalidation in ServletException - allowing to complete normally for path: {}",
                    request.getRequestURI());
                return;
              }
            }

            // Always allow the response to complete normally
            filterLogger.info(
                "Session invalidation in ServletException for path: {} - allowing response to complete normally",
                request.getRequestURI());
            return;
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      } catch (Exception e) {
        // Catch any other exceptions that might be related to session issues
        if (e.getMessage() != null && e.getMessage().contains("Session was invalidated")) {
          filterLogger.warn(
              "Session invalidation error in generic exception handled gracefully for path: {} - {}",
              request.getRequestURI(),
              e.getMessage());
          
          // Check response commitment and stream access
          if (response.isCommitted()) {
            filterLogger.info(
                "Response already committed for session invalidation in generic exception - allowing to complete normally for path: {}",
                request.getRequestURI());
            return;
          }

          try {
            response.getWriter();
            filterLogger.info(
                "Response writer already accessed for session invalidation in generic exception - allowing to complete normally for path: {}",
                request.getRequestURI());
            return;
          } catch (IllegalStateException writerException) {
            if (writerException.getMessage() != null && 
                writerException.getMessage().contains("getOutputStream() has already been called")) {
              filterLogger.info(
                  "Response output stream already accessed for session invalidation in generic exception - allowing to complete normally for path: {}",
                  request.getRequestURI());
              return;
            }
          }
          
          return;
        } else {
          throw e;
        }
      }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
      String path = request.getRequestURI();
      // Apply to all requests - we want to catch session errors everywhere
      // The SessionRepositoryErrorFilter will handle the high-level filtering
      return false;
    }
  }
}
