package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Duration;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(
    properties = {
      "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
      "spring.flyway.enabled=false"
    })
class SessionSynchronizationServiceTest {

  @MockBean private StringRedisTemplate redisTemplate;
  @MockBean private ValueOperations<String, String> valueOperations;
  @MockBean private EnhancedRedisService enhancedRedisService;
  @MockBean private MetricsCollectionService metricsCollectionService;

  @Autowired private SessionSynchronizationService sessionSynchronizationService;

  @BeforeEach
  void setUp() {
    when(redisTemplate.opsForValue()).thenReturn(valueOperations);
  }

  @Test
  void testAcquireSessionLock_Success() {
    // Given
    String sessionId = "test-session-123";
    when(valueOperations.setIfAbsent(anyString(), eq("locked"), any(Duration.class)))
        .thenReturn(true);

    // When
    boolean result = sessionSynchronizationService.acquireSessionLock(sessionId);

    // Then
    assertTrue(result);
    verify(valueOperations)
        .setIfAbsent(eq("session_lock:" + sessionId), eq("locked"), any(Duration.class));
  }

  @Test
  void testAcquireSessionLock_Failure() {
    // Given
    String sessionId = "test-session-123";
    when(valueOperations.setIfAbsent(anyString(), eq("locked"), any(Duration.class)))
        .thenReturn(false);

    // When
    boolean result = sessionSynchronizationService.acquireSessionLock(sessionId);

    // Then
    assertFalse(result);
  }

  @Test
  void testMarkSessionAsInvalidating() {
    // Given
    String sessionId = "test-session-123";
    String reason = "user logout";

    // When
    sessionSynchronizationService.markSessionAsInvalidating(sessionId, reason);

    // Then
    verify(valueOperations)
        .set(eq("session_invalidation:" + sessionId), eq(reason), any(Duration.class));
    verify(valueOperations)
        .set(eq("session_state:" + sessionId), eq("invalidating"), any(Duration.class));
  }

  @Test
  void testIsSessionInvalidating_True() {
    // Given
    String sessionId = "test-session-123";
    when(redisTemplate.hasKey("session_invalidation:" + sessionId)).thenReturn(true);

    // When
    boolean result = sessionSynchronizationService.isSessionInvalidating(sessionId);

    // Then
    assertTrue(result);
  }

  @Test
  void testIsSessionInvalidating_False() {
    // Given
    String sessionId = "test-session-123";
    when(redisTemplate.hasKey("session_invalidation:" + sessionId)).thenReturn(false);

    // When
    boolean result = sessionSynchronizationService.isSessionInvalidating(sessionId);

    // Then
    assertFalse(result);
  }

  @Test
  void testClearStuckSessionMarkers() {
    // Given
    String sessionId = "test-session-123";

    // When
    sessionSynchronizationService.clearStuckSessionMarkers(sessionId);

    // Then
    verify(redisTemplate).delete("session_invalidation:" + sessionId);
    verify(redisTemplate).delete("session_state:" + sessionId);
    verify(redisTemplate).delete("session_lock:" + sessionId);
  }

  @Test
  void testSafeInvalidateSession_AlreadyInvalidating() {
    // Given
    String sessionId = "test-session-123";
    String reason = "timeout";
    when(redisTemplate.hasKey("session_invalidation:" + sessionId)).thenReturn(true);

    // When
    sessionSynchronizationService.safeInvalidateSession(sessionId, reason);

    // Then
    // Should not proceed with invalidation if already invalidating
    verify(valueOperations, never())
        .set(eq("session_invalidation:" + sessionId), eq(reason), any(Duration.class));
  }

  @Test
  void testShouldAllowSessionOperation_NotInvalidating() {
    // Given
    String sessionId = "test-session-123";
    when(redisTemplate.hasKey("session_invalidation:" + sessionId)).thenReturn(false);

    // When
    boolean result = sessionSynchronizationService.shouldAllowSessionOperation(sessionId);

    // Then
    assertTrue(result);
  }

  @Test
  void testShouldAllowSessionOperation_IsInvalidating() {
    // Given
    String sessionId = "test-session-123";
    when(redisTemplate.hasKey("session_invalidation:" + sessionId)).thenReturn(true);

    // When
    boolean result = sessionSynchronizationService.shouldAllowSessionOperation(sessionId);

    // Then
    assertFalse(result);
  }

