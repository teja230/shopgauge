package com.storesight.backend.service;

import com.storesight.backend.util.RetryUtil;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Enhanced Redis service with Resilience4j circuit breaker, retry logic, and fallback mechanisms
 * for improved reliability and fault tolerance.
 */
@Service
public class EnhancedRedisService {

  private static final Logger logger = LoggerFactory.getLogger(EnhancedRedisService.class);

  private final StringRedisTemplate stringRedisTemplate;
  private final RedisTemplate<String, Object> redisTemplate;
  private CircuitBreaker circuitBreaker;

  @Autowired
  public EnhancedRedisService(
      StringRedisTemplate stringRedisTemplate, RedisTemplate<String, Object> redisTemplate) {
    this.stringRedisTemplate = stringRedisTemplate;
    this.redisTemplate = redisTemplate;
  }

  @PostConstruct
  public void initialize() {
    // Initialize Resilience4j circuit breaker for Redis operations with enterprise-grade
    // configuration
    CircuitBreakerConfig config =
        CircuitBreakerConfig.custom()
            .failureRateThreshold(50) // 50% failure rate threshold
            .waitDurationInOpenState(
                Duration.ofSeconds(60)) // Wait 60 seconds before transitioning to half-open
            .permittedNumberOfCallsInHalfOpenState(5) // Allow 5 calls in half-open state
            .slidingWindowSize(10) // Consider last 10 calls for failure rate calculation
            .minimumNumberOfCalls(5) // Minimum calls before calculating failure rate
            .recordExceptions(
                java.net.SocketTimeoutException.class,
                java.net.ConnectException.class,
                java.net.NoRouteToHostException.class,
                java.net.UnknownHostException.class,
                org.springframework.data.redis.RedisConnectionFailureException.class,
                org.springframework.data.redis.RedisSystemException.class,
                RuntimeException.class)
            .ignoreExceptions(IllegalArgumentException.class, java.lang.IllegalStateException.class)
            .enableAutomaticTransitionFromOpenToHalfOpen()
            .build();

    CircuitBreakerRegistry registry = CircuitBreakerRegistry.of(config);
    this.circuitBreaker = registry.circuitBreaker("redis-operations");

    // Add event listeners for monitoring and alerting
    circuitBreaker
        .getEventPublisher()
        .onStateTransition(
            event -> {
              logger.info(
                  "Redis circuit breaker state changed: {} -> {}",
                  event.getStateTransition().getFromState(),
                  event.getStateTransition().getToState());
            })
        .onFailureRateExceeded(
            event -> {
              logger.warn(
                  "Redis circuit breaker failure rate exceeded: {}%", event.getFailureRate());
            })
        .onSlowCallRateExceeded(
            event -> {
              logger.warn(
                  "Redis circuit breaker slow call rate exceeded: {}%", event.getSlowCallRate());
            });

    logger.info("Enhanced Redis service initialized with Resilience4j circuit breaker protection");
  }

  /** Set a string value with TTL and fault tolerance */
  public boolean setWithTtl(String key, String value, Duration ttl) {
    return executeWithFallback(
        () -> {
          stringRedisTemplate.opsForValue().set(key, value, ttl);
          return true;
        },
        () -> {
          logger.warn("Redis set operation failed for key: {}, using fallback", key);
          return false;
        });
  }

  /** Get a string value with fault tolerance */
  public Optional<String> get(String key) {
    return executeWithFallback(
        () -> {
          String value = stringRedisTemplate.opsForValue().get(key);
          return Optional.ofNullable(value);
        },
        () -> {
          logger.warn("Redis get operation failed for key: {}, returning empty", key);
          return Optional.empty();
        });
  }

  /** Delete a key with fault tolerance */
  public boolean delete(String key) {
    return executeWithFallback(
        () -> {
          Boolean deleted = stringRedisTemplate.delete(key);
          return deleted != null && deleted;
        },
        () -> {
          logger.warn("Redis delete operation failed for key: {}, using fallback", key);
          return false;
        });
  }

  /** Check if key exists with fault tolerance */
  public boolean exists(String key) {
    return executeWithFallback(
        () -> {
          Boolean exists = stringRedisTemplate.hasKey(key);
          return exists != null && exists;
        },
        () -> {
          logger.warn("Redis exists operation failed for key: {}, returning false", key);
          return false;
        });
  }

  /** Set expiration time for a key */
  public boolean expire(String key, Duration ttl) {
    return executeWithFallback(
        () -> {
          Boolean expired = stringRedisTemplate.expire(key, ttl);
          return expired != null && expired;
        },
        () -> {
          logger.warn("Redis expire operation failed for key: {}, using fallback", key);
          return false;
        });
  }

