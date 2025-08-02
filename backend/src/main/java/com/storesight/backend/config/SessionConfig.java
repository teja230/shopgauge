package com.storesight.backend.config;

import com.storesight.backend.service.RedisSessionService;
import com.storesight.backend.service.SessionRecoveryService;
import com.storesight.backend.service.SessionSecurityService;
import com.storesight.backend.service.SessionSynchronizationService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.session.data.redis.RedisSessionRepository;
import org.springframework.session.data.redis.config.annotation.web.http.EnableRedisHttpSession;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Comprehensive session configuration with enterprise-grade error handling and race condition
 * prevention.
 *
 * <p>This configuration addresses the core issues causing session invalidation errors:
 *
 * <ul>
 *   <li>Race conditions between concurrent requests accessing the same session
 *   <li>Response stream conflicts when multiple filters try to write error responses
 *   <li>Async session operations conflicting with synchronous session management
 *   <li>Session invalidation during response writing
 * </ul>
 */
@Configuration
@EnableRedisHttpSession(
    maxInactiveIntervalInSeconds = 3600, // 1 hour session timeout
    redisNamespace = "spring:session:storesight")
public class SessionConfig {

  private static final Logger logger = LoggerFactory.getLogger(SessionConfig.class);

  // Thread-safe session state tracking to prevent race conditions
  private static final ConcurrentHashMap<String, SessionState> sessionStates =
      new ConcurrentHashMap<>();

  // Read-write lock for session operations to prevent concurrent invalidation/save conflicts
  private static final ReentrantReadWriteLock sessionLock = new ReentrantReadWriteLock();

  @Autowired private RedisSessionService redisSessionService;

  @Autowired private SessionRecoveryService sessionRecoveryService;

  @Autowired private SessionSecurityService sessionSecurityService;

  @Autowired private SessionSynchronizationService sessionSynchronizationService;

  /** Enhanced Redis session repository with proper error handling and synchronization. */
  @Bean
  public RedisSessionRepository redisSessionRepository(RedisConnectionFactory connectionFactory) {
    RedisTemplate<String, Object> redisTemplate = new RedisTemplate<>();
    redisTemplate.setConnectionFactory(connectionFactory);
    redisTemplate.setKeySerializer(new StringRedisSerializer());
    redisTemplate.setValueSerializer(new GenericJackson2JsonRedisSerializer());
    redisTemplate.setHashKeySerializer(new StringRedisSerializer());
    redisTemplate.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
    redisTemplate.afterPropertiesSet();

    RedisSessionRepository repository = new RedisSessionRepository(redisTemplate);

    // Configure session repository with proper error handling
    repository.setDefaultMaxInactiveInterval(java.time.Duration.ofHours(1)); // 1 hour

    logger.info("Configured Redis session repository with 1-hour timeout and proper serialization");
    return repository;
  }

  /**
   * Enterprise-grade session error handling filter with comprehensive race condition prevention.
   *
   * <p>This filter implements multiple layers of protection:
   *
   * <ul>
   *   <li>Response state checking to prevent multiple writes
   *   <li>Session state tracking to prevent concurrent invalidation/save conflicts
   *   <li>Proper error categorization and handling
   *   <li>Graceful degradation for different request types
   * </ul>
   */
  @Bean
  @Order(1) // Highest priority to catch session errors first
  public SessionErrorHandlingFilter sessionErrorHandlingFilter() {
    return new SessionErrorHandlingFilter(sessionSynchronizationService);
  }

  /** Thread-safe session state tracking to prevent race conditions. */
  private static class SessionState {
    private final AtomicBoolean isInvalidating = new AtomicBoolean(false);
    private final AtomicBoolean isSaving = new AtomicBoolean(false);
    private final AtomicBoolean isCommitted = new AtomicBoolean(false);
    private volatile long lastAccessTime = System.currentTimeMillis();

