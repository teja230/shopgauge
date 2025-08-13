package com.storesight.backend.service;

import com.storesight.backend.config.MemoryProfileConfig;
import java.time.LocalDateTime;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/** Request Throttling and API Rate Limiting Service */
@Service
public class RequestThrottlingService {

  private static final Logger logger = LoggerFactory.getLogger(RequestThrottlingService.class);

  @Autowired private MemoryProfileConfig memoryProfileConfig;

  // Per-shop semaphores to limit concurrent requests
  private final ConcurrentHashMap<String, Semaphore> shopSemaphores = new ConcurrentHashMap<>();

  // Track last request time per shop to implement delays
  private final ConcurrentHashMap<String, LocalDateTime> lastRequestTime =
      new ConcurrentHashMap<>();

  private static final long MIN_REQUEST_DELAY_MS = 100;
  private static final long MAX_WAIT_TIME_SECONDS = 10;

  @Autowired private StringRedisTemplate stringRedisTemplate;

  @Value("${security.rate-limit.api.requests-per-minute:60}")
  private int apiRequestsPerMinute;

  public boolean checkApiRateLimit(String clientIp) {
    try {
      String key = "api:rate_limit:" + clientIp;
      Long count = stringRedisTemplate.opsForValue().increment(key);
      if (count != null && count == 1) {
        stringRedisTemplate.expire(key, java.time.Duration.ofMinutes(1));
      }
      if (count != null && count > apiRequestsPerMinute) {
        return false;
      }
    } catch (Exception e) {
      logger.debug("API rate limit check failed, allowing request: {}", e.getMessage());
    }
    return true;
  }

  public boolean acquireRequestPermit(String shopDomain, String requestType) {
    if (!memoryProfileConfig.getActiveSettings().isRequestThrottlingEnabled()) {
      return true;
    }

    try {
      int maxConcurrent = memoryProfileConfig.getActiveSettings().getMaxConcurrentRequests();
      Semaphore semaphore =
          shopSemaphores.computeIfAbsent(shopDomain, k -> new Semaphore(maxConcurrent, true));

      if (semaphore.tryAcquire()) {
        lastRequestTime.put(shopDomain, LocalDateTime.now());
        return true;
      }

      int queueLength = semaphore.getQueueLength();
      if (queueLength > 3) {
        return false;
      }

      boolean acquired = semaphore.tryAcquire(2, TimeUnit.SECONDS);
      if (acquired) {
        lastRequestTime.put(shopDomain, LocalDateTime.now());
        return true;
      } else {
        return false;
      }

    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return false;
    } catch (Exception e) {
      logger.error("Error acquiring request permit for shop {}: {}", shopDomain, e.getMessage());
      return false;
    }
  }

  public void releaseRequestPermit(String shopDomain, String requestType) {
    if (!memoryProfileConfig.getActiveSettings().isRequestThrottlingEnabled()) {
      return;
    }

    try {
      Semaphore semaphore = shopSemaphores.get(shopDomain);
      if (semaphore != null) {
        semaphore.release();
      }
    } catch (Exception e) {
      logger.error("Error releasing request permit for shop {}: {}", shopDomain, e.getMessage());
    }
  }

  public java.util.Map<String, Object> getStatistics() {
    java.util.Map<String, Object> stats = new java.util.HashMap<>();
    stats.put("memoryProfile", memoryProfileConfig.getMemoryProfile());
    stats.put(
        "throttlingEnabled", memoryProfileConfig.getActiveSettings().isRequestThrottlingEnabled());
    stats.put(
        "maxConcurrentRequests",
        memoryProfileConfig.getActiveSettings().getMaxConcurrentRequests());
    java.util.Map<String, Object> systemMetrics = new java.util.HashMap<>();
    systemMetrics.put("totalShopsTracked", shopSemaphores.size());
    stats.put("systemMetrics", systemMetrics);
    return stats;
  }

  public void cleanup() {
    LocalDateTime cutoff = LocalDateTime.now().minusHours(1);
    lastRequestTime
        .entrySet()
        .removeIf(
            entry -> {
              if (entry.getValue().isBefore(cutoff)) {
                String shop = entry.getKey();
                shopSemaphores.remove(shop);
                return true;
              }
              return false;
            });
  }
}
