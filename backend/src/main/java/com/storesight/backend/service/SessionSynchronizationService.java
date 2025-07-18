package com.storesight.backend.service;

import com.storesight.backend.config.ApplicationConfigurationProperties;
import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Enterprise-grade session synchronization service
 *
 * <p>This service prevents race conditions between Spring Session and custom session management by
 * providing thread-safe session state coordination and proper error handling.
 */
@Service
public class SessionSynchronizationService {

  private static final Logger logger = LoggerFactory.getLogger(SessionSynchronizationService.class);

  // Redis key patterns for session state coordination
  private static final String SESSION_LOCK_PREFIX = "session_lock:";
  private static final String SESSION_STATE_PREFIX = "session_state:";
  private static final String SESSION_INVALIDATION_PREFIX = "session_invalidation:";

  @Autowired private ApplicationConfigurationProperties config;

  // In-memory locks for high-performance session coordination
  private final ConcurrentHashMap<String, ReentrantReadWriteLock> sessionLocks =
      new ConcurrentHashMap<>();

  // Track lock acquisition times for timeout-based cleanup
  private final ConcurrentHashMap<String, LocalDateTime> lockAcquisitionTimes =
      new ConcurrentHashMap<>();

  // Track invalidation start times for stuck session detection
  private final ConcurrentHashMap<String, LocalDateTime> invalidationStartTimes =
      new ConcurrentHashMap<>();

  // Metrics collection
  private final AtomicLong totalLockAcquisitions = new AtomicLong(0);
  private final AtomicLong totalLockFailures = new AtomicLong(0);
  private final AtomicLong totalInvalidations = new AtomicLong(0);
  private final AtomicLong totalStuckSessionsCleared = new AtomicLong(0);
  private final AtomicLong totalOrphanedLocksCleared = new AtomicLong(0);
  private final AtomicLong totalCleanupOperations = new AtomicLong(0);
  private final AtomicLong totalRedisOperationFailures = new AtomicLong(0);
  private final AtomicLong totalScheduledCleanupRuns = new AtomicLong(0);

  // Persistent storage keys
  private static final String SESSION_STATS_LOCK_ACQUISITIONS_KEY =
      "session:stats:lock_acquisitions";
  private static final String SESSION_STATS_LOCK_FAILURES_KEY = "session:stats:lock_failures";
  private static final String SESSION_STATS_INVALIDATIONS_KEY = "session:stats:invalidations";
  private static final String SESSION_STATS_STUCK_CLEARED_KEY = "session:stats:stuck_cleared";
  private static final String SESSION_STATS_ORPHANED_CLEARED_KEY = "session:stats:orphaned_cleared";
  private static final String SESSION_STATS_CLEANUP_OPERATIONS_KEY =
      "session:stats:cleanup_operations";
  private static final String SESSION_STATS_REDIS_FAILURES_KEY = "session:stats:redis_failures";
  private static final String SESSION_STATS_SCHEDULED_CLEANUPS_KEY =
      "session:stats:scheduled_cleanups";
  private static final String SESSION_STATS_LAST_RESET_KEY = "session:stats:last_reset";

  // Configuration-driven timeout durations
  private Duration getStuckSessionTimeout() {
    return config.getSession().getStuckSessionTimeout();
  }

  private Duration getOrphanedLockTimeout() {
    return config.getSession().getOrphanedLockTimeout();
  }

  private Duration getSessionLockDuration() {
    return config.getSession().getLockDuration();
  }

  private Duration getInvalidationTrackingDuration() {
    return config.getSession().getInvalidationTrackingDuration();
  }

  @Autowired private StringRedisTemplate redisTemplate;
  @Autowired private EnhancedRedisService enhancedRedisService;
  @Autowired private MetricsCollectionService metricsCollectionService;

