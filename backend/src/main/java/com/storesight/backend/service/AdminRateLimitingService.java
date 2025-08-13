package com.storesight.backend.service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Comprehensive rate limiting service for admin endpoints and Market Intelligence operations.
 * Provides Redis-based rate limiting for all operations to ensure persistence, scalability, and
 * consistency.
 */
@Service
public class AdminRateLimitingService {

  private static final Logger logger = LoggerFactory.getLogger(AdminRateLimitingService.class);

  @Autowired private RedisTemplate<String, Object> redisTemplate;
  @Autowired private EnhancedRedisService enhancedRedisService;

  // Admin rate limit configurations
  @Value("${admin.rate-limit.requests-per-minute:10}")
  private int adminRequestsPerMinute;

  @Value("${admin.rate-limit.login-attempts-per-hour:5}")
  private int loginAttemptsPerHour;

  @Value("${admin.rate-limit.sensitive-operations-per-hour:20}")
  private int sensitiveOperationsPerHour;

  @Value("${admin.rate-limit.enabled:true}")
  private boolean rateLimitEnabled;

  // Market Intelligence rate limit configurations
  @Value("${security.rate-limit.competitor.add-per-hour:10}")
  private int competitorAddPerHour;

  @Value("${security.rate-limit.competitor.discovery-per-day:3}")
  private int discoveryPerDay;

  @Value("${security.rate-limit.competitor.suggestions-per-hour:50}")
  private int suggestionsPerHour;

  @Value("${security.rate-limit.api.requests-per-minute:60}")
  private int apiRequestsPerMinute;

  // ========== ADMIN RATE LIMITING METHODS (Redis-based) ==========

  /** Check if admin request is allowed based on general rate limiting */
  public boolean isAdminRequestAllowed(String ipAddress, String endpoint) {
    if (!rateLimitEnabled) {
      return true;
    }

    try {
      String key = "admin:rate_limit:general:" + ipAddress + ":" + endpoint;
      return checkRateLimit(key, adminRequestsPerMinute, 1, ChronoUnit.MINUTES);
    } catch (Exception e) {
      logger.warn("Redis unavailable for admin rate limiting: {}", e.getMessage());
      return true; // Allow request if Redis is unavailable
    }
  }

  /** Check if admin login attempt is allowed */
  public boolean isLoginAttemptAllowed(String ipAddress) {
    if (!rateLimitEnabled) {
      return true;
    }

    try {
      String key = "admin:rate_limit:login:" + ipAddress;
      return checkRateLimit(key, loginAttemptsPerHour, 1, ChronoUnit.HOURS);
    } catch (Exception e) {
      logger.warn("Redis unavailable for login rate limiting: {}", e.getMessage());
      return true; // Allow login if Redis is unavailable
    }
  }

  /** Check if sensitive admin operation is allowed */
  public boolean isSensitiveOperationAllowed(String ipAddress, String operation) {
    if (!rateLimitEnabled) {
      return true;
    }

    try {
      String key = "admin:rate_limit:sensitive:" + ipAddress + ":" + operation;
      return checkRateLimit(key, sensitiveOperationsPerHour, 1, ChronoUnit.HOURS);
    } catch (Exception e) {
      logger.warn("Redis unavailable for sensitive operation rate limiting: {}", e.getMessage());
      return true; // Allow operation if Redis is unavailable
    }
  }

  /** Record a successful admin request */
  public void recordAdminRequest(String ipAddress, String endpoint) {
    if (!rateLimitEnabled) {
      return;
    }

    try {
      String key = "admin:rate_limit:general:" + ipAddress + ":" + endpoint;
      incrementCounter(key, 1, ChronoUnit.MINUTES);
    } catch (Exception e) {
      logger.warn("Failed to record admin request: {}", e.getMessage());
    }
  }

  /** Record a login attempt */
  public void recordLoginAttempt(String ipAddress) {
    if (!rateLimitEnabled) {
      return;
    }

    try {
      String key = "admin:rate_limit:login:" + ipAddress;
      incrementCounter(key, 1, ChronoUnit.HOURS);
    } catch (Exception e) {
      logger.warn("Failed to record login attempt: {}", e.getMessage());
    }
  }