  @Test
  void testExecuteWithSessionLock_SessionInvalidating() {
    // Given
    String sessionId = "test-session-123";
    when(redisTemplate.hasKey("session_invalidation:" + sessionId)).thenReturn(true);

    // When
    String result =
        sessionSynchronizationService.executeWithSessionLock(sessionId, () -> "should not execute");

    // Then
    assertNull(result); // Should return null when session is invalidating
  }

  @Test
  void testExecuteWithSessionLock_Success() {
    // Given
    String sessionId = "test-session-123";
    String expectedResult = "operation completed";

    when(redisTemplate.hasKey("session_invalidation:" + sessionId)).thenReturn(false);
    when(valueOperations.setIfAbsent(anyString(), eq("locked"), any(Duration.class)))
        .thenReturn(true);

    // When
    String result =
        sessionSynchronizationService.executeWithSessionLock(sessionId, () -> expectedResult);

    // Then
    assertEquals(expectedResult, result);
    verify(redisTemplate).delete("session_lock:" + sessionId); // Lock should be released
  }

  @Test
  void testGetMetrics() {
    // Given - perform some operations to generate metrics
    String sessionId = "test-session-123";
    when(valueOperations.setIfAbsent(anyString(), eq("locked"), any(Duration.class)))
        .thenReturn(true);

    // Perform operations that will update metrics
    sessionSynchronizationService.acquireSessionLock(sessionId);
    sessionSynchronizationService.markSessionAsInvalidating(sessionId, "test");
    sessionSynchronizationService.clearStuckSessionMarkers(sessionId);

    // When
    SessionSynchronizationService.SessionSynchronizationMetrics metrics =
        sessionSynchronizationService.getMetrics();

    // Then
    assertNotNull(metrics);
    assertEquals(1, metrics.getTotalLockAcquisitions());
    assertEquals(1, metrics.getTotalInvalidations());
    assertEquals(1, metrics.getTotalStuckSessionsCleared());
    assertTrue(metrics.getLockSuccessRate() > 0);
  }

  @Test
  void testResetMetrics() {
    // Given - perform some operations to generate metrics
    String sessionId = "test-session-123";
    when(valueOperations.setIfAbsent(anyString(), eq("locked"), any(Duration.class)))
        .thenReturn(true);

    sessionSynchronizationService.acquireSessionLock(sessionId);
    sessionSynchronizationService.markSessionAsInvalidating(sessionId, "test");

    // Verify metrics are not zero
    SessionSynchronizationService.SessionSynchronizationMetrics beforeReset =
        sessionSynchronizationService.getMetrics();
    assertTrue(beforeReset.getTotalLockAcquisitions() > 0);

    // When
    sessionSynchronizationService.resetMetrics();

    // Then
    SessionSynchronizationService.SessionSynchronizationMetrics afterReset =
        sessionSynchronizationService.getMetrics();
    assertEquals(0, afterReset.getTotalLockAcquisitions());
    assertEquals(0, afterReset.getTotalInvalidations());
    assertEquals(0, afterReset.getTotalStuckSessionsCleared());
  }

  @Test
  void testGetLockStatistics() {
    // Given
    String sessionId = "test-session-123";
    when(valueOperations.setIfAbsent(anyString(), eq("locked"), any(Duration.class)))
        .thenReturn(true);

    // Acquire a lock to generate statistics
    sessionSynchronizationService.acquireSessionLock(sessionId);

    // When
    SessionSynchronizationService.SessionLockStatistics stats =
        sessionSynchronizationService.getLockStatistics();

    // Then
    assertNotNull(stats);
    assertTrue(stats.getTotalInMemoryLocks() >= 0);
    assertTrue(stats.getTotalTrackedLocks() >= 0);
  }

