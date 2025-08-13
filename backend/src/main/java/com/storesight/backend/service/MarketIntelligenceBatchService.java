package com.storesight.backend.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Market Intelligence Batch Write Service
 *
 * <p>Implements efficient batch processing for write operations following the optimization strategy
 * from the DashboardCacheService. Optimized for 512MB memory constraints with intelligent batching
 * and cache invalidation.
 *
 * <p>Key Features: - Memory profile-aware batch sizing - Write-through cache invalidation - Cost
 * optimization integration - Performance monitoring - Graceful degradation under memory pressure
 */
@Service
public class MarketIntelligenceBatchService {

  private static final Logger logger =
      LoggerFactory.getLogger(MarketIntelligenceBatchService.class);

  // Batch operation types
  public enum OperationType {
    COMPETITOR_DISCOVERY("competitor_discovery"),
    PRICE_UPDATE("price_update"),
    COST_TRACKING("cost_tracking"),
    SYSTEM_STATUS_UPDATE("system_status_update"),
    PERFORMANCE_METRICS("performance_metrics");

    private final String value;

    OperationType(String value) {
      this.value = value;
    }

    public String getValue() {
      return value;
    }
  }

  // Batch operation item
  public static class BatchItem {
    private final OperationType type;
    private final String shopDomain;
    private final Object data;
    private final LocalDateTime timestamp;
    private final String operationId;

    public BatchItem(OperationType type, String shopDomain, Object data, String operationId) {
      this.type = type;
      this.shopDomain = shopDomain;
      this.data = data;
      this.operationId = operationId;
      this.timestamp = LocalDateTime.now();
    }

    // Getters
    public OperationType getType() {
      return type;
    }

    public String getShopDomain() {
      return shopDomain;
    }

    public Object getData() {
      return data;
    }

    public LocalDateTime getTimestamp() {
      return timestamp;
    }

    public String getOperationId() {
      return operationId;
    }
  }

  // Services
  private final MarketIntelligenceCacheService cacheService;
  private final CostOptimizationService costOptimizationService;

  // Batch queues by operation type
  private final Map<OperationType, List<BatchItem>> batchQueues = new ConcurrentHashMap<>();

  // Statistics tracking
  private final AtomicLong totalBatchedOperations = new AtomicLong(0);
  private final AtomicLong successfulBatches = new AtomicLong(0);
  private final AtomicLong failedBatches = new AtomicLong(0);
  private final AtomicInteger currentQueueSize = new AtomicInteger(0);

  // Memory profile configuration
  @Value("${storesight.memory.profile:512MB}")
  private String memoryProfile;

  @Value("${storesight.batch.processing.enabled:true}")
  private boolean batchProcessingEnabled;

  @Value("${storesight.batch.cost.tracking.enabled:true}")
  private boolean costTrackingEnabled;

  public MarketIntelligenceBatchService(
      MarketIntelligenceCacheService cacheService,
      CostOptimizationService costOptimizationService) {
    this.cacheService = cacheService;
    this.costOptimizationService = costOptimizationService;

    // Initialize batch queues
    for (OperationType type : OperationType.values()) {
      batchQueues.put(type, new ArrayList<>());
    }

    logger.info(
        "MarketIntelligenceBatchService initialized with memory profile: {}", memoryProfile);
  }

  // =====================================
  // BATCH PROCESSING SCHEDULER
  // =====================================

  /**
   * Main batch processing method - 512MB optimized intervals Runs every 10 minutes for 512MB
   * profile to reduce memory pressure
   */
  @Scheduled(fixedRate = 600000) // Every 10 minutes (512MB optimized)
  public void processBatches() {
    if (!batchProcessingEnabled) {
      logger.debug("Batch processing is disabled, skipping batch run");
      return;
    }

    if (!"512MB".equals(memoryProfile) || isMemoryAvailable()) {
      logger.info("Starting batch processing cycle - Memory Profile: {}", memoryProfile);

      try {
        // Process all operation types in parallel for efficiency
        CompletableFuture<Void> discoveryFuture =
            CompletableFuture.runAsync(this::processCompetitorDiscoveryBatch);
        CompletableFuture<Void> priceUpdateFuture =
            CompletableFuture.runAsync(this::processPriceUpdateBatch);
        CompletableFuture<Void> costTrackingFuture =
            CompletableFuture.runAsync(this::processCostTrackingBatch);
        CompletableFuture<Void> systemStatusFuture =
            CompletableFuture.runAsync(this::processSystemStatusBatch);
        CompletableFuture<Void> performanceFuture =
            CompletableFuture.runAsync(this::processPerformanceMetricsBatch);

        // Wait for all batches to complete
        CompletableFuture.allOf(
                discoveryFuture,
                priceUpdateFuture,
                costTrackingFuture,
                systemStatusFuture,
                performanceFuture)
            .join();

        logger.info("Batch processing cycle completed successfully");
        successfulBatches.incrementAndGet();

      } catch (Exception e) {
        logger.error("Error during batch processing cycle: {}", e.getMessage(), e);
        failedBatches.incrementAndGet();
      }
    } else {
      logger.warn("Skipping batch processing due to memory pressure (512MB profile)");
    }
  }