  /** Record a sensitive operation */
  public void recordSensitiveOperation(String ipAddress, String operation) {
    if (!rateLimitEnabled) {
      return;
    }

    try {
      String key = "admin:rate_limit:sensitive:" + ipAddress + ":" + operation;
      incrementCounter(key, 1, ChronoUnit.HOURS);
    } catch (Exception e) {
      logger.warn("Failed to record sensitive operation: {}", e.getMessage());
    }
  }

  /** Get remaining requests for admin operations */
  public int getRemainingAdminRequests(String ipAddress, String endpoint) {
    if (!rateLimitEnabled) {
      return adminRequestsPerMinute;
    }

    try {
      String key = "admin:rate_limit:general:" + ipAddress + ":" + endpoint;
      Long currentCount = getCurrentCount(key);
      return Math.max(0, adminRequestsPerMinute - currentCount.intValue());
    } catch (Exception e) {
      logger.warn("Failed to get remaining admin requests: {}", e.getMessage());
      return adminRequestsPerMinute;
    }
  }

  /** Get remaining login attempts */
  public int getRemainingLoginAttempts(String ipAddress) {
    if (!rateLimitEnabled) {
      return loginAttemptsPerHour;
    }

    try {
      String key = "admin:rate_limit:login:" + ipAddress;
      Long currentCount = getCurrentCount(key);
      return Math.max(0, loginAttemptsPerHour - currentCount.intValue());
    } catch (Exception e) {
      logger.warn("Failed to get remaining login attempts: {}", e.getMessage());
      return loginAttemptsPerHour;
    }
  }

  /** Clear rate limiting for an IP address (emergency use) */
  public void clearRateLimiting(String ipAddress) {
    try {
      String generalPattern = "admin:rate_limit:general:" + ipAddress + ":*";
      String loginPattern = "admin:rate_limit:login:" + ipAddress;
      String sensitivePattern = "admin:rate_limit:sensitive:" + ipAddress + ":*";

      var generalKeys = enhancedRedisService.scanKeys(generalPattern);
      if (generalKeys != null && !generalKeys.isEmpty()) {
        redisTemplate.delete(generalKeys);
      }
      redisTemplate.delete(loginPattern);
      var sensitiveKeys = enhancedRedisService.scanKeys(sensitivePattern);
      if (sensitiveKeys != null && !sensitiveKeys.isEmpty()) {
        redisTemplate.delete(sensitiveKeys);
      }

      logger.info("Cleared rate limiting for IP: {}", ipAddress);
    } catch (Exception e) {
      logger.error("Failed to clear rate limiting for IP {}: {}", ipAddress, e.getMessage());
    }
  }

  /** Check if IP address is currently blocked due to rate limiting */
  public boolean isIpBlocked(String ipAddress) {
    if (!rateLimitEnabled) {
      return false;
    }

    try {
      // Check if any rate limit has been exceeded
      String generalKey = "admin:rate_limit:general:" + ipAddress + ":blocked";
      String loginKey = "admin:rate_limit:login:" + ipAddress + ":blocked";
      String sensitiveKey = "admin:rate_limit:sensitive:" + ipAddress + ":blocked";

      return redisTemplate.hasKey(generalKey)
          || redisTemplate.hasKey(loginKey)
          || redisTemplate.hasKey(sensitiveKey);
    } catch (Exception e) {
      logger.warn("Failed to check if IP is blocked: {}", e.getMessage());
      return false;
    }
  }

  /** Block an IP address temporarily (emergency use) */
  public void blockIpAddress(String ipAddress, int durationMinutes, String reason) {
    if (!rateLimitEnabled) {
      return;
    }

    try {
      String blockKey = "admin:rate_limit:blocked:" + ipAddress;
      String blockInfo = "Blocked at " + java.time.Instant.now() + " - Reason: " + reason;

      redisTemplate.opsForValue().set(blockKey, blockInfo, durationMinutes, TimeUnit.MINUTES);

      logger.warn(
          "IP address {} blocked for {} minutes - Reason: {}", ipAddress, durationMinutes, reason);
    } catch (Exception e) {
      logger.error("Failed to block IP address {}: {}", ipAddress, e.getMessage());
    }
  }

