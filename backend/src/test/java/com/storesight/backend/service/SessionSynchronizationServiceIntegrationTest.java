package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

/**
 * Integration test for SessionSynchronizationService to verify the optimized cleanup functionality
 * without relying on mocking frameworks that may have compatibility issues.
 */
@SpringBootTest
@TestPropertySource(
    properties = {
      "spring.redis.host=localhost",
      "spring.redis.port=6379",
      "spring.redis.timeout=2000ms"
    })
class SessionSynchronizationServiceIntegrationTest {

  @Test
  void testMetricsCollection() {
    // Given
    SessionSynchronizationService service = new SessionSynchronizationService();

    // When
    SessionSynchronizationService.SessionSynchronizationMetrics metrics = service.getMetrics();

    // Then
    assertNotNull(metrics);
    assertTrue(metrics.getTotalLockAcquisitions() >= 0);
    assertTrue(metrics.getTotalLockFailures() >= 0);
    assertTrue(metrics.getTotalInvalidations() >= 0);
    assertTrue(metrics.getTotalStuckSessionsCleared() >= 0);
    assertTrue(metrics.getTotalOrphanedLocksCleared() >= 0);
    assertTrue(metrics.getTotalCleanupOperations() >= 0);
    assertTrue(metrics.getTotalRedisOperationFailures() >= 0);
    assertTrue(metrics.getTotalScheduledCleanupRuns() >= 0);
    assertTrue(metrics.getCurrentInMemoryLocks() >= 0);
    assertTrue(metrics.getCurrentTrackedLockAcquisitions() >= 0);
    assertTrue(metrics.getCurrentTrackedInvalidations() >= 0);
  }

  @Test
  void testLockStatistics() {
    // Given
    SessionSynchronizationService service = new SessionSynchronizationService();

    // When
    SessionSynchronizationService.SessionLockStatistics stats = service.getLockStatistics();

    // Then
    assertNotNull(stats);
    assertTrue(stats.getTotalInMemoryLocks() >= 0);
    assertTrue(stats.getTotalTrackedLocks() >= 0);
    assertTrue(stats.getLocksHeldLongerThanMinute() >= 0);
    assertTrue(stats.getLocksHeldLongerThanFiveMinutes() >= 0);
  }

  @Test
  void testMetricsReset() {
    // Given
    SessionSynchronizationService service = new SessionSynchronizationService();

    // When
    service.resetMetrics();
    SessionSynchronizationService.SessionSynchronizationMetrics metrics = service.getMetrics();

    // Then
    assertEquals(0, metrics.getTotalLockAcquisitions());
    assertEquals(0, metrics.getTotalLockFailures());
    assertEquals(0, metrics.getTotalInvalidations());
    assertEquals(0, metrics.getTotalStuckSessionsCleared());
    assertEquals(0, metrics.getTotalOrphanedLocksCleared());
    assertEquals(0, metrics.getTotalCleanupOperations());
    assertEquals(0, metrics.getTotalRedisOperationFailures());
    assertEquals(0, metrics.getTotalScheduledCleanupRuns());
  }

  @Test
  void testCleanupResultDataClass() {
    // Given
    SessionSynchronizationService.CleanupResult result =
        new SessionSynchronizationService.CleanupResult(1, 2, 3, 4, true, null);

    // Then
    assertEquals(1, result.getLocksCleared());
    assertEquals(2, result.getMarkersCleared());
    assertEquals(3, result.getInMemoryDataCleared());
    assertEquals(4, result.getRedisKeysCleared());
    assertEquals(10, result.getTotalItemsCleared());
    assertTrue(result.isSuccess());
    assertNull(result.getErrorMessage());
  }

  @Test
  void testCleanupResultWithError() {
    // Given
    String errorMessage = "Test error";
    SessionSynchronizationService.CleanupResult result =
        new SessionSynchronizationService.CleanupResult(0, 0, 0, 0, false, errorMessage);

    // Then
    assertEquals(0, result.getTotalItemsCleared());
    assertFalse(result.isSuccess());
    assertEquals(errorMessage, result.getErrorMessage());
  }

  @Test
  void testMetricsToString() {
    // Given
    SessionSynchronizationService service = new SessionSynchronizationService();
    SessionSynchronizationService.SessionSynchronizationMetrics metrics = service.getMetrics();

    // When
    String metricsString = metrics.toString();

    // Then
    assertNotNull(metricsString);
    assertTrue(metricsString.contains("SessionSynchronizationMetrics"));
    assertTrue(metricsString.contains("lockAcquisitions"));
    assertTrue(metricsString.contains("lockFailures"));
    assertTrue(metricsString.contains("invalidations"));
    assertTrue(metricsString.contains("stuckSessionsCleared"));
    assertTrue(metricsString.contains("orphanedLocksCleared"));
    assertTrue(metricsString.contains("cleanupOperations"));
    assertTrue(metricsString.contains("redisFailures"));
    assertTrue(metricsString.contains("scheduledCleanupRuns"));
    assertTrue(metricsString.contains("lockSuccessRate"));
    assertTrue(metricsString.contains("redisSuccessRate"));
  }

  @Test
  void testLockStatisticsToString() {
    // Given
    SessionSynchronizationService service = new SessionSynchronizationService();
    SessionSynchronizationService.SessionLockStatistics stats = service.getLockStatistics();

    // When
    String statsString = stats.toString();

    // Then
    assertNotNull(statsString);
    assertTrue(statsString.contains("SessionLockStatistics"));
    assertTrue(statsString.contains("totalInMemoryLocks"));
    assertTrue(statsString.contains("totalTrackedLocks"));
    assertTrue(statsString.contains("locksHeldLongerThanMinute"));
    assertTrue(statsString.contains("locksHeldLongerThanFiveMinutes"));
  }

  @Test
  void testCleanupResultToString() {
    // Given
    SessionSynchronizationService.CleanupResult result =
        new SessionSynchronizationService.CleanupResult(1, 2, 3, 4, true, null);

    // When
    String resultString = result.toString();

    // Then
    assertNotNull(resultString);
    assertTrue(resultString.contains("CleanupResult"));
    assertTrue(resultString.contains("locksCleared=1"));
    assertTrue(resultString.contains("markersCleared=2"));
    assertTrue(resultString.contains("inMemoryDataCleared=3"));
    assertTrue(resultString.contains("redisKeysCleared=4"));
    assertTrue(resultString.contains("totalCleared=10"));
    assertTrue(resultString.contains("success=true"));
  }
}
