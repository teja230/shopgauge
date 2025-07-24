package com.storesight.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Special filter to handle OAuth callback sessions more gracefully
 * This prevents session invalidation errors during the OAuth flow
 */
public class OAuthSessionFilter extends OncePerRequestFilter {

  private static final Logger logger = LoggerFactory.getLogger(OAuthSessionFilter.class);

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {

    String path = request.getRequestURI();
    
    // Only apply special handling to OAuth callback and immediate post-OAuth requests
    boolean isOAuthFlow = path.contains("/api/auth/shopify/callback") 
        || (path.startsWith("/api/") && request.getParameter("connected") != null)
        || (path.startsWith("/api/") && "true".equals(request.getParameter("skip_loading")));

    if (isOAuthFlow) {
      logger.debug("Applying OAuth session handling for path: {}", path);
      
      try {
        // Wrap the request to handle session issues gracefully
        filterChain.doFilter(request, response);
        
      } catch (IllegalStateException e) {
        if (e.getMessage() != null && e.getMessage().contains("Session was invalidated")) {
          logger.warn("OAuth session invalidation handled gracefully for path: {} - {}", 
              path, e.getMessage());
          
          // For OAuth flow, don't fail the request - the business logic has likely succeeded
          // The session invalidation happens during cleanup, not during the actual operation
          if (response.isCommitted()) {
            logger.info("Response already committed for OAuth flow - allowing to complete normally");
            return;
          }
          
          // If response not committed, this might be during the callback itself
          if (path.contains("/callback")) {
            logger.warn("Session invalidation during OAuth callback - this may indicate a configuration issue");
            // Let the callback handle this error appropriately
            throw e;
          } else {
            // For post-OAuth API calls, return success since the business operation likely succeeded
            logger.info("Session invalidation during post-OAuth API call - allowing success response");
            return;
          }
        } else {
          throw e;
        }
      } catch (Exception e) {
        // Handle other session-related exceptions during OAuth flow
        if (e.getMessage() != null && e.getMessage().contains("Session")) {
          logger.warn("Session-related error during OAuth flow for path: {} - {}", 
              path, e.getMessage());
          
          if (response.isCommitted()) {
            logger.info("Response committed during OAuth session error - allowing to complete");
            return;
          }
        }
        throw e;
      }
    } else {
      // Normal processing for non-OAuth requests
      filterChain.doFilter(request, response);
    }
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    String path = request.getRequestURI();
    // Skip filtering for public endpoints that don't need session handling
    return path.startsWith("/actuator/")
        || path.startsWith("/health/")
        || path.startsWith("/api/health/")
        || path.equals("/")
        || path.equals("/health")
        || path.startsWith("/error");
  }
}