package com.storesight.backend.service;

import java.time.LocalDateTime;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Market Intelligence Event Handler for Cache Invalidation
 *
 * <p>Implements event-driven cache invalidation system following the optimization guide. Handles
 * write operation events and automatically invalidates related caches to maintain data consistency
 * while optimizing performance.
 *
 * <p>Key Features: - Asynchronous event processing - Smart cache invalidation based on operation
 * type - Event statistics and monitoring - Error handling and recovery - Memory profile awareness
 */
@Service
public class MarketIntelligenceEventHandler {

  private static final Logger logger =
      LoggerFactory.getLogger(MarketIntelligenceEventHandler.class);

  // Statistics tracking
  private final AtomicLong totalEventsProcessed = new AtomicLong(0);
  private final AtomicLong cacheInvalidationEvents = new AtomicLong(0);
  private final AtomicLong successfulInvalidations = new AtomicLong(0);
  private final AtomicLong failedInvalidations = new AtomicLong(0);

  // Services
  private final MarketIntelligenceCacheService cacheService;

  public MarketIntelligenceEventHandler(MarketIntelligenceCacheService cacheService) {
    this.cacheService = cacheService;
    logger.info("MarketIntelligenceEventHandler initialized for event-driven cache invalidation");
  }

  // =====================================
  // EVENT LISTENERS
  // =====================================

  /** Handle competitor update events Invalidates competitor-related caches and dashboard */
  @EventListener
  @Async
  public void handleCompetitorUpdate(MarketIntelligenceWriteService.WriteOperationEvent event) {
    if (!isCompetitorRelatedEvent(event.getOperation())) {
      return;
    }

    try {
      totalEventsProcessed.incrementAndGet();
      cacheInvalidationEvents.incrementAndGet();

      String shopDomain = event.getShopDomain();
      String operation = event.getOperation();

      logger.debug(
          "Processing competitor update event: {} for shop: {} (Operation ID: {})",
          operation,
          shopDomain,
          event.getOperationId());

      // Invalidate competitor-specific caches
      CompletableFuture<Void> competitorCache =
          CompletableFuture.runAsync(
              () -> {
                cacheService.invalidateCache("mi:competitor_data:" + shopDomain);
                logger.debug("Invalidated competitor data cache for shop: {}", shopDomain);
              });

      // Invalidate discovery stats cache
      CompletableFuture<Void> discoveryCache =
          CompletableFuture.runAsync(
              () -> {
                cacheService.invalidateCache("mi:discovery_stats:" + shopDomain);
                logger.debug("Invalidated discovery stats cache for shop: {}", shopDomain);
              });

      // Invalidate dashboard cache (contains competitor summaries)
      CompletableFuture<Void> dashboardCache =
          CompletableFuture.runAsync(
              () -> {
                cacheService.invalidateCache("mi:dashboard:" + shopDomain);
                logger.debug("Invalidated dashboard cache for shop: {}", shopDomain);
              });

      // Wait for all invalidations to complete
      CompletableFuture.allOf(competitorCache, discoveryCache, dashboardCache).join();

      successfulInvalidations.incrementAndGet();
      logger.info(
          "Successfully processed competitor update event for shop: {} (Operation: {})",
          shopDomain,
          event.getOperationId());

    } catch (Exception e) {
      failedInvalidations.incrementAndGet();
      logger.error(
          "Failed to process competitor update event for shop: {} (Operation: {}): {}",
          event.getShopDomain(),
          event.getOperationId(),
          e.getMessage(),
          e);
    }
  }