  /** Check if memory is available for batch processing */
  private boolean isMemoryAvailable() {
    if (!"512MB".equals(memoryProfile)) {
      return true; // No restrictions for larger memory profiles
    }

    // For 512MB profile, check current memory usage
    Runtime runtime = Runtime.getRuntime();
    long usedMemory = runtime.totalMemory() - runtime.freeMemory();
    long maxMemory = runtime.maxMemory();
    double memoryUsagePercent = (double) usedMemory / maxMemory * 100;

    boolean memoryAvailable = memoryUsagePercent < 80; // Conservative 80% threshold

    if (!memoryAvailable) {
      logger.warn("Memory usage too high: {:.2f}% - skipping batch processing", memoryUsagePercent);
    }

    return memoryAvailable;
  }

  // =====================================
  // BATCH OPERATION PROCESSORS
  // =====================================

  /** Process competitor discovery batch operations */
  private void processCompetitorDiscoveryBatch() {
    List<BatchItem> items = getBatchItems(OperationType.COMPETITOR_DISCOVERY);
    if (items.isEmpty()) {
      return;
    }

    logger.info("Processing {} competitor discovery operations", items.size());

    try {
      for (BatchItem item : items) {
        // Process competitor discovery
        processCompetitorDiscoveryItem(item);

        // Invalidate related caches
        cacheService.invalidateRelatedCaches("competitor_added", item.getShopDomain());
      }

      logger.info("Successfully processed {} competitor discovery operations", items.size());
    } catch (Exception e) {
      logger.error("Error processing competitor discovery batch: {}", e.getMessage(), e);
    }
  }

  /** Process price update batch operations */
  private void processPriceUpdateBatch() {
    List<BatchItem> items = getBatchItems(OperationType.PRICE_UPDATE);
    if (items.isEmpty()) {
      return;
    }

    logger.info("Processing {} price update operations", items.size());

    try {
      for (BatchItem item : items) {
        // Process price update
        processPriceUpdateItem(item);

        // Invalidate related caches
        cacheService.invalidateRelatedCaches("price_scraping", item.getShopDomain());
      }

      logger.info("Successfully processed {} price update operations", items.size());
    } catch (Exception e) {
      logger.error("Error processing price update batch: {}", e.getMessage(), e);
    }
  }

  /** Process cost tracking batch operations */
  private void processCostTrackingBatch() {
    if (!costTrackingEnabled) {
      return;
    }

    List<BatchItem> items = getBatchItems(OperationType.COST_TRACKING);
    if (items.isEmpty()) {
      return;
    }

    logger.info("Processing {} cost tracking operations", items.size());

    try {
      for (BatchItem item : items) {
        // Process cost tracking using existing CostOptimizationService
        processCostTrackingItem(item);

        // Cache cost tracking doesn't need invalidation as it's append-only
        // Just invalidate dashboard to show updated costs
        cacheService.invalidateRelatedCaches("cost_tracking", item.getShopDomain());
      }

      logger.info("Successfully processed {} cost tracking operations", items.size());
    } catch (Exception e) {
      logger.error("Error processing cost tracking batch: {}", e.getMessage(), e);
    }
  }

  /** Process system status batch operations */
  private void processSystemStatusBatch() {
    List<BatchItem> items = getBatchItems(OperationType.SYSTEM_STATUS_UPDATE);
    if (items.isEmpty()) {
      return;
    }

    logger.info("Processing {} system status operations", items.size());

    try {
      for (BatchItem item : items) {
        // Process system status update
        processSystemStatusItem(item);

        // Invalidate system status and dashboard caches
        cacheService.invalidateRelatedCaches("system_status_change", item.getShopDomain());
      }

      logger.info("Successfully processed {} system status operations", items.size());
    } catch (Exception e) {
      logger.error("Error processing system status batch: {}", e.getMessage(), e);
    }
  }

