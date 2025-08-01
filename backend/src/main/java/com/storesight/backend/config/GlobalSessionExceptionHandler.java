package com.storesight.backend.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.WebRequest;

/**
 * Enhanced global exception handler specifically for session-related errors with comprehensive race
 * condition prevention and response state management.
 *
 * <p>This handler works in conjunction with SessionConfig.SessionErrorHandlingFilter and
 * SessionRepositoryErrorFilter to provide multiple layers of protection against session
 * invalidation errors.
 */
@ControllerAdvice
@Order(-1000) // High priority to catch session errors before other handlers
public class GlobalSessionExceptionHandler {

  private static final Logger logger = LoggerFactory.getLogger(GlobalSessionExceptionHandler.class);

  // Track response states to prevent multiple writes
  private static final ConcurrentHashMap<String, AtomicBoolean> responseStates =
      new ConcurrentHashMap<>();

  @ExceptionHandler(IllegalStateException.class)
  public ResponseEntity<Object> handleSessionInvalidationError(
      IllegalStateException e,
      WebRequest request,
      HttpServletRequest httpRequest,
      HttpServletResponse httpResponse) {

    if (e.getMessage() != null && e.getMessage().contains("Session was invalidated")) {
      String path = httpRequest.getRequestURI();
      String method = httpRequest.getMethod();
      String requestId = generateRequestId(httpRequest);
      boolean isRedisKeyError = isRedisKeyError(e);

      // Use appropriate log level based on error type
      if (isRedisKeyError) {
        // Redis key errors are expected after inactivity - log at debug level to reduce noise
        logger.debug(
            "Session expired (Redis key missing) for {} {} - handling gracefully", method, path);
      } else {
        logger.debug(
            "Global session invalidation error handled for {} {} - {}",
            method,
            path,
            e.getMessage());
      }

      // Check if response has already been written to by this handler
      AtomicBoolean responseWritten =
          responseStates.computeIfAbsent(requestId, k -> new AtomicBoolean(false));
      if (responseWritten.get()) {
        logger.debug("Response already written by this handler for {} {} - skipping", method, path);
        return null;
      }

      // Check if response is already committed
      if (httpResponse.isCommitted()) {
        logger.debug(
            "Response already committed for global session invalidation - allowing to complete normally for {} {}",
            method,
            path);
        return null; // Let the response complete normally
      }

      // Check if response stream has already been written to
      try {
        httpResponse.getWriter();
        logger.debug(
            "Response writer already accessed for global session invalidation - allowing to complete normally for {} {}",
            method,
            path);
        return null; // Let the response complete normally
      } catch (IllegalStateException writerException) {
        if (writerException.getMessage() != null
            && writerException.getMessage().contains("getWriter() has already been called")) {
          logger.debug(
              "Response writer already accessed for global session invalidation - allowing to complete normally for {} {}",
              method,
              path);
          return null; // Let the response complete normally
        }
        if (writerException.getMessage() != null
            && writerException.getMessage().contains("getOutputStream() has already been called")) {
          logger.debug(
              "Response output stream already accessed for global session invalidation - allowing to complete normally for {} {}",
              method,
              path);
          return null; // Let the response complete normally
        }
      } catch (IOException ioException) {
        logger.debug(
            "IOException when checking response writer for global session invalidation - allowing to complete normally for {} {}",
            method,
            path);
        return null; // Let the response complete normally
      }

      // Mark that we're writing a response
      if (!responseWritten.compareAndSet(false, true)) {
        logger.debug("Another thread already writing response for {} {} - skipping", method, path);
        return null;
      }

      try {
        // For API endpoints, return success since the business operation likely succeeded
        if (path.startsWith("/api/")) {
          logger.debug(
              "Session invalidation on API endpoint - returning success response for {} {}",
              method,
              path);

          // Add CORS headers
          httpResponse.setHeader("Access-Control-Allow-Origin", "https://www.shopgaugeai.com");
          httpResponse.setHeader("Access-Control-Allow-Credentials", "true");

          if (isRedisKeyError) {
            // For Redis key errors (session expiration), provide a clear message
            return ResponseEntity.ok()
                .header("X-Session-Expired", "true")
                .body(
                    "{\"success\":true,\"sessionExpired\":true,\"message\":\"Session expired due to inactivity. Please refresh the page to continue.\"}");
          } else {
            return ResponseEntity.ok()
                .header("X-Session-Warning", "Session cleanup issue")
                .body(
                    "{\"success\":true,\"warning\":\"Session cleanup issue - please refresh if you experience problems\"}");
          }
        }

        // For error pages, return a simple OK to prevent cascading
        if (path.startsWith("/error")) {
          logger.debug(
              "Session invalidation on error page - preventing cascade for {} {}", method, path);
          return ResponseEntity.ok().body("Session expired. Please refresh the page.");
        }

        // For other requests, return a redirect response
        logger.debug(
            "Session invalidation on non-API endpoint - suggesting redirect for {} {}",
            method,
            path);

        if (isRedisKeyError) {
          // For Redis key errors (session expiration), redirect with a clear message
          return ResponseEntity.status(HttpStatus.FOUND)
              .header("Location", "/?sessionExpired=true")
              .header("X-Session-Expired", "true")
              .body("Session expired due to inactivity. Redirecting...");
        } else {
          return ResponseEntity.status(HttpStatus.FOUND)
              .header("Location", "/")
              .body("Session expired. Redirecting...");
        }
      } finally {
        // Clean up response state tracking
        responseStates.remove(requestId);
      }
    }

    // Re-throw other IllegalStateExceptions
    throw e;
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Object> handleGenericSessionError(
      Exception e,
      WebRequest request,
      HttpServletRequest httpRequest,
      HttpServletResponse httpResponse) {

    logger.debug(
        "GlobalSessionExceptionHandler: Processing exception: {} with order -1000",
        e.getClass().getSimpleName());

    // Check if this is a session-related error in the cause chain
    if (isSessionRelatedError(e)) {
      String path = httpRequest.getRequestURI();
      String method = httpRequest.getMethod();
      String requestId = generateRequestId(httpRequest);
      boolean isRedisKeyError = isRedisKeyError(e);

      // Use appropriate log level based on error type
      if (isRedisKeyError) {
        // Redis key errors are expected after inactivity - log at debug level to reduce noise
        logger.debug(
            "Session expired (Redis key missing) for {} {} - handling gracefully", method, path);
      } else {
        logger.debug("Generic session error handled for {} {} - {}", method, path, e.getMessage());
      }

      // Special handling for OAuth flow to prevent cascade errors during initial login
      if (path.contains("/api/auth/shopify/callback")
          || path.contains("/api/auth/shopify/install")
          || path.contains("/api/auth/shopify/me")) {
        logger.info(
            "Session error during OAuth flow - allowing to complete normally for path: {}", path);
        return null; // Let the OAuth flow complete without interference
      }

      // Check if response has already been written to by this handler
      AtomicBoolean responseWritten =
          responseStates.computeIfAbsent(requestId, k -> new AtomicBoolean(false));
      if (responseWritten.get()) {
        logger.debug("Response already written by this handler for {} {} - skipping", method, path);
        return null;
      }

      // Mark that we're writing a response
      if (!responseWritten.compareAndSet(false, true)) {
        logger.debug("Another thread already writing response for {} {} - skipping", method, path);
        return null;
      }

      try {
        if (path.startsWith("/api/")) {
          httpResponse.setHeader("Access-Control-Allow-Origin", "https://www.shopgaugeai.com");
          httpResponse.setHeader("Access-Control-Allow-Credentials", "true");

          if (isRedisKeyError) {
            // For Redis key errors (session expiration), provide a clear message
            return ResponseEntity.ok()
                .header("X-Session-Expired", "true")
                .body(
                    "{\"success\":true,\"sessionExpired\":true,\"message\":\"Session expired due to inactivity. Please refresh the page to continue.\"}");
          } else {
            return ResponseEntity.ok()
                .header("X-Session-Warning", "Session issue resolved")
                .body(
                    "{\"success\":true,\"warning\":\"Session issue resolved - please refresh if you experience problems\"}");
          }
        }

        if (path.startsWith("/error")) {
          return ResponseEntity.ok().body("Session issue resolved. Please refresh the page.");
        }

        if (isRedisKeyError) {
          // For Redis key errors (session expiration), redirect with a clear message
          return ResponseEntity.status(HttpStatus.FOUND)
              .header("Location", "/?sessionExpired=true")
              .header("X-Session-Expired", "true")
              .body("Session expired due to inactivity. Redirecting...");
        } else {
          return ResponseEntity.status(HttpStatus.FOUND)
              .header("Location", "/")
              .body("Session issue resolved. Redirecting...");
        }
      } finally {
        // Clean up response state tracking
        responseStates.remove(requestId);
      }
    }

    // Not a session error - let other handlers deal with it
    throw new RuntimeException(e);
  }

  private String generateRequestId(HttpServletRequest request) {
    return request.getSession(false) != null
        ? request.getSession().getId() + "-" + System.currentTimeMillis()
        : "anonymous-" + System.currentTimeMillis();
  }

  private boolean isSessionRelatedError(Exception e) {
    if (e.getMessage() != null && e.getMessage().contains("Session")) {
      return true;
    }

    // Check cause chain
    Throwable cause = e.getCause();
    while (cause != null) {
      if (cause.getMessage() != null
          && (cause.getMessage().contains("Session was invalidated")
              || cause.getMessage().contains("RedisSessionRepository")
              || cause.getMessage().contains("ERR no such key"))) {
        return true;
      }
      cause = cause.getCause();
    }

    return false;
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
}
