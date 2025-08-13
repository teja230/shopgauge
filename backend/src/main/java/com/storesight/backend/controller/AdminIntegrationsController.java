package com.storesight.backend.controller;

import com.storesight.backend.service.NotificationService;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin-refactor/integrations")
@Validated
@PreAuthorize("hasRole('ADMIN')")
public class AdminIntegrationsController {
  private final NotificationService notificationService;

  @Autowired
  public AdminIntegrationsController(NotificationService notificationService) {
    this.notificationService = notificationService;
  }

  @GetMapping("/status")
  public ResponseEntity<Map<String, Boolean>> getIntegrationStatus() {
    return ResponseEntity.ok(
        Map.of(
            "sendGridEnabled", notificationService.isSendGridEnabled(),
            "twilioEnabled", notificationService.isTwilioEnabled()));
  }

  @PostMapping("/test-email")
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

  @PostMapping("/test-sms")
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
}

