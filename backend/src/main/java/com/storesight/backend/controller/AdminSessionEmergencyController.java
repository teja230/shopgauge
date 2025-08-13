package com.storesight.backend.controller;

import com.storesight.backend.service.EnhancedRedisService;
import com.storesight.backend.service.ShopService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin-refactor/sessions")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSessionEmergencyController {
  private static final Logger logger =
      LoggerFactory.getLogger(AdminSessionEmergencyController.class);

  private final EnhancedRedisService enhancedRedisService;
  private final RedisTemplate<String, String> redisTemplate;
  private final ShopService shopService;

  @Autowired
  public AdminSessionEmergencyController(
      EnhancedRedisService enhancedRedisService,
      RedisTemplate<String, String> redisTemplate,
      ShopService shopService) {
    this.enhancedRedisService = enhancedRedisService;
    this.redisTemplate = redisTemplate;
    this.shopService = shopService;
  }

  @GetMapping("/stuck-sessions/{shopDomain}")
  public ResponseEntity<Map<String, Object>> getStuckSessions(@PathVariable String shopDomain) {
    Map<String, Object> result = new HashMap<>();
    try {
      logger.warn("ADMIN: Getting stuck sessions for shop: {}", shopDomain);
      Set<String> sessionKeys = enhancedRedisService.scanKeys("*" + shopDomain + "*");
      List<Map<String, Object>> stuckSessions = new ArrayList<>();
      if (sessionKeys != null) {
        for (String key : sessionKeys) {
          try {
            String value = redisTemplate.opsForValue().get(key);
            if (value != null
                && (value.contains("invalid")
                    || value.contains("stuck")
                    || value.contains("cleanup"))) {
              Map<String, Object> sessionInfo = new HashMap<>();
              sessionInfo.put("key", key);
              sessionInfo.put("value", value);
              sessionInfo.put("type", getSessionKeyType(key));
              stuckSessions.add(sessionInfo);
            }
          } catch (Exception e) {
            logger.warn("Error reading Redis key {}: {}", key, e.getMessage());
          }
        }
      }
      result.put("success", true);
      result.put("shopDomain", shopDomain);
      result.put("stuckSessions", stuckSessions);
      result.put("count", stuckSessions.size());
      result.put("timestamp", LocalDateTime.now().toString());
      return ResponseEntity.ok(result);
    } catch (Exception e) {
      logger.error("Failed to get stuck sessions for shop {}: {}", shopDomain, e.getMessage(), e);
      result.put("success", false);
      result.put("error", "Failed to get stuck sessions: " + e.getMessage());
      result.put("shopDomain", shopDomain);
      return ResponseEntity.status(500).body(result);
    }
  }

  @GetMapping("/stuck-sessions")
  public ResponseEntity<Map<String, Object>> getAllStuckSessions() {
    Map<String, Object> result = new HashMap<>();
    try {
      logger.warn("ADMIN: Getting all stuck sessions across all shops");
      Set<String> sessionKeys = enhancedRedisService.scanKeys("*session*");
      Map<String, List<Map<String, Object>>> stuckSessionsByShop = new HashMap<>();
      if (sessionKeys != null) {
        for (String key : sessionKeys) {
          try {
            String value = redisTemplate.opsForValue().get(key);
            if (value != null
                && (value.contains("invalid")
                    || value.contains("stuck")
                    || value.contains("cleanup"))) {
              String shopDomain = extractShopDomainFromKey(key);
              if (shopDomain != null) {
                Map<String, Object> sessionInfo = new HashMap<>();
                sessionInfo.put("key", key);
                sessionInfo.put("value", value);
                sessionInfo.put("type", getSessionKeyType(key));
                stuckSessionsByShop
                    .computeIfAbsent(shopDomain, k -> new ArrayList<>())
                    .add(sessionInfo);
              }
            }
          } catch (Exception e) {
            logger.warn("Error reading Redis key {}: {}", key, e.getMessage());
          }
        }
      }
      result.put("success", true);
      result.put("stuckSessionsByShop", stuckSessionsByShop);
      result.put("totalShops", stuckSessionsByShop.size());
      result.put(
          "totalStuckSessions", stuckSessionsByShop.values().stream().mapToInt(List::size).sum());
      result.put("timestamp", LocalDateTime.now().toString());
      return ResponseEntity.ok(result);
    } catch (Exception e) {
      logger.error("Failed to get all stuck sessions: {}", e.getMessage());
      result.put("success", false);
      result.put("error", "Failed to get stuck sessions: " + e.getMessage());
      return ResponseEntity.status(500).body(result);
    }
  }

  @PostMapping("/clear-stuck-sessions/{shopDomain}")
  public ResponseEntity<Map<String, Object>> clearAllStuckSessionsForShop(
      @PathVariable String shopDomain) {
    Map<String, Object> result = new HashMap<>();
    try {
      logger.warn("ADMIN: Clearing all stuck sessions for shop: {}", shopDomain);
      Set<String> sessionKeys = enhancedRedisService.scanKeys("*" + shopDomain + "*");
      int clearedCount = 0;
      if (sessionKeys != null) {
        for (String key : sessionKeys) {
          try {
            String value = redisTemplate.opsForValue().get(key);
            if (value != null
                && (value.contains("invalid")
                    || value.contains("stuck")
                    || value.contains("cleanup"))) {
              redisTemplate.delete(key);
              clearedCount++;
            }
          } catch (Exception e) {
            logger.warn("Error clearing Redis key {}: {}", key, e.getMessage());
          }
        }
      }
      shopService.clearStuckSessionMarkersForShop(shopDomain);
      result.put("success", true);
      result.put("shopDomain", shopDomain);
      result.put("clearedCount", clearedCount);
      result.put(
          "message", "Cleared " + clearedCount + " stuck session markers for shop: " + shopDomain);
      result.put("timestamp", LocalDateTime.now().toString());
      return ResponseEntity.ok(result);
    } catch (Exception e) {
      logger.error("Failed to clear stuck sessions for shop {}: {}", shopDomain, e.getMessage());
      result.put("success", false);
      result.put("error", "Failed to clear stuck sessions: " + e.getMessage());
      result.put("shopDomain", shopDomain);
      return ResponseEntity.status(500).body(result);
    }
  }

  private String extractShopDomainFromKey(String key) {
    try {
      if (key.contains("shop_token:")) {
        String[] parts = key.split("shop_token:");
        if (parts.length > 1) {
          String[] shopSession = parts[1].split(":");
          if (shopSession.length > 0) {
            return shopSession[0];
          }
        }
      }
      if (key.contains("invalid_session:")) {
        String[] parts = key.split("invalid_session:");
        if (parts.length > 1) {
          String[] shopSession = parts[1].split(":");
          if (shopSession.length > 0) {
            return shopSession[0];
          }
        }
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
    return "unknown";
  }
}