  @Test
  void testPerformComprehensiveCleanup() {
    // Given
    Set<String> orphanedLocks = Set.of("session_lock:orphaned1", "session_lock:orphaned2");
    Set<String> stuckMarkers = Set.of("session_invalidation:stuck1", "session_invalidation:stuck2");
    when(redisTemplate.keys("session_lock:*")).thenReturn(orphanedLocks);
    when(redisTemplate.keys("session_invalidation:*")).thenReturn(stuckMarkers);

    // When
    SessionSynchronizationService.CleanupResult result =
        sessionSynchronizationService.performComprehensiveCleanup();

    // Then
    assertNotNull(result);
    assertTrue(result.isSuccess());
    assertTrue(result.getTotalItemsCleared() >= 0);
  }

  @Test
  void testCleanupExpiredLocks() {
    // Given
    Set<String> orphanedLocks = Set.of("session_lock:orphaned1", "session_lock:orphaned2");
    when(redisTemplate.keys("session_lock:*")).thenReturn(orphanedLocks);

    // When
    sessionSynchronizationService.cleanupExpiredLocks();

    // Then
    verify(redisTemplate, times(2)).delete(anyString());
    SessionSynchronizationService.SessionSynchronizationMetrics metrics =
        sessionSynchronizationService.getMetrics();
    assertTrue(metrics.getTotalOrphanedLocksCleared() >= 0);
  }

  @Test
  void testScheduledCleanup() {
    // Given
    Set<String> orphanedLocks = Set.of("session_lock:orphaned1");
    Set<String> stuckMarkers = Set.of("session_invalidation:stuck1");
    when(redisTemplate.keys("session_lock:*")).thenReturn(orphanedLocks);
    when(redisTemplate.keys("session_invalidation:*")).thenReturn(stuckMarkers);

    // When
    sessionSynchronizationService.scheduledCleanup();

    // Then
    verify(redisTemplate, atLeastOnce()).delete(anyString());
    SessionSynchronizationService.SessionSynchronizationMetrics metrics =
        sessionSynchronizationService.getMetrics();
    assertEquals(1, metrics.getTotalScheduledCleanupRuns());
  }

  @Test
  void testCleanupStuckSessionMarkers() {
    // Given
    Set<String> stuckMarkers = Set.of("session_invalidation:stuck1", "session_invalidation:stuck2");
    when(redisTemplate.keys("session_invalidation:*")).thenReturn(stuckMarkers);

    // When
    sessionSynchronizationService.cleanupStuckSessionMarkers();

    // Then
    verify(redisTemplate, atLeastOnce()).delete(anyString());
    SessionSynchronizationService.SessionSynchronizationMetrics metrics =
        sessionSynchronizationService.getMetrics();
    assertTrue(metrics.getTotalStuckSessionsCleared() >= 0);
  }

  @Test
  void testMarkSessionAsInvalidating_RedisFailure() {
    // Given
    String sessionId = "test-session-123";
    String reason = "timeout";
    doThrow(new RuntimeException("Redis connection failed"))
        .when(valueOperations)
        .set(anyString(), anyString(), any(Duration.class));

    // When - should not throw exception
    assertDoesNotThrow(
        () -> sessionSynchronizationService.markSessionAsInvalidating(sessionId, reason));

    // Then - should clear markers on error
    verify(redisTemplate, atLeastOnce()).delete(anyString());
  }

  @Test
  void testAcquireSessionLock_RedisException() {
    // Given
    String sessionId = "test-session-123";
    doThrow(new RuntimeException("Redis connection failed"))
        .when(valueOperations)
        .setIfAbsent(anyString(), anyString(), any(Duration.class));

    // When
    boolean result = sessionSynchronizationService.acquireSessionLock(sessionId);

    // Then
    assertFalse(result);
  }

  @Test
  void testReleaseSessionLock_RedisException() {
    // Given
    String sessionId = "test-session-123";
    doThrow(new RuntimeException("Redis connection failed"))
        .when(redisTemplate)
        .delete(anyString());

    // When - should not throw exception
    assertDoesNotThrow(() -> sessionSynchronizationService.releaseSessionLock(sessionId));
  }

  @Test
  void testIsSessionInvalidating_RedisException() {
    // Given
    String sessionId = "test-session-123";
    doThrow(new RuntimeException("Redis connection failed"))
        .when(redisTemplate)
        .hasKey(anyString());

    // When
    boolean result = sessionSynchronizationService.isSessionInvalidating(sessionId);

    // Then
    assertFalse(result); // Should return false on Redis failure
  }

