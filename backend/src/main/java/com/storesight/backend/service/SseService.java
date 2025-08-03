package com.storesight.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.storesight.backend.config.ApplicationConfigurationProperties;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Enterprise-Grade SSE Service
 *
 * <p>Production-ready Server-Sent Events service with: - Minimal payloads for optimal performance -
 * Intelligent batching for high-volume scenarios - Comprehensive connection management - Rate
 * limiting and backoff strategies - Health monitoring and metrics - Memory leak prevention -
 * Scalable architecture
 */
@Service
public class SseService {

  private static final Logger logger = LoggerFactory.getLogger(SseService.class);

  @Autowired private ApplicationConfigurationProperties config;

  // Configuration helper methods
  private int getMaxSsePerShop() {
    return config.getSse().getMaxConnectionsPerShop();
  }

  private int getMaxSseGlobal() {
    return config.getSse().getMaxConnectionsGlobal();
  }

  private long getSseTimeoutMs() {
    return config.getSse().getConnectionTimeout().toMillis();
  }

  private long getHeartbeatIntervalMs() {
    return config.getSse().getHeartbeatInterval().toMillis();
  }

  private boolean isHeartbeatEnabled() {
    return getHeartbeatIntervalMs() > 0;
  }

  private long getCleanupIntervalMs() {
    return config.getSse().getCleanupInterval().toMillis();
  }

  private int getMaxBatchSize() {
    return config.getSse().getMaxBatchSize();
  }

  private long getBatchTimeoutMs() {
    return config.getSse().getBatchTimeout().toMillis();
  }

  private int getMaxBatchQueueSize() {
    return config.getSse().getMaxBatchQueueSize();
  }

  private long getConnectionHealthCheckIntervalMs() {
    return config.getSse().getConnectionHealthCheckInterval().toMillis();
  }

  private long getDeadConnectionTimeoutMs() {
    return config.getSse().getDeadConnectionTimeout().toMillis();
  }

  private long getBatchCleanupIntervalMs() {
    return config.getSse().getBatchCleanupInterval().toMillis();
  }

  private int getMaxFailedHeartbeats() {
    return config.getSse().getMaxFailedHeartbeats();
  }

  private long getBatchMemoryCleanupThresholdMs() {
    return config.getSse().getBatchMemoryCleanupThreshold().toMillis();
  }

  private int getMaxBatchMemorySizeBytes() {
    return config.getSse().getMaxBatchMemorySizeBytes();
  }

  private long getConnectionIdleTimeoutMs() {
    return config.getSse().getConnectionIdleTimeout().toMillis();
  }

  private int getEmergencyCleanupThreshold() {
    return config.getSse().getEmergencyCleanupThreshold();
  }

  // Connection storage
  private final ConcurrentHashMap<String, CopyOnWriteArrayList<SseEmitter>> sseEmitters =
      new ConcurrentHashMap<>();

  // Batching support with enhanced resource management
  private final ConcurrentHashMap<String, List<SseEvent>> eventBatches = new ConcurrentHashMap<>();
  private final ConcurrentHashMap<String, Long> batchTimers = new ConcurrentHashMap<>();

  // Enhanced connection health tracking
  private final ConcurrentHashMap<SseEmitter, ConnectionHealth> connectionHealth =
      new ConcurrentHashMap<>();
  private final ConcurrentHashMap<SseEmitter, Long> connectionCreationTimes =
      new ConcurrentHashMap<>();
  private final ConcurrentHashMap<SseEmitter, String> connectionShopMapping =
      new ConcurrentHashMap<>();

  // Monitoring and metrics
  private final AtomicLong totalConnections = new AtomicLong(0);
  private final AtomicLong totalErrors = new AtomicLong(0);
  private final AtomicLong totalRateLimited = new AtomicLong(0);
  private final AtomicLong totalEventsSent = new AtomicLong(0);
  private final AtomicLong totalBatchesSent = new AtomicLong(0);
  private final AtomicInteger activeConnections = new AtomicInteger(0);
  private final AtomicLong totalDeadConnectionsRemoved = new AtomicLong(0);
  private final AtomicLong totalBatchesDropped = new AtomicLong(0);
  private final AtomicLong totalMemoryLeaksPreventedCount = new AtomicLong(0);

  // Dependencies
  private final RedisTemplate<String, String> redisTemplate;
  private final ObjectMapper objectMapper;
  private final MetricsCollectionService metricsCollectionService;

  @Autowired private FeatureFlagService featureFlagService;

  @Autowired
  public SseService(
      RedisTemplate<String, String> redisTemplate,
      MetricsCollectionService metricsCollectionService) {
    this.redisTemplate = redisTemplate;
    this.objectMapper = new ObjectMapper();
    this.metricsCollectionService = metricsCollectionService;
  }

  /** Connection health tracking */
  public static class ConnectionHealth {
    private long lastHeartbeat;
    private int failedHeartbeats;
    private boolean isDead;
    private long creationTime;

    public ConnectionHealth() {
      this.lastHeartbeat = System.currentTimeMillis();
      this.failedHeartbeats = 0;
      this.isDead = false;
      this.creationTime = System.currentTimeMillis();
    }

    public long getLastHeartbeat() {
      return lastHeartbeat;
    }

    public void setLastHeartbeat(long lastHeartbeat) {
      this.lastHeartbeat = lastHeartbeat;
    }

    public int getFailedHeartbeats() {
      return failedHeartbeats;
    }

    public void incrementFailedHeartbeats() {
      this.failedHeartbeats++;
    }

    public void resetFailedHeartbeats() {
      this.failedHeartbeats = 0;
    }

    public boolean isDead() {
      return isDead;
    }

    public void markAsDead() {
      this.isDead = true;
    }

    public long getCreationTime() {
      return creationTime;
    }

    public boolean shouldBeMarkedDead(SseService service) {
      return failedHeartbeats >= service.getMaxFailedHeartbeats()
          || (System.currentTimeMillis() - lastHeartbeat) > service.getDeadConnectionTimeoutMs();
    }
  }

