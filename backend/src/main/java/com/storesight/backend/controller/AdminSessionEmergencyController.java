package com.storesight.backend.controller;

import com.storesight.backend.service.DataPrivacyService;
import java.time.Instant;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin-refactor/emergency")
public class AdminSessionEmergencyController {

  private static final Logger logger =
      LoggerFactory.getLogger(AdminSessionEmergencyController.class);

  @Autowired private RedisTemplate<String, Object> redisTemplate;
  @Autowired private DataPrivacyService dataPrivacyService;

  @PostMapping("/invalidate-session")
  public ResponseEntity<Map<String, Object>> invalidateSession(@RequestParam String sessionId) {
    try {
      boolean deleted =
          Boolean.TRUE.equals(redisTemplate.delete("spring:session:sessions:" + sessionId));
      Map<String, Object> response = new HashMap<>();
      response.put("sessionId", sessionId);
      response.put("deleted", deleted);
      response.put("timestamp", Instant.now().toString());
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to invalidate session", "message", e.getMessage()));
    }
  }

  @GetMapping("/redis-keys")
  public ResponseEntity<Map<String, Object>> listRedisKeys(
      @RequestParam(defaultValue = "1000") int limit) {
    Map<String, Object> result = new HashMap<>();
    List<Map<String, Object>> keys = new ArrayList<>();
    try (Cursor<byte[]> cursor =
        (Cursor<byte[]>)
            redisTemplate
                .getConnectionFactory()
                .getConnection()
                .scan(ScanOptions.scanOptions().count(1000).match("*").build())) {
      int count = 0;
      while (cursor.hasNext() && count < limit) {
        String key = new String(cursor.next());
        Map<String, Object> entry = new HashMap<>();
        entry.put("key", key);
        entry.put("type", getSessionKeyType(key));
        entry.put("shopDomain", extractShopDomainFromKey(key));
        keys.add(entry);
        count++;
      }
      result.put("count", keys.size());
      result.put("keys", keys);
      return ResponseEntity.ok(result);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to list redis keys", "message", e.getMessage()));
    }
  }

  @PostMapping("/kill-all-shop-sessions")
  public ResponseEntity<Map<String, Object>> killAllShopSessions(@RequestParam String shopDomain) {
    try {
      int deleted = 0;
      try (Cursor<byte[]> cursor =
          (Cursor<byte[]>)
              redisTemplate
                  .getConnectionFactory()
                  .getConnection()
                  .scan(
                      ScanOptions.scanOptions()
                          .count(1000)
                          .match("*" + shopDomain + "*")
                          .build())) {
        while (cursor.hasNext()) {
          String key = new String(cursor.next());
          if (key.contains("spring:session:sessions:")) {
            redisTemplate.delete(key);
            deleted++;
          }
        }
      }
      return ResponseEntity.ok(Map.of("shopDomain", shopDomain, "deleted", deleted));
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to kill shop sessions", "message", e.getMessage()));
    }
  }

  @PostMapping("/deny-shop")
  public ResponseEntity<Map<String, Object>> denyShop(@RequestParam String shopDomain) {
    try {
      String key = "session:shop:deny:" + shopDomain.toLowerCase();
      redisTemplate.opsForValue().set(key, "1");
      return ResponseEntity.ok(Map.of("shopDomain", shopDomain, "denied", true));
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to deny shop", "message", e.getMessage()));
    }
  }

  @PostMapping("/allow-shop")
  public ResponseEntity<Map<String, Object>> allowShop(@RequestParam String shopDomain) {
    try {
      String key = "session:shop:deny:" + shopDomain.toLowerCase();
      redisTemplate.delete(key);
      return ResponseEntity.ok(Map.of("shopDomain", shopDomain, "denied", false));
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to allow shop", "message", e.getMessage()));
    }
  }

  private String extractShopDomainFromKey(String key) {
    try {
      if (key.contains("shopify_domain:")) {
        String suffix = key.substring(key.indexOf("shopify_domain:") + "shopify_domain:".length());
        return suffix.split("\\s")[0];
      }
      return null;
    } catch (Exception e) {
      logger.warn("Error extracting shop domain from key {}: {}", key, e.getMessage());
      return null;
    }
  }

  private String getSessionKeyType(String key) {
    if (key.contains("shop_token:")) return "session_token";
    if (key.contains("invalid_session:")) return "invalid_marker";
    if (key.contains("validation_failure_count:")) return "failure_count";
    if (key.contains("session_invalidation:")) return "invalidation_marker";
    if (key.contains("session_state:")) return "state_marker";
    if (key.contains("session_lock:")) return "lock_marker";
    if (key.contains("session:shop:deny:")) return "shop_deny_marker";
    return "unknown";
  }
}