  /** Get TTL for a key */
  public Optional<Duration> getTtl(String key) {
    return executeWithFallback(
        () -> {
          Long ttl = stringRedisTemplate.getExpire(key, TimeUnit.SECONDS);
          if (ttl != null && ttl > 0) {
            return Optional.of(Duration.ofSeconds(ttl));
          }
          return Optional.empty();
        },
        () -> {
          logger.warn("Redis TTL operation failed for key: {}, returning empty", key);
          return Optional.empty();
        });
  }

  /** Increment a counter with fault tolerance */
  public Optional<Long> increment(String key) {
    return executeWithFallback(
        () -> {
          Long value = stringRedisTemplate.opsForValue().increment(key);
          return Optional.ofNullable(value);
        },
        () -> {
          logger.warn("Redis increment operation failed for key: {}, returning empty", key);
          return Optional.empty();
        });
  }

  /** Increment a counter with TTL */
  public Optional<Long> incrementWithTtl(String key, Duration ttl) {
    return executeWithFallback(
        () -> {
          Long value = stringRedisTemplate.opsForValue().increment(key);
          if (value != null && value == 1) {
            // Set TTL only on first increment
            stringRedisTemplate.expire(key, ttl);
          }
          return Optional.ofNullable(value);
        },
        () -> {
          logger.warn(
              "Redis increment with TTL operation failed for key: {}, returning empty", key);
          return Optional.empty();
        });
  }

  /** Decrement a counter with fault tolerance */
  public Optional<Long> decrement(String key) {
    return executeWithFallback(
        () -> {
          Long value = stringRedisTemplate.opsForValue().decrement(key);
          return Optional.ofNullable(value);
        },
        () -> {
          logger.warn("Redis decrement operation failed for key: {}, returning empty", key);
          return Optional.empty();
        });
  }

  /** Set if absent (SETNX) with TTL */
  public boolean setIfAbsent(String key, String value, Duration ttl) {
    return executeWithFallback(
        () -> {
          Boolean result = stringRedisTemplate.opsForValue().setIfAbsent(key, value, ttl);
          return result != null && result;
        },
        () -> {
          logger.warn("Redis setIfAbsent operation failed for key: {}, returning false", key);
          return false;
        });
  }

  /** Check if key exists (alias for exists method for compatibility) */
  public boolean hasKey(String key) {
    return exists(key);
  }

  /** Add to a set with fault tolerance */
  public boolean addToSet(String key, String... values) {
    return executeWithFallback(
        () -> {
          Long added = stringRedisTemplate.opsForSet().add(key, values);
          return added != null && added > 0;
        },
        () -> {
          logger.warn("Redis set add operation failed for key: {}, using fallback", key);
          return false;
        });
  }

  /** Remove from a set with fault tolerance */
  public boolean removeFromSet(String key, String... values) {
    return executeWithFallback(
        () -> {
          Long removed = stringRedisTemplate.opsForSet().remove(key, (Object[]) values);
          return removed != null && removed > 0;
        },
        () -> {
          logger.warn("Redis set remove operation failed for key: {}, using fallback", key);
          return false;
        });
  }

  /** Check if value is in set */
  public boolean isInSet(String key, String value) {
    return executeWithFallback(
        () -> {
          Boolean isMember = stringRedisTemplate.opsForSet().isMember(key, value);
          return isMember != null && isMember;
        },
        () -> {
          logger.warn("Redis set member check failed for key: {}, returning false", key);
          return false;
        });
  }

  /** Get all members of a set */
  public Optional<Set<String>> getSetMembers(String key) {
    return executeWithFallback(
        () -> {
          Set<String> members = stringRedisTemplate.opsForSet().members(key);
          return Optional.ofNullable(members);
        },
        () -> {
          logger.warn("Redis set members operation failed for key: {}, returning empty", key);
          return Optional.empty();
        });
  }

  /** Acquire a distributed lock with fault tolerance */
  public boolean acquireLock(String lockKey, String lockValue, Duration ttl) {
    return executeWithFallback(
        () -> {
          Boolean acquired = stringRedisTemplate.opsForValue().setIfAbsent(lockKey, lockValue, ttl);
          return acquired != null && acquired;
        },
        () -> {
          logger.warn("Redis lock acquisition failed for key: {}, returning false", lockKey);
          return false;
        });
  }

