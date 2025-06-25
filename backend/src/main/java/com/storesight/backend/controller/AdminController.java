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

      Map<String, Object> response = new HashMap<>();
      response.put("audit_logs", auditLogs);
      response.put("page", page);
      response.put("size", size);
      response.put("total_count", auditLogs.size());
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

      Map<String, Object> response = new HashMap<>();
      response.put("audit_logs", auditLogs);
      response.put("page", page);
      response.put("size", size);
      response.put("total_count", auditLogs.size());
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
      response.put("note", "Shops that are currently active or have recent activity");

      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.status(500)
          .body(Map.of("error", "Failed to retrieve active shops", "message", e.getMessage()));
    }
  }
}