  /** Initialize session statistics from persistent storage */
  private void initializeSessionStatistics() {
    try {
      // Check if Redis is available before attempting to load statistics
      if (!isRedisAvailable()) {
        logger.warn("Redis not available during startup, using default session statistics");
        return;
      }

      String lockAcquisitionsStr =
          redisTemplate.opsForValue().get(SESSION_STATS_LOCK_ACQUISITIONS_KEY);
      String lockFailuresStr = redisTemplate.opsForValue().get(SESSION_STATS_LOCK_FAILURES_KEY);
      String invalidationsStr = redisTemplate.opsForValue().get(SESSION_STATS_INVALIDATIONS_KEY);
      String stuckClearedStr = redisTemplate.opsForValue().get(SESSION_STATS_STUCK_CLEARED_KEY);
      String orphanedClearedStr =
          redisTemplate.opsForValue().get(SESSION_STATS_ORPHANED_CLEARED_KEY);
      String cleanupOperationsStr =
          redisTemplate.opsForValue().get(SESSION_STATS_CLEANUP_OPERATIONS_KEY);
      String redisFailuresStr = redisTemplate.opsForValue().get(SESSION_STATS_REDIS_FAILURES_KEY);
      String scheduledCleanupsStr =
          redisTemplate.opsForValue().get(SESSION_STATS_SCHEDULED_CLEANUPS_KEY);

      if (lockAcquisitionsStr != null)
        totalLockAcquisitions.set(Long.parseLong(lockAcquisitionsStr));
      if (lockFailuresStr != null) totalLockFailures.set(Long.parseLong(lockFailuresStr));
      if (invalidationsStr != null) totalInvalidations.set(Long.parseLong(invalidationsStr));
      if (stuckClearedStr != null) totalStuckSessionsCleared.set(Long.parseLong(stuckClearedStr));
      if (orphanedClearedStr != null)
        totalOrphanedLocksCleared.set(Long.parseLong(orphanedClearedStr));
      if (cleanupOperationsStr != null)
        totalCleanupOperations.set(Long.parseLong(cleanupOperationsStr));
      if (redisFailuresStr != null)
        totalRedisOperationFailures.set(Long.parseLong(redisFailuresStr));
      if (scheduledCleanupsStr != null)
        totalScheduledCleanupRuns.set(Long.parseLong(scheduledCleanupsStr));

      // Set last reset time if not exists
      if (!redisTemplate.hasKey(SESSION_STATS_LAST_RESET_KEY)) {
        redisTemplate
            .opsForValue()
            .set(SESSION_STATS_LAST_RESET_KEY, String.valueOf(System.currentTimeMillis()));
      }

      logger.info(
          "Session statistics initialized from persistent storage - acquisitions: {}, failures: {}, invalidations: {}",
          totalLockAcquisitions.get(),
          totalLockFailures.get(),
          totalInvalidations.get());

    } catch (Exception e) {
      logger.warn(
          "Failed to initialize session statistics from persistent storage: {}. Using default values.",
          e.getMessage());
    }
  }

  /** Check if Redis is available */
  private boolean isRedisAvailable() {
    try {
      redisTemplate.opsForValue().get("health-check");
      return true;
    } catch (Exception e) {
      return false;
    }
  }

  /** Persist session statistics to Redis */
  private void persistSessionStatistics() {
    try {
      // Check if Redis is available before attempting to persist
      if (!isRedisAvailable()) {
        return;
      }

      redisTemplate
          .opsForValue()
          .set(SESSION_STATS_LOCK_ACQUISITIONS_KEY, String.valueOf(totalLockAcquisitions.get()));
      redisTemplate
          .opsForValue()
          .set(SESSION_STATS_LOCK_FAILURES_KEY, String.valueOf(totalLockFailures.get()));
      redisTemplate
          .opsForValue()
          .set(SESSION_STATS_INVALIDATIONS_KEY, String.valueOf(totalInvalidations.get()));
      redisTemplate
          .opsForValue()
          .set(SESSION_STATS_STUCK_CLEARED_KEY, String.valueOf(totalStuckSessionsCleared.get()));
      redisTemplate
          .opsForValue()
          .set(SESSION_STATS_ORPHANED_CLEARED_KEY, String.valueOf(totalOrphanedLocksCleared.get()));
      redisTemplate
          .opsForValue()
          .set(SESSION_STATS_CLEANUP_OPERATIONS_KEY, String.valueOf(totalCleanupOperations.get()));
      redisTemplate
          .opsForValue()
          .set(SESSION_STATS_REDIS_FAILURES_KEY, String.valueOf(totalRedisOperationFailures.get()));
      redisTemplate
          .opsForValue()
          .set(
              SESSION_STATS_SCHEDULED_CLEANUPS_KEY,
              String.valueOf(totalScheduledCleanupRuns.get()));

      // Set expiration for statistics (30 days)
      java.time.Duration statsExpiration = java.time.Duration.ofDays(30);
      redisTemplate.expire(SESSION_STATS_LOCK_ACQUISITIONS_KEY, statsExpiration);
      redisTemplate.expire(SESSION_STATS_LOCK_FAILURES_KEY, statsExpiration);
      redisTemplate.expire(SESSION_STATS_INVALIDATIONS_KEY, statsExpiration);
      redisTemplate.expire(SESSION_STATS_STUCK_CLEARED_KEY, statsExpiration);
      redisTemplate.expire(SESSION_STATS_ORPHANED_CLEARED_KEY, statsExpiration);
      redisTemplate.expire(SESSION_STATS_CLEANUP_OPERATIONS_KEY, statsExpiration);
      redisTemplate.expire(SESSION_STATS_REDIS_FAILURES_KEY, statsExpiration);
      redisTemplate.expire(SESSION_STATS_SCHEDULED_CLEANUPS_KEY, statsExpiration);
      redisTemplate.expire(SESSION_STATS_LAST_RESET_KEY, statsExpiration);

    } catch (Exception e) {
      logger.debug("Failed to persist session statistics: {}", e.getMessage());
    }
  }

  /** Initialize session statistics on startup */
  @PostConstruct
  public void init() {
    initializeSessionStatistics();
  }

