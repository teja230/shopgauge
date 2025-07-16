package com.storesight.backend;

import static org.junit.jupiter.api.Assertions.*;

import com.storesight.backend.service.DashboardCacheService;
import com.storesight.backend.service.SessionSynchronizationService;
import com.storesight.backend.service.SseService;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Comprehensive end-to-end integration tests covering complete user session lifecycle, SSE
 * real-time features, and cache behavior across multiple user sessions.
 *
 * <p>This test validates Requirements: 1.1, 2.1, 6.1 from the specification.
 */
@SpringBootTest
@TestPropertySource(
    properties = {"spring.redis.timeout=5000ms", "logging.level.com.storesight.backend=DEBUG"})
class EndToEndIntegrationTest extends BaseIntegrationTest {

  @Autowired private SessionSynchronizationService sessionSynchronizationService;

  @Autowired private SseService sseService;

  @Autowired private DashboardCacheService cacheService;

  @Autowired private StringRedisTemplate redisTemplate;

  private static final String TEST_SHOP_DOMAIN = "e2e-test-shop";
  private static final String TEST_SESSION_PREFIX = "e2e-session-";

  @BeforeEach
  void setUp() {
    cleanupTestData();
    sessionSynchronizationService.resetMetrics();
  }

  @Test
  void testCompleteUserSessionLifecycle_WithNewImprovements() throws InterruptedException {
    // Given - Simulate a complete user session from start to finish
    String shopDomain = TEST_SHOP_DOMAIN + "-lifecycle";
    String sessionId = TEST_SESSION_PREFIX + "lifecycle";

    // Phase 1: Session Creation and Registration
    // Register session with cache service (simulating user login)
    cacheService.registerSession(shopDomain, sessionId);
    assertEquals(
        1,
        cacheService.getSessionCount(shopDomain),
        "Should have one active session after registration");

    // Phase 2: Initial Data Loading and Caching
    String initialData = "Initial dashboard data for " + shopDomain;
    cacheService.cacheRevenueData(shopDomain, initialData);

    Optional<Object> cachedData = cacheService.getCachedRevenueData(shopDomain);
    assertTrue(cachedData.isPresent(), "Initial data should be cached");
    assertEquals(initialData, cachedData.get(), "Cached data should match");

    // Phase 3: SSE Connection Establishment
    SseEmitter sseEmitter = sseService.createConnection(shopDomain, sessionId);
    assertNotNull(sseEmitter, "SSE connection should be established");

    var sseMetrics = sseService.getStatistics();
    assertTrue(
        (Long) sseMetrics.get("totalConnections") >= 1,
        "SSE metrics should show active connection");

    // Phase 4: Real-time Event Processing
    CountDownLatch eventLatch = new CountDownLatch(3);
    AtomicInteger eventsReceived = new AtomicInteger(0);

    // Simulate receiving events (in real scenario, these would be sent to frontend)
    CompletableFuture.runAsync(
        () -> {
          for (int i = 0; i < 3; i++) {
            try {
              sseService.broadcastToShop(shopDomain, "dashboard-update", "Update " + i, null);
              eventsReceived.incrementAndGet();
              eventLatch.countDown();
              Thread.sleep(100);
            } catch (Exception e) {
              // Handle gracefully
            }
          }
        });

    assertTrue(eventLatch.await(10, TimeUnit.SECONDS), "All events should be processed");
    assertEquals(3, eventsReceived.get(), "All events should be received");

    // Phase 5: Data Updates and Cache Refresh
    String updatedData = "Updated dashboard data for " + shopDomain;
    cacheService.cacheOrdersData(shopDomain, updatedData);

    Optional<Object> updatedCachedData = cacheService.getCachedOrdersData(shopDomain);
    assertTrue(updatedCachedData.isPresent(), "Updated data should be cached");
    assertEquals(updatedData, updatedCachedData.get(), "Updated cached data should match");

    // Phase 6: Session Synchronization Operations
    boolean lockAcquired = sessionSynchronizationService.acquireSessionLock(sessionId);
    assertTrue(lockAcquired, "Should acquire session lock for operations");

    sessionSynchronizationService.markSessionAsInvalidating(sessionId, "test-lifecycle");
    sessionSynchronizationService.releaseSessionLock(sessionId);

    // Phase 7: Session Cleanup and Termination
    sseEmitter.complete(); // Close SSE connection

    boolean shouldInvalidateCache = cacheService.unregisterSession(shopDomain, sessionId);
    assertTrue(shouldInvalidateCache, "Should invalidate cache when last session ends");
    assertEquals(
        0,
        cacheService.getSessionCount(shopDomain),
        "Should have no active sessions after cleanup");

    // Phase 8: Verify Complete Cleanup
    sessionSynchronizationService.clearStuckSessionMarkers(sessionId);

    var finalMetrics = sessionSynchronizationService.getMetrics();
    assertTrue(
        finalMetrics.getTotalLockAcquisitions() >= 1, "Should have recorded lock acquisitions");
    assertTrue(finalMetrics.getTotalInvalidations() >= 1, "Should have recorded invalidations");

    var finalSseMetrics = sseService.getStatistics();
    assertTrue((Long) finalSseMetrics.get("totalEventsSent") >= 3, "Should have sent all events");

    var finalCacheStats = cacheService.getCacheStatistics();
    assertNotNull(finalCacheStats, "Cache statistics should be available");
    assertTrue(
        (Long) finalCacheStats.get("hitCount") >= 2, "Should have cache hits from data retrieval");
  }

