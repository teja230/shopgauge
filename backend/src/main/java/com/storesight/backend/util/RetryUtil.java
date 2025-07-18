package com.storesight.backend.util;

import java.time.Duration;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Predicate;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.HttpClientErrorException;

/**
 * Utility class for implementing retry logic with exponential backoff and jitter for database and
 * external service operations.
 */
public class RetryUtil {

  private static final Logger logger = LoggerFactory.getLogger(RetryUtil.class);

  /** Retry configuration builder */
  public static class RetryConfig {
    private int maxAttempts = 3;
    private Duration initialDelay = Duration.ofMillis(100);
    private Duration maxDelay = Duration.ofSeconds(30);
    private double backoffMultiplier = 2.0;
    private boolean useJitter = true;
    private Predicate<Exception> retryPredicate = this::isRetryableException;

    public RetryConfig maxAttempts(int maxAttempts) {
      this.maxAttempts = maxAttempts;
      return this;
    }

    public RetryConfig initialDelay(Duration initialDelay) {
      this.initialDelay = initialDelay;
      return this;
    }

    public RetryConfig maxDelay(Duration maxDelay) {
      this.maxDelay = maxDelay;
      return this;
    }

    public RetryConfig backoffMultiplier(double backoffMultiplier) {
      this.backoffMultiplier = backoffMultiplier;
      return this;
    }

    public RetryConfig useJitter(boolean useJitter) {
      this.useJitter = useJitter;
      return this;
    }

    public RetryConfig retryOn(Predicate<Exception> retryPredicate) {
      this.retryPredicate = retryPredicate;
      return this;
    }

    private boolean isRetryableException(Exception e) {
      // Default retry logic for common transient exceptions
      String message = e.getMessage();
      if (message == null) return false;

      String lowerMessage = message.toLowerCase();
      return lowerMessage.contains("timeout")
          || lowerMessage.contains("connection")
          || lowerMessage.contains("network")
          || lowerMessage.contains("temporary")
          || lowerMessage.contains("unavailable")
          || e instanceof java.sql.SQLTransientException
          || e instanceof java.net.SocketTimeoutException
          || e instanceof java.net.ConnectException;
    }
  }

  /** Execute a supplier with retry logic */
  public static <T> T executeWithRetry(Supplier<T> supplier, RetryConfig config) {
    Exception lastException = null;

    for (int attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return supplier.get();
      } catch (Exception e) {
        lastException = e;

        if (attempt == config.maxAttempts || !config.retryPredicate.test(e)) {
          logger.error("Operation failed after {} attempts, giving up", attempt, e);
          break;
        }

        Duration delay = calculateDelay(attempt, config);
        logger.warn(
            "Operation failed on attempt {}/{}, retrying in {}ms: {}",
            attempt,
            config.maxAttempts,
            delay.toMillis(),
            e.getMessage());

        try {
          Thread.sleep(delay.toMillis());
        } catch (InterruptedException ie) {
          Thread.currentThread().interrupt();
          throw new RuntimeException("Retry interrupted", ie);
        }
      }
    }