  /** Handle price update events Invalidates price-related caches */
  @EventListener
  @Async
  public void handlePriceUpdate(MarketIntelligenceWriteService.WriteOperationEvent event) {
    if (!isPriceRelatedEvent(event.getOperation())) {
      return;
    }

    try {
      totalEventsProcessed.incrementAndGet();
      cacheInvalidationEvents.incrementAndGet();

      String shopDomain = event.getShopDomain();
      String operation = event.getOperation();

      logger.debug(
          "Processing price update event: {} for shop: {} (Operation ID: {})",
          operation,
          shopDomain,
          event.getOperationId());

      // Invalidate price-related caches
      CompletableFuture<Void> priceHistoryCache =
          CompletableFuture.runAsync(
              () -> {
                cacheService.invalidateCache("mi:price_history:" + shopDomain);
                logger.debug("Invalidated price history cache for shop: {}", shopDomain);
              });

      // Invalidate competitor data cache (contains current prices)
      CompletableFuture<Void> competitorCache =
          CompletableFuture.runAsync(
              () -> {
                cacheService.invalidateCache("mi:competitor_data:" + shopDomain);
                logger.debug("Invalidated competitor data cache for shop: {}", shopDomain);
              });

      // Invalidate dashboard cache (contains price summaries)
      CompletableFuture<Void> dashboardCache =
          CompletableFuture.runAsync(
              () -> {
                cacheService.invalidateCache("mi:dashboard:" + shopDomain);
                logger.debug("Invalidated dashboard cache for shop: {}", shopDomain);
              });

      // Wait for all invalidations to complete
      CompletableFuture.allOf(priceHistoryCache, competitorCache, dashboardCache).join();

      successfulInvalidations.incrementAndGet();
      logger.info(
          "Successfully processed price update event for shop: {} (Operation: {})",
          shopDomain,
          event.getOperationId());

    } catch (Exception e) {
      failedInvalidations.incrementAndGet();
      logger.error(
          "Failed to process price update event for shop: {} (Operation: {}): {}",
          event.getShopDomain(),
          event.getOperationId(),
          e.getMessage(),
          e);
    }
  }

  /**
   * Handle cost tracking events Cost analytics cache is append-only, so only invalidate dashboard
   */
  @EventListener
  @Async
  public void handleCostUpdate(MarketIntelligenceWriteService.WriteOperationEvent event) {
    if (!isCostRelatedEvent(event.getOperation())) {
      return;
    }

    try {
      totalEventsProcessed.incrementAndGet();
      cacheInvalidationEvents.incrementAndGet();

      String shopDomain = event.getShopDomain();
      String operation = event.getOperation();

      logger.debug(
          "Processing cost update event: {} for shop: {} (Operation ID: {})",
          operation,
          shopDomain,
          event.getOperationId());

      // Only invalidate dashboard cache (cost analytics cache is append-only)
      cacheService.invalidateCache("mi:dashboard:" + shopDomain);
      logger.debug("Invalidated dashboard cache for cost update - shop: {}", shopDomain);

      successfulInvalidations.incrementAndGet();
      logger.info(
          "Successfully processed cost update event for shop: {} (Operation: {})",
          shopDomain,
          event.getOperationId());

    } catch (Exception e) {
      failedInvalidations.incrementAndGet();
      logger.error(
          "Failed to process cost update event for shop: {} (Operation: {}): {}",
          event.getShopDomain(),
          event.getOperationId(),
          e.getMessage(),
          e);
    }
  }