  /** Process performance metrics batch operations */
  private void processPerformanceMetricsBatch() {
    List<BatchItem> items = getBatchItems(OperationType.PERFORMANCE_METRICS);
    if (items.isEmpty()) {
      return;
    }

    logger.info("Processing {} performance metrics operations", items.size());

    try {
      for (BatchItem item : items) {
        // Process performance metrics
        processPerformanceMetricsItem(item);

        // Invalidate performance metrics cache
        cacheService.invalidateRelatedCaches("performance_update", item.getShopDomain());
      }

      logger.info("Successfully processed {} performance metrics operations", items.size());
    } catch (Exception e) {
      logger.error("Error processing performance metrics batch: {}", e.getMessage(), e);
    }
  }

  // =====================================
  // INDIVIDUAL ITEM PROCESSORS
  // =====================================

  /** Process individual competitor discovery item */
  private void processCompetitorDiscoveryItem(BatchItem item) {
    try {
      // Implementation would call actual competitor discovery service
      logger.debug(
          "Processing competitor discovery for shop: {} with operation ID: {}",
          item.getShopDomain(),
          item.getOperationId());

      // Track cost if enabled
      if (costTrackingEnabled) {
        costOptimizationService.trackApiCost(
            "competitor_discovery", BigDecimal.valueOf(0.01), 1); // Example cost
      }

    } catch (Exception e) {
      logger.error(
          "Error processing competitor discovery item for shop {}: {}",
          item.getShopDomain(),
          e.getMessage());
    }
  }

  /** Process individual price update item */
  private void processPriceUpdateItem(BatchItem item) {
    try {
      // Implementation would call actual price update service
      logger.debug(
          "Processing price update for shop: {} with operation ID: {}",
          item.getShopDomain(),
          item.getOperationId());

      // Track cost if enabled
      if (costTrackingEnabled) {
        costOptimizationService.trackApiCost(
            "price_scraping", BigDecimal.valueOf(0.02), 1); // Example cost
      }

    } catch (Exception e) {
      logger.error(
          "Error processing price update item for shop {}: {}",
          item.getShopDomain(),
          e.getMessage());
    }
  }

  /** Process individual cost tracking item */
  private void processCostTrackingItem(BatchItem item) {
    try {
      // Use existing CostOptimizationService for cost tracking
      @SuppressWarnings("unchecked")
      Map<String, Object> costData = (Map<String, Object>) item.getData();

      if (costData.containsKey("apiProvider") && costData.containsKey("cost")) {
        String apiProvider = (String) costData.get("apiProvider");
        Double cost = (Double) costData.get("cost");
        costOptimizationService.trackApiCost(apiProvider, BigDecimal.valueOf(cost), 1);
      }

      logger.debug(
          "Processing cost tracking for shop: {} with operation ID: {}",
          item.getShopDomain(),
          item.getOperationId());

    } catch (Exception e) {
      logger.error(
          "Error processing cost tracking item for shop {}: {}",
          item.getShopDomain(),
          e.getMessage());
    }
  }

  /** Process individual system status item */
  private void processSystemStatusItem(BatchItem item) {
    try {
      // Implementation would update system status
      logger.debug(
          "Processing system status update for shop: {} with operation ID: {}",
          item.getShopDomain(),
          item.getOperationId());

    } catch (Exception e) {
      logger.error(
          "Error processing system status item for shop {}: {}",
          item.getShopDomain(),
          e.getMessage());
    }
  }

  /** Process individual performance metrics item */
  private void processPerformanceMetricsItem(BatchItem item) {
    try {
      // Implementation would update performance metrics
      logger.debug(
          "Processing performance metrics for shop: {} with operation ID: {}",
          item.getShopDomain(),
          item.getOperationId());

    } catch (Exception e) {
      logger.error(
          "Error processing performance metrics item for shop {}: {}",
          item.getShopDomain(),
          e.getMessage());
    }
  }

  // =====================================
  // BATCH QUEUE MANAGEMENT
  // =====================================

  /** Add item to batch queue */
  public void addToBatch(OperationType type, String shopDomain, Object data, String operationId) {
    try {
      BatchItem item = new BatchItem(type, shopDomain, data, operationId);

      synchronized (batchQueues) {
        List<BatchItem> queue = batchQueues.get(type);
        queue.add(item);
        currentQueueSize.incrementAndGet();
        totalBatchedOperations.incrementAndGet();
      }

      logger.debug(
          "Added {} operation to batch queue for shop: {} (Queue size: {})",
          type.getValue(),
          shopDomain,
          currentQueueSize.get());

      // If queue is getting large for 512MB profile, trigger immediate processing
      if ("512MB".equals(memoryProfile) && currentQueueSize.get() > getBatchSizeThreshold()) {
        logger.info(
            "Queue size threshold reached ({}), triggering immediate batch processing",
            currentQueueSize.get());
        CompletableFuture.runAsync(this::processBatches);
      }

    } catch (Exception e) {
      logger.error("Error adding item to batch queue: {}", e.getMessage(), e);
    }
  }