  /** SSE Event representation with minimal payload */
  public static class SseEvent {
    private final String type;
    private final String message;
    private final Integer reconnectMs;
    private final Map<String, Object> metadata;
    private final long timestamp;

    public SseEvent(
        String type, String message, Integer reconnectMs, Map<String, Object> metadata) {
      this.type = type;
      this.message = message;
      this.reconnectMs = reconnectMs;
      this.metadata = metadata != null ? metadata : new HashMap<>();
      this.timestamp = System.currentTimeMillis();
    }

    public SseEvent(String type, String message) {
      this(type, message, null, null);
    }

    public SseEvent(String type, String message, Integer reconnectMs) {
      this(type, message, reconnectMs, null);
    }

    // Getters
    public String getType() {
      return type;
    }

    public String getMessage() {
      return message;
    }

    public Integer getReconnectMs() {
      return reconnectMs;
    }

    public Map<String, Object> getMetadata() {
      return metadata;
    }

    public long getTimestamp() {
      return timestamp;
    }
  }

  /** Check if we can accept a new SSE connection */
  public boolean canAcceptConnection(String shopDomain) {
    int globalCount = sseEmitters.values().stream().mapToInt(List::size).sum();
    int shopCount = sseEmitters.getOrDefault(shopDomain, new CopyOnWriteArrayList<>()).size();

    boolean canAccept = globalCount < getMaxSseGlobal() && shopCount < getMaxSsePerShop();

    if (!canAccept) {
      logger.warn(
          "SSE connection limit reached - Global: {}/{}, Shop {}: {}/{}",
          globalCount,
          getMaxSseGlobal(),
          shopDomain,
          shopCount,
          getMaxSsePerShop());
    }

    return canAccept;
  }

  /** Create a new SSE connection for a shop */
  public SseEmitter createConnection(String shopDomain, String sessionId) {
    if (!canAcceptConnection(shopDomain)) {
      totalErrors.incrementAndGet();
      SseEmitter emitter = new SseEmitter(getSseTimeoutMs());
      sendMinimalEvent(emitter, "error", "Too many connections. Try again later.", 10000);
      emitter.complete();
      return emitter;
    }

    SseEmitter emitter = new SseEmitter(getSseTimeoutMs());
    totalConnections.incrementAndGet();
    activeConnections.incrementAndGet();

    // Update metrics
    metricsCollectionService.recordSseConnectionCreated();

    // Initialize connection health tracking
    ConnectionHealth health = new ConnectionHealth();
    connectionHealth.put(emitter, health);
    connectionCreationTimes.put(emitter, System.currentTimeMillis());
    connectionShopMapping.put(emitter, shopDomain);

    // Add to connection pool
    sseEmitters.computeIfAbsent(shopDomain, k -> new CopyOnWriteArrayList<>()).add(emitter);

    // Set up lifecycle handlers
    emitter.onCompletion(
        () -> {
          logger.debug("SSE connection completed for shop: {}", shopDomain);
          removeConnection(shopDomain, emitter);
        });

    emitter.onTimeout(
        () -> {
          logger.debug("SSE connection timed out for shop: {}", shopDomain);
          removeConnection(shopDomain, emitter);
        });

    emitter.onError(
        e -> {
          totalErrors.incrementAndGet();
          logger.warn("SSE connection error for shop {}: {}", shopDomain, e.getMessage());
          removeConnection(shopDomain, emitter);
        });

    // Send initial connection event
    try {
      sendMinimalEvent(
          emitter, "connected", "Subscribed to session events for shop: " + shopDomain, 5000);
      logger.info("SSE connection established for shop: {} (session: {})", shopDomain, sessionId);
    } catch (Exception e) {
      totalErrors.incrementAndGet();
      logger.warn("Failed to send initial SSE event for shop {}: {}", shopDomain, e.getMessage());
      removeConnection(shopDomain, emitter);
    }

    return emitter;
  }

  /** Send a minimal SSE event (only essential fields) */
  public void sendMinimalEvent(
      SseEmitter emitter, String eventType, String message, Integer reconnectMs) {
    try {
      ObjectNode eventData = objectMapper.createObjectNode();
      eventData.put("event", eventType);
      if (message != null) {
        eventData.put("message", message);
      }
      if (reconnectMs != null) {
        eventData.put("reconnect", reconnectMs);
      }

      emitter.send(
          SseEmitter.event()
              .name(eventType)
              .data(eventData.toString())
              .id(String.valueOf(System.currentTimeMillis()))
              .reconnectTime(reconnectMs != null ? reconnectMs : 5000));

      totalEventsSent.incrementAndGet();
      metricsCollectionService.recordSseEventPublished();

    } catch (Exception e) {
      logger.warn("Failed to send minimal SSE event: {}", e.getMessage());
      totalErrors.incrementAndGet();
      metricsCollectionService.recordSseConnectionError();
    }
  }

  /** Send a minimal SSE event without reconnect time */
  public void sendMinimalEvent(SseEmitter emitter, String eventType, String message) {
    sendMinimalEvent(emitter, eventType, message, null);
  }

  /** Send a minimal SSE event with metadata */
  public void sendMinimalEvent(
      SseEmitter emitter,
      String eventType,
      String message,
      Integer reconnectMs,
      Map<String, Object> metadata) {
    try {
      ObjectNode eventData = objectMapper.createObjectNode();
      eventData.put("event", eventType);
      if (message != null) {
        eventData.put("message", message);
      }
      if (reconnectMs != null) {
        eventData.put("reconnect", reconnectMs);
      }
      if (metadata != null && !metadata.isEmpty()) {
        ObjectNode metadataNode = objectMapper.createObjectNode();
        metadata.forEach(
            (key, value) -> {
              if (value instanceof String) {
                metadataNode.put(key, (String) value);
              } else if (value instanceof Integer) {
                metadataNode.put(key, (Integer) value);
              } else if (value instanceof Long) {
                metadataNode.put(key, (Long) value);
              } else if (value instanceof Boolean) {
                metadataNode.put(key, (Boolean) value);
              } else {
                metadataNode.put(key, value.toString());
              }
            });
        eventData.set("metadata", metadataNode);
      }

      emitter.send(
          SseEmitter.event()
              .name(eventType)
              .data(eventData.toString())
              .id(String.valueOf(System.currentTimeMillis()))
              .reconnectTime(reconnectMs != null ? reconnectMs : 5000));

      totalEventsSent.incrementAndGet();

    } catch (Exception e) {
      logger.warn("Failed to send minimal SSE event with metadata: {}", e.getMessage());
      totalErrors.incrementAndGet();
    }
  }