  /**
   * Acquire a session lock to prevent concurrent modifications
   *
   * @param sessionId The session ID to lock
   * @return true if lock was acquired, false otherwise
   */
  public boolean acquireSessionLock(String sessionId) {
    try {
      String lockKey = SESSION_LOCK_PREFIX + sessionId;

      // Try to acquire Redis lock using enhanced service with circuit breaker
      boolean acquired =
          enhancedRedisService.setIfAbsent(lockKey, "locked", getSessionLockDuration());

      if (acquired) {
        logger.debug("Acquired Redis lock for session: {}", sessionId);

        // Also acquire in-memory lock for additional coordination
        ReentrantReadWriteLock lock =
            sessionLocks.computeIfAbsent(sessionId, k -> new ReentrantReadWriteLock());
        lock.writeLock().lock();

        // Track acquisition time for timeout-based cleanup
        lockAcquisitionTimes.put(sessionId, LocalDateTime.now());

        // Update metrics
        totalLockAcquisitions.incrementAndGet();
        metricsCollectionService.recordSessionLockAcquisition();
        persistSessionStatistics();

        return true;
      } else {
        logger.debug("Failed to acquire Redis lock for session: {}", sessionId);
        totalLockFailures.incrementAndGet();
        metricsCollectionService.recordSessionLockFailure();
        persistSessionStatistics();
        return false;
      }
    } catch (Exception e) {
      logger.warn("Error acquiring session lock for {}: {}", sessionId, e.getMessage());
      totalLockFailures.incrementAndGet();
      totalRedisOperationFailures.incrementAndGet();
      persistSessionStatistics();
      return false;
    }
  }

  /**
   * Release a session lock
   *
   * @param sessionId The session ID to unlock
   */
  public void releaseSessionLock(String sessionId) {
    try {
      String lockKey = SESSION_LOCK_PREFIX + sessionId;

      // Release Redis lock using enhanced service
      enhancedRedisService.delete(lockKey);
      logger.debug("Released Redis lock for session: {}", sessionId);

      // Release in-memory lock
      ReentrantReadWriteLock lock = sessionLocks.get(sessionId);
      if (lock != null && lock.writeLock().isHeldByCurrentThread()) {
        lock.writeLock().unlock();
        logger.debug("Released in-memory lock for session: {}", sessionId);
      }

      // Clean up tracking data
      lockAcquisitionTimes.remove(sessionId);

      // Update metrics
      metricsCollectionService.recordSessionLockRelease();
      persistSessionStatistics();

    } catch (Exception e) {
      logger.warn("Error releasing session lock for {}: {}", sessionId, e.getMessage());
      totalRedisOperationFailures.incrementAndGet();
      persistSessionStatistics();
    }
  }

  /**
   * Mark a session as being invalidated to prevent race conditions
   *
   * @param sessionId The session ID being invalidated
   * @param reason The reason for invalidation
   */
  public void markSessionAsInvalidating(String sessionId, String reason) {
    try {
      String invalidationKey = SESSION_INVALIDATION_PREFIX + sessionId;
      String stateKey = SESSION_STATE_PREFIX + sessionId;

      // Mark session as invalidating using enhanced service
      enhancedRedisService.setWithTtl(invalidationKey, reason, getInvalidationTrackingDuration());
      enhancedRedisService.setWithTtl(stateKey, "invalidating", getInvalidationTrackingDuration());

      // Track invalidation start time for timeout-based cleanup
      invalidationStartTimes.put(sessionId, LocalDateTime.now());

      // Update metrics
      totalInvalidations.incrementAndGet();
      metricsCollectionService.recordSessionInvalidation();
      persistSessionStatistics();

      logger.debug("Marked session {} as invalidating: {}", sessionId, reason);
    } catch (Exception e) {
      logger.warn("Error marking session {} as invalidating: {}", sessionId, e.getMessage());
      totalRedisOperationFailures.incrementAndGet();
      persistSessionStatistics();
    }
  }

  /**
   * Check if a session is currently being invalidated
   *
   * @param sessionId The session ID to check
   * @return true if session is being invalidated, false otherwise
   */
  public boolean isSessionInvalidating(String sessionId) {
    try {
      String invalidationKey = SESSION_INVALIDATION_PREFIX + sessionId;
      String stateKey = SESSION_STATE_PREFIX + sessionId;

      boolean isInvalidating = enhancedRedisService.hasKey(invalidationKey);
      boolean hasInvalidatingState = enhancedRedisService.hasKey(stateKey);

      return isInvalidating || hasInvalidatingState;
    } catch (Exception e) {
      logger.warn("Error checking if session {} is invalidating: {}", sessionId, e.getMessage());
      totalRedisOperationFailures.incrementAndGet();
      return false;
    }
  }

  /**
   * Clear session invalidation markers
   *
   * @param sessionId The session ID to clear markers for
   */
  public void clearSessionInvalidationMarkers(String sessionId) {
    try {
      String invalidationKey = SESSION_INVALIDATION_PREFIX + sessionId;
      String stateKey = SESSION_STATE_PREFIX + sessionId;

      enhancedRedisService.delete(invalidationKey);
      enhancedRedisService.delete(stateKey);

      // Clean up tracking data
      invalidationStartTimes.remove(sessionId);

      logger.debug("Cleared invalidation markers for session: {}", sessionId);
    } catch (Exception e) {
      logger.warn(
          "Error clearing invalidation markers for session {}: {}", sessionId, e.getMessage());
      totalRedisOperationFailures.incrementAndGet();
    }
  }

