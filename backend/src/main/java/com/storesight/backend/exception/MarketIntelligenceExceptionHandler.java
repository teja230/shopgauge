package com.storesight.backend.exception;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.WebRequest;

/** Centralized exception handler for Market Intelligence features */
@ControllerAdvice
@Order(-2000) // Higher priority than GlobalSessionExceptionHandler (-1000) to handle business
// exceptions first
public class MarketIntelligenceExceptionHandler {
  private static final Logger logger =
      LoggerFactory.getLogger(MarketIntelligenceExceptionHandler.class);

  @ExceptionHandler(CompetitorLimitExceededException.class)
  public ResponseEntity<Map<String, Object>> handleCompetitorLimitExceeded(
      CompetitorLimitExceededException ex, WebRequest request) {

    logger.warn(
        "MarketIntelligenceExceptionHandler: Competitor limit exceeded: {}", ex.getMessage());
    logger.info(
        "MarketIntelligenceExceptionHandler: Processing CompetitorLimitExceededException with order -2000");

    Map<String, Object> response = new HashMap<>();
    response.put("error", "COMPETITOR_LIMIT_EXCEEDED");
    response.put("message", ex.getMessage());
    response.put("currentCount", ex.getCurrentCount());
    response.put("limit", ex.getLimit());
    response.put("planType", ex.getPlanType());
    response.put("timestamp", LocalDateTime.now());
    response.put("upgradeMessage", "Upgrade your plan to track more competitors");

    return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(response);
  }

  @ExceptionHandler(ArchivedCompetitorLimitExceededException.class)
  public ResponseEntity<Map<String, Object>> handleArchivedCompetitorLimitExceeded(
      ArchivedCompetitorLimitExceededException ex, WebRequest request) {

    logger.warn("Archived competitor limit exceeded: {}", ex.getMessage());

    Map<String, Object> response = new HashMap<>();
    response.put("error", "ARCHIVED_COMPETITOR_LIMIT_EXCEEDED");
    response.put("message", ex.getMessage());
    response.put("currentCount", ex.getCurrentCount());
    response.put("limit", ex.getLimit());
    response.put("planType", ex.getPlanType());
    response.put("timestamp", LocalDateTime.now());
    response.put("upgradeMessage", "Upgrade your plan to restore more archived competitors");

    return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(response);
  }

  @ExceptionHandler(BudgetExceededException.class)
  public ResponseEntity<Map<String, Object>> handleBudgetExceeded(
      BudgetExceededException ex, WebRequest request) {

    logger.warn("Budget exceeded: {}", ex.getMessage());

    Map<String, Object> response = new HashMap<>();
    response.put("error", "BUDGET_EXCEEDED");
    response.put("message", ex.getMessage());
    response.put("currentSpend", ex.getCurrentSpend());
    response.put("budgetLimit", ex.getBudgetLimit());
    response.put("budgetType", ex.getBudgetType());
    response.put("timestamp", LocalDateTime.now());
    response.put("retryAfter", ex.getBudgetType().equals("daily") ? "24 hours" : "next month");

    return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(response);
  }

  @ExceptionHandler(DiscoveryServiceUnavailableException.class)
  public ResponseEntity<Map<String, Object>> handleDiscoveryServiceUnavailable(
      DiscoveryServiceUnavailableException ex, WebRequest request) {

    logger.error("Discovery service unavailable: {}", ex.getMessage(), ex);

    Map<String, Object> response = new HashMap<>();
    response.put("error", "DISCOVERY_SERVICE_UNAVAILABLE");
    response.put("message", ex.getMessage());
    response.put("reason", ex.getReason());
    response.put("timestamp", LocalDateTime.now());
    response.put("suggestion", "Please try again later or contact support if the issue persists");

    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
  }

  @ExceptionHandler(DataAccessException.class)
  public ResponseEntity<Map<String, Object>> handleDataAccessException(
      DataAccessException ex, WebRequest request) {

    logger.error("Database error in Market Intelligence: {}", ex.getMessage(), ex);

    Map<String, Object> response = new HashMap<>();
    response.put("error", "DATABASE_ERROR");
    response.put("message", "A database error occurred. Please try again.");
    response.put("timestamp", LocalDateTime.now());

    // Don't expose internal database details in production
    if (logger.isDebugEnabled()) {
      response.put("details", ex.getMessage());
    }

    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<Map<String, Object>> handleIllegalArgument(
      IllegalArgumentException ex, WebRequest request) {

    logger.warn("Invalid argument in Market Intelligence: {}", ex.getMessage());

    Map<String, Object> response = new HashMap<>();
    response.put("error", "INVALID_ARGUMENT");
    response.put("message", ex.getMessage());
    response.put("timestamp", LocalDateTime.now());

    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
  }

  @ExceptionHandler(RuntimeException.class)
  public ResponseEntity<Map<String, Object>> handleRuntimeException(
      RuntimeException ex, WebRequest request) {

    // Special handling for session invalidation errors
    if (ex.getMessage() != null && ex.getMessage().contains("Session was invalidated")) {
      logger.warn("Session invalidation error in Market Intelligence: {}", ex.getMessage());

      Map<String, Object> response = new HashMap<>();
      response.put("error", "SESSION_INVALIDATED");
      response.put("message", "Your session has expired. Please refresh the page and try again.");
      response.put("timestamp", LocalDateTime.now());
      response.put("requiresReauth", true);

      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    logger.error("Unexpected error in Market Intelligence: {}", ex.getMessage(), ex);

    Map<String, Object> response = new HashMap<>();
    response.put("error", "INTERNAL_ERROR");
    response.put("message", "An unexpected error occurred. Please try again.");
    response.put("timestamp", LocalDateTime.now());

    // Include stack trace only in debug mode
    if (logger.isDebugEnabled()) {
      response.put("details", ex.getMessage());
    }

    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, Object>> handleGenericException(
      Exception ex, WebRequest request) {

    logger.error("Generic error in Market Intelligence: {}", ex.getMessage(), ex);

    Map<String, Object> response = new HashMap<>();
    response.put("error", "SYSTEM_ERROR");
    response.put(
        "message", "A system error occurred. Please contact support if the issue persists.");
    response.put("timestamp", LocalDateTime.now());

    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
  }
}