    if (lastException instanceof RuntimeException) {
      throw (RuntimeException) lastException;
    } else {
      throw new RuntimeException("Operation failed after retries", lastException);
    }
  }

  /** Execute a runnable with retry logic */
  public static void executeWithRetry(Runnable runnable, RetryConfig config) {
    executeWithRetry(
        () -> {
          runnable.run();
          return null;
        },
        config);
  }

  /** Create a default retry configuration for database operations */
  public static RetryConfig forDatabase() {
    return new RetryConfig()
        .maxAttempts(3)
        .initialDelay(Duration.ofMillis(100))
        .maxDelay(Duration.ofSeconds(5))
        .backoffMultiplier(2.0)
        .useJitter(true)
        .retryOn(e -> isDatabaseRetryableException(e));
  }

  /** Create a default retry configuration for Redis operations */
  public static RetryConfig forRedis() {
    return new RetryConfig()
        .maxAttempts(2)
        .initialDelay(Duration.ofMillis(50))
        .maxDelay(Duration.ofSeconds(2))
        .backoffMultiplier(1.5)
        .useJitter(true)
        .retryOn(e -> isRedisRetryableException(e));
  }

  /** Create a default retry configuration for external API calls */
  public static RetryConfig forExternalApi() {
    return new RetryConfig()
        .maxAttempts(3)
        .initialDelay(Duration.ofMillis(200))
        .maxDelay(Duration.ofSeconds(10))
        .backoffMultiplier(2.0)
        .useJitter(true)
        .retryOn(e -> isApiRetryableException(e));
  }

  /** Calculate delay with exponential backoff and optional jitter */
  private static Duration calculateDelay(int attempt, RetryConfig config) {
    long baseDelay = config.initialDelay.toMillis();
    long delay = (long) (baseDelay * Math.pow(config.backoffMultiplier, attempt - 1));

    // Cap at max delay
    delay = Math.min(delay, config.maxDelay.toMillis());

    // Add jitter to prevent thundering herd
    if (config.useJitter) {
      double jitterFactor = 0.1; // 10% jitter
      long jitter = (long) (delay * jitterFactor * ThreadLocalRandom.current().nextDouble());
      delay += ThreadLocalRandom.current().nextBoolean() ? jitter : -jitter;
    }

    return Duration.ofMillis(Math.max(0, delay));
  }

  /** Check if database exception is retryable */
  private static boolean isDatabaseRetryableException(Exception e) {
    // Use exception type matching instead of string matching
    if (e instanceof java.sql.SQLTransientException) {
      return true;
    }
    if (e instanceof java.sql.SQLRecoverableException) {
      return true;
    }
    if (e instanceof org.springframework.dao.DataAccessException) {
      return true;
    }
    if (e instanceof org.springframework.dao.TransientDataAccessException) {
      return true;
    }
    if (e instanceof org.springframework.dao.RecoverableDataAccessException) {
      return true;
    }
    if (e instanceof java.sql.SQLNonTransientConnectionException) {
      return true;
    }
    if (e instanceof java.sql.SQLTransientConnectionException) {
      return true;
    }

    // Fallback to structured error classification for unknown exceptions
    return classifyExceptionAsRetryable(e, "database");
  }

  /** Check if Redis exception is retryable */
  private static boolean isRedisRetryableException(Exception e) {
    // Use exception type matching for Redis-specific exceptions
    if (e instanceof java.net.SocketTimeoutException) {
      return true;
    }
    if (e instanceof java.net.ConnectException) {
      return true;
    }
    if (e instanceof java.net.NoRouteToHostException) {
      return true;
    }
    if (e instanceof java.net.UnknownHostException) {
      return true;
    }
    if (e instanceof org.springframework.data.redis.RedisConnectionFailureException) {
      return true;
    }
    if (e instanceof org.springframework.data.redis.RedisSystemException) {
      return true;
    }

    // Fallback to structured error classification
    return classifyExceptionAsRetryable(e, "redis");
  }

  /** Check if API exception is retryable */
  private static boolean isApiRetryableException(Exception e) {
    // Use exception type matching for HTTP/API exceptions
    if (e instanceof java.net.SocketTimeoutException) {
      return true;
    }
    if (e instanceof java.net.ConnectException) {
      return true;
    }
    if (e instanceof java.net.NoRouteToHostException) {
      return true;
    }
    if (e instanceof java.net.UnknownHostException) {
      return true;
    }
    if (e instanceof org.springframework.web.client.ResourceAccessException) {
      return true;
    }
    if (e instanceof org.springframework.web.client.HttpServerErrorException) {
      return true;
    }
    if (e instanceof org.springframework.web.client.HttpClientErrorException) {
      HttpClientErrorException httpEx = (HttpClientErrorException) e;
      // Retry on rate limiting (429) and some 5xx errors
      return httpEx.getStatusCode().value() == 429 || httpEx.getStatusCode().value() >= 500;
    }

    // Fallback to structured error classification
    return classifyExceptionAsRetryable(e, "api");
  }

  /** Structured error classification with fallback to message analysis */
  private static boolean classifyExceptionAsRetryable(Exception e, String context) {
    if (e == null || e.getMessage() == null) {
      return false;
    }

    String message = e.getMessage().toLowerCase();

    // Define retryable error patterns by context
    // Note: Using return statements to prevent fall-through behavior
    switch (context) {
      case "database":
        return message.contains("connection")
            || message.contains("timeout")
            || message.contains("deadlock")
            || message.contains("lock wait timeout")
            || message.contains("too many connections")
            || message.contains("connection reset")
            || message.contains("broken pipe")
            || message.contains("connection pool")
            || message.contains("database unavailable");

      case "redis":
        return message.contains("connection")
            || message.contains("timeout")
            || message.contains("redis")
            || message.contains("jedis")
            || message.contains("lettuce")
            || message.contains("connection pool")
            || message.contains("network");

      case "api":
        return message.contains("timeout")
            || message.contains("503")
            || message.contains("502")
            || message.contains("504")
            || message.contains("429")
            || message.contains("connection")
            || message.contains("network")
            || message.contains("service unavailable")
            || message.contains("gateway timeout");

      default:
        return false;
    }
  }

  /** Retry statistics for monitoring */
  public static class RetryStatistics {
    private final int totalAttempts;
    private final int successfulAttempts;
    private final int failedAttempts;
    private final long totalRetryTime;
    private final Exception lastException;

    public RetryStatistics(
        int totalAttempts,
        int successfulAttempts,
        int failedAttempts,
        long totalRetryTime,
        Exception lastException) {
      this.totalAttempts = totalAttempts;
      this.successfulAttempts = successfulAttempts;
      this.failedAttempts = failedAttempts;
      this.totalRetryTime = totalRetryTime;
      this.lastException = lastException;
    }

    // Getters
    public int getTotalAttempts() {
      return totalAttempts;
    }

    public int getSuccessfulAttempts() {
      return successfulAttempts;
    }

    public int getFailedAttempts() {
      return failedAttempts;
    }

    public long getTotalRetryTime() {
      return totalRetryTime;
    }

    public Exception getLastException() {
      return lastException;
    }

    public double getSuccessRate() {
      return totalAttempts > 0 ? (double) successfulAttempts / totalAttempts : 0.0;
    }
  }
}
