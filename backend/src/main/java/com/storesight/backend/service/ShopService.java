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

  @Autowired
  public ShopService(ShopRepository shopRepository, StringRedisTemplate redisTemplate) {
    this.shopRepository = shopRepository;
    this.redisTemplate = redisTemplate;
  }

  public void saveShop(String shopifyDomain, String accessToken, String sessionId) {
    logger.info("Saving shop: {} for session: {}", shopifyDomain, sessionId);
    // Save to Redis for quick access, scoped to session
    redisTemplate.opsForValue().set("shop_token:" + shopifyDomain + ":" + sessionId, accessToken, 60, java.util.concurrent.TimeUnit.MINUTES);

    // Save to database for persistence
    Optional<Shop> existing = shopRepository.findByShopifyDomain(shopifyDomain);
    Shop shop = existing.orElseGet(Shop::new);
    shop.setShopifyDomain(shopifyDomain);
    shop.setAccessToken(accessToken);
    shopRepository.save(shop);
    logger.info("Shop saved successfully: {}", shopifyDomain);
  }

  public String getTokenForShop(String shopifyDomain, String sessionId) {
    logger.info("Getting token for shop: {} and session: {}", shopifyDomain, sessionId);
    // Try Redis first
    String token = redisTemplate.opsForValue().get("shop_token:" + shopifyDomain + ":" + sessionId);
    if (token != null) {
      logger.info("Found token in Redis for shop: {} and session: {}", shopifyDomain, sessionId);
      return token;
    }
    logger.debug("No token in Redis, checking database for shop: {}", shopifyDomain);
    // Fall back to database
    Optional<Shop> shop = shopRepository.findByShopifyDomain(shopifyDomain);
    if (shop.isPresent()) {
      token = shop.get().getAccessToken();
      if (token != null) {
        logger.info("Found token in database, caching in Redis for shop: {} and session: {}", shopifyDomain, sessionId);
        redisTemplate.opsForValue().set("shop_token:" + shopifyDomain + ":" + sessionId, token, 60, java.util.concurrent.TimeUnit.MINUTES);
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
    redisTemplate.delete("shop_token:" + shopifyDomain + ":" + sessionId);
    shopRepository
        .findByShopifyDomain(shopifyDomain)
        .ifPresent(
            shop -> {
              shopRepository.delete(shop);
              logger.info("Shop deleted from database: {}", shopifyDomain);
            });
  }

  public Mono<String> getShopAccessToken(String shop) {
    String token = redisTemplate.opsForValue().get("shop_token:" + shop);
    if (token == null) {
      logger.error("No access token found for shop: {}", shop);
      return Mono.error(new RuntimeException("No access token found for shop"));
    }
    return Mono.just(token);
  }
}
