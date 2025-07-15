package com.storesight.backend.service;

import com.storesight.backend.model.Shop;
import com.storesight.backend.model.ShopSession;
import com.storesight.backend.repository.ShopRepository;
import com.storesight.backend.repository.ShopSessionRepository;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Service
public class ShopService {
  private static final Logger logger = LoggerFactory.getLogger(ShopService.class);

  private final ShopRepository shopRepository;
  private final ShopSessionRepository shopSessionRepository;
  private final StringRedisTemplate redisTemplate;
  private final AsyncSessionService asyncSessionService;
  private final TransactionMonitoringService transactionMonitoringService;
  private final RedisSessionService redisSessionService; // Added RedisSessionService

  // Redis key patterns for backward compatibility and caching
  private static final String SHOP_TOKEN_PREFIX = "shop_token:";
  private static final String SHOP_SESSION_PREFIX = "shop_session:";
  private static final String ACTIVE_SESSIONS_PREFIX = "active_sessions:";
  private static final String INVALID_SESSION_PREFIX = "invalid_session:";
  private static final String VALIDATION_FAILURE_COUNT_PREFIX = "validation_failure_count:";

  // TTL values - Optimized for better resource management and reduced DB load
  private static final int REDIS_CACHE_TTL_MINUTES = 120; // Increased from 30 to 120 minutes
  private static final int REDIS_FALLBACK_TTL_MINUTES = 60; // Fallback cache TTL
  private static final int SESSION_INACTIVITY_HOURS = 4; // 4 hours (business app standard)
  private static final int SESSION_CLEANUP_DAYS = 2; // 2 days
  private static final int MAX_SESSIONS_PER_SHOP = 5; // Limit concurrent sessions per shop
  private static final int INVALID_SESSION_CACHE_MINUTES =
      15; // Cache invalid sessions for 15 minutes

  @Autowired
  public ShopService(
      ShopRepository shopRepository,
      ShopSessionRepository shopSessionRepository,
      StringRedisTemplate redisTemplate,
      AsyncSessionService asyncSessionService,
      TransactionMonitoringService transactionMonitoringService,
      RedisSessionService redisSessionService) { // Added RedisSessionService to constructor
    this.shopRepository = shopRepository;
    this.shopSessionRepository = shopSessionRepository;
    this.redisTemplate = redisTemplate;
    this.asyncSessionService = asyncSessionService;
    this.transactionMonitoringService = transactionMonitoringService;
    this.redisSessionService = redisSessionService; // Initialize RedisSessionService
  }

  @PostConstruct
  public void initializeService() {
    logger.info("Initializing ShopService...");

    // Warm up Redis connection
    try {
      redisTemplate
          .opsForValue()
          .set("shop_service_init", "initialized", java.time.Duration.ofSeconds(60));
      String testValue = redisTemplate.opsForValue().get("shop_service_init");
      if ("initialized".equals(testValue)) {
        logger.info("Redis connection verified successfully");
      } else {
        logger.warn("Redis connection test failed - got: {}", testValue);
      }
    } catch (Exception e) {
      logger.error(
          "Redis connection not available at startup - will retry on demand: {}", e.getMessage());
      // Don't throw exception to allow startup to continue
      // Redis is optional - the app can work without it
    }

    // Warm up database connection
    try {
      long shopCount = shopRepository.count();
      logger.info("Database connection verified - found {} shops", shopCount);
    } catch (Exception e) {
      logger.error("Failed to initialize database connection: {}", e.getMessage());
      // Don't throw exception to allow startup to continue
    }

    logger.info("ShopService initialization completed");
  }

  /**
   * Enhanced session saving with immediate session limit enforcement Optimized for minimal database
   * connection usage
   */
  @Transactional(timeout = 10) // Reduced from 15s to 10s for faster connection release
  public ShopSession saveShop(
      String shopifyDomain, String accessToken, String sessionId, HttpServletRequest request) {
    long start = System.currentTimeMillis();
    try {
      logger.info("Saving shop: {} for session: {}", shopifyDomain, sessionId);

      // Validate and ensure we have a valid sessionId
      String validSessionId = sessionId;
      if (validSessionId == null || validSessionId.trim().isEmpty()) {
        validSessionId =
            "fallback_" + System.currentTimeMillis() + "_" + Math.abs(shopifyDomain.hashCode());
        logger.warn(
            "Generated fallback sessionId for shop: {} - original was null/empty", shopifyDomain);
      }

      // Find or create shop - optimized single query
      Shop shop =
          shopRepository
              .findByShopifyDomain(shopifyDomain)
              .orElseGet(
                  () -> {
                    Shop newShop = new Shop(shopifyDomain, accessToken);
                    return shopRepository.save(newShop);
                  });

      // Update shop's main access token (most recent one)
      shop.setAccessToken(accessToken);
      shop = shopRepository.save(shop);

      // CRITICAL: Enforce session limit BEFORE creating new session
      enforceSessionLimitSync(shop, validSessionId);

      // Create or update session (optimized to minimize transaction time)
      ShopSession session = createOrUpdateSession(shop, validSessionId, accessToken, request);

      logger.info(
          "Shop and session saved successfully: {} with session: {}",
          shopifyDomain,
          validSessionId);
      transactionMonitoringService.recordSuccess("saveShop", System.currentTimeMillis() - start);
      return session;
    } catch (Exception e) {
      logger.error("Error saving shop data for {}: {}", shopifyDomain, e.getMessage(), e);
      transactionMonitoringService.recordFailure(
          "saveShop",
          e.getClass().getSimpleName(),
          e.getMessage(),
          System.currentTimeMillis() - start);
      throw e;
    }
  }

  /**
   * Synchronous session limit enforcement to prevent race conditions This runs within the same
   * transaction as session creation
   */
  private void enforceSessionLimitSync(Shop shop, String currentSessionId) {
    try {
      List<ShopSession> activeSessions =
          shopSessionRepository.findByShopAndIsActiveTrueOrderByLastAccessedAtDesc(shop);

      logger.debug(
          "Found {} active sessions for shop: {}", activeSessions.size(), shop.getShopifyDomain());

      // If we're at or over the limit, we need to deactivate old sessions
      if (activeSessions.size() >= MAX_SESSIONS_PER_SHOP) {
        // Check if current session already exists in the list
        boolean currentSessionExists =
            activeSessions.stream().anyMatch(s -> s.getSessionId().equals(currentSessionId));

        int sessionsToDeactivate =
            currentSessionExists
                ? activeSessions.size() - MAX_SESSIONS_PER_SHOP
                : activeSessions.size() - MAX_SESSIONS_PER_SHOP + 1;

        if (sessionsToDeactivate > 0) {
          // Deactivate the oldest sessions (keep the most recent ones)
          List<ShopSession> sessionsToRemove =
              activeSessions.stream()
                  .skip(MAX_SESSIONS_PER_SHOP - (currentSessionExists ? 1 : 0))
                  .collect(Collectors.toList());

          logger.info(
              "Enforcing session limit: deactivating {} sessions for shop: {}",
              sessionsToRemove.size(),
              shop.getShopifyDomain());

          for (ShopSession session : sessionsToRemove) {
            session.deactivate();
            shopSessionRepository.save(session);
            // Note: Redis cleanup will be done in post-transaction operations
          }
        }
      }
    } catch (Exception e) {
      logger.error(
          "Error enforcing session limit for shop {}: {}",
          shop.getShopifyDomain(),
          e.getMessage(),
          e);
      // Don't fail the transaction, but log the error
    }
  }

  /**
   * Post-transaction operations to reduce connection holding time These operations are moved
   * outside the transaction for better performance
   */
  public void postSaveShopOperations(
      String shopifyDomain, String validSessionId, String accessToken) {
    try {
      // Cache in Redis for performance (with increased TTL)
      cacheShopSession(shopifyDomain, validSessionId, accessToken);

      // Update active sessions list
      updateActiveSessionsList(shopifyDomain);

      // Clean up Redis cache for any deactivated sessions
      cleanupDeactivatedSessionsFromRedis(shopifyDomain);

    } catch (Exception e) {
      logger.warn("Post-save operations failed for shop {}: {}", shopifyDomain, e.getMessage());
    }
  }

  /** Backward compatibility method */
  @Transactional
  public void saveShop(String shopifyDomain, String accessToken, String sessionId) {
    long start = System.currentTimeMillis();
    try {
      // Validate and ensure we have a valid sessionId
      String validSessionId = sessionId;
      if (validSessionId == null || validSessionId.trim().isEmpty()) {
        validSessionId =
            "fallback_" + System.currentTimeMillis() + "_" + Math.abs(shopifyDomain.hashCode());
        logger.warn(
            "Generated fallback sessionId for shop: {} - original was null/empty", shopifyDomain);
      }

      saveShop(shopifyDomain, accessToken, validSessionId, null);
      transactionMonitoringService.recordSuccess(
          "saveShop_compat", System.currentTimeMillis() - start);
    } catch (Exception e) {
      transactionMonitoringService.recordFailure(
          "saveShop_compat",
          e.getClass().getSimpleName(),
          e.getMessage(),
          System.currentTimeMillis() - start);
      throw e;
    }
  }

