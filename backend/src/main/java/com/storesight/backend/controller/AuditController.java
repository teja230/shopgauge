package com.storesight.backend.controller;

import com.storesight.backend.service.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/audit")
@CrossOrigin(origins = "*")
public class AuditController {

  @Autowired private AuditLogService auditLogService;

  @PostMapping("/log")
  public ResponseEntity<?> logAction(
      @RequestBody Map<String, Object> auditData, HttpServletRequest request) {

    try {
      String shopDomain = (String) request.getSession().getAttribute("shop");
      String action = (String) auditData.get("action");
      String type = (String) auditData.get("type");
      @SuppressWarnings("unchecked")
      Map<String, Object> details = (Map<String, Object>) auditData.get("details");

      if (shopDomain == null || action == null || type == null) {
        return ResponseEntity.badRequest().body(Map.of("error", "Missing required audit data"));
      }

      // Log the action using the service
      auditLogService.logExportAction(shopDomain, action, type, details);

      return ResponseEntity.ok(Map.of("success", true, "message", "Action logged successfully"));

    } catch (Exception e) {
      return ResponseEntity.internalServerError()
          .body(Map.of("error", "Failed to log audit action: " + e.getMessage()));
    }
  }

  @GetMapping("/export-stats")
  public ResponseEntity<?> getExportStats(HttpServletRequest request) {
    try {
      String shopDomain = (String) request.getSession().getAttribute("shop");

      if (shopDomain == null) {
        return ResponseEntity.badRequest().body(Map.of("error", "No shop session found"));
      }

      Map<String, Object> stats = auditLogService.getExportStats(shopDomain);

      return ResponseEntity.ok(stats);

    } catch (Exception e) {
      return ResponseEntity.internalServerError()
          .body(Map.of("error", "Failed to get export stats: " + e.getMessage()));
    }
  }

  private String generateDescription(String action, String type, Map<String, Object> details) {
    StringBuilder desc = new StringBuilder();

    switch (action) {
      case "export":
        desc.append("Exported chart as ").append(type.toUpperCase());
        if (details != null) {
          if (details.containsKey("chartTitle")) {
            desc.append(" - ").append(details.get("chartTitle"));
          }
          if (details.containsKey("quality")) {
            desc.append(" (").append(details.get("quality")).append(" quality)");
          }
        }
        break;

      case "share":
        desc.append("Shared chart on ").append(type);
        if (details != null && details.containsKey("chartTitle")) {
          desc.append(" - ").append(details.get("chartTitle"));
        }
        break;

      default:
        desc.append("Performed ").append(action).append(" action with type ").append(type);
    }

    return desc.toString();
  }

  private String getClientIpAddress(HttpServletRequest request) {
    String xForwardedFor = request.getHeader("X-Forwarded-For");
    if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
      return xForwardedFor.split(",")[0].trim();
    }

    String xRealIp = request.getHeader("X-Real-IP");
    if (xRealIp != null && !xRealIp.isEmpty()) {
      return xRealIp;
    }

    return request.getRemoteAddr();
  }
}
