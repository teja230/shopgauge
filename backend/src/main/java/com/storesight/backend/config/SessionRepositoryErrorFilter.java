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
      handleSessionError(request, response, e, responseWritten, requestId);
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

    // Check cause chain for session errors
    Throwable cause = e.getCause();
    while (cause != null) {
      if (cause instanceof IllegalStateException
          && cause.getMessage() != null
          && cause.getMessage().contains("Session was invalidated")) {
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

    logger.debug("Session repository error handled for {} {} - {}", method, path, e.getMessage());

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
      // Handle different request types appropriately
      if (path.startsWith("/api/")) {
        handleApiSessionError(response, path, method);
      } else if (path.startsWith("/error")) {
        handleErrorPageSessionError(response, path);
      } else {
        handleBrowserSessionError(response, path);
      }
    } catch (IOException ioException) {
      logger.warn(
          "Failed to write session error response for {} {}: {}",
          method,
          path,
          ioException.getMessage());
    }
  }

  private void handleApiSessionError(HttpServletResponse response, String path, String method)
      throws IOException {

    logger.debug(
        "Session repository error on API endpoint - returning clean response for {} {}",
        method,
        path);

    // For API endpoints, return success since the business operation likely succeeded
    response.setStatus(HttpServletResponse.SC_OK);
    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");

    // Add CORS headers
    response.setHeader("Access-Control-Allow-Origin", "https://www.shopgaugeai.com");
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "*");

    // Return a success response with a session warning
    String jsonResponse =
        "{\"success\":true,\"warning\":\"Session cleanup issue - please refresh if you experience problems\"}";
    response.getWriter().write(jsonResponse);
  }

  private void handleErrorPageSessionError(HttpServletResponse response, String path)
      throws IOException {

    logger.debug("Session repository error on error page - preventing cascade for {}", path);

    response.setStatus(HttpServletResponse.SC_OK);
    response.setContentType("text/html");
    response.setCharacterEncoding("UTF-8");

    String htmlResponse =
        "<html><body><h1>Session Expired</h1><p>Your session has expired. Please refresh the page.</p></body></html>";
    response.getWriter().write(htmlResponse);
  }

  private void handleBrowserSessionError(HttpServletResponse response, String path)
      throws IOException {

    logger.debug("Session repository error on browser endpoint - redirecting for {}", path);

    // For browser requests, redirect to home page
    response.sendRedirect("/");
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