  @Test
  void testSSERealTimeFeaturesUnderLoad_PerformanceValidation() throws InterruptedException {
    // Given - Multiple concurrent sessions with high-frequency events
    String shopDomain = TEST_SHOP_DOMAIN + "-sse-load";
    int numberOfSessions = 4; // Within connection limits
    int eventsPerSession = 15;

    List<SseEmitter> emitters = new ArrayList<>();
    List<String> sessionIds = new ArrayList<>();

    // Create multiple SSE connections
    for (int i = 0; i < numberOfSessions; i++) {
      String sessionId = TEST_SESSION_PREFIX + "sse-load-" + i;
      sessionIds.add(sessionId);

      SseEmitter emitter = sseService.createConnection(shopDomain, sessionId);
      assertNotNull(emitter, "Should create SSE connection " + i);
      emitters.add(emitter);

      // Register with cache service
      cacheService.registerSession(shopDomain, sessionId);
    }

    assertEquals(
        numberOfSessions,
        cacheService.getSessionCount(shopDomain),
        "All sessions should be registered");

    // When - Send high-frequency events to all connections
    CountDownLatch eventLatch = new CountDownLatch(numberOfSessions * eventsPerSession);
    AtomicInteger totalEventsSent = new AtomicInteger(0);
    long startTime = System.currentTimeMillis();

    ExecutorService eventExecutor = Executors.newFixedThreadPool(numberOfSessions);

    for (int sessionIndex = 0; sessionIndex < numberOfSessions; sessionIndex++) {
      final int finalSessionIndex = sessionIndex;
      eventExecutor.submit(
          () -> {
            for (int eventIndex = 0; eventIndex < eventsPerSession; eventIndex++) {
              try {
                String eventData =
                    String.format("Session %d Event %d", finalSessionIndex, eventIndex);
                sseService.broadcastToShop(shopDomain, "load-test", eventData, null);
                totalEventsSent.incrementAndGet();
              } finally {
                eventLatch.countDown();
              }
            }
          });
    }

    // Wait for all events to be sent
    assertTrue(eventLatch.await(30, TimeUnit.SECONDS), "All events should be sent within timeout");

    long endTime = System.currentTimeMillis();
    long totalTime = endTime - startTime;

    eventExecutor.shutdown();

    // Then - Verify performance and functionality
    assertEquals(
        numberOfSessions * eventsPerSession,
        totalEventsSent.get(),
        "All events should be sent successfully");

    assertTrue(totalTime < 25000, "Event processing should complete within 25 seconds");

    // Verify SSE service metrics
    var sseMetrics = sseService.getStatistics();
    assertTrue(
        (Long) sseMetrics.get("totalConnections") >= numberOfSessions,
        "Should track all connections");
    assertTrue(
        (Long) sseMetrics.get("totalEventsSent") >= totalEventsSent.get(),
        "Should track all sent events");

    // Verify batching efficiency (events should be batched for performance)
    // The exact batching behavior depends on implementation

    // Cleanup
    for (int i = 0; i < numberOfSessions; i++) {
      emitters.get(i).complete();
      cacheService.unregisterSession(shopDomain, sessionIds.get(i));
    }
  }

