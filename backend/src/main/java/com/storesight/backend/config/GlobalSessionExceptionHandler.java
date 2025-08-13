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
 */
@ControllerAdvice
@Order(-1000)
public class GlobalSessionExceptionHandler {

  private static final Logger logger = LoggerFactory.getLogger(GlobalSessionExceptionHandler.class);

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

      if (isRedisKeyError) {
        logger.debug(
            "Session expired (Redis key missing) for {} {} - tagging and delegating", method, path);
      } else {
        logger.debug("Session invalidation handled for {} {} - tagging", method, path);
      }

      AtomicBoolean responseWritten =
          responseStates.computeIfAbsent(requestId, k -> new AtomicBoolean(false));
      if (responseWritten.get()) {
        return null;
      }

      if (httpResponse.isCommitted()) {
        return null;
      }

      try {
        httpResponse.getWriter();
      } catch (IllegalStateException | IOException ignore) {
        return null;
      }

      if (!responseWritten.compareAndSet(false, true)) {
        return null;
      }

      try {
        httpResponse.setHeader("Access-Control-Allow-Credentials", "true");
        if (path.startsWith("/api/")) {
          if (isRedisKeyError) {
            httpResponse.setHeader("X-Session-Expired", "true");
          } else {
            httpResponse.setHeader("X-Session-Warning", "true");
          }
          // Let GlobalExceptionHandler build envelope; return 401 to signal auth issue
          return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        // Non-API: no redirect here; let frontend handle via headers
        if (isRedisKeyError) {
          httpResponse.setHeader("X-Session-Expired", "true");
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
      } finally {
        responseStates.remove(requestId);
      }
    }

    throw e;
  }

  @ExceptionHandler(RuntimeException.class)
  public ResponseEntity<Object> handleRuntimeException(
      RuntimeException e,
      WebRequest request,
      HttpServletRequest httpRequest,
      HttpServletResponse httpResponse) {

    if (e.getMessage() != null && e.getMessage().contains("Error during asynchronous dispatch")) {
      if (httpResponse.isCommitted()) {
        return null;
      }
      httpResponse.setHeader("X-Async-Error-Handled", "true");
      return ResponseEntity.ok().build();
    }

    String path = httpRequest.getRequestURI();
    String method = httpRequest.getMethod();
    logger.debug("Runtime exception observed for {} {} - delegating", method, path);

    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
  }

  private String generateRequestId(HttpServletRequest request) {
    return request.getSession(false) != null
        ? request.getSession().getId() + "-" + System.currentTimeMillis()
        : "anonymous-" + System.currentTimeMillis();
  }

  private boolean isRedisKeyError(Exception e) {
    if (e.getMessage() != null && e.getMessage().contains("ERR no such key")) {
      return true;
    }
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
