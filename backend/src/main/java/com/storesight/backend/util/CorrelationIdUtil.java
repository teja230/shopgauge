package com.storesight.backend.util;

import java.util.UUID;
import org.slf4j.MDC;

/**
 * Utility for managing correlation IDs for request tracing
 *
 * <p>This utility provides methods to generate, set, and retrieve correlation IDs that can be used
 * to trace requests across different components and services.
 */
public class CorrelationIdUtil {

  public static final String CORRELATION_ID_KEY = "correlationId";
  public static final String CORRELATION_ID_HEADER = "X-Correlation-ID";

  /**
   * Generate a new correlation ID
   *
   * @return A new UUID-based correlation ID
   */
  public static String generateCorrelationId() {
    return UUID.randomUUID().toString();
  }

  /**
   * Set the correlation ID in the MDC (Mapped Diagnostic Context)
   *
   * @param correlationId The correlation ID to set
   */
  public static void setCorrelationId(String correlationId) {
    if (correlationId != null && !correlationId.trim().isEmpty()) {
      MDC.put(CORRELATION_ID_KEY, correlationId);
    }
  }

  /**
   * Get the current correlation ID from MDC
   *
   * @return The current correlation ID, or null if not set
   */
  public static String getCorrelationId() {
    return MDC.get(CORRELATION_ID_KEY);
  }

  /**
   * Get the current correlation ID, generating a new one if not set
   *
   * @return The current or newly generated correlation ID
   */
  public static String getOrGenerateCorrelationId() {
    String correlationId = getCorrelationId();
    if (correlationId == null || correlationId.trim().isEmpty()) {
      correlationId = generateCorrelationId();
      setCorrelationId(correlationId);
    }
    return correlationId;
  }

  /** Clear the correlation ID from MDC */
  public static void clearCorrelationId() {
    MDC.remove(CORRELATION_ID_KEY);
  }

  /**
   * Execute a runnable with a specific correlation ID
   *
   * @param correlationId The correlation ID to use
   * @param runnable The code to execute
   */
  public static void executeWithCorrelationId(String correlationId, Runnable runnable) {
    String previousCorrelationId = getCorrelationId();
    try {
      setCorrelationId(correlationId);
      runnable.run();
    } finally {
      if (previousCorrelationId != null) {
        setCorrelationId(previousCorrelationId);
      } else {
        clearCorrelationId();
      }
    }
  }

  /**
   * Execute a supplier with a specific correlation ID
   *
   * @param correlationId The correlation ID to use
   * @param supplier The code to execute
   * @return The result of the supplier
   */
  public static <T> T executeWithCorrelationId(
      String correlationId, java.util.function.Supplier<T> supplier) {
    String previousCorrelationId = getCorrelationId();
    try {
      setCorrelationId(correlationId);
      return supplier.get();
    } finally {
      if (previousCorrelationId != null) {
        setCorrelationId(previousCorrelationId);
      } else {
        clearCorrelationId();
      }
    }
  }

  /**
   * Check if a correlation ID is currently set
   *
   * @return true if a correlation ID is set, false otherwise
   */
  public static boolean hasCorrelationId() {
    String correlationId = getCorrelationId();
    return correlationId != null && !correlationId.trim().isEmpty();
  }

  /**
   * Validate a correlation ID format
   *
   * @param correlationId The correlation ID to validate
   * @return true if the correlation ID is valid, false otherwise
   */
  public static boolean isValidCorrelationId(String correlationId) {
    if (correlationId == null || correlationId.trim().isEmpty()) {
      return false;
    }

    // Check if it's a valid UUID format
    try {
      UUID.fromString(correlationId);
      return true;
    } catch (IllegalArgumentException e) {
      // If not a UUID, check if it's a reasonable length and contains only valid characters
      return correlationId.length() >= 8
          && correlationId.length() <= 64
          && correlationId.matches("^[a-zA-Z0-9\\-_]+$");
    }
  }
}