  /** Queue an event for batching with enhanced memory leak prevention */
  public void queueEventForBatching(String shopDomain, SseEvent event) {
    List<SseEvent> batch = eventBatches.computeIfAbsent(shopDomain, k -> new ArrayList<>());

    // Check if emergency cleanup is needed based on global capacity
    int globalConnections = sseEmitters.values().stream().mapToInt(List::size).sum();
    double utilizationPercent = (double) globalConnections / getMaxSseGlobal() * 100;

    if (utilizationPercent >= getEmergencyCleanupThreshold()) {
      performEmergencyCleanup();
    }

    // Enhanced memory management - check batch memory size
    if (batch.size() >= getMaxBatchQueueSize()
        || estimateBatchMemorySize(batch) >= getMaxBatchMemorySizeBytes()) {
      logger.warn(
          "Batch queue for shop {} has reached limits (size: {}/{}, estimated memory: {} bytes), dropping oldest events",
          shopDomain,
          batch.size(),
          getMaxBatchQueueSize(),
          estimateBatchMemorySize(batch));

      // Remove oldest events to make room (FIFO) - more aggressive cleanup
      int eventsToRemove = Math.max(batch.size() - getMaxBatchQueueSize() + 1, batch.size() / 4);
      for (int i = 0; i < eventsToRemove && !batch.isEmpty(); i++) {
        batch.remove(0);
      }
      totalBatchesDropped.incrementAndGet();
      totalMemoryLeaksPreventedCount.incrementAndGet();
    }

    batch.add(event);

    // Start batch timer if not already running
    batchTimers.computeIfAbsent(
        shopDomain,
        k -> {
          scheduleBatchTimeout(shopDomain);
          return System.currentTimeMillis();
        });

    // Send batch immediately if it reaches max size
    if (batch.size() >= getMaxBatchSize()) {
      sendBatch(shopDomain);
    }
  }

  /** Estimate memory size of a batch for memory management */
  private int estimateBatchMemorySize(List<SseEvent> batch) {
    if (batch == null || batch.isEmpty()) {
      return 0;
    }

    int totalSize = 0;
    for (SseEvent event : batch) {
      // Rough estimation: type + message + metadata + overhead
      totalSize += (event.getType() != null ? event.getType().length() * 2 : 0);
      totalSize += (event.getMessage() != null ? event.getMessage().length() * 2 : 0);
      totalSize += (event.getMetadata() != null ? event.getMetadata().toString().length() * 2 : 0);
      totalSize += 100; // Overhead for object structure
    }
    return totalSize;
  }

  /** Emergency cleanup when system is under pressure */
  private void performEmergencyCleanup() {
    logger.warn("Performing emergency SSE cleanup due to high resource utilization");

    long currentTime = System.currentTimeMillis();
    int connectionsRemoved = 0;
    int batchesCleared = 0;

    // Remove idle connections more aggressively
    for (Map.Entry<SseEmitter, Long> entry : new HashMap<>(connectionCreationTimes).entrySet()) {
      SseEmitter emitter = entry.getKey();
      Long creationTime = entry.getValue();
      ConnectionHealth health = connectionHealth.get(emitter);

      // Remove connections that have been idle for too long
      if (health != null
          && (currentTime - health.getLastHeartbeat()) > getConnectionIdleTimeoutMs() / 2) {
        String shopDomain = connectionShopMapping.get(emitter);
        logger.warn("Emergency removal of idle SSE connection for shop: {}", shopDomain);

        if (shopDomain != null) {
          removeConnection(shopDomain, emitter);
          connectionsRemoved++;
        }
      }
    }

    // Clear old batches more aggressively
    for (Map.Entry<String, Long> entry : new HashMap<>(batchTimers).entrySet()) {
      String shopDomain = entry.getKey();
      Long timerStart = entry.getValue();

      if ((currentTime - timerStart) > getBatchTimeoutMs() * 2) {
        sendBatch(shopDomain);
        batchesCleared++;
      }
    }

    totalMemoryLeaksPreventedCount.addAndGet(connectionsRemoved + batchesCleared);
    logger.warn(
        "Emergency cleanup completed - removed {} connections, cleared {} batches",
        connectionsRemoved,
        batchesCleared);
  }