  /** Get access token for a specific shop and session - Reactive version */
  public Mono<String> getTokenForShopReactive(String shopifyDomain, String sessionId) {
    long start = System.currentTimeMillis();
    try {
      logger.debug("Getting token for shop: {} and session: {}", shopifyDomain, sessionId);

      if (sessionId == null) {
        return getTokenForShopFallbackReactive(shopifyDomain);
      }

      // Try Redis cache first with proper error handling
      String cachedToken = null;
      try {
        cachedToken =
            redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId);
        if (cachedToken != null) {
          logger.debug(
              "Found token in Redis cache for shop: {} and session: {}", shopifyDomain, sessionId);
          // FIXED: Update last accessed time asynchronously to avoid transaction violations
          updateSessionLastAccessedAsync(sessionId);
          transactionMonitoringService.recordSuccess(
              "getTokenForShopReactive", System.currentTimeMillis() - start);
          return Mono.just(cachedToken);
        }
      } catch (Exception e) {
        logger.warn(
            "Redis unavailable for reactive token lookup - falling back to database: {}",
            e.getMessage());
        // Continue to database lookup
      }

      // Try database using reactive pattern
      return Mono.fromCallable(
              () ->
                  shopSessionRepository.findActiveSessionByShopDomainAndSessionId(
                      shopifyDomain, sessionId))
          .publishOn(Schedulers.boundedElastic())
          .flatMap(
              sessionOpt -> {
                if (sessionOpt.isPresent()) {
                  ShopSession session = sessionOpt.get();
                  String token = session.getAccessToken();

                  // FIXED: Update last accessed time asynchronously to avoid transaction violations
                  updateSessionLastAccessedAsync(sessionId);

                  // Cache for future requests
                  cacheShopSession(shopifyDomain, sessionId, token);
                  transactionMonitoringService.recordSuccess(
                      "getTokenForShopReactive", System.currentTimeMillis() - start);
                  return Mono.just(token);
                }

                // Fallback to most recent active session for this shop
                logger.warn(
                    "No specific session found, trying fallback for shop: {} and session: {}",
                    shopifyDomain,
                    sessionId);
                transactionMonitoringService.recordSuccess(
                    "getTokenForShopReactive", System.currentTimeMillis() - start);
                return getTokenForShopFallbackReactive(shopifyDomain);
              });
    } catch (Exception e) {
      transactionMonitoringService.recordFailure(
          "getTokenForShopReactive",
          e.getClass().getSimpleName(),
          e.getMessage(),
          System.currentTimeMillis() - start);
      throw e;
    }
  }

  /** Enhanced token retrieval with improved Redis caching strategy */
  @Transactional(readOnly = true, timeout = 5) // Reduced timeout for read-only operations
  public String getTokenForShop(String shopifyDomain, String sessionId) {
    long start = System.currentTimeMillis();
    try {
      logger.debug("Getting token for shop: {} and session: {}", shopifyDomain, sessionId);

      if (sessionId == null) {
        return getTokenForShopFallback(shopifyDomain);
      }

      // Check if this session was recently marked as invalid
      try {
        String invalidSessionKey = INVALID_SESSION_PREFIX + shopifyDomain + ":" + sessionId;
        String invalidSession = redisTemplate.opsForValue().get(invalidSessionKey);
        if (invalidSession != null) {
          logger.debug(
              "Session {} for shop {} was recently marked as invalid, using fallback",
              sessionId,
              shopifyDomain);
          return getTokenForShopFallback(shopifyDomain);
        }
      } catch (Exception e) {
        logger.debug("Redis unavailable for invalid session check: {}", e.getMessage());
      }

      // Try Redis cache first with improved error handling
      String cachedToken = null;
      try {
        cachedToken =
            redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId);
        if (cachedToken != null) {
          logger.debug(
              "Found token in Redis cache for shop: {} and session: {}", shopifyDomain, sessionId);
          // CRITICAL FIX: Update last accessed time asynchronously OUTSIDE the read-only
          // transaction
          // This prevents read-only transaction violations
          updateSessionLastAccessedAsync(sessionId);

          // Clear invalid session cache since we found a valid session
          clearInvalidSessionCache(shopifyDomain, sessionId);

          transactionMonitoringService.recordSuccess(
              "getTokenForShop", System.currentTimeMillis() - start);
          return cachedToken;
        }
      } catch (Exception e) {
        logger.warn(
            "Redis unavailable for token lookup - falling back to database: {}", e.getMessage());
      }

      // Try database with read-only transaction - NO UPDATES ALLOWED HERE
      Optional<ShopSession> sessionOpt =
          shopSessionRepository.findActiveSessionByShopDomainAndSessionId(shopifyDomain, sessionId);

      if (sessionOpt.isPresent()) {
        ShopSession session = sessionOpt.get();
        String token = session.getAccessToken();

        // CRITICAL FIX: Update last accessed time asynchronously OUTSIDE the read-only transaction
        // This runs in a separate thread pool and transaction context
        updateSessionLastAccessedAsync(sessionId);

        // Cache for future requests with extended TTL
        cacheShopSessionWithExtendedTTL(shopifyDomain, sessionId, token);

        // Clear invalid session cache since we found a valid session
        clearInvalidSessionCache(shopifyDomain, sessionId);

        logger.debug(
            "Found token in database for shop: {} and session: {}", shopifyDomain, sessionId);
        transactionMonitoringService.recordSuccess(
            "getTokenForShop", System.currentTimeMillis() - start);
        return token;
      }

      // Cache this invalid session to prevent repeated database lookups
      try {
        String invalidSessionKey = INVALID_SESSION_PREFIX + shopifyDomain + ":" + sessionId;
        redisTemplate
            .opsForValue()
            .set(
                invalidSessionKey,
                "invalid",
                java.time.Duration.ofMinutes(INVALID_SESSION_CACHE_MINUTES));
        logger.debug(
            "Cached invalid session {} for shop {} to prevent repeated lookups",
            sessionId,
            shopifyDomain);
      } catch (Exception e) {
        logger.debug("Failed to cache invalid session: {}", e.getMessage());
      }

      // Fallback to most recent active session for this shop
      logger.debug(
          "No specific session found, using fallback for shop: {} and session: {}",
          shopifyDomain,
          sessionId);
      transactionMonitoringService.recordSuccess(
          "getTokenForShop", System.currentTimeMillis() - start);
      return getTokenForShopFallback(shopifyDomain);
    } catch (Exception e) {
      transactionMonitoringService.recordFailure(
          "getTokenForShop",
          e.getClass().getSimpleName(),
          e.getMessage(),
          System.currentTimeMillis() - start);
      throw e;
    }
  }

  /** Enhanced token retrieval with Redis-first approach */
  @Transactional(readOnly = true, timeout = 5)
  public String getTokenForShopRedisFirst(String shopifyDomain, String sessionId) {
    long start = System.currentTimeMillis();
    try {
      logger.debug(
          "Getting token for shop: {} and session: {} (Redis-first)", shopifyDomain, sessionId);

      if (sessionId == null) {
        return getTokenForShopFallback(shopifyDomain);
      }

      // Try Redis-first approach
      Optional<String> redisToken = redisSessionService.getSessionToken(shopifyDomain, sessionId);
      if (redisToken.isPresent()) {
        logger.debug(
            "Found token via Redis-first approach for shop: {} and session: {}",
            shopifyDomain,
            sessionId);
        transactionMonitoringService.recordSuccess(
            "getTokenForShopRedisFirst", System.currentTimeMillis() - start);
        return redisToken.get();
      }

      // Fallback to original method if Redis-first fails
      logger.debug(
          "Redis-first approach failed, falling back to database for shop: {} and session: {}",
          shopifyDomain,
          sessionId);
      return getTokenForShop(shopifyDomain, sessionId);

    } catch (Exception e) {
      transactionMonitoringService.recordFailure(
          "getTokenForShopRedisFirst",
          e.getClass().getSimpleName(),
          e.getMessage(),
          System.currentTimeMillis() - start);
      throw e;
    }
  }

  /** Get token for shop without specific session (fallback method) - Reactive version */
  private Mono<String> getTokenForShopFallbackReactive(String shopifyDomain) {
    long start = System.currentTimeMillis();
    try {
      logger.debug("Getting fallback token for shop: {}", shopifyDomain);

      // Try Redis cache (shop-only key) with proper error handling
      try {
        String cachedToken = redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain);
        if (cachedToken != null) {
          logger.debug("Found fallback token in Redis for shop: {}", shopifyDomain);
          transactionMonitoringService.recordSuccess(
              "getTokenForShopFallbackReactive", System.currentTimeMillis() - start);
          return Mono.just(cachedToken);
        }
      } catch (Exception e) {
        logger.warn(
            "Redis unavailable for reactive fallback token lookup - continuing to database: {}",
            e.getMessage());
        // Continue to database lookup
      }

      // Try most recent active session from database
      return Mono.fromCallable(
              () -> shopSessionRepository.findMostRecentActiveSessionByDomain(shopifyDomain))
          .publishOn(Schedulers.boundedElastic())
          .flatMap(
              recentSessionOpt -> {
                if (recentSessionOpt.isPresent()) {
                  ShopSession session = recentSessionOpt.get();
                  String token = session.getAccessToken();

                  // FIXED: Update last accessed time asynchronously to avoid transaction violations
                  updateSessionLastAccessedAsync(session.getSessionId());

                  // Cache for future requests
                  redisTemplate
                      .opsForValue()
                      .set(
                          SHOP_TOKEN_PREFIX + shopifyDomain,
                          token,
                          java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));
                  transactionMonitoringService.recordSuccess(
                      "getTokenForShopFallbackReactive", System.currentTimeMillis() - start);
                  return Mono.just(token);
                }

                // Fallback to shop's main token
                return Mono.fromCallable(() -> shopRepository.findByShopifyDomain(shopifyDomain))
                    .publishOn(Schedulers.boundedElastic())
                    .map(
                        shopOpt -> {
                          if (shopOpt.isPresent()) {
                            String token = shopOpt.get().getAccessToken();
                            if (token != null) {
                              // Cache for future requests
                              redisTemplate
                                  .opsForValue()
                                  .set(
                                      SHOP_TOKEN_PREFIX + shopifyDomain,
                                      token,
                                      java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));

                              logger.debug(
                                  "Found fallback token from shop for shop: {}", shopifyDomain);
                              transactionMonitoringService.recordSuccess(
                                  "getTokenForShopFallbackReactive",
                                  System.currentTimeMillis() - start);
                              return token;
                            }
                          }
                          logger.warn("No token found for shop: {}", shopifyDomain);
                          transactionMonitoringService.recordSuccess(
                              "getTokenForShopFallbackReactive",
                              System.currentTimeMillis() - start);
                          return null;
                        });
              });
    } catch (Exception e) {
      transactionMonitoringService.recordFailure(
          "getTokenForShopFallbackReactive",
          e.getClass().getSimpleName(),
          e.getMessage(),
          System.currentTimeMillis() - start);
      throw e;
    }
  }

  /** Get token for shop without specific session (fallback method) - Blocking version */
  private String getTokenForShopFallback(String shopifyDomain) {
    long start = System.currentTimeMillis();
    try {
      logger.debug("Getting fallback token for shop: {}", shopifyDomain);

      // Try Redis cache (shop-only key) with proper error handling
      try {
        String cachedToken = redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain);
        if (cachedToken != null) {
          logger.debug("Found fallback token in Redis for shop: {}", shopifyDomain);
          transactionMonitoringService.recordSuccess(
              "getTokenForShopFallback", System.currentTimeMillis() - start);
          return cachedToken;
        }
      } catch (Exception e) {
        logger.warn(
            "Redis unavailable for fallback token lookup - continuing to database: {}",
            e.getMessage());
        // Continue to database lookup
      }

      // Try most recent active session from database
      Optional<ShopSession> recentSessionOpt =
          shopSessionRepository.findMostRecentActiveSessionByDomain(shopifyDomain);

      if (recentSessionOpt.isPresent()) {
        ShopSession session = recentSessionOpt.get();
        String token = session.getAccessToken();

        // FIXED: Update last accessed time asynchronously to avoid read-only transaction violation
        updateSessionLastAccessedAsync(session.getSessionId());

        // Cache for future requests
        redisTemplate
            .opsForValue()
            .set(
                SHOP_TOKEN_PREFIX + shopifyDomain,
                token,
                java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));

        logger.debug("Found fallback token from most recent session for shop: {}", shopifyDomain);
        transactionMonitoringService.recordSuccess(
            "getTokenForShopFallback", System.currentTimeMillis() - start);
        return token;
      }

      // Fallback to shop's main token
      Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopifyDomain);
      if (shopOpt.isPresent()) {
        String token = shopOpt.get().getAccessToken();
        if (token != null) {
          // Cache for future requests
          redisTemplate
              .opsForValue()
              .set(
                  SHOP_TOKEN_PREFIX + shopifyDomain,
                  token,
                  java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));

          logger.debug("Found fallback token from shop for shop: {}", shopifyDomain);
          transactionMonitoringService.recordSuccess(
              "getTokenForShopFallback", System.currentTimeMillis() - start);
          return token;
        }
      }

      logger.warn("No token found for shop: {}", shopifyDomain);
      transactionMonitoringService.recordSuccess(
          "getTokenForShopFallback", System.currentTimeMillis() - start);
      return null;
    } catch (Exception e) {
      transactionMonitoringService.recordFailure(
          "getTokenForShopFallback",
          e.getClass().getSimpleName(),
          e.getMessage(),
          System.currentTimeMillis() - start);
      throw e;
    }
  }

  /** Remove/deactivate a specific session */
  @Transactional
  public void removeSession(String shopifyDomain, String sessionId) {
    long start = System.currentTimeMillis();
    try {
      logger.info("Deactivating session for shop: {} and session: {}", shopifyDomain, sessionId);

      try {
        // Deactivate in database
        shopSessionRepository.deactivateSession(sessionId);

        // Remove from Redis cache with error handling
        try {
          String redisKey = SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId;
          Boolean deleted = redisTemplate.delete(redisKey);
          if (deleted != null && deleted) {
            logger.debug("Successfully removed session from Redis: {}", redisKey);
          } else {
            logger.debug("Session key not found in Redis (already removed): {}", redisKey);
          }
        } catch (Exception redisEx) {
          logger.warn(
              "Failed to remove session from Redis cache for {}:{} - {}",
              shopifyDomain,
              sessionId,
              redisEx.getMessage());
          // Continue with other cleanup operations even if Redis fails
        }

        // Update active sessions list
        updateActiveSessionsList(shopifyDomain);

        // Clear invalid session cache
        clearInvalidSessionCache(shopifyDomain, sessionId);

        logger.info("Session deactivated: {} for shop: {}", sessionId, shopifyDomain);
        transactionMonitoringService.recordSuccess(
            "removeSession", System.currentTimeMillis() - start);
      } catch (Exception e) {
        logger.error(
            "Error deactivating session {} for shop {}: {}",
            sessionId,
            shopifyDomain,
            e.getMessage(),
            e);
        // Don't propagate the exception to avoid causing HTTP session issues
        transactionMonitoringService.recordFailure(
            "removeSession",
            e.getClass().getSimpleName(),
            e.getMessage(),
            System.currentTimeMillis() - start);
      }
    } catch (Exception e) {
      transactionMonitoringService.recordFailure(
          "removeSession",
          e.getClass().getSimpleName(),
          e.getMessage(),
          System.currentTimeMillis() - start);
      throw e;
    }
  }

  /** Remove/deactivate all sessions for a shop (complete logout) */
  @Transactional
  public void removeAllSessionsForShop(String shopifyDomain) {
    long start = System.currentTimeMillis();
    try {
      logger.info("Deactivating all sessions for shop: {}", shopifyDomain);

      try {
        Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopifyDomain);
        if (shopOpt.isPresent()) {
          Shop shop = shopOpt.get();

          // Deactivate all sessions in database
          shopSessionRepository.deactivateAllSessionsForShop(shop);

          // Clear Redis cache
          clearShopCache(shopifyDomain);

          logger.info("All sessions deactivated for shop: {}", shopifyDomain);
          transactionMonitoringService.recordSuccess(
              "removeAllSessionsForShop", System.currentTimeMillis() - start);
        } else {
          logger.warn("Shop not found for session cleanup: {}", shopifyDomain);
          transactionMonitoringService.recordSuccess(
              "removeAllSessionsForShop", System.currentTimeMillis() - start);
        }
      } catch (Exception e) {
        logger.error(
            "Error deactivating all sessions for shop {}: {}", shopifyDomain, e.getMessage(), e);
        // Don't propagate the exception to avoid causing HTTP session issues
        transactionMonitoringService.recordFailure(
            "removeAllSessionsForShop",
            e.getClass().getSimpleName(),
            e.getMessage(),
            System.currentTimeMillis() - start);
      }
    } catch (Exception e) {
      transactionMonitoringService.recordFailure(
          "removeAllSessionsForShop",
          e.getClass().getSimpleName(),
          e.getMessage(),
          System.currentTimeMillis() - start);
      throw e;
    }
  }

  /** Get all active sessions for a shop */
  @Transactional(readOnly = true)
  public List<ShopSession> getActiveSessionsForShop(String shopifyDomain) {
    try {
      Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopifyDomain);
      if (shopOpt.isPresent()) {
        return shopSessionRepository.findByShopAndIsActiveTrueOrderByLastAccessedAtDesc(
            shopOpt.get());
      }
      return new ArrayList<>();
    } catch (Exception e) {
      logger.error(
          "Error getting active sessions for shop {}: {}", shopifyDomain, e.getMessage(), e);
      return new ArrayList<>();
    }
  }

  @Transactional(readOnly = true)
  public List<ShopSession> getAllActiveSessions() {
    try {
      // Get all shops first, then get their active sessions
      List<Shop> allShops = shopRepository.findAll();
      List<ShopSession> allActiveSessions = new ArrayList<>();

      for (Shop shop : allShops) {
        List<ShopSession> shopSessions =
            shopSessionRepository.findByShopAndIsActiveTrueOrderByLastAccessedAtDesc(shop);
        allActiveSessions.addAll(shopSessions);
      }

      return allActiveSessions;
    } catch (Exception e) {
      logger.error("Error getting all active sessions: {}", e.getMessage(), e);
      return new ArrayList<>();
    }
  }

  /** Get session information for debugging */
  @Transactional(readOnly = true)
  public Optional<ShopSession> getSessionInfo(String sessionId) {
    long start = System.currentTimeMillis();
    try {
      return shopSessionRepository.findBySessionId(sessionId);
    } catch (Exception e) {
      transactionMonitoringService.recordFailure(
          "getSessionInfo",
          e.getClass().getSimpleName(),
          e.getMessage(),
          System.currentTimeMillis() - start);
      throw e;
    }
  }

  /** Backward compatibility method */
  @Transactional(readOnly = true)
  public Mono<String> getShopAccessToken(String shopDomain) {
    long start = System.currentTimeMillis();
    try {
      String token = getTokenForShop(shopDomain, null);
      if (token == null) {
        logger.error("No access token found for shop: {}", shopDomain);
        transactionMonitoringService.recordSuccess(
            "getShopAccessToken", System.currentTimeMillis() - start);
        return Mono.error(new RuntimeException("No access token found for shop"));
      }
      transactionMonitoringService.recordSuccess(
          "getShopAccessToken", System.currentTimeMillis() - start);
      return Mono.just(token);
    } catch (Exception e) {
      transactionMonitoringService.recordFailure(
          "getShopAccessToken",
          e.getClass().getSimpleName(),
          e.getMessage(),
          System.currentTimeMillis() - start);
      throw e;
    }
  }

  // Private helper methods

  private ShopSession createOrUpdateSession(
      Shop shop, String sessionId, String accessToken, HttpServletRequest request) {

    logger.info(
        "Creating/updating session for shop: {} with sessionId: {}",
        shop.getShopifyDomain(),
        sessionId);

    // Final validation to ensure sessionId is never null
    if (sessionId == null || sessionId.trim().isEmpty()) {
      sessionId =
          "emergency_"
              + System.currentTimeMillis()
              + "_"
              + Math.abs(shop.getShopifyDomain().hashCode());
      logger.error(
          "Emergency sessionId generation in createOrUpdateSession for shop: {}",
          shop.getShopifyDomain());
    }

    // First check for any existing session (active or inactive) with this sessionId
    Optional<ShopSession> existingSessionOpt = shopSessionRepository.findBySessionId(sessionId);
    logger.info(
        "Checking for existing session with ID: {} - found: {}",
        sessionId,
        existingSessionOpt.isPresent());

    ShopSession session;
    if (existingSessionOpt.isPresent()) {
      // Session exists - check if it's for the same shop and reactivate if needed
      ShopSession existingSession = existingSessionOpt.get();
      logger.info(
          "Existing session found - shop: {}, isActive: {}",
          existingSession.getShop().getShopifyDomain(),
          existingSession.getIsActive());

      if (existingSession.getShop().getId().equals(shop.getId())) {
        // Same shop - reactivate and update the session
        existingSession.setIsActive(true);
        existingSession.setAccessToken(accessToken);
        existingSession.markAsAccessed();
        if (request != null) {
          existingSession.setUserAgent(request.getHeader("User-Agent"));
          existingSession.setIpAddress(getClientIpAddress(request));
        }
        session = existingSession;
        logger.info(
            "Reactivated existing session: {} for shop: {}", sessionId, shop.getShopifyDomain());
      } else {
        // Different shop - this shouldn't happen with unique session IDs, but handle gracefully
        logger.warn(
            "Session ID {} already exists for different shop, generating new session ID",
            sessionId);
        sessionId =
            "conflict_"
                + System.currentTimeMillis()
                + "_"
                + Math.abs(shop.getShopifyDomain().hashCode());
        session = new ShopSession(shop, sessionId, accessToken);
        if (request != null) {
          session.setUserAgent(request.getHeader("User-Agent"));
          session.setIpAddress(getClientIpAddress(request));
        }
        logger.info(
            "Created new session with conflict resolution: {} for shop: {}",
            sessionId,
            shop.getShopifyDomain());
      }
    } else {
      // No existing session - create new one
      session = new ShopSession(shop, sessionId, accessToken);
      if (request != null) {
        session.setUserAgent(request.getHeader("User-Agent"));
        session.setIpAddress(getClientIpAddress(request));
      }
      logger.info("Creating new session: {} for shop: {}", sessionId, shop.getShopifyDomain());
    }

    // Set expiration time (optional)
    session.setExpiresAt(LocalDateTime.now().plusHours(SESSION_INACTIVITY_HOURS));

    // Clear invalid session cache since we now have a valid session
    clearInvalidSessionCache(shop.getShopifyDomain(), sessionId);

    logger.info("Saving session to database: {} for shop: {}", sessionId, shop.getShopifyDomain());

    // SECURE: Attempt to save session with proper error handling
    try {
      ShopSession savedSession = shopSessionRepository.save(session);
      logger.info(
          "Successfully saved session: {} for shop: {}", sessionId, shop.getShopifyDomain());
      return savedSession;
    } catch (Exception e) {
      logger.error(
          "Failed to save session: {} for shop: {} - Error: {}",
          sessionId,
          shop.getShopifyDomain(),
          e.getMessage(),
          e);

      // SECURE: Instead of returning unsaved session, throw a specific exception
      // This ensures the transaction is properly rolled back and the error is handled appropriately
      throw new RuntimeException(
          String.format(
              "Failed to save session %s for shop %s: %s",
              sessionId, shop.getShopifyDomain(), e.getMessage()),
          e);
    }
  }

  private void cacheShopSession(String shopifyDomain, String sessionId, String accessToken) {
    try {
      // Cache session-specific token with extended TTL
      redisTemplate
          .opsForValue()
          .set(
              SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId,
              accessToken,
              java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));

      // Cache shop-only token (most recent) with fallback TTL
      redisTemplate
          .opsForValue()
          .set(
              SHOP_TOKEN_PREFIX + shopifyDomain,
              accessToken,
              java.time.Duration.ofMinutes(REDIS_FALLBACK_TTL_MINUTES));

      logger.debug(
          "Cached tokens for shop: {} and session: {} with extended TTL", shopifyDomain, sessionId);
    } catch (Exception e) {
      logger.warn(
          "Failed to cache tokens for shop {} - Redis may be unavailable: {}",
          shopifyDomain,
          e.getMessage());
    }
  }

  private void cacheShopSessionWithExtendedTTL(
      String shopifyDomain, String sessionId, String accessToken) {
    try {
      // Use longer TTL for database-retrieved sessions to reduce future DB queries
      redisTemplate
          .opsForValue()
          .set(
              SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId,
              accessToken,
              java.time.Duration.ofMinutes(
                  REDIS_CACHE_TTL_MINUTES * 2)); // Double TTL for DB-retrieved sessions

      logger.debug(
          "Cached token with extended TTL for shop: {} and session: {}", shopifyDomain, sessionId);
    } catch (Exception e) {
      logger.warn("Failed to cache token with extended TTL: {}", e.getMessage());
    }
  }

  private void updateActiveSessionsList(String shopifyDomain) {
    try {
      List<ShopSession> activeSessions = getActiveSessionsForShop(shopifyDomain);
      String activeSessionIds =
          activeSessions.stream()
              .map(ShopSession::getSessionId)
              .reduce((a, b) -> a + "," + b)
              .orElse("");

      redisTemplate
          .opsForValue()
          .set(
              ACTIVE_SESSIONS_PREFIX + shopifyDomain,
              activeSessionIds,
              java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));

      logger.debug(
          "Updated active sessions list for shop: {} (count: {})",
          shopifyDomain,
          activeSessions.size());
    } catch (Exception e) {
      logger.warn(
          "Failed to update active sessions list for shop {}: {}", shopifyDomain, e.getMessage());
    }
  }

  private void clearShopCache(String shopifyDomain) {
    try {
      // Clear all shop-related cache keys
      String pattern = SHOP_TOKEN_PREFIX + shopifyDomain + "*";
      Set<String> keys = redisTemplate.keys(pattern);
      if (keys != null && !keys.isEmpty()) {
        redisTemplate.delete(keys);
        logger.debug("Cleared {} cache keys for shop: {}", keys.size(), shopifyDomain);
      }

      // Clear active sessions list
      String activeSessionsKey = ACTIVE_SESSIONS_PREFIX + shopifyDomain;
      redisTemplate.delete(activeSessionsKey);

      // Clear invalid session cache for this shop
      String invalidSessionPattern = INVALID_SESSION_PREFIX + shopifyDomain + "*";
      Set<String> invalidKeys = redisTemplate.keys(invalidSessionPattern);
      if (invalidKeys != null && !invalidKeys.isEmpty()) {
        redisTemplate.delete(invalidKeys);
        logger.debug(
            "Cleared {} invalid session cache keys for shop: {}",
            invalidKeys.size(),
            shopifyDomain);
      }
    } catch (Exception e) {
      logger.warn("Failed to clear cache for shop {}: {}", shopifyDomain, e.getMessage());
    }
  }

  private void clearInvalidSessionCache(String shopifyDomain, String sessionId) {
    try {
      String invalidSessionKey = INVALID_SESSION_PREFIX + shopifyDomain + ":" + sessionId;
      redisTemplate.delete(invalidSessionKey);
      logger.debug(
          "Cleared invalid session cache for shop: {} and session: {}", shopifyDomain, sessionId);
    } catch (Exception e) {
      logger.debug("Failed to clear invalid session cache: {}", e.getMessage());
    }
  }

  private void updateSessionLastAccessed(String sessionId) {
    try {
      shopSessionRepository.updateLastAccessedTime(sessionId);
    } catch (Exception e) {
      logger.warn(
          "Failed to update last accessed time for session {}: {}", sessionId, e.getMessage());
    }
  }

  /**
   * Asynchronous session last accessed time update to avoid blocking read-only transactions This
   * method delegates to AsyncSessionService which runs updates in a separate thread pool and
   * transaction context, preventing read-only transaction violations.
   */
  private void updateSessionLastAccessedAsync(String sessionId) {
    try {
      // Delegate to the dedicated async service
      asyncSessionService.updateSessionLastAccessedAsync(sessionId);
    } catch (Exception e) {
      logger.warn(
          "Failed to initiate async session update for session {}: {}", sessionId, e.getMessage());
      // Don't propagate the exception as this is a non-critical background operation
    }
  }

  private String getClientIpAddress(HttpServletRequest request) {
    String xForwardedFor = request.getHeader("X-Forwarded-For");
    if (xForwardedFor != null
        && !xForwardedFor.isEmpty()
        && !"unknown".equalsIgnoreCase(xForwardedFor)) {
      return xForwardedFor.split(",")[0].trim();
    }

    String xRealIp = request.getHeader("X-Real-IP");
    if (xRealIp != null && !xRealIp.isEmpty() && !"unknown".equalsIgnoreCase(xRealIp)) {
      return xRealIp;
    }

    return request.getRemoteAddr();
  }

  // Scheduled cleanup methods

  /** Clean up excessive sessions for a shop to prevent database bloat */
  @Transactional(timeout = 15)
  public void cleanupExcessiveSessions(Shop shop) {
    try {
      List<ShopSession> activeSessions =
          shopSessionRepository.findByShopAndIsActiveTrueOrderByLastAccessedAtDesc(shop);

      if (activeSessions.size() >= MAX_SESSIONS_PER_SHOP) {
        // Keep only the most recent sessions, deactivate the rest
        List<ShopSession> sessionsToDeactivate =
            activeSessions.subList(MAX_SESSIONS_PER_SHOP - 1, activeSessions.size());

        for (ShopSession session : sessionsToDeactivate) {
          session.deactivate();
          shopSessionRepository.save(session);

          // Clear from Redis cache
          try {
            redisTemplate.delete(
                SHOP_TOKEN_PREFIX + shop.getShopifyDomain() + ":" + session.getSessionId());
          } catch (Exception e) {
            logger.warn(
                "Failed to clear Redis cache for session {}: {}",
                session.getSessionId(),
                e.getMessage());
          }
        }

        logger.info(
            "Deactivated {} excessive sessions for shop: {}",
            sessionsToDeactivate.size(),
            shop.getShopifyDomain());
      }
    } catch (Exception e) {
      logger.error(
          "Error during excessive session cleanup for shop {}: {}",
          shop.getShopifyDomain(),
          e.getMessage());
      // Don't propagate exception as this is a cleanup operation
    }
  }

  /** Async version of excessive session cleanup to reduce connection holding time */
  public void cleanupExcessiveSessionsAsync(String shopifyDomain) {
    try {
      Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopifyDomain);
      if (shopOpt.isPresent()) {
        cleanupExcessiveSessions(shopOpt.get());
      }
    } catch (Exception e) {
      logger.warn("Async session cleanup failed for shop {}: {}", shopifyDomain, e.getMessage());
    }
  }

  /** Enhanced session cleanup with better error handling and monitoring */
  @Transactional(timeout = 10) // Reduced timeout for cleanup operations
  @Scheduled(fixedRate = 3600000) // 1 hour (reduced from 15 minutes)
  public synchronized void cleanupExpiredSessions() {
    try {
      logger.debug("Starting expired session cleanup");

      List<ShopSession> expiredSessions = shopSessionRepository.findExpiredSessions();
      int cleanedCount = 0;

      for (ShopSession session : expiredSessions) {
        try {
          session.deactivate();
          shopSessionRepository.save(session);
          cleanedCount++;

          // Clear from cache
          if (session.getShop() != null) {
            try {
              redisTemplate.delete(
                  SHOP_TOKEN_PREFIX
                      + session.getShop().getShopifyDomain()
                      + ":"
                      + session.getSessionId());
            } catch (Exception e) {
              logger.warn(
                  "Failed to clear Redis cache during expired session cleanup: {}", e.getMessage());
            }
          }
        } catch (Exception e) {
          logger.warn(
              "Failed to cleanup expired session {}: {}", session.getSessionId(), e.getMessage());
          // Continue with other sessions
        }
      }

      if (cleanedCount > 0) {
        logger.info("Cleaned up {} expired sessions", cleanedCount);
      }

      // Also clean up old inactive sessions less frequently
      if (cleanedCount > 0) {
        cleanupInactiveSessions();
      }

    } catch (Exception e) {
      logger.error("Error during expired session cleanup: {}", e.getMessage(), e);
    }
  }

  /** Clean up old inactive sessions - now called from expired session cleanup and daily */
  @Transactional
  public void cleanupInactiveSessions() {
    try {
      LocalDateTime cutoffDate = LocalDateTime.now().minusDays(SESSION_CLEANUP_DAYS);

      // Find and deactivate old sessions
      List<ShopSession> oldSessions =
          shopSessionRepository.findInactiveSessionsOlderThan(cutoffDate);
      for (ShopSession session : oldSessions) {
        session.deactivate();
        shopSessionRepository.save(session);
      }

      // Delete very old inactive sessions more aggressively
      LocalDateTime deleteCutoffDate = LocalDateTime.now().minusDays(SESSION_CLEANUP_DAYS * 2);
      shopSessionRepository.deleteOldInactiveSessions(deleteCutoffDate);

      if (!oldSessions.isEmpty()) {
        logger.info("Cleaned up {} old inactive sessions", oldSessions.size());
      }
    } catch (Exception e) {
      logger.error("Error during inactive session cleanup: {}", e.getMessage(), e);
    }
  }

  /** Clean up old inactive sessions - runs daily at 2 AM and 2 PM */
  @Transactional
  @Scheduled(cron = "0 0 2,14 * * *") // Run twice daily
  public void cleanupOldInactiveSessionsScheduled() {
    logger.info("Starting scheduled inactive session cleanup");
    cleanupInactiveSessions();

    // Additional cleanup: remove very old Redis keys
    cleanupOldRedisKeys();
  }

  /** Clean up old Redis keys that might be orphaned */
  private void cleanupOldRedisKeys() {
    try {
      // This is a basic cleanup - in production you might want to use Redis SCAN
      // to avoid blocking operations on large keysets
      var allTokenKeys = redisTemplate.keys(SHOP_TOKEN_PREFIX + "*");
      if (allTokenKeys != null && !allTokenKeys.isEmpty()) {
        logger.debug("Found {} Redis token keys for potential cleanup", allTokenKeys.size());
        // For now, just log the count. More sophisticated cleanup can be added later.
      }

      // Clean up old invalid session cache entries
      var allInvalidSessionKeys = redisTemplate.keys(INVALID_SESSION_PREFIX + "*");
      if (allInvalidSessionKeys != null && !allInvalidSessionKeys.isEmpty()) {
        logger.debug(
            "Found {} invalid session cache keys for cleanup", allInvalidSessionKeys.size());
        // The invalid session cache has TTL, so it will auto-expire, but we can log for monitoring
      }
    } catch (Exception e) {
      logger.warn("Error during Redis key cleanup: {}", e.getMessage());
    }
  }

  /** Clean up Redis cache for deactivated sessions */
  private void cleanupDeactivatedSessionsFromRedis(String shopifyDomain) {
    try {
      // Get all sessions for this shop from database
      Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopifyDomain);
      if (shopOpt.isPresent()) {
        Shop shop = shopOpt.get();

        // Get all sessions (active and inactive) to compare with Redis
        List<ShopSession> allSessions = shopSessionRepository.findByShop(shop);
        List<String> inactiveSessionIds =
            allSessions.stream()
                .filter(s -> !s.getIsActive())
                .map(ShopSession::getSessionId)
                .collect(Collectors.toList());

        // Remove inactive sessions from Redis
        for (String sessionId : inactiveSessionIds) {
          redisTemplate.delete(SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId);
          // Also clear any invalid session cache for this session
          redisTemplate.delete(INVALID_SESSION_PREFIX + shopifyDomain + ":" + sessionId);
        }

        if (!inactiveSessionIds.isEmpty()) {
          logger.debug(
              "Cleaned up {} inactive sessions from Redis for shop: {}",
              inactiveSessionIds.size(),
              shopifyDomain);
        }
      }
    } catch (Exception e) {
      logger.warn(
          "Failed to cleanup deactivated sessions from Redis for shop {}: {}",
          shopifyDomain,
          e.getMessage());
    }
  }

  // Backward compatibility methods (deprecated but maintained for existing code)

  @Deprecated
  public void removeToken(String shopifyDomain, String sessionId) {
    logger.warn("Using deprecated removeToken method. Use removeSession instead.");
    removeSession(shopifyDomain, sessionId);
  }

  /** Update session heartbeat to track active browser sessions */
  @Transactional(timeout = 5)
  public boolean updateSessionHeartbeat(String shopifyDomain, String sessionId) {
    try {
      Optional<ShopSession> sessionOpt =
          shopSessionRepository.findActiveSessionByShopDomainAndSessionId(shopifyDomain, sessionId);

      if (sessionOpt.isPresent()) {
        // ENHANCED: Use async service for heartbeat to avoid transaction conflicts
        asyncSessionService.performSessionHeartbeatAsync(sessionId, shopifyDomain);

        // Update Redis cache TTL to extend session life
        try {
          String cachedToken =
              redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId);
          if (cachedToken != null) {
            redisTemplate
                .opsForValue()
                .set(
                    SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId,
                    cachedToken,
                    java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));
          }
        } catch (Exception e) {
          logger.warn("Failed to update Redis TTL during heartbeat: {}", e.getMessage());
        }

        logger.debug(
            "Session heartbeat initiated for shop: {} and session: {}", shopifyDomain, sessionId);
        return true;
      } else {
        logger.warn(
            "Session not found for heartbeat update: shop={}, session={}",
            shopifyDomain,
            sessionId);
        return false;
      }
    } catch (Exception e) {
      logger.error(
          "Error updating session heartbeat for shop {}: {}", shopifyDomain, e.getMessage(), e);
      return false;
    }
  }

  /** Refresh an expired session by extending its expiration time */
  @Transactional(timeout = 5)
  public boolean refreshExpiredSession(String shopifyDomain, String sessionId) {
    try {
      Optional<ShopSession> sessionOpt =
          shopSessionRepository.findActiveSessionByShopDomainAndSessionId(shopifyDomain, sessionId);

      if (sessionOpt.isPresent()) {
        ShopSession session = sessionOpt.get();

        // Check if session is actually expired
        if (session.isExpired()) {
          // Extend session expiration by 4 hours
          session.setExpiresAt(LocalDateTime.now().plusHours(SESSION_INACTIVITY_HOURS));
          session.markAsAccessed();

          // Save the updated session
          shopSessionRepository.save(session);

          // Update Redis cache TTL
          try {
            String cachedToken =
                redisTemplate
                    .opsForValue()
                    .get(SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId);
            if (cachedToken != null) {
              redisTemplate
                  .opsForValue()
                  .set(
                      SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId,
                      cachedToken,
                      java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));
            }
          } catch (Exception e) {
            logger.warn("Failed to update Redis TTL during session refresh: {}", e.getMessage());
          }

          // Clear invalid session cache since session is now valid
          clearInvalidSessionCache(shopifyDomain, sessionId);

          logger.info("Session refreshed for shop: {} and session: {}", shopifyDomain, sessionId);
          return true;
        } else {
          logger.debug(
              "Session not expired, no refresh needed: shop={}, session={}",
              shopifyDomain,
              sessionId);
          return true; // Session is still valid
        }
      } else {
        logger.warn("Session not found for refresh: shop={}, session={}", shopifyDomain, sessionId);
        return false;
      }
    } catch (Exception e) {
      logger.error("Error refreshing session for shop {}: {}", shopifyDomain, e.getMessage(), e);
      return false;
    }
  }

  /**
   * Extend a session by adding additional time - follows industry standards for session management
   */
  @Transactional(timeout = 5)
  public boolean extendSession(String shopifyDomain, String sessionId) {
    try {
      Optional<ShopSession> sessionOpt =
          shopSessionRepository.findActiveSessionByShopDomainAndSessionId(shopifyDomain, sessionId);

      if (sessionOpt.isPresent()) {
        ShopSession session = sessionOpt.get();

        // Check if session is still active (not expired or deactivated)
        if (!session.getIsActive() || session.isExpired()) {
          logger.warn(
              "Cannot extend inactive or expired session: shop={}, session={}",
              shopifyDomain,
              sessionId);
          return false;
        }

        // Extend session expiration by 4 hours from current time
        LocalDateTime newExpiration = LocalDateTime.now().plusHours(SESSION_INACTIVITY_HOURS);
        session.setExpiresAt(newExpiration);
        session.markAsAccessed();

        // Save the updated session
        shopSessionRepository.save(session);

        // Update Redis cache TTL
        try {
          String cachedToken =
              redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId);
          if (cachedToken != null) {
            redisTemplate
                .opsForValue()
                .set(
                    SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId,
                    cachedToken,
                    java.time.Duration.ofMinutes(REDIS_CACHE_TTL_MINUTES));
          }
        } catch (Exception e) {
          logger.warn("Failed to update Redis TTL during session extension: {}", e.getMessage());
        }

        // Clear invalid session cache since session is now valid
        clearInvalidSessionCache(shopifyDomain, sessionId);

        logger.info(
            "Session extended for shop: {} and session: {} until {}",
            shopifyDomain,
            sessionId,
            newExpiration);
        return true;
      } else {
        logger.warn(
            "Session not found for extension: shop={}, session={}", shopifyDomain, sessionId);
        return false;
      }
    } catch (Exception e) {
      logger.error("Error extending session for shop {}: {}", shopifyDomain, e.getMessage(), e);
      return false;
    }
  }

  /** Get stale sessions for a shop (sessions that haven't been accessed recently) */
  @Transactional(readOnly = true)
  public List<ShopSession> getStaleSessionsForShop(String shopifyDomain) {
    try {
      Optional<Shop> shopOpt = shopRepository.findByShopifyDomain(shopifyDomain);
      if (shopOpt.isPresent()) {
        Shop shop = shopOpt.get();

        // Define stale threshold (sessions not accessed for more than 30 minutes)
        LocalDateTime staleThreshold = LocalDateTime.now().minusMinutes(30);

        return shopSessionRepository
            .findByShopAndIsActiveTrueOrderByLastAccessedAtDesc(shop)
            .stream()
            .filter(session -> session.getLastAccessedAt().isBefore(staleThreshold))
            .collect(Collectors.toList());
      }
      return new ArrayList<>();
    } catch (Exception e) {
      logger.error(
          "Error getting stale sessions for shop {}: {}", shopifyDomain, e.getMessage(), e);
      return new ArrayList<>();
    }
  }

  /** Clean up stale sessions (sessions that haven't sent heartbeat for extended period) */
  @Transactional
  @Scheduled(fixedRate = 7200000) // 2 hours (reduced from 30 minutes)
  public synchronized void cleanupStaleSessions() {
    try {
      // Define stale threshold (sessions not accessed for more than 2 hours)
      LocalDateTime staleThreshold = LocalDateTime.now().minusHours(2);

      List<ShopSession> staleSessions =
          shopSessionRepository.findInactiveSessionsOlderThan(staleThreshold);
      int cleanedCount = 0;

      for (ShopSession session : staleSessions) {
        try {
          if (session.getIsActive()) {
            session.deactivate();
            shopSessionRepository.save(session);
            cleanedCount++;

            // Clear from Redis cache
            if (session.getShop() != null) {
              try {
                redisTemplate.delete(
                    SHOP_TOKEN_PREFIX
                        + session.getShop().getShopifyDomain()
                        + ":"
                        + session.getSessionId());
                // Also clear invalid session cache
                redisTemplate.delete(
                    INVALID_SESSION_PREFIX
                        + session.getShop().getShopifyDomain()
                        + ":"
                        + session.getSessionId());
              } catch (Exception e) {
                logger.warn(
                    "Failed to clear Redis cache during stale session cleanup: {}", e.getMessage());
              }
            }
          }
        } catch (Exception e) {
          logger.warn(
              "Failed to cleanup stale session {}: {}", session.getSessionId(), e.getMessage());
          // Continue with other sessions
        }
      }

      if (cleanedCount > 0) {
        logger.info("Cleaned up {} stale sessions", cleanedCount);
      }
    } catch (Exception e) {
      logger.error("Error during stale session cleanup: {}", e.getMessage(), e);
    }
  }

  /**
   * Safely handle session cleanup to prevent session invalidation errors This method should be
   * called when sessions need to be cleaned up
   */
  public void safeSessionCleanup(String shopifyDomain, String sessionId) {
    try {
      logger.info(
          "Performing safe session cleanup for shop: {} and session: {}", shopifyDomain, sessionId);

      // Mark session as invalid in Redis cache immediately
      try {
        String invalidKey = INVALID_SESSION_PREFIX + shopifyDomain + ":" + sessionId;
        redisTemplate
            .opsForValue()
            .set(invalidKey, "cleanup", Duration.ofMinutes(INVALID_SESSION_CACHE_MINUTES));
        logger.debug("Marked session {} as invalid in Redis cache", sessionId);
      } catch (Exception cacheError) {
        logger.warn(
            "Failed to mark session {} as invalid in Redis: {}",
            sessionId,
            cacheError.getMessage());
      }

      // Clear any cached tokens for this session
      try {
        String tokenKey = SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId;
        redisTemplate.delete(tokenKey);
        logger.debug("Cleared cached token for session: {}", sessionId);
      } catch (Exception cacheError) {
        logger.warn(
            "Failed to clear cached token for session {}: {}", sessionId, cacheError.getMessage());
      }

      // Attempt to deactivate session in database (non-blocking)
      try {
        Optional<ShopSession> sessionOpt = shopSessionRepository.findBySessionId(sessionId);
        if (sessionOpt.isPresent()) {
          ShopSession session = sessionOpt.get();
          if (session.getIsActive() != null && session.getIsActive()) {
            session.deactivate();
            shopSessionRepository.save(session);
            logger.info("Deactivated session {} in database", sessionId);
          } else {
            logger.debug("Session {} was already inactive in database", sessionId);
          }
        } else {
          logger.debug("Session {} not found in database during cleanup", sessionId);
        }
      } catch (Exception dbError) {
        logger.warn(
            "Failed to deactivate session {} in database: {}", sessionId, dbError.getMessage());
        // Don't throw - this is cleanup, not critical
      }

      // Clear from active sessions list
      try {
        String activeSessionsKey = ACTIVE_SESSIONS_PREFIX + shopifyDomain;
        redisTemplate.opsForSet().remove(activeSessionsKey, sessionId);
        logger.debug("Removed session {} from active sessions list", sessionId);
      } catch (Exception cacheError) {
        logger.warn(
            "Failed to remove session {} from active sessions list: {}",
            sessionId,
            cacheError.getMessage());
      }

      logger.info(
          "Safe session cleanup completed for shop: {} and session: {}", shopifyDomain, sessionId);

    } catch (Exception e) {
      logger.error(
          "Error during safe session cleanup for {}:{}: {}",
          shopifyDomain,
          sessionId,
          e.getMessage());
      // Don't throw - this is cleanup, not critical
    }
  }

  /**
   * Force invalidate a session - used when session validation fails This method ensures the session
   * is properly cleaned up and marked as invalid
   */
  public void forceInvalidateSession(String shopifyDomain, String sessionId) {
    try {
      logger.warn("Force invalidating session {} for shop: {}", sessionId, shopifyDomain);

      // Mark as invalid in Redis immediately
      try {
        String invalidKey = INVALID_SESSION_PREFIX + shopifyDomain + ":" + sessionId;
        redisTemplate
            .opsForValue()
            .set(
                invalidKey, "force_invalidated", Duration.ofMinutes(INVALID_SESSION_CACHE_MINUTES));
        logger.debug("Marked session {} as force invalidated in Redis", sessionId);
      } catch (Exception cacheError) {
        logger.warn(
            "Failed to mark session {} as invalid in Redis: {}",
            sessionId,
            cacheError.getMessage());
      }

      // Clear cached tokens
      try {
        String tokenKey = SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId;
        redisTemplate.delete(tokenKey);
        logger.debug("Cleared cached token for force invalidated session: {}", sessionId);
      } catch (Exception cacheError) {
        logger.warn(
            "Failed to clear cached token for session {}: {}", sessionId, cacheError.getMessage());
      }

      // Deactivate in database
      try {
        Optional<ShopSession> sessionOpt = shopSessionRepository.findBySessionId(sessionId);
        if (sessionOpt.isPresent()) {
          ShopSession session = sessionOpt.get();
          if (session.getIsActive() != null && session.getIsActive()) {
            session.deactivate();
            shopSessionRepository.save(session);
            logger.info("Force deactivated session {} in database", sessionId);
          }
        }
      } catch (Exception dbError) {
        logger.warn(
            "Failed to force deactivate session {} in database: {}",
            sessionId,
            dbError.getMessage());
      }

      // Remove from active sessions list
      try {
        String activeSessionsKey = ACTIVE_SESSIONS_PREFIX + shopifyDomain;
        redisTemplate.opsForSet().remove(activeSessionsKey, sessionId);
        logger.debug("Removed force invalidated session {} from active sessions list", sessionId);
      } catch (Exception cacheError) {
        logger.warn(
            "Failed to remove session {} from active sessions list: {}",
            sessionId,
            cacheError.getMessage());
      }

      logger.warn(
          "Force invalidation completed for session {} and shop: {}", sessionId, shopifyDomain);

    } catch (Exception e) {
      logger.error(
          "Error during force session invalidation for {}:{}: {}",
          shopifyDomain,
          sessionId,
          e.getMessage());
    }
  }

  /**
   * Validate if a session is in a valid state for operations This helps prevent session
   * invalidation errors FIXED: Avoids Hibernate lazy loading issues by using direct queries SECURE:
   * Uses Redis cache fallback when database validation fails OPTIMIZED: Checks Redis first for
   * better performance
   */
  public boolean isSessionValid(String shopifyDomain, String sessionId) {
    try {
      if (sessionId == null || sessionId.trim().isEmpty()) {
        logger.debug("Session ID is null or empty for shop: {}", shopifyDomain);
        return false;
      }

      // DEBUG: Log the specific session being validated
      logger.debug("Validating session {} for shop: {}", sessionId, shopifyDomain);

      // OPTIMIZED: Check Redis first for better performance
      // Redis is much faster than database queries
      boolean redisResult = isSessionValidInRedis(shopifyDomain, sessionId);
      if (redisResult) {
        logger.debug(
            "Session {} validated successfully in Redis for shop: {}", sessionId, shopifyDomain);
        clearValidationFailureCount(shopifyDomain, sessionId);
        return true;
      }

      // Check if session is marked as invalid in cache
      String invalidKey = INVALID_SESSION_PREFIX + shopifyDomain + ":" + sessionId;
      Boolean isInvalid = redisTemplate.hasKey(invalidKey);
      if (isInvalid != null && isInvalid) {
        logger.debug("Session {} is marked as invalid for shop: {}", sessionId, shopifyDomain);
        return false;
      }

      // Only check database if Redis validation failed and session not marked as invalid
      // This reduces database load significantly
      logger.debug(
          "Session {} not found in Redis, checking database for shop: {}",
          sessionId,
          shopifyDomain);

      // Use a direct query to avoid lazy loading issues
      // This query checks if the session exists, is active, and belongs to the correct shop
      // without triggering lazy loading of the Shop entity
      Optional<ShopSession> sessionOpt =
          shopSessionRepository.findActiveSessionByShopDomainAndSessionId(shopifyDomain, sessionId);
      if (sessionOpt.isPresent()) {
        // Database validation successful
        ShopSession session = sessionOpt.get();
        logger.debug("Session {} found in database for shop: {}", sessionId, shopifyDomain);

        // Additional validation: check if session hasn't expired
        if (session.getExpiresAt() != null
            && session.getExpiresAt().isBefore(LocalDateTime.now())) {
          logger.debug(
              "Session {} has expired for shop: {} (expires at: {})",
              sessionId,
              shopifyDomain,
              session.getExpiresAt());

          // Track validation failure
          trackValidationFailure(shopifyDomain, sessionId);

          // Mark expired session as invalid in cache
          try {
            redisTemplate
                .opsForValue()
                .set(invalidKey, "expired", Duration.ofMinutes(INVALID_SESSION_CACHE_MINUTES));
          } catch (Exception cacheError) {
            logger.warn(
                "Failed to cache expired session {}: {}", sessionId, cacheError.getMessage());
          }

          return false;
        }

        // Check if session is active
        if (session.getIsActive() == null || !session.getIsActive()) {
          logger.debug(
              "Session {} is not active for shop: {} (isActive: {})",
              sessionId,
              shopifyDomain,
              session.getIsActive());

          // Track validation failure
          trackValidationFailure(shopifyDomain, sessionId);

          return false;
        }

        // OPTIMIZED: Cache the valid session in Redis for future fast lookups
        try {
          String tokenKey = SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId;
          String accessToken = session.getAccessToken();
          if (accessToken != null && !accessToken.trim().isEmpty()) {
            redisTemplate.opsForValue().set(tokenKey, accessToken, Duration.ofHours(4));
            logger.debug("Cached session {} in Redis for future fast lookups", sessionId);
          } else {
            logger.warn(
                "Session {} has null or empty access token for shop: {}", sessionId, shopifyDomain);
          }
        } catch (Exception cacheError) {
          logger.warn(
              "Failed to cache session {} in Redis: {}", sessionId, cacheError.getMessage());
          // Don't fail validation if caching fails
        }

        logger.debug("Session {} is valid for shop: {}", sessionId, shopifyDomain);
        clearValidationFailureCount(shopifyDomain, sessionId);
        return true;
      }

      // Session not found in either Redis or database
      logger.debug("Session {} not found in database for shop: {}", sessionId, shopifyDomain);

      // Track validation failure
      trackValidationFailure(shopifyDomain, sessionId);

      // Mark missing session as invalid in cache to prevent repeated database lookups
      try {
        redisTemplate
            .opsForValue()
            .set(invalidKey, "not_found", Duration.ofMinutes(INVALID_SESSION_CACHE_MINUTES));
      } catch (Exception cacheError) {
        logger.warn("Failed to cache missing session {}: {}", sessionId, cacheError.getMessage());
      }

      return false;

    } catch (Exception e) {
      logger.warn(
          "Error validating session {} for shop {}: {}", sessionId, shopifyDomain, e.getMessage());

      // SECURE: When database validation fails, check Redis cache instead of assuming valid
      // This provides a security fallback while maintaining reliability
      try {
        return isSessionValidInRedis(shopifyDomain, sessionId);
      } catch (Exception redisError) {
        logger.error(
            "Both database and Redis validation failed for session {}:{} - marking as invalid for security",
            shopifyDomain,
            sessionId);
        // Track validation failure
        trackValidationFailure(shopifyDomain, sessionId);

        // SECURE: Mark as invalid when both database and Redis validation fail
        // This prevents security bypass through validation failures
        try {
          String invalidKey = INVALID_SESSION_PREFIX + shopifyDomain + ":" + sessionId;
          redisTemplate
              .opsForValue()
              .set(
                  invalidKey,
                  "validation_error",
                  Duration.ofMinutes(INVALID_SESSION_CACHE_MINUTES));
        } catch (Exception cacheError) {
          logger.warn(
              "Failed to cache validation error for session {}: {}",
              sessionId,
              cacheError.getMessage());
        }
        return false;
      }
    }
  }

  /**
   * Check if session is valid in Redis cache This provides a secure fallback when database
   * validation fails
   */
  private boolean isSessionValidInRedis(String shopifyDomain, String sessionId) {
    try {
      // Check if session token exists in Redis
      String tokenKey = SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId;
      String cachedToken = redisTemplate.opsForValue().get(tokenKey);

      if (cachedToken != null && !cachedToken.trim().isEmpty()) {
        logger.debug(
            "Session {} found valid in Redis cache for shop: {}", sessionId, shopifyDomain);
        return true;
      }

      // Check if session is marked as invalid in Redis
      String invalidKey = INVALID_SESSION_PREFIX + shopifyDomain + ":" + sessionId;
      Boolean isInvalid = redisTemplate.hasKey(invalidKey);
      if (isInvalid != null && isInvalid) {
        logger.debug(
            "Session {} marked as invalid in Redis for shop: {}", sessionId, shopifyDomain);
        return false;
      }

      logger.debug("Session {} not found in Redis cache for shop: {}", sessionId, shopifyDomain);
      return false;

    } catch (Exception e) {
      logger.warn(
          "Redis validation failed for session {}:{}: {}",
          shopifyDomain,
          sessionId,
          e.getMessage());
      return false; // SECURE: Assume invalid when Redis validation fails
    }
  }

  /**
   * Secure session validation that ensures session state consistency This method validates that a
   * session exists in the database and is in a valid state FIXED: Avoids Hibernate lazy loading
   * issues by using direct queries SECURE: Uses Redis cache fallback when database validation fails
   * OPTIMIZED: Checks Redis first for better performance
   */
  public boolean validateSessionState(String shopifyDomain, String sessionId) {
    try {
      if (sessionId == null || sessionId.trim().isEmpty()) {
        logger.warn(
            "Session validation failed: null or empty sessionId for shop: {}", shopifyDomain);
        return false;
      }

      // OPTIMIZED: Check Redis first for better performance
      // Redis is much faster than database queries
      boolean redisResult = isSessionValidInRedis(shopifyDomain, sessionId);
      if (redisResult) {
        logger.debug(
            "Session {} validated successfully in Redis for shop: {}", sessionId, shopifyDomain);
        return true;
      }

      // Only check database if Redis validation failed
      // This reduces database load significantly
      logger.debug(
          "Session {} not found in Redis, checking database for shop: {}",
          sessionId,
          shopifyDomain);

      // Use a direct query to avoid lazy loading issues
      // This query checks if the session exists, is active, and belongs to the correct shop
      // without triggering lazy loading of the Shop entity
      Optional<ShopSession> sessionOpt =
          shopSessionRepository.findActiveSessionByShopDomainAndSessionId(shopifyDomain, sessionId);
      if (sessionOpt.isPresent()) {
        // Database validation successful
        ShopSession session = sessionOpt.get();

        // Validate session hasn't expired
        if (session.getExpiresAt() != null
            && session.getExpiresAt().isBefore(LocalDateTime.now())) {
          logger.warn(
              "Session validation failed: session {} has expired for shop: {}",
              sessionId,
              shopifyDomain);
          return false;
        }

        // OPTIMIZED: Cache the valid session in Redis for future fast lookups
        try {
          String tokenKey = SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId;
          String accessToken = session.getAccessToken();
          if (accessToken != null && !accessToken.trim().isEmpty()) {
            redisTemplate.opsForValue().set(tokenKey, accessToken, Duration.ofHours(4));
            logger.debug("Cached session {} in Redis for future fast lookups", sessionId);
          }
        } catch (Exception cacheError) {
          logger.warn(
              "Failed to cache session {} in Redis: {}", sessionId, cacheError.getMessage());
          // Don't fail validation if caching fails
        }

        logger.debug("Session validation successful: {} for shop: {}", sessionId, shopifyDomain);
        return true;
      }

      // Session not found in either Redis or database
      logger.debug("Session {} not found in database for shop: {}", sessionId, shopifyDomain);
      return false;

    } catch (Exception e) {
      logger.error(
          "Session validation error for {}:{}: {}", shopifyDomain, sessionId, e.getMessage());

      // SECURE: When database validation fails, check Redis cache instead of assuming valid
      // This provides a security fallback while maintaining reliability
      try {
        return isSessionValidInRedis(shopifyDomain, sessionId);
      } catch (Exception redisError) {
        logger.error(
            "Both database and Redis validation failed for session {}:{} - marking as invalid for security",
            shopifyDomain,
            sessionId);
        // SECURE: Mark as invalid when both database and Redis validation fail
        // This prevents security bypass through validation failures
        return false;
      }
    }
  }

  /** Track validation failure count and auto-invalidate sessions with repeated failures */
  private void trackValidationFailure(String shopifyDomain, String sessionId) {
    try {
      String failureCountKey = VALIDATION_FAILURE_COUNT_PREFIX + shopifyDomain + ":" + sessionId;
      String currentCount = redisTemplate.opsForValue().get(failureCountKey);

      int failureCount = 1;
      if (currentCount != null) {
        try {
          failureCount = Integer.parseInt(currentCount) + 1;
        } catch (NumberFormatException e) {
          failureCount = 1;
        }
      }

      // Set failure count with 1 hour TTL
      redisTemplate
          .opsForValue()
          .set(failureCountKey, String.valueOf(failureCount), Duration.ofHours(1));

      // Auto-invalidate after 3 consecutive failures
      if (failureCount >= 3) {
        logger.warn(
            "Session {} has failed validation {} times - auto-invalidating",
            sessionId,
            failureCount);
        forceInvalidateSession(shopifyDomain, sessionId);
        // Clear the failure count
        redisTemplate.delete(failureCountKey);
      } else {
        logger.debug("Session {} validation failure count: {}", sessionId, failureCount);
      }

    } catch (Exception e) {
      logger.warn(
          "Failed to track validation failure for session {}: {}", sessionId, e.getMessage());
    }
  }

  /** Clear validation failure count for a session (called when validation succeeds) */
  private void clearValidationFailureCount(String shopifyDomain, String sessionId) {
    try {
      String failureCountKey = VALIDATION_FAILURE_COUNT_PREFIX + shopifyDomain + ":" + sessionId;
      redisTemplate.delete(failureCountKey);
      logger.debug("Cleared validation failure count for session: {}", sessionId);
    } catch (Exception e) {
      logger.warn(
          "Failed to clear validation failure count for session {}: {}", sessionId, e.getMessage());
    }
  }
}
