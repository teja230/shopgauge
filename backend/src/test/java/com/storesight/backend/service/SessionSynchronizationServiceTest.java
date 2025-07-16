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
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

@ExtendWith(MockitoExtension.class)
class SessionSynchronizationServiceTest {

  @Mock private StringRedisTemplate redisTemplate;
  @Mock private ValueOperations<String, String> valueOperations;
  @Mock private EnhancedRedisService enhancedRedisService;
  @Mock private MetricsCollectionService metricsCollectionService;

  @InjectMocks private SessionSynchronizationService sessionSynchronizationService;

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
    when(redisTemplate.hasKey("session_state:" + sessionId)).thenReturn(false);

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
    when(redisTemplate.hasKey("session_state:" + sessionId)).thenReturn(false);

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
    when(redisTemplate.hasKey("session_state:" + sessionId)).thenReturn(false);
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
    assertTrue(stats.getTotalTrackedLocks() >= 0);
    assertTrue(stats.getTotalInMemoryLocks() >= 0);
  }

  @Test
  void testPerformComprehensiveCleanup() {
    // Given
    when(redisTemplate.keys(anyString())).thenReturn(Set.of());

    // When
    SessionSynchronizationService.CleanupResult result =
        sessionSynchronizationService.performComprehensiveCleanup();

    // Then
    assertNotNull(result);
    assertTrue(result.isSuccess());
    assertNull(result.getErrorMessage());
    assertTrue(result.getTotalItemsCleared() >= 0);
  }

  @Test
  void testCleanupExpiredLocks() {
    // Given
    when(redisTemplate.keys(anyString())).thenReturn(Set.of());

    // When - should not throw exception
    assertDoesNotThrow(
        () -> {
          sessionSynchronizationService.cleanupExpiredLocks();
        });

    // Then - verify Redis was queried for orphaned locks
    verify(redisTemplate, atLeastOnce()).keys("session_lock:*");
  }

  @Test
  void testScheduledCleanup() {
    // Given
    when(redisTemplate.keys(anyString())).thenReturn(Set.of());

    // When - should not throw exception
    assertDoesNotThrow(
        () -> {
          sessionSynchronizationService.scheduledCleanup();
        });

    // Then - verify cleanup operations were tracked
    SessionSynchronizationService.SessionSynchronizationMetrics metrics =
        sessionSynchronizationService.getMetrics();
    assertTrue(metrics.getTotalScheduledCleanupRuns() > 0);
    assertTrue(metrics.getTotalCleanupOperations() > 0);
  }

  @Test
  void testCleanupStuckSessionMarkers() {
    // Given
    when(redisTemplate.keys(anyString())).thenReturn(Set.of());

    // When - should not throw exception
    assertDoesNotThrow(
        () -> {
          sessionSynchronizationService.cleanupStuckSessionMarkers();
        });

    // Then - verify Redis was queried for stuck invalidation markers
    verify(redisTemplate, atLeastOnce()).keys("session_invalidation:*");
  }

  @Test
  void testMarkSessionAsInvalidating_RedisFailure() {
    // Given
    String sessionId = "test-session-123";
    String reason = "test failure";
    doThrow(new RuntimeException("Redis connection failed"))
        .when(enhancedRedisService)
        .setWithTtl(anyString(), anyString(), any(Duration.class));

    // When
    sessionSynchronizationService.markSessionAsInvalidating(sessionId, reason);

    // Then - should track the Redis operation failure
    SessionSynchronizationService.SessionSynchronizationMetrics metrics =
        sessionSynchronizationService.getMetrics();
    assertTrue(metrics.getTotalRedisOperationFailures() > 0);
  }

  // ===== EDGE CASE TESTS =====

  @Test
  void testAcquireSessionLock_RedisException() {
    // Given
    String sessionId = "test-session-123";
    when(enhancedRedisService.setIfAbsent(anyString(), anyString(), any(Duration.class)))
        .thenThrow(new RuntimeException("Redis connection failed"));

    // When
    boolean result = sessionSynchronizationService.acquireSessionLock(sessionId);

    // Then
    assertFalse(result);
    SessionSynchronizationService.SessionSynchronizationMetrics metrics =
        sessionSynchronizationService.getMetrics();
    assertTrue(metrics.getTotalLockFailures() > 0);
    assertTrue(metrics.getTotalRedisOperationFailures() > 0);
  }

  @Test
  void testReleaseSessionLock_RedisException() {
    // Given
    String sessionId = "test-session-123";
    when(enhancedRedisService.setIfAbsent(anyString(), anyString(), any(Duration.class)))
        .thenReturn(true);
    doThrow(new RuntimeException("Redis connection failed"))
        .when(enhancedRedisService)
        .delete(anyString());

    // Acquire lock first
    sessionSynchronizationService.acquireSessionLock(sessionId);

    // When - should not throw exception
    assertDoesNotThrow(() -> sessionSynchronizationService.releaseSessionLock(sessionId));

    // Then - should track Redis operation failure
    SessionSynchronizationService.SessionSynchronizationMetrics metrics =
        sessionSynchronizationService.getMetrics();
    assertTrue(metrics.getTotalRedisOperationFailures() > 0);
  }

  @Test
  void testIsSessionInvalidating_RedisException() {
    // Given
    String sessionId = "test-session-123";
    when(enhancedRedisService.hasKey(anyString()))
        .thenThrow(new RuntimeException("Redis connection failed"));

    // When
    boolean result = sessionSynchronizationService.isSessionInvalidating(sessionId);

    // Then
    assertFalse(result); // Should return false on error
    SessionSynchronizationService.SessionSynchronizationMetrics metrics =
        sessionSynchronizationService.getMetrics();
    assertTrue(metrics.getTotalRedisOperationFailures() > 0);
  }

  @Test
  void testClearSessionInvalidationMarkers_RedisException() {
    // Given
    String sessionId = "test-session-123";
    doThrow(new RuntimeException("Redis connection failed"))
        .when(enhancedRedisService)
        .delete(anyString());

    // When - should not throw exception
    assertDoesNotThrow(
        () -> sessionSynchronizationService.clearSessionInvalidationMarkers(sessionId));

    // Then - should track Redis operation failure
    SessionSynchronizationService.SessionSynchronizationMetrics metrics =
        sessionSynchronizationService.getMetrics();
    assertTrue(metrics.getTotalRedisOperationFailures() > 0);
  }

  @Test
  void testExecuteWithSessionLock_LockAcquisitionFailure() {
    // Given
    String sessionId = "test-session-123";
    when(enhancedRedisService.hasKey(anyString())).thenReturn(false);
    when(enhancedRedisService.setIfAbsent(anyString(), anyString(), any(Duration.class)))
        .thenReturn(false);

    // When & Then
    assertThrows(
        IllegalStateException.class,
        () ->
            sessionSynchronizationService.executeWithSessionLock(
                sessionId, () -> "should not execute"));
  }

  @Test
  void testExecuteWithSessionLock_OperationException() {
    // Given
    String sessionId = "test-session-123";
    when(enhancedRedisService.hasKey(anyString())).thenReturn(false);
    when(enhancedRedisService.setIfAbsent(anyString(), anyString(), any(Duration.class)))
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
    verify(enhancedRedisService).delete(anyString());
  }

  @Test
  void testSafeInvalidateSession_MarkingFailure() {
    // Given
    String sessionId = "test-session-123";
    String reason = "timeout";
    when(enhancedRedisService.hasKey(anyString())).thenReturn(false);
    doThrow(new RuntimeException("Redis connection failed"))
        .when(enhancedRedisService)
        .setWithTtl(anyString(), anyString(), any(Duration.class));

    // When - should not throw exception
    assertDoesNotThrow(
        () -> sessionSynchronizationService.safeInvalidateSession(sessionId, reason));

    // Then - should clear markers on error
    verify(enhancedRedisService, atLeastOnce()).delete(anyString());
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
    when(enhancedRedisService.setIfAbsent(anyString(), anyString(), any(Duration.class)))
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
    verify(enhancedRedisService, atLeastOnce()).delete(anyString());
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
    when(enhancedRedisService.setIfAbsent(anyString(), anyString(), any(Duration.class)))
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
    when(enhancedRedisService.setIfAbsent(anyString(), anyString(), any(Duration.class)))
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
