package com.storesight.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.session.data.redis.RedisSessionRepository;
import org.springframework.session.web.http.SessionRepositoryFilter;

/**
 * Custom SessionRepositoryFilter configuration to handle session invalidation errors at the source.
 *
 * <p>This configuration provides a wrapper around the default SessionRepositoryFilter that catches
 * session invalidation errors and handles them gracefully without throwing exceptions.
 */
@Configuration
public class SessionRepositoryConfig {

  private static final Logger logger = LoggerFactory.getLogger(SessionRepositoryConfig.class);

  /**
   * Custom SessionRepositoryFilter that handles session invalidation errors gracefully.
   *
   * <p>This filter wraps the default SessionRepositoryFilter and catches session-related errors
   * before they can cause response stream conflicts or cascade into other errors.
   */
  @Bean
  @Primary
  public SessionRepositoryFilter sessionRepositoryFilter(RedisSessionRepository sessionRepository) {
    return new SessionRepositoryFilter(sessionRepository) {

      @Override
      protected void doFilterInternal(
          HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
          throws ServletException, IOException {

        try {
          // Call the parent implementation
          super.doFilterInternal(request, response, filterChain);
        } catch (IllegalStateException e) {
          // Handle session invalidation errors
          if (e.getMessage() != null && e.getMessage().contains("Session was invalidated")) {
            String path = request.getRequestURI();
            String method = request.getMethod();

            logger.debug(
                "Session invalidation caught in SessionRepositoryFilter for {} {} - handling gracefully",
                method,
                path);

            // Don't re-throw the exception, let the request continue
            // The response will be handled by other filters/exception handlers
            return;
          }

          // Re-throw other IllegalStateExceptions
          throw e;
        } catch (Exception e) {
          // Check if this is a session-related error
          if (e.getMessage() != null && e.getMessage().contains("Session was invalidated")) {
            String path = request.getRequestURI();
            String method = request.getMethod();

            logger.debug(
                "Session invalidation caught in SessionRepositoryFilter for {} {} - handling gracefully",
                method,
                path);

            // Don't re-throw the exception, let the request continue
            return;
          }

          // Re-throw other exceptions
          throw e;
        }
      }
    };
  }
}