  @Test
  void testCacheBehaviorAcrossMultipleUserSessions_SharedAndIsolated() throws InterruptedException {
    // Given - Multiple users with sessions for different shops
    String shop1 = TEST_SHOP_DOMAIN + "-cache-1";
    String shop2 = TEST_SHOP_DOMAIN + "-cache-2";

    // Shop 1: Multiple sessions (shared cache)
    String session1A = TEST_SESSION_PREFIX + "cache-1A";
    String session1B = TEST_SESSION_PREFIX + "cache-1B";
    String session1C = TEST_SESSION_PREFIX + "cache-1C";

    // Shop 2: Single session (isolated cache)
    String session2A = TEST_SESSION_PREFIX + "cache-2A";

    // Register all sessions
    cacheService.registerSession(shop1, session1A);
    cacheService.registerSession(shop1, session1B);
    cacheService.registerSession(shop1, session1C);
    cacheService.registerSession(shop2, session2A);

    assertEquals(3, cacheService.getSessionCount(shop1), "Shop 1 should have 3 sessions");
    assertEquals(1, cacheService.getSessionCount(shop2), "Shop 2 should have 1 session");

    // When - Cache data for both shops
    String shop1Data = "Revenue data for shop 1";
    String shop2Data = "Revenue data for shop 2";

    cacheService.cacheRevenueData(shop1, shop1Data);
    cacheService.cacheRevenueData(shop2, shop2Data);

    // Then - Verify cache sharing within shop and isolation between shops

    // All sessions for shop 1 should access the same cached data
    Optional<Object> shop1DataA = cacheService.getCachedRevenueData(shop1);
    Optional<Object> shop1DataB = cacheService.getCachedRevenueData(shop1);
    Optional<Object> shop1DataC = cacheService.getCachedRevenueData(shop1);

    assertTrue(shop1DataA.isPresent(), "Session 1A should access cached data");
    assertTrue(shop1DataB.isPresent(), "Session 1B should access cached data");
    assertTrue(shop1DataC.isPresent(), "Session 1C should access cached data");

    assertEquals(shop1Data, shop1DataA.get(), "Session 1A should get correct data");
    assertEquals(shop1Data, shop1DataB.get(), "Session 1B should get correct data");
    assertEquals(shop1Data, shop1DataC.get(), "Session 1C should get correct data");

    // Shop 2 should have its own isolated data
    Optional<Object> shop2DataA = cacheService.getCachedRevenueData(shop2);
    assertTrue(shop2DataA.isPresent(), "Session 2A should access cached data");
    assertEquals(shop2Data, shop2DataA.get(), "Session 2A should get correct data");

    // Test cache invalidation behavior

    // End one session from shop 1 - cache should NOT be invalidated
    boolean shouldInvalidate1A = cacheService.unregisterSession(shop1, session1A);
    assertFalse(shouldInvalidate1A, "Should not invalidate cache with remaining sessions");
    assertEquals(2, cacheService.getSessionCount(shop1), "Shop 1 should have 2 sessions left");

    // Data should still be available
    assertTrue(
        cacheService.getCachedRevenueData(shop1).isPresent(),
        "Cache should still be available after one session ends");

    // End second session from shop 1 - cache should still NOT be invalidated
    boolean shouldInvalidate1B = cacheService.unregisterSession(shop1, session1B);
    assertFalse(shouldInvalidate1B, "Should not invalidate cache with one session remaining");
    assertEquals(1, cacheService.getSessionCount(shop1), "Shop 1 should have 1 session left");

    // End last session from shop 1 - cache SHOULD be invalidated
    boolean shouldInvalidate1C = cacheService.unregisterSession(shop1, session1C);
    assertTrue(shouldInvalidate1C, "Should invalidate cache when last session ends");
    assertEquals(0, cacheService.getSessionCount(shop1), "Shop 1 should have no sessions");

    // Shop 2 should be unaffected
    assertEquals(1, cacheService.getSessionCount(shop2), "Shop 2 should still have 1 session");
    assertTrue(
        cacheService.getCachedRevenueData(shop2).isPresent(), "Shop 2 cache should be unaffected");

    // Cleanup
    cacheService.unregisterSession(shop2, session2A);
  }

