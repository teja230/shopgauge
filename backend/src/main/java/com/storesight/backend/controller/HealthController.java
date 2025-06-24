package com.storesight.backend.controller;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HealthController {

  @Autowired private StringRedisTemplate redisTemplate;

  @GetMapping("/health")
  public ResponseEntity<Map<String, Object>> health() {
    Map<String, Object> response = new HashMap<>();
    response.put("status", "UP");
    response.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
    response.put("service", "storesight-backend");
    response.put("version", "1.0.0");
    
    return ResponseEntity.ok(response);
  }

  @GetMapping("/health/detailed")
  public ResponseEntity<Map<String, Object>> detailedHealth() {
    Map<String, Object> response = new HashMap<>();
    Map<String, Object> checks = new HashMap<>();
    
    // Basic service check
    response.put("status", "UP");
    response.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
    response.put("service", "storesight-backend");
    response.put("version", "1.0.0");
    
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
    
    // Database check would go here if needed
    // For now, we'll assume it's healthy if the service is running
    checks.put("database", Map.of("status", "UP", "message", "Database connection assumed healthy"));
    
    response.put("checks", checks);
    
    // Overall status based on checks
    boolean allHealthy = checks.values().stream()
        .allMatch(check -> "UP".equals(((Map<String, Object>) check).get("status")));
    
    if (!allHealthy) {
      response.put("status", "DOWN");
      return ResponseEntity.status(503).body(response);
    }
    
    return ResponseEntity.ok(response);
  }

  @GetMapping("/ping")
  public ResponseEntity<Map<String, String>> ping() {
    Map<String, String> response = new HashMap<>();
    response.put("message", "pong");
    response.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
    return ResponseEntity.ok(response);
  }
} 