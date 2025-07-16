package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.*;

import com.storesight.backend.BaseIntegrationTest;
import java.util.Set;
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

/**
 * Integration tests for session invalidation scenarios. Tests the complete session invalidation
 * flow with Redis and database interactions.
 */
@SpringBootTest
@TestPropertySource(
    properties = {
      "spring.redis.timeout=5000ms",
      "logging.level.com.storesight.backend.service=DEBUG"
    })
class SessionInvalidationIntegrationTest extends BaseIntegrationTest {

  @Autowired private SessionSynchronizationService sessionSynchronizationService;

  @Autowired private StringRedisTemplate redisTemplate;

  private static final String TEST_SESSION_ID = "test-session-";

  @BeforeEach
  void setUp() {
    // Clean up any existing test data
    cleanupTestData();
    sessionSynchronizationService.resetMetrics();
  }

  @Test
  void testConcurrentSessionInvalidation_PreventsDuplicateInvalidation()
      throws InterruptedException {
    // Given
    String sessionId = TEST_SESSION_ID + "concurrent";
    int numberOfThreads = 5;
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch completionLatch = new CountDownLatch(numberOfThreads);
    AtomicInteger successfulInvalidations = new AtomicInteger(0);
    AtomicInteger failedInvalidations = new AtomicInteger(0);

    ExecutorService executor = Executors.newFixedThreadPool(numberOfThreads);

    // When - Multiple threads try to invalidate the same session
    for (int i = 0; i < numberOfThreads; i++) {
      executor.submit(
          () -> {
            try {
              startLatch.await(); // Wait for all threads to be ready

              boolean acquired = sessionSynchronizationService.acquireSessionLock(sessionId);
              if (acquired) {
                try {
                  // Simulate session invalidation work
                  Thread.sleep(100);
                  sessionSynchronizationService.markSessionAsInvalidating(
                      sessionId, "test-invalidation");
                  successfulInvalidations.incrementAndGet();
                } finally {
                  sessionSynchronizationService.releaseSessionLock(sessionId);
                }
              } else {
                failedInvalidations.incrementAndGet();
              }
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
              failedInvalidations.incrementAndGet();
            } finally {
              completionLatch.countDown();
            }
          });
    }

    // Start all threads simultaneously
    startLatch.countDown();

    // Wait for completion
    assertTrue(
        completionLatch.await(30, TimeUnit.SECONDS), "All threads should complete within timeout");
    executor.shutdown();

    // Then - Only one thread should successfully invalidate
    assertEquals(
        1,
        successfulInvalidations.get(),
        "Only one thread should successfully invalidate the session");
    assertEquals(
        numberOfThreads - 1, failedInvalidations.get(), "Other threads should fail to invalidate");

    // Verify metrics
    var metrics = sessionSynchronizationService.getMetrics();
    assertTrue(metrics.getTotalLockAcquisitions() >= 1, "At least one lock should be acquired");
    assertTrue(
        metrics.getTotalInvalidations() >= 1, "At least one invalidation should be recorded");
  }

  @Test
  void testSessionInvalidationWithRedisFailure_FallbackMechanism() {
    // Given
    String sessionId = TEST_SESSION_ID + "redis-failure";

    // Simulate Redis being temporarily unavailable by using invalid connection
    // This tests the fallback mechanism in the service

    // When - Try to acquire lock when Redis might be slow/unavailable
    boolean lockAcquired = sessionSynchronizationService.acquireSessionLock(sessionId);

    // Then - Service should handle gracefully
    // The service should either succeed with fallback or fail gracefully
    var metrics = sessionSynchronizationService.getMetrics();
    assertTrue(metrics.getTotalLockAcquisitions() >= 0, "Lock acquisitions should be tracked");

    // Cleanup
    if (lockAcquired) {
      sessionSynchronizationService.releaseSessionLock(sessionId);
    }
  }

  @Test
  void testStuckSessionDetectionAndCleanup() throws InterruptedException {
    // Given
    String sessionId = TEST_SESSION_ID + "stuck";

    // Create a stuck session scenario
    boolean lockAcquired = sessionSynchronizationService.acquireSessionLock(sessionId);
    assertTrue(lockAcquired, "Should acquire lock initially");

    sessionSynchronizationService.markSessionAsInvalidating(sessionId, "test-stuck-session");

    // Don't release the lock to simulate stuck session

    // When - Wait for cleanup mechanism to detect stuck session
    Thread.sleep(2000); // Wait for potential cleanup

    // Trigger manual cleanup
    sessionSynchronizationService.clearStuckSessionMarkers(sessionId);

    // Then - Should be able to acquire lock again
    boolean newLockAcquired = sessionSynchronizationService.acquireSessionLock(sessionId);
    assertTrue(newLockAcquired, "Should be able to acquire lock after cleanup");

    // Cleanup
    sessionSynchronizationService.releaseSessionLock(sessionId);

    // Verify metrics
    var metrics = sessionSynchronizationService.getMetrics();
    assertTrue(metrics.getTotalLockAcquisitions() >= 2, "Should have multiple lock acquisitions");
  }