  /**
   * Clear stuck session invalidation markers for a specific session This is used to recover from
   * stuck sessions that are preventing authentication
   *
   * @param sessionId The session ID to clear stuck markers for
   */
  public void clearStuckSessionMarkers(String sessionId) {
    try {
      String invalidationKey = SESSION_INVALIDATION_PREFIX + sessionId;
      String stateKey = SESSION_STATE_PREFIX + sessionId;
      String lockKey = SESSION_LOCK_PREFIX + sessionId;

      // Clear all markers and locks using enhanced service
      enhancedRedisService.delete(invalidationKey);
      enhancedRedisService.delete(stateKey);
      enhancedRedisService.delete(lockKey);

      // Clear in-memory lock
      ReentrantReadWriteLock lock = sessionLocks.remove(sessionId);
      if (lock != null) {
        logger.debug("Cleared in-memory lock for session: {}", sessionId);
      }

      // Clean up tracking data
      lockAcquisitionTimes.remove(sessionId);
      invalidationStartTimes.remove(sessionId);

      // Update metrics
      totalStuckSessionsCleared.incrementAndGet();
      metricsCollectionService.recordStuckSessionCleared();

      logger.warn("Cleared stuck session markers for session: {}", sessionId);
    } catch (Exception e) {
      logger.warn(
          "Error clearing stuck session markers for session {}: {}", sessionId, e.getMessage());
      totalRedisOperationFailures.incrementAndGet();
    }
  }

  /**
   * Execute a session operation with proper locking and error handling
   *
   * @param sessionId The session ID for the operation
   * @param operation The operation to execute
   * @return The result of the operation
   */
  public <T> T executeWithSessionLock(String sessionId, SessionOperation<T> operation) {
    boolean lockAcquired = false;
    try {
      // Check if session is being invalidated
      if (isSessionInvalidating(sessionId)) {
        logger.warn("Session {} is being invalidated, skipping operation", sessionId);
        // Don't throw exception, just return null or handle gracefully
        // This prevents the error cascade that was causing the loop
        return null;
      }

      // Acquire lock
      lockAcquired = acquireSessionLock(sessionId);
      if (!lockAcquired) {
        logger.warn("Failed to acquire lock for session {}, skipping operation", sessionId);
        throw new IllegalStateException("Failed to acquire session lock");
      }

      // Execute operation
      return operation.execute();

    } catch (Exception e) {
      logger.error("Error executing session operation for {}: {}", sessionId, e.getMessage());
      throw e;
    } finally {
      if (lockAcquired) {
        releaseSessionLock(sessionId);
      }
    }
  }

  /**
   * Safely invalidate a session with proper coordination
   *
   * @param sessionId The session ID to invalidate
   * @param reason The reason for invalidation
   */
  public void safeInvalidateSession(String sessionId, String reason) {
    try {
      // Check if session is already being invalidated
      if (isSessionInvalidating(sessionId)) {
        logger.warn(
            "Session {} is already being invalidated, skipping duplicate invalidation", sessionId);
        return;
      }

      // Mark session as invalidating first
      markSessionAsInvalidating(sessionId, reason);

      // Execute invalidation with lock
      executeWithSessionLock(
          sessionId,
          () -> {
            // The actual invalidation logic will be handled by the calling service
            logger.info("Session {} marked for safe invalidation: {}", sessionId, reason);
            return null;
          });

    } catch (Exception e) {
      logger.error("Error during safe session invalidation for {}: {}", sessionId, e.getMessage());
      // Clear markers on error to prevent stuck sessions
      clearSessionInvalidationMarkers(sessionId);
    }
  }

  /**
   * Check if a session operation should be allowed This prevents operations on sessions that are
   * being invalidated
   *
   * @param sessionId The session ID to check
   * @return true if operation should be allowed, false otherwise
   */
  public boolean shouldAllowSessionOperation(String sessionId) {
    return !isSessionInvalidating(sessionId);
  }

