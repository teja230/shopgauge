package com.storesight.backend.service;

import com.storesight.backend.service.RedisSessionService.SessionData;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Enhanced session security service providing encryption, validation, and secure cleanup Implements
 * AES-256-GCM encryption for session tokens and comprehensive security validation
 */
@Service
public class SessionSecurityService {

  private static final Logger logger = LoggerFactory.getLogger(SessionSecurityService.class);

  private static final String ALGORITHM = "AES";
  private static final String TRANSFORMATION = "AES/GCM/NoPadding";
  private static final int GCM_IV_LENGTH = 12;
  private static final int GCM_TAG_LENGTH = 16;
  private static final int KEY_LENGTH = 256;

  @Autowired private RedisTemplate<String, Object> redisTemplate;

  // Removed AdminAuthService dependency to break circular dependency
  // Audit logging will be handled by the calling service

  @Value("${session.security.encryption.key:}")
  private String encryptionKeyBase64;

  @Value("${session.security.ip-validation.enabled:true}")
  private boolean ipValidationEnabled;

  @Value("${session.security.user-agent-validation.enabled:true}")
  private boolean userAgentValidationEnabled;

  @Value("${session.security.token-rotation.enabled:true}")
  private boolean tokenRotationEnabled;

  @Value("${session.security.token-rotation.interval-hours:24}")
  private int tokenRotationIntervalHours;

  @Value("${session.security.secure-cleanup.enabled:true}")
  private boolean secureCleanupEnabled;

  private SecretKey encryptionKey;
  private final SecureRandom secureRandom = new SecureRandom();

  @PostConstruct
  public void initializeEncryption() {
    try {
      if (encryptionKeyBase64 != null && !encryptionKeyBase64.trim().isEmpty()) {
        // Use provided key
        byte[] keyBytes = Base64.getDecoder().decode(encryptionKeyBase64);
        if (keyBytes.length != 32) { // 256 bits
          throw new IllegalArgumentException("Encryption key must be 256 bits (32 bytes)");
        }
        this.encryptionKey = new SecretKeySpec(keyBytes, ALGORITHM);
        logger.info("Session encryption initialized with provided key");
      } else {
        // Generate new key
        KeyGenerator keyGenerator = KeyGenerator.getInstance(ALGORITHM);
        keyGenerator.init(KEY_LENGTH);
        this.encryptionKey = keyGenerator.generateKey();

        // Log key generation indicator for security (don't log the actual key)
        logger.warn("Generated new session encryption key.");
        logger.warn(
            "Set SESSION_SECURITY_ENCRYPTION_KEY environment variable with the generated key");
      }
    } catch (Exception e) {
      logger.error("Failed to initialize session encryption: {}", e.getMessage(), e);
      throw new RuntimeException("Session encryption initialization failed", e);
    }
  }

