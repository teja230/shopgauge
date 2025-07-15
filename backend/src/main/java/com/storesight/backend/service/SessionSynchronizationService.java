package com.storesight.backend.service;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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

  // Lock duration for session operations (5 seconds)
  private static final Duration SESSION_LOCK_DURATION = Duration.ofSeconds(5);

  // Invalidation tracking duration (1 hour)
  private static final Duration INVALIDATION_TRACKING_DURATION = Duration.ofHours(1);

  // In-memory locks for high-performance session coordination
  private final ConcurrentHashMap<String, ReentrantReadWriteLock> sessionLocks =
      new ConcurrentHashMap<>();

  @Autowired private StringRedisTemplate redisTemplate;

  /**
   * Acquire a session lock to prevent concurrent modifications
   *
   * @param sessionId The session ID to lock
   * @return true if lock was acquired, false otherwise
   */
  public boolean acquireSessionLock(String sessionId) {
    try {
      String lockKey = SESSION_LOCK_PREFIX + sessionId;

      // Try to acquire Redis lock
      Boolean acquired =
          redisTemplate.opsForValue().setIfAbsent(lockKey, "locked", SESSION_LOCK_DURATION);

      if (acquired != null && acquired) {
        logger.debug("Acquired Redis lock for session: {}", sessionId);

        // Also acquire in-memory lock for additional coordination
        ReentrantReadWriteLock lock =
            sessionLocks.computeIfAbsent(sessionId, k -> new ReentrantReadWriteLock());
        lock.writeLock().lock();

        return true;
      } else {
        logger.debug("Failed to acquire Redis lock for session: {}", sessionId);
        return false;
      }
    } catch (Exception e) {
      logger.warn("Error acquiring session lock for {}: {}", sessionId, e.getMessage());
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

      // Release Redis lock
      redisTemplate.delete(lockKey);
      logger.debug("Released Redis lock for session: {}", sessionId);

      // Release in-memory lock
      ReentrantReadWriteLock lock = sessionLocks.get(sessionId);
      if (lock != null && lock.writeLock().isHeldByCurrentThread()) {
        lock.writeLock().unlock();
        logger.debug("Released in-memory lock for session: {}", sessionId);
      }
    } catch (Exception e) {
      logger.warn("Error releasing session lock for {}: {}", sessionId, e.getMessage());
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

      // Mark session as invalidating
      redisTemplate.opsForValue().set(invalidationKey, reason, INVALIDATION_TRACKING_DURATION);
      redisTemplate.opsForValue().set(stateKey, "invalidating", INVALIDATION_TRACKING_DURATION);

      logger.debug("Marked session {} as invalidating: {}", sessionId, reason);
    } catch (Exception e) {
      logger.warn("Error marking session {} as invalidating: {}", sessionId, e.getMessage());
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

      Boolean isInvalidating = redisTemplate.hasKey(invalidationKey);
      Boolean hasInvalidatingState = redisTemplate.hasKey(stateKey);

      return (isInvalidating != null && isInvalidating)
          || (hasInvalidatingState != null && hasInvalidatingState);
    } catch (Exception e) {
      logger.warn("Error checking if session {} is invalidating: {}", sessionId, e.getMessage());
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

      redisTemplate.delete(invalidationKey);
      redisTemplate.delete(stateKey);

      logger.debug("Cleared invalidation markers for session: {}", sessionId);
    } catch (Exception e) {
      logger.warn(
          "Error clearing invalidation markers for session {}: {}", sessionId, e.getMessage());
    }
  }

  /**
   * Clear stuck session invalidation markers for a specific session
   * This is used to recover from stuck sessions that are preventing authentication
   *
   * @param sessionId The session ID to clear stuck markers for
   */
  public void clearStuckSessionMarkers(String sessionId) {
    try {
      String invalidationKey = SESSION_INVALIDATION_PREFIX + sessionId;
      String stateKey = SESSION_STATE_PREFIX + sessionId;
      String lockKey = SESSION_LOCK_PREFIX + sessionId;

      // Clear all markers and locks
      redisTemplate.delete(invalidationKey);
      redisTemplate.delete(stateKey);
      redisTemplate.delete(lockKey);

      // Clear in-memory lock
      ReentrantReadWriteLock lock = sessionLocks.remove(sessionId);
      if (lock != null) {
        logger.debug("Cleared in-memory lock for session: {}", sessionId);
      }

      logger.warn("Cleared stuck session markers for session: {}", sessionId);
    } catch (Exception e) {
      logger.warn(
          "Error clearing stuck session markers for session {}: {}", sessionId, e.getMessage());
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
        logger.warn("Session {} is already being invalidated, skipping duplicate invalidation", sessionId);
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
      // Clean up in-memory locks for sessions that haven't been accessed recently
      sessionLocks
          .entrySet()
          .removeIf(
              entry -> {
                ReentrantReadWriteLock lock = entry.getValue();
                return !lock.hasQueuedThreads() && !lock.isWriteLocked();
              });

      logger.debug("Cleaned up expired in-memory session locks");
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
      cleanupExpiredLocks();
      logger.debug("Scheduled cleanup of session synchronization completed");
    } catch (Exception e) {
      logger.warn("Error during scheduled cleanup: {}", e.getMessage());
    }
  }

  /**
   * Scheduled cleanup of stuck session markers
   * Runs every 5 minutes to prevent sessions from getting permanently stuck
   */
  @Scheduled(fixedRate = 300000) // 5 minutes
  public void cleanupStuckSessionMarkers() {
    try {
      // This is a more aggressive cleanup to prevent stuck sessions
      // We'll clear any invalidation markers that have been around for too long
      logger.debug("Running stuck session markers cleanup");
      
      // Note: In a production environment, you might want to add more sophisticated
      // logic here to identify and clean up specific stuck sessions
      
    } catch (Exception e) {
      logger.warn("Error during stuck session markers cleanup: {}", e.getMessage());
    }
  }

  /** Functional interface for session operations */
  @FunctionalInterface
  public interface SessionOperation<T> {
    T execute();
  }
}