  /** Unblock an IP address (emergency use) */
  public void unblockIpAddress(String ipAddress) {
    try {
      String blockKey = "admin:rate_limit:blocked:" + ipAddress;
      redisTemplate.delete(blockKey);

      // Also clear all rate limiting for this IP
      clearRateLimiting(ipAddress);

      logger.info("IP address {} unblocked and rate limits cleared", ipAddress);
    } catch (Exception e) {
      logger.error("Failed to unblock IP address {}: {}", ipAddress, e.getMessage());
    }
  }

  /** Get comprehensive rate limiting status for an IP */
  public DetailedRateLimitStatus getDetailedRateLimitStatus(String ipAddress) {
    DetailedRateLimitStatus status = new DetailedRateLimitStatus();
    status.setIpAddress(ipAddress);
    status.setRateLimitEnabled(rateLimitEnabled);

    if (!rateLimitEnabled) {
      return status;
    }

    try {
      // Check if IP is blocked
      String blockKey = "admin:rate_limit:blocked:" + ipAddress;
      status.setBlocked(redisTemplate.hasKey(blockKey));
      if (status.isBlocked()) {
        Object blockInfo = redisTemplate.opsForValue().get(blockKey);
        status.setBlockReason(blockInfo != null ? blockInfo.toString() : "Unknown");
        Long ttl = redisTemplate.getExpire(blockKey, TimeUnit.SECONDS);
        status.setBlockExpiresInSeconds(ttl != null ? ttl : 0);
      }

      // Get current counts and remaining limits
      status.setRemainingAdminRequests(getRemainingAdminRequests(ipAddress, "general"));
      status.setRemainingLoginAttempts(getRemainingLoginAttempts(ipAddress));

      // Get current usage
      String generalKey = "admin:rate_limit:general:" + ipAddress + ":general";
      String loginKey = "admin:rate_limit:login:" + ipAddress;

      status.setCurrentAdminRequests(getCurrentCount(generalKey).intValue());
      status.setCurrentLoginAttempts(getCurrentCount(loginKey).intValue());

      // Get TTL for rate limit windows
      Long generalTtl = redisTemplate.getExpire(generalKey, TimeUnit.SECONDS);
      Long loginTtl = redisTemplate.getExpire(loginKey, TimeUnit.SECONDS);

      status.setAdminRequestsResetInSeconds(generalTtl != null ? generalTtl : 0);
      status.setLoginAttemptsResetInSeconds(loginTtl != null ? loginTtl : 0);

    } catch (Exception e) {
      logger.error(
          "Failed to get detailed rate limit status for IP {}: {}", ipAddress, e.getMessage());
      status.setError("Failed to retrieve rate limit status: " + e.getMessage());
    }

    return status;
  }

  // ========== MARKET INTELLIGENCE RATE LIMITING METHODS (Redis-based) ==========

  /** Check if competitor addition is allowed for a shop */
  public RateLimitResult checkCompetitorAddition(Long shopId) {
    try {
      String key = "market_intelligence:rate_limit:competitor_add:" + shopId;
      return checkRedisRateLimit(
          key, competitorAddPerHour, 60, ChronoUnit.MINUTES); // 1 hour window
    } catch (Exception e) {
      logger.warn("Redis unavailable for competitor addition rate limiting: {}", e.getMessage());
      return RateLimitResult.allowed(0, competitorAddPerHour, LocalDateTime.now().plusHours(1));
    }
  }

  /** Check if discovery is allowed for a shop */
  public RateLimitResult checkDiscoveryTrigger(Long shopId) {
    try {
      String key = "market_intelligence:rate_limit:discovery:" + shopId;
      return checkRedisRateLimit(key, discoveryPerDay, 24, ChronoUnit.HOURS); // 24 hour window
    } catch (Exception e) {
      logger.warn("Redis unavailable for discovery rate limiting: {}", e.getMessage());
      return RateLimitResult.allowed(0, discoveryPerDay, LocalDateTime.now().plusDays(1));
    }
  }

  /** Check if suggestion processing is allowed for a shop */
  public RateLimitResult checkSuggestionProcessing(Long shopId) {
    try {
      String key = "market_intelligence:rate_limit:suggestions:" + shopId;
      return checkRedisRateLimit(key, suggestionsPerHour, 60, ChronoUnit.MINUTES); // 1 hour window
    } catch (Exception e) {
      logger.warn("Redis unavailable for suggestions rate limiting: {}", e.getMessage());
      return RateLimitResult.allowed(0, suggestionsPerHour, LocalDateTime.now().plusHours(1));
    }
  }

