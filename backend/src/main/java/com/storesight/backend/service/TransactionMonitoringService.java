package com.storesight.backend.service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Transaction monitoring service to track transaction health and performance for session management
 * operations. This helps identify and debug transaction violations and performance issues.
 */
@Service
public class TransactionMonitoringService {

  private static final Logger logger = LoggerFactory.getLogger(TransactionMonitoringService.class);

  // Metrics tracking
  private final AtomicLong totalTransactions = new AtomicLong(0);
  private final AtomicLong successfulTransactions = new AtomicLong(0);
  private final AtomicLong failedTransactions = new AtomicLong(0);
  private final AtomicLong readOnlyViolations = new AtomicLong(0);
  private final AtomicLong timeoutViolations = new AtomicLong(0);

  // Error tracking by type
  private final Map<String, AtomicInteger> errorCounts = new ConcurrentHashMap<>();
  private final Map<String, LocalDateTime> lastErrorTimes = new ConcurrentHashMap<>();

  /** Record a successful transaction */
  public void recordSuccess(String operation, long durationMs) {
    totalTransactions.incrementAndGet();
    successfulTransactions.incrementAndGet();

    if (durationMs > 5000) { // Log slow transactions (>5 seconds)
      logger.warn("Slow transaction detected: {} took {}ms", operation, durationMs);
    } else {
      logger.debug("Transaction completed successfully: {} in {}ms", operation, durationMs);
    }
  }

  /** Record a failed transaction */
  public void recordFailure(
      String operation, String errorType, String errorMessage, long durationMs) {
    totalTransactions.incrementAndGet();
    failedTransactions.incrementAndGet();

    // Track specific error types
    if (errorMessage.contains("read-only transaction")) {
      readOnlyViolations.incrementAndGet();
      errorType = "READ_ONLY_VIOLATION";
    } else if (errorMessage.contains("timeout") || errorMessage.contains("Timeout")) {
      timeoutViolations.incrementAndGet();
      errorType = "TIMEOUT";
    }

    // Count errors by type
    errorCounts.computeIfAbsent(errorType, k -> new AtomicInteger(0)).incrementAndGet();
    lastErrorTimes.put(errorType, LocalDateTime.now());

    logger.error(
        "Transaction failed: operation={}, errorType={}, duration={}ms, error={}",
        operation,
        errorType,
        durationMs,
        errorMessage);
  }

  /** Record a read-only transaction violation specifically */
  public void recordReadOnlyViolation(String operation, String sessionId, String errorMessage) {
    readOnlyViolations.incrementAndGet();
    recordFailure(operation, "READ_ONLY_VIOLATION", errorMessage, 0);

    logger.error(
        "READ-ONLY TRANSACTION VIOLATION: operation={}, sessionId={}, error={}",
        operation,
        sessionId,
        errorMessage);
  }

  /** Get transaction health metrics */
  public Map<String, Object> getHealthMetrics() {
    Map<String, Object> metrics = new ConcurrentHashMap<>();

    long total = totalTransactions.get();
    long successful = successfulTransactions.get();
    long failed = failedTransactions.get();

    metrics.put("total_transactions", total);
    metrics.put("successful_transactions", successful);
    metrics.put("failed_transactions", failed);
    metrics.put("success_rate", total > 0 ? (double) successful / total * 100 : 0.0);
    metrics.put("read_only_violations", readOnlyViolations.get());
    metrics.put("timeout_violations", timeoutViolations.get());
    metrics.put("error_counts", errorCounts);
    metrics.put("last_error_times", lastErrorTimes);
    metrics.put("timestamp", LocalDateTime.now());

    return metrics;
  }

  /** Check if system is healthy (low error rate) */
  public boolean isHealthy() {
    long total = totalTransactions.get();
    long failed = failedTransactions.get();

    if (total < 10) {
      return true; // Not enough data to determine health
    }

    double failureRate = (double) failed / total;
    return failureRate < 0.05; // Less than 5% failure rate is considered healthy
  }

  /** Get critical alerts (high error rates, frequent read-only violations) */
  public Map<String, Object> getCriticalAlerts() {
    Map<String, Object> alerts = new ConcurrentHashMap<>();

    // Check for high read-only violation rate
    long readOnlyCount = readOnlyViolations.get();
    if (readOnlyCount > 10) {
      alerts.put(
          "read_only_violations_high",
          Map.of(
              "count", readOnlyCount,
              "message", "High number of read-only transaction violations detected",
              "severity", "CRITICAL"));
    }

    // Check for high timeout rate
    long timeoutCount = timeoutViolations.get();
    if (timeoutCount > 5) {
      alerts.put(
          "timeout_violations_high",
          Map.of(
              "count", timeoutCount,
              "message", "High number of transaction timeouts detected",
              "severity", "WARNING"));
    }

    // Check overall failure rate
    if (!isHealthy()) {
      long total = totalTransactions.get();
      long failed = failedTransactions.get();
      double failureRate = total > 0 ? (double) failed / total * 100 : 0;

      alerts.put(
          "high_failure_rate",
          Map.of(
              "failure_rate",
              failureRate,
              "message",
              String.format("Transaction failure rate is %.2f%%", failureRate),
              "severity",
              "WARNING"));
    }

    return alerts;
  }

  /** Reset all metrics (useful for testing or periodic resets) */
  public void resetMetrics() {
    totalTransactions.set(0);
    successfulTransactions.set(0);
    failedTransactions.set(0);
    readOnlyViolations.set(0);
    timeoutViolations.set(0);
    errorCounts.clear();
    lastErrorTimes.clear();

    logger.info("Transaction monitoring metrics reset");
  }

  /** Log periodic health summary */
  public void logHealthSummary() {
    Map<String, Object> metrics = getHealthMetrics();
    Map<String, Object> alerts = getCriticalAlerts();

    logger.info("Transaction Health Summary: {}", metrics);

    if (!alerts.isEmpty()) {
      logger.warn("Transaction Alerts: {}", alerts);
    }
  }
}