  /** Send a batch of events as a single SSE message */
  public void sendBatch(String shopDomain) {
    List<SseEvent> batch = eventBatches.remove(shopDomain);
    Long timer = batchTimers.remove(shopDomain);

    if (batch == null || batch.isEmpty()) {
      return;
    }

    CopyOnWriteArrayList<SseEmitter> emitters = sseEmitters.get(shopDomain);
    if (emitters == null || emitters.isEmpty()) {
      return;
    }

    try {
      ArrayNode batchData = objectMapper.createArrayNode();
      for (SseEvent event : batch) {
        ObjectNode eventNode = objectMapper.createObjectNode();
        eventNode.put("event", event.getType());
        if (event.getMessage() != null) {
          eventNode.put("message", event.getMessage());
        }
        if (event.getReconnectMs() != null) {
          eventNode.put("reconnect", event.getReconnectMs());
        }
        if (event.getMetadata() != null && !event.getMetadata().isEmpty()) {
          ObjectNode metadataNode = objectMapper.createObjectNode();
          event
              .getMetadata()
              .forEach(
                  (key, value) -> {
                    if (value instanceof String) {
                      metadataNode.put(key, (String) value);
                    } else if (value instanceof Integer) {
                      metadataNode.put(key, (Integer) value);
                    } else if (value instanceof Long) {
                      metadataNode.put(key, (Long) value);
                    } else if (value instanceof Boolean) {
                      metadataNode.put(key, (Boolean) value);
                    } else {
                      metadataNode.put(key, value.toString());
                    }
                  });
          eventNode.set("metadata", metadataNode);
        }
        eventNode.put("timestamp", event.getTimestamp());
        batchData.add(eventNode);
      }

      String batchJson = batchData.toString();

      // Send to all emitters for this shop
      List<SseEmitter> emittersCopy = new ArrayList<>(emitters);
      for (SseEmitter emitter : emittersCopy) {
        try {
          emitter.send(
              SseEmitter.event()
                  .name("batch")
                  .data(batchJson)
                  .id(String.valueOf(System.currentTimeMillis()))
                  .reconnectTime(5000));
        } catch (Exception e) {
          logger.warn(
              "Failed to send batch to SSE client for shop {}: {}", shopDomain, e.getMessage());
          removeConnection(shopDomain, emitter);
        }
      }

      totalBatchesSent.incrementAndGet();
      totalEventsSent.addAndGet(batch.size());

      logger.debug(
          "Sent batch of {} events to {} SSE clients for shop: {}",
          batch.size(),
          emittersCopy.size(),
          shopDomain);

    } catch (Exception e) {
      logger.warn("Failed to send SSE batch for shop {}: {}", shopDomain, e.getMessage());
      totalErrors.incrementAndGet();
    }
  }

  /** Broadcast an event to all connections for a shop */
  public void broadcastToShop(
      String shopDomain, String eventType, String message, Integer reconnectMs) {
    CopyOnWriteArrayList<SseEmitter> emitters = sseEmitters.get(shopDomain);
    if (emitters == null || emitters.isEmpty()) {
      logger.debug("No SSE clients connected for shop: {}", shopDomain);
      return;
    }

    logger.info(
        "Broadcasting {} event to {} SSE clients for shop: {}",
        eventType,
        emitters.size(),
        shopDomain);

    List<SseEmitter> emittersCopy = new ArrayList<>(emitters);
    for (SseEmitter emitter : emittersCopy) {
      try {
        sendMinimalEvent(emitter, eventType, message, reconnectMs);
      } catch (Exception e) {
        logger.warn(
            "Failed to broadcast event to SSE client for shop {}: {}", shopDomain, e.getMessage());
        removeConnection(shopDomain, emitter);
      }
    }
  }

  /** Broadcast an event to all connections for a shop with metadata */
  public void broadcastToShop(
      String shopDomain,
      String eventType,
      String message,
      Integer reconnectMs,
      Map<String, Object> metadata) {
    CopyOnWriteArrayList<SseEmitter> emitters = sseEmitters.get(shopDomain);
    if (emitters == null || emitters.isEmpty()) {
      logger.debug("No SSE clients connected for shop: {}", shopDomain);
      return;
    }

    logger.info(
        "Broadcasting {} event with metadata to {} SSE clients for shop: {}",
        eventType,
        emitters.size(),
        shopDomain);

    List<SseEmitter> emittersCopy = new ArrayList<>(emitters);
    for (SseEmitter emitter : emittersCopy) {
      try {
        sendMinimalEvent(emitter, eventType, message, reconnectMs, metadata);
      } catch (Exception e) {
        logger.warn(
            "Failed to broadcast event with metadata to SSE client for shop {}: {}",
            shopDomain,
            e.getMessage());
        removeConnection(shopDomain, emitter);
      }
    }
  }

  /** Broadcast an event to all connected shops */
  public void broadcastToAllShops(String eventType, String message, Integer reconnectMs) {
    if (sseEmitters.isEmpty()) {
      logger.debug("No SSE clients connected to any shop");
      return;
    }

    logger.info("Broadcasting {} event to all {} connected shops", eventType, sseEmitters.size());

    int totalClients = 0;
    int successfulBroadcasts = 0;

    for (String shopDomain : sseEmitters.keySet()) {
      try {
        CopyOnWriteArrayList<SseEmitter> emitters = sseEmitters.get(shopDomain);
        if (emitters != null && !emitters.isEmpty()) {
          totalClients += emitters.size();
          broadcastToShop(shopDomain, eventType, message, reconnectMs);
          successfulBroadcasts++;
        }
      } catch (Exception e) {
        logger.warn(
            "Failed to broadcast {} event to shop {}: {}", eventType, shopDomain, e.getMessage());
      }
    }

    logger.info(
        "Broadcast completed: {} event sent to {} shops with {} total clients",
        eventType,
        successfulBroadcasts,
        totalClients);
  }

  /** Send exponential backoff hint to client */
  public void sendExponentialBackoff(SseEmitter emitter, int failCount) {
    int backoffSeconds = Math.min((int) Math.pow(2, failCount - 1), 60);
    sendMinimalEvent(
        emitter,
        "rate_limited",
        "Too many failed attempts. Please wait " + backoffSeconds + " seconds.",
        backoffSeconds * 1000);
  }

  /** Force close all SSE connections for a shop */
  public void forceCloseConnectionsForShop(String shopDomain) {
    CopyOnWriteArrayList<SseEmitter> emitters = sseEmitters.get(shopDomain);
    if (emitters != null && !emitters.isEmpty()) {
      logger.info("Force closing {} SSE connections for shop: {}", emitters.size(), shopDomain);

      List<SseEmitter> emittersCopy = new ArrayList<>(emitters);
      for (SseEmitter emitter : emittersCopy) {
        try {
          sendMinimalEvent(
              emitter,
              "session_invalidated",
              "Your session has been invalidated by an administrator.",
              10000);
          emitter.complete();
        } catch (Exception e) {
          logger.warn(
              "Error force closing SSE connection for shop {}: {}", shopDomain, e.getMessage());
        }
      }

      sseEmitters.remove(shopDomain);
      eventBatches.remove(shopDomain);
      batchTimers.remove(shopDomain);
    }
  }