  /** Get batch items for processing and clear the queue */
  private List<BatchItem> getBatchItems(OperationType type) {
    synchronized (batchQueues) {
      List<BatchItem> queue = batchQueues.get(type);
      List<BatchItem> items = new ArrayList<>(queue);
      queue.clear();
      currentQueueSize.addAndGet(-items.size());
      return items;
    }
  }

  /** Get batch size threshold based on memory profile */
  private int getBatchSizeThreshold() {
    return switch (memoryProfile) {
      case "512MB" -> 50; // Conservative for 512MB
      case "1GB" -> 200; // Moderate for 1GB
      case "2GB" -> 500; // Aggressive for 2GB+
      default -> 100; // Default
    };
  }

  /** Get current batch size for an operation type */
  public int getBatchSize(OperationType type) {
    return switch (memoryProfile) {
      case "512MB" -> 10; // Small batches for 512MB
      case "1GB" -> 25; // Medium batches for 1GB
      case "2GB" -> 50; // Large batches for 2GB+
      default -> 20; // Default
    };
  }

  // =====================================
  // MONITORING AND STATISTICS
  // =====================================

  /** Get batch processing statistics */
  public Map<String, Object> getBatchStatistics() {
    Map<String, Object> stats = new ConcurrentHashMap<>();

    stats.put("memoryProfile", memoryProfile);
    stats.put("batchProcessingEnabled", batchProcessingEnabled);
    stats.put("costTrackingEnabled", costTrackingEnabled);
    stats.put("totalBatchedOperations", totalBatchedOperations.get());
    stats.put("successfulBatches", successfulBatches.get());
    stats.put("failedBatches", failedBatches.get());
    stats.put("currentQueueSize", currentQueueSize.get());
    stats.put("batchSizeThreshold", getBatchSizeThreshold());

    // Queue sizes by operation type
    Map<String, Integer> queueSizes = new ConcurrentHashMap<>();
    for (OperationType type : OperationType.values()) {
      queueSizes.put(type.getValue(), batchQueues.get(type).size());
    }
    stats.put("queueSizes", queueSizes);

    // Memory statistics
    Runtime runtime = Runtime.getRuntime();
    long usedMemory = runtime.totalMemory() - runtime.freeMemory();
    long maxMemory = runtime.maxMemory();
    double memoryUsagePercent = (double) usedMemory / maxMemory * 100;

    Map<String, Object> memoryStats = new ConcurrentHashMap<>();
    memoryStats.put("usedMemoryMB", usedMemory / (1024 * 1024));
    memoryStats.put("maxMemoryMB", maxMemory / (1024 * 1024));
    memoryStats.put("memoryUsagePercent", String.format("%.2f%%", memoryUsagePercent));
    memoryStats.put("memoryAvailable", isMemoryAvailable());

    stats.put("memoryStatistics", memoryStats);

    return stats;
  }

  /** Reset batch statistics */
  public void resetBatchStatistics() {
    totalBatchedOperations.set(0);
    successfulBatches.set(0);
    failedBatches.set(0);
    logger.info("Batch processing statistics reset");
  }

  /** Clear all batch queues (use with caution) */
  public void clearAllBatchQueues() {
    synchronized (batchQueues) {
      int totalCleared = 0;
      for (OperationType type : OperationType.values()) {
        List<BatchItem> queue = batchQueues.get(type);
        totalCleared += queue.size();
        queue.clear();
      }
      currentQueueSize.set(0);
      logger.warn("Cleared all batch queues - {} items removed", totalCleared);
    }
  }

  /** Get queue size for specific operation type */
  public int getQueueSize(OperationType type) {
    return batchQueues.get(type).size();
  }

  /** Check if batch processing is healthy */
  public boolean isBatchProcessingHealthy() {
    // Health check criteria
    boolean memoryHealthy = isMemoryAvailable();
    boolean queueSizeHealthy = currentQueueSize.get() < (getBatchSizeThreshold() * 2);
    long successRate =
        totalBatchedOperations.get() > 0
            ? (successfulBatches.get() * 100) / (successfulBatches.get() + failedBatches.get())
            : 100;
    boolean successRateHealthy = successRate >= 90;

    return memoryHealthy && queueSizeHealthy && successRateHealthy;
  }
}
