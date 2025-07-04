package com.storesight.backend.controller;

import com.storesight.backend.model.AuditLog;
import com.storesight.backend.service.DataPrivacyService;
import com.storesight.backend.service.NotificationService;
import com.storesight.backend.service.SecretService;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
  private final SecretService secretService;
  private final NotificationService notificationService;
  private final DataPrivacyService dataPrivacyService;

  @Autowired
  public AdminController(
      SecretService secretService,
      NotificationService notificationService,
      DataPrivacyService dataPrivacyService) {
    this.secretService = secretService;
    this.notificationService = notificationService;
    this.dataPrivacyService = dataPrivacyService;
  }

  @PostMapping("/secrets")
  public ResponseEntity<Map<String, String>> updateSecret(@RequestBody Map<String, String> secret) {
    String key = secret.get("key");
    String value = secret.get("value");

    if (key == null || value == null) {
      return ResponseEntity.badRequest().body(Map.of("error", "Both key and value are required"));
    }

    secretService.storeSecret(key, value);
    return ResponseEntity.ok(Map.of("status", "Secret updated successfully"));
  }

  @GetMapping("/secrets/{key}")
  public ResponseEntity<Map<String, String>> getSecret(@PathVariable String key) {
    return secretService
        .getSecret(key)
        .map(value -> ResponseEntity.ok(Map.of("value", value)))
        .orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/secrets/{key}")
  public ResponseEntity<Map<String, String>> deleteSecret(@PathVariable String key) {
    secretService.deleteSecret(key);
    return ResponseEntity.ok(Map.of("status", "Secret deleted successfully"));
  }

  @GetMapping("/secrets")
  public ResponseEntity<java.util.List<java.util.Map<String, String>>> listSecrets() {
    java.util.Map<String, String> map = secretService.listSecrets();
    java.util.List<java.util.Map<String, String>> list = new java.util.ArrayList<>();
    map.forEach((k, v) -> list.add(java.util.Map.of("key", k, "value", v)));
    return ResponseEntity.ok(list);
  }

  @GetMapping("/integrations/status")
  public ResponseEntity<Map<String, Boolean>> getIntegrationStatus() {
    return ResponseEntity.ok(
        Map.of(
            "sendGridEnabled", notificationService.isSendGridEnabled(),
            "twilioEnabled", notificationService.isTwilioEnabled()));
  }

  @PostMapping("/integrations/test-email")
  public ResponseEntity<Map<String, Object>> testEmail(@RequestBody Map<String, String> request) {
    String to = request.get("to");

    if (to == null || to.trim().isEmpty()) {
      return ResponseEntity.badRequest()
          .body(Map.of("success", false, "error", "Email address is required"));
    }

    try {
      notificationService.sendEmailAlert(
          to,
          "ShopGauge Test Email",
          "This is a test email from ShopGauge Admin Panel. If you received this, your SendGrid integration is working correctly!");

      return ResponseEntity.ok(Map.of("success", true, "message", "Test email sent successfully"));
    } catch (Exception e) {
      return ResponseEntity.ok(
          Map.of("success", false, "error", "Failed to send test email: " + e.getMessage()));
    }
  }

  @PostMapping("/integrations/test-sms")
  public ResponseEntity<Map<String, Object>> testSms(@RequestBody Map<String, String> request) {
    String to = request.get("to");

    if (to == null || to.trim().isEmpty()) {
      return ResponseEntity.badRequest()
          .body(Map.of("success", false, "error", "Phone number is required"));
    }

    try {
      notificationService.sendSmsAlert(
          to, "ShopGauge Test SMS: Your Twilio integration is working correctly!");

      return ResponseEntity.ok(Map.of("success", true, "message", "Test SMS sent successfully"));
    } catch (Exception e) {
      return ResponseEntity.ok(
          Map.of("success", false, "error", "Failed to send test SMS: " + e.getMessage()));
    }
  }

  @GetMapping("/audit-logs/deleted-shops")
  public ResponseEntity<Map<String, Object>> getAuditLogsFromDeletedShops(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
    try {
      List<AuditLog> auditLogs = dataPrivacyService.getAuditLogsFromDeletedShops(page, size);

      // Map audit logs to include shop domain information
      List<Map<String, Object>> mappedLogs =
          auditLogs.stream()
              .map(
                  log -> {
                    Map<String, Object> logMap = new HashMap<>();
                    logMap.put("id", log.getId());
                    logMap.put("shopId", log.getShopId());
                    logMap.put("action", log.getAction());
                    logMap.put("details", log.getDetails());
                    logMap.put("userAgent", log.getUserAgent());
                    logMap.put("ipAddress", log.getIpAddress());
                    logMap.put("createdAt", log.getCreatedAt());
                    logMap.put("timestamp", log.getCreatedAt()); // For frontend compatibility

                    // Extract shop domain from the log
                    String shopDomain = dataPrivacyService.getShopDomainFromLog(log);
                    logMap.put("shopDomain", shopDomain);

                    return logMap;
                  })
              .collect(java.util.stream.Collectors.toList());

      Map<String, Object> response = new HashMap<>();
      response.put("audit_logs", mappedLogs);
      response.put("page", page);
      response.put("size", size);
      response.put("total_count", mappedLogs.size());
      response.put("note", "These are audit logs from shops that have been deleted");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(
              Map.of(
                  "error",
                  "Failed to retrieve audit logs from deleted shops",
                  "message",
                  e.getMessage()));
    }
  }

  @GetMapping("/audit-logs/all")
  public ResponseEntity<Map<String, Object>> getAllAuditLogs(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
    try {
      List<AuditLog> auditLogs = dataPrivacyService.getAllAuditLogs(page, size);

      // Map audit logs to include shop domain information
      List<Map<String, Object>> mappedLogs =
          auditLogs.stream()
              .map(
                  log -> {
                    Map<String, Object> logMap = new HashMap<>();
                    logMap.put("id", log.getId());
                    logMap.put("shopId", log.getShopId());
                    logMap.put("action", log.getAction());
                    logMap.put("details", log.getDetails());
                    logMap.put("userAgent", log.getUserAgent());
                    logMap.put("ipAddress", log.getIpAddress());
                    logMap.put("createdAt", log.getCreatedAt());
                    logMap.put("timestamp", log.getCreatedAt()); // For frontend compatibility

                    // Extract shop domain from the log
                    String shopDomain = dataPrivacyService.getShopDomainFromLog(log);
                    logMap.put("shopDomain", shopDomain);

                    return logMap;
                  })
              .collect(java.util.stream.Collectors.toList());

      Map<String, Object> response = new HashMap<>();
      response.put("audit_logs", mappedLogs);
      response.put("page", page);
      response.put("size", size);
      response.put("total_count", mappedLogs.size());
      response.put("note", "All audit logs including those from deleted shops");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to retrieve all audit logs", "message", e.getMessage()));
    }
  }

  @GetMapping("/active-shops")
  public ResponseEntity<Map<String, Object>> getActiveShops() {
    try {
      // Get active shops - shops that have made requests recently
      List<Map<String, Object>> activeShops = dataPrivacyService.getActiveShops();

      Map<String, Object> response = new HashMap<>();
      response.put("active_shops", activeShops);
      response.put("total_count", activeShops.size());
      response.put(
          "note",
          "Shops that are currently active or have recent activity (enhanced with multi-session support)");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to retrieve active shops", "message", e.getMessage()));
    }
  }

  @GetMapping("/active-shops/detailed")
  public ResponseEntity<Map<String, Object>> getDetailedActiveShops() {
    try {
      // Get detailed shop session information
      List<Map<String, Object>> detailedShops = dataPrivacyService.getDetailedActiveShops();

      Map<String, Object> response = new HashMap<>();
      response.put("detailed_shops", detailedShops);
      response.put("total_sessions", detailedShops.size());
      response.put(
          "unique_shops",
          detailedShops.stream().map(shop -> shop.get("shopDomain")).distinct().count());
      response.put("note", "Detailed information about all active sessions for each shop");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(
              Map.of(
                  "error", "Failed to retrieve detailed active shops", "message", e.getMessage()));
    }
  }

  @GetMapping("/session-statistics")
  public ResponseEntity<Map<String, Object>> getSessionStatistics() {
    try {
      // Get comprehensive session statistics
      Map<String, Object> statistics = dataPrivacyService.getSessionStatistics();

      Map<String, Object> response = new HashMap<>();
      response.put("statistics", statistics);
      response.put(
          "note", "Comprehensive session statistics for monitoring multi-session architecture");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(
              Map.of("error", "Failed to retrieve session statistics", "message", e.getMessage()));
    }
  }

  @GetMapping("/deleted-shops")
  public ResponseEntity<Map<String, Object>> getDeletedShops() {
    try {
      // Get deleted shops data formatted consistently
      List<Map<String, Object>> deletedShops = dataPrivacyService.getDeletedShopsData();

      Map<String, Object> response = new HashMap<>();
      response.put("deleted_shops", deletedShops);
      response.put("total_count", deletedShops.size());
      response.put("note", "Shops that have been deleted with extracted domain information");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to retrieve deleted shops", "message", e.getMessage()));
    }
  }

  @GetMapping("/audit-logs/active-shops")
  public ResponseEntity<Map<String, Object>> getAuditLogsFromActiveShops(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
    try {
      // Get all audit logs that have shop IDs (not null = active shops)
      List<AuditLog> auditLogs = dataPrivacyService.getAuditLogsFromActiveShops(page, size);

      // Map audit logs to include shop domain information
      List<Map<String, Object>> mappedLogs =
          auditLogs.stream()
              .map(
                  log -> {
                    Map<String, Object> logMap = new HashMap<>();
                    logMap.put("id", log.getId());
                    logMap.put("shopId", log.getShopId());
                    logMap.put("action", log.getAction());
                    logMap.put("details", log.getDetails());
                    logMap.put("userAgent", log.getUserAgent());
                    logMap.put("ipAddress", log.getIpAddress());
                    logMap.put("createdAt", log.getCreatedAt());
                    logMap.put("timestamp", log.getCreatedAt()); // For frontend compatibility

                    // Extract shop domain from the log
                    String shopDomain = dataPrivacyService.getShopDomainFromLog(log);
                    logMap.put("shopDomain", shopDomain);

                    return logMap;
                  })
              .collect(java.util.stream.Collectors.toList());

      Map<String, Object> response = new HashMap<>();
      response.put("audit_logs", mappedLogs);
      response.put("page", page);
      response.put("size", size);
      response.put("total_count", mappedLogs.size());
      response.put("note", "These are audit logs from active shops (shops that still exist)");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(
              Map.of(
                  "error",
                  "Failed to retrieve audit logs from active shops",
                  "message",
                  e.getMessage()));
    }
  }
}