  /**
   * Clean up expired locks and markers This should be called periodically to prevent memory leaks
   */
  public void cleanupExpiredLocks() {
    try {
      LocalDateTime now = LocalDateTime.now();
      int orphanedLocksCleared = 0;
      int redisLocksCleared = 0;

      logger.debug("Starting cleanup of expired locks and markers");

      // Clean up orphaned locks based on acquisition time
      lockAcquisitionTimes
          .entrySet()
          .removeIf(
              entry -> {
                String sessionId = entry.getKey();
                LocalDateTime acquisitionTime = entry.getValue();

                if (Duration.between(acquisitionTime, now).compareTo(getOrphanedLockTimeout())
                    > 0) {
                  logger.warn(
                      "Clearing orphaned lock for session: {} (held for {} minutes)",
                      sessionId,
                      Duration.between(acquisitionTime, now).toMinutes());

                  // Force clear the lock
                  clearStuckSessionMarkers(sessionId);
                  return true;
                }
                return false;
              });

      // Clean up orphaned Redis locks that might not be tracked locally
      try {
        final int[] redisLocksClearedArray = {0};
        redisTemplate.execute(
            (RedisCallback<Void>)
                connection -> {
                  Cursor<byte[]> cursor =
                      connection.scan(
                          ScanOptions.scanOptions()
                              .match(SESSION_LOCK_PREFIX + "*")
                              .count(1000)
                              .build());
                  while (cursor.hasNext()) {
                    String lockKey = new String(cursor.next());
                    String sessionId = lockKey.substring(SESSION_LOCK_PREFIX.length());

                    // If we don't have this lock tracked locally, it might be orphaned
                    if (!lockAcquisitionTimes.containsKey(sessionId)) {
                      logger.warn("Found orphaned Redis lock for session: {}, clearing", sessionId);
                      redisTemplate.delete(lockKey);
                      redisLocksClearedArray[0]++;
                    }
                  }
                  return null;
                });
        redisLocksCleared = redisLocksClearedArray[0];
      } catch (Exception e) {
        logger.warn("Error scanning Redis for orphaned locks: {}", e.getMessage());
      }

      // Clean up in-memory locks for sessions that haven't been accessed recently
      int inMemoryLocksCleared = sessionLocks.size();
      sessionLocks
          .entrySet()
          .removeIf(
              entry -> {
                ReentrantReadWriteLock lock = entry.getValue();
                return !lock.hasQueuedThreads() && !lock.isWriteLocked();
              });

      inMemoryLocksCleared = inMemoryLocksCleared - sessionLocks.size();
      totalOrphanedLocksCleared.addAndGet(inMemoryLocksCleared + redisLocksCleared);

      if (inMemoryLocksCleared > 0 || redisLocksCleared > 0) {
        logger.info(
            "Cleaned up {} in-memory locks and {} Redis locks during cleanup",
            inMemoryLocksCleared,
            redisLocksCleared);
      }

    } catch (Exception e) {
      logger.warn("Error cleaning up expired locks: {}", e.getMessage());
    }
  }

  /**
   * Scheduled cleanup of expired locks and markers Runs every 30 minutes to prevent memory leaks
   */
  @Scheduled(fixedRate = 1800000) // 30 minutes
  public void scheduledCleanup() {
    try {
      totalScheduledCleanupRuns.incrementAndGet();
      totalCleanupOperations.incrementAndGet();

      logger.info(
          "Starting scheduled cleanup of session synchronization (run #{})",
          totalScheduledCleanupRuns.get());

      cleanupExpiredLocks();

      logger.info("Scheduled cleanup of session synchronization completed successfully");
    } catch (Exception e) {
      logger.warn("Error during scheduled cleanup: {}", e.getMessage());
      totalRedisOperationFailures.incrementAndGet();
    }
  }

  /**
   * Scheduled cleanup of stuck session markers Runs every 5 minutes to prevent sessions from
   * getting permanently stuck
   */
  @Scheduled(fixedRate = 300000) // 5 minutes
  public void cleanupStuckSessionMarkers() {
    try {
      LocalDateTime now = LocalDateTime.now();
      int stuckSessionsCleared = 0;

      logger.debug("Running stuck session markers cleanup");

      // Clean up sessions that have been invalidating for too long
      invalidationStartTimes
          .entrySet()
          .removeIf(
              entry -> {
                String sessionId = entry.getKey();
                LocalDateTime invalidationStartTime = entry.getValue();

                if (Duration.between(invalidationStartTime, now).compareTo(getStuckSessionTimeout())
                    > 0) {
                  logger.warn(
                      "Clearing stuck session: {} (invalidating for {} minutes)",
                      sessionId,
                      Duration.between(invalidationStartTime, now).toMinutes());

                  // Force clear the stuck session
                  clearStuckSessionMarkers(sessionId);
                  return true;
                }
                return false;
              });

      // Also scan Redis for any stuck invalidation markers that might not be in our local tracking
      try {
        Set<String> invalidationKeys = redisTemplate.keys(SESSION_INVALIDATION_PREFIX + "*");
        if (invalidationKeys != null) {
          for (String key : invalidationKeys) {
            String sessionId = key.substring(SESSION_INVALIDATION_PREFIX.length());

            // Check if this session has been invalidating for too long
            if (!invalidationStartTimes.containsKey(sessionId)) {
              // This is an orphaned invalidation marker, clear it
              logger.warn("Clearing orphaned invalidation marker for session: {}", sessionId);
              clearStuckSessionMarkers(sessionId);
              stuckSessionsCleared++;
            }
          }
        }
      } catch (Exception e) {
        logger.warn("Error scanning Redis for stuck invalidation markers: {}", e.getMessage());
      }

      if (stuckSessionsCleared > 0) {
        logger.info("Cleared {} stuck session markers during cleanup", stuckSessionsCleared);
      }

    } catch (Exception e) {
      logger.warn("Error during stuck session markers cleanup: {}", e.getMessage());
    }
  }

  /**
   * Get comprehensive metrics for session synchronization operations
   *
   * @return SessionSynchronizationMetrics containing all collected metrics
   */
  public SessionSynchronizationMetrics getMetrics() {
    return new SessionSynchronizationMetrics(
        totalLockAcquisitions.get(),
        totalLockFailures.get(),
        totalInvalidations.get(),
        totalStuckSessionsCleared.get(),
        totalOrphanedLocksCleared.get(),
        totalCleanupOperations.get(),
        totalRedisOperationFailures.get(),
        totalScheduledCleanupRuns.get(),
        sessionLocks.size(),
        lockAcquisitionTimes.size(),
        invalidationStartTimes.size());
  }

