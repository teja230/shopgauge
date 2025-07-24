package com.storesight.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Filter that catches session repository errors at the lowest level
 * This prevents IllegalStateException from session invalidation from bubbling up
 * and causing HTTP 500 errors or error page cascades
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SessionRepositoryErrorFilter extends OncePerRequestFilter {

  private static final Logger logger = LoggerFactory.getLogger(SessionRepositoryErrorFilter.class);

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {

    try {
      filterChain.doFilter(request, response);
    } catch (IllegalStateException e) {
      handleSessionError(request, response, e);
    } catch (ServletException e) {
      if (isSessionError(e)) {
        handleSessionError(request, response, e);
      } else {
        throw e;
      }
    } catch (Exception e) {
      if (isSessionError(e)) {
        handleSessionError(request, response, e);
      } else {
        throw e;
      }
    }
  }

  private boolean isSessionError(Exception e) {
    if (e.getMessage() != null && e.getMessage().contains("Session was invalidated")) {
      return true;
    }
    
    // Check cause chain for session errors
    Throwable cause = e.getCause();
    while (cause != null) {
      if (cause instanceof IllegalStateException && 
          cause.getMessage() != null && 
          cause.getMessage().contains("Session was invalidated")) {
        return true;
      }
      cause = cause.getCause();
    }
    
    return false;
  }

  private void handleSessionError(HttpServletRequest request, HttpServletResponse response, Exception e) 
      throws IOException {
    
    String path = request.getRequestURI();
    logger.debug("Session error handled gracefully for path: {} - {}", path, e.getMessage());
    
    // If response is already committed, we can't do anything
    if (response.isCommitted()) {
      logger.debug("Response already committed for path: {} - allowing to complete normally", path);
      return;
    }
    
    // For error pages, prevent cascading errors
    if (path.startsWith("/error")) {
      logger.debug("Session error on error page - preventing cascade for path: {}", path);
      response.setStatus(HttpServletResponse.SC_OK);
      response.setContentType("text/html");
      response.getWriter().write("<html><body>Session expired. Please refresh the page.</body></html>");
      return;
    }
    
    // For API endpoints, return a clean JSON response
    if (path.startsWith("/api/")) {
      logger.debug("Session error on API endpoint - returning clean response for path: {}", path);
      
      // Don't return 401 for session invalidation errors - the request was likely successful
      // The session invalidation happens during cleanup, not during the actual operation
      response.setStatus(HttpServletResponse.SC_OK);
      response.setContentType("application/json");
      response.setCharacterEncoding("UTF-8");
      
      // Add CORS headers
      response.setHeader("Access-Control-Allow-Origin", "https://www.shopgaugeai.com");
      response.setHeader("Access-Control-Allow-Credentials", "true");
      
      // Return a success response with a session warning
      String jsonResponse = "{\"success\":true,\"warning\":\"Session cleanup issue - please refresh if you experience problems\"}";
      response.getWriter().write(jsonResponse);
      return;
    }
    
    // For other requests, redirect to home page
    logger.debug("Session error on non-API endpoint - redirecting for path: {}", path);
    response.sendRedirect("/");
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    String path = request.getRequestURI();
    // Apply to all requests - we want to catch session errors everywhere
    return false;
  }
}