  /** Get comprehensive SSE statistics for monitoring */
  public Map<String, Object> getStatistics() {
    Map<String, Object> stats = new HashMap<>();
    stats.put("totalConnections", totalConnections.get());
    stats.put("totalErrors", totalErrors.get());
    stats.put("totalRateLimited", totalRateLimited.get());
    stats.put("totalEventsSent", totalEventsSent.get());
    stats.put("totalBatchesSent", totalBatchesSent.get());
    stats.put("activeConnections", activeConnections.get());
    stats.put("activeShops", sseEmitters.size());
    stats.put("maxGlobalConnections", getMaxSseGlobal());
    stats.put("maxPerShopConnections", getMaxSsePerShop());
    stats.put("pendingBatches", eventBatches.size());

    // Enhanced resource management statistics
    stats.put("totalDeadConnectionsRemoved", totalDeadConnectionsRemoved.get());
    stats.put("totalBatchesDropped", totalBatchesDropped.get());
    stats.put("totalMemoryLeaksPreventedCount", totalMemoryLeaksPreventedCount.get());
    stats.put("trackedConnections", connectionHealth.size());
    stats.put("activeTimers", batchTimers.size());

    // Per-shop breakdown
    Map<String, Integer> shopConnections = new HashMap<>();
    sseEmitters.forEach((shop, emitters) -> shopConnections.put(shop, emitters.size()));
    stats.put("connectionsByShop", shopConnections);

    // Health indicators
    int globalCount = sseEmitters.values().stream().mapToInt(List::size).sum();
    double connectionUtilization = (double) globalCount / getMaxSseGlobal() * 100;

    Map<String, Object> health = new HashMap<>();
    health.put("connectionUtilization", String.format("%.1f%%", connectionUtilization));
    health.put("status", connectionUtilization > 80 ? "WARNING" : "HEALTHY");
    health.put(
        "recommendation",
        connectionUtilization > 80
            ? "Consider increasing limits or investigating connection leaks"
            : "Normal operation");

    // Enhanced health metrics
    health.put(
        "errorRate",
        totalConnections.get() > 0
            ? String.format("%.2f%%", (double) totalErrors.get() / totalConnections.get() * 100.0)
            : "0.00%");
    health.put(
        "memoryLeakPreventionEffectiveness",
        totalBatchesDropped.get() + totalMemoryLeaksPreventedCount.get());

    stats.put("health", health);
    stats.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

    return stats;
  }

  /** Remove a connection from the pool with enhanced cleanup */
  private void removeConnection(String shopDomain, SseEmitter emitter) {
    try {
      CopyOnWriteArrayList<SseEmitter> emitters = sseEmitters.get(shopDomain);
      if (emitters != null) {
        emitters.remove(emitter);
        activeConnections.decrementAndGet();

        if (emitters.isEmpty()) {
          sseEmitters.remove(shopDomain);
          eventBatches.remove(shopDomain);
          batchTimers.remove(shopDomain);
        }
      }

      // Clean up health tracking data to prevent memory leaks
      connectionHealth.remove(emitter);
      connectionCreationTimes.remove(emitter);
      connectionShopMapping.remove(emitter);

      // Update metrics
      metricsCollectionService.recordSseConnectionClosed();

    } catch (Exception e) {
      logger.warn("Error removing SSE connection for shop {}: {}", shopDomain, e.getMessage());
    }
  }

  /** Schedule batch timeout */
  private void scheduleBatchTimeout(String shopDomain) {
    new Timer()
        .schedule(
            new TimerTask() {
              @Override
              public void run() {
                sendBatch(shopDomain);
              }
            },
            getBatchTimeoutMs());
  }

  /** Scheduled cleanup of stale connections */
  @Scheduled(fixedRateString = "#{@schedulingConfiguration.getCleanupIntervalMs()}")
  public void cleanupStaleConnections() {
    // Check if scheduled SSE cleanup is enabled
    if (!featureFlagService.isScheduledSseCleanupEnabled()) {
      logger.debug("Scheduled SSE cleanup is disabled via feature flag");
      return;
    }

    try {
      logger.debug("Starting SSE connection cleanup");

      long now = System.currentTimeMillis();
      long deadConnectionTimeout = getDeadConnectionTimeoutMs();
      long connectionIdleTimeout = getConnectionIdleTimeoutMs();

      int deadConnectionsRemoved = 0;
      int idleConnectionsRemoved = 0;
      int orphanedConnectionsRemoved = 0;

      // Clean up dead connections
      for (Map.Entry<SseEmitter, ConnectionHealth> entry : connectionHealth.entrySet()) {
        SseEmitter emitter = entry.getKey();
        ConnectionHealth health = entry.getValue();

        if (health.isDead() || health.shouldBeMarkedDead(this)) {
          try {
            String shopDomain = connectionShopMapping.get(emitter);
            if (shopDomain != null) {
              removeConnection(shopDomain, emitter);
              deadConnectionsRemoved++;
            }
          } catch (Exception e) {
            logger.warn("Error removing dead SSE connection: {}", e.getMessage());
          }
        }
      }

      // Clean up idle connections
      for (Map.Entry<SseEmitter, Long> entry : connectionCreationTimes.entrySet()) {
        SseEmitter emitter = entry.getKey();
        Long creationTime = entry.getValue();

        if (creationTime != null && (now - creationTime) > connectionIdleTimeout) {
          try {
            String shopDomain = connectionShopMapping.get(emitter);
            if (shopDomain != null) {
              // Send notification before closing
              sendMinimalEvent(
                  emitter,
                  "connection_idle",
                  "Connection idle for too long. Reconnecting...",
                  5000);
              removeConnection(shopDomain, emitter);
              idleConnectionsRemoved++;
            }
          } catch (Exception e) {
            logger.warn("Error removing idle SSE connection: {}", e.getMessage());
          }
        }
      }

      // Clean up orphaned connections (no health tracking)
      for (Map.Entry<String, CopyOnWriteArrayList<SseEmitter>> entry : sseEmitters.entrySet()) {
        String shopDomain = entry.getKey();
        CopyOnWriteArrayList<SseEmitter> emitters = entry.getValue();

        List<SseEmitter> toRemove = new ArrayList<>();
        for (SseEmitter emitter : emitters) {
          if (!connectionHealth.containsKey(emitter)) {
            toRemove.add(emitter);
            orphanedConnectionsRemoved++;
          }
        }

        for (SseEmitter emitter : toRemove) {
          try {
            removeConnection(shopDomain, emitter);
          } catch (Exception e) {
            logger.warn("Error removing orphaned SSE connection: {}", e.getMessage());
          }
        }
      }

      // Clean up empty shops
      sseEmitters.entrySet().removeIf(entry -> entry.getValue().isEmpty());

      if (deadConnectionsRemoved > 0
          || idleConnectionsRemoved > 0
          || orphanedConnectionsRemoved > 0) {
        logger.info(
            "SSE cleanup completed - Dead: {}, Idle: {}, Orphaned: {}",
            deadConnectionsRemoved,
            idleConnectionsRemoved,
            orphanedConnectionsRemoved);
        totalDeadConnectionsRemoved.addAndGet(
            deadConnectionsRemoved + idleConnectionsRemoved + orphanedConnectionsRemoved);
      } else {
        logger.debug("SSE cleanup completed - no connections removed");
      }

    } catch (Exception e) {
      logger.error("Error during SSE connection cleanup: {}", e.getMessage());
    }
  }