  /** Get enhanced metrics with metadata */
  public Map<String, Object> getEnhancedMetrics() {
    Map<String, Object> metrics = new HashMap<>();

    SessionSynchronizationMetrics sessionMetrics = getMetrics();
    metrics.put("sessionMetrics", sessionMetrics);

    // Add metadata about statistics
    try {
      String lastResetStr = redisTemplate.opsForValue().get(SESSION_STATS_LAST_RESET_KEY);
      if (lastResetStr != null) {
        long lastReset = Long.parseLong(lastResetStr);
        metrics.put(
            "lastReset",
            LocalDateTime.ofInstant(
                java.time.Instant.ofEpochMilli(lastReset), java.time.ZoneId.systemDefault()));
        metrics.put("uptimeHours", (System.currentTimeMillis() - lastReset) / (1000 * 60 * 60));
      }
    } catch (Exception e) {
      logger.debug("Error getting session statistics metadata: {}", e.getMessage());
    }

    metrics.put("timestamp", LocalDateTime.now());
    return metrics;
  }

  /** Reset all metrics counters (useful for testing or periodic resets) */
  public void resetMetrics() {
    totalLockAcquisitions.set(0);
    totalLockFailures.set(0);
    totalInvalidations.set(0);
    totalStuckSessionsCleared.set(0);
    totalOrphanedLocksCleared.set(0);
    totalCleanupOperations.set(0);
    totalRedisOperationFailures.set(0);
    totalScheduledCleanupRuns.set(0);

    // Update persistent storage
    persistSessionStatistics();

    // Update last reset time
    redisTemplate
        .opsForValue()
        .set(SESSION_STATS_LAST_RESET_KEY, String.valueOf(System.currentTimeMillis()));

    logger.info("Session synchronization metrics have been reset");
  }

  /**
   * Perform comprehensive cleanup of all session-related data This method can be called on-demand
   * for emergency cleanup
   *
   * @return CleanupResult containing details of what was cleaned up
   */
  public CleanupResult performComprehensiveCleanup() {
    logger.info("Starting comprehensive cleanup of session synchronization data");

    int locksCleared = 0;
    int markersCleared = 0;
    int inMemoryDataCleared = 0;
    int redisKeysCleared = 0;

    try {
      totalCleanupOperations.incrementAndGet();

      // Clean up all expired locks
      cleanupExpiredLocks();

      // Force cleanup of all in-memory tracking data for sessions that no longer exist in Redis
      LocalDateTime now = LocalDateTime.now();

      // Clean up lock acquisition times for sessions that don't have Redis locks
      lockAcquisitionTimes
          .entrySet()
          .removeIf(
              entry -> {
                String sessionId = entry.getKey();
                try {
                  String lockKey = SESSION_LOCK_PREFIX + sessionId;
                  Boolean hasLock = redisTemplate.hasKey(lockKey);
                  if (hasLock == null || !hasLock) {
                    logger.debug(
                        "Cleaning up tracking data for session without Redis lock: {}", sessionId);
                    return true;
                  }
                } catch (Exception e) {
                  logger.warn(
                      "Error checking Redis lock for session {}: {}", sessionId, e.getMessage());
                  totalRedisOperationFailures.incrementAndGet();
                  return true; // Clean up on error to be safe
                }
                return false;
              });

      // Clean up invalidation start times for sessions that don't have invalidation markers
      invalidationStartTimes
          .entrySet()
          .removeIf(
              entry -> {
                String sessionId = entry.getKey();
                try {
                  String invalidationKey = SESSION_INVALIDATION_PREFIX + sessionId;
                  Boolean hasMarker = redisTemplate.hasKey(invalidationKey);
                  if (hasMarker == null || !hasMarker) {
                    logger.debug(
                        "Cleaning up invalidation tracking for session without marker: {}",
                        sessionId);
                    return true;
                  }
                } catch (Exception e) {
                  logger.warn(
                      "Error checking invalidation marker for session {}: {}",
                      sessionId,
                      e.getMessage());
                  totalRedisOperationFailures.incrementAndGet();
                  return true; // Clean up on error to be safe
                }
                return false;
              });

      // Clean up in-memory locks that are no longer needed
      inMemoryDataCleared = sessionLocks.size();
      sessionLocks
          .entrySet()
          .removeIf(
              entry -> {
                ReentrantReadWriteLock lock = entry.getValue();
                // Remove locks that are not held and have no waiting threads
                return !lock.isWriteLocked() && !lock.hasQueuedThreads();
              });
      inMemoryDataCleared = inMemoryDataCleared - sessionLocks.size();

      // Scan and clean up any orphaned Redis keys
      try {
        // Clean up orphaned lock keys
        Set<String> lockKeys = redisTemplate.keys(SESSION_LOCK_PREFIX + "*");
        if (lockKeys != null) {
          for (String lockKey : lockKeys) {
            String sessionId = lockKey.substring(SESSION_LOCK_PREFIX.length());
            if (!lockAcquisitionTimes.containsKey(sessionId)) {
              redisTemplate.delete(lockKey);
              redisKeysCleared++;
              logger.debug("Cleaned up orphaned Redis lock: {}", lockKey);
            }
          }
        }

        // Clean up orphaned invalidation markers
        Set<String> invalidationKeys = redisTemplate.keys(SESSION_INVALIDATION_PREFIX + "*");
        if (invalidationKeys != null) {
          for (String invalidationKey : invalidationKeys) {
            String sessionId = invalidationKey.substring(SESSION_INVALIDATION_PREFIX.length());
            if (!invalidationStartTimes.containsKey(sessionId)) {
              redisTemplate.delete(invalidationKey);
              redisKeysCleared++;
              logger.debug("Cleaned up orphaned invalidation marker: {}", invalidationKey);
            }
          }
        }

        // Clean up orphaned state markers
        Set<String> stateKeys = redisTemplate.keys(SESSION_STATE_PREFIX + "*");
        if (stateKeys != null) {
          for (String stateKey : stateKeys) {
            String sessionId = stateKey.substring(SESSION_STATE_PREFIX.length());
            if (!invalidationStartTimes.containsKey(sessionId)) {
              redisTemplate.delete(stateKey);
              redisKeysCleared++;
              logger.debug("Cleaned up orphaned state marker: {}", stateKey);
            }
          }
        }

      } catch (Exception e) {
        logger.warn("Error during Redis cleanup scan: {}", e.getMessage());
        totalRedisOperationFailures.incrementAndGet();
      }

      CleanupResult result =
          new CleanupResult(
              locksCleared, markersCleared, inMemoryDataCleared, redisKeysCleared, true, null);

      logger.info("Comprehensive cleanup completed: {}", result);
      return result;

    } catch (Exception e) {
      logger.error("Error during comprehensive cleanup: {}", e.getMessage());
      totalRedisOperationFailures.incrementAndGet();
      return new CleanupResult(
          locksCleared,
          markersCleared,
          inMemoryDataCleared,
          redisKeysCleared,
          false,
          e.getMessage());
    }
  }

