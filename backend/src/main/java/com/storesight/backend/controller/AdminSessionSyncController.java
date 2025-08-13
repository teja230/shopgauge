package com.storesight.backend.controller;

import com.storesight.backend.service.SessionSynchronizationService;
import com.storesight.backend.service.ShopService;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin-refactor/sessions")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSessionSyncController {
  private static final Logger logger = LoggerFactory.getLogger(AdminSessionSyncController.class);
  private final SessionSynchronizationService sessionSynchronizationService;
  private final ShopService shopService;

  @Autowired
  public AdminSessionSyncController(
      SessionSynchronizationService sessionSynchronizationService, ShopService shopService) {
    this.sessionSynchronizationService = sessionSynchronizationService;
    this.shopService = shopService;
  }

  @PostMapping("/clear-stuck/{sessionId}")
  public ResponseEntity<Map<String, Object>> clearStuckSession(@PathVariable String sessionId) {
    Map<String, Object> result = new HashMap<>();
    try {
      logger.warn("Admin clearing stuck session markers for session: {}", sessionId);
      sessionSynchronizationService.clearStuckSessionMarkers(sessionId);
      shopService.performSessionCleanup("unknown", sessionId);
      result.put("success", true);
      result.put("sessionId", sessionId);
      result.put("message", "Stuck session markers cleared successfully");
      result.put("timestamp", LocalDateTime.now().toString());
      return ResponseEntity.ok(result);
    } catch (Exception e) {
      logger.error("Failed to clear stuck session {}: {}", sessionId, e.getMessage());
      result.put("success", false);
      result.put("sessionId", sessionId);
      result.put("error", "Failed to clear stuck session: " + e.getMessage());
      return ResponseEntity.status(500).body(result);
    }
  }

  @GetMapping("/sync-status/{sessionId}")
  public ResponseEntity<Map<String, Object>> getSessionSyncStatus(@PathVariable String sessionId) {
    Map<String, Object> result = new HashMap<>();
    try {
      boolean isInvalidating = sessionSynchronizationService.isSessionInvalidating(sessionId);
      result.put("sessionId", sessionId);
      result.put("isInvalidating", isInvalidating);
      result.put(
          "shouldAllowOperation",
          sessionSynchronizationService.shouldAllowSessionOperation(sessionId));
      result.put("timestamp", LocalDateTime.now().toString());
      return ResponseEntity.ok(result);
    } catch (Exception e) {
      logger.error("Failed to get session sync status for {}: {}", sessionId, e.getMessage());
      result.put("sessionId", sessionId);
      result.put("error", "Failed to get session sync status: " + e.getMessage());
      return ResponseEntity.status(500).body(result);
    }
  }

  @PostMapping("/emergency-cleanup")
  public ResponseEntity<Map<String, Object>> emergencySessionCleanup() {
    Map<String, Object> result = new HashMap<>();
    try {
      logger.warn("EMERGENCY SESSION CLEANUP: Clearing all stuck session markers");
      result.put("success", true);
      result.put("message", "Emergency session cleanup initiated");
      result.put("timestamp", LocalDateTime.now().toString());
      result.put("note", "This endpoint is a placeholder for comprehensive session cleanup");
      return ResponseEntity.ok(result);
    } catch (Exception e) {
      logger.error("Emergency session cleanup failed: {}", e.getMessage());
      result.put("success", false);
      result.put("error", "Emergency session cleanup failed: " + e.getMessage());
      return ResponseEntity.status(500).body(result);
    }
  }

  @PostMapping("/clear-stuck-markers/{sessionId}")
  public ResponseEntity<Map<String, Object>> clearStuckSessionMarkers(
      @PathVariable String sessionId) {
    Map<String, Object> result = new HashMap<>();
    try {
      logger.warn("ADMIN: Clearing stuck session markers for session: {}", sessionId);
      shopService.clearStuckSessionMarkers(sessionId);
      result.put("success", true);
      result.put("message", "Stuck session markers cleared for session: " + sessionId);
      result.put("sessionId", sessionId);
      result.put("timestamp", LocalDateTime.now().toString());
      return ResponseEntity.ok(result);
    } catch (Exception e) {
      logger.error(
          "Failed to clear stuck session markers for session {}: {}", sessionId, e.getMessage());
      result.put("success", false);
      result.put("error", "Failed to clear stuck session markers: " + e.getMessage());
      result.put("sessionId", sessionId);
      return ResponseEntity.status(500).body(result);
    }
  }

  @PostMapping("/clear-stuck-markers/shop/{shopDomain}")
  public ResponseEntity<Map<String, Object>> clearStuckSessionMarkersForShop(
      @PathVariable String shopDomain) {
    Map<String, Object> result = new HashMap<>();
    try {
      logger.warn("ADMIN: Clearing all stuck session markers for shop: {}", shopDomain);
      shopService.clearStuckSessionMarkersForShop(shopDomain);
      result.put("success", true);
      result.put("message", "All stuck session markers cleared for shop: " + shopDomain);
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