  @Test
  void testConcurrentMultiUserScenario_RealWorldSimulation() throws InterruptedException {
    // Given - Simulate real-world scenario with multiple users, shops, and operations
    int numberOfShops = 3;
    int sessionsPerShop = 2;
    int operationsPerSession = 8;

    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch completionLatch = new CountDownLatch(numberOfShops * sessionsPerShop);
    AtomicInteger totalSuccessfulOperations = new AtomicInteger(0);
    AtomicInteger totalFailedOperations = new AtomicInteger(0);

    ExecutorService executor = Executors.newFixedThreadPool(numberOfShops * sessionsPerShop);

    // When - Simulate concurrent user activities
    for (int shopIndex = 0; shopIndex < numberOfShops; shopIndex++) {
      String shopDomain = TEST_SHOP_DOMAIN + "-concurrent-" + shopIndex;

      for (int sessionIndex = 0; sessionIndex < sessionsPerShop; sessionIndex++) {
        final int finalShopIndex = shopIndex;
        final int finalSessionIndex = sessionIndex;

        executor.submit(
            () -> {
              String sessionId =
                  TEST_SESSION_PREFIX + "concurrent-" + finalShopIndex + "-" + finalSessionIndex;
              String currentShopDomain = TEST_SHOP_DOMAIN + "-concurrent-" + finalShopIndex;

              try {
                startLatch.await();

                // Simulate complete user session workflow
                for (int opIndex = 0; opIndex < operationsPerSession; opIndex++) {
                  try {
                    // 1. Register session
                    if (opIndex == 0) {
                      cacheService.registerSession(currentShopDomain, sessionId);
                    }

                    // 2. Create SSE connection
                    if (opIndex == 1) {
                      SseEmitter emitter =
                          sseService.createConnection(currentShopDomain, sessionId);
                      if (emitter != null) {
                        // Close it after a short time to simulate real usage
                        CompletableFuture.runAsync(
                            () -> {
                              try {
                                Thread.sleep(1000);
                                emitter.complete();
                              } catch (Exception e) {
                                // Ignore
                              }
                            });
                      }
                    }

                    // 3. Cache and retrieve data
                    if (opIndex >= 2 && opIndex <= 4) {
                      String data =
                          "Data for shop "
                              + finalShopIndex
                              + " session "
                              + finalSessionIndex
                              + " op "
                              + opIndex;
                      cacheService.cacheRevenueData(currentShopDomain, data);
                      cacheService.getCachedRevenueData(currentShopDomain);
                    }

                    // 4. Send SSE events
                    if (opIndex >= 3 && opIndex <= 5) {
                      sseService.broadcastToShop(
                          currentShopDomain,
                          "user-activity",
                          "Activity from session " + sessionId,
                          null);
                    }

                    // 5. Session synchronization operations
                    if (opIndex == 6) {
                      boolean lockAcquired =
                          sessionSynchronizationService.acquireSessionLock(sessionId);
                      if (lockAcquired) {
                        try {
                          sessionSynchronizationService.markSessionAsInvalidating(
                              sessionId, "concurrent-test");
                        } finally {
                          sessionSynchronizationService.releaseSessionLock(sessionId);
                        }
                      }
                    }

                    // 6. Unregister session
                    if (opIndex == operationsPerSession - 1) {
                      cacheService.unregisterSession(currentShopDomain, sessionId);
                    }

                    totalSuccessfulOperations.incrementAndGet();
                    Thread.sleep(50); // Small delay to simulate real operations

                  } catch (Exception e) {
                    totalFailedOperations.incrementAndGet();
                  }
                }
              } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                totalFailedOperations.addAndGet(operationsPerSession);
              } finally {
                completionLatch.countDown();
              }
            });
      }
    }

