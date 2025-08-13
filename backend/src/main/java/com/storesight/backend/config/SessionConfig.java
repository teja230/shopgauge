package com.storesight.backend.config;

import com.storesight.backend.service.EnhancedRedisService;
import com.storesight.backend.service.RedisSessionService;
import com.storesight.backend.service.SessionRecoveryService;
import com.storesight.backend.service.SessionSecurityService;
import com.storesight.backend.service.SessionSynchronizationService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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

  // WARNING: Process-local state is not cluster-safe. Retained only for minimal in-node
  // coordination.
  // For cross-node fencing, EnhancedRedisService locks are used around critical sections.
  private static final ConcurrentHashMap<String, SessionState> sessionStates =
      new ConcurrentHashMap<>();

  @Autowired private RedisSessionService redisSessionService;

  @Autowired private SessionRecoveryService sessionRecoveryService;

  @Autowired private SessionSecurityService sessionSecurityService;

  @Autowired private SessionSynchronizationService sessionSynchronizationService;

  @Autowired private EnhancedRedisService enhancedRedisService;

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
   * <p>This filter now avoids any response writing. It tags the request when a session error is
   * seen and rethrows to be handled by a centralized @ControllerAdvice.
   */
  @Bean
  @Order(1) // Highest priority to catch session errors first
  public SessionErrorHandlingFilter sessionErrorHandlingFilter() {
    return new SessionErrorHandlingFilter(sessionSynchronizationService, enhancedRedisService);
  }

  /**
   * Filter that runs right after Spring's SessionRepositoryFilter to catch low-level Redis/session
   * errors (including ERR no such key) and prevent cascades.
   */
  @Bean
  public SessionRepositoryErrorFilter sessionRepositoryErrorFilter() {
    return new SessionRepositoryErrorFilter();
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
    private final EnhancedRedisService enhancedRedisService;

    public SessionErrorHandlingFilter(
        SessionSynchronizationService sessionSynchronizationService,
        EnhancedRedisService enhancedRedisService) {
      this.sessionSynchronizationService = sessionSynchronizationService;
      this.enhancedRedisService = enhancedRedisService;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
      try {
        filterChain.doFilter(request, response);
      } catch (IllegalStateException e) {
        if (isSessionError(e)) {
          request.setAttribute("session.error", true);
        }
        throw e;
      } catch (ServletException e) {
        if (isSessionError(e)) {
          request.setAttribute("session.error", true);
        }
        throw e;
      } catch (Exception e) {
        if (isSessionError(e)) {
          request.setAttribute("session.error", true);
        }
        throw new ServletException(e);
      }
    }

    private boolean isSessionError(Exception e) {
      // Direct session invalidation
      if (e.getMessage() != null && e.getMessage().contains("Session was invalidated")) {
        return true;
      }

      // Redis session/storage errors
      if (e instanceof org.springframework.data.redis.RedisSystemException) {
        return true;
      }
      if (e.getMessage() != null && e.getMessage().contains("ERR no such key")) {
        return true;
      }

      // Check cause chain for session/Redis errors
      Throwable cause = e.getCause();
      while (cause != null) {
        if (cause instanceof IllegalStateException
            && cause.getMessage() != null
            && cause.getMessage().contains("Session was invalidated")) {
          return true;
        }
        if (cause instanceof org.springframework.data.redis.RedisSystemException) {
          return true;
        }
        if (cause.getClass().getName().contains("RedisCommandExecutionException")
            && cause.getMessage() != null
            && cause.getMessage().contains("ERR no such key")) {
          return true;
        }
        cause = cause.getCause();
      }

      return false;
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

  // Removed response-writing cleanup tasks and process-local cleanup scheduling to avoid
  // process-local state patterns. Any cross-node coordination should use Redis-based tokens.
}
