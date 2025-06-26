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

    // In a real production setup these metrics would be provided by your metrics/observability
    // stack
    // For now we calculate simple placeholders so that the UI has something meaningful to display.
    // TODO Replace placeholder logic with real metrics aggregation once Prometheus / Micrometer
    // data is wired up.

    long p95LatencyMs = 0;
    double errorRate = 0.0;
    long queueDepth = 0;

    try {
      // Example: Attempt to fetch pre-computed metrics from Redis if they exist
      String latency = redisTemplate.opsForValue().get("metrics:http:p95_latency_ms");
      if (latency != null) {
        p95LatencyMs = Long.parseLong(latency);
      }
      String err = redisTemplate.opsForValue().get("metrics:http:error_rate");
      if (err != null) {
        errorRate = Double.parseDouble(err);
      }
      String queue = redisTemplate.opsForValue().get("metrics:worker:queue_depth");
      if (queue != null) {
        queueDepth = Long.parseLong(queue);
      }
    } catch (Exception e) {
      logger.debug("Unable to read metrics from redis – falling back to defaults", e);
    }

    summary.put("p95LatencyMs", p95LatencyMs);
    summary.put("errorRate", errorRate);
    summary.put("queueDepth", queueDepth);
    summary.put("lastDeployCommit", lastDeployCommit);
    summary.put("timestamp", System.currentTimeMillis());

    return ResponseEntity.ok(summary);
  }
}
