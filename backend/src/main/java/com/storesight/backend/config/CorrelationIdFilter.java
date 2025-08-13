package com.storesight.backend.config;

import com.storesight.backend.util.CorrelationIdUtil;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Filter to handle correlation IDs for request tracing
 *
 * <p>This filter extracts correlation IDs from incoming requests, generates new ones if not
 * present, and ensures they are included in responses and logging context.
 */
@Component
@Order(-1000) // Execute very early in the filter chain, before security filters
public class CorrelationIdFilter implements Filter {

  private static final Logger logger = LoggerFactory.getLogger(CorrelationIdFilter.class);

  // Endpoints that don't need correlation IDs (health checks, monitoring)
  private static final List<String> SKIP_CORRELATION_ENDPOINTS =
      Arrays.asList(
          "/actuator/health", "/api/health/summary", "/api/admin/market-intelligence/health");

  @Override
  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
      throws IOException, ServletException {

    if (!(request instanceof HttpServletRequest) || !(response instanceof HttpServletResponse)) {
      chain.doFilter(request, response);
      return;
    }

    HttpServletRequest httpRequest = (HttpServletRequest) request;
    HttpServletResponse httpResponse = (HttpServletResponse) response;

    // Check if this endpoint should skip correlation ID generation
    String requestUri = httpRequest.getRequestURI();
    if (shouldSkipCorrelationId(requestUri)) {
      // For health checks and monitoring, just continue without correlation ID
      chain.doFilter(request, response);
      return;
    }

    try {
      // Extract correlation ID from request header
      String correlationId = httpRequest.getHeader(CorrelationIdUtil.CORRELATION_ID_HEADER);

      // Also capture W3C traceparent header if present for OpenTelemetry correlation
      String traceParent = httpRequest.getHeader("traceparent");
      if (traceParent != null && !traceParent.isBlank()) {
        org.slf4j.MDC.put("traceparent", traceParent);
      }

      // Generate new correlation ID if not present or invalid
      if (correlationId == null
          || correlationId.trim().isEmpty()
          || !CorrelationIdUtil.isValidCorrelationId(correlationId)) {
        correlationId = CorrelationIdUtil.generateCorrelationId();
        logger.debug(
            "Generated new correlation ID: {} for request: {} {}",
            correlationId,
            httpRequest.getMethod(),
            httpRequest.getRequestURI());
      } else {
        logger.debug(
            "Using existing correlation ID: {} for request: {} {}",
            correlationId,
            httpRequest.getMethod(),
            httpRequest.getRequestURI());
      }

      // Set correlation ID in MDC for logging
      CorrelationIdUtil.setCorrelationId(correlationId);

      // Add correlation ID to response header
      httpResponse.setHeader(CorrelationIdUtil.CORRELATION_ID_HEADER, correlationId);

      // Continue with the filter chain
      chain.doFilter(request, response);

    } catch (Exception e) {
      logger.error("Error in correlation ID filter: {}", e.getMessage(), e);
      // Continue with the chain even if correlation ID fails
      try {
        chain.doFilter(request, response);
      } catch (Exception chainError) {
        logger.error(
            "Error in filter chain after correlation ID error: {}", chainError.getMessage());
      }
    } finally {
      // Clean up MDC to prevent memory leaks
      CorrelationIdUtil.clearCorrelationId();
      org.slf4j.MDC.remove("traceparent");
    }
  }

  /**
   * Check if the request URI should skip correlation ID generation
   *
   * @param requestUri The request URI to check
   * @return true if correlation ID should be skipped, false otherwise
   */
  private boolean shouldSkipCorrelationId(String requestUri) {
    return SKIP_CORRELATION_ENDPOINTS.stream()
        .anyMatch(endpoint -> requestUri.startsWith(endpoint));
  }
}
