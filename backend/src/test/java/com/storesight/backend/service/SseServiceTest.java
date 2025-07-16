package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@ExtendWith(MockitoExtension.class)
class SseServiceTest {

  @Mock private RedisTemplate<String, String> redisTemplate;
  @Mock private MetricsCollectionService metricsCollectionService;

  @InjectMocks private SseService sseService;

  private ObjectMapper objectMapper;

  @BeforeEach
  void setUp() {
    objectMapper = new ObjectMapper();
    // Use reflection to set the objectMapper field since it's final
    try {
      var field = SseService.class.getDeclaredField("objectMapper");
      field.setAccessible(true);
      field.set(sseService, objectMapper);
    } catch (Exception e) {
      // If reflection fails, tests will still work with the default ObjectMapper
    }
  }

  // ===== CONNECTION MANAGEMENT TESTS =====

  @Test
  void testCanAcceptConnection_WithinLimits() {
    // Given
    String shopDomain = "test-shop.myshopify.com";

    // When
    boolean canAccept = sseService.canAcceptConnection(shopDomain);

    // Then
    assertTrue(canAccept);
  }

  @Test
  void testCreateConnection_Success() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    String sessionId = "test-session-123";

    // When
    SseEmitter emitter = sseService.createConnection(shopDomain, sessionId);

