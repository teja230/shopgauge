package com.storesight.backend.service;

import com.storesight.backend.model.Shop;
import com.storesight.backend.model.ShopSession;
import com.storesight.backend.repository.ShopRepository;
import com.storesight.backend.repository.ShopSessionRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Service for managing demo mode functionality Handles secure demo store access and session
 * management
 */
@Service
public class DemoModeService {

  private static final Logger logger = LoggerFactory.getLogger(DemoModeService.class);

  // Demo store constants
  public static final String DEMO_STORE_DOMAIN = "demo-shopgauge.myshopify.com";
  public static final String DEMO_ACCESS_TOKEN = "demo_access_token_shopgauge_2024";
  private static final String DEMO_SESSION_PREFIX = "demo-session-";
  private static final String REDIS_DEMO_SESSION_KEY = "demo:session:";
  private static final int DEMO_SESSION_TTL_HOURS = 24;

  @Autowired private ShopRepository shopRepository;

  @Autowired private ShopSessionRepository shopSessionRepository;

  @Autowired private StringRedisTemplate redisTemplate;

  @Autowired private DemoDataService demoDataService;

  @Value("${storesight.demo.enabled:true}")
  private boolean demoEnabled;

  @Value("${spring.profiles.active:dev}")
  private String activeProfile;

  /** Check if demo mode is enabled and available */
  public boolean isDemoModeEnabled() {
    return demoEnabled;
  }

  /** Check if a shop domain is the demo store */
  public boolean isDemoStore(String shopDomain) {
    if (shopDomain == null) {
      return false;
    }
    return DEMO_STORE_DOMAIN.equals(shopDomain.toLowerCase().trim());
  }

  /** Check if an access token is the demo token */
  public boolean isDemoToken(String accessToken) {
    if (accessToken == null) {
      return false;
    }
    return DEMO_ACCESS_TOKEN.equals(accessToken.trim());
  }

  /**
   * Create a demo session for the demo store Returns session ID that can be used for authentication
   */
  public String createDemoSession(String userAgent, String ipAddress) {
    try {
      logger.info("Creating demo session for IP: {}", ipAddress);

      // Ensure demo store exists
      Shop demoShop = ensureDemoStoreExists();
      if (demoShop == null) {
        logger.error("Failed to create or find demo store");
        return null;
      }

      // Generate unique session ID
      String sessionId = DEMO_SESSION_PREFIX + UUID.randomUUID().toString();

      // Create shop session
      ShopSession demoSession = new ShopSession();
      demoSession.setShop(demoShop);
      demoSession.setSessionId(sessionId);
      demoSession.setAccessToken(DEMO_ACCESS_TOKEN);
      demoSession.setUserAgent(userAgent != null ? userAgent : "Demo User Agent");
      demoSession.setIpAddress(ipAddress != null ? ipAddress : "127.0.0.1");
      demoSession.setExpiresAt(LocalDateTime.now().plusHours(DEMO_SESSION_TTL_HOURS));
      demoSession.setIsActive(true);

      // Save to database
      shopSessionRepository.save(demoSession);

      // Store session info in Redis for quick lookup
      String redisKey = REDIS_DEMO_SESSION_KEY + sessionId;
      redisTemplate
          .opsForHash()
          .putAll(
              redisKey,
              Map.of(
                  "shop",
                  DEMO_STORE_DOMAIN,
                  "token",
                  DEMO_ACCESS_TOKEN,
                  "created",
                  LocalDateTime.now().toString(),
                  "ip",
                  ipAddress != null ? ipAddress : "127.0.0.1"));
      redisTemplate.expire(redisKey, Duration.ofHours(DEMO_SESSION_TTL_HOURS));

      // Seed demo data in Redis if not already present
      if (!demoDataService.hasDemoData()) {
        logger.info("Seeding demo data for new demo session");
        demoDataService.seedDemoData();
      }

      logger.info("Demo session created successfully: {}", sessionId);
      return sessionId;

    } catch (Exception e) {
      logger.error("Error creating demo session", e);
      return null;
    }
  }