  /** Release a distributed lock with fault tolerance */
  public boolean releaseLock(String lockKey, String lockValue) {
    return executeWithFallback(
        () -> {
          // Use Lua script to ensure atomic check-and-delete
          String script =
              "if redis.call('get', KEYS[1]) == ARGV[1] then "
                  + "return redis.call('del', KEYS[1]) else return 0 end";

          Long result =
              stringRedisTemplate.execute(
                  (org.springframework.data.redis.core.RedisCallback<Long>)
                      connection ->
                          (Long)
                              connection.eval(
                                  script.getBytes(),
                                  org.springframework.data.redis.connection.ReturnType.INTEGER,
                                  1,
                                  lockKey.getBytes(),
                                  lockValue.getBytes()));

          return result != null && result > 0;
        },
        () -> {
          logger.warn("Redis lock release failed for key: {}, using fallback", lockKey);
          return false;
        });
  }

  /** Test Redis connectivity */
  public boolean testConnection() {
    return executeWithFallback(
        () -> {
          String pong = stringRedisTemplate.getConnectionFactory().getConnection().ping();
          return "PONG".equals(pong);
        },
        () -> {
          logger.warn("Redis connection test failed");
          return false;
        });
  }

  /** Get Redis info for monitoring */
  public Optional<String> getRedisInfo() {
    return executeWithFallback(
        () -> {
          return Optional.ofNullable(
              stringRedisTemplate.getConnectionFactory().getConnection().info().toString());
        },
        () -> {
          logger.warn("Redis info operation failed, returning empty");
          return Optional.empty();
        });
  }

  /** Execute Redis operation with circuit breaker and retry logic */
  private <T> T executeWithFallback(
      java.util.function.Supplier<T> operation, java.util.function.Supplier<T> fallback) {
    try {
      return circuitBreaker.executeSupplier(
          () -> RetryUtil.executeWithRetry(operation, RetryUtil.forRedis()));
    } catch (io.github.resilience4j.circuitbreaker.CallNotPermittedException e) {
      logger.warn("Circuit breaker is open for Redis operations, using fallback");
      return fallback.get();
    } catch (Exception e) {
      logger.error("Redis operation failed after retries, using fallback", e);
      return fallback.get();
    }
  }

  /** Get circuit breaker metrics */
  public CircuitBreaker.Metrics getCircuitBreakerStatistics() {
    return circuitBreaker.getMetrics();
  }

  /** Reset circuit breaker */
  public void resetCircuitBreaker() {
    circuitBreaker.reset();
    logger.info("Redis circuit breaker manually reset");
  }

  /** Force circuit breaker to open state */
  public void forceCircuitBreakerOpen() {
    circuitBreaker.transitionToOpenState();
    logger.warn("Redis circuit breaker manually forced to open state");
  }

  /** Get circuit breaker state */
  public CircuitBreaker.State getCircuitBreakerState() {
    return circuitBreaker.getState();
  }

  /** Check if circuit breaker is open */
  public boolean isCircuitBreakerOpen() {
    return circuitBreaker.getState() == CircuitBreaker.State.OPEN;
  }

  /** Get circuit breaker configuration */
  public CircuitBreakerConfig getCircuitBreakerConfig() {
    return circuitBreaker.getCircuitBreakerConfig();
  }

  /**
   * SCAN for keys matching a pattern without blocking Redis like KEYS.
   * Returns up to maxCount keys if specified (>0), otherwise scans all.
   */
  public java.util.Set<String> scanKeys(String pattern) {
    return scanKeys(pattern, 0);
  }

  public java.util.Set<String> scanKeys(String pattern, int maxCount) {
    return executeWithFallback(
        () -> {
          java.util.Set<String> result = new java.util.HashSet<>();
          stringRedisTemplate.execute(
              (org.springframework.data.redis.core.RedisCallback<Void>)
                  connection -> {
                    org.springframework.data.redis.core.ScanOptions options =
                        org.springframework.data.redis.core.ScanOptions.scanOptions()
                            .match(pattern)
                            .count(1000)
                            .build();
                    try (org.springframework.data.redis.core.Cursor<byte[]> cursor =
                        connection.scan(options)) {
                      while (cursor.hasNext()) {
                        String key = new String(cursor.next());
                        result.add(key);
                        if (maxCount > 0 && result.size() >= maxCount) {
                          break;
                        }
                      }
                    } catch (Exception e) {
                      logger.warn("SCAN failed for pattern {}: {}", pattern, e.getMessage());
                    }
                    return null;
                  });
          return result;
        },
        java.util.Collections::emptySet);
  }

  /**
   * Delete all keys that match a pattern using SCAN to avoid blocking.
   * Returns the number of keys deleted.
   */
  public long deleteByPattern(String pattern) {
    java.util.Set<String> keys = scanKeys(pattern);
    if (keys == null || keys.isEmpty()) return 0L;
    return executeWithFallback(
        () -> {
          Long deleted = stringRedisTemplate.delete(keys);
          return deleted != null ? deleted : 0L;
        },
        () -> 0L);
  }
}
