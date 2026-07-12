package com.storesight.backend.service;

import com.storesight.backend.service.RedisSessionService.SessionData;
import com.storesight.backend.service.SessionSecurityService.SessionValidationResult;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Enhanced session validation service that provides comprehensive security validation for user
 * sessions including IP validation, user agent validation, and session fingerprinting
 */
@Service
public class EnhancedSessionValidationService {

  private static final Logger logger =
      LoggerFactory.getLogger(EnhancedSessionValidationService.class);

  @Autowired private SessionSecurityService sessionSecurityService;

  @Autowired private RedisSessionService redisSessionService;

  // Removed AdminAuthService dependency to break circular dependency
  // Audit logging will be handled by the calling service

  @Autowired private RedisTemplate<String, Object> redisTemplate;

  @Value("${session.validation.max-concurrent-sessions:5}")
  private int maxConcurrentSessions;

  @Value("${session.validation.session-timeout-minutes:240}")
  private int sessionTimeoutMinutes;

  @Value("${session.validation.suspicious-activity-threshold:3}")
  private int suspiciousActivityThreshold;

  @Value("${session.validation.geo-location-validation:false}")
  private boolean geoLocationValidationEnabled;

  @Value("${session.validation.device-fingerprinting:true}")
  private boolean deviceFingerprintingEnabled;

  /** Comprehensive session validation with enhanced security checks */
  public EnhancedValidationResult validateSession(
      String shopDomain,
      String sessionId,
      String currentIpAddress,
      String currentUserAgent,
      Map<String, String> requestHeaders) {

    EnhancedValidationResult result = new EnhancedValidationResult();
    result.setSessionId(sessionId);
    result.setShopDomain(shopDomain);
    result.setValid(true);

    try {
      // Get session data
      Optional<SessionData> sessionDataOpt =
          redisSessionService.getSessionData(shopDomain, sessionId);
      if (!sessionDataOpt.isPresent()) {
        result.setValid(false);
        result.addViolation("SESSION_NOT_FOUND", "Session not found");
        return result;
      }

      SessionData sessionData = sessionDataOpt.get();

      // Basic session security validation
      SessionValidationResult basicValidation =
          sessionSecurityService.validateSessionSecurity(
              sessionData, currentIpAddress, currentUserAgent);

      if (!basicValidation.isValid()) {
        result.setValid(false);
        result.getViolations().putAll(basicValidation.getViolations());
      }

      // Enhanced validations
      validateConcurrentSessions(shopDomain, sessionId, result);
      validateSessionTimeout(sessionData, result);
      validateSuspiciousActivity(shopDomain, sessionId, currentIpAddress, result);

      if (deviceFingerprintingEnabled) {
        validateDeviceFingerprint(sessionData, requestHeaders, result);
      }

      // Check for session hijacking indicators
      checkSessionHijackingIndicators(sessionData, currentIpAddress, currentUserAgent, result);

      // Update session activity
      if (result.isValid()) {
        updateSessionActivity(shopDomain, sessionId, currentIpAddress);
      }

      // Log validation result for audit
      if (!result.isValid()) {
        logger.warn(
            "SESSION_VALIDATION_FAILED for session {} - Violations: {}",
            sessionId,
            result.getViolations().keySet());
      }

    } catch (Exception e) {
      logger.error(
          "Session validation error for {}:{} - {}", shopDomain, sessionId, e.getMessage(), e);
      result.setValid(false);
      result.addViolation("VALIDATION_ERROR", "Session validation error occurred");
    }

    return result;
  }

  /** Validate concurrent sessions limit */
  private void validateConcurrentSessions(
      String shopDomain, String sessionId, EnhancedValidationResult result) {
    try {
      var activeSessions = redisSessionService.getActiveSessionsForShop(shopDomain);
      if (activeSessions.size() > maxConcurrentSessions) {
        result.addWarning(
            "MAX_CONCURRENT_SESSIONS",
            "Maximum concurrent sessions exceeded: " + activeSessions.size());

        // Log potential security issue
        logger.warn(
            "MAX_CONCURRENT_SESSIONS_EXCEEDED for shop {} - {} concurrent sessions",
            shopDomain,
            activeSessions.size());
      }
    } catch (Exception e) {
      logger.warn("Failed to validate concurrent sessions: {}", e.getMessage());
    }
  }

  /** Validate session timeout */
  private void validateSessionTimeout(SessionData sessionData, EnhancedValidationResult result) {
    if (sessionData.getLastAccessedAt() != null) {
      LocalDateTime timeoutThreshold = LocalDateTime.now().minusMinutes(sessionTimeoutMinutes);
      if (sessionData.getLastAccessedAt().isBefore(timeoutThreshold)) {
        result.setValid(false);
        result.addViolation("SESSION_TIMEOUT", "Session has timed out due to inactivity");
      }
    }
  }