  /** Handle system status update events Invalidates system status and dashboard caches */
  @EventListener
  @Async
  public void handleSystemStatusUpdate(MarketIntelligenceWriteService.WriteOperationEvent event) {
    if (!isSystemStatusRelatedEvent(event.getOperation())) {
      return;
    }

    try {
      totalEventsProcessed.incrementAndGet();
      cacheInvalidationEvents.incrementAndGet();

      String shopDomain = event.getShopDomain();
      String operation = event.getOperation();

      logger.debug(
          "Processing system status update event: {} for shop: {} (Operation ID: {})",
          operation,
          shopDomain,
          event.getOperationId());

      // Invalidate system status cache
      CompletableFuture<Void> systemStatusCache =
          CompletableFuture.runAsync(
              () -> {
                cacheService.invalidateCache("mi:system_status:" + shopDomain);
                logger.debug("Invalidated system status cache for shop: {}", shopDomain);
              });

      // Invalidate dashboard cache
      CompletableFuture<Void> dashboardCache =
          CompletableFuture.runAsync(
              () -> {
                cacheService.invalidateCache("mi:dashboard:" + shopDomain);
                logger.debug("Invalidated dashboard cache for shop: {}", shopDomain);
              });

      // Wait for all invalidations to complete
      CompletableFuture.allOf(systemStatusCache, dashboardCache).join();

      successfulInvalidations.incrementAndGet();
      logger.info(
          "Successfully processed system status update event for shop: {} (Operation: {})",
          shopDomain,
          event.getOperationId());

    } catch (Exception e) {
      failedInvalidations.incrementAndGet();
      logger.error(
          "Failed to process system status update event for shop: {} (Operation: {}): {}",
          event.getShopDomain(),
          event.getOperationId(),
          e.getMessage(),
          e);
    }
  }

  /** Handle performance metrics update events Invalidates performance metrics cache only */
  @EventListener
  @Async
  public void handlePerformanceMetricsUpdate(
      MarketIntelligenceWriteService.WriteOperationEvent event) {
    if (!isPerformanceMetricsRelatedEvent(event.getOperation())) {
      return;
    }

    try {
      totalEventsProcessed.incrementAndGet();
      cacheInvalidationEvents.incrementAndGet();

      String shopDomain = event.getShopDomain();
      String operation = event.getOperation();

      logger.debug(
          "Processing performance metrics update event: {} for shop: {} (Operation ID: {})",
          operation,
          shopDomain,
          event.getOperationId());

      // Invalidate performance metrics cache
      cacheService.invalidateCache("mi:performance:" + shopDomain);
      logger.debug("Invalidated performance metrics cache for shop: {}", shopDomain);

      successfulInvalidations.incrementAndGet();
      logger.info(
          "Successfully processed performance metrics update event for shop: {} (Operation: {})",
          shopDomain,
          event.getOperationId());

    } catch (Exception e) {
      failedInvalidations.incrementAndGet();
      logger.error(
          "Failed to process performance metrics update event for shop: {} (Operation: {}): {}",
          event.getShopDomain(),
          event.getOperationId(),
          e.getMessage(),
          e);
    }
  }

  // =====================================
  // EVENT TYPE CLASSIFICATION
  // =====================================

  /** Check if event is competitor-related */
  private boolean isCompetitorRelatedEvent(String operation) {
    return operation != null
        && (operation.contains("competitor")
            || operation.equals("competitor_update")
            || operation.equals("competitor_added")
            || operation.equals("competitor_removed"));
  }

  /** Check if event is price-related */
  private boolean isPriceRelatedEvent(String operation) {
    return operation != null
        && (operation.contains("price")
            || operation.equals("price_update")
            || operation.equals("price_scraping"));
  }

  /** Check if event is cost-related */
  private boolean isCostRelatedEvent(String operation) {
    return operation != null
        && (operation.contains("cost")
            || operation.equals("cost_update")
            || operation.equals("cost_tracking"));
  }

  /** Check if event is system status related */
  private boolean isSystemStatusRelatedEvent(String operation) {
    return operation != null
        && (operation.contains("system")
            || operation.contains("status")
            || operation.equals("system_status_update"));
  }

  /** Check if event is performance metrics related */
  private boolean isPerformanceMetricsRelatedEvent(String operation) {
    return operation != null
        && (operation.contains("performance")
            || operation.contains("metrics")
            || operation.equals("performance_metrics_update"));
  }

  // =====================================
  // MASS INVALIDATION OPERATIONS
  // =====================================

