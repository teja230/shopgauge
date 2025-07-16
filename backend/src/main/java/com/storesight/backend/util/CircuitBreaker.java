package com.storesight.backend.util;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Circuit breaker implementation to prevent cascading failures and provide fallback mechanisms for
 * database operations.
 */
public class CircuitBreaker {

  private static final Logger logger = LoggerFactory.getLogger(CircuitBreaker.class);

  public enum State {
    CLOSED, // Normal operation
    OPEN, // Circuit is open, calls are failing fast
    HALF_OPEN // Testing if service has recovered
  }

  private final String name;
  private final int failureThreshold;
  private final Duration timeout;
  private final Duration retryTimeout;

  private final AtomicReference<State> state = new AtomicReference<>(State.CLOSED);
  private final AtomicInteger failureCount = new AtomicInteger(0);
  private final AtomicInteger successCount = new AtomicInteger(0);
  private final AtomicLong lastFailureTime = new AtomicLong(0);
  private final AtomicLong lastSuccessTime = new AtomicLong(0);

  public CircuitBreaker(
      String name, int failureThreshold, Duration timeout, Duration retryTimeout) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.timeout = timeout;
    this.retryTimeout = retryTimeout;
  }

  /** Execute a supplier with circuit breaker protection */
  public <T> T execute(Supplier<T> supplier) throws CircuitBreakerOpenException {
    return execute(supplier, null);
  }

  /** Execute a supplier with circuit breaker protection and fallback */
  public <T> T execute(Supplier<T> supplier, Supplier<T> fallback)
      throws CircuitBreakerOpenException {
    if (canExecute()) {
      try {
        T result = supplier.get();
        onSuccess();
        return result;
      } catch (Exception e) {
        onFailure();
        if (fallback != null) {
          logger.warn("Circuit breaker {} failed, using fallback: {}", name, e.getMessage());
          return fallback.get();
        }
        throw e;
      }
    } else {
      if (fallback != null) {
        logger.warn("Circuit breaker {} is open, using fallback", name);
        return fallback.get();
      } else {
        throw new CircuitBreakerOpenException("Circuit breaker " + name + " is open");
      }
    }
  }

  /** Check if the circuit breaker allows execution */
  private boolean canExecute() {
    State currentState = state.get();

    switch (currentState) {
      case CLOSED:
        return true;

      case OPEN:
        if (shouldAttemptReset()) {
          state.compareAndSet(State.OPEN, State.HALF_OPEN);
          logger.info("Circuit breaker {} transitioning from OPEN to HALF_OPEN", name);
          return true;
        }
        return false;

      case HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /** Handle successful execution */
  private void onSuccess() {
    successCount.incrementAndGet();
    lastSuccessTime.set(System.currentTimeMillis());

    State currentState = state.get();
    if (currentState == State.HALF_OPEN) {
      // Reset circuit breaker after successful execution in half-open state
      reset();
      logger.info("Circuit breaker {} reset to CLOSED after successful execution", name);
    }
  }

  /** Handle failed execution */
  private void onFailure() {
    int failures = failureCount.incrementAndGet();
    lastFailureTime.set(System.currentTimeMillis());

    State currentState = state.get();

    if (currentState == State.HALF_OPEN) {
      // Failure in half-open state, go back to open
      state.set(State.OPEN);
      logger.warn("Circuit breaker {} failed in HALF_OPEN state, returning to OPEN", name);
    } else if (currentState == State.CLOSED && failures >= failureThreshold) {
      // Too many failures, open the circuit
      state.set(State.OPEN);
      logger.error("Circuit breaker {} opened after {} failures", name, failures);
    }
  }

  /** Check if we should attempt to reset the circuit breaker */
  private boolean shouldAttemptReset() {
    long timeSinceLastFailure = System.currentTimeMillis() - lastFailureTime.get();
    return timeSinceLastFailure >= retryTimeout.toMillis();
  }

  /** Reset the circuit breaker to closed state */
  public void reset() {
    state.set(State.CLOSED);
    failureCount.set(0);
    logger.info("Circuit breaker {} manually reset", name);
  }

  /** Force the circuit breaker to open state */
  public void forceOpen() {
    state.set(State.OPEN);
    logger.warn("Circuit breaker {} manually forced to OPEN state", name);
  }

  /** Get current circuit breaker statistics */
  public CircuitBreakerStatistics getStatistics() {
    return new CircuitBreakerStatistics(
        name,
        state.get(),
        failureCount.get(),
        successCount.get(),
        failureThreshold,
        lastFailureTime.get(),
        lastSuccessTime.get(),
        timeout.toMillis(),
        retryTimeout.toMillis());
  }

  /** Circuit breaker statistics data class */
  public static class CircuitBreakerStatistics {
    private final String name;
    private final State state;
    private final int failureCount;
    private final int successCount;
    private final int failureThreshold;
    private final long lastFailureTime;
    private final long lastSuccessTime;
    private final long timeoutMs;
    private final long retryTimeoutMs;

    public CircuitBreakerStatistics(
        String name,
        State state,
        int failureCount,
        int successCount,
        int failureThreshold,
        long lastFailureTime,
        long lastSuccessTime,
        long timeoutMs,
        long retryTimeoutMs) {
      this.name = name;
      this.state = state;
      this.failureCount = failureCount;
      this.successCount = successCount;
      this.failureThreshold = failureThreshold;
      this.lastFailureTime = lastFailureTime;
      this.lastSuccessTime = lastSuccessTime;
      this.timeoutMs = timeoutMs;
      this.retryTimeoutMs = retryTimeoutMs;
    }

    // Getters
    public String getName() {
      return name;
    }

    public State getState() {
      return state;
    }

    public int getFailureCount() {
      return failureCount;
    }

    public int getSuccessCount() {
      return successCount;
    }

    public int getFailureThreshold() {
      return failureThreshold;
    }

    public long getLastFailureTime() {
      return lastFailureTime;
    }

    public long getLastSuccessTime() {
      return lastSuccessTime;
    }

    public long getTimeoutMs() {
      return timeoutMs;
    }

    public long getRetryTimeoutMs() {
      return retryTimeoutMs;
    }

    public double getFailureRate() {
      int total = failureCount + successCount;
      return total > 0 ? (double) failureCount / total : 0.0;
    }
  }

  /** Exception thrown when circuit breaker is open */
  public static class CircuitBreakerOpenException extends RuntimeException {
    public CircuitBreakerOpenException(String message) {
      super(message);
    }
  }
}