  /** Check if API request is allowed for an IP */
  public RateLimitResult checkApiRequest(String ipAddress) {
    try {
      String key = "market_intelligence:rate_limit:api:" + ipAddress;
      return checkRedisRateLimit(
          key, apiRequestsPerMinute, 1, ChronoUnit.MINUTES); // 1 minute window
    } catch (Exception e) {
      logger.warn("Redis unavailable for API rate limiting: {}", e.getMessage());
      return RateLimitResult.allowed(0, apiRequestsPerMinute, LocalDateTime.now().plusMinutes(1));
    }
  }

  /** Generic Redis-based rate limit checker */
  private RateLimitResult checkRedisRateLimit(
      String key, int maxRequests, int duration, ChronoUnit unit) {
    Long currentCount = getCurrentCount(key);

    if (currentCount >= maxRequests) {
      logger.warn(
          "Rate limit exceeded for key: {} - Current: {}, Max: {}", key, currentCount, maxRequests);

      // Calculate reset time based on TTL
      Long ttl = redisTemplate.getExpire(key, TimeUnit.SECONDS);
      LocalDateTime resetTime =
          ttl != null
              ? LocalDateTime.now().plusSeconds(ttl)
              : LocalDateTime.now().plus(duration, unit);

      return RateLimitResult.denied(
          "Rate limit exceeded", currentCount.intValue(), maxRequests, resetTime);
    }

    // Increment counter
    Long newCount = redisTemplate.opsForValue().increment(key);
    if (newCount == 1) {
      // Set expiration only for new keys
      long seconds = unit.getDuration().getSeconds() * duration;
      redisTemplate.expire(key, seconds, TimeUnit.SECONDS);
    }

    // Calculate reset time
    Long ttl = redisTemplate.getExpire(key, TimeUnit.SECONDS);
    LocalDateTime resetTime =
        ttl != null
            ? LocalDateTime.now().plusSeconds(ttl)
            : LocalDateTime.now().plus(duration, unit);

    return RateLimitResult.allowed(newCount.intValue(), maxRequests, resetTime);
  }

  /** Get rate limit status for a shop */
  public Map<String, Object> getRateLimitStatus(Long shopId) {
    Map<String, Object> status = new ConcurrentHashMap<>();

    try {
      // Competitor addition status
      String addKey = "market_intelligence:rate_limit:competitor_add:" + shopId;
      Long addCount = getCurrentCount(addKey);
      Long addTtl = redisTemplate.getExpire(addKey, TimeUnit.SECONDS);
      LocalDateTime addResetTime =
          addTtl != null
              ? LocalDateTime.now().plusSeconds(addTtl)
              : LocalDateTime.now().plusHours(1);

      status.put(
          "competitorAddition",
          Map.of(
              "current", addCount.intValue(),
              "limit", competitorAddPerHour,
              "resetTime", addResetTime));

      // Discovery status
      String discoveryKey = "market_intelligence:rate_limit:discovery:" + shopId;
      Long discoveryCount = getCurrentCount(discoveryKey);
      Long discoveryTtl = redisTemplate.getExpire(discoveryKey, TimeUnit.SECONDS);
      LocalDateTime discoveryResetTime =
          discoveryTtl != null
              ? LocalDateTime.now().plusSeconds(discoveryTtl)
              : LocalDateTime.now().plusDays(1);

      status.put(
          "discovery",
          Map.of(
              "current", discoveryCount.intValue(),
              "limit", discoveryPerDay,
              "resetTime", discoveryResetTime));

      // Suggestions status
      String suggestionsKey = "market_intelligence:rate_limit:suggestions:" + shopId;
      Long suggestionsCount = getCurrentCount(suggestionsKey);
      Long suggestionsTtl = redisTemplate.getExpire(suggestionsKey, TimeUnit.SECONDS);
      LocalDateTime suggestionsResetTime =
          suggestionsTtl != null
              ? LocalDateTime.now().plusSeconds(suggestionsTtl)
              : LocalDateTime.now().plusHours(1);

      status.put(
          "suggestions",
          Map.of(
              "current", suggestionsCount.intValue(),
              "limit", suggestionsPerHour,
              "resetTime", suggestionsResetTime));

    } catch (Exception e) {
      logger.error("Failed to get rate limit status for shop {}: {}", shopId, e.getMessage());
      status.put("error", "Failed to retrieve rate limit status: " + e.getMessage());
    }

    return status;
  }

