package com.storesight.backend.service;

import com.storesight.backend.config.MemoryProfileConfig;
import java.time.LocalDateTime;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Request Throttling Service to prevent memory spikes during concurrent API calls
 *
 * <p>This service implements per-shop request throttling based on memory profile. Automatically
 * enabled for 512MB instances, disabled for larger instances.
 */
@Service
public class RequestThrottlingService {

  private static final Logger logger = LoggerFactory.getLogger(RequestThrottlingService.class);

  @Autowired private MemoryProfileConfig memoryProfileConfig;

  // Per-shop semaphores to limit concurrent requests
  private final ConcurrentHashMap<String, Semaphore> shopSemaphores = new ConcurrentHashMap<>();

  // Track last request time per shop to implement delays
  private final ConcurrentHashMap<String, LocalDateTime> lastRequestTime =
      new ConcurrentHashMap<>();

  // Minimum delay between requests (milliseconds)
  private static final long MIN_REQUEST_DELAY_MS = 100;

  // Maximum wait time for acquiring permit (seconds)
  private static final long MAX_WAIT_TIME_SECONDS = 10;

  /**
   * Acquire a permit for making an API request for the given shop
   *
   * @param shopDomain The shop domain
   * @param requestType The type of request (for logging)
   * @return true if permit acquired, false if should queue/retry
   */
  public boolean acquireRequestPermit(String shopDomain, String requestType) {
    // Check if throttling is enabled for current memory profile
    if (!memoryProfileConfig.getActiveSettings().isRequestThrottlingEnabled()) {
      logger.debug(
          "Request throttling disabled for memory profile: {}",
          memoryProfileConfig.getMemoryProfile());
      return true;
    }

    try {
      int maxConcurrent = memoryProfileConfig.getActiveSettings().getMaxConcurrentRequests();
      Semaphore semaphore =
          shopSemaphores.computeIfAbsent(shopDomain, k -> new Semaphore(maxConcurrent, true));

      // Check if we can acquire immediately (non-blocking)
      if (semaphore.tryAcquire()) {
        lastRequestTime.put(shopDomain, LocalDateTime.now());
        logger.debug(
            "Acquired request permit immediately for {} request for shop {}",
            requestType,
            shopDomain);
        return true;
      }

      // If immediate acquisition failed, check queue length
      int queueLength = semaphore.getQueueLength();
      if (queueLength > 3) {
        // Too many requests queued, suggest retry later
        logger.debug(
            "Too many queued requests ({}) for shop {}, suggesting retry", queueLength, shopDomain);
        return false;
      }

      // Try to acquire with short timeout for better UX
      boolean acquired = semaphore.tryAcquire(2, TimeUnit.SECONDS);

      if (acquired) {
        lastRequestTime.put(shopDomain, LocalDateTime.now());
        logger.debug(
            "Acquired request permit after wait for {} request for shop {}",
            requestType,
            shopDomain);
        return true;
      } else {
        logger.debug("Request queued/delayed for {} request for shop {}", requestType, shopDomain);
        return false;
      }

    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      logger.error(
          "Interrupted while waiting for request permit for shop {}: {}",
          shopDomain,
          e.getMessage());
      return false;
    } catch (Exception e) {
      logger.error("Error acquiring request permit for shop {}: {}", shopDomain, e.getMessage());
      return false;
    }
  }

  /**
   * Release a permit after completing an API request
   *
   * @param shopDomain The shop domain
   * @param requestType The type of request (for logging)
   */
  public void releaseRequestPermit(String shopDomain, String requestType) {
    // Only release if throttling is enabled
    if (!memoryProfileConfig.getActiveSettings().isRequestThrottlingEnabled()) {
      return;
    }

    try {
      Semaphore semaphore = shopSemaphores.get(shopDomain);
      if (semaphore != null) {
        semaphore.release();
        logger.debug("Released request permit for {} request for shop {}", requestType, shopDomain);
      }
    } catch (Exception e) {
      logger.error("Error releasing request permit for shop {}: {}", shopDomain, e.getMessage());
    }
  }