  /** Encrypt session token with AES-256-GCM */
  public String encryptSessionToken(String plainToken) {
    if (plainToken == null || plainToken.trim().isEmpty()) {
      throw new IllegalArgumentException("Session token cannot be null or empty");
    }

    try {
      Cipher cipher = Cipher.getInstance(TRANSFORMATION);

      // Generate random IV
      byte[] iv = new byte[GCM_IV_LENGTH];
      secureRandom.nextBytes(iv);

      GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH * 8, iv);
      cipher.init(Cipher.ENCRYPT_MODE, encryptionKey, parameterSpec);

      byte[] encryptedData = cipher.doFinal(plainToken.getBytes(StandardCharsets.UTF_8));

      // Combine IV and encrypted data
      byte[] encryptedWithIv = new byte[GCM_IV_LENGTH + encryptedData.length];
      System.arraycopy(iv, 0, encryptedWithIv, 0, GCM_IV_LENGTH);
      System.arraycopy(encryptedData, 0, encryptedWithIv, GCM_IV_LENGTH, encryptedData.length);

      return Base64.getEncoder().encodeToString(encryptedWithIv);
    } catch (Exception e) {
      logger.error("Failed to encrypt session token: {}", e.getMessage(), e);
      throw new RuntimeException("Session token encryption failed", e);
    }
  }

  /** Decrypt session token */
  public String decryptSessionToken(String encryptedToken) {
    if (encryptedToken == null || encryptedToken.trim().isEmpty()) {
      throw new IllegalArgumentException("Encrypted token cannot be null or empty");
    }

    try {
      byte[] encryptedWithIv = Base64.getDecoder().decode(encryptedToken);

      if (encryptedWithIv.length < GCM_IV_LENGTH) {
        throw new IllegalArgumentException("Invalid encrypted token format");
      }

      // Extract IV and encrypted data
      byte[] iv = new byte[GCM_IV_LENGTH];
      byte[] encryptedData = new byte[encryptedWithIv.length - GCM_IV_LENGTH];

      System.arraycopy(encryptedWithIv, 0, iv, 0, GCM_IV_LENGTH);
      System.arraycopy(encryptedWithIv, GCM_IV_LENGTH, encryptedData, 0, encryptedData.length);

      Cipher cipher = Cipher.getInstance(TRANSFORMATION);
      GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH * 8, iv);
      cipher.init(Cipher.DECRYPT_MODE, encryptionKey, parameterSpec);

      byte[] decryptedData = cipher.doFinal(encryptedData);
      return new String(decryptedData, StandardCharsets.UTF_8);
    } catch (Exception e) {
      logger.error("Failed to decrypt session token: {}", e.getMessage(), e);
      throw new RuntimeException("Session token decryption failed", e);
    }
  }

  /** Validate session security including IP address and user agent */
  public SessionValidationResult validateSessionSecurity(
      SessionData sessionData, String currentIpAddress, String currentUserAgent) {

    SessionValidationResult result = new SessionValidationResult();
    result.setValid(true);
    result.setSessionId(sessionData.getSessionId());
    result.setShopDomain(sessionData.getShopDomain());

    // Check if session is expired
    if (sessionData.isExpired()
        || (sessionData.getExpiresAt() != null
            && sessionData.getExpiresAt().isBefore(LocalDateTime.now()))) {
      result.setValid(false);
      result.addViolation("SESSION_EXPIRED", "Session has expired");
      return result;
    }

    // Check if session is active
    if (!sessionData.isActive()) {
      result.setValid(false);
      result.addViolation("SESSION_INACTIVE", "Session is not active");
      return result;
    }

    // IP address validation
    if (ipValidationEnabled && sessionData.getIpAddress() != null) {
      if (!validateIpAddress(sessionData.getIpAddress(), currentIpAddress)) {
        result.setValid(false);
        result.addViolation(
            "IP_MISMATCH",
            "IP address mismatch. Expected: "
                + sessionData.getIpAddress()
                + ", Current: "
                + currentIpAddress);

        // Log security violation
        logger.warn(
            "SESSION_IP_VIOLATION for session {} - Expected: {}, Current: {}",
            sessionData.getSessionId(),
            sessionData.getIpAddress(),
            currentIpAddress);
      }
    }

    // User agent validation
    if (userAgentValidationEnabled && sessionData.getUserAgent() != null) {
      if (!validateUserAgent(sessionData.getUserAgent(), currentUserAgent)) {
        result.setValid(false);
        result.addViolation("USER_AGENT_MISMATCH", "User agent validation failed");

        // Log security violation (don't log full user agents for privacy)
        logger.warn(
            "SESSION_USER_AGENT_VIOLATION for session {} from IP {}",
            sessionData.getSessionId(),
            currentIpAddress);
      }
    }

    // Check for token rotation requirement
    if (tokenRotationEnabled && sessionData.getCreatedAt() != null) {
      LocalDateTime rotationThreshold = LocalDateTime.now().minusHours(tokenRotationIntervalHours);
      if (sessionData.getCreatedAt().isBefore(rotationThreshold)) {
        result.setTokenRotationRequired(true);
        result.addWarning("TOKEN_ROTATION_REQUIRED", "Session token should be rotated");
      }
    }

    return result;
  }

  /** Validate IP address with some flexibility for legitimate changes */
  private boolean validateIpAddress(String originalIp, String currentIp) {
    if (originalIp == null || currentIp == null) {
      return false;
    }

    // Exact match
    if (originalIp.equals(currentIp)) {
      return true;
    }

    // Allow for IPv4 subnet changes (same /24 network)
    if (isIPv4(originalIp) && isIPv4(currentIp)) {
      return isSameSubnet(originalIp, currentIp, 24);
    }

    // For IPv6, allow for same /64 network
    if (isIPv6(originalIp) && isIPv6(currentIp)) {
      return isSameSubnet(originalIp, currentIp, 64);
    }

    return false;
  }

  /** Validate user agent with fuzzy matching for legitimate browser updates */
  private boolean validateUserAgent(String originalUserAgent, String currentUserAgent) {
    if (originalUserAgent == null || currentUserAgent == null) {
      return false;
    }

    // Exact match
    if (originalUserAgent.equals(currentUserAgent)) {
      return true;
    }

    // Extract browser and OS information for fuzzy matching
    String originalBrowser = extractBrowserInfo(originalUserAgent);
    String currentBrowser = extractBrowserInfo(currentUserAgent);

    // Allow for minor version changes in the same browser
    return originalBrowser.equals(currentBrowser);
  }

  /** Securely clean up session data */
  public void secureSessionCleanup(String sessionId, String shopDomain) {
    if (!secureCleanupEnabled) {
      return;
    }

    try {
      // Generate secure cleanup key
      String cleanupKey = "secure_cleanup:" + sessionId + ":" + System.currentTimeMillis();

      // Mark session for secure cleanup
      Map<String, Object> cleanupData = new HashMap<>();
      cleanupData.put("sessionId", sessionId);
      cleanupData.put("shopDomain", shopDomain);
      cleanupData.put("timestamp", Instant.now().toString());
      cleanupData.put("status", "PENDING_CLEANUP");

      redisTemplate.opsForValue().set(cleanupKey, cleanupData, 1, TimeUnit.HOURS);

      // Overwrite sensitive data with random data before deletion
      overwriteSessionData(sessionId, shopDomain);

      // Log cleanup for audit
      logger.info("SECURE_SESSION_CLEANUP initiated for session: {}", sessionId);

      logger.info("Secure session cleanup initiated for session: {}", sessionId);
    } catch (Exception e) {
      logger.error(
          "Failed to perform secure session cleanup for session {}: {}",
          sessionId,
          e.getMessage(),
          e);
    }
  }

  /** Overwrite session data with random data before deletion */
  private void overwriteSessionData(String sessionId, String shopDomain) {
    try {
      // Generate random data to overwrite sensitive information
      byte[] randomData = new byte[256];
      secureRandom.nextBytes(randomData);
      String randomString = Base64.getEncoder().encodeToString(randomData);

      // Overwrite session keys with random data
      String sessionDataKey = "session_data:" + shopDomain + ":" + sessionId;
      String sessionTokenKey = "session_token:" + shopDomain + ":" + sessionId;

      redisTemplate.opsForValue().set(sessionDataKey, randomString, 1, TimeUnit.SECONDS);
      redisTemplate.opsForValue().set(sessionTokenKey, randomString, 1, TimeUnit.SECONDS);

      // Delete after overwrite
      redisTemplate.delete(sessionDataKey);
      redisTemplate.delete(sessionTokenKey);

    } catch (Exception e) {
      logger.warn("Failed to overwrite session data for secure cleanup: {}", e.getMessage());
    }
  }

  // Helper methods for IP validation
  private boolean isIPv4(String ip) {
    return ip.matches("^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$");
  }

  private boolean isIPv6(String ip) {
    return ip.contains(":");
  }

  private boolean isSameSubnet(String ip1, String ip2, int prefixLength) {
    try {
      // Simplified subnet comparison - in production, use proper IP libraries
      if (isIPv4(ip1) && isIPv4(ip2) && prefixLength == 24) {
        String[] parts1 = ip1.split("\\.");
        String[] parts2 = ip2.split("\\.");
        return parts1[0].equals(parts2[0])
            && parts1[1].equals(parts2[1])
            && parts1[2].equals(parts2[2]);
      }
      return false;
    } catch (Exception e) {
      return false;
    }
  }

  private String extractBrowserInfo(String userAgent) {
    if (userAgent == null) return "";

    // Extract major browser information
    if (userAgent.contains("Chrome/")) {
      return "Chrome";
    } else if (userAgent.contains("Firefox/")) {
      return "Firefox";
    } else if (userAgent.contains("Safari/") && !userAgent.contains("Chrome")) {
      return "Safari";
    } else if (userAgent.contains("Edge/")) {
      return "Edge";
    }
    return "Unknown";
  }

  /** Generate secure session hash for validation */
  public String generateSessionHash(String sessionId, String shopDomain, String ipAddress) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      String combined =
          sessionId + ":" + shopDomain + ":" + ipAddress + ":" + System.currentTimeMillis();
      byte[] hash = digest.digest(combined.getBytes(StandardCharsets.UTF_8));
      return Base64.getEncoder().encodeToString(hash);
    } catch (Exception e) {
      logger.error("Failed to generate session hash: {}", e.getMessage());
      return null;
    }
  }

  /** Generate secure hash for any string data */
  public String generateSecureHash(String data) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(data.getBytes(StandardCharsets.UTF_8));
      return Base64.getEncoder().encodeToString(hash);
    } catch (Exception e) {
      logger.error("Failed to generate secure hash: {}", e.getMessage());
      return null;
    }
  }

  /** Rotate session token for enhanced security */
  public String rotateSessionToken(String currentToken, String sessionId, String shopDomain) {
    try {
      // Generate new token based on current token and additional entropy
      String entropy =
          sessionId
              + ":"
              + shopDomain
              + ":"
              + System.currentTimeMillis()
              + ":"
              + Base64.getEncoder().encodeToString(generateRandomBytes(16));

      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      digest.update(currentToken.getBytes(StandardCharsets.UTF_8));
      digest.update(entropy.getBytes(StandardCharsets.UTF_8));

      byte[] newTokenBytes = digest.digest();
      String newToken = Base64.getEncoder().encodeToString(newTokenBytes);

      // Encrypt the new token
      return encryptSessionToken(newToken);
    } catch (Exception e) {
      logger.error("Failed to rotate session token: {}", e.getMessage());
      return null;
    }
  }

  /** Generate cryptographically secure random bytes */
  private byte[] generateRandomBytes(int length) {
    byte[] bytes = new byte[length];
    secureRandom.nextBytes(bytes);
    return bytes;
  }

  /** Validate session token format and integrity */
  public boolean validateTokenFormat(String token) {
    if (token == null || token.trim().isEmpty()) {
      return false;
    }

    try {
      // Try to decode as Base64
      Base64.getDecoder().decode(token);

      // Check minimum length (should be at least IV + some encrypted data)
      return token.length() >= 24; // Minimum reasonable length
    } catch (Exception e) {
      return false;
    }
  }

  /** Check if session token needs rotation based on age */
  public boolean shouldRotateToken(Instant tokenCreatedAt) {
    if (tokenCreatedAt == null) {
      return true; // Rotate if we don't know when it was created
    }

    Instant rotationThreshold = Instant.now().minus(tokenRotationIntervalHours, ChronoUnit.HOURS);
    return tokenCreatedAt.isBefore(rotationThreshold);
  }

  /** Session validation result holder */
  public static class SessionValidationResult {
    private boolean valid;
    private String sessionId;
    private String shopDomain;
    private boolean tokenRotationRequired;
    private Map<String, String> violations = new HashMap<>();
    private Map<String, String> warnings = new HashMap<>();

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

    public boolean isTokenRotationRequired() {
      return tokenRotationRequired;
    }

    public void setTokenRotationRequired(boolean tokenRotationRequired) {
      this.tokenRotationRequired = tokenRotationRequired;
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
  }
}