  /** Check for suspicious activity patterns */
  private void validateSuspiciousActivity(
      String shopDomain, String sessionId, String ipAddress, EnhancedValidationResult result) {
    try {
      String suspiciousKey = "suspicious_activity:" + shopDomain + ":" + sessionId;
      String countStr = (String) redisTemplate.opsForValue().get(suspiciousKey);
      int suspiciousCount = countStr != null ? Integer.parseInt(countStr) : 0;

      if (suspiciousCount >= suspiciousActivityThreshold) {
        result.setValid(false);
        result.addViolation("SUSPICIOUS_ACTIVITY", "Suspicious activity detected for this session");

        logger.warn(
            "SUSPICIOUS_SESSION_ACTIVITY - count {} for session {} from IP {}",
            suspiciousCount,
            sessionId,
            ipAddress);
      }
    } catch (Exception e) {
      logger.warn("Failed to check suspicious activity: {}", e.getMessage());
    }
  }

  /** Validate device fingerprint */
  private void validateDeviceFingerprint(
      SessionData sessionData,
      Map<String, String> requestHeaders,
      EnhancedValidationResult result) {
    try {
      String currentFingerprint = generateDeviceFingerprint(requestHeaders);
      String originalFingerprint = sessionData.getDeviceFingerprint();

      if (originalFingerprint == null || originalFingerprint.isBlank()) {
        sessionData.setDeviceFingerprint(currentFingerprint);
        redisSessionService.cacheSessionData(
            sessionData.getShopDomain(), sessionData.getSessionId(), sessionData);
        return;
      }

      if (originalFingerprint != null && !originalFingerprint.equals(currentFingerprint)) {
        result.addWarning("DEVICE_FINGERPRINT_MISMATCH", "Device fingerprint has changed");

        // This might indicate session hijacking or legitimate device changes
        logger.warn(
            "DEVICE_FINGERPRINT_CHANGE for session {} from IP {}",
            sessionData.getSessionId(),
            sessionData.getIpAddress());
      }
    } catch (Exception e) {
      logger.warn("Failed to validate device fingerprint: {}", e.getMessage());
    }
  }

  /** Check for session hijacking indicators */
  private void checkSessionHijackingIndicators(
      SessionData sessionData,
      String currentIpAddress,
      String currentUserAgent,
      EnhancedValidationResult result) {
    try {
      boolean ipChanged =
          sessionData.getIpAddress() != null
              && !sessionData.getIpAddress().equals(currentIpAddress);
      boolean userAgentChanged =
          sessionData.getUserAgent() != null
              && !sessionData.getUserAgent().equals(currentUserAgent);

      if (ipChanged && userAgentChanged) {
        // Both IP and user agent changed - high risk
        result.setValid(false);
        result.addViolation(
            "POTENTIAL_SESSION_HIJACKING", "Both IP address and user agent changed simultaneously");

        logger.warn(
            "POTENTIAL_SESSION_HIJACKING detected for session {} - IP changed from {} to {}",
            sessionData.getSessionId(),
            sessionData.getIpAddress(),
            currentIpAddress);
      } else if (ipChanged) {
        // Only IP changed - medium risk
        result.addWarning("IP_ADDRESS_CHANGED", "IP address changed during session");

        // Record IP change for monitoring
        recordIpChange(sessionData.getSessionId(), sessionData.getIpAddress(), currentIpAddress);
      }
    } catch (Exception e) {
      logger.warn("Failed to check session hijacking indicators: {}", e.getMessage());
    }
  }

  /** Update session activity timestamp */
  private void updateSessionActivity(String shopDomain, String sessionId, String ipAddress) {
    try {
      String activityKey = "session_activity:" + shopDomain + ":" + sessionId;
      Map<String, Object> activityData = new HashMap<>();
      activityData.put("lastActivity", Instant.now().toString());
      activityData.put("ipAddress", ipAddress);

      redisTemplate.opsForValue().set(activityKey, activityData, 4, TimeUnit.HOURS);
    } catch (Exception e) {
      logger.warn("Failed to update session activity: {}", e.getMessage());
    }
  }