  /** Get comprehensive statistics for enterprise monitoring */
  public java.util.Map<String, Object> getStatistics() {
    java.util.Map<String, Object> stats = new java.util.HashMap<>();

    // Memory profile and configuration info
    stats.put("memoryProfile", memoryProfileConfig.getMemoryProfile());
    stats.put(
        "throttlingEnabled", memoryProfileConfig.getActiveSettings().isRequestThrottlingEnabled());
    stats.put(
        "maxConcurrentRequests",
        memoryProfileConfig.getActiveSettings().getMaxConcurrentRequests());
    stats.put("isEmergencyMode", memoryProfileConfig.isEmergencyMode());
    stats.put("timestamp", LocalDateTime.now().toString());

    // System-wide metrics
    java.util.Map<String, Object> systemMetrics = new java.util.HashMap<>();
    systemMetrics.put("totalShopsTracked", shopSemaphores.size());
    systemMetrics.put("totalActiveRequests", getTotalActiveRequests());
    systemMetrics.put("totalQueuedRequests", getTotalQueuedRequests());
    systemMetrics.put("averageWaitTime", getAverageWaitTime());
    stats.put("systemMetrics", systemMetrics);

    // Per-shop detailed statistics
    java.util.Map<String, Object> shopStats = new java.util.HashMap<>();

    for (java.util.Map.Entry<String, Semaphore> entry : shopSemaphores.entrySet()) {
      String shop = entry.getKey();
      Semaphore semaphore = entry.getValue();

      java.util.Map<String, Object> shopData = new java.util.HashMap<>();
      shopData.put("availablePermits", semaphore.availablePermits());
      shopData.put("queueLength", semaphore.getQueueLength());
      shopData.put(
          "maxPermits", memoryProfileConfig.getActiveSettings().getMaxConcurrentRequests());
      shopData.put(
          "utilizationPercent",
          Math.round(
              ((double)
                          (memoryProfileConfig.getActiveSettings().getMaxConcurrentRequests()
                              - semaphore.availablePermits())
                      / memoryProfileConfig.getActiveSettings().getMaxConcurrentRequests())
                  * 100));

      LocalDateTime lastRequest = lastRequestTime.get(shop);
      if (lastRequest != null) {
        shopData.put("lastRequestTime", lastRequest.toString());
        long timeSinceLastMs =
            java.time.Duration.between(lastRequest, LocalDateTime.now()).toMillis();
        shopData.put("timeSinceLastRequestMs", timeSinceLastMs);
        shopData.put("isActive", timeSinceLastMs < 300000); // Active if request within 5 minutes
      } else {
        shopData.put("isActive", false);
      }

      shopStats.put(shop, shopData);
    }

    stats.put("shops", shopStats);

    // Performance recommendations
    if (memoryProfileConfig.isEmergencyMode()) {
      java.util.List<String> recommendations = new java.util.ArrayList<>();
      if (getTotalQueuedRequests() > 5) {
        recommendations.add("Consider upgrading to 1GB memory profile for better performance");
      }
      if (getAverageWaitTime() > 1000) {
        recommendations.add("High wait times detected - memory profile upgrade recommended");
      }
      stats.put("recommendations", recommendations);
    }

    return stats;
  }

  private int getTotalActiveRequests() {
    return shopSemaphores.values().stream()
        .mapToInt(
            semaphore ->
                memoryProfileConfig.getActiveSettings().getMaxConcurrentRequests()
                    - semaphore.availablePermits())
        .sum();
  }

  private int getTotalQueuedRequests() {
    return shopSemaphores.values().stream().mapToInt(Semaphore::getQueueLength).sum();
  }

  private double getAverageWaitTime() {
    // Estimate based on queue lengths and processing time
    int totalQueued = getTotalQueuedRequests();
    if (totalQueued == 0) return 0.0;

    // Assume average processing time of 500ms per request
    return totalQueued * 500.0;
  }

  /** Clean up old semaphores for shops that haven't been accessed recently */
  public void cleanup() {
    LocalDateTime cutoff = LocalDateTime.now().minusHours(1);

    lastRequestTime
        .entrySet()
        .removeIf(
            entry -> {
              if (entry.getValue().isBefore(cutoff)) {
                String shop = entry.getKey();
                shopSemaphores.remove(shop);
                logger.debug("Cleaned up throttling data for inactive shop: {}", shop);
                return true;
              }
              return false;
            });
  }
}
