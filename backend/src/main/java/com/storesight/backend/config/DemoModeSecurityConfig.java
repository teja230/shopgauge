package com.storesight.backend.config;

import com.storesight.backend.service.DemoDataService;
import com.storesight.backend.service.DemoModeService;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Security configuration and monitoring for demo mode Implements rate limiting, resource
 * protection, and cleanup policies
 */
@Configuration
@EnableScheduling
public class DemoModeSecurityConfig {

  private static final Logger logger = LoggerFactory.getLogger(DemoModeSecurityConfig.class);

  @Value("${storesight.demo.max-concurrent-sessions:20}")
  private int maxConcurrentDemoSessions;

  @Value("${storesight.demo.rate-limit.requests-per-minute:30}")
  private int demoRateLimit;

  @Value("${storesight.demo.enabled:true}")
  private boolean demoEnabled;

  @Value("${spring.profiles.active:dev}")
  private String activeProfile;

  // Demo session tracking for security
  private final AtomicInteger activeDemoSessions = new AtomicInteger(0);
  private final ConcurrentHashMap<String, RateLimitInfo> demoRateMap = new ConcurrentHashMap<>();

  @Autowired private DemoModeService demoModeService;

  @Autowired private DemoDataService demoDataService;

  /** Rate limit info for demo sessions */
  private static class RateLimitInfo {
    private final AtomicInteger requestCount = new AtomicInteger(0);
    private volatile long windowStart = System.currentTimeMillis();

    public boolean isAllowed(int maxRequests) {
      long now = System.currentTimeMillis();

      // Reset window if more than 1 minute has passed
      if (now - windowStart > 60000) {
        windowStart = now;
        requestCount.set(0);
      }

      return requestCount.incrementAndGet() <= maxRequests;
    }
  }

  /** Check if demo session creation is allowed based on security limits */
  public boolean isDemoSessionCreationAllowed(String clientIp) {
    if (!demoEnabled) {
      logger.warn("Demo session creation denied - demo mode disabled");
      return false;
    }

    // Check concurrent session limit
    if (activeDemoSessions.get() >= maxConcurrentDemoSessions) {
      logger.warn(
          "Demo session creation denied - max concurrent sessions reached: {}",
          maxConcurrentDemoSessions);
      return false;
    }

    // Check rate limiting per IP
    RateLimitInfo rateLimitInfo = demoRateMap.computeIfAbsent(clientIp, k -> new RateLimitInfo());
    if (!rateLimitInfo.isAllowed(demoRateLimit)) {
      logger.warn("Demo session creation denied - rate limit exceeded for IP: {}", clientIp);
      return false;
    }

    return true;
  }

  /** Register a new demo session */
  public void registerDemoSession() {
    activeDemoSessions.incrementAndGet();
    logger.debug("Demo session registered. Active sessions: {}", activeDemoSessions.get());
  }

  /** Unregister a demo session */
  public void unregisterDemoSession() {
    activeDemoSessions.decrementAndGet();
    logger.debug("Demo session unregistered. Active sessions: {}", activeDemoSessions.get());
  }

  /** Get current demo session statistics */
  public DemoSecurityStats getDemoSecurityStats() {
    return new DemoSecurityStats(
        activeDemoSessions.get(), maxConcurrentDemoSessions, demoRateLimit, demoEnabled);
  }

  /**
   * Scheduled cleanup of demo resources for security Runs every 15 minutes to clean up demo data
   * and sessions
   */
  @Scheduled(fixedRate = 900000) // 15 minutes
  public void cleanupDemoResources() {
    try {
      logger.debug("Starting demo resource cleanup");

      // Clean up expired demo sessions
      demoModeService.cleanupExpiredDemoSessions();

      // Clean up old rate limit entries
      long cutoffTime = System.currentTimeMillis() - 3600000; // 1 hour ago
      demoRateMap.entrySet().removeIf(entry -> entry.getValue().windowStart < cutoffTime);

      // Reset session counter if no sessions detected
      if (activeDemoSessions.get() > 0) {
        // Could add verification logic here to ensure count is accurate
      }

      logger.debug("Demo resource cleanup completed");

    } catch (Exception e) {
      logger.error("Error during demo resource cleanup", e);
    }
  }

  /** Emergency demo shutdown for security incidents */
  public void emergencyDemoShutdown(String reason) {
    logger.error("EMERGENCY DEMO SHUTDOWN: {}", reason);

    try {
      // Disable demo mode
      demoModeService.disableDemoMode();

      // Clear all demo data
      demoDataService.clearDemoData();

      // Reset session counters
      activeDemoSessions.set(0);
      demoRateMap.clear();

      logger.error("Emergency demo shutdown completed");

    } catch (Exception e) {
      logger.error("Error during emergency demo shutdown", e);
    }
  }

  /** Validate demo request for additional security */
  public boolean validateDemoRequest(String userAgent, String clientIp) {
    // Basic bot detection
    if (userAgent != null) {
      String lowerUA = userAgent.toLowerCase();
      if (lowerUA.contains("bot")
          || lowerUA.contains("crawler")
          || lowerUA.contains("spider")
          || lowerUA.contains("scraper")) {
        logger.warn("Demo request denied - bot detected: {}", userAgent);
        return false;
      }
    }

    // Basic IP validation
    if (clientIp != null) {
      // Block obviously invalid IPs
      if (clientIp.equals("0.0.0.0")
          || (clientIp.startsWith("127.") && !clientIp.equals("127.0.0.1"))) {
        logger.warn("Demo request denied - suspicious IP: {}", clientIp);
        return false;
      }
    }

    return true;
  }

  /** Security monitoring for demo mode abuse */
  @Scheduled(fixedRate = 300000) // 5 minutes
  public void monitorDemoSecurity() {
    try {
      int currentSessions = activeDemoSessions.get();

      // Alert if too many concurrent sessions
      if (currentSessions > maxConcurrentDemoSessions * 0.8) {
        logger.warn(
            "High demo session usage: {}/{} sessions", currentSessions, maxConcurrentDemoSessions);
      }

      // Monitor rate limiting effectiveness
      long blockedRequests =
          demoRateMap.values().stream()
              .mapToLong(info -> Math.max(0, info.requestCount.get() - demoRateLimit))
              .sum();

      if (blockedRequests > 0) {
        logger.info(
            "Demo rate limiting active - blocked {} requests in last window", blockedRequests);
      }

    } catch (Exception e) {
      logger.error("Error during demo security monitoring", e);
    }
  }

  /** Demo security statistics */
  public static class DemoSecurityStats {
    public final int activeSessions;
    public final int maxSessions;
    public final int rateLimit;
    public final boolean enabled;

    public DemoSecurityStats(int activeSessions, int maxSessions, int rateLimit, boolean enabled) {
      this.activeSessions = activeSessions;
      this.maxSessions = maxSessions;
      this.rateLimit = rateLimit;
      this.enabled = enabled;
    }
  }
}
