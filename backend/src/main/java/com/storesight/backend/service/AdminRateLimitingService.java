package com.storesight.backend.service;

import java.time.temporal.ChronoUnit;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Enhanced rate limiting service specifically for admin endpoints Provides more restrictive rate
 * limiting for admin operations
 */
@Service
public class AdminRateLimitingService {

  private static final Logger logger = LoggerFactory.getLogger(AdminRateLimitingService.class);

  @Autowired private RedisTemplate<String, Object> redisTemplate;

  @Value("${admin.rate-limit.requests-per-minute:10}")
  private int adminRequestsPerMinute;

  @Value("${admin.rate-limit.login-attempts-per-hour:5}")
  private int loginAttemptsPerHour;

  @Value("${admin.rate-limit.sensitive-operations-per-hour:20}")
  private int sensitiveOperationsPerHour;

  @Value("${admin.rate-limit.enabled:true}")
  private boolean rateLimitEnabled;

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

      redisTemplate.delete(redisTemplate.keys(generalPattern));
      redisTemplate.delete(loginPattern);
      redisTemplate.delete(redisTemplate.keys(sensitivePattern));

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