  /** Data class for cleanup operation results */
  public static class CleanupResult {
    private final int locksCleared;
    private final int markersCleared;
    private final int inMemoryDataCleared;
    private final int redisKeysCleared;
    private final boolean success;
    private final String errorMessage;

    public CleanupResult(
        int locksCleared,
        int markersCleared,
        int inMemoryDataCleared,
        int redisKeysCleared,
        boolean success,
        String errorMessage) {
      this.locksCleared = locksCleared;
      this.markersCleared = markersCleared;
      this.inMemoryDataCleared = inMemoryDataCleared;
      this.redisKeysCleared = redisKeysCleared;
      this.success = success;
      this.errorMessage = errorMessage;
    }

    // Getters
    public int getLocksCleared() {
      return locksCleared;
    }

    public int getMarkersCleared() {
      return markersCleared;
    }

    public int getInMemoryDataCleared() {
      return inMemoryDataCleared;
    }

    public int getRedisKeysCleared() {
      return redisKeysCleared;
    }

    public boolean isSuccess() {
      return success;
    }

    public String getErrorMessage() {
      return errorMessage;
    }

    public int getTotalItemsCleared() {
      return locksCleared + markersCleared + inMemoryDataCleared + redisKeysCleared;
    }

    @Override
    public String toString() {
      return String.format(
          "CleanupResult{locksCleared=%d, markersCleared=%d, inMemoryDataCleared=%d, "
              + "redisKeysCleared=%d, totalCleared=%d, success=%s%s}",
          locksCleared,
          markersCleared,
          inMemoryDataCleared,
          redisKeysCleared,
          getTotalItemsCleared(),
          success,
          errorMessage != null ? ", error='" + errorMessage + "'" : "");
    }
  }

  /**
   * Get current session lock statistics
   *
   * @return SessionLockStatistics containing current lock state information
   */
  public SessionLockStatistics getLockStatistics() {
    LocalDateTime now = LocalDateTime.now();
    int locksHeldLongerThanMinute = 0;
    int locksHeldLongerThanFiveMinutes = 0;

    for (LocalDateTime acquisitionTime : lockAcquisitionTimes.values()) {
      Duration heldDuration = Duration.between(acquisitionTime, now);
      if (heldDuration.compareTo(Duration.ofMinutes(1)) > 0) {
        locksHeldLongerThanMinute++;
      }
      if (heldDuration.compareTo(Duration.ofMinutes(5)) > 0) {
        locksHeldLongerThanFiveMinutes++;
      }
    }

    return new SessionLockStatistics(
        sessionLocks.size(),
        lockAcquisitionTimes.size(),
        locksHeldLongerThanMinute,
        locksHeldLongerThanFiveMinutes);
  }

  /** Data class for session synchronization metrics */
  public static class SessionSynchronizationMetrics {
    private final long totalLockAcquisitions;
    private final long totalLockFailures;
    private final long totalInvalidations;
    private final long totalStuckSessionsCleared;
    private final long totalOrphanedLocksCleared;
    private final long totalCleanupOperations;
    private final long totalRedisOperationFailures;
    private final long totalScheduledCleanupRuns;
    private final int currentInMemoryLocks;
    private final int currentTrackedLockAcquisitions;
    private final int currentTrackedInvalidations;

