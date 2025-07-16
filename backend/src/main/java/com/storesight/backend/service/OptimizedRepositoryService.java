package com.storesight.backend.service;

import com.storesight.backend.model.Notification;
import com.storesight.backend.model.Shop;
import com.storesight.backend.model.ShopSession;
import com.storesight.backend.repository.NotificationRepository;
import com.storesight.backend.repository.ShopRepository;
import com.storesight.backend.repository.ShopSessionRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Optimized repository service that implements intelligent caching strategies for frequently
 * accessed data to improve query performance.
 */
@Service
@Transactional(readOnly = true)
public class OptimizedRepositoryService {

  private static final Logger logger = LoggerFactory.getLogger(OptimizedRepositoryService.class);

  private final ShopRepository shopRepository;
  private final ShopSessionRepository shopSessionRepository;
  private final NotificationRepository notificationRepository;
  private final QueryResultCacheService cacheService;

  // Cache TTL configurations
  private static final Duration SHOP_CACHE_TTL = Duration.ofMinutes(30);
  private static final Duration SESSION_CACHE_TTL = Duration.ofMinutes(5);
  private static final Duration NOTIFICATION_CACHE_TTL = Duration.ofMinutes(2);
  private static final Duration STATS_CACHE_TTL = Duration.ofMinutes(10);

  @Autowired
  public OptimizedRepositoryService(
      ShopRepository shopRepository,
      ShopSessionRepository shopSessionRepository,
      NotificationRepository notificationRepository,
      QueryResultCacheService cacheService) {
    this.shopRepository = shopRepository;
    this.shopSessionRepository = shopSessionRepository;
    this.notificationRepository = notificationRepository;
    this.cacheService = cacheService;
  }

  // ============================================================================
  // SHOP OPERATIONS WITH CACHING
  // ============================================================================

  /** Find shop by domain with caching */
  public Optional<Shop> findShopByDomain(String shopifyDomain) {
    String cacheKey = "shop:domain:" + shopifyDomain;

    Optional<Shop> cached = cacheService.get(cacheKey, Shop.class);
    if (cached.isPresent()) {
      return cached;
    }

    Optional<Shop> shop = shopRepository.findByShopifyDomain(shopifyDomain);
    if (shop.isPresent()) {
      cacheService.put(cacheKey, shop.get(), SHOP_CACHE_TTL);
    }

    return shop;
  }

  /** Find shop by ID with caching */
  public Optional<Shop> findShopById(Long shopId) {
    String cacheKey = "shop:id:" + shopId;

    Optional<Shop> cached = cacheService.get(cacheKey, Shop.class);
    if (cached.isPresent()) {
      return cached;
    }

    Optional<Shop> shop = shopRepository.findById(shopId);
    if (shop.isPresent()) {
      cacheService.put(cacheKey, shop.get(), SHOP_CACHE_TTL);
    }

    return shop;
  }

  /** Invalidate shop cache when shop is updated */
  @CacheEvict(value = "shops", allEntries = true)
  @Transactional
  public Shop saveShop(Shop shop) {
    Shop savedShop = shopRepository.save(shop);

    // Invalidate related cache entries
    if (savedShop.getShopifyDomain() != null) {
      cacheService.evict("shop:domain:" + savedShop.getShopifyDomain());
    }
    if (savedShop.getId() != null) {
      cacheService.evict("shop:id:" + savedShop.getId());
    }

    return savedShop;
  }

  // ============================================================================
  // SESSION OPERATIONS WITH CACHING
  // ============================================================================

  /** Find active session by shop domain and session ID with caching */
  public Optional<ShopSession> findActiveSessionByShopDomainAndSessionId(
      String shopDomain, String sessionId) {
    String cacheKey = "session:active:" + shopDomain + ":" + sessionId;

    Optional<ShopSession> cached = cacheService.get(cacheKey, ShopSession.class);
    if (cached.isPresent()) {
      return cached;
    }

    Optional<ShopSession> session =
        shopSessionRepository.findActiveSessionByShopDomainAndSessionId(shopDomain, sessionId);
    if (session.isPresent()) {
      cacheService.put(cacheKey, session.get(), SESSION_CACHE_TTL);
    }

    return session;
  }

  /** Find session by session ID with caching */
  public Optional<ShopSession> findSessionBySessionId(String sessionId) {
    String cacheKey = "session:id:" + sessionId;

    Optional<ShopSession> cached = cacheService.get(cacheKey, ShopSession.class);
    if (cached.isPresent()) {
      return cached;
    }

    Optional<ShopSession> session = shopSessionRepository.findBySessionId(sessionId);
    if (session.isPresent()) {
      cacheService.put(cacheKey, session.get(), SESSION_CACHE_TTL);
    }

    return session;
  }

  /** Get active sessions count for shop with caching */
  public long getActiveSessionsCount(Shop shop) {
    String cacheKey = "session:count:active:" + shop.getId();

    Optional<Long> cached = cacheService.get(cacheKey, Long.class);
    if (cached.isPresent()) {
      return cached.get();
    }

    long count = shopSessionRepository.countByShopAndIsActiveTrue(shop);
    cacheService.put(cacheKey, count, STATS_CACHE_TTL);

    return count;
  }

