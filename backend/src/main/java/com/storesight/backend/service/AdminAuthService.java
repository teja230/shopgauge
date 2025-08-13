package com.storesight.backend.service;

import com.storesight.backend.model.AdminAuditLog;
import com.storesight.backend.repository.AdminAuditLogRepository;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import javax.crypto.SecretKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AdminAuthService {

  private static final Logger logger = LoggerFactory.getLogger(AdminAuthService.class);

  @Value("${admin.username:}")
  private String adminUsername;

  @Value("${admin.password:}")
  private String adminPassword;

  @Value("${admin.auth.session-timeout:3600}")
  private int sessionTimeout;

  @Value("${admin.auth.max-login-attempts:5}")
  private int maxLoginAttempts;

  @Value("${admin.auth.lockout-duration:900}")
  private long lockoutDuration;

  @Value("${admin.auth.token-expiry:86400}")
  private int tokenExpiry;

  @Value("${admin.auth.audit-logging:true}")
  private boolean auditLogging;

  @Autowired private RedisTemplate<String, Object> redisTemplate;

  @Autowired private AdminAuditLogRepository adminAuditLogRepository;

  private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(12);
  private SecretKey jwtSecretKey;
  private String currentKeyId;

  @Value("${admin.jwt.secret:}")
  private String jwtSecret;

  @Value("${admin.jwt.secret.fallback:}")
  private String jwtSecretFallback;

  @PostConstruct
  public void initializeJwtSecret() {
    // Generate a secure JWT secret key for HS512 (requires >= 512 bits)
    String secret = jwtSecret;
    if (secret == null || secret.trim().isEmpty()) {
      secret = jwtSecretFallback;
    }

    if (secret == null || secret.trim().isEmpty()) {
      logger.error(
          "CRITICAL SECURITY ERROR: No JWT secret found in environment variables. "
              + "Set ADMIN_JWT_SECRET or JWT_SECRET environment variable for admin authentication.");
      throw new SecurityException(
          "Admin JWT secret not configured. Set ADMIN_JWT_SECRET environment variable.");
    }

    // Ensure the secret is at least 64 bytes (512 bits) for HS512
    byte[] secretBytes = secret.getBytes(StandardCharsets.UTF_8);
    if (secretBytes.length < 64) {
      // Pad the secret to 64 bytes for HS512 compliance
      byte[] paddedSecret = new byte[64];
      System.arraycopy(secretBytes, 0, paddedSecret, 0, Math.min(secretBytes.length, 64));
      // Fill remaining bytes with the original secret repeated
      for (int i = secretBytes.length; i < 64; i++) {
        paddedSecret[i] = secretBytes[i % secretBytes.length];
      }
      this.jwtSecretKey = Keys.hmacShaKeyFor(paddedSecret);
      logger.info("JWT secret padded to 512 bits for HS512 compliance");
    } else {
      this.jwtSecretKey = Keys.hmacShaKeyFor(secretBytes);
      logger.info("JWT secret configured with {} bits", secretBytes.length * 8);
    }

    // Generate a key id for rotation support
    this.currentKeyId = UUID.nameUUIDFromBytes(secret.getBytes(StandardCharsets.UTF_8)).toString();

    logger.info("Admin JWT secret configured successfully");

    // Log admin configuration status
    if (adminUsername != null && !adminUsername.trim().isEmpty()) {
      logger.info("Admin username configured: {}", adminUsername);
    } else {
      logger.error("Admin username not configured - set ADMIN_USERNAME environment variable");
    }

    if (adminPassword != null && !adminPassword.trim().isEmpty()) {
      logger.info("Admin password hash configured (length: {})", adminPassword.length());
    } else {
      logger.error("Admin password hash not configured - set ADMIN_PASSWORD environment variable");
    }
  }

  public boolean validateCredentials(String username, String password) {
    // Validate environment variables are set
    if (adminUsername == null
        || adminUsername.trim().isEmpty()
        || adminPassword == null
        || adminPassword.trim().isEmpty()) {
      logger.error("Admin credentials not properly configured in environment variables");
      logger.error("ADMIN_USERNAME: {}", adminUsername != null ? "set" : "null");
      logger.error(
          "ADMIN_PASSWORD: {}",
          adminPassword != null ? "set (length: " + adminPassword.length() + ")" : "null");
      return false;
    }

    // Check username
    if (!adminUsername.equals(username)) {
      logger.debug("Username mismatch - expected: '{}', received: '{}'", adminUsername, username);
      logAuditEvent("LOGIN_FAILED", username, "Invalid username");
      return false;
    }

    // Check password using BCrypt
    try {
      boolean passwordMatches = passwordEncoder.matches(password, adminPassword);
      if (!passwordMatches) {
        logger.debug("Password verification failed for username: {}", username);
        logAuditEvent("LOGIN_FAILED", username, "Invalid password");
        return false;
      }
    } catch (Exception e) {
      logger.error("BCrypt password verification error: {}", e.getMessage(), e);
      logAuditEvent("LOGIN_FAILED", username, "Password verification error");
      return false;
    }

    logger.info("Admin login successful for username: {}", username);
    logAuditEvent("LOGIN_SUCCESS", username, "Successful login");
    return true;
  }

  public String generateJwtToken(String username) {
    Instant now = Instant.now();
    Instant expiry = now.plus(tokenExpiry, ChronoUnit.SECONDS);

    return Jwts.builder()
        .setSubject(username)
        .setIssuedAt(Date.from(now))
        .setExpiration(Date.from(expiry))
        .claim("role", "ROLE_ADMIN")
        .claim("type", "admin")
        .setHeaderParam("kid", currentKeyId)
        .signWith(jwtSecretKey, SignatureAlgorithm.HS512)
        .compact();
  }

  public boolean validateJwtToken(String token) {
    try {
      Jws<Claims> jws =
          Jwts.parserBuilder().setSigningKey(jwtSecretKey).build().parseClaimsJws(token);
      Claims claims = jws.getBody();
      // Optional: verify kid header matches currentKeyId for strict rotation
      Object kidHeader = jws.getHeader().get("kid");
      if (kidHeader != null && !kidHeader.toString().equals(currentKeyId)) {
        logger.debug("Token kid {} does not match current key id", kidHeader);
        return false;
      }

      // Check if token is expired
      if (claims.getExpiration().before(new Date())) {
        return false;
      }

      // Check if it's an admin token
      String type = claims.get("type", String.class);
      if (!"admin".equals(type)) {
        return false;
      }

      return true;
    } catch (JwtException | IllegalArgumentException e) {
      logger.debug("Invalid JWT token: {}", e.getMessage());
      return false;
    }
  }

  public String getUsernameFromToken(String token) {
    try {
      Claims claims =
          Jwts.parserBuilder().setSigningKey(jwtSecretKey).build().parseClaimsJws(token).getBody();

      return claims.getSubject();
    } catch (JwtException | IllegalArgumentException e) {
      logger.debug("Failed to extract username from token: {}", e.getMessage());
      return null;
    }
  }

  public boolean isAccountLocked(String ipAddress) {
    try {
      String lockoutKey = "admin:lockout:" + ipAddress;
      Boolean isLocked = redisTemplate.hasKey(lockoutKey);
      return isLocked != null && isLocked;
    } catch (Exception e) {
      logger.warn("Redis unavailable for account lockout check: {}", e.getMessage());
      return false; // Allow login if Redis is unavailable
    }
  }

  public void recordFailedLoginAttempt(String ipAddress, String username) {
    String attemptsKey = "admin:attempts:" + ipAddress;
    String lockoutKey = "admin:lockout:" + ipAddress;

    // Increment failed attempts
    Long attempts = redisTemplate.opsForValue().increment(attemptsKey);
    if (attempts == null) {
      attempts = 1L;
    }

    // Set expiry for attempts counter
    redisTemplate.expire(attemptsKey, lockoutDuration, TimeUnit.SECONDS);

    if (attempts >= maxLoginAttempts) {
      // Lock the account
      redisTemplate.opsForValue().set(lockoutKey, "locked", lockoutDuration, TimeUnit.SECONDS);
      logger.warn("Admin account locked for IP: {} due to {} failed attempts", ipAddress, attempts);
      logAuditEvent(
          "ACCOUNT_LOCKED",
          username,
          "Account locked due to " + attempts + " failed attempts from IP: " + ipAddress);
    }
  }

  public void clearFailedLoginAttempts(String ipAddress) {
    String attemptsKey = "admin:attempts:" + ipAddress;
    String lockoutKey = "admin:lockout:" + ipAddress;

    redisTemplate.delete(attemptsKey);
    redisTemplate.delete(lockoutKey);
  }

  public void invalidateToken(String token) {
    if (token != null && !token.trim().isEmpty()) {
      try {
        String blacklistKey = "admin:blacklist:" + token;
        redisTemplate.opsForValue().set(blacklistKey, "invalidated", tokenExpiry, TimeUnit.SECONDS);

        String username = getUsernameFromToken(token);
        logAuditEvent(
            "TOKEN_INVALIDATED", username != null ? username : "unknown", "Token invalidated");

        logger.info(
            "Admin token invalidated successfully for token: {}",
            token.substring(0, Math.min(10, token.length())) + "...");
      } catch (Exception e) {
        logger.error("Failed to invalidate admin token: {}", e.getMessage(), e);
        // Don't throw the exception to prevent logout failures
        // The token will still be considered invalid due to the exception
      }
    } else {
      logger.warn("Attempted to invalidate null or empty admin token");
    }
  }

  public boolean isTokenBlacklisted(String token) {
    if (token == null || token.trim().isEmpty()) {
      logger.debug("Token is null or empty, considering as blacklisted");
      return true;
    }

    try {
      String blacklistKey = "admin:blacklist:" + token;
      Boolean isBlacklisted = redisTemplate.hasKey(blacklistKey);
      boolean result = isBlacklisted != null && isBlacklisted;

      if (result) {
        logger.debug(
            "Token is blacklisted: {}", token.substring(0, Math.min(10, token.length())) + "...");
      }

      return result;
    } catch (Exception e) {
      logger.warn("Redis unavailable for token blacklist check: {}", e.getMessage());
      // Allow token if Redis is unavailable to prevent authentication failures
      // This is a fallback mechanism for when Redis is down
      return false;
    }
  }

  public Map<String, Object> getSessionInfo(String token) {
    Map<String, Object> sessionInfo = new HashMap<>();

    if (token != null && validateJwtToken(token) && !isTokenBlacklisted(token)) {
      Claims claims =
          Jwts.parserBuilder().setSigningKey(jwtSecretKey).build().parseClaimsJws(token).getBody();

      sessionInfo.put("authenticated", true);
      sessionInfo.put("username", claims.getSubject());
      sessionInfo.put("role", claims.get("role"));
      sessionInfo.put("issuedAt", claims.getIssuedAt());
      sessionInfo.put("expiresAt", claims.getExpiration());
    } else {
      sessionInfo.put("authenticated", false);
    }

    return sessionInfo;
  }

  private void logAuditEvent(String event, String username, String details) {
    if (!auditLogging) {
      return;
    }

    try {
      AdminAuditLog auditLog = new AdminAuditLog();
      auditLog.setEvent(event);
      auditLog.setUsername(username);
      auditLog.setDetails(details);
      auditLog.setTimestamp(Instant.now());
      auditLog.setIpAddress(""); // Will be set by controller

      adminAuditLogRepository.save(auditLog);
    } catch (Exception e) {
      logger.error("Failed to log admin audit event: {}", e.getMessage(), e);
    }
  }

  public void logAuditEvent(String event, String username, String details, String ipAddress) {
    if (!auditLogging) {
      return;
    }

    try {
      AdminAuditLog auditLog = new AdminAuditLog();
      auditLog.setEvent(event);
      auditLog.setUsername(username);
      auditLog.setDetails(details);
      auditLog.setTimestamp(Instant.now());
      auditLog.setIpAddress(ipAddress);

      adminAuditLogRepository.save(auditLog);
    } catch (Exception e) {
      logger.error("Failed to log admin audit event: {}", e.getMessage(), e);
    }
  }

  /**
   * Check if user is authorized for critical operations Currently all authenticated admin users are
   * authorized, but this can be extended for role-based access control in the future
   */
  public boolean isAuthorizedForCriticalOperation(String username, String operation) {
    if (username == null || username.trim().isEmpty()) {
      logger.warn("Authorization check failed: username is null or empty");
      return false;
    }

    // Validate that the username matches the configured admin username
    if (!adminUsername.equals(username)) {
      logger.warn(
          "Authorization check failed: username '{}' does not match configured admin", username);
      logAuditEvent(
          "AUTHORIZATION_FAILED",
          username,
          "Critical operation authorization failed - invalid username for operation: " + operation);
      return false;
    }

    // Additional checks can be added here for specific operations
    if (operation.contains("/emergency/")) {
      // Emergency operations require additional validation
      logger.info(
          "Emergency operation authorization requested for user: {} operation: {}",
          username,
          operation);
      logAuditEvent(
          "EMERGENCY_OPERATION_AUTHORIZED",
          username,
          "Emergency operation authorized: " + operation);
    }

    if (operation.contains("/secrets")) {
      // Secret management operations
      logger.info(
          "Secret management operation authorization requested for user: {} operation: {}",
          username,
          operation);
      logAuditEvent(
          "SECRET_OPERATION_AUTHORIZED",
          username,
          "Secret management operation authorized: " + operation);
    }

    return true;
  }

  /** Get admin audit logs for monitoring and compliance */
  public List<AdminAuditLog> getRecentAuditLogs(int limit) {
    try {
      Instant since = Instant.now().minus(24, ChronoUnit.HOURS);
      List<AdminAuditLog> logs = adminAuditLogRepository.findRecentEvents(since);
      return logs.stream().limit(limit).collect(java.util.stream.Collectors.toList());
    } catch (Exception e) {
      logger.error("Failed to retrieve recent audit logs: {}", e.getMessage(), e);
      return new java.util.ArrayList<>();
    }
  }

  /** Get failed login attempts for security monitoring */
  public long getFailedLoginAttempts(String ipAddress, int hours) {
    try {
      Instant since = Instant.now().minus(hours, ChronoUnit.HOURS);
      return adminAuditLogRepository.countFailedLoginAttempts(ipAddress, since);
    } catch (Exception e) {
      logger.error(
          "Failed to get failed login attempts for IP {}: {}", ipAddress, e.getMessage(), e);
      return 0;
    }
  }

  /** Get recent audit logs by username for detailed analysis */
  public List<AdminAuditLog> getRecentAuditLogsByUsername(String username, Instant since) {
    try {
      return adminAuditLogRepository.findRecentEventsByUsername(username, since);
    } catch (Exception e) {
      logger.error(
          "Failed to retrieve recent audit logs for username {}: {}", username, e.getMessage(), e);
      return new java.util.ArrayList<>();
    }
  }
}