    public SessionSynchronizationMetrics(
        long totalLockAcquisitions,
        long totalLockFailures,
        long totalInvalidations,
        long totalStuckSessionsCleared,
        long totalOrphanedLocksCleared,
        long totalCleanupOperations,
        long totalRedisOperationFailures,
        long totalScheduledCleanupRuns,
        int currentInMemoryLocks,
        int currentTrackedLockAcquisitions,
        int currentTrackedInvalidations) {
      this.totalLockAcquisitions = totalLockAcquisitions;
      this.totalLockFailures = totalLockFailures;
      this.totalInvalidations = totalInvalidations;
      this.totalStuckSessionsCleared = totalStuckSessionsCleared;
      this.totalOrphanedLocksCleared = totalOrphanedLocksCleared;
      this.totalCleanupOperations = totalCleanupOperations;
      this.totalRedisOperationFailures = totalRedisOperationFailures;
      this.totalScheduledCleanupRuns = totalScheduledCleanupRuns;
      this.currentInMemoryLocks = currentInMemoryLocks;
      this.currentTrackedLockAcquisitions = currentTrackedLockAcquisitions;
      this.currentTrackedInvalidations = currentTrackedInvalidations;
    }

    // Getters
    public long getTotalLockAcquisitions() {
      return totalLockAcquisitions;
    }

    public long getTotalLockFailures() {
      return totalLockFailures;
    }

    public long getTotalInvalidations() {
      return totalInvalidations;
    }

    public long getTotalStuckSessionsCleared() {
      return totalStuckSessionsCleared;
    }

    public long getTotalOrphanedLocksCleared() {
      return totalOrphanedLocksCleared;
    }

    public long getTotalCleanupOperations() {
      return totalCleanupOperations;
    }

    public long getTotalRedisOperationFailures() {
      return totalRedisOperationFailures;
    }

    public long getTotalScheduledCleanupRuns() {
      return totalScheduledCleanupRuns;
    }

    public int getCurrentInMemoryLocks() {
      return currentInMemoryLocks;
    }

    public int getCurrentTrackedLockAcquisitions() {
      return currentTrackedLockAcquisitions;
    }

    public int getCurrentTrackedInvalidations() {
      return currentTrackedInvalidations;
    }

    public double getLockSuccessRate() {
      long total = totalLockAcquisitions + totalLockFailures;
      return total > 0 ? (double) totalLockAcquisitions / total * 100.0 : 0.0;
    }

    public double getRedisOperationSuccessRate() {
      long totalOperations = totalLockAcquisitions + totalInvalidations + totalCleanupOperations;
      return totalOperations > 0
          ? (double) (totalOperations - totalRedisOperationFailures) / totalOperations * 100.0
          : 0.0;
    }

    @Override
    public String toString() {
      return String.format(
          "SessionSynchronizationMetrics{lockAcquisitions=%d, lockFailures=%d, "
              + "invalidations=%d, stuckSessionsCleared=%d, orphanedLocksCleared=%d, "
              + "cleanupOperations=%d, redisFailures=%d, scheduledCleanupRuns=%d, "
              + "currentInMemoryLocks=%d, lockSuccessRate=%.2f%%, redisSuccessRate=%.2f%%}",
          totalLockAcquisitions,
          totalLockFailures,
          totalInvalidations,
          totalStuckSessionsCleared,
          totalOrphanedLocksCleared,
          totalCleanupOperations,
          totalRedisOperationFailures,
          totalScheduledCleanupRuns,
          currentInMemoryLocks,
          getLockSuccessRate(),
          getRedisOperationSuccessRate());
    }
  }

  /** Data class for session lock statistics */
  public static class SessionLockStatistics {
    private final int totalInMemoryLocks;
    private final int totalTrackedLocks;
    private final int locksHeldLongerThanMinute;
    private final int locksHeldLongerThanFiveMinutes;

    public SessionLockStatistics(
        int totalInMemoryLocks,
        int totalTrackedLocks,
        int locksHeldLongerThanMinute,
        int locksHeldLongerThanFiveMinutes) {
      this.totalInMemoryLocks = totalInMemoryLocks;
      this.totalTrackedLocks = totalTrackedLocks;
      this.locksHeldLongerThanMinute = locksHeldLongerThanMinute;
      this.locksHeldLongerThanFiveMinutes = locksHeldLongerThanFiveMinutes;
    }

    // Getters
    public int getTotalInMemoryLocks() {
      return totalInMemoryLocks;
    }

    public int getTotalTrackedLocks() {
      return totalTrackedLocks;
    }

    public int getLocksHeldLongerThanMinute() {
      return locksHeldLongerThanMinute;
    }

    public int getLocksHeldLongerThanFiveMinutes() {
      return locksHeldLongerThanFiveMinutes;
    }

    @Override
    public String toString() {
      return String.format(
          "SessionLockStatistics{totalInMemoryLocks=%d, totalTrackedLocks=%d, "
              + "locksHeldLongerThanMinute=%d, locksHeldLongerThanFiveMinutes=%d}",
          totalInMemoryLocks,
          totalTrackedLocks,
          locksHeldLongerThanMinute,
          locksHeldLongerThanFiveMinutes);
    }
  }

  /** Functional interface for session operations */
  @FunctionalInterface
  public interface SessionOperation<T> {
    T execute();
  }
}