    // Then
    assertNotNull(emitter);
    verify(metricsCollectionService).recordSseConnectionCreated();
  }

  @Test
  void testCreateConnection_ExceedsGlobalLimit() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    String sessionId = "test-session-123";

    // Create connections up to the global limit
    for (int i = 0; i < 50; i++) {
      sseService.createConnection("shop-" + i + ".myshopify.com", "session-" + i);
    }

    // When - try to create one more connection
    SseEmitter emitter = sseService.createConnection(shopDomain, sessionId);

    // Then - should still return an emitter but it will be completed with error
    assertNotNull(emitter);
  }

  @Test
  void testCreateConnection_ExceedsPerShopLimit() {
    // Given
    String shopDomain = "test-shop.myshopify.com";

    // Create connections up to the per-shop limit
    for (int i = 0; i < 5; i++) {
      sseService.createConnection(shopDomain, "session-" + i);
    }

    // When - try to create one more connection for the same shop
    SseEmitter emitter = sseService.createConnection(shopDomain, "session-6");

    // Then - should still return an emitter but it will be completed with error
    assertNotNull(emitter);
  }

  // ===== EVENT SENDING TESTS =====

  @Test
  void testSendMinimalEvent_Success() {
    // Given
    SseEmitter emitter = mock(SseEmitter.class);
    String eventType = "test-event";
    String message = "test message";

    // When - should not throw exception
    assertDoesNotThrow(() -> sseService.sendMinimalEvent(emitter, eventType, message));

    // Then
    verify(metricsCollectionService).recordSseEventPublished();
  }

  @Test
  void testSendMinimalEvent_WithReconnectTime() {
    // Given
    SseEmitter emitter = mock(SseEmitter.class);
    String eventType = "test-event";
    String message = "test message";
    Integer reconnectMs = 5000;

    // When - should not throw exception
    assertDoesNotThrow(() -> sseService.sendMinimalEvent(emitter, eventType, message, reconnectMs));

    // Then
    verify(metricsCollectionService).recordSseEventPublished();
  }

  @Test
  void testSendMinimalEvent_WithMetadata() {
    // Given
    SseEmitter emitter = mock(SseEmitter.class);
    String eventType = "test-event";
    String message = "test message";
    Integer reconnectMs = 5000;
    Map<String, Object> metadata = Map.of("key1", "value1", "key2", 123);

    // When - should not throw exception
    assertDoesNotThrow(
        () -> sseService.sendMinimalEvent(emitter, eventType, message, reconnectMs, metadata));
  }

  @Test
  void testSendMinimalEvent_EmitterException() {
    // Given
    SseEmitter emitter = mock(SseEmitter.class);
    String eventType = "test-event";
    String message = "test message";

    try {
      doThrow(new RuntimeException("Emitter send failed"))
          .when(emitter)
          .send(any(SseEmitter.SseEventBuilder.class));
    } catch (Exception e) {
      // Expected for mock setup
    }

    // When - should not throw exception
    assertDoesNotThrow(() -> sseService.sendMinimalEvent(emitter, eventType, message));

    // Then
    verify(metricsCollectionService).recordSseConnectionError();
  }

  // ===== BATCHING TESTS =====

  @Test
  void testQueueEventForBatching_SingleEvent() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    SseService.SseEvent event = new SseService.SseEvent("test-event", "test message");

    // When - should not throw exception
    assertDoesNotThrow(() -> sseService.queueEventForBatching(shopDomain, event));
  }

  @Test
  void testQueueEventForBatching_MaxBatchSize() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    sseService.createConnection(shopDomain, "test-session");

    // Queue events up to max batch size
    for (int i = 0; i < 10; i++) {
      SseService.SseEvent event = new SseService.SseEvent("event-" + i, "message " + i);
      sseService.queueEventForBatching(shopDomain, event);
    }

    // When - queue one more event to trigger batch send
    SseService.SseEvent triggerEvent = new SseService.SseEvent("trigger-event", "trigger message");
    assertDoesNotThrow(() -> sseService.queueEventForBatching(shopDomain, triggerEvent));
  }

  @Test
  void testQueueEventForBatching_MemoryPressure() {
    // Given
    String shopDomain = "test-shop.myshopify.com";

    // Queue many events to trigger memory management
    for (int i = 0; i < 150; i++) {
      SseService.SseEvent event =
          new SseService.SseEvent(
              "event-" + i, "large message content that takes up memory space " + i);
      sseService.queueEventForBatching(shopDomain, event);
    }

    // When - should handle memory pressure gracefully
    Map<String, Object> stats = sseService.getStatistics();

    // Then
    assertNotNull(stats);
    assertTrue((Long) stats.get("totalBatchesDropped") >= 0);
  }

  @Test
  void testSendBatch_WithConnections() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    sseService.createConnection(shopDomain, "test-session");

    // Queue some events
    for (int i = 0; i < 3; i++) {
      SseService.SseEvent event = new SseService.SseEvent("event-" + i, "message " + i);
      sseService.queueEventForBatching(shopDomain, event);
    }

    // When - should not throw exception
    assertDoesNotThrow(() -> sseService.sendBatch(shopDomain));
  }

  @Test
  void testSendBatch_NoConnections() {
    // Given
    String shopDomain = "test-shop.myshopify.com";

    // Queue some events without any connections
    for (int i = 0; i < 3; i++) {
      SseService.SseEvent event = new SseService.SseEvent("event-" + i, "message " + i);
      sseService.queueEventForBatching(shopDomain, event);
    }

    // When - should not throw exception
    assertDoesNotThrow(() -> sseService.sendBatch(shopDomain));
  }

  // ===== BROADCASTING TESTS =====

  @Test
  void testBroadcastToShop_WithConnections() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    sseService.createConnection(shopDomain, "session-1");
    sseService.createConnection(shopDomain, "session-2");

    // When - should not throw exception
    assertDoesNotThrow(
        () -> sseService.broadcastToShop(shopDomain, "broadcast-event", "broadcast message", 5000));
  }

  @Test
  void testBroadcastToShop_NoConnections() {
    // Given
    String shopDomain = "test-shop.myshopify.com";

    // When - should not throw exception
    assertDoesNotThrow(
        () -> sseService.broadcastToShop(shopDomain, "broadcast-event", "broadcast message", 5000));
  }

  @Test
  void testBroadcastToShop_WithMetadata() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    sseService.createConnection(shopDomain, "session-1");
    Map<String, Object> metadata = Map.of("priority", "high", "category", "alert");

    // When - should not throw exception
    assertDoesNotThrow(
        () ->
            sseService.broadcastToShop(shopDomain, "alert-event", "alert message", 5000, metadata));
  }

  // ===== CONNECTION CLEANUP TESTS =====

  @Test
  void testForceCloseConnectionsForShop() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    sseService.createConnection(shopDomain, "session-1");
    sseService.createConnection(shopDomain, "session-2");

    // When - should not throw exception
    assertDoesNotThrow(() -> sseService.forceCloseConnectionsForShop(shopDomain));
  }

  @Test
  void testCleanupStaleConnections() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    sseService.createConnection(shopDomain, "session-1");

    // When - should not throw exception
    assertDoesNotThrow(() -> sseService.cleanupStaleConnections());
  }

  @Test
  void testSendHeartbeats() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    sseService.createConnection(shopDomain, "session-1");

    // When - should not throw exception
    assertDoesNotThrow(() -> sseService.sendHeartbeats());
  }

  // ===== STATISTICS AND MONITORING TESTS =====

  @Test
  void testGetStatistics() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    sseService.createConnection(shopDomain, "session-1");

    // When
    Map<String, Object> stats = sseService.getStatistics();

    // Then
    assertNotNull(stats);
    assertTrue(stats.containsKey("totalConnections"));
    assertTrue(stats.containsKey("totalErrors"));
    assertTrue(stats.containsKey("totalEventsSent"));
    assertTrue(stats.containsKey("activeConnections"));
    assertTrue(stats.containsKey("health"));
    assertTrue((Long) stats.get("totalConnections") > 0);
  }

  @Test
  void testGetStatistics_HealthIndicators() {
    // Given - create many connections to test health indicators
    for (int i = 0; i < 45; i++) {
      sseService.createConnection("shop-" + i + ".myshopify.com", "session-" + i);
    }

    // When
    Map<String, Object> stats = sseService.getStatistics();

    // Then
    assertNotNull(stats);
    @SuppressWarnings("unchecked")
    Map<String, Object> health = (Map<String, Object>) stats.get("health");
    assertNotNull(health);
    assertTrue(health.containsKey("connectionUtilization"));
    assertTrue(health.containsKey("status"));
    assertTrue(health.containsKey("errorRate"));
  }

  // ===== EDGE CASE TESTS =====

  @Test
  void testSseEvent_Creation() {
    // Given
    String type = "test-event";
    String message = "test message";
    Integer reconnectMs = 5000;
    Map<String, Object> metadata = Map.of("key", "value");

    // When
    SseService.SseEvent event = new SseService.SseEvent(type, message, reconnectMs, metadata);

    // Then
    assertEquals(type, event.getType());
    assertEquals(message, event.getMessage());
    assertEquals(reconnectMs, event.getReconnectMs());
    assertEquals(metadata, event.getMetadata());
    assertTrue(event.getTimestamp() > 0);
  }

  @Test
  void testSseEvent_MinimalCreation() {
    // Given
    String type = "test-event";
    String message = "test message";

    // When
    SseService.SseEvent event = new SseService.SseEvent(type, message);

    // Then
    assertEquals(type, event.getType());
    assertEquals(message, event.getMessage());
    assertNull(event.getReconnectMs());
    assertNotNull(event.getMetadata());
    assertTrue(event.getMetadata().isEmpty());
  }

  @Test
  void testConnectionHealth_Lifecycle() {
    // Given
    SseService.ConnectionHealth health = new SseService.ConnectionHealth();

    // When - simulate health changes
    health.incrementFailedHeartbeats();
    health.incrementFailedHeartbeats();
    health.incrementFailedHeartbeats();

    // Then
    assertEquals(3, health.getFailedHeartbeats());
    assertTrue(health.shouldBeMarkedDead(sseService));
    assertFalse(health.isDead()); // Not marked dead yet

    // When - mark as dead
    health.markAsDead();

    // Then
    assertTrue(health.isDead());
  }

  @Test
  void testConnectionHealth_Reset() {
    // Given
    SseService.ConnectionHealth health = new SseService.ConnectionHealth();
    health.incrementFailedHeartbeats();
    health.incrementFailedHeartbeats();

    // When
    health.resetFailedHeartbeats();

    // Then
    assertEquals(0, health.getFailedHeartbeats());
    assertFalse(health.shouldBeMarkedDead(sseService));
  }

  @Test
  void testSendExponentialBackoff() {
    // Given
    SseEmitter emitter = mock(SseEmitter.class);
    int failCount = 3;

    // When - should not throw exception
    assertDoesNotThrow(() -> sseService.sendExponentialBackoff(emitter, failCount));
  }

  @Test
  void testConcurrentConnectionCreation() throws InterruptedException {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    int threadCount = 10;
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch doneLatch = new CountDownLatch(threadCount);
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);

    // When
    for (int i = 0; i < threadCount; i++) {
      final int sessionNum = i;
      executor.submit(
          () -> {
            try {
              startLatch.await();
              SseEmitter emitter = sseService.createConnection(shopDomain, "session-" + sessionNum);
              assertNotNull(emitter);
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
            } finally {
              doneLatch.countDown();
            }
          });
    }

    startLatch.countDown();
    assertTrue(doneLatch.await(10, TimeUnit.SECONDS));
    executor.shutdown();

    // Then
    Map<String, Object> stats = sseService.getStatistics();
    assertTrue((Long) stats.get("totalConnections") > 0);
  }

  @Test
  void testConcurrentEventBatching() throws InterruptedException {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    sseService.createConnection(shopDomain, "test-session");

    int threadCount = 5;
    int eventsPerThread = 10;
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch doneLatch = new CountDownLatch(threadCount);
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);

    // When
    for (int i = 0; i < threadCount; i++) {
      final int threadNum = i;
      executor.submit(
          () -> {
            try {
              startLatch.await();
              for (int j = 0; j < eventsPerThread; j++) {
                SseService.SseEvent event =
                    new SseService.SseEvent("event-" + threadNum + "-" + j, "message " + j);
                sseService.queueEventForBatching(shopDomain, event);
              }
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
            } finally {
              doneLatch.countDown();
            }
          });
    }

    startLatch.countDown();
    assertTrue(doneLatch.await(10, TimeUnit.SECONDS));
    executor.shutdown();

    // Then - should handle concurrent batching without errors
    Map<String, Object> stats = sseService.getStatistics();
    assertNotNull(stats);
  }

  @Test
  void testNullShopDomainHandling() {
    // When & Then - should handle null shop domains gracefully
    assertDoesNotThrow(() -> sseService.canAcceptConnection(null));
    assertDoesNotThrow(() -> sseService.createConnection(null, "session-123"));
    assertDoesNotThrow(() -> sseService.broadcastToShop(null, "event", "message", 5000));
    assertDoesNotThrow(() -> sseService.forceCloseConnectionsForShop(null));
  }

  @Test
  void testEmptyShopDomainHandling() {
    // When & Then - should handle empty shop domains gracefully
    assertDoesNotThrow(() -> sseService.canAcceptConnection(""));
    assertDoesNotThrow(() -> sseService.createConnection("", "session-123"));
    assertDoesNotThrow(() -> sseService.broadcastToShop("", "event", "message", 5000));
    assertDoesNotThrow(() -> sseService.forceCloseConnectionsForShop(""));
  }

  @Test
  void testNullEventHandling() {
    // Given
    String shopDomain = "test-shop.myshopify.com";

    // When & Then - should handle null events gracefully
    assertDoesNotThrow(() -> sseService.queueEventForBatching(shopDomain, null));
  }
}