  /**
   * Invalidate all caches for a specific shop Used during major data changes or shop configuration
   * updates
   */
  public CompletableFuture<Void> invalidateAllShopCaches(String shopDomain, String reason) {
    return CompletableFuture.runAsync(
        () -> {
          try {
            logger.info(
                "Starting mass cache invalidation for shop: {} - Reason: {}", shopDomain, reason);

            cacheService.invalidateShopCache(shopDomain);

            cacheInvalidationEvents.incrementAndGet();
            successfulInvalidations.incrementAndGet();

            logger.info("Completed mass cache invalidation for shop: {}", shopDomain);

          } catch (Exception e) {
            failedInvalidations.incrementAndGet();
            logger.error(
                "Failed to invalidate all caches for shop: {} - {}", shopDomain, e.getMessage(), e);
            throw new RuntimeException("Mass cache invalidation failed", e);
          }
        });
  }

  /** Invalidate discovery-related caches Used when discovery settings or algorithms change */
  public CompletableFuture<Void> invalidateDiscoveryCaches(String shopDomain, String reason) {
    return CompletableFuture.runAsync(
        () -> {
          try {
            logger.info(
                "Invalidating discovery caches for shop: {} - Reason: {}", shopDomain, reason);

            // Invalidate discovery-specific caches
            cacheService.invalidateCache("mi:discovery_stats:" + shopDomain);
            cacheService.invalidateCache("mi:competitor_data:" + shopDomain);
            cacheService.invalidateCache("mi:dashboard:" + shopDomain);

            cacheInvalidationEvents.incrementAndGet();
            successfulInvalidations.incrementAndGet();

            logger.info("Completed discovery cache invalidation for shop: {}", shopDomain);

          } catch (Exception e) {
            failedInvalidations.incrementAndGet();
            logger.error(
                "Failed to invalidate discovery caches for shop: {} - {}",
                shopDomain,
                e.getMessage(),
                e);
            throw new RuntimeException("Discovery cache invalidation failed", e);
          }
        });
  }

  // =====================================
  // MONITORING AND STATISTICS
  // =====================================

  /** Get event processing statistics */
  public java.util.Map<String, Object> getEventStatistics() {
    java.util.Map<String, Object> stats = new java.util.HashMap<>();

    stats.put("totalEventsProcessed", totalEventsProcessed.get());
    stats.put("cacheInvalidationEvents", cacheInvalidationEvents.get());
    stats.put("successfulInvalidations", successfulInvalidations.get());
    stats.put("failedInvalidations", failedInvalidations.get());

    // Calculate success rate
    long total = successfulInvalidations.get() + failedInvalidations.get();
    double successRate = total > 0 ? (double) successfulInvalidations.get() / total * 100 : 100.0;
    stats.put("invalidationSuccessRate", String.format("%.2f%%", successRate));

    // Event processing rate
    double processingRate = totalEventsProcessed.get() / 60.0; // events per minute (rough estimate)
    stats.put("eventsPerMinute", String.format("%.2f", processingRate));

    stats.put("lastProcessedAt", LocalDateTime.now().toString());

    return stats;
  }

  /** Reset event processing statistics */
  public void resetEventStatistics() {
    totalEventsProcessed.set(0);
    cacheInvalidationEvents.set(0);
    successfulInvalidations.set(0);
    failedInvalidations.set(0);
    logger.info("Event processing statistics reset");
  }

  /** Check if event processing is healthy */
  public boolean isEventProcessingHealthy() {
    long total = successfulInvalidations.get() + failedInvalidations.get();
    if (total == 0) {
      return true; // No events processed yet, consider healthy
    }

    double successRate = (double) successfulInvalidations.get() / total * 100;
    return successRate >= 95; // 95% success rate threshold
  }

  /** Get current event processing load */
  public String getEventProcessingLoad() {
    long eventsPerMinute = totalEventsProcessed.get() / 60; // Rough calculation

    if (eventsPerMinute < 10) {
      return "LOW";
    } else if (eventsPerMinute < 50) {
      return "MEDIUM";
    } else if (eventsPerMinute < 100) {
      return "HIGH";
    } else {
      return "CRITICAL";
    }
  }
}