  @Test
  void testClearSessionInvalidationMarkers_RedisException() {
    // Given
    String sessionId = "test-session-123";
    doThrow(new RuntimeException("Redis connection failed"))
        .when(redisTemplate)
        .delete(anyString());

    // When - should not throw exception
    assertDoesNotThrow(() -> sessionSynchronizationService.clearStuckSessionMarkers(sessionId));
  }

  @Test
  void testExecuteWithSessionLock_LockAcquisitionFailure() {
    // Given
    String sessionId = "test-session-123";
    when(redisTemplate.hasKey("session_invalidation:" + sessionId)).thenReturn(false);
    when(valueOperations.setIfAbsent(anyString(), eq("locked"), any(Duration.class)))
        .thenReturn(false);

    // When
    String result =
        sessionSynchronizationService.executeWithSessionLock(sessionId, () -> "should not execute");

    // Then
    assertNull(result); // Should return null when lock acquisition fails
  }

  @Test
  void testExecuteWithSessionLock_OperationException() {
    // Given
    String sessionId = "test-session-123";
    when(redisTemplate.hasKey("session_invalidation:" + sessionId)).thenReturn(false);
    when(valueOperations.setIfAbsent(anyString(), eq("locked"), any(Duration.class)))
        .thenReturn(true);

    // When & Then
    assertThrows(
        RuntimeException.class,
        () ->
            sessionSynchronizationService.executeWithSessionLock(
                sessionId,
                () -> {
                  throw new RuntimeException("Operation failed");
                }));

    // Verify lock was released even after exception
    verify(redisTemplate).delete("session_lock:" + sessionId);
  }

  @Test
  void testSafeInvalidateSession_MarkingFailure() {
    // Given
    String sessionId = "test-session-123";
    String reason = "timeout";
    when(redisTemplate.hasKey("session_invalidation:" + sessionId)).thenReturn(false);
    doThrow(new RuntimeException("Redis connection failed"))
        .when(valueOperations)
        .set(anyString(), anyString(), any(Duration.class));

    // When - should not throw exception
    assertDoesNotThrow(
        () -> sessionSynchronizationService.safeInvalidateSession(sessionId, reason));

    // Then - should clear markers on error
    verify(redisTemplate, atLeastOnce()).delete(anyString());
  }

  @Test
  void testConcurrentLockAcquisition() throws InterruptedException {
    // Given
    String sessionId = "test-session-123";
    int threadCount = 5;
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch doneLatch = new CountDownLatch(threadCount);
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);

    // Mock Redis to allow only one lock acquisition
    when(valueOperations.setIfAbsent(anyString(), eq("locked"), any(Duration.class)))
        .thenReturn(true)
        .thenReturn(false)
        .thenReturn(false)
        .thenReturn(false)
        .thenReturn(false);

