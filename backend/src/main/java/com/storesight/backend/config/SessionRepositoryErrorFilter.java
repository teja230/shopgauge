package com.storesight.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Enhanced filter that catches session repository errors at the lowest level with comprehensive
 * race condition prevention and response state management.
 *
 * <p>This filter works in conjunction with SessionConfig.SessionErrorHandlingFilter to provide
 * multiple layers of protection against session invalidation errors.
 */
@Order(Ordered.HIGHEST_PRECEDENCE + 10) // Run after SessionRepositoryFilter to catch its errors
public class SessionRepositoryErrorFilter extends OncePerRequestFilter {

  private static final Logger logger = LoggerFactory.getLogger(SessionRepositoryErrorFilter.class);

  // Track response states to prevent multiple writes
  private static final ConcurrentHashMap<String, AtomicBoolean> responseStates =
      new ConcurrentHashMap<>();

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {

    String requestId = generateRequestId(request);
    AtomicBoolean responseWritten =
        responseStates.computeIfAbsent(requestId, k -> new AtomicBoolean(false));

    try {
      filterChain.doFilter(request, response);
    } catch (Exception e) {
      if (isSessionError(e)) {
        request.setAttribute("session.error", true);
        logger.debug(
            "Tagged request with session.error for {} {}",
            request.getMethod(),
            request.getRequestURI());
      }
      throw e instanceof ServletException ? (ServletException) e : new ServletException(e);
    } finally {
      responseStates.remove(requestId);
    }
  }

  private String generateRequestId(HttpServletRequest request) {
    return request.getSession(false) != null
        ? request.getSession().getId() + "-" + System.currentTimeMillis()
        : "anonymous-" + System.currentTimeMillis();
  }

  private boolean isSessionError(Exception e) {
    if (e.getMessage() != null && e.getMessage().contains("Session was invalidated")) {
      return true;
    }

    if (e.getMessage() != null && e.getMessage().contains("ERR no such key")) {
      return true;
    }

    if (e instanceof org.springframework.data.redis.RedisSystemException) {
      return true;
    }

    Throwable cause = e.getCause();
    while (cause != null) {
      if (cause instanceof IllegalStateException
          && cause.getMessage() != null
          && cause.getMessage().contains("Session was invalidated")) {
        return true;
      }
      if (cause.getClass().getName().contains("RedisCommandExecutionException")
          && cause.getMessage() != null
          && cause.getMessage().contains("ERR no such key")) {
        return true;
      }
      if (cause instanceof org.springframework.data.redis.RedisSystemException) {
        return true;
      }
      cause = cause.getCause();
    }

    return false;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    String path = request.getRequestURI();

    // Skip filtering for health checks and actuator endpoints
    return path.startsWith("/actuator/")
        || path.startsWith("/health/")
        || path.startsWith("/api/health/")
        || path.equals("/")
        || path.equals("/health");
  }
}