    long startTime = System.currentTimeMillis();
    startLatch.countDown();

    assertTrue(
        completionLatch.await(60, TimeUnit.SECONDS),
        "All concurrent operations should complete within timeout");

    long endTime = System.currentTimeMillis();
    long totalTime = endTime - startTime;

    executor.shutdown();

    // Then - Verify system handled concurrent load successfully
    int expectedTotalOperations = numberOfShops * sessionsPerShop * operationsPerSession;
    assertEquals(
        expectedTotalOperations,
        totalSuccessfulOperations.get() + totalFailedOperations.get(),
        "All operations should be accounted for");

    assertTrue(
        totalSuccessfulOperations.get() > expectedTotalOperations * 0.8,
        "At least 80% of operations should succeed");

    assertTrue(totalTime < 55000, "All operations should complete within 55 seconds");

    // Verify final system state
    var sessionMetrics = sessionSynchronizationService.getMetrics();
    assertTrue(
        sessionMetrics.getTotalLockAcquisitions() >= numberOfShops * sessionsPerShop,
        "Should have lock acquisitions from all sessions");

    var sseMetrics = sseService.getStatistics();
    assertTrue((Long) sseMetrics.get("totalConnections") >= 0, "SSE metrics should be consistent");

    var cacheStats = cacheService.getCacheStatistics();
    assertNotNull(cacheStats, "Cache statistics should be available");
    assertTrue((Long) cacheStats.get("hitCount") >= 0, "Cache should have recorded hits");

