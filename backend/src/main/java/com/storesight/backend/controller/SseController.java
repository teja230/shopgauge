package com.storesight.backend.controller;

import com.storesight.backend.service.SseService;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Enterprise-Grade SSE Controller
 *
 * <p>Production-ready Server-Sent Events controller showcasing: - Minimal payloads for optimal
 * performance - Intelligent batching for high-volume scenarios - Comprehensive connection
 * management - Rate limiting and backoff strategies - Health monitoring and metrics
 */
@RestController
@RequestMapping("/api/sse")
public class SseController {

  private static final Logger logger = LoggerFactory.getLogger(SseController.class);

  private final SseService sseService;

  @Autowired
  public SseController(SseService sseService) {
    this.sseService = sseService;
  }

  /** Authenticated SSE subscribe endpoint that binds stream to the authenticated shop. */
  @GetMapping("/subscribe/{shopDomain}")
  public ResponseEntity<?> subscribe(
      @PathVariable String shopDomain, Authentication authentication) {
    try {
      if (authentication == null || authentication.getName() == null) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(Map.of("error", "Unauthorized", "message", "Authentication required"));
      }

      String principalShop = authentication.getName();
      boolean isShopRole =
          authentication.getAuthorities().stream()
              .map(GrantedAuthority::getAuthority)
              .anyMatch(a -> a.equals("ROLE_SHOP"));

      if (!isShopRole || !principalShop.equalsIgnoreCase(shopDomain)) {
        logger.warn("SSE subscribe forbidden: principal {} for shop {}", principalShop, shopDomain);
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(Map.of("error", "Forbidden", "message", "Shop mismatch"));
      }

      if (!sseService.canAcceptConnection(shopDomain)) {
        logger.warn("SSE subscribe denied due to capacity for shop {}", shopDomain);
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
            .body(Map.of("error", "Too many connections", "retryAfterMs", 10000));
      }

      String sessionId = null; // SseService handles optional session awareness
      SseEmitter emitter = sseService.createConnection(shopDomain, sessionId);
      return ResponseEntity.ok(emitter);
    } catch (Exception e) {
      logger.error("Error establishing SSE subscription for {}: {}", shopDomain, e.getMessage());
      return ResponseEntity.internalServerError()
          .body(Map.of("error", "Failed to subscribe", "message", e.getMessage()));
    }
  }

  /** Get comprehensive SSE statistics for monitoring */
  @GetMapping("/stats")
  public ResponseEntity<Map<String, Object>> getSseStatistics() {
    try {
      Map<String, Object> stats = sseService.getStatistics();
      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("data", stats);
      response.put("message", "SSE statistics retrieved successfully");

      logger.info(
          "SSE statistics retrieved: {} active connections", stats.get("activeConnections"));

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      logger.error("Error retrieving SSE statistics: {}", e.getMessage(), e);
      Map<String, Object> response = new HashMap<>();
      response.put("success", false);
      response.put("error", "Failed to retrieve SSE statistics");
      response.put("message", e.getMessage());
      return ResponseEntity.internalServerError().body(response);
    }
  }

  /**
   * Production-ready SSE batching endpoint Demonstrates enterprise-grade batching with minimal
   * payloads
   */
  @GetMapping("/batch/{shopDomain}")
  public SseEmitter batchEvents(@PathVariable String shopDomain) {
    logger.info("Production SSE batching request for shop: {}", shopDomain);

    SseEmitter emitter = new SseEmitter(10000L);

    try {
      // Create sample events for demonstration
      for (int i = 1; i <= 5; i++) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("sequence", i);
        metadata.put("timestamp", System.currentTimeMillis());
        metadata.put("source", "production_batch");
        metadata.put("priority", i <= 2 ? "high" : "normal");

        SseService.SseEvent event =
            new SseService.SseEvent(
                "production_event", "Enterprise batch event " + i, null, metadata);

        // Queue event for batching
        sseService.queueEventForBatching(shopDomain, event);
      }

      // Send the batch immediately
      sseService.sendBatch(shopDomain);

      logger.info("Production SSE batch sent for shop: {}", shopDomain);

    } catch (Exception e) {
      logger.error("Error in production SSE batching for shop {}: {}", shopDomain, e.getMessage());
    } finally {
      emitter.complete();
    }

    return emitter;
  }

  /**
   * High-frequency event batching demonstration Shows how the system handles rapid-fire events
   * efficiently
   */
  @GetMapping("/high-frequency/{shopDomain}")
  public SseEmitter highFrequencyEvents(@PathVariable String shopDomain) {
    logger.info("High-frequency SSE events request for shop: {}", shopDomain);

    SseEmitter emitter = new SseEmitter(15000L);

    try {
      // Simulate high-frequency events (like real-time analytics)
      for (int i = 1; i <= 20; i++) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("sequence", i);
        metadata.put("timestamp", System.currentTimeMillis());
        metadata.put("frequency", "high");
        metadata.put("type", i % 3 == 0 ? "analytics" : i % 2 == 0 ? "notification" : "heartbeat");

        SseService.SseEvent event =
            new SseService.SseEvent("high_freq_event", "High-frequency event " + i, null, metadata);

        // Queue for batching - the service will automatically batch these
        sseService.queueEventForBatching(shopDomain, event);

        // Small delay to simulate real-time events
        Thread.sleep(50);
      }

      // Send any remaining events in the batch
      sseService.sendBatch(shopDomain);

      logger.info("High-frequency SSE events completed for shop: {}", shopDomain);

    } catch (Exception e) {
      logger.error(
          "Error in high-frequency SSE events for shop {}: {}", shopDomain, e.getMessage());
    } finally {
      emitter.complete();
    }

    return emitter;
  }

  /** Broadcast demonstration Shows how to send events to all connected clients for a shop */
  @PostMapping("/broadcast/{shopDomain}")
  public ResponseEntity<Map<String, Object>> broadcastEvent(
      @PathVariable String shopDomain, @RequestBody Map<String, Object> request) {

    try {
      String eventType = (String) request.getOrDefault("eventType", "broadcast");
      String message = (String) request.getOrDefault("message", "Broadcast message");
      Integer reconnectMs = (Integer) request.get("reconnectMs");

      // Extract metadata if provided
      @SuppressWarnings("unchecked")
      Map<String, Object> metadata = (Map<String, Object>) request.get("metadata");

      if (metadata != null) {
        sseService.broadcastToShop(shopDomain, eventType, message, reconnectMs, metadata);
      } else {
        sseService.broadcastToShop(shopDomain, eventType, message, reconnectMs);
      }

      Map<String, Object> response = new HashMap<>();
      response.put("success", true);
      response.put("message", "Event broadcasted successfully");
      response.put("shopDomain", shopDomain);
      response.put("eventType", eventType);

      logger.info("Event broadcasted to shop {}: {}", shopDomain, eventType);

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("Error broadcasting event to shop {}: {}", shopDomain, e.getMessage());
      Map<String, Object> response = new HashMap<>();
      response.put("success", false);
      response.put("error", "Failed to broadcast event");
      response.put("message", e.getMessage());
      return ResponseEntity.internalServerError().body(response);
    }
  }

  /** Health check for SSE service */
  @GetMapping("/health")
  public ResponseEntity<Map<String, Object>> sseHealth() {
    try {
      Map<String, Object> stats = sseService.getStatistics();
      Map<String, Object> health = (Map<String, Object>) stats.get("health");

      Map<String, Object> response = new HashMap<>();
      response.put("status", "healthy");
      response.put("sseService", "operational");
      response.put("activeConnections", stats.get("activeConnections"));
      response.put("health", health);
      response.put("timestamp", System.currentTimeMillis());

      return ResponseEntity.ok(response);

    } catch (Exception e) {
      logger.error("SSE health check failed: {}", e.getMessage());
      Map<String, Object> response = new HashMap<>();
      response.put("status", "unhealthy");
      response.put("sseService", "error");
      response.put("error", e.getMessage());
      response.put("timestamp", System.currentTimeMillis());

      return ResponseEntity.status(503).body(response);
    }
  }
}