  /** Enhanced scheduled heartbeat with connection health tracking */
  @Scheduled(fixedRateString = "#{@schedulingConfiguration.getHeartbeatIntervalMs()}")
  public void sendHeartbeats() {
    // Skip heartbeat if it's disabled (PT0S)
    if (!isHeartbeatEnabled()) {
      return;
    }

    try {
      int totalHeartbeats = 0;
      int failedHeartbeats = 0;

      for (Map.Entry<String, CopyOnWriteArrayList<SseEmitter>> entry : sseEmitters.entrySet()) {
        String shopDomain = entry.getKey();
        CopyOnWriteArrayList<SseEmitter> emitters = entry.getValue();

        if (emitters != null && !emitters.isEmpty()) {
          List<SseEmitter> emittersCopy = new ArrayList<>(emitters);

          for (SseEmitter emitter : emittersCopy) {
            ConnectionHealth health = connectionHealth.get(emitter);
            if (health != null && health.isDead()) {
              // Skip dead connections, they will be cleaned up by the health check
              continue;
            }

            try {
              sendMinimalEvent(emitter, "heartbeat", null, null);
              totalHeartbeats++;

              // Update connection health on successful heartbeat
              if (health != null) {
                health.setLastHeartbeat(System.currentTimeMillis());
                health.resetFailedHeartbeats();
              }

            } catch (Exception e) {
              failedHeartbeats++;
              logger.debug(
                  "Heartbeat failed for SSE connection in shop: {} - {}",
                  shopDomain,
                  e.getMessage());

              // Update connection health on failed heartbeat
              if (health != null) {
                health.incrementFailedHeartbeats();
                if (health.shouldBeMarkedDead(this)) {
                  health.markAsDead();
                  logger.warn(
                      "Marking SSE connection as dead for shop: {} after {} failed heartbeats",
                      shopDomain,
                      health.getFailedHeartbeats());
                }
              } else {
                // No health tracking, remove immediately
                removeConnection(shopDomain, emitter);
              }
            }
          }
        }
      }

      if (totalHeartbeats > 0 || failedHeartbeats > 0) {
        logger.debug("Sent {} SSE heartbeats, {} failed", totalHeartbeats, failedHeartbeats);
      }
    } catch (Exception e) {
      logger.error("Error during SSE heartbeat: {}", e.getMessage());
    }
  }

  /** Process pending batches (cleanup) */
  @Scheduled(fixedRate = 300000) // Every 5 minutes (reduced from 30 seconds)
  public void processPendingBatches() {
    try {
      for (String shopDomain : new ArrayList<>(batchTimers.keySet())) {
        Long timer = batchTimers.get(shopDomain);
        if (timer != null && System.currentTimeMillis() - timer > getBatchTimeoutMs()) {
          sendBatch(shopDomain);
        }
      }
    } catch (Exception e) {
      logger.error("Error processing pending batches: {}", e.getMessage());
    }
  }

