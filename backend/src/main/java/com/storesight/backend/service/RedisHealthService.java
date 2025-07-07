package com.storesight.backend.service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class RedisHealthService {

  private static final Logger logger = LoggerFactory.getLogger(RedisHealthService.class);

  private final StringRedisTemplate redisTemplate;

  // Health tracking
  private boolean redisHealthy = true;
  private LocalDateTime lastHealthCheck = LocalDateTime.now();
  private LocalDateTime lastFailureTime = null;
  private int consecutiveFailures = 0;
  private static final int MAX_CONSECUTIVE_FAILURES = 3;
  private static final String HEALTH_CHECK_KEY = "redis:health:check";

  @Autowired
  public RedisHealthService(StringRedisTemplate redisTemplate) {
    this.redisTemplate = redisTemplate;
  }

  /** Check Redis health periodically */
  @Scheduled(fixedRate = 60000) // Every minute
  public void checkRedisHealth() {
    try {
      // Simple ping test
      String testValue = String.valueOf(System.currentTimeMillis());
      redisTemplate.opsForValue().set(HEALTH_CHECK_KEY, testValue, java.time.Duration.ofMinutes(1));

      String retrievedValue = redisTemplate.opsForValue().get(HEALTH_CHECK_KEY);

      if (testValue.equals(retrievedValue)) {
        if (!redisHealthy) {
          logger.info("Redis health restored after {} consecutive failures", consecutiveFailures);
        }
        redisHealthy = true;
        consecutiveFailures = 0;
        lastHealthCheck = LocalDateTime.now();
      } else {
        handleRedisFailure("Health check value mismatch");
      }

    } catch (Exception e) {
      handleRedisFailure("Health check exception: " + e.getMessage());
    }
  }

  private void handleRedisFailure(String reason) {
    consecutiveFailures++;
    lastFailureTime = LocalDateTime.now();

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && redisHealthy) {
      logger.error(
          "Redis marked as unhealthy after {} failures. Reason: {}", consecutiveFailures, reason);
      redisHealthy = false;
    } else {
      logger.warn("Redis health check failed (attempt {}): {}", consecutiveFailures, reason);
    }
  }

  /** Check if Redis is currently healthy */
  public boolean isRedisHealthy() {
    return redisHealthy;
  }

  /** Get detailed Redis health metrics */
  public Map<String, Object> getRedisHealthMetrics() {
    Map<String, Object> metrics = new HashMap<>();

    metrics.put("healthy", redisHealthy);
    metrics.put("lastHealthCheck", lastHealthCheck.toString());
    metrics.put("consecutiveFailures", consecutiveFailures);

    if (lastFailureTime != null) {
      metrics.put("lastFailureTime", lastFailureTime.toString());
      metrics.put(
          "minutesSinceLastFailure",
          java.time.Duration.between(lastFailureTime, LocalDateTime.now()).toMinutes());
    }

    // Test Redis performance
    try {
      long startTime = System.currentTimeMillis();
      redisTemplate.opsForValue().get("performance:test");
      long responseTime = System.currentTimeMillis() - startTime;
      metrics.put("responseTimeMs", responseTime);
      metrics.put(
          "performanceStatus",
          responseTime < 100
              ? "excellent"
              : responseTime < 500 ? "good" : responseTime < 1000 ? "fair" : "poor");
    } catch (Exception e) {
      metrics.put("responseTimeMs", -1);
      metrics.put("performanceStatus", "failed");
      metrics.put("performanceError", e.getMessage());
    }

    return metrics;
  }

  /** Safely execute Redis operation with fallback */
  public <T> T executeWithFallback(RedisOperation<T> operation, T fallbackValue) {
    if (!redisHealthy) {
      logger.debug("Redis unhealthy - using fallback value");
      return fallbackValue;
    }

    try {
      return operation.execute();
    } catch (Exception e) {
      logger.warn("Redis operation failed - using fallback. Error: {}", e.getMessage());
      handleRedisFailure("Operation execution failed: " + e.getMessage());
      return fallbackValue;
    }
  }

  /** Safely execute Redis operation with no return value */
  public boolean executeWithFallback(RedisVoidOperation operation) {
    if (!redisHealthy) {
      logger.debug("Redis unhealthy - skipping operation");
      return false;
    }

    try {
      operation.execute();
      return true;
    } catch (Exception e) {
      logger.warn("Redis void operation failed. Error: {}", e.getMessage());
      handleRedisFailure("Void operation execution failed: " + e.getMessage());
      return false;
    }
  }

  /** Force a Redis health check (for manual testing) */
  public void forceHealthCheck() {
    logger.info("Forcing Redis health check");
    checkRedisHealth();
  }

  @FunctionalInterface
  public interface RedisOperation<T> {
    T execute() throws Exception;
  }

  @FunctionalInterface
  public interface RedisVoidOperation {
    void execute() throws Exception;
  }
}
