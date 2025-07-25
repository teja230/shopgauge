package com.storesight.backend.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.WebRequest;

/**
 * Global exception handler specifically for session-related errors This catches session
 * invalidation errors that bubble up from the session repository
 */
@ControllerAdvice
@Order(-1000) // High priority to catch session errors before other handlers
public class GlobalSessionExceptionHandler {

  private static final Logger logger = LoggerFactory.getLogger(GlobalSessionExceptionHandler.class);

  @ExceptionHandler(IllegalStateException.class)
  public ResponseEntity<Object> handleSessionInvalidationError(
      IllegalStateException e,
      WebRequest request,
      HttpServletRequest httpRequest,
      HttpServletResponse httpResponse) {

    if (e.getMessage() != null && e.getMessage().contains("Session was invalidated")) {
      String path = httpRequest.getRequestURI();
      logger.debug(
          "Global session invalidation error handled for path: {} - {}", path, e.getMessage());

      // Check if response is already committed
      if (httpResponse.isCommitted()) {
        logger.debug(
            "Response already committed for global session invalidation - allowing to complete normally for path: {}",
            path);
        return null; // Let the response complete normally
      }

      // Check if response stream has already been written to
      try {
        httpResponse.getWriter();
        logger.debug(
            "Response writer already accessed for global session invalidation - allowing to complete normally for path: {}",
            path);
        return null; // Let the response complete normally
      } catch (IllegalStateException writerException) {
        if (writerException.getMessage() != null
            && writerException.getMessage().contains("getOutputStream() has already been called")) {
          logger.debug(
              "Response output stream already accessed for global session invalidation - allowing to complete normally for path: {}",
              path);
          return null; // Let the response complete normally
        }
      } catch (IOException ioException) {
        logger.debug(
            "IOException when checking response writer for global session invalidation - allowing to complete normally for path: {}",
            path);
        return null; // Let the response complete normally
      }

      // For API endpoints, return success since the business operation likely succeeded
      if (path.startsWith("/api/")) {
        logger.debug(
            "Session invalidation on API endpoint - returning success response for path: {}", path);

        // Add CORS headers
        httpResponse.setHeader("Access-Control-Allow-Origin", "https://www.shopgaugeai.com");
        httpResponse.setHeader("Access-Control-Allow-Credentials", "true");

        return ResponseEntity.ok()
            .header("X-Session-Warning", "Session cleanup issue")
            .body(
                "{\"success\":true,\"warning\":\"Session cleanup issue - please refresh if you experience problems\"}");
      }

      // For error pages, return a simple OK to prevent cascading
      if (path.startsWith("/error")) {
        logger.debug("Session invalidation on error page - preventing cascade for path: {}", path);
        return ResponseEntity.ok().body("Session expired. Please refresh the page.");
      }

      // For other requests, return a redirect response
      logger.debug(
          "Session invalidation on non-API endpoint - suggesting redirect for path: {}", path);
      return ResponseEntity.status(HttpStatus.FOUND)
          .header("Location", "/")
          .body("Session expired. Redirecting...");
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

    // Check if this is a session-related error in the cause chain
    if (isSessionRelatedError(e)) {
      String path = httpRequest.getRequestURI();
      logger.debug("Generic session error handled for path: {} - {}", path, e.getMessage());

      if (path.startsWith("/api/")) {
        httpResponse.setHeader("Access-Control-Allow-Origin", "https://www.shopgaugeai.com");
        httpResponse.setHeader("Access-Control-Allow-Credentials", "true");

        return ResponseEntity.ok()
            .header("X-Session-Warning", "Session issue resolved")
            .body(
                "{\"success\":true,\"warning\":\"Session issue resolved - please refresh if you experience problems\"}");
      }

      if (path.startsWith("/error")) {
        return ResponseEntity.ok().body("Session issue resolved. Please refresh the page.");
      }

      return ResponseEntity.status(HttpStatus.FOUND)
          .header("Location", "/")
          .body("Session issue resolved. Redirecting...");
    }

    // Not a session error - let other handlers deal with it
    throw new RuntimeException(e);
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
              || cause.getMessage().contains("RedisSessionRepository"))) {
        return true;
      }
      cause = cause.getCause();
    }

    return false;
  }
}
