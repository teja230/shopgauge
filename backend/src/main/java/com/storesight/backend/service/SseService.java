package com.storesight.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
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

  // Configuration constants
  private static final int MAX_SSE_PER_SHOP = 5;
  private static final int MAX_SSE_GLOBAL = 50;
  private static final long SSE_TIMEOUT_MS = 120_000L; // 2 minutes
  private static final long HEARTBEAT_INTERVAL_MS = 30_000L; // 30 seconds
  private static final long CLEANUP_INTERVAL_MS = 60_000L; // 1 minute
  private static final int MAX_BATCH_SIZE = 10; // Maximum events per batch
  private static final long BATCH_TIMEOUT_MS = 1000L; // 1 second batch timeout

  // Connection storage
  private final ConcurrentHashMap<String, CopyOnWriteArrayList<SseEmitter>> sseEmitters =
      new ConcurrentHashMap<>();

  // Batching support
  private final ConcurrentHashMap<String, List<SseEvent>> eventBatches = new ConcurrentHashMap<>();
  private final ConcurrentHashMap<String, Long> batchTimers = new ConcurrentHashMap<>();

  // Monitoring and metrics
  private final AtomicLong totalConnections = new AtomicLong(0);
  private final AtomicLong totalErrors = new AtomicLong(0);
  private final AtomicLong totalRateLimited = new AtomicLong(0);
  private final AtomicLong totalEventsSent = new AtomicLong(0);
  private final AtomicLong totalBatchesSent = new AtomicLong(0);
  private final AtomicInteger activeConnections = new AtomicInteger(0);

  // Dependencies
  private final RedisTemplate<String, String> redisTemplate;
  private final ObjectMapper objectMapper;

  @Autowired
  public SseService(RedisTemplate<String, String> redisTemplate) {
    this.redisTemplate = redisTemplate;
    this.objectMapper = new ObjectMapper();
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

    boolean canAccept = globalCount < MAX_SSE_GLOBAL && shopCount < MAX_SSE_PER_SHOP;

    if (!canAccept) {
      logger.warn(
          "SSE connection limit reached - Global: {}/{}, Shop {}: {}/{}",
          globalCount,
          MAX_SSE_GLOBAL,
          shopDomain,
          shopCount,
          MAX_SSE_PER_SHOP);
    }

    return canAccept;
  }

  /** Create a new SSE connection for a shop */
  public SseEmitter createConnection(String shopDomain, String sessionId) {
    if (!canAcceptConnection(shopDomain)) {
      totalErrors.incrementAndGet();
      SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
      sendMinimalEvent(emitter, "error", "Too many connections. Try again later.", 10000);
      emitter.complete();
      return emitter;
    }

    SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
    totalConnections.incrementAndGet();
    activeConnections.incrementAndGet();

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

    } catch (Exception e) {
      logger.warn("Failed to send minimal SSE event: {}", e.getMessage());
      totalErrors.incrementAndGet();
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

  /** Queue an event for batching (future-ready) */
  public void queueEventForBatching(String shopDomain, SseEvent event) {
    eventBatches.computeIfAbsent(shopDomain, k -> new ArrayList<>()).add(event);

    // Start batch timer if not already running
    batchTimers.computeIfAbsent(
        shopDomain,
        k -> {
          scheduleBatchTimeout(shopDomain);
          return System.currentTimeMillis();
        });

    // Send batch immediately if it reaches max size
    List<SseEvent> batch = eventBatches.get(shopDomain);
    if (batch != null && batch.size() >= MAX_BATCH_SIZE) {
      sendBatch(shopDomain);
    }
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
    stats.put("maxGlobalConnections", MAX_SSE_GLOBAL);
    stats.put("maxPerShopConnections", MAX_SSE_PER_SHOP);
    stats.put("pendingBatches", eventBatches.size());

    // Per-shop breakdown
    Map<String, Integer> shopConnections = new HashMap<>();
    sseEmitters.forEach((shop, emitters) -> shopConnections.put(shop, emitters.size()));
    stats.put("connectionsByShop", shopConnections);

    // Health indicators
    int globalCount = sseEmitters.values().stream().mapToInt(List::size).sum();
    double connectionUtilization = (double) globalCount / MAX_SSE_GLOBAL * 100;

    Map<String, Object> health = new HashMap<>();
    health.put("connectionUtilization", String.format("%.1f%%", connectionUtilization));
    health.put("status", connectionUtilization > 80 ? "WARNING" : "HEALTHY");
    health.put(
        "recommendation",
        connectionUtilization > 80
            ? "Consider increasing limits or investigating connection leaks"
            : "Normal operation");
    stats.put("health", health);

    stats.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

    return stats;
  }

  /** Remove a connection from the pool */
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
            BATCH_TIMEOUT_MS);
  }

  /** Scheduled cleanup of stale connections */
  @Scheduled(fixedRate = CLEANUP_INTERVAL_MS)
  public void cleanupStaleConnections() {
    try {
      logger.debug("Starting SSE connection cleanup...");
      int totalCleaned = 0;

      for (Map.Entry<String, CopyOnWriteArrayList<SseEmitter>> entry : sseEmitters.entrySet()) {
        String shopDomain = entry.getKey();
        CopyOnWriteArrayList<SseEmitter> emitters = entry.getValue();

        if (emitters != null && !emitters.isEmpty()) {
          List<SseEmitter> emittersCopy = new ArrayList<>(emitters);

          for (SseEmitter emitter : emittersCopy) {
            try {
              sendMinimalEvent(emitter, "ping", null, null);
            } catch (Exception e) {
              logger.debug(
                  "Removing stale SSE connection for shop: {} - {}", shopDomain, e.getMessage());
              removeConnection(shopDomain, emitter);
              totalCleaned++;
            }
          }
        }
      }

      if (totalCleaned > 0) {
        logger.info(
            "SSE connection cleanup completed - removed {} stale connections", totalCleaned);
      } else {
        logger.debug("SSE connection cleanup completed - no stale connections found");
      }
    } catch (Exception e) {
      logger.error("Error during SSE connection cleanup: {}", e.getMessage());
    }
  }

  /** Scheduled heartbeat to keep connections alive */
  @Scheduled(fixedRate = HEARTBEAT_INTERVAL_MS)
  public void sendHeartbeats() {
    try {
      int totalHeartbeats = 0;

      for (Map.Entry<String, CopyOnWriteArrayList<SseEmitter>> entry : sseEmitters.entrySet()) {
        String shopDomain = entry.getKey();
        CopyOnWriteArrayList<SseEmitter> emitters = entry.getValue();

        if (emitters != null && !emitters.isEmpty()) {
          List<SseEmitter> emittersCopy = new ArrayList<>(emitters);

          for (SseEmitter emitter : emittersCopy) {
            try {
              sendMinimalEvent(emitter, "heartbeat", null, null);
              totalHeartbeats++;
            } catch (Exception e) {
              logger.debug(
                  "Heartbeat failed for SSE connection in shop: {} - removing", shopDomain);
              removeConnection(shopDomain, emitter);
            }
          }
        }
      }

      if (totalHeartbeats > 0) {
        logger.debug("Sent {} SSE heartbeats", totalHeartbeats);
      }
    } catch (Exception e) {
      logger.error("Error during SSE heartbeat: {}", e.getMessage());
    }
  }

  /** Process pending batches (cleanup) */
  @Scheduled(fixedRate = 5000) // Every 5 seconds
  public void processPendingBatches() {
    try {
      for (String shopDomain : new ArrayList<>(batchTimers.keySet())) {
        Long timer = batchTimers.get(shopDomain);
        if (timer != null && System.currentTimeMillis() - timer > BATCH_TIMEOUT_MS) {
          sendBatch(shopDomain);
        }
      }
    } catch (Exception e) {
      logger.error("Error processing pending batches: {}", e.getMessage());
    }
  }
}