  /** Enhanced connection health check and dead connection removal */
  @Scheduled(fixedRateString = "#{@schedulingConfiguration.getConnectionHealthCheckIntervalMs()}")
  public void performConnectionHealthCheck() {
    try {
      int deadConnectionsRemoved = 0;
      int idleConnectionsRemoved = 0;
      int orphanedConnectionsRemoved = 0;
      long currentTime = System.currentTimeMillis();

      logger.debug("Starting enhanced connection health check...");

      // Check all connections for health status
      for (Map.Entry<SseEmitter, ConnectionHealth> entry :
          new HashMap<>(connectionHealth).entrySet()) {
        SseEmitter emitter = entry.getKey();
        ConnectionHealth health = entry.getValue();
        String shopDomain = connectionShopMapping.get(emitter);

        if (health.isDead() || health.shouldBeMarkedDead(this)) {
          logger.warn(
              "Removing dead SSE connection for shop: {} (dead for {} ms, failed heartbeats: {})",
              shopDomain,
              currentTime - health.getLastHeartbeat(),
              health.getFailedHeartbeats());

          if (shopDomain != null) {
            removeConnection(shopDomain, emitter);
          } else {
            // Fallback cleanup if shop mapping is lost
            connectionHealth.remove(emitter);
            connectionCreationTimes.remove(emitter);
            connectionShopMapping.remove(emitter);
          }

          deadConnectionsRemoved++;
        }
        // Check for idle connections that should be cleaned up
        else if ((currentTime - health.getLastHeartbeat()) > getConnectionIdleTimeoutMs()) {
          logger.warn(
              "Removing idle SSE connection for shop: {} (idle for {} ms)",
              shopDomain,
              currentTime - health.getLastHeartbeat());

          if (shopDomain != null) {
            // Send notification before closing idle connection
            try {
              sendMinimalEvent(
                  emitter, "connection_idle", "Connection closed due to inactivity", 5000);
            } catch (Exception e) {
              // Ignore errors when sending to idle connection
            }
            removeConnection(shopDomain, emitter);
            idleConnectionsRemoved++;
          }
        }
      }

      // Check for connections that have been around too long without proper health tracking
      for (Map.Entry<SseEmitter, Long> entry : new HashMap<>(connectionCreationTimes).entrySet()) {
        SseEmitter emitter = entry.getKey();
        Long creationTime = entry.getValue();

        if (!connectionHealth.containsKey(emitter)
            && (currentTime - creationTime) > getDeadConnectionTimeoutMs()) {

          String shopDomain = connectionShopMapping.get(emitter);
          logger.warn(
              "Removing orphaned SSE connection for shop: {} (no health tracking, age: {} ms)",
              shopDomain,
              currentTime - creationTime);

          if (shopDomain != null) {
            removeConnection(shopDomain, emitter);
          } else {
            // Direct cleanup for orphaned connections
            connectionCreationTimes.remove(emitter);
            connectionShopMapping.remove(emitter);
          }
          orphanedConnectionsRemoved++;
        }
      }

      // Additional cleanup: Check for shop domains with empty emitter lists
      int emptyShopsRemoved = 0;
      for (Map.Entry<String, CopyOnWriteArrayList<SseEmitter>> entry :
          new HashMap<>(sseEmitters).entrySet()) {
        String shopDomain = entry.getKey();
        CopyOnWriteArrayList<SseEmitter> emitters = entry.getValue();

        if (emitters == null || emitters.isEmpty()) {
          sseEmitters.remove(shopDomain);
          eventBatches.remove(shopDomain);
          batchTimers.remove(shopDomain);
          emptyShopsRemoved++;
          logger.debug("Cleaned up empty shop domain: {}", shopDomain);
        }
      }

      int totalRemoved =
          deadConnectionsRemoved + idleConnectionsRemoved + orphanedConnectionsRemoved;
      if (totalRemoved > 0 || emptyShopsRemoved > 0) {
        totalDeadConnectionsRemoved.addAndGet(totalRemoved);
        logger.info(
            "Enhanced connection health check completed - removed {} dead, {} idle, {} orphaned connections, {} empty shops",
            deadConnectionsRemoved,
            idleConnectionsRemoved,
            orphanedConnectionsRemoved,
            emptyShopsRemoved);
      } else {
        logger.debug("Enhanced connection health check completed - no cleanup needed");
      }

    } catch (Exception e) {
      logger.error("Error during enhanced connection health check: {}", e.getMessage());
    }
  }

  /** Enhanced batch cleanup to prevent memory leaks */
  @Scheduled(fixedRateString = "#{@schedulingConfiguration.getBatchCleanupIntervalMs()}")
  public void performBatchCleanup() {
    try {
      int batchesCleared = 0;
      int orphanedTimersCleared = 0;
      int memoryOptimizedBatches = 0;
      long currentTime = System.currentTimeMillis();

      logger.debug("Starting enhanced batch cleanup...");

      // Clean up old batch timers that might be stuck
      for (Map.Entry<String, Long> entry : new HashMap<>(batchTimers).entrySet()) {
        String shopDomain = entry.getKey();
        Long timerStart = entry.getValue();

        if ((currentTime - timerStart) > (getBatchTimeoutMs() * 10)) { // 10x timeout threshold
          logger.warn(
              "Clearing stuck batch timer for shop: {} (stuck for {} ms)",
              shopDomain,
              currentTime - timerStart);

          // Force send any pending batch and clear timer
          sendBatch(shopDomain);
          orphanedTimersCleared++;
        }
      }

      // Enhanced cleanup: Check for memory-heavy batches and old batches
      for (Map.Entry<String, List<SseEvent>> entry : new HashMap<>(eventBatches).entrySet()) {
        String shopDomain = entry.getKey();
        List<SseEvent> batch = entry.getValue();
        CopyOnWriteArrayList<SseEmitter> emitters = sseEmitters.get(shopDomain);

        // Clean up event batches for shops with no active connections
        if (emitters == null || emitters.isEmpty()) {
          eventBatches.remove(shopDomain);
          batchTimers.remove(shopDomain);

          if (batch != null && !batch.isEmpty()) {
            logger.warn(
                "Cleared {} orphaned events for shop with no connections: {}",
                batch.size(),
                shopDomain);
            batchesCleared++;
            totalMemoryLeaksPreventedCount.incrementAndGet();
          }
        }
        // Check for batches that are too old or too large
        else if (batch != null && !batch.isEmpty()) {
          Long timerStart = batchTimers.get(shopDomain);
          int batchMemorySize = estimateBatchMemorySize(batch);
          boolean isTooOld =
              timerStart != null && (currentTime - timerStart) > getBatchMemoryCleanupThresholdMs();
          boolean isTooLarge = batchMemorySize > getMaxBatchMemorySizeBytes();

          if (isTooOld || isTooLarge) {
            logger.warn(
                "Force sending batch for shop {} due to {} (age: {} ms, size: {} bytes, events: {})",
                shopDomain,
                isTooOld ? "age threshold" : "memory threshold",
                timerStart != null ? currentTime - timerStart : 0,
                batchMemorySize,
                batch.size());

            sendBatch(shopDomain);
            memoryOptimizedBatches++;
          }
        }
      }

      if (batchesCleared > 0 || orphanedTimersCleared > 0 || memoryOptimizedBatches > 0) {
        logger.info(
            "Enhanced batch cleanup completed - cleared {} orphaned batches, {} stuck timers, {} memory-optimized batches",
            batchesCleared,
            orphanedTimersCleared,
            memoryOptimizedBatches);
      } else {
        logger.debug("Enhanced batch cleanup completed - no cleanup needed");
      }

    } catch (Exception e) {
      logger.error("Error during enhanced batch cleanup: {}", e.getMessage());
    }
  }

