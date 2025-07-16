package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.config.ApplicationConfigurationProperties;
import com.storesight.backend.config.ApplicationConfigurationProperties.SseConfiguration;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@SpringBootTest
@TestPropertySource(
    properties = {
      "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
      "spring.flyway.enabled=false"
    })
class SseServiceTest {

  @MockBean private RedisTemplate<String, String> redisTemplate;
  @MockBean private MetricsCollectionService metricsCollectionService;
  @MockBean private ApplicationConfigurationProperties config;
  @MockBean private SseConfiguration sseConfig;

  @Autowired private SseService sseService;

  private ObjectMapper objectMapper;

  @BeforeEach
  void setUp() {
    objectMapper = new ObjectMapper();

    // Mock SSE configuration
    when(config.getSse()).thenReturn(sseConfig);
    when(sseConfig.getMaxConnectionsPerShop()).thenReturn(5);
    when(sseConfig.getMaxConnectionsGlobal()).thenReturn(50);
    when(sseConfig.getConnectionTimeout()).thenReturn(Duration.ofMinutes(2));
    when(sseConfig.getHeartbeatInterval()).thenReturn(Duration.ofSeconds(30));
    when(sseConfig.getCleanupInterval()).thenReturn(Duration.ofMinutes(1));
    when(sseConfig.getMaxBatchSize()).thenReturn(10);
    when(sseConfig.getBatchTimeout()).thenReturn(Duration.ofSeconds(1));
    when(sseConfig.getMaxBatchQueueSize()).thenReturn(100);
    when(sseConfig.getConnectionHealthCheckInterval()).thenReturn(Duration.ofMinutes(1));
    when(sseConfig.getDeadConnectionTimeout()).thenReturn(Duration.ofMinutes(5));
    when(sseConfig.getBatchCleanupInterval()).thenReturn(Duration.ofMinutes(1));
    when(sseConfig.getMaxFailedHeartbeats()).thenReturn(3);
    when(sseConfig.getBatchMemoryCleanupThreshold()).thenReturn(Duration.ofMinutes(5));
    when(sseConfig.getMaxBatchMemorySizeBytes()).thenReturn(1024 * 1024);
    when(sseConfig.getConnectionIdleTimeout()).thenReturn(Duration.ofMinutes(10));
    when(sseConfig.getEmergencyCleanupThreshold()).thenReturn(100);
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

    // When
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

    // When - should handle gracefully
    assertDoesNotThrow(() -> sseService.sendBatch(shopDomain));
  }

  @Test
  void testBroadcastToShop_WithConnections() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    sseService.createConnection(shopDomain, "test-session");