  /** Update session last accessed time and invalidate cache */
  @Transactional
  public void updateSessionLastAccessedTime(String sessionId) {
    shopSessionRepository.updateLastAccessedTime(sessionId);

    // Invalidate related cache entries
    cacheService.evict("session:id:" + sessionId);
    cacheService.evictByPattern("session:active:.*:" + sessionId);
  }

  /** Deactivate session and invalidate cache */
  @Transactional
  public void deactivateSession(String sessionId) {
    shopSessionRepository.deactivateSession(sessionId);

    // Invalidate related cache entries
    cacheService.evict("session:id:" + sessionId);
    cacheService.evictByPattern("session:active:.*:" + sessionId);
    cacheService.evictByPattern("session:count:.*");
  }

  // ============================================================================
  // NOTIFICATION OPERATIONS WITH CACHING
  // ============================================================================

  /** Find notifications by shop and session with caching */
  public List<Notification> findNotificationsByShopAndSession(String shop, String sessionId) {
    String cacheKey = "notifications:shop:" + shop + ":session:" + sessionId;

    Optional<List> cached = cacheService.get(cacheKey, List.class);
    if (cached.isPresent()) {
      return (List<Notification>) cached.get();
    }

    List<Notification> notifications =
        notificationRepository.findByShopAndSessionOrderByCreatedAtDesc(shop, sessionId);
    cacheService.put(cacheKey, notifications, NOTIFICATION_CACHE_TTL);

    return notifications;
  }

  /** Count unread notifications with caching */
  public long countUnreadNotifications(String shop, String sessionId) {
    String cacheKey = "notifications:unread:count:" + shop + ":" + sessionId;

    Optional<Long> cached = cacheService.get(cacheKey, Long.class);
    if (cached.isPresent()) {
      return cached.get();
    }

    long count = notificationRepository.countUnreadByShopAndSession(shop, sessionId);
    cacheService.put(cacheKey, count, STATS_CACHE_TTL);

    return count;
  }

  /** Save notification and invalidate related cache */
  @Transactional
  public Notification saveNotification(Notification notification) {
    Notification saved = notificationRepository.save(notification);

    // Invalidate related cache entries
    String shop = saved.getShop();
    String sessionId = saved.getSessionId();

    cacheService.evictByPattern("notifications:shop:" + shop + ":.*");
    cacheService.evictByPattern("notifications:unread:count:" + shop + ":.*");

    return saved;
  }

  // ============================================================================
  // BATCH OPERATIONS FOR PERFORMANCE
  // ============================================================================

  /** Find expired sessions in batches for cleanup */
  public List<ShopSession> findExpiredSessionsBatch(int batchSize) {
    return shopSessionRepository.findExpiredSessions().stream().limit(batchSize).toList();
  }

  /** Find inactive sessions in batches for cleanup */
  public List<ShopSession> findInactiveSessionsBatch(LocalDateTime cutoffDate, int batchSize) {
    return shopSessionRepository.findInactiveSessionsOlderThan(cutoffDate).stream()
        .limit(batchSize)
        .toList();
  }

  /** Bulk deactivate sessions and invalidate cache */
  @Transactional
  public void bulkDeactivateSessions(List<String> sessionIds) {
    for (String sessionId : sessionIds) {
      shopSessionRepository.deactivateSession(sessionId);
    }

    // Invalidate cache for all affected sessions
    for (String sessionId : sessionIds) {
      cacheService.evict("session:id:" + sessionId);
      cacheService.evictByPattern("session:active:.*:" + sessionId);
    }
    cacheService.evictByPattern("session:count:.*");

    logger.info("Bulk deactivated {} sessions", sessionIds.size());
  }

  /** Bulk delete old notifications and invalidate cache */
  @Transactional
  public void bulkDeleteOldNotifications(List<String> notificationIds) {
    if (!notificationIds.isEmpty()) {
      notificationRepository.deleteByIds(notificationIds);

      // Invalidate all notification caches (safer than trying to match specific patterns)
      cacheService.evictByPattern("notifications:.*");

      logger.info("Bulk deleted {} old notifications", notificationIds.size());
    }
  }

  // ============================================================================
  // CACHE MANAGEMENT OPERATIONS
  // ============================================================================

  /** Warm up cache with frequently accessed data */
  public void warmUpCache() {
    logger.info("Starting cache warm-up process");

    try {
      // Warm up active shops
      List<Shop> activeShops =
          shopRepository.findAll().stream()
              .filter(shop -> shop.getDeletedAt() == null)
              .limit(100) // Limit to prevent memory issues
              .toList();

      for (Shop shop : activeShops) {
        String domainCacheKey = "shop:domain:" + shop.getShopifyDomain();
        String idCacheKey = "shop:id:" + shop.getId();
        cacheService.put(domainCacheKey, shop, SHOP_CACHE_TTL);
        cacheService.put(idCacheKey, shop, SHOP_CACHE_TTL);
      }

      logger.info("Cache warm-up completed for {} shops", activeShops.size());

    } catch (Exception e) {
      logger.error("Error during cache warm-up", e);
    }
  }

  /** Clear all application caches */
  public void clearAllCaches() {
    cacheService.evictByPattern(".*");
    logger.info("All application caches cleared");
  }

  /** Get cache statistics */
  public QueryResultCacheService.CacheStatistics getCacheStatistics() {
    return cacheService.getStatistics();
  }
}
