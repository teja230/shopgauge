package com.storesight.backend.service;

import com.storesight.backend.model.Shop;
import com.storesight.backend.repository.ShopRepository;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
public class ShopService {
  private static final Logger logger = LoggerFactory.getLogger(ShopService.class);
  private final ShopRepository shopRepository;
  private final StringRedisTemplate redisTemplate;

  // Consistent TTL values
  private static final int SHOP_TOKEN_TTL_MINUTES = 60; // 1 hour - match session TTL
  private static final String SHOP_TOKEN_PREFIX = "shop_token:";
  private static final String SHOP_SESSION_PREFIX = "shop_session:";

  @Autowired
  public ShopService(ShopRepository shopRepository, StringRedisTemplate redisTemplate) {
    this.shopRepository = shopRepository;
    this.redisTemplate = redisTemplate;
  }

  public void saveShop(String shopifyDomain, String accessToken, String sessionId) {
    logger.info("Saving shop: {} for session: {}", shopifyDomain, sessionId);

    // Clean up any existing sessions for this shop to prevent duplicates
    cleanupOldSessions(shopifyDomain, sessionId);

    // Save to Redis for quick access, both with and without session ID
    redisTemplate
        .opsForValue()
        .set(
            SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId,
            accessToken,
            SHOP_TOKEN_TTL_MINUTES,
            java.util.concurrent.TimeUnit.MINUTES);

    redisTemplate
        .opsForValue()
        .set(
            SHOP_TOKEN_PREFIX + shopifyDomain,
            accessToken,
            SHOP_TOKEN_TTL_MINUTES,
            java.util.concurrent.TimeUnit.MINUTES);

    // Store session mapping to help with cleanup
    redisTemplate
        .opsForValue()
        .set(
            SHOP_SESSION_PREFIX + shopifyDomain,
            sessionId,
            SHOP_TOKEN_TTL_MINUTES,
            java.util.concurrent.TimeUnit.MINUTES);

    // Save to database for persistence
    Optional<Shop> existing = shopRepository.findByShopifyDomain(shopifyDomain);
    Shop shop = existing.orElseGet(Shop::new);
    shop.setShopifyDomain(shopifyDomain);
    shop.setAccessToken(accessToken);
    shopRepository.save(shop);
    logger.info("Shop saved successfully: {}", shopifyDomain);
  }

  private void cleanupOldSessions(String shopifyDomain, String currentSessionId) {
    try {
      // Get the previous session ID for this shop
      String oldSessionId = redisTemplate.opsForValue().get(SHOP_SESSION_PREFIX + shopifyDomain);

      if (oldSessionId != null && !oldSessionId.equals(currentSessionId)) {
        logger.info("Cleaning up old session {} for shop {}", oldSessionId, shopifyDomain);

        // Remove the old session-specific token
        redisTemplate.delete(SHOP_TOKEN_PREFIX + shopifyDomain + ":" + oldSessionId);

        // Note: We keep the shop-only token as it will be updated with the new token
      }
    } catch (Exception e) {
      logger.warn("Error during session cleanup for shop {}: {}", shopifyDomain, e.getMessage());
      // Continue with the save operation even if cleanup fails
    }
  }

  public String getTokenForShop(String shopifyDomain, String sessionId) {
    logger.info("Getting token for shop: {} and session: {}", shopifyDomain, sessionId);

    // If sessionId is null, only try the shop-only key
    if (sessionId == null) {
      logger.debug("No session ID provided, checking shop-only token for: {}", shopifyDomain);
      String token = redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain);
      if (token != null) {
        logger.info("Found token in Redis for shop: {} (no session ID)", shopifyDomain);
        return token;
      }

      // Fall back to database
      logger.debug("No token in Redis, checking database for shop: {}", shopifyDomain);
      Optional<Shop> shop = shopRepository.findByShopifyDomain(shopifyDomain);
      if (shop.isPresent()) {
        token = shop.get().getAccessToken();
        if (token != null) {
          logger.info("Found token in database, caching in Redis for shop: {}", shopifyDomain);
          // Cache without session ID
          redisTemplate
              .opsForValue()
              .set(
                  SHOP_TOKEN_PREFIX + shopifyDomain,
                  token,
                  SHOP_TOKEN_TTL_MINUTES,
                  java.util.concurrent.TimeUnit.MINUTES);
        } else {
          logger.warn("Shop found but no token in database for shop: {}", shopifyDomain);
        }
        return token;
      }
      logger.warn("No shop found in database for domain: {}", shopifyDomain);
      return null;
    }

    // Try Redis with session ID first
    String token =
        redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId);
    if (token != null) {
      logger.info("Found token in Redis for shop: {} and session: {}", shopifyDomain, sessionId);
      return token;
    }

    // Try Redis with just shop domain (fallback for session mismatches)
    token = redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shopifyDomain);
    if (token != null) {
      logger.info("Found token in Redis for shop: {} (no session ID)", shopifyDomain);
      // Cache with current session ID for future requests
      redisTemplate
          .opsForValue()
          .set(
              SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId,
              token,
              SHOP_TOKEN_TTL_MINUTES,
              java.util.concurrent.TimeUnit.MINUTES);
      return token;
    }

    logger.debug("No token in Redis, checking database for shop: {}", shopifyDomain);
    // Fall back to database
    Optional<Shop> shop = shopRepository.findByShopifyDomain(shopifyDomain);
    if (shop.isPresent()) {
      token = shop.get().getAccessToken();
      if (token != null) {
        logger.info(
            "Found token in database, caching in Redis for shop: {} and session: {}",
            shopifyDomain,
            sessionId);
        // Cache both with and without session ID
        redisTemplate
            .opsForValue()
            .set(
                SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId,
                token,
                SHOP_TOKEN_TTL_MINUTES,
                java.util.concurrent.TimeUnit.MINUTES);
        redisTemplate
            .opsForValue()
            .set(
                SHOP_TOKEN_PREFIX + shopifyDomain,
                token,
                SHOP_TOKEN_TTL_MINUTES,
                java.util.concurrent.TimeUnit.MINUTES);
      } else {
        logger.warn("Shop found but no token in database for shop: {}", shopifyDomain);
      }
      return token;
    }
    logger.warn("No shop found in database for domain: {}", shopifyDomain);
    return null;
  }

  public void removeToken(String shopifyDomain, String sessionId) {
    logger.info("Removing token for shop: {} and session: {}", shopifyDomain, sessionId);
    redisTemplate.delete(SHOP_TOKEN_PREFIX + shopifyDomain + ":" + sessionId);
    shopRepository
        .findByShopifyDomain(shopifyDomain)
        .ifPresent(
            shop -> {
              shopRepository.delete(shop);
              logger.info("Shop deleted from database: {}", shopifyDomain);
            });
  }

  public Mono<String> getShopAccessToken(String shop) {
    String token = redisTemplate.opsForValue().get(SHOP_TOKEN_PREFIX + shop);
    if (token == null) {
      logger.error("No access token found for shop: {}", shop);
      return Mono.error(new RuntimeException("No access token found for shop"));
    }
    return Mono.just(token);
  }
}