  /** Clear rate limits for a shop (admin function) */
  public void clearRateLimits(Long shopId) {
    try {
      String addKey = "market_intelligence:rate_limit:competitor_add:" + shopId;
      String discoveryKey = "market_intelligence:rate_limit:discovery:" + shopId;
      String suggestionsKey = "market_intelligence:rate_limit:suggestions:" + shopId;

      redisTemplate.delete(addKey);
      redisTemplate.delete(discoveryKey);
      redisTemplate.delete(suggestionsKey);

      logger.info("Rate limits cleared for shop: {}", shopId);
    } catch (Exception e) {
      logger.error("Failed to clear rate limits for shop {}: {}", shopId, e.getMessage());
    }
  }

  /** Clear all Market Intelligence rate limiting for an IP */
  public void clearMarketIntelligenceRateLimiting(String targetIp) {
    try {
      String apiKey = "market_intelligence:rate_limit:api:" + targetIp;
      redisTemplate.delete(apiKey);
      logger.info("Market Intelligence rate limiting cleared for IP: {}", targetIp);
    } catch (Exception e) {
      logger.error(
          "Failed to clear Market Intelligence rate limiting for IP {}: {}",
          targetIp,
          e.getMessage());
    }
  }

  // ========== UTILITY METHODS ==========

  /** Check rate limit using sliding window approach */
  private boolean checkRateLimit(String key, int maxRequests, int duration, ChronoUnit unit) {
    Long currentCount = getCurrentCount(key);
    return currentCount < maxRequests;
  }

  /** Increment counter with expiration */
  private void incrementCounter(String key, int duration, ChronoUnit unit) {
    Long newCount = redisTemplate.opsForValue().increment(key);
    if (newCount == 1) {
      // Set expiration only for new keys
      long seconds = unit.getDuration().getSeconds() * duration;
      redisTemplate.expire(key, seconds, TimeUnit.SECONDS);
    }
  }

  /** Get current count for a key */
  private Long getCurrentCount(String key) {
    Object value = redisTemplate.opsForValue().get(key);
    if (value == null) {
      return 0L;
    }
    if (value instanceof Number) {
      return ((Number) value).longValue();
    }
    try {
      return Long.parseLong(value.toString());
    } catch (NumberFormatException e) {
      logger.warn("Invalid count value for key {}: {}", key, value);
      return 0L;
    }
  }

  /** Get rate limiting statistics for monitoring */
  public RateLimitStats getRateLimitStats(String ipAddress) {
    RateLimitStats stats = new RateLimitStats();
    stats.setIpAddress(ipAddress);
    stats.setRemainingAdminRequests(getRemainingAdminRequests(ipAddress, "general"));
    stats.setRemainingLoginAttempts(getRemainingLoginAttempts(ipAddress));
    stats.setRateLimitEnabled(rateLimitEnabled);
    return stats;
  }

  // ========== INNER CLASSES ==========

  /** Rate limit result class */
  public static class RateLimitResult {
    private final boolean allowed;
    private final String message;
    private final int currentCount;
    private final int maxCount;
    private final LocalDateTime resetTime;

    private RateLimitResult(
        boolean allowed, String message, int currentCount, int maxCount, LocalDateTime resetTime) {
      this.allowed = allowed;
      this.message = message;
      this.currentCount = currentCount;
      this.maxCount = maxCount;
      this.resetTime = resetTime;
    }

    public static RateLimitResult allowed(int currentCount, int maxCount, LocalDateTime resetTime) {
      return new RateLimitResult(true, "Request allowed", currentCount, maxCount, resetTime);
    }

    public static RateLimitResult denied(
        String message, int currentCount, int maxCount, LocalDateTime resetTime) {
      return new RateLimitResult(false, message, currentCount, maxCount, resetTime);
    }

    public boolean isAllowed() {
      return allowed;
    }

    public String getMessage() {
      return message;
    }

