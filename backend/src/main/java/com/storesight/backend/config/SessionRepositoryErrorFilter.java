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
@Order(Ordered.HIGHEST_PRECEDENCE + 1) // Run after SessionErrorHandlingFilter
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
    } catch (IllegalStateException e) {
      // Only handle session invalidation errors, delegate others to GlobalSessionExceptionHandler
      if (isSessionError(e)) {
        handleSessionError(request, response, e, responseWritten, requestId);
      } else {
        // For non-session IllegalStateExceptions, let GlobalSessionExceptionHandler handle them
        throw e;
      }
    } catch (ServletException e) {
      if (isSessionError(e)) {
        handleSessionError(request, response, e, responseWritten, requestId);
      } else {
        throw e;
      }
    } catch (Exception e) {
      if (isSessionError(e)) {
        handleSessionError(request, response, e, responseWritten, requestId);
      } else {
        throw e;
      }
    } finally {
      // Clean up response state tracking
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

    // Check for Redis "ERR no such key" errors which indicate session expiration
    if (e.getMessage() != null && e.getMessage().contains("ERR no such key")) {
      return true;
    }

    // Check cause chain for session errors
    Throwable cause = e.getCause();
    while (cause != null) {
      if (cause instanceof IllegalStateException
          && cause.getMessage() != null
          && cause.getMessage().contains("Session was invalidated")) {
        return true;
      }
      // Check for Redis command execution exceptions
      if (cause.getClass().getName().contains("RedisCommandExecutionException")
          && cause.getMessage() != null
          && cause.getMessage().contains("ERR no such key")) {
        return true;
      }
      cause = cause.getCause();
    }

    return false;
  }

  private void handleSessionError(
      HttpServletRequest request,
      HttpServletResponse response,
      Exception e,
      AtomicBoolean responseWritten,
      String requestId) {

    String path = request.getRequestURI();
    String method = request.getMethod();
    boolean isRedisKeyError = isRedisKeyError(e);
    boolean isExpectedSessionExpiration = isExpectedSessionExpiration(request, e);

    // Use appropriate log level based on error type and context
    if (isRedisKeyError) {
      if (isExpectedSessionExpiration) {
        // Expected session expiration after inactivity - log at debug level
        logger.debug(
            "Session expired (Redis key missing) for {} {} - handling gracefully", method, path);
      } else {
        // Unexpected Redis key error - log at warn level as it might indicate a problem
        logger.warn(
            "Unexpected Redis key error for {} {} - {} - investigating",
            method,
            path,
            e.getMessage());
      }
    } else {
      // Other session errors are less expected - log at info level
      logger.info("Session repository error handled for {} {} - {}", method, path, e.getMessage());
    }

    // Check if response has already been written to by this filter
    if (responseWritten.get()) {
      logger.debug("Response already written by this filter for {} {} - skipping", method, path);
      return;
    }

    // Check if response is already committed
    if (response.isCommitted()) {
      logger.debug(
          "Response already committed for {} {} - allowing to complete normally", method, path);
      return;
    }

    // Check if response stream has already been written to
    try {
      response.getWriter();
      logger.debug(
          "Response writer already accessed for {} {} - allowing to complete normally",
          method,
          path);
      return;
    } catch (IllegalStateException writerException) {
      if (writerException.getMessage() != null
          && writerException.getMessage().contains("getOutputStream() has already been called")) {
        logger.debug(
            "Response output stream already accessed for {} {} - allowing to complete normally",
            method,
            path);
        return;
      }
    } catch (IOException ioException) {
      logger.debug(
          "IOException when checking response writer for {} {} - allowing to complete normally",
          method,
          path);
      return;
    }

    // Mark that we're writing a response
    if (!responseWritten.compareAndSet(false, true)) {
      logger.debug("Another thread already writing response for {} {} - skipping", method, path);
      return;
    }

    try {
      // For API endpoints, let GlobalSessionExceptionHandler handle them to ensure consistency
      if (path.startsWith("/api/")) {
        logger.debug(
            "API session error - delegating to GlobalSessionExceptionHandler for {} {}",
            method,
            path);
        // Don't write response here, let GlobalSessionExceptionHandler handle it
        return;
      }

      // Handle different request types appropriately
      if (path.startsWith("/error")) {
        handleErrorPageSessionError(response, path);
      } else {
        handleBrowserSessionError(response, path, isRedisKeyError);
      }
    } catch (IOException ioException) {
      logger.warn(
          "Failed to write session error response for {} {}: {}",
          method,
          path,
          ioException.getMessage());
    }
  }

  private boolean isRedisKeyError(Exception e) {
    if (e.getMessage() != null && e.getMessage().contains("ERR no such key")) {
      return true;
    }

    // Check cause chain for Redis key errors
    Throwable cause = e.getCause();
    while (cause != null) {
      if (cause.getClass().getName().contains("RedisCommandExecutionException")
          && cause.getMessage() != null
          && cause.getMessage().contains("ERR no such key")) {
        return true;
      }
      cause = cause.getCause();
    }

    return false;
  }

  private boolean isExpectedSessionExpiration(HttpServletRequest request, Exception e) {
    // Check if this is likely an expected session expiration scenario

    // 1. Check if user has been inactive (no recent activity headers)
    String lastActivity = request.getHeader("X-Last-Activity");
    if (lastActivity != null) {
      try {
        long lastActivityTime = Long.parseLong(lastActivity);
        long currentTime = System.currentTimeMillis();
        long inactiveDuration = currentTime - lastActivityTime;

        // If user has been inactive for more than 30 minutes, this is likely expected
        if (inactiveDuration > 30 * 60 * 1000) { // 30 minutes
          return true;
        }
      } catch (NumberFormatException ignored) {
        // Invalid timestamp, continue with other checks
      }
    }

    // 2. Check if this is a session-related endpoint that commonly has expiration
    String path = request.getRequestURI();
    if (path.contains("/api/auth/")
        || path.contains("/api/session/")
        || path.contains("/api/user/")) {
      return true;
    }

    // 3. Check if this is a GET request (read-only operations are less likely to cause unexpected
    // errors)
    if ("GET".equals(request.getMethod())) {
      return true;
    }

    // 4. Check if the error message indicates a specific Redis key pattern that suggests session
    // expiration
    String errorMessage = e.getMessage();
    if (errorMessage != null
        && (errorMessage.contains("spring:session:storesight")
            || errorMessage.contains("session:")
            || errorMessage.contains("storesight"))) {
      return true;
    }

    // If none of the above conditions are met, this might be an unexpected error
    return false;
  }

  private void handleErrorPageSessionError(HttpServletResponse response, String path)
      throws IOException {

    logger.debug("Session error on error page - preventing cascade for {}", path);

    response.setStatus(HttpServletResponse.SC_OK);
    response.setContentType("text/plain");
    response.setCharacterEncoding("UTF-8");
    response.getWriter().write("Session expired. Please refresh the page.");
  }

  private void handleBrowserSessionError(
      HttpServletResponse response, String path, boolean isRedisKeyError) throws IOException {

    logger.debug("Session error on browser request - redirecting for {}", path);

    response.setStatus(HttpServletResponse.SC_FOUND);
    if (isRedisKeyError) {
      response.setHeader("Location", "/?sessionExpired=true");
      response.setHeader("X-Session-Expired", "true");
    } else {
      response.setHeader("Location", "/");
    }
    response.setContentType("text/plain");
    response.setCharacterEncoding("UTF-8");
    response.getWriter().write("Session expired. Redirecting...");
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