  /** Validate if a session ID is a valid demo session */
  public boolean isValidDemoSession(String sessionId) {
    if (sessionId == null || !sessionId.startsWith(DEMO_SESSION_PREFIX)) {
      return false;
    }

    try {
      // Check Redis first for quick lookup
      String redisKey = REDIS_DEMO_SESSION_KEY + sessionId;
      if (redisTemplate.hasKey(redisKey)) {
        String shop = (String) redisTemplate.opsForHash().get(redisKey, "shop");
        return DEMO_STORE_DOMAIN.equals(shop);
      }

      // Fallback to database
      Optional<ShopSession> session =
          shopSessionRepository.findBySessionIdAndIsActiveTrue(sessionId);
      if (session.isPresent()) {
        ShopSession shopSession = session.get();
        boolean isDemo = isDemoStore(shopSession.getShop().getShopifyDomain());
        boolean isNotExpired =
            shopSession.getExpiresAt() == null
                || shopSession.getExpiresAt().isAfter(LocalDateTime.now());

        return isDemo && isNotExpired;
      }

      return false;

    } catch (Exception e) {
      logger.warn("Error validating demo session: {}", sessionId, e);
      return false;
    }
  }

  /** Get demo store information */
  public Optional<Shop> getDemoStore() {
    try {
      return shopRepository.findByShopifyDomainAndIsActiveTrue(DEMO_STORE_DOMAIN);
    } catch (Exception e) {
      logger.warn("Error retrieving demo store", e);
      return Optional.empty();
    }
  }

  /** Ensure demo store exists in database */
  private Shop ensureDemoStoreExists() {
    try {
      Optional<Shop> existingShop =
          shopRepository.findByShopifyDomainAndIsActiveTrue(DEMO_STORE_DOMAIN);
      if (existingShop.isPresent()) {
        return existingShop.get();
      }

      // Create demo store if it doesn't exist
      Shop demoShop = new Shop();
      demoShop.setShopifyDomain(DEMO_STORE_DOMAIN);
      demoShop.setAccessToken(DEMO_ACCESS_TOKEN);
      demoShop.setActive(true);

      Shop savedShop = shopRepository.save(demoShop);
      logger.info("Demo store created: {}", DEMO_STORE_DOMAIN);
      return savedShop;

    } catch (Exception e) {
      logger.error("Error ensuring demo store exists", e);
      return null;
    }
  }

  /** Clean up expired demo sessions */
  public void cleanupExpiredDemoSessions() {
    try {
      logger.debug("Cleaning up expired demo sessions");

      // Clean up database sessions
      Optional<Shop> demoShop = getDemoStore();
      if (demoShop.isPresent()) {
        int deletedSessions =
            shopSessionRepository.deleteExpiredSessionsForShop(
                demoShop.get().getId(), LocalDateTime.now());
        if (deletedSessions > 0) {
          logger.info("Cleaned up {} expired demo sessions from database", deletedSessions);
        }
      }

      // Note: Redis keys will auto-expire based on TTL

    } catch (Exception e) {
      logger.warn("Error during demo session cleanup", e);
    }
  }

  /** Get demo mode statistics */
  public Map<String, Object> getDemoModeStats() {
    try {
      Optional<Shop> demoShop = getDemoStore();
      if (!demoShop.isPresent()) {
        return Map.of("enabled", false);
      }

      long activeSessions =
          shopSessionRepository.countActiveSessionsForShop(demoShop.get().getId());

      return Map.of(
          "enabled", demoEnabled,
          "shopDomain", DEMO_STORE_DOMAIN,
          "activeSessions", activeSessions,
          "profile", activeProfile);

    } catch (Exception e) {
      logger.warn("Error getting demo mode stats", e);
      return Map.of("enabled", demoEnabled, "error", e.getMessage());
    }
  }

  /** Disable demo mode (for admin control) */
  public void disableDemoMode() {
    this.demoEnabled = false;
    logger.warn("Demo mode has been disabled");
  }

  /** Enable demo mode (for admin control) */
  public void enableDemoMode() {
    this.demoEnabled = true;
    logger.info("Demo mode has been enabled");
  }
}
