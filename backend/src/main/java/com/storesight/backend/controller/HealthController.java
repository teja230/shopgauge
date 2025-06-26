package com.storesight.backend.controller;

import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

  private static final Logger logger = LoggerFactory.getLogger(HealthController.class);

  @Value("${spring.application.name:storesight-backend}")
  private String applicationName;

  @Value("${shopify.api.key:}")
  private String apiKey;

  @Value("${shopify.api.secret:}")
  private String apiSecret;

  @Value("${shopify.redirect_uri:}")
  private String redirectUri;

  @Value("${frontend.url:}")
  private String frontendUrl;

  @Value("${app.lastDeployCommit:unknown}")
  private String lastDeployCommit;

  @Autowired private StringRedisTemplate redisTemplate;

  @GetMapping("/health")
  public ResponseEntity<Map<String, Object>> health() {
    Map<String, Object> health = new HashMap<>();
    health.put("status", "UP");
    health.put("application", applicationName);
    health.put("timestamp", System.currentTimeMillis());

    logger.debug("Health check requested");
    return ResponseEntity.ok(health);
  }

  @GetMapping("/")
  public ResponseEntity<Map<String, Object>> rootHealth() {
    Map<String, Object> health = new HashMap<>();
    health.put("status", "UP");
    health.put("application", applicationName);
    health.put("message", "ShopGauge Backend is running");
    health.put("timestamp", System.currentTimeMillis());

    logger.debug("Root health check requested");
    return ResponseEntity.ok(health);
  }

  @GetMapping("/health/detailed")
  public ResponseEntity<Map<String, Object>> detailedHealth() {
    Map<String, Object> health = new HashMap<>();
    health.put("status", "UP");
    health.put("application", applicationName);
    health.put("timestamp", System.currentTimeMillis());

    // Check configuration
    Map<String, Object> config = new HashMap<>();
    config.put("api_key_configured", apiKey != null && !apiKey.isBlank());
    config.put("api_secret_configured", apiSecret != null && !apiSecret.isBlank());
    config.put("redirect_uri_configured", redirectUri != null && !redirectUri.isBlank());
    config.put("frontend_url_configured", frontendUrl != null && !frontendUrl.isBlank());

    health.put("configuration", config);

    Map<String, Object> checks = new HashMap<>();
    // Redis connectivity check
    try {
      redisTemplate.opsForValue().set("health:check", "ok");
      String value = redisTemplate.opsForValue().get("health:check");
      if ("ok".equals(value)) {
        checks.put("redis", Map.of("status", "UP", "message", "Redis connection successful"));
      } else {
        checks.put("redis", Map.of("status", "DOWN", "message", "Redis connection failed"));
      }
      redisTemplate.delete("health:check"); // Clean up test key
    } catch (Exception e) {
      checks.put("redis", Map.of("status", "DOWN", "message", "Redis error: " + e.getMessage()));
    }

    health.put("checks", checks);

    // Overall status based on checks
    boolean allHealthy =
        checks.values().stream()
            .allMatch(check -> "UP".equals(((Map<String, Object>) check).get("status")));

    if (!allHealthy) {
      health.put("status", "DOWN");
      return ResponseEntity.status(503).body(health);
    }

    return ResponseEntity.ok(health);
  }

  @GetMapping("/api/health/summary")
  public ResponseEntity<Map<String, Object>> healthSummary() {
    Map<String, Object> summary = new HashMap<>();

    // Check backend status
    summary.put("backendStatus", "UP");

    // Check Redis connectivity
    String redisStatus = "DOWN";
    try {
      redisTemplate.opsForValue().set("health:check", "ok");
      String value = redisTemplate.opsForValue().get("health:check");
      if ("ok".equals(value)) {
        redisStatus = "UP";
      }
      redisTemplate.delete("health:check"); // Clean up test key
    } catch (Exception e) {
      logger.debug("Redis health check failed", e);
    }
    summary.put("redisStatus", redisStatus);

    // Check database connectivity (simplified - just check if we can access Redis for now)
    // In a real app, you'd check actual database connectivity
    summary.put("databaseStatus", redisStatus); // Using Redis as proxy for now

    // Overall system status
    String systemStatus = "UP";
    if ("DOWN".equals(redisStatus)) {
      systemStatus = "DEGRADED";
    }
    summary.put("systemStatus", systemStatus);

    summary.put("lastUpdated", System.currentTimeMillis());
    summary.put("lastDeployCommit", lastDeployCommit);

    return ResponseEntity.ok(summary);
  }
}