  /** Get enhanced SSE service metrics including resource management statistics */
  public SseServiceMetrics getEnhancedMetrics() {
    Map<String, Object> basicStats = getStatistics();

    return new SseServiceMetrics(
        totalConnections.get(),
        totalErrors.get(),
        totalEventsSent.get(),
        totalBatchesSent.get(),
        activeConnections.get(),
        totalDeadConnectionsRemoved.get(),
        totalBatchesDropped.get(),
        totalMemoryLeaksPreventedCount.get(),
        connectionHealth.size(),
        eventBatches.size(),
        batchTimers.size(),
        basicStats);
  }

  /** Check if SSE service is healthy and operating within normal parameters */
  public boolean isServiceHealthy() {
    int globalConnections = sseEmitters.values().stream().mapToInt(List::size).sum();
    double utilizationPercent = (double) globalConnections / getMaxSseGlobal() * 100;

    // Service is healthy if:
    // 1. Connection utilization is below 90%
    // 2. Error rate is below 5%
    // 3. No excessive memory leaks detected
    boolean utilizationHealthy = utilizationPercent < 90;
    boolean errorRateHealthy =
        totalConnections.get() == 0 || (double) totalErrors.get() / totalConnections.get() < 0.05;
    boolean memoryHealthy = totalMemoryLeaksPreventedCount.get() < totalConnections.get() * 0.1;

    return utilizationHealthy && errorRateHealthy && memoryHealthy;
  }

  /** Force cleanup of all resources - emergency use only */
  public void forceCleanupAllResources() {
    logger.warn("Performing FORCE cleanup of all SSE resources - emergency procedure");

    int connectionsRemoved = 0;
    int batchesCleared = 0;

    // Force close all connections
    for (Map.Entry<String, CopyOnWriteArrayList<SseEmitter>> entry :
        new HashMap<>(sseEmitters).entrySet()) {
      String shopDomain = entry.getKey();
      CopyOnWriteArrayList<SseEmitter> emitters = entry.getValue();

      if (emitters != null) {
        for (SseEmitter emitter : new ArrayList<>(emitters)) {
          try {
            sendMinimalEvent(emitter, "service_restart", "Service is restarting", 10000);
            emitter.complete();
          } catch (Exception e) {
            // Ignore errors during force cleanup
          }
          connectionsRemoved++;
        }
      }
    }

    // Clear all data structures
    sseEmitters.clear();
    batchesCleared = eventBatches.size();
    eventBatches.clear();
    batchTimers.clear();
    connectionHealth.clear();
    connectionCreationTimes.clear();
    connectionShopMapping.clear();

    // Reset counters
    activeConnections.set(0);
    totalMemoryLeaksPreventedCount.addAndGet(connectionsRemoved + batchesCleared);

    logger.warn(
        "Force cleanup completed - removed {} connections, cleared {} batches",
        connectionsRemoved,
        batchesCleared);
  }

  /** Data class for enhanced SSE service metrics */
  public static class SseServiceMetrics {
    private final long totalConnections;
    private final long totalErrors;
    private final long totalEventsSent;
    private final long totalBatchesSent;
    private final int activeConnections;
    private final long totalDeadConnectionsRemoved;
    private final long totalBatchesDropped;
    private final long totalMemoryLeaksPreventedCount;
    private final int trackedConnections;
    private final int pendingBatches;
    private final int activeTimers;
    private final Map<String, Object> detailedStats;

    public SseServiceMetrics(
        long totalConnections,
        long totalErrors,
        long totalEventsSent,
        long totalBatchesSent,
        int activeConnections,
        long totalDeadConnectionsRemoved,
        long totalBatchesDropped,
        long totalMemoryLeaksPreventedCount,
        int trackedConnections,
        int pendingBatches,
        int activeTimers,
        Map<String, Object> detailedStats) {
      this.totalConnections = totalConnections;
      this.totalErrors = totalErrors;
      this.totalEventsSent = totalEventsSent;
      this.totalBatchesSent = totalBatchesSent;
      this.activeConnections = activeConnections;
      this.totalDeadConnectionsRemoved = totalDeadConnectionsRemoved;
      this.totalBatchesDropped = totalBatchesDropped;
      this.totalMemoryLeaksPreventedCount = totalMemoryLeaksPreventedCount;
      this.trackedConnections = trackedConnections;
      this.pendingBatches = pendingBatches;
      this.activeTimers = activeTimers;
      this.detailedStats = detailedStats;
    }

    // Getters
    public long getTotalConnections() {
      return totalConnections;
    }

    public long getTotalErrors() {
      return totalErrors;
    }

    public long getTotalEventsSent() {
      return totalEventsSent;
    }

    public long getTotalBatchesSent() {
      return totalBatchesSent;
    }

    public int getActiveConnections() {
      return activeConnections;
    }

    public long getTotalDeadConnectionsRemoved() {
      return totalDeadConnectionsRemoved;
    }

    public long getTotalBatchesDropped() {
      return totalBatchesDropped;
    }

    public long getTotalMemoryLeaksPreventedCount() {
      return totalMemoryLeaksPreventedCount;
    }

    public int getTrackedConnections() {
      return trackedConnections;
    }

    public int getPendingBatches() {
      return pendingBatches;
    }

    public int getActiveTimers() {
      return activeTimers;
    }

    public Map<String, Object> getDetailedStats() {
      return detailedStats;
    }

    public double getErrorRate() {
      return totalConnections > 0 ? (double) totalErrors / totalConnections * 100.0 : 0.0;
    }

    public double getMemoryLeakPreventionEffectiveness() {
      return totalBatchesDropped + totalMemoryLeaksPreventedCount;
    }

    @Override
    public String toString() {
      return String.format(
          "SseServiceMetrics{totalConnections=%d, activeConnections=%d, totalErrors=%d, "
              + "errorRate=%.2f%%, deadConnectionsRemoved=%d, batchesDropped=%d, "
              + "memoryLeaksPreventedCount=%d, trackedConnections=%d}",
          totalConnections,
          activeConnections,
          totalErrors,
          getErrorRate(),
          totalDeadConnectionsRemoved,
          totalBatchesDropped,
          totalMemoryLeaksPreventedCount,
          trackedConnections);
    }
  }
}
