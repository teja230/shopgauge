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
@Order(1) // Execute early in the filter chain
public class CorrelationIdFilter implements Filter {

  private static final Logger logger = LoggerFactory.getLogger(CorrelationIdFilter.class);

  @Override
  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
      throws IOException, ServletException {

    HttpServletRequest httpRequest = (HttpServletRequest) request;
    HttpServletResponse httpResponse = (HttpServletResponse) response;

    try {
      // Extract correlation ID from request header
      String correlationId = httpRequest.getHeader(CorrelationIdUtil.CORRELATION_ID_HEADER);

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

    } finally {
      // Clean up MDC to prevent memory leaks
      CorrelationIdUtil.clearCorrelationId();
    }
  }
}