    public int getCurrentCount() {
      return currentCount;
    }

    public int getMaxCount() {
      return maxCount;
    }

    public LocalDateTime getResetTime() {
      return resetTime;
    }

    public int getRemainingRequests() {
      return Math.max(0, maxCount - currentCount);
    }
  }

  /** Rate limit statistics holder */
  public static class RateLimitStats {
    private String ipAddress;
    private int remainingAdminRequests;
    private int remainingLoginAttempts;
    private boolean rateLimitEnabled;

    // Getters and setters
    public String getIpAddress() {
      return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
      this.ipAddress = ipAddress;
    }

    public int getRemainingAdminRequests() {
      return remainingAdminRequests;
    }

    public void setRemainingAdminRequests(int remainingAdminRequests) {
      this.remainingAdminRequests = remainingAdminRequests;
    }

    public int getRemainingLoginAttempts() {
      return remainingLoginAttempts;
    }

    public void setRemainingLoginAttempts(int remainingLoginAttempts) {
      this.remainingLoginAttempts = remainingLoginAttempts;
    }

    public boolean isRateLimitEnabled() {
      return rateLimitEnabled;
    }

    public void setRateLimitEnabled(boolean rateLimitEnabled) {
      this.rateLimitEnabled = rateLimitEnabled;
    }
  }

  /** Detailed rate limit status holder */
  public static class DetailedRateLimitStatus {
    private String ipAddress;
    private boolean rateLimitEnabled;
    private boolean blocked;
    private String blockReason;
    private long blockExpiresInSeconds;
    private int remainingAdminRequests;
    private int remainingLoginAttempts;
    private int currentAdminRequests;
    private int currentLoginAttempts;
    private long adminRequestsResetInSeconds;
    private long loginAttemptsResetInSeconds;
    private String error;

    // Getters and setters
    public String getIpAddress() {
      return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
      this.ipAddress = ipAddress;
    }

    public boolean isRateLimitEnabled() {
      return rateLimitEnabled;
    }

    public void setRateLimitEnabled(boolean rateLimitEnabled) {
      this.rateLimitEnabled = rateLimitEnabled;
    }

    public boolean isBlocked() {
      return blocked;
    }

    public void setBlocked(boolean blocked) {
      this.blocked = blocked;
    }

    public String getBlockReason() {
      return blockReason;
    }

    public void setBlockReason(String blockReason) {
      this.blockReason = blockReason;
    }

    public long getBlockExpiresInSeconds() {
      return blockExpiresInSeconds;
    }

    public void setBlockExpiresInSeconds(long blockExpiresInSeconds) {
      this.blockExpiresInSeconds = blockExpiresInSeconds;
    }

    public int getRemainingAdminRequests() {
      return remainingAdminRequests;
    }

    public void setRemainingAdminRequests(int remainingAdminRequests) {
      this.remainingAdminRequests = remainingAdminRequests;
    }

    public int getRemainingLoginAttempts() {
      return remainingLoginAttempts;
    }

    public void setRemainingLoginAttempts(int remainingLoginAttempts) {
      this.remainingLoginAttempts = remainingLoginAttempts;
    }

    public int getCurrentAdminRequests() {
      return currentAdminRequests;
    }

    public void setCurrentAdminRequests(int currentAdminRequests) {
      this.currentAdminRequests = currentAdminRequests;
    }

    public int getCurrentLoginAttempts() {
      return currentLoginAttempts;
    }

    public void setCurrentLoginAttempts(int currentLoginAttempts) {
      this.currentLoginAttempts = currentLoginAttempts;
    }

    public long getAdminRequestsResetInSeconds() {
      return adminRequestsResetInSeconds;
    }

    public void setAdminRequestsResetInSeconds(long adminRequestsResetInSeconds) {
      this.adminRequestsResetInSeconds = adminRequestsResetInSeconds;
    }

    public long getLoginAttemptsResetInSeconds() {
      return loginAttemptsResetInSeconds;
    }

    public void setLoginAttemptsResetInSeconds(long loginAttemptsResetInSeconds) {
      this.loginAttemptsResetInSeconds = loginAttemptsResetInSeconds;
    }

    public String getError() {
      return error;
    }

    public void setError(String error) {
      this.error = error;
    }
  }
}
