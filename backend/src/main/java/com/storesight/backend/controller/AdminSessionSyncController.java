package com.storesight.backend.controller;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin-refactor/sync")
public class AdminSessionSyncController {

  private static final Logger logger = LoggerFactory.getLogger(AdminSessionSyncController.class);

  @Autowired private StringRedisTemplate redisTemplate;

  @PostMapping("/clear-stuck-session-markers")
  public ResponseEntity<Map<String, Object>> clearStuckSessionMarkers(
      @RequestParam String shopDomain) {
    Map<String, Object> result = new HashMap<>();
    try {
      String baseKey = "session:lock:" + shopDomain.toLowerCase();
      redisTemplate.delete(baseKey + ":invalid_session");
      redisTemplate.delete(baseKey + ":validation_failure_count");
      redisTemplate.delete(baseKey + ":session_invalidation");
      redisTemplate.delete(baseKey + ":session_state");

      result.put("success", true);
      result.put("shopDomain", shopDomain);
      result.put("timestamp", LocalDateTime.now().toString());
      return ResponseEntity.ok(result);
    } catch (Exception e) {
      logger.error(
          "Failed to clear stuck session markers for shop {}: {}", shopDomain, e.getMessage());
      result.put("success", false);
      result.put("error", "Failed to clear stuck session markers: " + e.getMessage());
      result.put("shopDomain", shopDomain);
      return ResponseEntity.status(500).body(result);
    }
  }
}