  /** Record IP address change for monitoring */
  private void recordIpChange(String sessionId, String oldIp, String newIp) {
    try {
      String changeKey = "ip_changes:" + sessionId;
      Map<String, Object> changeData = new HashMap<>();
      changeData.put("oldIp", oldIp);
      changeData.put("newIp", newIp);
      changeData.put("timestamp", Instant.now().toString());

      redisTemplate.opsForValue().set(changeKey, changeData, 24, TimeUnit.HOURS);
    } catch (Exception e) {
      logger.warn("Failed to record IP change: {}", e.getMessage());
    }
  }

  /** Generate device fingerprint from request headers */
  private String generateDeviceFingerprint(Map<String, String> headers) {
    StringBuilder fingerprint = new StringBuilder();

    // Include relevant headers for fingerprinting
    String[] fingerprintHeaders = {
      "User-Agent", "Accept", "Accept-Language", "Accept-Encoding",
      "DNT", "Upgrade-Insecure-Requests", "Sec-Fetch-Site", "Sec-Fetch-Mode"
    };

    for (String header : fingerprintHeaders) {
      String value = headers.get(header);
      if (value != null) {
        fingerprint.append(header).append(":").append(value).append(";");
      }
    }

    // Generate hash of the fingerprint
    return sessionSecurityService.generateSessionHash(fingerprint.toString(), "", "");
  }

  /** Mark session as suspicious */
  public void markSessionSuspicious(
      String shopDomain, String sessionId, String reason, String ipAddress) {
    try {
      String suspiciousKey = "suspicious_activity:" + shopDomain + ":" + sessionId;
      Long count = redisTemplate.opsForValue().increment(suspiciousKey);
      redisTemplate.expire(suspiciousKey, 1, TimeUnit.HOURS);

      logger.warn(
          "SESSION_MARKED_SUSPICIOUS - Session {} marked suspicious (count: {}) - Reason: {}",
          sessionId,
          count,
          reason);

      logger.warn(
          "Session {}:{} marked suspicious - Reason: {}, Count: {}",
          shopDomain,
          sessionId,
          reason,
          count);
    } catch (Exception e) {
      logger.error("Failed to mark session as suspicious: {}", e.getMessage());
    }
  }

  /** Force invalidate session due to security violation */
  public void forceInvalidateSession(
      String shopDomain, String sessionId, String reason, String ipAddress) {
    try {
      // Mark session as invalid in Redis
      String invalidKey = "invalid_session:" + shopDomain + ":" + sessionId;
      redisTemplate.opsForValue().set(invalidKey, reason, 1, TimeUnit.HOURS);

      // Remove from active sessions
      redisSessionService.removeSessionFromCache(shopDomain, sessionId);

      // Secure cleanup
      sessionSecurityService.secureSessionCleanup(sessionId, shopDomain);

      logger.warn(
          "SESSION_FORCE_INVALIDATED - Session {} force invalidated - Reason: {}",
          sessionId,
          reason);

      logger.warn("Session {}:{} force invalidated - Reason: {}", shopDomain, sessionId, reason);
    } catch (Exception e) {
      logger.error("Failed to force invalidate session: {}", e.getMessage());
    }
  }

  /** Enhanced validation result holder */
  public static class EnhancedValidationResult {
    private boolean valid;
    private String sessionId;
    private String shopDomain;
    private Map<String, String> violations = new HashMap<>();
    private Map<String, String> warnings = new HashMap<>();
    private boolean requiresReauthentication;
    private boolean requiresTokenRotation;

    public boolean isValid() {
      return valid;
    }

    public void setValid(boolean valid) {
      this.valid = valid;
    }

    public String getSessionId() {
      return sessionId;
    }

    public void setSessionId(String sessionId) {
      this.sessionId = sessionId;
    }

    public String getShopDomain() {
      return shopDomain;
    }

    public void setShopDomain(String shopDomain) {
      this.shopDomain = shopDomain;
    }

    public Map<String, String> getViolations() {
      return violations;
    }

    public void addViolation(String code, String message) {
      this.violations.put(code, message);
    }

    public Map<String, String> getWarnings() {
      return warnings;
    }

    public void addWarning(String code, String message) {
      this.warnings.put(code, message);
    }

    public boolean hasViolations() {
      return !violations.isEmpty();
    }

    public boolean hasWarnings() {
      return !warnings.isEmpty();
    }

    public boolean isRequiresReauthentication() {
      return requiresReauthentication;
    }

    public void setRequiresReauthentication(boolean requiresReauthentication) {
      this.requiresReauthentication = requiresReauthentication;
    }

    public boolean isRequiresTokenRotation() {
      return requiresTokenRotation;
    }

    public void setRequiresTokenRotation(boolean requiresTokenRotation) {
      this.requiresTokenRotation = requiresTokenRotation;
    }
  }
}