    // When
    for (int i = 0; i < threadCount; i++) {
      executor.submit(
          () -> {
            try {
              startLatch.await();
              boolean acquired = sessionSynchronizationService.acquireSessionLock(sessionId);
              if (acquired) {
                sessionSynchronizationService.releaseSessionLock(sessionId);
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

    // Then - verify metrics show both successes and failures
    SessionSynchronizationService.SessionSynchronizationMetrics metrics =
        sessionSynchronizationService.getMetrics();
    assertEquals(1, metrics.getTotalLockAcquisitions());
    assertEquals(4, metrics.getTotalLockFailures());
  }

  @Test
  void testCleanupExpiredLocks_WithOrphanedLocks() {
    // Given
    Set<String> orphanedLocks = Set.of("session_lock:orphaned1", "session_lock:orphaned2");
    when(redisTemplate.keys("session_lock:*")).thenReturn(orphanedLocks);

    // When
    sessionSynchronizationService.cleanupExpiredLocks();

    // Then
    verify(redisTemplate, times(2)).delete(anyString());
    SessionSynchronizationService.SessionSynchronizationMetrics metrics =
        sessionSynchronizationService.getMetrics();
    assertTrue(metrics.getTotalOrphanedLocksCleared() >= 0);
  }

  @Test
  void testCleanupStuckSessionMarkers_WithStuckSessions() {
    // Given
    Set<String> stuckMarkers = Set.of("session_invalidation:stuck1", "session_invalidation:stuck2");
    when(redisTemplate.keys("session_invalidation:*")).thenReturn(stuckMarkers);

    // When
    sessionSynchronizationService.cleanupStuckSessionMarkers();

    // Then
    verify(redisTemplate, atLeastOnce()).delete(anyString());
    SessionSynchronizationService.SessionSynchronizationMetrics metrics =
        sessionSynchronizationService.getMetrics();
    assertTrue(metrics.getTotalStuckSessionsCleared() >= 0);
  }

  @Test
  void testPerformComprehensiveCleanup_WithRedisFailure() {
    // Given
    when(redisTemplate.keys(anyString())).thenThrow(new RuntimeException("Redis scan failed"));

    // When
    SessionSynchronizationService.CleanupResult result =
        sessionSynchronizationService.performComprehensiveCleanup();

    // Then
    assertNotNull(result);
    assertTrue(result.isSuccess()); // Should still succeed with partial cleanup
    assertTrue(result.getTotalItemsCleared() >= 0);
  }

  @Test
  void testLockStatistics_WithActiveLocks() {
    // Given
    String sessionId1 = "test-session-1";
    String sessionId2 = "test-session-2";
    when(valueOperations.setIfAbsent(anyString(), eq("locked"), any(Duration.class)))
        .thenReturn(true);

    // Acquire multiple locks
    sessionSynchronizationService.acquireSessionLock(sessionId1);
    sessionSynchronizationService.acquireSessionLock(sessionId2);

    // When
    SessionSynchronizationService.SessionLockStatistics stats =
        sessionSynchronizationService.getLockStatistics();

    // Then
    assertNotNull(stats);
    assertTrue(stats.getTotalInMemoryLocks() >= 2);
    assertTrue(stats.getTotalTrackedLocks() >= 2);
  }

  @Test
  void testMetricsAccuracy() {
    // Given
    String sessionId = "test-session-123";
    when(valueOperations.setIfAbsent(anyString(), eq("locked"), any(Duration.class)))
        .thenReturn(true)
        .thenReturn(false);

    // When - perform various operations
    sessionSynchronizationService.acquireSessionLock(sessionId); // success
    sessionSynchronizationService.acquireSessionLock(sessionId + "2"); // failure
    sessionSynchronizationService.markSessionAsInvalidating(sessionId, "test");
    sessionSynchronizationService.clearStuckSessionMarkers(sessionId);
    sessionSynchronizationService.scheduledCleanup();

    // Then
    SessionSynchronizationService.SessionSynchronizationMetrics metrics =
        sessionSynchronizationService.getMetrics();
    assertEquals(1, metrics.getTotalLockAcquisitions());
    assertEquals(1, metrics.getTotalLockFailures());
    assertEquals(1, metrics.getTotalInvalidations());
    assertEquals(1, metrics.getTotalStuckSessionsCleared());
    assertEquals(1, metrics.getTotalScheduledCleanupRuns());
    assertTrue(metrics.getTotalCleanupOperations() > 0);
  }

  @Test
  void testNullSessionIdHandling() {
    // When & Then - should handle null session IDs gracefully
    assertDoesNotThrow(() -> sessionSynchronizationService.acquireSessionLock(null));
    assertDoesNotThrow(() -> sessionSynchronizationService.releaseSessionLock(null));
    assertDoesNotThrow(() -> sessionSynchronizationService.isSessionInvalidating(null));
    assertDoesNotThrow(() -> sessionSynchronizationService.clearStuckSessionMarkers(null));
  }

  @Test
  void testEmptySessionIdHandling() {
    // When & Then - should handle empty session IDs gracefully
    assertDoesNotThrow(() -> sessionSynchronizationService.acquireSessionLock(""));
    assertDoesNotThrow(() -> sessionSynchronizationService.releaseSessionLock(""));
    assertDoesNotThrow(() -> sessionSynchronizationService.isSessionInvalidating(""));
    assertDoesNotThrow(() -> sessionSynchronizationService.clearStuckSessionMarkers(""));
  }
}