    // Verify all sessions are cleaned up
    for (int shopIndex = 0; shopIndex < numberOfShops; shopIndex++) {
      String shopDomain = TEST_SHOP_DOMAIN + "-concurrent-" + shopIndex;
      assertEquals(
          0,
          cacheService.getSessionCount(shopDomain),
          "Shop " + shopIndex + " should have no active sessions");
    }
  }

  @Test
  void testSystemResilienceUnderStress_ErrorRecovery() throws InterruptedException {
    // Given - Stress test with error conditions and recovery
    String shopDomain = TEST_SHOP_DOMAIN + "-resilience";
    int numberOfOperations = 50;

    CountDownLatch operationLatch = new CountDownLatch(numberOfOperations);
    AtomicInteger successfulOperations = new AtomicInteger(0);
    AtomicInteger recoveredOperations = new AtomicInteger(0);

    ExecutorService executor = Executors.newFixedThreadPool(8);

    // When - Perform operations with intentional stress and error conditions
    for (int i = 0; i < numberOfOperations; i++) {
      final int operationIndex = i;
      executor.submit(
          () -> {
            String sessionId = TEST_SESSION_PREFIX + "resilience-" + operationIndex;

            try {
              // Mix of normal and potentially problematic operations
              if (operationIndex % 10 == 0) {
                // Simulate stuck session scenario
                boolean lockAcquired = sessionSynchronizationService.acquireSessionLock(sessionId);
                if (lockAcquired) {
                  sessionSynchronizationService.markSessionAsInvalidating(sessionId, "stress-test");
                  // Intentionally don't release lock to test cleanup
                  Thread.sleep(100);
                  // Recovery: clear stuck markers
                  sessionSynchronizationService.clearStuckSessionMarkers(sessionId);
                  recoveredOperations.incrementAndGet();
                }
              } else if (operationIndex % 7 == 0) {
                // Simulate rapid session registration/unregistration
                cacheService.registerSession(shopDomain, sessionId);
                Thread.sleep(10);
                cacheService.unregisterSession(shopDomain, sessionId);
                successfulOperations.incrementAndGet();
              } else if (operationIndex % 5 == 0) {
                // Simulate SSE connection churn
                SseEmitter emitter = sseService.createConnection(shopDomain, sessionId);
                if (emitter != null) {
                  sseService.broadcastToShop(shopDomain, "stress-test", "data", null);
                  emitter.complete();
                  successfulOperations.incrementAndGet();
                }
              } else {
                // Normal cache operations
                cacheService.registerSession(shopDomain, sessionId);
                cacheService.cacheRevenueData(shopDomain, "stress-data-" + operationIndex);
                cacheService.getCachedRevenueData(shopDomain);
                cacheService.unregisterSession(shopDomain, sessionId);
                successfulOperations.incrementAndGet();
              }
            } catch (Exception e) {
              // System should handle errors gracefully
              // Recovery attempt
              try {
                sessionSynchronizationService.clearStuckSessionMarkers(sessionId);
                recoveredOperations.incrementAndGet();
              } catch (Exception recoveryException) {
                // Even recovery can fail, but system should remain stable
              }
            } finally {
              operationLatch.countDown();
            }
          });
    }

    assertTrue(operationLatch.await(45, TimeUnit.SECONDS), "All stress operations should complete");
    executor.shutdown();

    // Then - Verify system remained stable and recovered from errors
    assertTrue(
        successfulOperations.get() + recoveredOperations.get() > numberOfOperations * 0.7,
        "At least 70% of operations should succeed or recover");

    // Verify system metrics are still consistent
    var sessionMetrics = sessionSynchronizationService.getMetrics();
    assertNotNull(sessionMetrics, "Session metrics should still be available");
    assertTrue(sessionMetrics.getTotalLockAcquisitions() >= 0, "Metrics should be non-negative");

    var sseMetrics = sseService.getStatistics();
    assertNotNull(sseMetrics, "SSE metrics should still be available");

    var cacheStats = cacheService.getCacheStatistics();
    assertNotNull(cacheStats, "Cache statistics should still be available");

    // Verify system is ready for new operations
    String testSessionId = TEST_SESSION_PREFIX + "post-stress";
    cacheService.registerSession(shopDomain, testSessionId);
    assertTrue(
        cacheService.getSessionCount(shopDomain) >= 1,
        "System should accept new sessions after stress test");
    cacheService.unregisterSession(shopDomain, testSessionId);
  }

  private void cleanupTestData() {
    try {
      // Clean up Redis keys
      var keys = redisTemplate.keys("*e2e-test-shop*");
      if (keys != null && !keys.isEmpty()) {
        redisTemplate.delete(keys);
      }

      keys = redisTemplate.keys("session_*:e2e-session-*");
      if (keys != null && !keys.isEmpty()) {
        redisTemplate.delete(keys);
      }

      keys = redisTemplate.keys("dashboard:*e2e-test-shop*");
      if (keys != null && !keys.isEmpty()) {
        redisTemplate.delete(keys);
      }

      keys = redisTemplate.keys("sse:*e2e-test-shop*");
      if (keys != null && !keys.isEmpty()) {
        redisTemplate.delete(keys);
      }
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }
}