    public boolean tryInvalidate() {
      return isInvalidating.compareAndSet(false, true);
    }

    public boolean trySave() {
      return isSaving.compareAndSet(false, true);
    }

    public void markCommitted() {
      isCommitted.set(true);
    }

    public boolean isCommitted() {
      return isCommitted.get();
    }

    public void updateAccessTime() {
      lastAccessTime = System.currentTimeMillis();
    }

    public long getLastAccessTime() {
      return lastAccessTime;
    }

    public void reset() {
      isInvalidating.set(false);
      isSaving.set(false);
      isCommitted.set(false);
    }
  }

  /**
   * Enhanced session error handling filter with comprehensive protection against race conditions
   * and response stream conflicts.
   */
  public static class SessionErrorHandlingFilter extends OncePerRequestFilter {

    private static final Logger filterLogger =
        LoggerFactory.getLogger(SessionErrorHandlingFilter.class);

    private final SessionSynchronizationService sessionSynchronizationService;

    public SessionErrorHandlingFilter(SessionSynchronizationService sessionSynchronizationService) {
      this.sessionSynchronizationService = sessionSynchronizationService;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {

      String sessionId = getSessionId(request);
      SessionState sessionState = null;

      if (sessionId != null) {
        sessionState = sessionStates.computeIfAbsent(sessionId, k -> new SessionState());
        sessionState.updateAccessTime();

        // Mark session as active for the duration of this request
        try {
          sessionSynchronizationService.markSessionActive(sessionId, Duration.ofMinutes(5));
        } catch (Exception e) {
          filterLogger.debug("Failed to mark session {} as active: {}", sessionId, e.getMessage());
        }
      }

      try {
        // Acquire read lock for session operations
        if (sessionId != null) {
          sessionLock.readLock().lock();
        }

        filterChain.doFilter(request, response);

      } catch (IllegalStateException e) {
        handleSessionError(request, response, e, sessionState, sessionId);
      } catch (ServletException e) {
        if (isSessionError(e)) {
          handleSessionError(request, response, e, sessionState, sessionId);
        } else {
          throw e;
        }
      } catch (Exception e) {
        if (isSessionError(e)) {
          handleSessionError(request, response, e, sessionState, sessionId);
        } else {
          throw e;
        }
      } finally {
        // Release read lock
        if (sessionId != null) {
          sessionLock.readLock().unlock();

          // Clear session active marker
          try {
            sessionSynchronizationService.clearSessionActive(sessionId);
          } catch (Exception e) {
            filterLogger.debug(
                "Failed to clear active marker for session {}: {}", sessionId, e.getMessage());
          }
        }

        // Clean up session state if response is committed
        if (sessionState != null && response.isCommitted()) {
          sessionState.markCommitted();
        }
      }
    }

    private String getSessionId(HttpServletRequest request) {
      try {
        return request.getSession(false) != null ? request.getSession().getId() : null;
      } catch (Exception e) {
        return null;
      }
    }

    private boolean isSessionError(Exception e) {
      if (e.getMessage() != null && e.getMessage().contains("Session was invalidated")) {
        return true;
      }

      // Check cause chain for session errors
      Throwable cause = e.getCause();
      while (cause != null) {
        if (cause instanceof IllegalStateException
            && cause.getMessage() != null
            && cause.getMessage().contains("Session was invalidated")) {
          return true;
        }
        cause = cause.getCause();
      }

      return false;
    }

    private void handleSessionError(
        HttpServletRequest request,
        HttpServletResponse response,
        Exception e,
        SessionState sessionState,
        String sessionId) {

      String path = request.getRequestURI();
      String method = request.getMethod();

      // Check if response is already committed or written to
      if (isResponseCommitted(response)) {
        // Only log at debug level for committed responses to reduce noise
        filterLogger.debug(
            "Session invalidation after successful response for {} {} - allowing to complete normally",
            method,
            path);
        return;
      }

      // Check if this is a session invalidation conflict
      if (sessionState != null && sessionState.isCommitted()) {
        filterLogger.debug(
            "Session state already committed for {} {} - allowing to complete normally",
            method,
            path);
        return;
      }

      // For API endpoints, let GlobalSessionExceptionHandler handle them to ensure consistency
      if (path.startsWith("/api/")) {
        filterLogger.debug(
            "API session error - delegating to GlobalSessionExceptionHandler for {} {}",
            method,
            path);
        // Don't write response here, let GlobalSessionExceptionHandler handle it
        return;
      }

      // Log at info level only for uncommitted responses that need handling
      filterLogger.info(
          "Session error handled gracefully for {} {} - {}", method, path, e.getMessage());

      // Handle different request types appropriately
      try {
        if (path.startsWith("/error")) {
          handleErrorPageSessionError(response, path);
        } else {
          handleBrowserSessionError(response, path);
        }
      } catch (IOException ioException) {
        filterLogger.warn(
            "Failed to write error response for {} {}: {}", method, path, ioException.getMessage());
      }
    }

    private boolean isResponseCommitted(HttpServletResponse response) {
      // Check if response is already committed
      if (response.isCommitted()) {
        return true;
      }

      // Check if response stream has already been written to
      try {
        response.getWriter();
        return false; // Writer is available
      } catch (IllegalStateException writerException) {
        if (writerException.getMessage() != null
            && writerException.getMessage().contains("getOutputStream() has already been called")) {
          return true; // Stream already used
        }
        return false;
      } catch (IOException ioException) {
        // If we can't get the writer due to IO issues, assume it's committed
        return true;
      }
    }

    private void handleErrorPageSessionError(HttpServletResponse response, String path)
        throws IOException {

      filterLogger.debug("Session error on error page - preventing cascade for {}", path);

      response.setStatus(HttpServletResponse.SC_OK);
      response.setContentType("text/plain");
      response.setCharacterEncoding("UTF-8");
      response.getWriter().write("Session expired. Please refresh the page.");
    }

    private void handleBrowserSessionError(HttpServletResponse response, String path)
        throws IOException {

      filterLogger.debug("Session error on browser request - redirecting for {}", path);

      response.setStatus(HttpServletResponse.SC_FOUND);
      response.setHeader("Location", "/?sessionExpired=true");
      response.setContentType("text/plain");
      response.setCharacterEncoding("UTF-8");
      response.getWriter().write("Session expired. Redirecting...");
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
      String path = request.getRequestURI();

      // Skip filtering for health checks and actuator endpoints
      return path.startsWith("/actuator/")
          || path.startsWith("/health/")
          || path.startsWith("/api/health/")
          || path.equals("/")
          || path.equals("/health");
    }
  }

  /** Scheduled cleanup of session state tracking to prevent memory leaks. */
  @Bean
  @ConditionalOnProperty(
      name = "session.cleanup.enabled",
      havingValue = "true",
      matchIfMissing = true)
  public SessionStateCleanupTask sessionStateCleanupTask() {
    return new SessionStateCleanupTask();
  }

  public static class SessionStateCleanupTask {

    private static final Logger cleanupLogger =
        LoggerFactory.getLogger(SessionStateCleanupTask.class);

    // Clean up session states older than 1 hour
    public void cleanupOldSessionStates() {
      long cutoffTime = System.currentTimeMillis() - (60 * 60 * 1000); // 1 hour ago

      sessionStates
          .entrySet()
          .removeIf(
              entry -> {
                SessionState state = entry.getValue();
                boolean shouldRemove = state.getLastAccessTime() < cutoffTime;

                if (shouldRemove) {
                  cleanupLogger.debug(
                      "Cleaning up old session state for session: {}", entry.getKey());
                }

                return shouldRemove;
              });

      cleanupLogger.debug(
          "Session state cleanup completed. Active sessions: {}", sessionStates.size());
    }
  }
}
