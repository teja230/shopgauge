package com.storesight.backend.service;

import com.storesight.backend.model.AdminAuditLog;
import com.storesight.backend.repository.AdminAuditLogRepository;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
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

  @Value("${ADMIN_USERNAME:}")
  private String adminUsername;

  @Value("${ADMIN_PASSWORD:}")
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
  private final SecretKey jwtSecretKey;

  public AdminAuthService() {
    // Generate a secure JWT secret key
    String secret = System.getenv("JWT_SECRET");
    if (secret == null || secret.trim().isEmpty()) {
      secret = System.getenv("ADMIN_JWT_SECRET");
    }
    if (secret == null || secret.trim().isEmpty()) {
      logger.error(
          "CRITICAL SECURITY ERROR: No JWT secret found in environment variables. "
              + "Set ADMIN_JWT_SECRET or JWT_SECRET environment variable for admin authentication.");
      throw new SecurityException(
          "Admin JWT secret not configured. Set ADMIN_JWT_SECRET environment variable.");
    }
    this.jwtSecretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    logger.info("Admin JWT secret configured successfully");
  }

  public boolean validateCredentials(String username, String password) {
    // Validate environment variables are set
    if (adminUsername == null
        || adminUsername.trim().isEmpty()
        || adminPassword == null
        || adminPassword.trim().isEmpty()) {
      logger.error("Admin credentials not properly configured in environment variables");
      return false;
    }

    // Check username
    if (!adminUsername.equals(username)) {
      logAuditEvent("LOGIN_FAILED", username, "Invalid username");
      return false;
    }

    // Check password using BCrypt
    if (!passwordEncoder.matches(password, adminPassword)) {
      logAuditEvent("LOGIN_FAILED", username, "Invalid password");
      return false;
    }

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
        .signWith(jwtSecretKey, SignatureAlgorithm.HS512)
        .compact();
  }

  public boolean validateJwtToken(String token) {
    try {
      Claims claims =
          Jwts.parserBuilder().setSigningKey(jwtSecretKey).build().parseClaimsJws(token).getBody();

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
    String lockoutKey = "admin:lockout:" + ipAddress;
    Boolean isLocked = redisTemplate.hasKey(lockoutKey);
    return isLocked != null && isLocked;
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
      String blacklistKey = "admin:blacklist:" + token;
      redisTemplate.opsForValue().set(blacklistKey, "invalidated", tokenExpiry, TimeUnit.SECONDS);
      logAuditEvent("TOKEN_INVALIDATED", getUsernameFromToken(token), "Token invalidated");
    }
  }

  public boolean isTokenBlacklisted(String token) {
    if (token == null || token.trim().isEmpty()) {
      return true;
    }

    String blacklistKey = "admin:blacklist:" + token;
    Boolean isBlacklisted = redisTemplate.hasKey(blacklistKey);
    return isBlacklisted != null && isBlacklisted;
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
}