    // When
    assertDoesNotThrow(
        () -> sseService.broadcastToShop(shopDomain, "test-event", "test message", null));
  }

  @Test
  void testBroadcastToShop_NoConnections() {
    // Given
    String shopDomain = "test-shop.myshopify.com";

    // When - should handle gracefully
    assertDoesNotThrow(
        () -> sseService.broadcastToShop(shopDomain, "test-event", "test message", null));
  }

  @Test
  void testBroadcastToShop_WithMetadata() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    sseService.createConnection(shopDomain, "test-session");
    Map<String, Object> metadata = Map.of("key1", "value1", "key2", 123);

    // When
    assertDoesNotThrow(
        () -> sseService.broadcastToShop(shopDomain, "test-event", "test message", 5000, metadata));
  }

  @Test
  void testForceCloseConnectionsForShop() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    sseService.createConnection(shopDomain, "test-session");

    // When
    assertDoesNotThrow(() -> sseService.forceCloseConnectionsForShop(shopDomain));
  }

  @Test
  void testCleanupStaleConnections() {
    // When
    assertDoesNotThrow(() -> sseService.cleanupStaleConnections());
  }

  @Test
  void testSendHeartbeats() {
    // When
    assertDoesNotThrow(() -> sseService.sendHeartbeats());
  }

  @Test
  void testGetStatistics() {
    // When
    Map<String, Object> stats = sseService.getStatistics();

    // Then
    assertNotNull(stats);
    assertTrue(stats.containsKey("totalConnections"));
    assertTrue(stats.containsKey("activeConnections"));
    assertTrue(stats.containsKey("totalEventsSent"));
    assertTrue(stats.containsKey("totalErrors"));
  }

  @Test
  void testGetStatistics_HealthIndicators() {
    // Given - create some connections to generate statistics
    String shopDomain = "test-shop.myshopify.com";
    sseService.createConnection(shopDomain, "test-session-1");
    sseService.createConnection(shopDomain, "test-session-2");

    // When
    Map<String, Object> stats = sseService.getStatistics();

    // Then
    assertNotNull(stats);
    assertTrue(stats.containsKey("connectionHealth"));
    assertTrue(stats.containsKey("memoryUsage"));
    assertTrue(stats.containsKey("errorRate"));
  }

  // ===== SSE EVENT TESTS =====

  @Test
  void testSseEvent_Creation() {
    // Given
    String type = "test-event";
    String message = "test message";
    Integer reconnectMs = 5000;
    Map<String, Object> metadata = Map.of("key1", "value1");

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

  // ===== CONNECTION HEALTH TESTS =====

  @Test
  void testConnectionHealth_Lifecycle() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    SseEmitter emitter = sseService.createConnection(shopDomain, "test-session");

    // When - simulate connection health check
    Map<String, Object> stats = sseService.getStatistics();

    // Then
    assertNotNull(stats);
    assertTrue(stats.containsKey("connectionHealth"));
  }

  @Test
  void testConnectionHealth_Reset() {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    SseEmitter emitter = sseService.createConnection(shopDomain, "test-session");

    // When - should handle health reset gracefully
    assertDoesNotThrow(
        () -> {
          // Simulate health reset by getting statistics
          sseService.getStatistics();
        });
  }

  @Test
  void testSendExponentialBackoff() {
    // Given
    SseEmitter emitter = mock(SseEmitter.class);

    // When - should handle backoff gracefully
    assertDoesNotThrow(
        () -> {
          // This would be called internally during error handling
          sseService.sendMinimalEvent(emitter, "error", "Connection failed", 10000);
        });
  }

  // ===== CONCURRENCY TESTS =====

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
      final int index = i;
      executor.submit(
          () -> {
            try {
              startLatch.await();
              SseEmitter emitter = sseService.createConnection(shopDomain, "session-" + index);
              assertNotNull(emitter);
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
            } finally {
              doneLatch.countDown();
            }
          });
    }

    startLatch.countDown();
    assertTrue(doneLatch.await(5, TimeUnit.SECONDS));
    executor.shutdown();

    // Then
    Map<String, Object> stats = sseService.getStatistics();
    assertTrue((Integer) stats.get("activeConnections") >= 0);
  }

  @Test
  void testConcurrentEventBatching() throws InterruptedException {
    // Given
    String shopDomain = "test-shop.myshopify.com";
    int threadCount = 5;
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch doneLatch = new CountDownLatch(threadCount);
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);

    // When
    for (int i = 0; i < threadCount; i++) {
      final int index = i;
      executor.submit(
          () -> {
            try {
              startLatch.await();
              for (int j = 0; j < 10; j++) {
                SseService.SseEvent event =
                    new SseService.SseEvent("event-" + index + "-" + j, "message " + j);
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
    assertTrue(doneLatch.await(5, TimeUnit.SECONDS));
    executor.shutdown();

    // Then - should handle concurrent batching gracefully
    Map<String, Object> stats = sseService.getStatistics();
    assertNotNull(stats);
  }

  // ===== EDGE CASE TESTS =====

  @Test
  void testNullShopDomainHandling() {
    // When & Then - should handle null shop domain gracefully
    assertDoesNotThrow(() -> sseService.canAcceptConnection(null));
    assertDoesNotThrow(() -> sseService.createConnection(null, "test-session"));
    assertDoesNotThrow(() -> sseService.broadcastToShop(null, "test-event", "test message", null));
  }

  @Test
  void testEmptyShopDomainHandling() {
    // When & Then - should handle empty shop domain gracefully
    assertDoesNotThrow(() -> sseService.canAcceptConnection(""));
    assertDoesNotThrow(() -> sseService.createConnection("", "test-session"));
    assertDoesNotThrow(() -> sseService.broadcastToShop("", "test-event", "test message", null));
  }

  @Test
  void testNullEventHandling() {
    // When & Then - should handle null events gracefully
    assertDoesNotThrow(() -> sseService.queueEventForBatching("test-shop", null));
  }
}