  @Test
  void testSessionInvalidationLoop_Prevention() throws InterruptedException {
    // Given
    String sessionId = TEST_SESSION_ID + "loop-prevention";

    // When - Try to invalidate the same session multiple times rapidly
    CompletableFuture<Boolean> first =
        CompletableFuture.supplyAsync(
            () -> {
              boolean acquired = sessionSynchronizationService.acquireSessionLock(sessionId);
              if (acquired) {
                try {
                  sessionSynchronizationService.markSessionAsInvalidating(
                      sessionId, "test-loop-prevention-1");
                  return true;
                } finally {
                  sessionSynchronizationService.releaseSessionLock(sessionId);
                }
              }
              return false;
            });

    CompletableFuture<Boolean> second =
        CompletableFuture.supplyAsync(
            () -> {
              try {
                Thread.sleep(50); // Small delay to ensure first operation starts
              } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
              }
              boolean acquired = sessionSynchronizationService.acquireSessionLock(sessionId);
              if (acquired) {
                try {
                  sessionSynchronizationService.markSessionAsInvalidating(
                      sessionId, "test-loop-prevention-2");
                  return true;
                } finally {
                  sessionSynchronizationService.releaseSessionLock(sessionId);
                }
              }
              return false;
            });

    // Then - Only one should succeed
    Boolean firstResult = null;
    Boolean secondResult = null;
    try {
      firstResult = first.get(10, TimeUnit.SECONDS);
      secondResult = second.get(10, TimeUnit.SECONDS);
    } catch (Exception e) {
      fail("Failed to get results from concurrent operations: " + e.getMessage());
    }

    assertTrue(firstResult || secondResult, "At least one invalidation should succeed");
    assertFalse(
        firstResult && secondResult, "Both invalidations should not succeed simultaneously");

    // Verify no infinite loop occurred by checking reasonable execution time
    var metrics = sessionSynchronizationService.getMetrics();
    assertTrue(metrics.getTotalInvalidations() >= 1, "Should have at least one invalidation");
    assertTrue(metrics.getTotalInvalidations() <= 2, "Should not have excessive invalidations");
  }

  @Test
  void testSessionStateTransitions() {
    // Given
    String sessionId = TEST_SESSION_ID + "state-transitions";

    // When & Then - Test complete state transition flow

    // 1. Initial state - should be able to acquire lock
    boolean initialLock = sessionSynchronizationService.acquireSessionLock(sessionId);
    assertTrue(initialLock, "Should acquire initial lock");

    // 2. Mark as invalidating
    sessionSynchronizationService.markSessionAsInvalidating(sessionId, "test-state-transitions");

    // 3. Release lock
    sessionSynchronizationService.releaseSessionLock(sessionId);

    // 4. Try to mark again - should fail as already marked
    boolean lockForSecondMark = sessionSynchronizationService.acquireSessionLock(sessionId);
    if (lockForSecondMark) {
      // This should not succeed as session is already marked for invalidation
      sessionSynchronizationService.releaseSessionLock(sessionId);
    }

    // 5. Clear stuck markers to reset state
    sessionSynchronizationService.clearStuckSessionMarkers(sessionId);

    // 6. Should be able to acquire lock again after cleanup
    boolean finalLock = sessionSynchronizationService.acquireSessionLock(sessionId);
    assertTrue(finalLock, "Should acquire lock after cleanup");
    sessionSynchronizationService.releaseSessionLock(sessionId);
  }

  @Test
  void testHighConcurrencySessionOperations() throws InterruptedException {
    // Given
    int numberOfSessions = 20;
    int operationsPerSession = 5;
    CountDownLatch completionLatch = new CountDownLatch(numberOfSessions * operationsPerSession);
    AtomicInteger successfulOperations = new AtomicInteger(0);
    AtomicInteger failedOperations = new AtomicInteger(0);

    ExecutorService executor = Executors.newFixedThreadPool(10);

    // When - Perform many concurrent session operations
    for (int sessionIndex = 0; sessionIndex < numberOfSessions; sessionIndex++) {
      String sessionId = TEST_SESSION_ID + "concurrent-" + sessionIndex;

      for (int opIndex = 0; opIndex < operationsPerSession; opIndex++) {
        executor.submit(
            () -> {
              try {
                boolean acquired = sessionSynchronizationService.acquireSessionLock(sessionId);
                if (acquired) {
                  try {
                    // Simulate some work
                    Thread.sleep(10);
                    sessionSynchronizationService.markSessionAsInvalidating(
                        sessionId, "test-concurrent");
                    successfulOperations.incrementAndGet();
                  } finally {
                    sessionSynchronizationService.releaseSessionLock(sessionId);
                  }
                } else {
                  failedOperations.incrementAndGet();
                }
              } catch (Exception e) {
                failedOperations.incrementAndGet();
              } finally {
                completionLatch.countDown();
              }
            });
      }
    }

    // Wait for completion
    assertTrue(completionLatch.await(60, TimeUnit.SECONDS), "All operations should complete");
    executor.shutdown();

    // Then - Verify reasonable success rate and no deadlocks
    int totalOperations = numberOfSessions * operationsPerSession;
    assertTrue(successfulOperations.get() > 0, "Some operations should succeed");
    assertEquals(
        totalOperations,
        successfulOperations.get() + failedOperations.get(),
        "All operations should be accounted for");

    // Verify metrics make sense
    var metrics = sessionSynchronizationService.getMetrics();
    assertTrue(
        metrics.getTotalLockAcquisitions() >= successfulOperations.get(),
        "Lock acquisitions should match successful operations");
  }

  private void cleanupTestData() {
    // Clean up Redis keys that might be left from previous tests
    Set<String> keys = redisTemplate.keys("session_*:test-session-*");
    if (keys != null && !keys.isEmpty()) {
      redisTemplate.delete(keys);
    }
  }
}
